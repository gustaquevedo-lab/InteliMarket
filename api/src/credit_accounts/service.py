"""Credit account service"""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
from decimal import Decimal
import uuid

from api.src.credit_accounts.models import CreditAccount, CreditMovement
from api.src.credit_accounts.schemas import CreditAccountCreate, CreditAccountUpdate, CreditPayment


async def create_credit_account(db: AsyncSession, data: CreditAccountCreate) -> CreditAccount:
    account = CreditAccount(
        company_id=data.company_id,
        customer_id=data.customer_id,
        limite_credito=data.limite_credito,
        saldo_disponible=data.limite_credito,
        saldo_utilizado=0,
    )
    db.add(account)
    await db.commit()
    await db.refresh(account)
    return account


async def list_credit_accounts(db: AsyncSession, company_id: str, activo: Optional[bool] = None) -> list[CreditAccount]:
    query = select(CreditAccount).where(CreditAccount.company_id == company_id)
    if activo is not None:
        query = query.where(CreditAccount.activo == activo)
    query = query.order_by(CreditAccount.saldo_utilizado.desc())
    result = await db.execute(query)
    return list(result.scalars().all())


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
    if "activo" in update_data:
        account.activo = update_data["activo"]
    await db.commit()
    await db.refresh(account)
    return account


async def process_purchase(db: AsyncSession, company_id: str, customer_id: str, monto: Decimal, sale_id: uuid.UUID) -> dict:
    account = await get_credit_account_by_customer(db, company_id, customer_id)
    if not account:
        return {"error": "No credit account for customer"}
    if not account.activo:
        return {"error": "Credit account inactive"}
    if Decimal(str(account.saldo_disponible)) < monto:
        return {"error": "Insufficient credit", "disponible": float(account.saldo_disponible), "monto": float(monto)}

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
    await db.commit()
    await db.refresh(account)
    return {"success": True, "account": account}


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
