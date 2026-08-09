"""Inteliforce service — API movil para la app unificada con SueldOK"""

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import date, datetime, timezone, timedelta
from decimal import Decimal
import json
import uuid

from api.src.inteliforce.models import InteliforceServiceKey
from api.src.inteliforce.schemas import SyncRecord
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


async def search_products(
    db: AsyncSession, company_id: str, rama: str | None, search: str, limit: int = 30, offset: int = 0,
) -> list[dict]:
    """Cataloto filtrado por la rama del vendedor autenticado (viene del JWT,
    no de un parametro del cliente — no se puede falsear pidiendo la otra
    rama). Lineas sin clasificar (rama NULL) quedan visibles para todos."""
    query = text("""
        SELECT p.id, p.sku, p.nombre, p.precio_venta, p.unidad_medida,
               pl.nombre AS linea_nombre,
               COALESCE(SUM(st.cantidad), 0) AS stock
        FROM products p
        LEFT JOIN product_lines pl ON pl.id = p.linea_id
        LEFT JOIN stock st ON st.product_id = p.id
        WHERE p.company_id = :company_id AND p.activo = true
        AND (pl.rama IS NULL OR pl.rama = :rama OR pl.rama = 'ambas')
        AND (p.nombre ILIKE :search OR p.sku ILIKE :search)
        GROUP BY p.id, p.sku, p.nombre, p.precio_venta, p.unidad_medida, pl.nombre
        ORDER BY p.nombre ASC
        LIMIT :limit OFFSET :offset
    """)
    result = await db.execute(query, {
        "company_id": company_id, "rama": rama, "search": f"%{search}%",
        "limit": limit, "offset": offset,
    })
    return [dict(row._mapping) for row in result.fetchall()]


async def get_targets_breakdown(db: AsyncSession, rep, periodo_inicio: date, periodo_fin: date) -> list[dict]:
    """Una fila por cada componente/linea de meta del periodo — el dueño pidio
    especificamente ver el detalle completo, no solo un total agregado."""
    from api.src.sales_targets.service import get_rep_progress
    from api.src.sales_targets.models import SalesTarget
    from sqlalchemy import select as sa_select

    result = await db.execute(
        sa_select(SalesTarget).where(
            SalesTarget.sales_rep_id == rep.id,
            SalesTarget.periodo_inicio == periodo_inicio,
            SalesTarget.periodo_fin == periodo_fin,
            SalesTarget.product_line_id.isnot(None),
        )
    )
    target_rows = result.scalars().all()

    breakdown = []
    for t in target_rows:
        from api.src.sales_targets.models import ProductLine
        line_result = await db.execute(sa_select(ProductLine).where(ProductLine.id == t.product_line_id))
        line = line_result.scalar_one_or_none()
        progress = await get_rep_progress(db, rep, periodo_inicio, periodo_fin, product_line_id=str(t.product_line_id))
        breakdown.append({
            "product_line_id": t.product_line_id,
            "nombre": line.nombre if line else "—",
            "meta_gs": progress["meta_gs"], "venta_gs": progress["venta_gs"], "pct_gs": progress["pct_gs"],
            "meta_unidades": progress["meta_unidades"], "unidades": progress["unidades"],
            "pct_unidades": progress["pct_unidades"], "cumplido": progress["cumplido"],
        })
    return breakdown


async def get_top_products(db: AsyncSession, company_id: str, customer_id: str, limit: int = 8) -> list[dict]:
    query = text("""
        SELECT si.product_id, p.nombre, SUM(si.cantidad) AS cantidad_total, MAX(s.fecha)::date AS ultima_compra
        FROM sale_items si
        JOIN sales s ON s.id = si.sale_id
        JOIN products p ON p.id = si.product_id
        WHERE s.customer_id = :customer_id AND s.company_id = :company_id AND s.estado != 'cancelado'
        GROUP BY si.product_id, p.nombre
        ORDER BY cantidad_total DESC
        LIMIT :limit
    """)
    result = await db.execute(query, {"customer_id": customer_id, "company_id": company_id, "limit": limit})
    return [dict(row._mapping) for row in result.fetchall()]


async def get_suggestions(db: AsyncSession, company_id: str, customer_id: str, limit: int = 10) -> list[dict]:
    """Sugerencias accionables: (a) productos de sus lineas habituales que no
    compra hace 60+ dias (win-back), (b) top-sellers de esas mismas lineas
    que nunca compro (cross-sell). Ranking simple por frecuencia real, sin ML
    — explicable y verificable contra los datos."""
    habitual_lineas = await db.execute(
        text("""
            SELECT pl.id AS linea_id, COUNT(*) AS compras
            FROM sale_items si
            JOIN sales s ON s.id = si.sale_id
            JOIN products p ON p.id = si.product_id
            JOIN product_lines pl ON pl.id = p.linea_id
            WHERE s.customer_id = :customer_id AND s.company_id = :company_id AND s.estado != 'cancelado'
            GROUP BY pl.id
            HAVING COUNT(*) >= 2
            ORDER BY compras DESC
            LIMIT 8
        """),
        {"customer_id": customer_id, "company_id": company_id},
    )
    linea_ids = [row.linea_id for row in habitual_lineas.fetchall()]
    if not linea_ids:
        return []

    winback = await db.execute(
        text("""
            SELECT p.id AS product_id, p.nombre, p.sku, p.precio_venta, pl.nombre AS linea_nombre,
                   MAX(s.fecha)::date AS ultima_compra
            FROM sale_items si
            JOIN sales s ON s.id = si.sale_id
            JOIN products p ON p.id = si.product_id
            JOIN product_lines pl ON pl.id = p.linea_id
            WHERE s.customer_id = :customer_id AND s.company_id = :company_id AND s.estado != 'cancelado'
            AND p.linea_id = ANY(:linea_ids) AND p.activo = true
            GROUP BY p.id, p.nombre, p.sku, p.precio_venta, pl.nombre
            HAVING MAX(s.fecha) < now() - interval '60 days'
            ORDER BY MAX(s.fecha) ASC
            LIMIT :limit
        """),
        {"customer_id": customer_id, "company_id": company_id, "linea_ids": linea_ids, "limit": limit},
    )
    sugerencias = [
        {
            "product_id": row.product_id, "nombre": row.nombre, "sku": row.sku,
            "precio_venta": float(row.precio_venta or 0), "linea_nombre": row.linea_nombre,
            "motivo": f"no_compra_desde_{row.ultima_compra}",
        }
        for row in winback.fetchall()
    ]

    restantes = limit - len(sugerencias)
    if restantes > 0:
        crosssell = await db.execute(
            text("""
                SELECT p.id AS product_id, p.nombre, p.sku, p.precio_venta, pl.nombre AS linea_nombre,
                       COUNT(*) AS ventas
                FROM sale_items si
                JOIN sales s ON s.id = si.sale_id
                JOIN products p ON p.id = si.product_id
                JOIN product_lines pl ON pl.id = p.linea_id
                WHERE s.company_id = :company_id AND s.fecha > now() - interval '90 days'
                AND p.linea_id = ANY(:linea_ids) AND p.activo = true
                AND NOT EXISTS (
                    SELECT 1 FROM sale_items si2 JOIN sales s2 ON s2.id = si2.sale_id
                    WHERE s2.customer_id = :customer_id AND si2.product_id = p.id
                )
                GROUP BY p.id, p.nombre, p.sku, p.precio_venta, pl.nombre
                ORDER BY ventas DESC
                LIMIT :limit
            """),
            {"company_id": company_id, "customer_id": customer_id, "linea_ids": linea_ids, "limit": restantes},
        )
        sugerencias += [
            {
                "product_id": row.product_id, "nombre": row.nombre, "sku": row.sku,
                "precio_venta": float(row.precio_venta or 0), "linea_nombre": row.linea_nombre,
                "motivo": "nunca_comprado_top_linea",
            }
            for row in crosssell.fetchall()
        ]

    return sugerencias


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
    top_productos = await get_top_products(db, company_id, customer_id)
    sugerencias = await get_suggestions(db, company_id, customer_id)

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
        "top_productos": top_productos,
        "sugerencias": sugerencias,
    }


async def sync_records(db: AsyncSession, company_id: str, records: list[SyncRecord]) -> dict:
    """Upsert idempotente por (record_type, convex_id) — SueldOK puede
    reenviar el mismo evento sin duplicar (ej. si un sync nocturno se corta
    a la mitad y se reintenta). Ver convex/intelimarketSync.js del lado
    SueldOK, que es quien llama esto via el cron nuevo."""
    upserted = 0
    for r in records:
        result = await db.execute(
            text("""
                INSERT INTO inteliforce_sync_records
                    (company_id, record_type, convex_id, employee_convex_id, recorded_at, payload)
                VALUES (:company_id, :record_type, :convex_id, :employee_convex_id, :recorded_at, :payload)
                ON CONFLICT (record_type, convex_id)
                DO UPDATE SET payload = EXCLUDED.payload, synced_at = now()
            """),
            {
                "company_id": company_id,
                "record_type": r.record_type,
                "convex_id": r.convex_id,
                "employee_convex_id": r.employee_convex_id,
                "recorded_at": r.recorded_at,
                "payload": json.dumps(r.payload),
            },
        )
        upserted += 1
    await db.commit()
    return {"received": len(records), "upserted": upserted}
