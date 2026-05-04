"""Payments service"""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime, timezone, date
from decimal import Decimal
import uuid

from api.src.payments.models import (
    PaymentMethod, Payment, PaymentAllocation,
    CustomerWallet, WalletTransaction,
    CustomerAccount, AccountMovement,
    Financing, FinancingInstallment,
)
from api.src.payments.schemas import (
    PaymentMethodCreate, PaymentCreate,
)
from api.src.sales.models import Sale


async def create_payment_method(db: AsyncSession, data: PaymentMethodCreate) -> PaymentMethod:
    method = PaymentMethod(**data.model_dump())
    db.add(method)
    await db.flush()
    await db.refresh(method)
    return method


async def list_payment_methods(db: AsyncSession, company_id: str) -> list[PaymentMethod]:
    result = await db.execute(
        select(PaymentMethod).where(PaymentMethod.company_id == company_id, PaymentMethod.activo == True)
    )
    return list(result.scalars().all())


async def create_payment(db: AsyncSession, data: PaymentCreate) -> Payment:
    monto_pyg = None
    if data.moneda != "PYG":
        monto_pyg = (data.monto * data.tipo_cambio).quantize(Decimal("1"), rounding="ROUND_HALF_UP")

    payment = Payment(
        company_id=data.company_id,
        tipo=data.tipo,
        payment_method_id=data.payment_method_id,
        moneda=data.moneda,
        tipo_cambio=data.tipo_cambio,
        monto=data.monto,
        monto_pyg=monto_pyg,
        referencia=data.referencia,
        observaciones=data.observaciones,
        user_id=data.user_id,
    )
    db.add(payment)
    await db.flush()

    if data.allocations:
        for alloc in data.allocations:
            allocation = PaymentAllocation(
                payment_id=payment.id,
                sale_id=alloc.sale_id,
                monto_asignado=alloc.monto_asignado,
            )
            db.add(allocation)

            sale_result = await db.execute(select(Sale).where(Sale.id == alloc.sale_id))
            sale = sale_result.scalar_one_or_none()
            if sale:
                sale.total_pagado = (sale.total_pagado or 0) + alloc.monto_asignado
                sale.saldo = sale.total - sale.total_pagado
                if sale.saldo <= 0:
                    sale.estado = "completado"

    await db.flush()
    await db.refresh(payment)
    return payment


async def get_wallet(db: AsyncSession, company_id: str, customer_id: str, moneda: str = "PYG") -> CustomerWallet | None:
    result = await db.execute(
        select(CustomerWallet).where(
            CustomerWallet.company_id == company_id,
            CustomerWallet.customer_id == customer_id,
            CustomerWallet.moneda == moneda,
        )
    )
    return result.scalar_one_or_none()


async def create_wallet(db: AsyncSession, company_id: str, customer_id: str, moneda: str = "PYG") -> CustomerWallet:
    wallet = CustomerWallet(company_id=company_id, customer_id=customer_id, moneda=moneda, saldo=Decimal("0"))
    db.add(wallet)
    await db.flush()
    await db.refresh(wallet)
    return wallet


async def add_wallet_credit(db: AsyncSession, wallet_id: uuid.UUID, monto: Decimal, motivo: str, referencia_id: uuid.UUID | None = None) -> CustomerWallet:
    wallet_result = await db.execute(select(CustomerWallet).where(CustomerWallet.id == wallet_id))
    wallet = wallet_result.scalar_one()
    wallet.saldo += monto
    wallet.updated_at = datetime.now(timezone.utc)

    txn = WalletTransaction(
        wallet_id=wallet_id,
        tipo="credito",
        monto=monto,
        motivo=motivo,
        referencia_id=referencia_id,
    )
    db.add(txn)
    await db.flush()
    await db.refresh(wallet)
    return wallet


async def use_wallet_for_payment(db: AsyncSession, wallet_id: uuid.UUID, monto: Decimal, sale_id: uuid.UUID) -> CustomerWallet:
    wallet_result = await db.execute(select(CustomerWallet).where(CustomerWallet.id == wallet_id))
    wallet = wallet_result.scalar_one()
    if wallet.saldo < monto:
        raise ValueError("Saldo insuficiente en wallet")

    wallet.saldo -= monto
    wallet.updated_at = datetime.now(timezone.utc)

    txn = WalletTransaction(
        wallet_id=wallet_id,
        tipo="debito",
        monto=monto,
        motivo=f"Pago venta {sale_id}",
        referencia_type="sale",
        referencia_id=sale_id,
    )
    db.add(txn)

    sale_result = await db.execute(select(Sale).where(Sale.id == sale_id))
    sale = sale_result.scalar_one()
    sale.total_pagado = (sale.total_pagado or 0) + monto
    sale.saldo = sale.total - sale.total_pagado
    if sale.saldo <= 0:
        sale.estado = "completado"

    await db.flush()
    await db.refresh(wallet)
    return wallet


async def get_account(db: AsyncSession, customer_id: str) -> CustomerAccount | None:
    result = await db.execute(select(CustomerAccount).where(CustomerAccount.customer_id == uuid.UUID(customer_id)))
    return result.scalar_one_or_none()


async def create_account(db: AsyncSession, customer_id: uuid.UUID, limite_credito: Decimal, dias_plazo: int = 30, moneda: str = "PYG") -> CustomerAccount:
    account = CustomerAccount(
        customer_id=customer_id,
        moneda=moneda,
        limite_credito=limite_credito,
        dias_plazo=dias_plazo,
        saldo_actual=Decimal("0"),
    )
    db.add(account)
    await db.flush()
    await db.refresh(account)
    return account


async def create_financing(
    db: AsyncSession,
    company_id: uuid.UUID,
    customer_id: uuid.UUID,
    sale_id: uuid.UUID,
    monto_financiado: Decimal,
    cantidad_cuotas: int,
    tasa_interes_mensual: Decimal | None = None,
    fecha_primera_cuota: date | None = None,
) -> Financing:
    monto_cuota = monto_financiado / cantidad_cuotas
    if tasa_interes_mensual and tasa_interes_mensual > 0:
        r = tasa_interes_mensual / Decimal("100")
        if r > 0:
            monto_cuota = monto_financiado * (r * (1 + r) ** cantidad_cuotas) / ((1 + r) ** cantidad_cuotas - 1)
        monto_cuota = monto_cuota.quantize(Decimal("1"), rounding="ROUND_HALF_UP")

    if not fecha_primera_cuota:
        now = datetime.now(timezone.utc)
        fecha_primera_cuota = date(now.year, now.month + 1, 1)

    financing = Financing(
        company_id=company_id,
        customer_id=customer_id,
        sale_id=sale_id,
        monto_financiado=monto_financiado,
        tasa_interes_mensual=tasa_interes_mensual,
        cantidad_cuotas=cantidad_cuotas,
        monto_cuota=monto_cuota,
        fecha_primera_cuota=fecha_primera_cuota,
    )
    db.add(financing)
    await db.flush()

    current_date = fecha_primera_cuota
    for i in range(1, cantidad_cuotas + 1):
        installment = FinancingInstallment(
            financing_id=financing.id,
            numero_cuota=i,
            fecha_vencimiento=current_date,
            monto=monto_cuota,
        )
        db.add(installment)
        month = current_date.month + 1
        year = current_date.year
        if month > 12:
            month = 1
            year += 1
        day = min(current_date.day, 28)
        current_date = date(year, month, day)

    await db.flush()
    await db.refresh(financing)
    return financing


async def pay_installment(db: AsyncSession, installment_id: str, payment_id: uuid.UUID) -> FinancingInstallment | None:
    result = await db.execute(select(FinancingInstallment).where(FinancingInstallment.id == uuid.UUID(installment_id)))
    installment = result.scalar_one_or_none()
    if not installment or installment.estado == "pagado":
        return None

    installment.estado = "pagado"
    installment.monto_pagado = installment.monto
    installment.fecha_pago = datetime.now(timezone.utc)
    installment.payment_id = payment_id

    await db.flush()
    await db.refresh(installment)
    return installment
