"""Credit account service"""

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
from decimal import Decimal
import uuid

from api.src.credit_accounts.models import CreditAccount, CreditMovement
from api.src.credit_accounts.schemas import (
    CreditAccountCreate, CreditAccountUpdate, CreditPayment, AuthorizeExcessRequest,
)


class CreditAuthorizationRequired(Exception):
    """Se levanta cuando una venta a credito excede el disponible o el cliente
    esta bloqueado por scoring — reemplaza el ValueError duro anterior (que
    no daba forma de que un supervisor autorice el excedente, como si hacia
    el legacy con LIMAUT). El router la traduce a un 409 con el detalle."""

    def __init__(self, details: dict):
        self.details = details
        super().__init__(details.get("motivo", "Requiere autorizacion de credito"))


async def create_credit_account(db: AsyncSession, data: CreditAccountCreate) -> CreditAccount:
    account = CreditAccount(
        company_id=data.company_id,
        customer_id=data.customer_id,
        limite_credito=data.limite_credito,
        saldo_disponible=data.limite_credito,
        saldo_utilizado=0,
        dias_plazo=data.dias_plazo,
    )
    db.add(account)
    await db.commit()
    await db.refresh(account)
    return account


async def list_credit_accounts(
    db: AsyncSession,
    company_id: str,
    activo: Optional[bool] = None,
    search: Optional[str] = None,
    limit: int = 100,
    offset: int = 0,
) -> list[dict]:
    cid = uuid.UUID(company_id)
    where_stmt = "WHERE ca.company_id = :cid"
    params = {"cid": cid, "limit": limit, "offset": offset}
    if activo is not None:
        where_stmt += " AND ca.activo = :activo"
        params["activo"] = activo
    if search:
        where_stmt += " AND (c.razon_social ILIKE :search OR c.ruc ILIKE :search OR c.nombre ILIKE :search)"
        params["search"] = f"%{search}%"

    query = text(f"""
        SELECT 
            ca.id, ca.company_id, ca.customer_id, c.razon_social as customer_name, c.ruc as customer_ruc,
            ca.limite_credito,
            COALESCE(ar.total_deuda, ca.saldo_utilizado, 0) as saldo_utilizado,
            GREATEST(0, ca.limite_credito - COALESCE(ar.total_deuda, ca.saldo_utilizado, 0)) as saldo_disponible,
            ca.dias_plazo, ca.activo, ca.created_at, ca.updated_at
        FROM credit_accounts ca
        LEFT JOIN customers c ON c.id = ca.customer_id
        LEFT JOIN (
            SELECT customer_id, SUM(saldo_pendiente) as total_deuda
            FROM accounts_receivable
            WHERE estado = 'pendiente'
            GROUP BY customer_id
        ) ar ON ar.customer_id = ca.customer_id
        {where_stmt}
        ORDER BY COALESCE(ar.total_deuda, ca.saldo_utilizado, 0) DESC, ca.limite_credito DESC
        LIMIT :limit OFFSET :offset
    """)

    res = await db.execute(query, params)
    rows = res.fetchall()
    return [dict(r._mapping) for r in rows]


async def get_credit_account(db: AsyncSession, account_id: str) -> CreditAccount | None:
    result = await db.execute(select(CreditAccount).where(CreditAccount.id == uuid.UUID(account_id)))
    return result.scalar_one_or_none()


async def get_credit_account_by_customer(db: AsyncSession, company_id: str, customer_id: str) -> CreditAccount | None:
    result = await db.execute(
        select(CreditAccount).where(
            CreditAccount.company_id == company_id,
            CreditAccount.customer_id == uuid.UUID(customer_id),
        )
    )
    return result.scalar_one_or_none()


async def update_credit_account(db: AsyncSession, account_id: str, data: CreditAccountUpdate) -> CreditAccount | None:
    account = await get_credit_account(db, account_id)
    if not account:
        return None
    update_data = data.model_dump(exclude_unset=True)
    if "limite_credito" in update_data:
        nuevo_limite = Decimal(str(update_data["limite_credito"]))
        diferencia = nuevo_limite - Decimal(str(account.limite_credito))
        account.saldo_disponible = Decimal(str(account.saldo_disponible)) + diferencia
        account.limite_credito = nuevo_limite
    if "dias_plazo" in update_data:
        account.dias_plazo = update_data["dias_plazo"]
    if "activo" in update_data:
        account.activo = update_data["activo"]
    await db.commit()
    await db.refresh(account)
    return account


async def process_purchase(
    db: AsyncSession, company_id: str, customer_id: str, monto: Decimal, sale_id: uuid.UUID,
    authorization_id: str | None = None,
) -> dict:
    account = await get_credit_account_by_customer(db, company_id, customer_id)
    if not account:
        return {"error": "No credit account for customer"}
    if not account.activo:
        return {"error": "Credit account inactive"}

    # Un supervisor ya autorizo este excedente antes de reintentar la venta
    # (ver authorize_excess) — el movimiento ya aplico el saldo, solo falta
    # linkearlo a la venta que finalmente se creo.
    if authorization_id:
        result = await db.execute(
            select(CreditMovement).where(CreditMovement.id == uuid.UUID(authorization_id))
        )
        auth_movement = result.scalar_one_or_none()
        if not auth_movement or auth_movement.tipo != "autorizacion_manual" or auth_movement.referencia_id is not None:
            return {"error": "Autorizacion de credito invalida o ya utilizada"}
        auth_movement.referencia_type = "sale"
        auth_movement.referencia_id = sale_id
        await db.flush()
        return {"success": True, "account": account, "dias_plazo": account.dias_plazo}

    # 1. Candado estricto de cheques rechazados pendientes de canje
    q_rej = await db.execute(
        text("SELECT COUNT(*), COALESCE(SUM(monto), 0) FROM checks WHERE company_id = :cid AND customer_id = :cust_id AND tipo = 'cheque' AND estado = 'rechazado'"),
        {"cid": uuid.UUID(company_id), "cust_id": uuid.UUID(customer_id)}
    )
    rej_row = q_rej.fetchone()
    rej_count = rej_row[0] if rej_row else 0
    rej_total = float(rej_row[1]) if rej_row else 0.0
    if rej_count > 0:
        return {
            "requiere_autorizacion": True,
            "motivo": f"Cliente bloqueado: posee {rej_count} cheque(s) rechazado(s) pendiente(s) por ₲ {rej_total:,.0f}".replace(",", "."),
            "credit_account_id": str(account.id),
            "disponible": float(account.saldo_disponible),
            "monto": float(monto),
            "cheques_rechazados_cant": rej_count,
            "cheques_rechazados_monto": rej_total,
        }

    # 2. Score de riesgo crediticio
    from api.src.credit_scoring.service import get_credit_score
    score = await get_credit_score(db, company_id, customer_id)
    if score and score.get("is_auto_blocked"):
        return {
            "requiere_autorizacion": True,
            "motivo": score.get("block_reason") or "Cliente bloqueado por evaluacion de riesgo",
            "credit_account_id": str(account.id),
            "disponible": float(account.saldo_disponible),
            "monto": float(monto),
        }

    if Decimal(str(account.saldo_disponible)) < monto:
        return {
            "requiere_autorizacion": True,
            "motivo": "Excede el limite de credito disponible",
            "credit_account_id": str(account.id),
            "disponible": float(account.saldo_disponible),
            "monto": float(monto),
            "faltante": float(monto - Decimal(str(account.saldo_disponible))),
        }

    saldo_anterior = Decimal(str(account.saldo_utilizado))
    account.saldo_utilizado += monto
    account.saldo_disponible -= monto

    movement = CreditMovement(
        company_id=company_id,
        credit_account_id=account.id,
        customer_id=uuid.UUID(customer_id),
        tipo="compra",
        monto=monto,
        saldo_anterior=saldo_anterior,
        saldo_nuevo=account.saldo_utilizado,
        referencia_type="sale",
        referencia_id=sale_id,
    )
    db.add(movement)
    # No commitea aca — process_purchase corre en medio de sales.service.create_sale,
    # que hace un unico commit al final. Un commit intermedio aca dejaba la venta
    # guardada a mitad de armar (sin el descuento de stock, que pasa despues).
    await db.flush()
    await db.refresh(account)
    return {"success": True, "account": account, "dias_plazo": account.dias_plazo}


async def authorize_excess(
    db: AsyncSession, company_id: str, account_id: str, data: AuthorizeExcessRequest, user_id: str,
) -> dict | None:
    account = await get_credit_account(db, account_id)
    if not account:
        return None

    monto = Decimal(str(data.monto))
    saldo_anterior = Decimal(str(account.saldo_utilizado))
    account.saldo_utilizado += monto
    account.saldo_disponible -= monto  # puede quedar negativo — es una excepcion explicita al limite

    movement = CreditMovement(
        company_id=company_id,
        credit_account_id=account.id,
        customer_id=account.customer_id,
        tipo="autorizacion_manual",
        monto=monto,
        saldo_anterior=saldo_anterior,
        saldo_nuevo=account.saldo_utilizado,
        referencia_type=None,
        referencia_id=None,
        observaciones=f"Autorizado por usuario {user_id}: {data.motivo}",
    )
    db.add(movement)
    await db.commit()
    await db.refresh(movement)
    return {
        "authorization_id": movement.id,
        "credit_account_id": account.id,
        "monto": float(monto),
        "autorizado_por": user_id,
    }


async def process_payment(db: AsyncSession, company_id: str, customer_id: str, data: CreditPayment) -> dict:
    account = await get_credit_account_by_customer(db, company_id, customer_id)
    if not account:
        return {"error": "No credit account for customer"}

    monto = Decimal(str(data.monto))
    saldo_anterior = Decimal(str(account.saldo_utilizado))
    pago_aplicado = min(monto, saldo_anterior)

    account.saldo_utilizado -= pago_aplicado
    account.saldo_disponible += pago_aplicado

    movement = CreditMovement(
        company_id=company_id,
        credit_account_id=account.id,
        customer_id=uuid.UUID(customer_id),
        tipo="pago",
        monto=pago_aplicado,
        saldo_anterior=saldo_anterior,
        saldo_nuevo=account.saldo_utilizado,
        referencia_type="payment",
        observaciones=data.observaciones,
    )
    db.add(movement)
    await db.commit()
    await db.refresh(account)
    return {"success": True, "account": account, "pago_aplicado": float(pago_aplicado)}


async def get_movements(db: AsyncSession, account_id: str, limit: int = 50, offset: int = 0) -> list[CreditMovement]:
    query = select(CreditMovement).where(CreditMovement.credit_account_id == uuid.UUID(account_id))
    query = query.order_by(CreditMovement.created_at.desc()).limit(limit).offset(offset)
    result = await db.execute(query)
    return list(result.scalars().all())
