"""Financial service — AP, banking, cash flow, budgets, payment runs, dashboards"""

from sqlalchemy import select, func, and_, or_, text
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime, timezone, date, timedelta
from decimal import Decimal
import uuid

from api.src.financial.models import (
    SupplierInvoice, SupplierInvoicePayment,
    BankAccount, BankTransaction,
    CashFlowProjection, Budget,
    PaymentRun, PaymentRunItem,
)
from api.src.financial.schemas import (
    SupplierInvoiceCreate, SupplierInvoicePaymentCreate,
    BankAccountCreate, BankAccountUpdate,
    CashFlowProjectionUpdate,
    BudgetCreate, BudgetUpdate,
    PaymentRunCreate,
)
from api.src.purchases.models import Supplier


# ── Helpers ───────────────────────────────────────────────────────────────────

def _now():
    return datetime.now(timezone.utc)


def _today():
    return date.today()


# ── AP: Supplier Invoices ──────────────────────────────────────────────────────

async def create_invoice(db: AsyncSession, data: SupplierInvoiceCreate, user_id: str | None = None) -> SupplierInvoice:
    invoice = SupplierInvoice(
        company_id=data.company_id,
        supplier_id=data.supplier_id,
        numero_factura=data.numero_factura,
        timbrado=data.timbrado,
        cdc=data.cdc,
        fecha_emision=data.fecha_emision,
        fecha_recepcion=data.fecha_recepcion or _today(),
        fecha_vencimiento=data.fecha_vencimiento,
        subtotal=data.subtotal,
        descuento=data.descuento,
        iva_10=data.iva_10,
        iva_5=data.iva_5,
        total=data.total,
        saldo_pendiente=data.total,
        moneda=data.moneda,
        tipo_cambio=data.tipo_cambio,
        purchase_order_id=data.purchase_order_id,
        receipt_id=data.receipt_id,
        condicion=data.condicion,
        tipo_comprobante=data.tipo_comprobante,
        estado="pendiente",
        concepto=data.concepto,
        notas=data.notas,
        created_by=uuid.UUID(user_id) if user_id else None,
    )
    db.add(invoice)
    await db.flush()
    await db.refresh(invoice)
    return invoice


async def list_invoices(
    db: AsyncSession, company_id: str,
    estado: str | None = None, supplier_id: str | None = None,
    vencidas: bool | None = None,
    desde: date | None = None, hasta: date | None = None,
    limit: int = 50, offset: int = 0,
) -> list[SupplierInvoice]:
    query = select(SupplierInvoice).where(SupplierInvoice.company_id == uuid.UUID(company_id))
    if estado:
        query = query.where(SupplierInvoice.estado == estado)
    if supplier_id:
        query = query.where(SupplierInvoice.supplier_id == uuid.UUID(supplier_id))
    if vencidas:
        query = query.where(
            SupplierInvoice.fecha_vencimiento < _today(),
            SupplierInvoice.estado.in_(["pendiente", "aprobada", "parcial"]),
        )
    if desde:
        query = query.where(SupplierInvoice.fecha_emision >= desde)
    if hasta:
        query = query.where(SupplierInvoice.fecha_emision <= hasta)
    query = query.order_by(SupplierInvoice.fecha_vencimiento.asc()).offset(offset).limit(limit)
    result = await db.execute(query)
    return list(result.scalars().all())


async def get_invoice(db: AsyncSession, invoice_id: str) -> SupplierInvoice | None:
    result = await db.execute(select(SupplierInvoice).where(SupplierInvoice.id == uuid.UUID(invoice_id)))
    return result.scalar_one_or_none()


async def get_invoice_with_payments(db: AsyncSession, invoice_id: str) -> SupplierInvoice | None:
    # Asignar invoice.payments = [...] a mano (como estaba antes) dispara un
    # lazy-load de la coleccion ANTERIOR para trackear el cambio — en un
    # AsyncSession eso revienta con "greenlet_spawn has not been called".
    # Nunca se noto porque supplier_invoice_payments estuvo vacia hasta
    # ahora (el reemplazo por una lista vacia no disparaba el mismo path).
    # selectinload trae la relacion en la misma query, sin este problema.
    result = await db.execute(
        select(SupplierInvoice)
        .options(selectinload(SupplierInvoice.payments))
        .where(SupplierInvoice.id == uuid.UUID(invoice_id))
    )
    return result.scalar_one_or_none()


async def approve_invoice(db: AsyncSession, invoice_id: str, user_id: str | None = None) -> SupplierInvoice | None:
    invoice = await get_invoice(db, invoice_id)
    if not invoice:
        return None
    if invoice.estado not in ("pendiente",):
        return None
    invoice.estado = "aprobada"
    invoice.approved_by = uuid.UUID(user_id) if user_id else None
    await db.flush()
    await db.refresh(invoice)
    return invoice


async def register_payment(db: AsyncSession, invoice_id: str, data: SupplierInvoicePaymentCreate) -> tuple[SupplierInvoicePayment, SupplierInvoice] | None:
    invoice = await get_invoice(db, invoice_id)
    if not invoice:
        return None
    if invoice.estado in ("pagada", "cancelada"):
        return None

    monto = data.monto
    if monto > invoice.saldo_pendiente:
        monto = invoice.saldo_pendiente

    payment = SupplierInvoicePayment(
        invoice_id=uuid.UUID(invoice_id),
        payment_method=data.payment_method,
        monto=monto,
        moneda=data.moneda,
        fecha_pago=data.fecha_pago or _today(),
        referencia=data.referencia,
        comprobante_url=data.comprobante_url,
        bank_account_id=data.bank_account_id,
        estado="conciliado",
    )
    db.add(payment)

    invoice.saldo_pendiente -= monto
    if invoice.saldo_pendiente <= 0:
        invoice.saldo_pendiente = Decimal("0")
        invoice.estado = "pagada"
    else:
        invoice.estado = "parcial"

    if data.bank_account_id:
        bt = BankTransaction(
            company_id=invoice.company_id,
            bank_account_id=data.bank_account_id,
            fecha=data.fecha_pago or _today(),
            tipo="debito",
            monto=monto,
            moneda=data.moneda,
            descripcion=f"Pago factura {invoice.numero_factura}",
            referencia=data.referencia,
            contraparte=None,
            conciliado=True,
            fecha_conciliacion=_now(),
            invoice_id=uuid.UUID(invoice_id),
            categoria="proveedores",
        )
        db.add(bt)
        account_result = await db.execute(select(BankAccount).where(BankAccount.id == data.bank_account_id))
        account = account_result.scalar_one_or_none()
        if account:
            account.saldo_actual -= monto

    await db.flush()
    await db.refresh(payment)
    await db.refresh(invoice)
    return payment, invoice


async def get_ap_aging(db: AsyncSession, company_id: str) -> dict:
    cid = uuid.UUID(company_id)
    today = _today()

    query = select(SupplierInvoice).where(
        SupplierInvoice.company_id == cid,
        SupplierInvoice.estado.in_(["pendiente", "aprobada", "parcial"]),
    )
    result = await db.execute(query)
    invoices = list(result.scalars().all())

    aging = {"30": Decimal("0"), "60": Decimal("0"), "90": Decimal("0"), "90_plus": Decimal("0")}
    by_supplier: dict[str, dict] = {}
    total_vencido = Decimal("0")
    total_por_vencer = Decimal("0")

    for inv in invoices:
        saldo = inv.saldo_pendiente or Decimal("0")
        if inv.fecha_vencimiento < today:
            diff = (today - inv.fecha_vencimiento).days
            total_vencido += saldo
            if diff <= 30:
                aging["30"] += saldo
            elif diff <= 60:
                aging["60"] += saldo
            elif diff <= 90:
                aging["90"] += saldo
            else:
                aging["90_plus"] += saldo
        else:
            total_por_vencer += saldo

        sid = str(inv.supplier_id)
        if sid not in by_supplier:
            by_supplier[sid] = {"total_pendiente": Decimal("0"), "vencido": Decimal("0"), "por_vencer": Decimal("0")}
        by_supplier[sid]["total_pendiente"] += saldo
        if inv.fecha_vencimiento < today:
            by_supplier[sid]["vencido"] += saldo
        else:
            by_supplier[sid]["por_vencer"] += saldo

    supplier_ids = list(by_supplier.keys())
    suppliers = []
    if supplier_ids:
        sup_result = await db.execute(
            select(Supplier).where(Supplier.id.in_([uuid.UUID(s) for s in supplier_ids]))
        )
        sup_map = {str(s.id): s.razon_social for s in sup_result.scalars().all()}
        for sid, data in by_supplier.items():
            suppliers.append({
                "supplier_id": sid,
                "razon_social": sup_map.get(sid, "Desconocido"),
                **data,
            })

    return {
        "aging_buckets": [
            {"rango": "1-30 días", "monto": aging["30"], "facturas": sum(1 for i in invoices if i.fecha_vencimiento < today and (today - i.fecha_vencimiento).days <= 30)},
            {"rango": "31-60 días", "monto": aging["60"], "facturas": sum(1 for i in invoices if i.fecha_vencimiento < today and 31 <= (today - i.fecha_vencimiento).days <= 60)},
            {"rango": "61-90 días", "monto": aging["90"], "facturas": sum(1 for i in invoices if i.fecha_vencimiento < today and 61 <= (today - i.fecha_vencimiento).days <= 90)},
            {"rango": "+90 días", "monto": aging["90_plus"], "facturas": sum(1 for i in invoices if i.fecha_vencimiento < today and (today - i.fecha_vencimiento).days > 90)},
        ],
        "por_supplier": suppliers,
        "total_pendiente": sum(i.saldo_pendiente or Decimal("0") for i in invoices),
        "total_vencido": total_vencido,
        "total_por_vencer": total_por_vencer,
    }


async def get_ap_dashboard(db: AsyncSession, company_id: str) -> dict:
    cid = uuid.UUID(company_id)
    today = _today()

    query = select(SupplierInvoice).where(SupplierInvoice.company_id == cid)
    result = await db.execute(query)
    invoices = list(result.scalars().all())

    pendientes = [i for i in invoices if i.estado in ("pendiente", "aprobada", "parcial")]
    vencidas = [i for i in pendientes if i.fecha_vencimiento < today]
    por_vencer = [i for i in pendientes if i.fecha_vencimiento >= today]

    total_pendiente = sum(i.saldo_pendiente or Decimal("0") for i in pendientes)
    total_vencido = sum(i.saldo_pendiente or Decimal("0") for i in vencidas)
    total_por_vencer = sum(i.saldo_pendiente or Decimal("0") for i in por_vencer)

    supplier_ids = set(str(i.supplier_id) for i in pendientes)

    aging_30 = Decimal("0")
    aging_60 = Decimal("0")
    aging_90 = Decimal("0")
    aging_90_plus = Decimal("0")
    for i in vencidas:
        diff = (today - i.fecha_vencimiento).days
        s = i.saldo_pendiente or Decimal("0")
        if diff <= 30:
            aging_30 += s
        elif diff <= 60:
            aging_60 += s
        elif diff <= 90:
            aging_90 += s
        else:
            aging_90_plus += s

    return {
        "total_pendiente": total_pendiente,
        "total_vencido": total_vencido,
        "total_por_vencer": total_por_vencer,
        "facturas_pendientes": len(pendientes),
        "facturas_vencidas": len(vencidas),
        "proveedores_con_deuda": len(supplier_ids),
        "aging_30": aging_30,
        "aging_60": aging_60,
        "aging_90": aging_90,
        "aging_90_plus": aging_90_plus,
    }


async def auto_create_invoice_from_receipt(db: AsyncSession, receipt_id: str) -> SupplierInvoice | None:
    from api.src.purchases.models import PurchaseReceipt, PurchaseReceiptItem, PurchaseOrder
    result = await db.execute(
        select(PurchaseReceipt).where(PurchaseReceipt.id == uuid.UUID(receipt_id))
    )
    receipt = result.scalar_one_or_none()
    if not receipt:
        return None

    po_result = await db.execute(
        select(PurchaseOrder).where(PurchaseOrder.id == receipt.purchase_order_id)
    )
    po = po_result.scalar_one_or_none()
    if not po:
        return None

    items_result = await db.execute(
        select(PurchaseReceiptItem).where(PurchaseReceiptItem.receipt_id == uuid.UUID(receipt_id))
    )
    items = list(items_result.scalars().all())
    total = sum((i.cantidad_recibida * i.costo_unitario) for i in items) if items else po.total or Decimal("0")

    invoice = SupplierInvoice(
        company_id=po.company_id,
        supplier_id=po.supplier_id,
        numero_factura=f"AUTO-{receipt.numero}",
        fecha_emision=_today(),
        fecha_vencimiento=_today() + timedelta(days=30),
        total=total,
        saldo_pendiente=total,
        moneda=po.moneda,
        tipo_cambio=po.tipo_cambio,
        purchase_order_id=po.id,
        receipt_id=receipt.id,
        condicion="credito",
        estado="pendiente",
        concepto="Auto-generada desde recepción",
    )
    db.add(invoice)
    await db.flush()
    await db.refresh(invoice)
    return invoice


# ── Banking ────────────────────────────────────────────────────────────────────

async def create_bank_account(db: AsyncSession, data: BankAccountCreate) -> BankAccount:
    account = BankAccount(
        company_id=data.company_id,
        banco=data.banco,
        tipo=data.tipo,
        numero_cuenta=data.numero_cuenta,
        moneda=data.moneda,
        saldo_inicial=data.saldo_inicial,
        saldo_actual=data.saldo_inicial,
        titular=data.titular,
        activo=True,
    )
    db.add(account)
    await db.flush()
    await db.refresh(account)
    return account


async def list_bank_accounts(db: AsyncSession, company_id: str) -> list[BankAccount]:
    result = await db.execute(
        select(BankAccount).where(
            BankAccount.company_id == uuid.UUID(company_id)
        ).order_by(BankAccount.banco)
    )
    return list(result.scalars().all())


async def get_bank_account(db: AsyncSession, account_id: str) -> BankAccount | None:
    result = await db.execute(select(BankAccount).where(BankAccount.id == uuid.UUID(account_id)))
    return result.scalar_one_or_none()


async def update_bank_account(db: AsyncSession, account_id: str, data: BankAccountUpdate) -> BankAccount | None:
    account = await get_bank_account(db, account_id)
    if not account:
        return None
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(account, key, value)
    await db.flush()
    await db.refresh(account)
    return account


async def delete_bank_account(db: AsyncSession, account_id: str) -> bool:
    account = await get_bank_account(db, account_id)
    if not account:
        return False
    await db.delete(account)
    await db.flush()
    return True


async def import_bank_statement(db: AsyncSession, company_id: str, bank_account_id: str, transactions_data: list) -> list[BankTransaction]:
    created = []
    for t in transactions_data:
        bt = BankTransaction(
            company_id=uuid.UUID(company_id),
            bank_account_id=uuid.UUID(bank_account_id),
            fecha=t.fecha,
            tipo=t.tipo,
            monto=t.monto,
            moneda=t.moneda,
            descripcion=t.descripcion,
            referencia=t.referencia,
            contraparte=t.contraparte,
            categoria=t.categoria,
        )
        db.add(bt)
        created.append(bt)

        mt = monto if t.tipo == "credito" else -monto
        account_result = await db.execute(select(BankAccount).where(BankAccount.id == uuid.UUID(bank_account_id)))
        account = account_result.scalar_one_or_none()
        if account:
            account.saldo_actual += monto if t.tipo == "credito" else -monto

    await db.flush()
    for bt in created:
        await db.refresh(bt)
    return created


async def list_bank_transactions(
    db: AsyncSession, company_id: str,
    bank_account_id: str | None = None,
    conciliado: bool | None = None,
    desde: date | None = None, hasta: date | None = None,
    limit: int = 100, offset: int = 0,
) -> list[BankTransaction]:
    query = select(BankTransaction).where(BankTransaction.company_id == uuid.UUID(company_id))
    if bank_account_id:
        query = query.where(BankTransaction.bank_account_id == uuid.UUID(bank_account_id))
    if conciliado is not None:
        query = query.where(BankTransaction.conciliado == conciliado)
    if desde:
        query = query.where(BankTransaction.fecha >= desde)
    if hasta:
        query = query.where(BankTransaction.fecha <= hasta)
    query = query.order_by(BankTransaction.fecha.desc()).offset(offset).limit(limit)
    result = await db.execute(query)
    return list(result.scalars().all())


async def reconcile_transaction(db: AsyncSession, transaction_id: str, invoice_id: str) -> BankTransaction | None:
    result = await db.execute(select(BankTransaction).where(BankTransaction.id == uuid.UUID(transaction_id)))
    bt = result.scalar_one_or_none()
    if not bt:
        return None
    bt.conciliado = True
    bt.fecha_conciliacion = _now()
    bt.invoice_id = uuid.UUID(invoice_id)
    await db.flush()
    await db.refresh(bt)
    return bt


async def get_bank_dashboard(db: AsyncSession, company_id: str) -> dict:
    cid = uuid.UUID(company_id)
    accounts_result = await db.execute(
        select(BankAccount).where(BankAccount.company_id == cid, BankAccount.activo == True)
    )
    accounts = list(accounts_result.scalars().all())
    total_balance = sum(a.saldo_actual or Decimal("0") for a in accounts)

    tx_result = await db.execute(
        select(BankTransaction).where(BankTransaction.company_id == cid)
    )
    transactions = list(tx_result.scalars().all())
    total_tx = len(transactions)
    conciliadas = sum(1 for t in transactions if t.conciliado)
    pendientes = total_tx - conciliadas

    return {
        "total_accounts": len(accounts),
        "saldo_total": total_balance,
        "accounts": [
            {"id": str(a.id), "banco": a.banco, "tipo": a.tipo, "moneda": a.moneda, "saldo_actual": a.saldo_actual}
            for a in accounts
        ],
        "total_transactions": total_tx,
        "conciliadas": conciliadas,
        "pendientes": pendientes,
    }


# ── Cash Flow ──────────────────────────────────────────────────────────────────

async def generate_projection(db: AsyncSession, company_id: str, dias: int = 90) -> list[CashFlowProjection]:
    cid = uuid.UUID(company_id)
    today = _today()

    accounts_result = await db.execute(
        select(func.coalesce(func.sum(BankAccount.saldo_actual), 0)).where(
            BankAccount.company_id == cid, BankAccount.activo == True
        )
    )
    saldo_bancario = Decimal(str(accounts_result.scalar() or "0"))

    ap_result = await db.execute(
        text("""
            SELECT fecha_vencimiento, SUM(saldo_pendiente) as total_saldo
            FROM supplier_invoices
            WHERE company_id = :cid AND estado IN ('pendiente', 'aprobada', 'parcial') AND fecha_vencimiento IS NOT NULL
            GROUP BY fecha_vencimiento
        """),
        {"cid": cid},
    )
    ap_due = {row.fecha_vencimiento: Decimal(str(row.total_saldo or 0)) for row in ap_result.fetchall()}

    ar_result = await db.execute(
        text("""
            SELECT fecha_vencimiento, SUM(saldo_pendiente) as total_saldo
            FROM accounts_receivable
            WHERE company_id = :cid AND estado = 'pendiente' AND fecha_vencimiento IS NOT NULL
            GROUP BY fecha_vencimiento
        """),
        {"cid": cid},
    )
    ar_due = {row.fecha_vencimiento: Decimal(str(row.total_saldo or 0)) for row in ar_result.fetchall()}

    projections = []
    running_balance = saldo_bancario
    for i in range(dias):
        day = today + timedelta(days=i)
        ingresos = ar_due.get(day, Decimal("0"))
        egresos = ap_due.get(day, Decimal("0"))

        projected = running_balance + ingresos - egresos

        existing = await db.execute(
            select(CashFlowProjection).where(
                CashFlowProjection.company_id == cid,
                CashFlowProjection.fecha == day,
                CashFlowProjection.fuente == "automatico",
            )
        )
        existing_proj = existing.scalar_one_or_none()

        if existing_proj:
            existing_proj.saldo_inicial = running_balance
            existing_proj.ingresos_estimados = ingresos
            existing_proj.egresos_estimados = egresos
            existing_proj.saldo_final_proyectado = projected
            proj = existing_proj
        else:
            proj = CashFlowProjection(
                company_id=cid,
                fecha=day,
                saldo_inicial=running_balance,
                ingresos_estimados=ingresos,
                egresos_estimados=egresos,
                saldo_final_proyectado=projected,
                fuente="automatico",
            )
            db.add(proj)

        projections.append(proj)
        running_balance = projected

    await db.flush()
    for p in projections:
        await db.refresh(p)
    return projections


async def get_projections(db: AsyncSession, company_id: str, desde: date | None = None, hasta: date | None = None) -> list[CashFlowProjection]:
    query = select(CashFlowProjection).where(CashFlowProjection.company_id == uuid.UUID(company_id))
    if desde:
        query = query.where(CashFlowProjection.fecha >= desde)
    if hasta:
        query = query.where(CashFlowProjection.fecha <= hasta)
    query = query.order_by(CashFlowProjection.fecha.asc())
    result = await db.execute(query)
    return list(result.scalars().all())


async def update_projection(db: AsyncSession, projection_id: str, data: CashFlowProjectionUpdate) -> CashFlowProjection | None:
    result = await db.execute(select(CashFlowProjection).where(CashFlowProjection.id == uuid.UUID(projection_id)))
    proj = result.scalar_one_or_none()
    if not proj:
        return None
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(proj, key, value)
    if data.ingresos_estimados is not None or data.egresos_estimados is not None:
        proj.saldo_final_proyectado = (proj.saldo_inicial or Decimal("0")) + (proj.ingresos_estimados or Decimal("0")) - (proj.egresos_estimados or Decimal("0"))
    await db.flush()
    await db.refresh(proj)
    return proj


async def get_cash_flow_dashboard(db: AsyncSession, company_id: str) -> dict:
    cid = uuid.UUID(company_id)
    today = _today()

    accounts_result = await db.execute(
        select(func.coalesce(func.sum(BankAccount.saldo_actual), 0)).where(
            BankAccount.company_id == cid, BankAccount.activo == True
        )
    )
    saldo_bancario = Decimal(str(accounts_result.scalar() or "0"))

    projections = await generate_projection(db, company_id, 30)

    total_ingresos_30d = sum((p.ingresos_estimados or Decimal("0") for p in projections), Decimal("0"))
    total_egresos_30d = sum((p.egresos_estimados or Decimal("0") for p in projections), Decimal("0"))
    saldo_30d = projections[-1].saldo_final_proyectado if projections else saldo_bancario

    proyecciones_list = []
    for p in projections:
        proyecciones_list.append({
            "fecha": str(p.fecha),
            "saldo_inicial": p.saldo_inicial,
            "ingresos_estimados": p.ingresos_estimados,
            "egresos_estimados": p.egresos_estimados,
            "saldo_final_proyectado": p.saldo_final_proyectado,
            "fuente": p.fuente,
        })

    return {
        "saldo_bancario": saldo_bancario,
        "ingresos_hoy": projections[0].ingresos_estimados if projections else Decimal("0"),
        "egresos_hoy": projections[0].egresos_estimados if projections else Decimal("0"),
        "total_ingresos_30d": total_ingresos_30d,
        "total_egresos_30d": total_egresos_30d,
        "saldo_proyectado_7d": projections[6].saldo_final_proyectado if len(projections) > 6 else saldo_bancario,
        "saldo_proyectado_30d": saldo_30d,
        "proyecciones": proyecciones_list,
    }


# ── Budgets ────────────────────────────────────────────────────────────────────

async def create_budget(db: AsyncSession, data: BudgetCreate) -> Budget:
    budget = Budget(
        company_id=data.company_id,
        nombre=data.nombre,
        periodo=data.periodo,
        categoria=data.categoria,
        monto_presupuestado=data.monto_presupuestado,
        monto_ejecutado=Decimal("0"),
        monto_disponible=data.monto_presupuestado,
        area=data.area,
        tipo=data.tipo,
    )
    db.add(budget)
    await db.flush()
    await db.refresh(budget)
    return budget


async def list_budgets(db: AsyncSession, company_id: str, periodo: str | None = None, area: str | None = None) -> list[Budget]:
    query = select(Budget).where(Budget.company_id == uuid.UUID(company_id))
    if periodo:
        query = query.where(Budget.periodo == periodo)
    if area:
        query = query.where(Budget.area == area)
    query = query.order_by(Budget.periodo.desc(), Budget.area)
    result = await db.execute(query)
    return list(result.scalars().all())


async def get_budget(db: AsyncSession, budget_id: str) -> Budget | None:
    result = await db.execute(select(Budget).where(Budget.id == uuid.UUID(budget_id)))
    return result.scalar_one_or_none()


async def update_budget(db: AsyncSession, budget_id: str, data: BudgetUpdate) -> Budget | None:
    budget = await get_budget(db, budget_id)
    if not budget:
        return None
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(budget, key, value)
    if data.monto_presupuestado is not None:
        budget.monto_disponible = data.monto_presupuestado - (budget.monto_ejecutado or Decimal("0"))
    await db.flush()
    await db.refresh(budget)
    return budget


async def delete_budget(db: AsyncSession, budget_id: str) -> bool:
    budget = await get_budget(db, budget_id)
    if not budget:
        return False
    await db.delete(budget)
    await db.flush()
    return True


async def get_budget_vs_actual(db: AsyncSession, company_id: str, periodo: str) -> list[dict]:
    cid = uuid.UUID(company_id)

    budgets_result = await db.execute(
        select(Budget).where(Budget.company_id == cid, Budget.periodo == periodo)
    )
    budgets = list(budgets_result.scalars().all())

    year_month = periodo.split("-")
    year = int(year_month[0])
    month = int(year_month[1])
    start_date = date(year, month, 1)
    if month == 12:
        end_date = date(year + 1, 1, 1)
    else:
        end_date = date(year, month + 1, 1)

    ap_result = await db.execute(
        select(func.coalesce(func.sum(SupplierInvoice.total), 0)).where(
            SupplierInvoice.company_id == cid,
            SupplierInvoice.fecha_emision >= start_date,
            SupplierInvoice.fecha_emision < end_date,
        )
    )
    ap_total = Decimal(str(ap_result.scalar() or "0"))

    from api.src.petty_cash.models import Expense
    expense_result = await db.execute(
        select(func.coalesce(func.sum(Expense.monto), 0)).where(
            Expense.company_id == cid,
            Expense.fecha_gasto >= start_date,
            Expense.fecha_gasto < end_date,
        )
    )
    expense_total = Decimal(str(expense_result.scalar() or "0"))

    result = []
    for b in budgets:
        actual = ap_total if b.tipo == "egreso" and b.categoria == "proveedores" else expense_total
        b.monto_ejecutado = actual
        b.monto_disponible = b.monto_presupuestado - actual
        pct = round(float(actual) / float(b.monto_presupuestado) * 100, 1) if b.monto_presupuestado else 0
        result.append({
            "budget_id": str(b.id),
            "nombre": b.nombre,
            "periodo": b.periodo,
            "categoria": b.categoria,
            "area": b.area,
            "monto_presupuestado": b.monto_presupuestado,
            "monto_ejecutado": actual,
            "monto_disponible": b.monto_presupuestado - actual,
            "porcentaje_ejecutado": Decimal(str(pct)),
        })

    await db.flush()
    return result


async def get_budget_summary(db: AsyncSession, company_id: str, year: int) -> list[dict]:
    cid = uuid.UUID(company_id)

    budgets_result = await db.execute(
        select(Budget).where(
            Budget.company_id == cid,
            Budget.periodo.like(f"{year}-%"),
        )
    )
    budgets = list(budgets_result.scalars().all())

    summary: dict[str, dict] = {}
    for b in budgets:
        area = b.area or "general"
        if area not in summary:
            summary[area] = {
                "area": area,
                "total_presupuestado": Decimal("0"),
                "total_ejecutado": Decimal("0"),
                "total_disponible": Decimal("0"),
                "budgets": 0,
            }
        summary[area]["total_presupuestado"] += b.monto_presupuestado
        summary[area]["total_ejecutado"] += b.monto_ejecutado or Decimal("0")
        summary[area]["total_disponible"] += b.monto_disponible or Decimal("0")
        summary[area]["budgets"] += 1

    return list(summary.values())


# ── Payment Runs ───────────────────────────────────────────────────────────────

async def create_payment_run(db: AsyncSession, data: PaymentRunCreate) -> PaymentRun:
    run = PaymentRun(
        company_id=data.company_id,
        nombre=data.nombre,
        fecha_programada=data.fecha_programada,
        estado="borrador",
        metodo_pago=data.metodo_pago,
        bank_account_id=data.bank_account_id,
        total_monto=Decimal("0"),
    )
    db.add(run)
    await db.flush()

    invoices_result = await db.execute(
        select(SupplierInvoice).where(
            SupplierInvoice.company_id == data.company_id,
            SupplierInvoice.fecha_vencimiento <= data.fecha_programada,
            SupplierInvoice.estado.in_(["pendiente", "aprobada", "parcial"]),
            SupplierInvoice.saldo_pendiente > 0,
        )
    )
    invoices = list(invoices_result.scalars().all())

    total = Decimal("0")
    for inv in invoices:
        monto = inv.saldo_pendiente or Decimal("0")
        item = PaymentRunItem(
            payment_run_id=run.id,
            invoice_id=inv.id,
            supplier_id=inv.supplier_id,
            monto_programado=monto,
            estado="pendiente",
        )
        db.add(item)
        total += monto

    run.total_monto = total
    await db.flush()
    await db.refresh(run)
    return run


async def execute_payment_run(db: AsyncSession, run_id: str, user_id: str | None = None) -> PaymentRun | None:
    result = await db.execute(select(PaymentRun).where(PaymentRun.id == uuid.UUID(run_id)))
    run = result.scalar_one_or_none()
    if not run or run.estado != "borrador":
        return None

    items_result = await db.execute(
        select(PaymentRunItem).where(PaymentRunItem.payment_run_id == uuid.UUID(run_id))
    )
    items = list(items_result.scalars().all())

    for item in items:
        if item.estado != "pendiente":
            continue
        inv_result = await db.execute(select(SupplierInvoice).where(SupplierInvoice.id == item.invoice_id))
        inv = inv_result.scalar_one_or_none()
        if not inv:
            continue

        monto = item.monto_programado
        if monto > inv.saldo_pendiente:
            monto = inv.saldo_pendiente

        payment = SupplierInvoicePayment(
            invoice_id=inv.id,
            payment_method=run.metodo_pago or "transferencia",
            monto=monto,
            fecha_pago=run.fecha_programada,
            referencia=f"Lote: {run.nombre}",
            bank_account_id=run.bank_account_id,
            estado="pendiente",
        )
        db.add(payment)

        inv.saldo_pendiente -= monto
        item.monto_pagado = monto
        item.estado = "pagado"

        if inv.saldo_pendiente <= 0:
            inv.saldo_pendiente = Decimal("0")
            inv.estado = "pagada"
        else:
            inv.estado = "parcial"

    run.estado = "ejecutado"
    run.approved_by = uuid.UUID(user_id) if user_id else None
    await db.flush()
    await db.refresh(run)
    return run


async def list_payment_runs(db: AsyncSession, company_id: str) -> list[PaymentRun]:
    result = await db.execute(
        select(PaymentRun).where(
            PaymentRun.company_id == uuid.UUID(company_id)
        ).order_by(PaymentRun.created_at.desc())
    )
    return list(result.scalars().all())


async def get_payment_run(db: AsyncSession, run_id: str) -> PaymentRun | None:
    result = await db.execute(select(PaymentRun).where(PaymentRun.id == uuid.UUID(run_id)))
    return result.scalar_one_or_none()


async def get_payment_run_with_items(db: AsyncSession, run_id: str) -> PaymentRun | None:
    result = await db.execute(select(PaymentRun).where(PaymentRun.id == uuid.UUID(run_id)))
    run = result.scalar_one_or_none()
    if run:
        items_result = await db.execute(
            select(PaymentRunItem).where(PaymentRunItem.payment_run_id == uuid.UUID(run_id))
        )
        run.items = list(items_result.scalars().all())
    return run


# ── Consolidated Dashboard ─────────────────────────────────────────────────────

async def get_financial_dashboard(db: AsyncSession, company_id: str) -> dict:
    ap = await get_ap_dashboard(db, company_id)
    cash_flow = await get_cash_flow_dashboard(db, company_id)

    # Cuentas por cobrar: preferir accounts_receivable (detalle real,
    # vencimiento incluido) cuando el tenant la tiene poblada; si no, cae a
    # customer_accounts.saldo_actual (agregado). NO sumar ambas — un tenant
    # con las dos pobladas (ej. Casa Gonzalito, que migra detalle Y mantiene
    # el agregado como respaldo) duplicaria el mismo saldo.
    from sqlalchemy import text as _text
    ar_result = await db.execute(
        _text("""
            SELECT
                CASE WHEN EXISTS (SELECT 1 FROM accounts_receivable WHERE company_id = :company_id AND estado = 'pendiente')
                    THEN COALESCE((SELECT SUM(saldo_pendiente) FROM accounts_receivable
                                   WHERE company_id = :company_id AND estado = 'pendiente'), 0)
                    ELSE COALESCE((SELECT SUM(ca.saldo_actual) FROM customer_accounts ca
                                   JOIN customers c ON c.id = ca.customer_id
                                   WHERE c.company_id = :company_id AND ca.saldo_actual > 0), 0)
                END
        """),
        {"company_id": company_id},
    )
    ar_total = Decimal(str(ar_result.scalar() or "0"))

    ap_total = ap["total_pendiente"]

    budgets_result = await db.execute(
        select(Budget).where(Budget.company_id == uuid.UUID(company_id))
    )
    budgets = list(budgets_result.scalars().all())
    budget_list = []
    for b in budgets:
        pct = round(float(b.monto_ejecutado or 0) / float(b.monto_presupuestado or 1) * 100, 1)
        budget_list.append({
            "id": str(b.id),
            "nombre": b.nombre,
            "periodo": b.periodo,
            "presupuestado": b.monto_presupuestado,
            "ejecutado": b.monto_ejecutado,
            "porcentaje": pct,
        })

    liquidity_ratio = round(float(ar_total) / float(ap_total), 2) if ap_total else 999.0
    rotacion_cartera = 30.0
    rotacion_proveedores = 30.0

    return {
        "ap_dashboard": ap,
        "ar_summary": {"total_por_cobrar": ar_total},
        "cash_flow": cash_flow,
        "budget_summary": budget_list,
        "liquidity_ratio": liquidity_ratio,
        "rotacion_cartera_dias": rotacion_cartera,
        "rotacion_proveedores_dias": rotacion_proveedores,
    }


async def get_financial_ratios(db: AsyncSession, company_id: str) -> dict:
    cid = uuid.UUID(company_id)

    ap_total = await db.execute(
        select(func.coalesce(func.sum(SupplierInvoice.saldo_pendiente), 0)).where(
            SupplierInvoice.company_id == cid,
            SupplierInvoice.estado.in_(["pendiente", "aprobada", "parcial"]),
        )
    )
    ap_val = Decimal(str(ap_total.scalar() or "0"))

    # Mismo criterio (preferir AR, fallback a customer_accounts, no sumar
    # ambas) que get_financial_dashboard — ver comentario ahí.
    from sqlalchemy import text as _text
    ar_total = await db.execute(
        _text("""
            SELECT
                CASE WHEN EXISTS (SELECT 1 FROM accounts_receivable WHERE company_id = :company_id AND estado = 'pendiente')
                    THEN COALESCE((SELECT SUM(saldo_pendiente) FROM accounts_receivable
                                   WHERE company_id = :company_id AND estado = 'pendiente'), 0)
                    ELSE COALESCE((SELECT SUM(ca.saldo_actual) FROM customer_accounts ca
                                   JOIN customers c ON c.id = ca.customer_id
                                   WHERE c.company_id = :company_id AND ca.saldo_actual > 0), 0)
                END
        """),
        {"company_id": str(cid)},
    )
    ar_val = Decimal(str(ar_total.scalar() or "0"))

    bank_result = await db.execute(
        select(func.coalesce(func.sum(BankAccount.saldo_actual), 0)).where(
            BankAccount.company_id == cid, BankAccount.activo == True
        )
    )
    cash_val = Decimal(str(bank_result.scalar() or "0"))

    liquidity_ratio = round(float(cash_val + ar_val) / float(ap_val), 2) if ap_val else 999.0
    quick_ratio = round(float(cash_val) / float(ap_val), 2) if ap_val else 999.0

    from api.src.sales.models import Sale
    ventas_result = await db.execute(
        select(func.coalesce(func.sum(Sale.total), 0)).where(
            Sale.estado != "cancelado",
            Sale.company_id == cid,
            Sale.fecha >= (_today() - timedelta(days=365)),
        )
    )
    ventas_anuales = float(ventas_result.scalar() or "0")
    rotacion_cartera = round(365 / (ventas_anuales / float(ar_val)), 1) if ventas_anuales > 0 and ar_val > 0 else 0.0

    compras_result = await db.execute(
        select(func.coalesce(func.sum(SupplierInvoice.total), 0)).where(
            SupplierInvoice.company_id == cid,
            SupplierInvoice.fecha_emision >= (_today() - timedelta(days=365)),
        )
    )
    compras_anuales = float(compras_result.scalar() or "0")
    rotacion_proveedores = round(365 / (compras_anuales / float(ap_val)), 1) if compras_anuales > 0 and ap_val > 0 else 0.0

    ciclo_efectivo = round(rotacion_cartera - rotacion_proveedores, 1)

    return {
        "liquidity_ratio": liquidity_ratio,
        "quick_ratio": quick_ratio,
        "rotacion_cartera_dias": rotacion_cartera,
        "rotacion_proveedores_dias": rotacion_proveedores,
        "ciclo_efectivo_dias": ciclo_efectivo,
        "ap_total": ap_val,
        "ar_total": ar_val,
    }
