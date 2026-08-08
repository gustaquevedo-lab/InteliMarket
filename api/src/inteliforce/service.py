"""Inteliforce service — API movil para la app unificada con SueldOK"""

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import date, datetime, timezone, timedelta
from decimal import Decimal
import uuid

from api.src.inteliforce.models import InteliforceServiceKey
from api.src.sales_targets.models import SalesRep
from api.src.auth.jwt import create_access_token


async def get_service_key(db: AsyncSession, api_key: str) -> InteliforceServiceKey | None:
    result = await db.execute(
        select(InteliforceServiceKey).where(
            InteliforceServiceKey.api_key == api_key,
            InteliforceServiceKey.activo == True,
        )
    )
    return result.scalar_one_or_none()


async def exchange_auth(db: AsyncSession, api_key: str, cedula: str) -> dict | None:
    """SueldOK ya autentico al empleado (o esta en medio del SSO) y canjea su
    cedula por un JWT de Intelimarket para que la app pueda pegarle directo a
    la API de pedidos/metas/cliente 360. Nunca se comparte contrasena real."""
    key = await get_service_key(db, api_key)
    if not key:
        return None

    result = await db.execute(
        select(SalesRep).where(
            SalesRep.company_id == key.company_id,
            SalesRep.cedula == cedula,
            SalesRep.activo == True,
        )
    )
    rep = result.scalar_one_or_none()
    if not rep or not rep.user_id:
        return None

    token = create_access_token(
        {
            "sub": str(rep.user_id),
            "id": str(rep.user_id),
            "company_id": str(rep.company_id),
            "tenant_id": str(rep.company_id),
            "rol": rep.rol,
            "sales_rep_id": str(rep.id),
        },
        expires_delta=timedelta(hours=12),
    )
    return {
        "access_token": token,
        "sales_rep_id": rep.id,
        "nombre": rep.nombre,
        "rol": rep.rol,
    }


async def get_rep_by_token_claim(db: AsyncSession, sales_rep_id: str) -> SalesRep | None:
    result = await db.execute(select(SalesRep).where(SalesRep.id == uuid.UUID(sales_rep_id)))
    return result.scalar_one_or_none()


async def get_routes_today(db: AsyncSession, company_id: str, rep: SalesRep) -> list[dict]:
    if not rep.user_id:
        return []
    # SalesRoute usa 0=Domingo..6=Sabado (comentario en el modelo); date.weekday()
    # de Python es 0=Lunes..6=Domingo, hay que convertir.
    dow = (date.today().weekday() + 1) % 7
    query = text("""
        SELECT rc.customer_id, rc.orden_visita, sr.id as route_id, sr.nombre as route_nombre,
               c.razon_social, c.direccion, c.telefono
        FROM sales_routes sr
        JOIN route_customers rc ON rc.route_id = sr.id
        JOIN customers c ON c.id = rc.customer_id
        WHERE sr.company_id = :company_id
        AND sr.user_id = :user_id
        AND sr.estado = 'activo'
        AND (rc.dia_semana IS NULL OR rc.dia_semana = :dow)
        ORDER BY rc.orden_visita ASC
    """)
    result = await db.execute(query, {"company_id": company_id, "user_id": str(rep.user_id), "dow": dow})
    return [dict(row._mapping) for row in result.fetchall()]


async def get_customer_360(db: AsyncSession, company_id: str, customer_id: str) -> dict | None:
    cust_result = await db.execute(
        text("SELECT * FROM customers WHERE id = :id AND company_id = :company_id"),
        {"id": customer_id, "company_id": company_id},
    )
    customer = cust_result.fetchone()
    if not customer:
        return None
    customer = dict(customer._mapping)

    credit_result = await db.execute(
        text("SELECT limite_credito, saldo_utilizado, saldo_disponible, dias_plazo FROM credit_accounts WHERE customer_id = :id"),
        {"id": customer_id},
    )
    credit = credit_result.fetchone()

    ar_result = await db.execute(
        text("""
            SELECT COALESCE(SUM(saldo_pendiente), 0) as pendiente,
                   COALESCE(SUM(CASE WHEN fecha_vencimiento < CURRENT_DATE THEN 1 ELSE 0 END), 0) as vencidos
            FROM accounts_receivable WHERE customer_id = :id AND estado = 'pendiente'
        """),
        {"id": customer_id},
    )
    ar = ar_result.fetchone()

    checks_result = await db.execute(
        text("SELECT COALESCE(SUM(monto), 0) as total FROM checks WHERE customer_id = :id AND estado IN ('cartera', 'depositado')"),
        {"id": customer_id},
    )
    checks_total = checks_result.scalar() or 0

    sales_result = await db.execute(
        text("""
            SELECT numero, fecha, total, estado FROM sales
            WHERE customer_id = :id AND company_id = :company_id
            ORDER BY fecha DESC LIMIT 5
        """),
        {"id": customer_id, "company_id": company_id},
    )
    ultimas = [dict(row._mapping) for row in sales_result.fetchall()]

    return {
        "customer_id": customer["id"],
        "razon_social": customer["razon_social"],
        "ruc": customer.get("ruc"),
        "direccion": customer.get("direccion"),
        "telefono": customer.get("telefono"),
        "credito_limite": float(credit.limite_credito) if credit else float(customer.get("credito_limite") or 0),
        "credito_usado": float(credit.saldo_utilizado) if credit else float(customer.get("credito_usado") or 0),
        "saldo_disponible": float(credit.saldo_disponible) if credit else 0,
        "dias_plazo": credit.dias_plazo if credit else None,
        "cuentas_por_cobrar_pendiente": float(ar.pendiente),
        "documentos_vencidos": int(ar.vencidos),
        "cheques_en_cartera": float(checks_total),
        "ultimas_compras": ultimas,
    }
