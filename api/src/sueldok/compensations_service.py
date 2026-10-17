"""SueldOK Payroll Non-Cash Deductions & Compensations Service

Processes internal offsets (Extra Club credit purchases, uniform costs)
via official internal collection receipts ('RETENCION_NOMINA') without
touching physical cash drawers (pos_sessions) or bank balances.
"""

from datetime import datetime, timezone, date
from decimal import Decimal
from typing import Optional, List, Dict, Any
import re
import uuid

from sqlalchemy import select, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from api.src.accounts_receivable.models import Account, ReceivablePayment, ReceivablePaymentAllocation
from api.src.customers.models import Customer
from api.src.sueldok.models import PayrollDossier, PayrollDossierPhase


def _clean_ci(ci: str) -> str:
    """Strip spaces, dots, dashes from CI for robust matching."""
    return re.sub(r"[^\w]", "", ci or "").strip()


async def process_payroll_compensations(
    db: AsyncSession,
    company_id: str,
    dossier_id: str,
    user_id: Optional[str] = None
) -> Dict[str, Any]:
    """
    Executes the 'compensacion_no_cash' phase of a PayrollDossier.
    Generates RC-NOMINA receipts for Extra Club and uniform debts,
    lowering accounts receivable balances without creating bank transactions
    or altering cash drawer sessions.
    """
    cid = uuid.UUID(company_id)
    did = uuid.UUID(dossier_id)
    uid = uuid.UUID(user_id) if user_id else None

    # 1. Fetch dossier and its compensacion_no_cash phase
    query = (
        select(PayrollDossier)
        .options(selectinload(PayrollDossier.phases))
        .where(PayrollDossier.company_id == cid, PayrollDossier.id == did)
    )
    res = await db.execute(query)
    dossier = res.scalars().first()
    if not dossier:
        raise ValueError(f"Dossier {dossier_id} not found")

    phase = next((p for p in dossier.phases if p.phase_type == "compensacion_no_cash"), None)
    if not phase:
        raise ValueError(f"No compensacion_no_cash phase found in dossier {dossier_id}")

    if phase.estado == "ejecutado":
        return {
            "status": "already_executed",
            "message": "Fase de compensaciones ya fue ejecutada previamente.",
            "phase_id": str(phase.id),
        }

    metadata = phase.phase_metadata or {}
    extra_club_items = metadata.get("extra_club", [])
    uniformes_items = metadata.get("uniformes", [])

    all_items = []
    for item in extra_club_items:
        all_items.append({**item, "tipo_concepto": "EXTRA_CLUB"})
    for item in uniformes_items:
        all_items.append({**item, "tipo_concepto": "UNIFORME"})

    receipts_generated = []
    total_offset_amount = Decimal("0")

    for item in all_items:
        raw_ci = str(item.get("employee_ci") or item.get("ci") or "")
        clean_doc = _clean_ci(raw_ci)
        emp_name = item.get("employee_name") or item.get("name") or "Funcionario"
        amount = Decimal(str(int(item.get("amount", 0))))
        ticket_ref = item.get("ticket_ref") or "S/REF"
        concepto = item.get("tipo_concepto", "COMPENSACION")

        if amount <= 0:
            continue

        # 2. Find customer matching CI or extra_club_numero
        cust_query = select(Customer).where(
            Customer.company_id == cid,
            or_(
                Customer.ci == clean_doc,
                Customer.ci == raw_ci,
                Customer.extra_club_numero == clean_doc,
                Customer.ruc.ilike(f"%{clean_doc}%")
            )
        )
        cust_res = await db.execute(cust_query)
        customer = cust_res.scalars().first()

        if not customer:
            # Create internal employee customer profile for accounting balance
            customer = Customer(
                company_id=cid,
                razon_social=emp_name,
                ci=clean_doc,
                extra_club_numero=clean_doc,
                tipo_persona="fisica",
                tipo="funcionario",
                credito_usado=0,
                activo=True
            )
            db.add(customer)
            await db.flush()

        # 3. Create ReceivablePayment (Official internal receipt)
        clean_periodo = dossier.periodo.replace("-", "")
        receipt_num = f"RC-NOMINA-{clean_periodo}-{clean_doc}"

        rec_payment = ReceivablePayment(
            company_id=cid,
            customer_id=customer.id,
            monto_total=amount,
            moneda="PYG",
            forma_pago="RETENCION_NOMINA",
            referencia=f"Neteo Nómina {dossier.periodo} - Ref: {ticket_ref}",
            fecha=date.today(),
            destino_fondos="compensacion_interna",
            numero_recibo=receipt_num,
            observaciones=f"Compensación interna nómina {dossier.periodo} por {concepto}. Funcionario: {emp_name} (CI: {raw_ci})",
            registrado_por=uid
        )
        db.add(rec_payment)
        await db.flush()

        # 4. Search open pending accounts to decrement balance
        ar_query = select(Account).where(
            Account.company_id == cid,
            Account.customer_id == customer.id,
            Account.estado == "pendiente"
        ).order_by(Account.fecha_vencimiento.asc(), Account.created_at.asc())
        ar_res = await db.execute(ar_query)
        open_accounts = ar_res.scalars().all()

        rem_to_apply = amount
        for acc in open_accounts:
            if rem_to_apply <= 0:
                break
            current_saldo = acc.saldo_pendiente or 0
            if current_saldo <= 0:
                continue

            alloc_amt = min(current_saldo, rem_to_apply)
            acc.saldo_pendiente = current_saldo - alloc_amt
            if acc.saldo_pendiente <= 0:
                acc.estado = "pagado"
                acc.saldo_pendiente = 0

            # Record allocation
            alloc = ReceivablePaymentAllocation(
                receivable_payment_id=rec_payment.id,
                accounts_receivable_id=acc.id,
                monto=alloc_amt
            )
            db.add(alloc)
            rem_to_apply -= alloc_amt

        # Update customer credit used
        if customer.credito_usado and customer.credito_usado > 0:
            customer.credito_usado = max(Decimal("0"), customer.credito_usado - amount)

        total_offset_amount += amount
        receipts_generated.append({
            "receipt_id": str(rec_payment.id),
            "numero_recibo": receipt_num,
            "customer_id": str(customer.id),
            "employee_name": emp_name,
            "ci": raw_ci,
            "monto": float(amount),
            "concepto": concepto,
            "ticket_ref": ticket_ref
        })

    # 5. Mark phase as executed
    phase.estado = "ejecutado"
    phase.executed_at = datetime.now(timezone.utc)
    phase.executed_by = uid
    if receipts_generated:
        phase.collection_receipt_id = uuid.UUID(receipts_generated[0]["receipt_id"])

    await db.commit()

    return {
        "status": "success",
        "phase_id": str(phase.id),
        "total_compensado": float(total_offset_amount),
        "recibos_count": len(receipts_generated),
        "recibos": receipts_generated,
        "dossier_id": str(dossier.id),
        "periodo": dossier.periodo
    }


async def process_settlement_compensation(
    db: AsyncSession,
    company_id: str,
    employee_nombre: str,
    employee_ci: str | None,
    monto_extra_club: Decimal,
    referencia: str = "Finiquito Laboral",
    user_id: Optional[str] = None
) -> Optional[ReceivablePayment]:
    """
    Extingue formalmente las Cuentas por Cobrar (vales/compras Extra Club)
    de un colaborador desvinculado mediante un Recibo Oficial de Cobranza Interno.
    """
    if monto_extra_club <= Decimal("0"):
        return None

    cid = uuid.UUID(company_id)
    uid = uuid.UUID(user_id) if user_id else None
    raw_ci = str(employee_ci or "")
    clean_doc = _clean_ci(raw_ci)

    # 1. Buscar o crear cliente del empleado
    cust_query = select(Customer).where(
        Customer.company_id == cid,
        or_(
            Customer.ci == clean_doc,
            Customer.ci == raw_ci,
            Customer.extra_club_numero == clean_doc,
            Customer.ruc.ilike(f"%{clean_doc}%")
        )
    )
    cust_res = await db.execute(cust_query)
    customer = cust_res.scalars().first()

    if not customer:
        customer = Customer(
            company_id=cid,
            razon_social=employee_nombre,
            ci=clean_doc or "S/CI",
            extra_club_numero=clean_doc or None,
            tipo_persona="fisica",
            tipo="funcionario",
            credito_usado=0,
            activo=True
        )
        db.add(customer)
        await db.flush()

    # 2. Emitir Recibo Oficial de Cobranza Interno
    clean_fecha = date.today().strftime("%Y%m%d")
    receipt_num = f"RC-FINIQUITO-{clean_fecha}-{clean_doc or 'COL'}"

    rec_payment = ReceivablePayment(
        company_id=cid,
        customer_id=customer.id,
        monto_total=monto_extra_club,
        moneda="PYG",
        forma_pago="RETENCION_NOMINA",
        referencia=f"Compensación Finiquito - {referencia}",
        fecha=date.today(),
        destino_fondos="compensacion_interna",
        numero_recibo=receipt_num,
        observaciones=f"Compensación y extinción formal de deudas comerciales por finiquito laboral. Colaborador: {employee_nombre} (CI: {raw_ci})",
        registrado_por=uid
    )
    db.add(rec_payment)
    await db.flush()

    # 3. Amortizar Cuentas por Cobrar abiertas (vales / créditos impagos)
    ar_query = select(Account).where(
        Account.company_id == cid,
        Account.customer_id == customer.id,
        Account.estado == "pendiente"
    ).order_by(Account.fecha_vencimiento.asc(), Account.created_at.asc())
    ar_res = await db.execute(ar_query)
    open_accounts = ar_res.scalars().all()

    rem_to_apply = monto_extra_club
    for acc in open_accounts:
        if rem_to_apply <= 0:
            break
        current_saldo = acc.saldo_pendiente or 0
        if current_saldo <= 0:
            continue

        alloc_amt = min(current_saldo, rem_to_apply)
        acc.saldo_pendiente = current_saldo - alloc_amt
        if acc.saldo_pendiente <= 0:
            acc.estado = "pagado"
            acc.saldo_pendiente = 0

        alloc = ReceivablePaymentAllocation(
            receivable_payment_id=rec_payment.id,
            accounts_receivable_id=acc.id,
            monto=alloc_amt
        )
        db.add(alloc)
        rem_to_apply -= alloc_amt

    # Actualizar crédito usado del cliente
    if customer.credito_usado and customer.credito_usado > 0:
        customer.credito_usado = max(Decimal("0"), customer.credito_usado - monto_extra_club)

    await db.flush()
    return rec_payment
