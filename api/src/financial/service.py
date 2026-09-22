"""Financial service — AP, banking, cash flow, budgets, payment runs, dashboards"""

from sqlalchemy import select, func, and_, or_, text, case
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime, timezone, date, timedelta
from zoneinfo import ZoneInfo
from decimal import Decimal
from pathlib import Path
import json
import uuid

from api.src.financial.models import (
    SupplierInvoice, SupplierInvoicePayment,
    BankAccount, BankTransaction,
    BankBalanceCorrectionRequest,
    APPaymentApprovalRequest,
    CashFlowProjection, Budget,
    PaymentRun, PaymentRunItem,
    SupplierCreditNote, SupplierCreditNoteApplication, SupplierReturn, PayrollMovement,
    SupplierPaymentOrder, SupplierPaymentOrderAllocation, SupplierPaymentOrderDisbursement,
)
from api.src.financial.schemas import (
    SupplierInvoiceCreate, SupplierInvoicePaymentCreate,
    BankAccountCreate, BankAccountUpdate,
    BankTransactionCreate, BankTransferCreate,
    CashFlowProjectionUpdate,
    BudgetCreate, BudgetUpdate,
    PaymentRunCreate,
    CashFlowAlertConfig,
    SupplierCreditNoteCreate, SupplierCreditNoteApply,
    SupplierPaymentOrderCreate, SupplierPaymentOrderDisburse,
    PaymentOrderDisbursementCreate,
    MultiSupplierPaymentBatchCreate,
    SettleValesAndPayRequest,
)
from api.src.purchases.models import Supplier, PurchaseReceipt
from api.src.caja.models import VaultEntry, CashRegisterMovement
from api.src.petty_cash.models import PettyCashFund, PettyCashFundMovement
from api.src.cheques.models import Cheque, ChequeHistorial
from fastapi import HTTPException



# ── Helpers ───────────────────────────────────────────────────────────────────

TZ_ASUNCION = ZoneInfo("America/Asuncion")


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
        total_brl=data.total_brl if data.total_brl is not None else (
            (data.total / data.tipo_cambio).quantize(Decimal("0.01")) if data.moneda == "BRL" and data.tipo_cambio and data.tipo_cambio > 1 else (data.total if data.moneda == "BRL" else None)
        ),
        saldo_pendiente_brl=data.saldo_pendiente_brl if data.saldo_pendiente_brl is not None else (
            data.total_brl if data.total_brl is not None else (
                (data.total / data.tipo_cambio).quantize(Decimal("0.01")) if data.moneda == "BRL" and data.tipo_cambio and data.tipo_cambio > 1 else (data.total if data.moneda == "BRL" else None)
            )
        ),
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
    query = query.order_by(
        case((SupplierInvoice.saldo_pendiente > 0, 0), else_=1),
        SupplierInvoice.fecha_vencimiento.asc(),
        SupplierInvoice.fecha_emision.desc(),
    ).offset(offset).limit(limit)
    result = await db.execute(query)
    invoices = list(result.scalars().all())

    # SupplierInvoiceResponse expone supplier_nombre pero SupplierInvoice no
    # tiene relationship() a Supplier -- sin esto el frontend cae al fallback
    # de mostrar los primeros 8 caracteres del UUID de supplier_id en la
    # columna "Proveedor", que es ilegible.
    supplier_ids = {i.supplier_id for i in invoices if i.supplier_id}
    if supplier_ids:
        sup_result = await db.execute(select(Supplier.id, Supplier.razon_social).where(Supplier.id.in_(supplier_ids)))
        names = {row.id: row.razon_social for row in sup_result.all()}
        for inv in invoices:
            inv.supplier_nombre = names.get(inv.supplier_id)
    return invoices


async def get_invoice(db: AsyncSession, invoice_id: str) -> SupplierInvoice | None:
    result = await db.execute(select(SupplierInvoice).where(SupplierInvoice.id == uuid.UUID(invoice_id)))
    return result.scalar_one_or_none()


async def get_invoice_with_payments(db: AsyncSession, invoice_id: str) -> SupplierInvoice | None:
    result = await db.execute(
        select(SupplierInvoice)
        .options(selectinload(SupplierInvoice.payments))
        .where(SupplierInvoice.id == uuid.UUID(invoice_id))
    )
    invoice = result.scalar_one_or_none()
    if invoice and invoice.supplier_id:
        sup_result = await db.execute(select(Supplier.razon_social).where(Supplier.id == invoice.supplier_id))
        invoice.supplier_nombre = sup_result.scalar_one_or_none()
    return invoice


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


async def revert_supplier_invoice_payment(
    db: AsyncSession,
    company_id: str,
    invoice_id: str,
    user_id: str | None = None,
    motivo: str | None = None,
) -> SupplierInvoice:
    """Revierte una factura de proveedor de estado 'pagada' a 'pendiente',
    restaurando su saldo_pendiente al total original para permitir procesarla
    con órdenes de pago de InteliMarket o vincularla a gastos/rendiciones."""
    cid = uuid.UUID(company_id)
    iid = uuid.UUID(invoice_id)
    res = await db.execute(
        select(SupplierInvoice).where(SupplierInvoice.id == iid, SupplierInvoice.company_id == cid)
    )
    inv = res.scalar_one_or_none()
    if not inv:
        raise HTTPException(status_code=404, detail="Factura de proveedor no encontrada")

    inv.estado = "pendiente"
    inv.saldo_pendiente = inv.total or Decimal("0")
    if inv.total_brl:
        inv.saldo_pendiente_brl = inv.total_brl

    nota_rev = f" [Reversión condición pagada: {motivo}]" if motivo else " [Reversión condición pagada para gestionar en InteliMarket]"
    inv.notas = ((inv.notas or "") + nota_rev).strip()

    await db.commit()
    await db.refresh(inv)
    return inv



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
        petty_cash_fund_id=data.petty_cash_fund_id,
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

    # Desembolso mediante Fondo Fijo / Caja Chica
    if data.petty_cash_fund_id or data.payment_method == "fondo_fijo":
        fund_id_val = data.petty_cash_fund_id
        if fund_id_val:
            from api.src.petty_cash.models import PettyCashFund, PettyCashFundMovement, Expense
            fund_res = await db.execute(select(PettyCashFund).where(PettyCashFund.id == fund_id_val))
            fund = fund_res.scalar_one_or_none()
            if fund:
                saldo_anterior = fund.saldo_actual
                fund.saldo_actual -= monto
                mov = PettyCashFundMovement(
                    fund_id=fund.id,
                    tipo="gasto",
                    monto=monto,
                    saldo_anterior=saldo_anterior,
                    saldo_nuevo=fund.saldo_actual,
                    referencia_type="supplier_invoice_payment",
                    referencia_id=payment.id,
                    observaciones=f"Pago a proveedor Factura {invoice.numero_factura} ({data.referencia or ''})",
                )
                db.add(mov)

                sup_nombre = getattr(invoice, "supplier_nombre", None)
                if not sup_nombre and invoice.supplier_id:
                    sup_q = await db.execute(select(Supplier.razon_social).where(Supplier.id == invoice.supplier_id))
                    sup_nombre = sup_q.scalar_one_or_none()

                expense = Expense(
                    company_id=invoice.company_id,
                    fund_id=fund.id,
                    monto=monto,
                    descripcion=f"Pago a proveedor Factura {invoice.numero_factura}",
                    proveedor=sup_nombre or f"Factura {invoice.numero_factura}",
                    numero_factura=invoice.numero_factura,
                    tipo_comprobante="FACTURA_CONTADO",
                    tipo_pago="efectivo",
                    fecha_gasto=data.fecha_pago or _today(),
                    estado="pagado",
                    es_pago_proveedor=True,
                    supplier_id=invoice.supplier_id,
                    supplier_invoice_id=invoice.id,
                    forma_pago_resumen="Fondo Fijo",
                    fecha_pago=data.fecha_pago or _today(),
                )
                db.add(expense)

    await db.flush()
    await db.refresh(payment)
    await db.refresh(invoice)
    return payment, invoice


# ── Aprobación de pagos grandes (Cuentas por Pagar Fase 3) ─────────────────────
# Umbral a partir del cual pagar una factura o ejecutar un lote de pago queda
# retenido hasta doble aprobación Supervisor+Gerente -- endurece el mismo
# tipo de riesgo real que se encontró en el bug de Lotes de Pago (Fase 2):
# antes no había ningún freno entre "armar el pago" y "la plata sale".
AP_APPROVAL_THRESHOLD = Decimal("10000000")  # Gs. 10.000.000


async def register_payment_gated(db: AsyncSession, invoice_id: str, data: SupplierInvoicePaymentCreate, user_id: str | None) -> dict:
    """Envoltorio de register_payment: si el monto a pagar supera el umbral,
    no paga -- crea una solicitud de aprobación y devuelve pending=True."""
    invoice = await get_invoice(db, invoice_id)
    if not invoice:
        return {"error": "Factura no encontrada"}
    if invoice.estado in ("pagada", "cancelada"):
        return {"error": f"La factura ya está en estado '{invoice.estado}'"}

    monto = min(data.monto, invoice.saldo_pendiente)
    if monto > AP_APPROVAL_THRESHOLD:
        existing = await db.execute(
            select(APPaymentApprovalRequest).where(
                APPaymentApprovalRequest.entidad_tipo == "invoice",
                APPaymentApprovalRequest.entidad_id == uuid.UUID(invoice_id),
                APPaymentApprovalRequest.estado == "pendiente",
            )
        )
        if existing.scalar_one_or_none():
            return {"error": "Ya hay un pago de esta factura pendiente de aprobación"}

        request = APPaymentApprovalRequest(
            company_id=invoice.company_id, entidad_tipo="invoice", entidad_id=invoice.id,
            monto=monto, payment_method=data.payment_method, moneda=data.moneda,
            fecha_pago=data.fecha_pago or _today(), referencia=data.referencia,
            comprobante_url=data.comprobante_url, bank_account_id=data.bank_account_id,
            solicitado_por=uuid.UUID(user_id) if user_id else None,
        )
        db.add(request)
        await db.flush()
        await db.refresh(request)
        return {"pending_approval": True, "request": request}

    result = await register_payment(db, invoice_id, data)
    if not result:
        return {"error": "No se pudo registrar el pago"}
    payment, invoice = result
    return {"pending_approval": False, "payment": payment, "invoice": invoice}


async def execute_payment_run_gated(db: AsyncSession, run_id: str, user_id: str | None) -> dict:
    """Envoltorio de execute_payment_run: si el total del lote supera el
    umbral, no ejecuta -- crea una solicitud de aprobación."""
    result = await db.execute(select(PaymentRun).where(PaymentRun.id == uuid.UUID(run_id)))
    run = result.scalar_one_or_none()
    if not run:
        return {"error": "Lote de pago no encontrado"}
    if run.estado != "borrador":
        return {"error": f"El lote ya está en estado '{run.estado}'"}

    if run.total_monto > AP_APPROVAL_THRESHOLD:
        existing = await db.execute(
            select(APPaymentApprovalRequest).where(
                APPaymentApprovalRequest.entidad_tipo == "payment_run",
                APPaymentApprovalRequest.entidad_id == run.id,
                APPaymentApprovalRequest.estado == "pendiente",
            )
        )
        if existing.scalar_one_or_none():
            return {"error": "Este lote ya tiene una aprobación pendiente"}

        request = APPaymentApprovalRequest(
            company_id=run.company_id, entidad_tipo="payment_run", entidad_id=run.id,
            monto=run.total_monto, solicitado_por=uuid.UUID(user_id) if user_id else None,
        )
        db.add(request)
        await db.flush()
        await db.refresh(request)
        return {"pending_approval": True, "request": request}

    executed = await execute_payment_run(db, run_id, user_id)
    return {"pending_approval": False, "run": executed}


async def list_ap_approvals(db: AsyncSession, company_id: str, estado: str | None = "pendiente") -> list[APPaymentApprovalRequest]:
    query = select(APPaymentApprovalRequest).where(APPaymentApprovalRequest.company_id == uuid.UUID(company_id))
    if estado:
        query = query.where(APPaymentApprovalRequest.estado == estado)
    query = query.order_by(APPaymentApprovalRequest.created_at.desc())
    result = await db.execute(query)
    return list(result.scalars().all())


async def _get_ap_approval(db: AsyncSession, request_id: str) -> APPaymentApprovalRequest | None:
    result = await db.execute(select(APPaymentApprovalRequest).where(APPaymentApprovalRequest.id == uuid.UUID(request_id)))
    return result.scalar_one_or_none()


async def approve_ap_payment(db: AsyncSession, request_id: str, user_id: str, tenant_id: str) -> dict:
    from api.src.rbac.service import get_user_roles

    request = await _get_ap_approval(db, request_id)
    if not request:
        return {"error": "Solicitud no encontrada"}
    if request.estado != "pendiente":
        return {"error": f"La solicitud ya está en estado '{request.estado}'"}

    roles = {r["role_name"] for r in await get_user_roles(db, uuid.UUID(user_id), uuid.UUID(tenant_id))}
    # Un llamado llena un solo slot, aunque la persona tenga ambos roles --
    # mismo control que credit_accounts.approve_credit_request y
    # bank_balance_correction_requests, para que Supervisor y Gerente sean
    # dos personas reales aprobando, no una sola dos veces.
    filled_now = None
    if "Supervisor" in roles and not request.aprobado_supervisor_id:
        request.aprobado_supervisor_id = uuid.UUID(user_id)
        request.aprobado_supervisor_at = _now()
        filled_now = "supervisor"
    elif "Gerente" in roles and not request.aprobado_gerente_id:
        request.aprobado_gerente_id = uuid.UUID(user_id)
        request.aprobado_gerente_at = _now()
        filled_now = "gerente"

    if not filled_now:
        return {"error": "No autorizado: se requiere rol Supervisor o Gerente (o ya aprobaste esta solicitud)"}

    await db.flush()

    completo = False
    if request.aprobado_supervisor_id and request.aprobado_gerente_id:
        request.estado = "aprobado"
        completo = True

        if request.entidad_tipo == "invoice":
            data = SupplierInvoicePaymentCreate(
                payment_method=request.payment_method or "transferencia",
                monto=request.monto, moneda=request.moneda or "PYG",
                fecha_pago=request.fecha_pago, referencia=request.referencia,
                comprobante_url=request.comprobante_url, bank_account_id=request.bank_account_id,
            )
            await register_payment(db, str(request.entidad_id), data)
        elif request.entidad_tipo == "payment_run":
            await execute_payment_run(db, str(request.entidad_id), user_id)

        await db.flush()

    await db.refresh(request)
    return {"success": True, "request": request, "completo": completo}


async def reject_ap_payment(db: AsyncSession, request_id: str, user_id: str, tenant_id: str, motivo: str | None) -> dict:
    from api.src.rbac.service import get_user_roles

    request = await _get_ap_approval(db, request_id)
    if not request:
        return {"error": "Solicitud no encontrada"}
    if request.estado != "pendiente":
        return {"error": f"La solicitud ya está en estado '{request.estado}'"}

    roles = {r["role_name"] for r in await get_user_roles(db, uuid.UUID(user_id), uuid.UUID(tenant_id))}
    if "Supervisor" not in roles and "Gerente" not in roles:
        return {"error": "No autorizado: se requiere rol Supervisor o Gerente"}

    request.estado = "rechazado"
    request.rechazado_por = uuid.UUID(user_id)
    request.rechazado_at = _now()
    request.rechazado_motivo = motivo
    await db.flush()
    await db.refresh(request)
    return {"success": True, "request": request}


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


async def get_top_suppliers_report(db: AsyncSession, company_id: str, fecha_desde: date | None = None, fecha_hasta: date | None = None, limit: int = 15) -> dict:
    """Top proveedores por gasto (facturado) + DPO (Days Payable Outstanding)
    real por proveedor, calculado con los pagos efectivamente registrados
    (fecha_pago - fecha_emision de la factura que cubre cada pago), no una
    formula agregada como rotacion_proveedores_dias en get_financial_ratios."""
    conditions = ["si.company_id = :cid"]
    params: dict = {"cid": company_id}
    if fecha_desde:
        conditions.append("si.fecha_emision >= :desde")
        params["desde"] = fecha_desde
    if fecha_hasta:
        conditions.append("si.fecha_emision <= :hasta")
        params["hasta"] = fecha_hasta
    where_clause = " AND ".join(conditions)

    gasto_result = await db.execute(
        text(f"""
            SELECT si.supplier_id, s.razon_social, COUNT(*) as cantidad_facturas, COALESCE(SUM(si.total), 0) as total_gasto
            FROM supplier_invoices si
            JOIN suppliers s ON s.id = si.supplier_id
            WHERE {where_clause}
            GROUP BY si.supplier_id, s.razon_social
            ORDER BY total_gasto DESC
            LIMIT :limit
        """),
        {**params, "limit": limit},
    )
    rows = gasto_result.fetchall()

    dpo_result = await db.execute(
        text(f"""
            SELECT si.supplier_id, AVG(sip.fecha_pago - si.fecha_emision) as dpo_dias,
                   COUNT(sip.id) as cantidad_pagos, COALESCE(SUM(sip.monto), 0) as total_pagado
            FROM supplier_invoice_payments sip
            JOIN supplier_invoices si ON si.id = sip.invoice_id
            WHERE {where_clause}
            GROUP BY si.supplier_id
        """),
        params,
    )
    dpo_map = {str(r.supplier_id): r for r in dpo_result.fetchall()}

    proveedores = []
    for r in rows:
        dpo_row = dpo_map.get(str(r.supplier_id))
        proveedores.append({
            "supplier_id": str(r.supplier_id),
            "razon_social": r.razon_social,
            "cantidad_facturas": r.cantidad_facturas,
            "total_gasto": Decimal(str(r.total_gasto)),
            "dpo_dias": round(float(dpo_row.dpo_dias), 1) if dpo_row and dpo_row.dpo_dias is not None else None,
            "cantidad_pagos": dpo_row.cantidad_pagos if dpo_row else 0,
            "total_pagado": Decimal(str(dpo_row.total_pagado)) if dpo_row else Decimal("0"),
        })

    dpo_general_result = await db.execute(
        text(f"""
            SELECT AVG(sip.fecha_pago - si.fecha_emision) as dpo_general
            FROM supplier_invoice_payments sip JOIN supplier_invoices si ON si.id = sip.invoice_id
            WHERE {where_clause}
        """),
        params,
    )
    dpo_general = dpo_general_result.scalar()

    return {
        "proveedores": proveedores,
        "dpo_general_dias": round(float(dpo_general), 1) if dpo_general is not None else None,
        "total_gasto_periodo": sum((p["total_gasto"] for p in proveedores), Decimal("0")),
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


async def get_payment_queue(db: AsyncSession, company_id: str) -> dict:
    """Cola de pago priorizada (Cuentas por Pagar Fase 1): las facturas
    pendientes ordenadas por urgencia real (mas vencida primero, despues por
    monto), cruzada contra la caja real disponible hoy (get_cash_position,
    ya construido en Bancos) para marcar hasta donde alcanza a pagar sin
    quedar en descubierto -- antes no habia ninguna vista que priorizara
    que pagar primero entre las facturas vencidas."""
    cid = uuid.UUID(company_id)
    today = _today()

    query = select(SupplierInvoice).where(
        SupplierInvoice.company_id == cid,
        SupplierInvoice.estado.in_(["pendiente", "aprobada", "parcial"]),
        SupplierInvoice.saldo_pendiente > 0,
    )
    result = await db.execute(query)
    invoices = list(result.scalars().all())

    supplier_ids = {i.supplier_id for i in invoices}
    sup_map = {}
    if supplier_ids:
        sup_result = await db.execute(select(Supplier).where(Supplier.id.in_(supplier_ids)))
        sup_map = {s.id: s.razon_social for s in sup_result.scalars().all()}

    def _dias_vencido(inv):
        return (today - inv.fecha_vencimiento).days if inv.fecha_vencimiento < today else 0

    # vencidas primero (mas dias vencido primero), despues por vencer por
    # fecha mas cercana, y dentro de cada grupo por monto descendente --
    # asi la cola siempre muestra primero lo mas urgente.
    invoices.sort(key=lambda i: (0 if i.fecha_vencimiento < today else 1, -_dias_vencido(i), -(i.saldo_pendiente or Decimal("0"))))

    # Se usa el efectivo en PYG solamente, no el total consolidado -- las
    # facturas de AP se pagan en guaranies desde cuentas en guaranies, asi
    # que netear contra una deuda en otra moneda (ej. la cuenta BRL en
    # descubierto) daria una "caja disponible" negativa aunque sobre
    # efectivo real en guaranies para pagar.
    cash_position = await get_cash_position(db, company_id)
    caja_disponible = Decimal(str((cash_position.get("por_moneda") or {}).get("PYG") or 0))

    cola = []
    acumulado = Decimal("0")
    for inv in invoices:
        saldo = inv.saldo_pendiente or Decimal("0")
        acumulado += saldo
        cola.append({
            "id": str(inv.id),
            "numero_factura": inv.numero_factura,
            "supplier_id": str(inv.supplier_id),
            "supplier_nombre": sup_map.get(inv.supplier_id, "Desconocido"),
            "fecha_vencimiento": inv.fecha_vencimiento.isoformat(),
            "saldo_pendiente": saldo,
            "moneda": inv.moneda,
            "dias_vencido": _dias_vencido(inv),
            "cubierta_por_caja": acumulado <= caja_disponible,
        })

    return {
        "caja_disponible": caja_disponible,
        "total_cola": sum((c["saldo_pendiente"] for c in cola), Decimal("0")),
        "cantidad_cubierta_por_caja": sum(1 for c in cola if c["cubierta_por_caja"]),
        "cola": cola,
    }


async def get_invoice_by_receipt(db: AsyncSession, receipt_id: str) -> SupplierInvoice | None:
    result = await db.execute(
        select(SupplierInvoice).where(SupplierInvoice.receipt_id == uuid.UUID(receipt_id))
    )
    return result.scalar_one_or_none()


async def auto_create_invoice_from_receipt(db: AsyncSession, receipt_id: str) -> SupplierInvoice | None:
    from api.src.purchases.models import PurchaseReceipt, PurchaseReceiptItem, PurchaseOrder

    existing_result = await db.execute(
        select(SupplierInvoice).where(SupplierInvoice.receipt_id == uuid.UUID(receipt_id))
    )
    existing = existing_result.scalar_one_or_none()
    if existing:
        return existing

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

    # IVA real: la orden de compra ya trae el desglose de IVA 10%/5% cargado
    # al crearla (98.8% de las OC de este cliente lo tienen) -- se propaga
    # proporcional a lo efectivamente recibido vs. lo pedido, en vez de
    # dejarlo en 0 como pasaba antes (por eso "IVA Credito Fiscal" nunca
    # posteaba nada en el mayor contable). Si la recepcion es parcial, el
    # IVA tambien se prorratea; si el total pedido es 0 no hay base para
    # prorratear y se deja en 0 en vez de dividir por cero.
    iva_10 = Decimal("0")
    iva_5 = Decimal("0")
    if po.total and po.total > 0:
        proporcion = total / po.total
        iva_10 = (po.iva_10 or Decimal("0")) * proporcion
        iva_5 = (po.iva_5 or Decimal("0")) * proporcion

    invoice = SupplierInvoice(
        company_id=po.company_id,
        supplier_id=po.supplier_id,
        numero_factura=f"AUTO-{receipt.numero}",
        fecha_emision=_today(),
        fecha_vencimiento=_today() + timedelta(days=30),
        total=total,
        iva_10=iva_10,
        iva_5=iva_5,
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
        alias=data.alias,
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
            BankAccount.company_id == uuid.UUID(company_id),
            BankAccount.moneda != "BRL",
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
    """Importa un extracto bancario real. Antes esta funcion rompia con
    NameError en la primera transaccion (usaba una variable 'monto' que nunca
    existia) -- se llamaba una sola vez por importacion asi que el bug nunca
    se disparaba salvo que alguien intentara usarla de verdad."""
    account_result = await db.execute(select(BankAccount).where(BankAccount.id == uuid.UUID(bank_account_id)))
    account = account_result.scalar_one_or_none()

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

        if account:
            account.saldo_actual = (account.saldo_actual or Decimal("0")) + (t.monto if t.tipo == "credito" else -t.monto)

    await db.flush()
    for bt in created:
        await db.refresh(bt)
    return created


async def create_bank_transaction(
    db: AsyncSession,
    company_id: str,
    bank_account_id: str,
    data: BankTransactionCreate
) -> BankTransaction:
    """Registra manualmente un movimiento bancario unitario y actualiza el saldo de la cuenta."""
    account_result = await db.execute(select(BankAccount).where(BankAccount.id == uuid.UUID(bank_account_id)))
    account = account_result.scalar_one_or_none()
    if not account:
        raise ValueError("Cuenta bancaria no encontrada.")

    cid = (data.company_id if getattr(data, "company_id", None) else None) or (uuid.UUID(company_id) if company_id else account.company_id)
    bt = BankTransaction(
        company_id=cid,
        bank_account_id=uuid.UUID(bank_account_id),
        fecha=data.fecha,
        tipo=data.tipo,
        monto=data.monto,
        moneda=data.moneda or account.moneda,
        descripcion=data.descripcion,
        referencia=data.referencia,
        contraparte=data.contraparte,
        categoria=data.categoria or "otros",
    )
    db.add(bt)
    account.saldo_actual = (account.saldo_actual or Decimal("0")) + (data.monto if data.tipo == "credito" else -data.monto)

    # Si se especificó una comisión bancaria adicional asociada al movimiento
    if data.comision_adicional and data.comision_adicional > Decimal("0"):
        comision_bt = BankTransaction(
            company_id=cid,
            bank_account_id=uuid.UUID(bank_account_id),
            fecha=data.fecha,
            tipo="debito",
            monto=data.comision_adicional,
            moneda=data.moneda or account.moneda,
            descripcion=f"Comisión bancaria asociada a ref. {data.referencia or ''}".strip(),
            referencia=f"COM-{data.referencia or ''}".strip("-"),
            contraparte=account.banco,
            categoria="comision_bancaria",
        )
        db.add(comision_bt)
        account.saldo_actual = account.saldo_actual - data.comision_adicional

    await db.flush()
    await db.refresh(bt)
    return bt


async def create_bank_transfer(
    db: AsyncSession,
    company_id: str,
    data: BankTransferCreate
) -> dict:
    """Ejecuta una transferencia entre cuentas bancarias propias de la empresa.
    
    Genera el débito en la cuenta origen, el crédito en la cuenta destino y,
    si aplica, el débito por comisión bancaria en la cuenta origen.
    """
    if data.origen_account_id == data.destino_account_id:
        raise ValueError("La cuenta origen y destino no pueden ser la misma.")

    cid = (data.company_id if getattr(data, "company_id", None) else None) or (uuid.UUID(company_id) if company_id else None)
    res_origen = await db.execute(
        select(BankAccount).where(
            BankAccount.id == data.origen_account_id,
            *( [BankAccount.company_id == cid] if cid else [] )
        )
    )
    acc_origen = res_origen.scalar_one_or_none()
    if not acc_origen:
        raise ValueError("Cuenta bancaria de origen no encontrada.")

    cid = cid or acc_origen.company_id
    res_destino = await db.execute(select(BankAccount).where(BankAccount.id == data.destino_account_id, BankAccount.company_id == cid))
    acc_destino = res_destino.scalar_one_or_none()
    if not acc_destino:
        raise ValueError("Cuenta bancaria de destino no encontrada.")

    ref_str = data.referencia or f"TRANSF-{datetime.now().strftime('%Y%m%d%H%M')}"
    desc_origen = data.descripcion or f"Transferencia a {acc_destino.banco} ({acc_destino.numero_cuenta})"
    desc_destino = data.descripcion or f"Transferencia desde {acc_origen.banco} ({acc_origen.numero_cuenta})"

    # 1. Débito en origen
    tx_debito = BankTransaction(
        company_id=cid,
        bank_account_id=acc_origen.id,
        fecha=data.fecha,
        tipo="debito",
        monto=data.monto,
        moneda=data.moneda,
        descripcion=desc_origen,
        referencia=ref_str,
        contraparte=f"{acc_destino.banco} - {acc_destino.titular or acc_destino.numero_cuenta}",
        categoria="transferencia_interna",
    )
    db.add(tx_debito)
    acc_origen.saldo_actual = (acc_origen.saldo_actual or Decimal("0")) - data.monto

    # 2. Crédito en destino
    tx_credito = BankTransaction(
        company_id=cid,
        bank_account_id=acc_destino.id,
        fecha=data.fecha,
        tipo="credito",
        monto=data.monto,
        moneda=data.moneda,
        descripcion=desc_destino,
        referencia=ref_str,
        contraparte=f"{acc_origen.banco} - {acc_origen.titular or acc_origen.numero_cuenta}",
        categoria="transferencia_interna",
    )
    db.add(tx_credito)
    acc_destino.saldo_actual = (acc_destino.saldo_actual or Decimal("0")) + data.monto

    # 3. Comisión en origen si aplica
    tx_comision = None
    if data.comision and data.comision > Decimal("0"):
        tx_comision = BankTransaction(
            company_id=cid,
            bank_account_id=acc_origen.id,
            fecha=data.fecha,
            tipo="debito",
            monto=data.comision,
            moneda=data.moneda,
            descripcion=f"Comisión por transferencia ref. {ref_str}",
            referencia=f"COM-{ref_str}",
            contraparte=acc_origen.banco,
            categoria="comision_bancaria",
        )
        db.add(tx_comision)
        acc_origen.saldo_actual = acc_origen.saldo_actual - data.comision

    await db.flush()
    await db.refresh(tx_debito)
    await db.refresh(tx_credito)

    return {
        "success": True,
        "origen_tx_id": str(tx_debito.id),
        "destino_tx_id": str(tx_credito.id),
        "comision_tx_id": str(tx_comision.id) if tx_comision else None,
        "origen_saldo_nuevo": float(acc_origen.saldo_actual),
        "destino_saldo_nuevo": float(acc_destino.saldo_actual),
        "mensaje": f"Transferencia de {float(data.monto):,.0f} Gs. procesada con éxito entre {acc_origen.banco} y {acc_destino.banco}."
    }


async def delete_bank_transaction(db: AsyncSession, company_id: str, transaction_id: str) -> bool:
    """Elimina una transacción bancaria manual no conciliada y revierte su impacto en el saldo."""
    tx_uuid = uuid.UUID(transaction_id)
    cid = uuid.UUID(company_id)
    res = await db.execute(select(BankTransaction).where(BankTransaction.id == tx_uuid, BankTransaction.company_id == cid))
    bt = res.scalar_one_or_none()
    if not bt:
        raise ValueError("Movimiento bancario no encontrado.")

    if bt.conciliado:
        raise ValueError("No se puede eliminar un movimiento bancario ya conciliado. Desconcilie primero.")

    acc_res = await db.execute(select(BankAccount).where(BankAccount.id == bt.bank_account_id))
    acc = acc_res.scalar_one_or_none()
    if acc:
        acc.saldo_actual = (acc.saldo_actual or Decimal("0")) - (bt.monto if bt.tipo == "credito" else -bt.monto)

    await db.delete(bt)
    await db.flush()
    return True


async def preview_bank_statement_file(db: AsyncSession, bank_account_id: str, file_bytes: bytes, mes: int, anio: int) -> dict:
    """Parsea el archivo sin escribir nada -- para la vista previa del
    frontend antes de confirmar la carga (Bancos Fase 6)."""
    from api.src.financial import statement_import

    account = await get_bank_account(db, bank_account_id)
    if not account:
        raise ValueError("Cuenta bancaria no encontrada")

    account_tipo = statement_import.account_tipo_normalizado(account.tipo, account.titular, account.numero_cuenta)
    parsed = statement_import.parse_statement(file_bytes, mes, anio, account.banco, account_tipo)

    duplicadas = await _count_duplicate_transactions(db, bank_account_id, parsed["transacciones"])
    return {
        "sheet_matched": parsed["sheet_matched"],
        "saldo_anterior": parsed["saldo_anterior"],
        "closing_from_totals": parsed["closing_from_totals"],
        "total_detectadas": len(parsed["transacciones"]),
        "nuevas": len(parsed["transacciones"]) - duplicadas,
        "duplicadas": duplicadas,
        "transacciones": [
            {"fecha": t["fecha"].isoformat(), "tipo": t["tipo"], "monto": float(t["monto"]), "descripcion": t["descripcion"], "referencia": t["referencia"]}
            for t in parsed["transacciones"]
        ],
    }


async def _count_duplicate_transactions(db: AsyncSession, bank_account_id: str, transacciones: list[dict]) -> int:
    if not transacciones:
        return 0
    existing = await db.execute(
        select(BankTransaction.fecha, BankTransaction.tipo, BankTransaction.monto, BankTransaction.descripcion, BankTransaction.referencia)
        .where(BankTransaction.bank_account_id == uuid.UUID(bank_account_id))
    )
    existing_keys = {(row.fecha, row.tipo, row.monto, row.descripcion or "", row.referencia or "") for row in existing.all()}
    return sum(
        1 for t in transacciones
        if (t["fecha"], t["tipo"], t["monto"], t["descripcion"] or "", t["referencia"] or "") in existing_keys
    )


async def import_bank_statement_file(db: AsyncSession, company_id: str, bank_account_id: str, file_bytes: bytes, mes: int, anio: int) -> dict:
    """Carga real de un extracto Excel tal cual lo entrega el banco (Bancos
    Fase 6, reemplaza el textarea TSV manual). Idempotente: una transaccion
    ya presente (misma fecha+tipo+monto+descripcion+referencia en la misma
    cuenta) se saltea en vez de duplicarse, para poder resubir el mismo mes
    sin miedo si hace falta corregir algo."""
    from api.src.financial import statement_import

    account = await get_bank_account(db, bank_account_id)
    if not account:
        raise ValueError("Cuenta bancaria no encontrada")

    account_tipo = statement_import.account_tipo_normalizado(account.tipo, account.titular, account.numero_cuenta)
    parsed = statement_import.parse_statement(file_bytes, mes, anio, account.banco, account_tipo)
    transacciones = parsed["transacciones"]

    existing = await db.execute(
        select(BankTransaction.fecha, BankTransaction.tipo, BankTransaction.monto, BankTransaction.descripcion, BankTransaction.referencia)
        .where(BankTransaction.bank_account_id == uuid.UUID(bank_account_id))
    )
    existing_keys = {(row.fecha, row.tipo, row.monto, row.descripcion or "", row.referencia or "") for row in existing.all()}

    nuevas = 0
    for t in transacciones:
        key = (t["fecha"], t["tipo"], t["monto"], t["descripcion"] or "", t["referencia"] or "")
        if key in existing_keys:
            continue
        db.add(BankTransaction(
            company_id=uuid.UUID(company_id), bank_account_id=uuid.UUID(bank_account_id),
            fecha=t["fecha"], tipo=t["tipo"], monto=t["monto"], moneda=account.moneda,
            descripcion=t["descripcion"], referencia=t["referencia"], categoria="otros",
        ))
        account.saldo_actual = (account.saldo_actual or Decimal("0")) + (t["monto"] if t["tipo"] == "credito" else -t["monto"])
        existing_keys.add(key)
        nuevas += 1

    if nuevas > 0:
        # el saldo verificado ya no representa el saldo real tras sumar
        # movimientos nuevos -- hay que volver a verificarlo (Bancos Fase 5).
        account.saldo_verificado_manualmente = False
        account.saldo_verificado_at = None
        account.saldo_verificado_por = None
        db.add(account)

    await db.flush()
    return {
        "sheet_matched": parsed["sheet_matched"],
        "total_detectadas": len(transacciones),
        "nuevas": nuevas,
        "duplicadas": len(transacciones) - nuevas,
        "saldo_actual": account.saldo_actual,
    }


async def suggest_reconciliation_matches(db: AsyncSession, company_id: str, transaction_id: str) -> list[dict]:
    """Sugiere candidatos reales para conciliar una transaccion bancaria:
    cheques y facturas de proveedor con monto igual (o muy cercano) y fecha
    cercana. No concilia nada solo -- el usuario confirma cual es el match real."""
    from api.src.cheques.models import Cheque

    tx_result = await db.execute(select(BankTransaction).where(BankTransaction.id == uuid.UUID(transaction_id)))
    tx = tx_result.scalar_one_or_none()
    if not tx:
        return []

    cid = uuid.UUID(company_id)
    monto_abs = abs(tx.monto)
    tolerancia = monto_abs * Decimal("0.01")  # 1% de margen por comisiones/redondeo
    ventana_dias = timedelta(days=10)

    sugerencias = []

    if tx.tipo == "debito":
        chq_result = await db.execute(
            select(Cheque).where(
                Cheque.company_id == cid,
                Cheque.estado.in_(["pendiente", "entregado"]),
                Cheque.monto >= monto_abs - tolerancia,
                Cheque.monto <= monto_abs + tolerancia,
            )
        )
        for c in chq_result.scalars().all():
            ref_date = c.fecha_pago or c.fecha_emision
            if ref_date and abs((tx.fecha - ref_date).days) <= ventana_dias.days:
                dias = abs((tx.fecha - ref_date).days)
                sugerencias.append({
                    "tipo": "cheque", "id": str(c.id),
                    "descripcion": f"Cheque N° {c.numero} — {c.beneficiario}",
                    "monto": float(c.monto), "fecha": c.fecha_pago.isoformat() if c.fecha_pago else None,
                    "diferencia_dias": dias,
                    "confidence": _match_confidence(monto_abs, Decimal(str(c.monto)), dias),
                })

        inv_result = await db.execute(
            select(SupplierInvoice).where(
                SupplierInvoice.company_id == cid,
                SupplierInvoice.estado.in_(["pendiente", "aprobada", "parcial"]),
                SupplierInvoice.saldo_pendiente >= monto_abs - tolerancia,
                SupplierInvoice.saldo_pendiente <= monto_abs + tolerancia,
            )
        )
        for inv in inv_result.scalars().all():
            if abs((tx.fecha - inv.fecha_vencimiento).days) <= ventana_dias.days:
                dias = abs((tx.fecha - inv.fecha_vencimiento).days)
                sugerencias.append({
                    "tipo": "invoice", "id": str(inv.id),
                    "descripcion": f"Factura {inv.numero_factura}",
                    "monto": float(inv.saldo_pendiente), "fecha": inv.fecha_vencimiento.isoformat(),
                    "diferencia_dias": dias,
                    "confidence": _match_confidence(monto_abs, Decimal(str(inv.saldo_pendiente)), dias),
                })

    # alta confianza primero, despues por cercania de fecha
    sugerencias.sort(key=lambda s: (0 if s["confidence"] == "alta" else 1, s["diferencia_dias"]))
    return sugerencias[:10]


def _match_confidence(monto_transaccion: Decimal, monto_candidato: Decimal, diferencia_dias: int) -> str:
    """Alta confianza = mismo monto (dentro de 0.1%, no el 1% de tolerancia
    de busqueda) y fecha muy cercana -- suficiente para preseleccionar en
    conciliacion automatica sin que el usuario revise cada uno a mano."""
    if monto_transaccion == 0:
        return "baja"
    diff_pct = abs(monto_candidato - monto_transaccion) / monto_transaccion
    return "alta" if diff_pct <= Decimal("0.001") and diferencia_dias <= 2 else "baja"


async def list_bank_transactions(
    db: AsyncSession, company_id: str,
    bank_account_id: str | None = None,
    conciliado: bool | None = None,
    desde: date | None = None, hasta: date | None = None,
    categoria: str | None = None,
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
    if categoria:
        query = query.where(BankTransaction.categoria == categoria)
    query = query.order_by(BankTransaction.fecha.desc()).offset(offset).limit(limit)
    result = await db.execute(query)
    return list(result.scalars().all())


async def reconcile_transaction(
    db: AsyncSession, transaction_id: str,
    matched_type: str, matched_id: str | None,
    user_id: str | None = None, user_nombre: str | None = None,
) -> BankTransaction | None:
    """Concilia una transaccion bancaria real contra su contraparte real:
    'invoice' (factura de proveedor), 'cheque' (cierra el ciclo real del
    cheque -- si el banco lo debito, es porque se cobro de verdad, y el
    cheque pasa a 'cobrado' automaticamente), o 'manual' (sin contraparte
    del sistema, ej. comision bancaria)."""
    result = await db.execute(select(BankTransaction).where(BankTransaction.id == uuid.UUID(transaction_id)))
    bt = result.scalar_one_or_none()
    if not bt:
        return None

    bt.conciliado = True
    bt.fecha_conciliacion = _now()

    if matched_type == "invoice" and matched_id:
        bt.invoice_id = uuid.UUID(matched_id)
    elif matched_type == "cheque" and matched_id:
        bt.cheque_id = uuid.UUID(matched_id)
        from api.src.cheques import service as cheques_service
        try:
            await cheques_service.update_estado(db, matched_id, "cobrado", "Conciliado con extracto bancario", user_id, user_nombre)
        except ValueError:
            pass  # ya estaba cobrado o en un estado que no admite la transicion -- no bloquea la conciliacion bancaria

    await db.flush()
    await db.refresh(bt)
    return bt


async def bulk_reconcile(
    db: AsyncSession, matches: list[dict],
    user_id: str | None = None, user_nombre: str | None = None,
) -> dict:
    """Concilia varias transacciones de una sola vez -- pensado para
    aceptar en lote las sugerencias de alta confianza que ya eligio el
    usuario en la pantalla, no para conciliar a ciegas."""
    ok, fallidas = 0, []
    for m in matches:
        bt = await reconcile_transaction(
            db, m["transaction_id"], m["matched_type"], m.get("matched_id"), user_id, user_nombre,
        )
        if bt:
            ok += 1
        else:
            fallidas.append(m["transaction_id"])
    return {"conciliadas": ok, "fallidas": fallidas}


async def unreconcile_transaction(db: AsyncSession, transaction_id: str) -> BankTransaction | None:
    """Revierte una conciliacion -- no borra el vinculo (queda como registro),
    solo la vuelve a marcar pendiente para poder corregir un error."""
    result = await db.execute(select(BankTransaction).where(BankTransaction.id == uuid.UUID(transaction_id)))
    bt = result.scalar_one_or_none()
    if not bt:
        return None
    bt.conciliado = False
    bt.fecha_conciliacion = None
    await db.flush()
    await db.refresh(bt)
    return bt


async def get_bank_dashboard(db: AsyncSession, company_id: str) -> dict:
    cid = uuid.UUID(company_id)
    accounts_result = await db.execute(
        select(BankAccount).where(BankAccount.company_id == cid, BankAccount.activo == True)
    )
    accounts = list(accounts_result.scalars().all())
    # Antes se sumaba saldo_actual de TODAS las cuentas sin filtrar moneda
    # (ej. 5 cuentas PYG + 1 BRL sumadas como si fueran la misma unidad),
    # mostrado como "Saldo Total" en Gs. Se probó convertir la cuenta BRL
    # con la tasa real (mismo motor que get_cash_position), pero el saldo
    # BRL actual (-R$ 210.592) multiplicado por la tasa mueve el total en
    # ~Gs. 237M -- una cifra que huele a problema de calidad de datos en
    # esa cuenta, no algo para mezclar silenciosamente en el KPI principal.
    # Se deja "Saldo Total" solo en PYG (igual que ya hace BovedaPage) y el
    # resto de monedas se informa aparte, sin convertir, para que quede
    # visible en vez de oculto dentro de un numero agregado.
    total_balance = Decimal("0")
    saldo_otras_monedas: dict[str, Decimal] = {}
    for a in accounts:
        saldo = a.saldo_actual or Decimal("0")
        if a.moneda == "PYG":
            total_balance += saldo
        else:
            saldo_otras_monedas[a.moneda] = saldo_otras_monedas.get(a.moneda, Decimal("0")) + saldo

    tx_result = await db.execute(
        select(BankTransaction).where(BankTransaction.company_id == cid)
    )
    transactions = list(tx_result.scalars().all())
    total_tx = len(transactions)
    conciliadas = sum(1 for t in transactions if t.conciliado)
    pendientes = total_tx - conciliadas

    conciliadas_por_cuenta: dict[uuid.UUID, int] = {}
    pendientes_por_cuenta: dict[uuid.UUID, int] = {}
    for t in transactions:
        d = conciliadas_por_cuenta if t.conciliado else pendientes_por_cuenta
        d[t.bank_account_id] = d.get(t.bank_account_id, 0) + 1

    # chequeo liviano de saldo bajo en cada carga del dashboard -- no hace
    # falta un cron aparte, son pocas cuentas y no duplica si ya hay una
    # recomendacion pendiente para la misma cuenta.
    await check_saldo_bajo_alerts(db, company_id)

    return {
        "total_accounts": len(accounts),
        "saldo_total": total_balance,
        "saldo_otras_monedas": {m: v for m, v in saldo_otras_monedas.items()},
        "accounts": [
            {
                "id": str(a.id), "banco": a.banco, "tipo": a.tipo, "moneda": a.moneda, "saldo_actual": a.saldo_actual,
                "conciliadas": conciliadas_por_cuenta.get(a.id, 0),
                "pendientes": pendientes_por_cuenta.get(a.id, 0),
            }
            for a in accounts
        ],
        "total_transactions": total_tx,
        "conciliadas": conciliadas,
        "pendientes": pendientes,
    }


async def get_cash_position(db: AsyncSession, company_id: str) -> dict:
    """Posicion de caja consolidada -- suma los saldos de todas las cuentas
    activas convertidos a PYG (unica conversion real que hace falta hoy: la
    cuenta en BRL, via la tasa del BCP ya sincronizada). No hace revaluacion
    contable ni cobertura cambiaria -- solo da un numero consolidado real
    para el dashboard."""
    from api.src.currency import service as currency_service

    cid = uuid.UUID(company_id)
    accounts_result = await db.execute(
        select(BankAccount).where(BankAccount.company_id == cid, BankAccount.activo == True)
    )
    accounts = list(accounts_result.scalars().all())

    por_moneda: dict[str, Decimal] = {}
    total_pyg = Decimal("0")
    cuentas = []
    for a in accounts:
        saldo = a.saldo_actual or Decimal("0")
        por_moneda[a.moneda] = por_moneda.get(a.moneda, Decimal("0")) + saldo
        if a.moneda == "PYG":
            equivalente_pyg = saldo
        else:
            rate = await currency_service.get_exchange_rate(db, company_id, a.moneda)
            tasa = Decimal(str(rate.tasa_compra)) if rate and rate.tasa_compra else None
            equivalente_pyg = (saldo * tasa) if tasa else None
        if equivalente_pyg is not None:
            total_pyg += equivalente_pyg
        cuentas.append({
            "id": str(a.id), "banco": a.banco, "tipo": a.tipo, "moneda": a.moneda,
            "saldo_actual": saldo, "equivalente_pyg": equivalente_pyg,
        })

    # tendencia: saldo diario consolidado de las cuentas en PYG (simplificacion
    # documentada -- no reconstruye la tasa de cambio historica dia a dia para
    # la cuenta en BRL, solo consolida el movimiento de las cuentas en guaranies)
    pyg_account_ids = [a.id for a in accounts if a.moneda == "PYG"]
    tendencia = []
    if pyg_account_ids:
        mov_result = await db.execute(
            select(
                BankTransaction.fecha,
                func.sum(case((BankTransaction.tipo == "credito", BankTransaction.monto), else_=-BankTransaction.monto)),
            )
            .where(BankTransaction.bank_account_id.in_(pyg_account_ids))
            .group_by(BankTransaction.fecha)
            .order_by(BankTransaction.fecha)
        )
        movimientos = mov_result.all()
        saldo_inicial_pyg = sum((a.saldo_inicial or Decimal("0")) for a in accounts if a.moneda == "PYG")
        saldo_corriente = Decimal(str(saldo_inicial_pyg))
        for fecha, neto in movimientos:
            saldo_corriente += Decimal(str(neto or 0))
            tendencia.append({"fecha": fecha.isoformat(), "saldo": saldo_corriente})
        tendencia = tendencia[-90:]  # ultimos ~90 dias con movimiento

    return {
        "total_pyg_equivalente": total_pyg,
        "por_moneda": {k: v for k, v in por_moneda.items()},
        "cuentas": cuentas,
        "tendencia": tendencia,
    }


async def get_outstanding_items(db: AsyncSession, company_id: str) -> dict:
    """Pendientes de conciliar visibles en un solo lugar: cheques emitidos
    aun no cobrados por el banco, y depositos de caja registrados en el
    sistema que todavia no aparecen conciliados contra un movimiento
    bancario real."""
    from api.src.cheques.models import Cheque

    cid = uuid.UUID(company_id)

    cheques_result = await db.execute(
        select(Cheque).where(Cheque.company_id == cid, Cheque.estado.in_(["pendiente", "entregado"])).order_by(Cheque.fecha_pago)
    )
    cheques_pendientes = [
        {
            "id": str(c.id), "numero": c.numero, "beneficiario": c.beneficiario,
            "monto": c.monto, "fecha_pago": c.fecha_pago.isoformat() if c.fecha_pago else None,
            "estado": c.estado,
        }
        for c in cheques_result.scalars().all()
    ]

    depositos_result = await db.execute(
        select(BankTransaction).where(
            BankTransaction.company_id == cid,
            BankTransaction.categoria == "deposito_caja",
            BankTransaction.conciliado == False,
        ).order_by(BankTransaction.fecha.desc())
    )
    depositos_sin_conciliar = [
        {
            "id": str(t.id), "bank_account_id": str(t.bank_account_id), "fecha": t.fecha.isoformat(),
            "monto": t.monto, "descripcion": t.descripcion,
        }
        for t in depositos_result.scalars().all()
    ]

    return {
        "cheques_pendientes": cheques_pendientes,
        "total_cheques_pendientes": sum((c["monto"] or Decimal("0")) for c in cheques_pendientes),
        "depositos_sin_conciliar": depositos_sin_conciliar,
        "total_depositos_sin_conciliar": sum((d["monto"] or Decimal("0")) for d in depositos_sin_conciliar),
    }


async def get_reconciliation_report(db: AsyncSession, company_id: str, bank_account_id: str, desde: date | None, hasta: date | None) -> dict:
    """Datos para el reporte PDF de conciliacion bancaria (Bancos Fase 7):
    todos los movimientos de una cuenta en un rango de fechas, con su estado
    de conciliacion, mas los totales conciliado/pendiente."""
    account = await get_bank_account(db, bank_account_id)
    if not account:
        raise ValueError("Cuenta bancaria no encontrada")

    query = select(BankTransaction).where(
        BankTransaction.company_id == uuid.UUID(company_id),
        BankTransaction.bank_account_id == uuid.UUID(bank_account_id),
    )
    if desde:
        query = query.where(BankTransaction.fecha >= desde)
    if hasta:
        query = query.where(BankTransaction.fecha <= hasta)
    query = query.order_by(BankTransaction.fecha.asc())
    result = await db.execute(query)
    movimientos = list(result.scalars().all())

    total_creditos = sum((m.monto for m in movimientos if m.tipo == "credito"), Decimal("0"))
    total_debitos = sum((m.monto for m in movimientos if m.tipo == "debito"), Decimal("0"))
    conciliados = [m for m in movimientos if m.conciliado]
    pendientes = [m for m in movimientos if not m.conciliado]

    return {
        "account": account,
        "movimientos": movimientos,
        "total_creditos": total_creditos,
        "total_debitos": total_debitos,
        "cantidad_conciliados": len(conciliados),
        "cantidad_pendientes": len(pendientes),
        "monto_pendiente": sum((m.monto for m in pendientes), Decimal("0")),
    }


SYSTEM_RUN_MODEL_BANCOS = "system:bancos-controles-automaticos"


async def _get_or_create_bancos_system_run(db: AsyncSession, company_id: str):
    from api.src.finance_agent.models import FinanceAgentRun

    result = await db.execute(
        select(FinanceAgentRun).where(
            FinanceAgentRun.company_id == company_id, FinanceAgentRun.model == SYSTEM_RUN_MODEL_BANCOS,
        )
    )
    run = result.scalar_one_or_none()
    if run:
        return run
    run = FinanceAgentRun(company_id=company_id, model=SYSTEM_RUN_MODEL_BANCOS, status="completed", diagnostico="Controles automáticos del módulo Bancos (saldo bajo, divergencias)")
    db.add(run)
    await db.flush()
    return run


async def check_saldo_bajo_alerts(db: AsyncSession, company_id: str) -> int:
    """Genera una recomendacion 'saldo_bajo' por cada cuenta con umbral
    configurado (saldo_minimo_alerta) que esta por debajo de ese umbral --
    y no duplica si ya hay una recomendacion pendiente para la misma cuenta."""
    from api.src.finance_agent.models import FinanceRecommendation

    cid = uuid.UUID(company_id)
    accounts_result = await db.execute(
        select(BankAccount).where(
            BankAccount.company_id == cid, BankAccount.activo == True,
            BankAccount.saldo_minimo_alerta.isnot(None),
        )
    )
    accounts = list(accounts_result.scalars().all())

    creadas = 0
    system_run = None
    for a in accounts:
        if (a.saldo_actual or Decimal("0")) >= a.saldo_minimo_alerta:
            continue
        existing = await db.execute(
            select(FinanceRecommendation).where(
                FinanceRecommendation.company_id == cid,
                FinanceRecommendation.tipo == "saldo_bajo",
                FinanceRecommendation.entidad_relacionada == str(a.id),
                FinanceRecommendation.status == "pending",
            )
        )
        if existing.scalar_one_or_none():
            continue
        if system_run is None:
            system_run = await _get_or_create_bancos_system_run(db, company_id)
        rec = FinanceRecommendation(
            company_id=cid,
            run_id=system_run.id,
            tipo="saldo_bajo",
            titulo=f"Saldo bajo en {a.banco} ({a.numero_cuenta})",
            descripcion=(
                f"El saldo de la cuenta {a.banco} N° {a.numero_cuenta} es de "
                f"{a.saldo_actual:,.0f} {a.moneda}, por debajo del umbral configurado de "
                f"{a.saldo_minimo_alerta:,.0f} {a.moneda}."
            ),
            entidad_relacionada=str(a.id),
            monto_relacionado=f"{a.saldo_actual:,.0f} {a.moneda}",
        )
        db.add(rec)
        creadas += 1
    await db.flush()
    return creadas


# ── Blindaje de saldo bancario: verificación + corrección con doble aprobación
# (Bancos Fase 5 — endurece directamente el tipo de bug de saldo corrupto que
# se corrigió dos veces a mano en esta sesión) ─────────────────────────────────

BALANCE_TOLERANCE_ABS = Decimal("1000")     # Gs. 1.000 de piso, para no generar ruido en cuentas casi en cero
BALANCE_TOLERANCE_PCT = Decimal("0.001")    # 0.1% del saldo calculado


def _balance_tolerance(saldo_calculado: Decimal) -> Decimal:
    return max(BALANCE_TOLERANCE_ABS, abs(saldo_calculado) * BALANCE_TOLERANCE_PCT)


async def verify_bank_balance(db: AsyncSession, account_id: str, user_id: str) -> BankAccount | None:
    """Accion liviana: el usuario confirma que el saldo_actual de hoy fue
    contrastado contra el extracto real y es correcto. A partir de aca,
    sync_bank_balances ya no lo pisa a ciegas si el recalculo diverge --
    ver check_balance_divergence."""
    account = await get_bank_account(db, account_id)
    if not account:
        return None
    account.saldo_verificado_manualmente = True
    account.saldo_verificado_at = _now()
    account.saldo_verificado_por = uuid.UUID(user_id)
    await db.flush()

    from api.src.inteliaudit.service import record_audit_event
    await record_audit_event(db, {
        "company_id": str(account.company_id),
        "user_id": user_id,
        "accion": "verificar_saldo_bancario",
        "entidad": "bank_accounts",
        "entidad_id": str(account.id),
        "datos_nuevos": {"saldo_verificado": str(account.saldo_actual)},
    })

    await db.refresh(account)
    return account


async def check_balance_divergence(db: AsyncSession, account: BankAccount, saldo_calculado: Decimal) -> bool:
    """Llamado desde sync_bank_balances antes de sobrescribir saldo_actual.
    Si la cuenta tiene un saldo verificado a mano y el recalculo automatico
    diverge mas alla de la tolerancia, NO pisa el valor -- genera una
    solicitud de correccion (doble aprobacion) y una alerta visible, y
    devuelve True para que el caller se salte el overwrite de esta cuenta."""
    if not account.saldo_verificado_manualmente:
        return False

    saldo_actual = account.saldo_actual or Decimal("0")
    diff = abs(saldo_calculado - saldo_actual)
    if diff <= _balance_tolerance(saldo_calculado):
        return False

    existing = await db.execute(
        select(BankBalanceCorrectionRequest).where(
            BankBalanceCorrectionRequest.bank_account_id == account.id,
            BankBalanceCorrectionRequest.estado == "pendiente",
        )
    )
    if existing.scalar_one_or_none():
        return True  # ya hay una solicitud pendiente para esta cuenta, no duplicar

    request = BankBalanceCorrectionRequest(
        company_id=account.company_id,
        bank_account_id=account.id,
        origen="auto_divergencia",
        saldo_actual=saldo_actual,
        saldo_propuesto=saldo_calculado,
        motivo=(
            f"Divergencia automática detectada: el saldo verificado ({saldo_actual:,.0f} {account.moneda}) "
            f"difiere del recálculo por movimientos ({saldo_calculado:,.0f} {account.moneda}) "
            f"en {diff:,.0f} {account.moneda}."
        ),
        estado="pendiente",
    )
    db.add(request)
    await db.flush()

    from api.src.inteliaudit.service import record_audit_event
    await record_audit_event(db, {
        "company_id": str(account.company_id),
        "user_id": None,
        "accion": "divergencia_saldo_bancario_detectada",
        "entidad": "bank_accounts",
        "entidad_id": str(account.id),
        "datos_anteriores": {"saldo_actual": str(saldo_actual)},
        "datos_nuevos": {"saldo_calculado": str(saldo_calculado), "correction_request_id": str(request.id)},
    })

    from api.src.finance_agent.models import FinanceRecommendation
    system_run = await _get_or_create_bancos_system_run(db, str(account.company_id))
    db.add(FinanceRecommendation(
        company_id=account.company_id,
        run_id=system_run.id,
        tipo="divergencia_saldo",
        titulo=f"Divergencia de saldo en {account.banco} ({account.numero_cuenta})",
        descripcion=request.motivo + " Requiere aprobación de Supervisor y Gerente para corregir.",
        entidad_relacionada=str(account.id),
        monto_relacionado=f"{diff:,.0f} {account.moneda}",
    ))
    await db.flush()
    return True


async def request_balance_correction(db: AsyncSession, account_id: str, saldo_propuesto: Decimal, motivo: str, user_id: str) -> dict:
    """Correccion manual pedida por un usuario (no detectada por el sync) --
    mismo flujo de doble aprobacion que una divergencia automatica."""
    account = await get_bank_account(db, account_id)
    if not account:
        return {"error": "Cuenta no encontrada"}

    existing = await db.execute(
        select(BankBalanceCorrectionRequest).where(
            BankBalanceCorrectionRequest.bank_account_id == account.id,
            BankBalanceCorrectionRequest.estado == "pendiente",
        )
    )
    if existing.scalar_one_or_none():
        return {"error": "Ya hay una corrección pendiente de aprobación para esta cuenta"}

    request = BankBalanceCorrectionRequest(
        company_id=account.company_id,
        bank_account_id=account.id,
        origen="manual",
        saldo_actual=account.saldo_actual or Decimal("0"),
        saldo_propuesto=saldo_propuesto,
        motivo=motivo,
        estado="pendiente",
        solicitado_por=uuid.UUID(user_id),
    )
    db.add(request)
    await db.flush()
    await db.refresh(request)
    return {"success": True, "request": request}


async def list_balance_corrections(db: AsyncSession, company_id: str, estado: str | None = "pendiente") -> list[BankBalanceCorrectionRequest]:
    query = select(BankBalanceCorrectionRequest).where(BankBalanceCorrectionRequest.company_id == uuid.UUID(company_id))
    if estado:
        query = query.where(BankBalanceCorrectionRequest.estado == estado)
    query = query.order_by(BankBalanceCorrectionRequest.created_at.desc())
    result = await db.execute(query)
    return list(result.scalars().all())


async def _get_balance_correction(db: AsyncSession, request_id: str) -> BankBalanceCorrectionRequest | None:
    result = await db.execute(select(BankBalanceCorrectionRequest).where(BankBalanceCorrectionRequest.id == uuid.UUID(request_id)))
    return result.scalar_one_or_none()


async def approve_balance_correction(db: AsyncSession, request_id: str, user_id: str, tenant_id: str) -> dict:
    from api.src.rbac.service import get_user_roles

    request = await _get_balance_correction(db, request_id)
    if not request:
        return {"error": "Solicitud no encontrada"}
    if request.estado != "pendiente":
        return {"error": f"La solicitud ya está en estado '{request.estado}'"}

    roles = {r["role_name"] for r in await get_user_roles(db, uuid.UUID(user_id), uuid.UUID(tenant_id))}
    uid = uuid.UUID(user_id)
    # Un llamado llena UN solo slot, para que Supervisor+Gerente sean dos
    # personas reales. Bug real encontrado en verificacion: si el mismo
    # usuario tiene AMBOS roles (frecuente en cuentas de administrador), sin
    # el chequeo "!= la otra persona" ese usuario podia completar los dos
    # slots el solo con dos llamados seguidos, vaciando el control de dos
    # personas por completo.
    filled_now = None
    if "Supervisor" in roles and not request.aprobado_supervisor_id and request.aprobado_gerente_id != uid:
        request.aprobado_supervisor_id = uid
        request.aprobado_supervisor_at = _now()
        filled_now = "supervisor"
    elif "Gerente" in roles and not request.aprobado_gerente_id and request.aprobado_supervisor_id != uid:
        request.aprobado_gerente_id = uid
        request.aprobado_gerente_at = _now()
        filled_now = "gerente"

    if not filled_now:
        return {"error": "No autorizado: se requiere rol Supervisor o Gerente, y tiene que ser una persona distinta a quien ya aprobó"}

    await db.flush()

    completo = False
    if request.aprobado_supervisor_id and request.aprobado_gerente_id:
        request.estado = "aprobado"
        completo = True

        account = await get_bank_account(db, str(request.bank_account_id))
        account.saldo_actual = request.saldo_propuesto
        account.saldo_verificado_manualmente = True
        account.saldo_verificado_at = _now()
        account.saldo_verificado_por = uuid.UUID(user_id)
        db.add(account)

        from api.src.inteliaudit.service import record_audit_event
        await record_audit_event(db, {
            "company_id": str(request.company_id),
            "user_id": user_id,
            "accion": "corregir_saldo_bancario",
            "entidad": "bank_accounts",
            "entidad_id": str(account.id),
            "datos_anteriores": {"saldo_actual": str(request.saldo_actual)},
            "datos_nuevos": {"saldo_actual": str(request.saldo_propuesto), "correction_request_id": str(request.id)},
        })

        await db.flush()

    await db.refresh(request)
    return {"success": True, "request": request, "completo": completo}


async def reject_balance_correction(db: AsyncSession, request_id: str, user_id: str, tenant_id: str, motivo: str | None) -> dict:
    from api.src.rbac.service import get_user_roles

    request = await _get_balance_correction(db, request_id)
    if not request:
        return {"error": "Solicitud no encontrada"}
    if request.estado != "pendiente":
        return {"error": f"La solicitud ya está en estado '{request.estado}'"}

    roles = {r["role_name"] for r in await get_user_roles(db, uuid.UUID(user_id), uuid.UUID(tenant_id))}
    if "Supervisor" not in roles and "Gerente" not in roles:
        return {"error": "No autorizado: se requiere rol Supervisor o Gerente"}

    request.estado = "rechazado"
    request.rechazado_por = uuid.UUID(user_id)
    request.rechazado_at = _now()
    request.rechazado_motivo = motivo
    await db.flush()
    await db.refresh(request)
    return {"success": True, "request": request}


# ── Cash Flow ──────────────────────────────────────────────────────────────────

async def _compute_daily_cash_flow(db: AsyncSession, company_id: str, dias: int) -> list[dict]:
    """Calculo puro dia a dia (sin persistir nada) -- saldo bancario actual
    + cobros reales de AR menos pagos reales de AP por fecha de vencimiento.
    Reutilizado tanto por generate_projection (que sí persiste en
    CashFlowProjection) como por el dashboard (que solo necesita el numero
    del dia 7 y el dia 30, en vivo, sin depender de que alguien haya
    apretado 'Generar proyección' antes)."""
    cid = uuid.UUID(company_id)
    today = _today()

    accounts_result = await db.execute(
        select(func.coalesce(func.sum(BankAccount.saldo_actual), 0)).where(
            BankAccount.company_id == cid, BankAccount.activo == True, BankAccount.moneda == "PYG",
        )
    )
    # Solo cuentas en PYG -- sumar junto con la cuenta en BRL daria un
    # numero sin sentido (mezcla de unidades). Ver get_cash_position para
    # el equivalente con conversion real cuando hace falta el detalle.
    saldo_bancario = Decimal(str(accounts_result.scalar() or "0"))

    # SupplierInvoice.estado real: solo 'pendiente'/'cancelada'/'pagada'
    # existen ('aprobada'/'parcial' nunca fueron valores reales).
    ap_result = await db.execute(
        select(SupplierInvoice).where(
            SupplierInvoice.company_id == cid,
            SupplierInvoice.estado == "pendiente",
        )
    )
    ap_invoices = list(ap_result.scalars().all())
    ap_due = {}
    for inv in ap_invoices:
        fv = inv.fecha_vencimiento
        if fv not in ap_due:
            ap_due[fv] = Decimal("0")
        ap_due[fv] += inv.saldo_pendiente or Decimal("0")

    # Ingresos: antes esta funcion consultaba SupplierInvoice (lo que
    # debemos) para proyectar ingresos (lo que nos deben) -- copiado y
    # pegado del bloque de arriba -- y el resultado ni siquiera se usaba,
    # asi que ingresos quedaba fijo en 0 y la proyeccion mostraba el saldo
    # bancario vaciandose sin ningun cobro entrando, siempre. El modelo ORM
    # de accounts_receivable (clase Account) esta desalineado con la tabla
    # real (le faltan fecha_vencimiento/saldo_pendiente/estado reales), asi
    # que se consulta la tabla real directo por SQL, igual que ya hace
    # integrated_finance con esta misma tabla.
    ar_rows = await db.execute(
        text("""
            SELECT fecha_vencimiento, COALESCE(SUM(saldo_pendiente), 0) as total
            FROM accounts_receivable
            WHERE company_id = :cid AND estado = 'pendiente'
            GROUP BY fecha_vencimiento
        """),
        {"cid": company_id},
    )
    ar_due = {row.fecha_vencimiento: Decimal(str(row.total)) for row in ar_rows}

    dias_calc = []
    running_balance = saldo_bancario
    for i in range(dias):
        day = today + timedelta(days=i)
        ingresos = ar_due.get(day, Decimal("0"))
        egresos = ap_due.get(day, Decimal("0"))
        projected = running_balance + ingresos - egresos
        dias_calc.append({
            "fecha": day, "saldo_inicial": running_balance,
            "ingresos_estimados": ingresos, "egresos_estimados": egresos,
            "saldo_final_proyectado": projected,
        })
        running_balance = projected

    return dias_calc


# ── Alerta de flujo de caja negativo (WhatsApp) ──────────────────────────
#
# Reusa _compute_daily_cash_flow (ya construido para el Flujo de Caja de
# AP y para el reporte PDF) y send_message_to_phone (mismo motor que el
# dunning de Cuentas por Cobrar). Apagado por defecto, igual que el
# dunning -- es una notificacion al telefono de la empresa, no algo para
# activar sin que el cliente lo pida.

_CASHFLOW_ALERT_CONFIG_KEY = "alerta_flujo_caja"
_CASHFLOW_ALERT_CONFIG_DEFAULT = {"activo": False, "dias_horizonte": 30, "telefono": None}


async def get_cash_flow_alert_config(db: AsyncSession, company_id: str) -> CashFlowAlertConfig:
    result = await db.execute(text("SELECT config FROM companies WHERE id = :cid"), {"cid": company_id})
    row = result.fetchone()
    config = (row.config or {}) if row else {}
    stored = config.get(_CASHFLOW_ALERT_CONFIG_KEY, {}) if isinstance(config, dict) else {}
    merged = {**_CASHFLOW_ALERT_CONFIG_DEFAULT, **stored}
    return CashFlowAlertConfig(**merged)


async def update_cash_flow_alert_config(db: AsyncSession, company_id: str, data: CashFlowAlertConfig) -> CashFlowAlertConfig:
    result = await db.execute(text("SELECT config FROM companies WHERE id = :cid"), {"cid": company_id})
    row = result.fetchone()
    config = dict(row.config or {}) if row and row.config else {}
    config[_CASHFLOW_ALERT_CONFIG_KEY] = data.model_dump()
    await db.execute(text("UPDATE companies SET config = :config WHERE id = :cid"), {"config": json.dumps(config), "cid": company_id})
    await db.commit()
    return data


async def check_negative_cash_flow_alert(db: AsyncSession, company_id: str) -> dict:
    """Chequea la proyeccion de flujo de caja y, si algun dia del horizonte
    da negativo, manda un WhatsApp al telefono configurado -- como maximo
    una vez por dia (dedup via FinanceRecommendation tipo='flujo_caja_negativo'
    creada hoy), para no repetir el mismo aviso en cada corrida del scheduler."""
    from api.src.whatsapp.service import send_message_to_phone
    from api.src.companies.models import Company
    from api.src.finance_agent.models import FinanceAgentRun, FinanceRecommendation

    config = await get_cash_flow_alert_config(db, company_id)
    if not config.activo:
        return {"alertado": False, "motivo": "desactivado"}

    dias_calc = await _compute_daily_cash_flow(db, company_id, config.dias_horizonte)
    negativos = [d for d in dias_calc if d["saldo_final_proyectado"] < 0]
    if not negativos:
        return {"alertado": False, "motivo": "sin proyeccion negativa"}
    primer_negativo = negativos[0]

    hoy = _today()
    existing = await db.execute(
        text("""
            SELECT id FROM finance_recommendations
            WHERE company_id = :cid AND tipo = 'flujo_caja_negativo' AND created_at::date = :hoy
        """),
        {"cid": company_id, "hoy": hoy},
    )
    if existing.first():
        return {"alertado": False, "motivo": "ya alertado hoy"}

    company_result = await db.execute(select(Company).where(Company.id == uuid.UUID(company_id)))
    company = company_result.scalar_one_or_none()
    telefono = config.telefono or (company.telefono if company else None)
    if not telefono:
        return {"alertado": False, "motivo": "sin telefono configurado"}

    empresa_nombre = (company.nombre_fantasia or company.razon_social) if company else ""
    mensaje = (
        f"⚠️ Alerta de flujo de caja — {empresa_nombre}\n"
        f"Proyección de saldo negativo a partir del {primer_negativo['fecha'].strftime('%d/%m/%Y')}: "
        f"{primer_negativo['saldo_final_proyectado']:,.0f} Gs.\n"
        f"Revisá Cuentas por Pagar → Flujo de Caja para el detalle."
    )
    enviado = await send_message_to_phone(db, company_id, telefono, mensaje)

    run_result = await db.execute(
        select(FinanceAgentRun).where(FinanceAgentRun.company_id == company_id, FinanceAgentRun.model == "system")
    )
    run = run_result.scalar_one_or_none()
    if not run:
        run = FinanceAgentRun(company_id=company_id, model="system", status="completed", diagnostico="Controles automáticos del sistema (arqueo de caja, depósitos bancarios, flujo de caja)")
        db.add(run)
        await db.flush()

    db.add(FinanceRecommendation(
        company_id=company_id,
        run_id=run.id,
        tipo="flujo_caja_negativo",
        titulo=f"Proyección de saldo negativo desde el {primer_negativo['fecha'].strftime('%d/%m/%Y')}",
        descripcion=f"El flujo de caja proyectado a {config.dias_horizonte} días da negativo desde el {primer_negativo['fecha'].strftime('%d/%m/%Y')} ({primer_negativo['saldo_final_proyectado']:,.0f} Gs.). {'Se notificó por WhatsApp.' if enviado else 'No se pudo notificar por WhatsApp (revisar configuración).'}",
        monto_relacionado=f"{primer_negativo['saldo_final_proyectado']:,.0f} PYG",
    ))
    await db.commit()
    return {"alertado": True, "whatsapp_enviado": enviado, "fecha_negativa": primer_negativo["fecha"].isoformat()}


async def generate_projection(db: AsyncSession, company_id: str, dias: int = 90) -> list[CashFlowProjection]:
    cid = uuid.UUID(company_id)
    dias_calc = await _compute_daily_cash_flow(db, company_id, dias)

    projections = []
    for d in dias_calc:
        existing = await db.execute(
            select(CashFlowProjection).where(
                CashFlowProjection.company_id == cid,
                CashFlowProjection.fecha == d["fecha"],
                CashFlowProjection.fuente == "automatico",
            )
        )
        existing_proj = existing.scalar_one_or_none()

        if existing_proj:
            existing_proj.saldo_inicial = d["saldo_inicial"]
            existing_proj.ingresos_estimados = d["ingresos_estimados"]
            existing_proj.egresos_estimados = d["egresos_estimados"]
            existing_proj.saldo_final_proyectado = d["saldo_final_proyectado"]
            proj = existing_proj
        else:
            proj = CashFlowProjection(
                company_id=cid,
                fecha=d["fecha"],
                saldo_inicial=d["saldo_inicial"],
                ingresos_estimados=d["ingresos_estimados"],
                egresos_estimados=d["egresos_estimados"],
                saldo_final_proyectado=d["saldo_final_proyectado"],
                fuente="automatico",
            )
            db.add(proj)

        projections.append(proj)

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
            BankAccount.company_id == cid, BankAccount.activo == True, BankAccount.moneda == "PYG",
        )
    )
    # Solo cuentas en PYG -- sumar junto con la cuenta en BRL daria un
    # numero sin sentido (mezcla de unidades). Ver get_cash_position para
    # el equivalente con conversion real cuando hace falta el detalle.
    saldo_bancario = Decimal(str(accounts_result.scalar() or "0"))

    proj_result = await db.execute(
        select(CashFlowProjection).where(
            CashFlowProjection.company_id == cid,
            CashFlowProjection.fecha >= today,
        ).order_by(CashFlowProjection.fecha.asc()).limit(30)
    )
    projections = list(proj_result.scalars().all())

    hoy = next((p for p in projections if p.fecha == today), None)
    ingresos_hoy = hoy.ingresos_estimados if hoy else Decimal("0")
    egresos_hoy = hoy.egresos_estimados if hoy else Decimal("0")

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

    if len(projections) > 6:
        saldo_7d = projections[6].saldo_final_proyectado
        saldo_30d = projections[-1].saldo_final_proyectado if projections else saldo_bancario
    else:
        # Nadie generó una proyección persistida todavía (tabla vacía) --
        # en vez de repetir el saldo de hoy con la etiqueta de "proyección",
        # se calcula en vivo con cobros/pagos reales de AR/AP por vencer.
        dias_calc = await _compute_daily_cash_flow(db, company_id, 30)
        saldo_7d = dias_calc[6]["saldo_final_proyectado"] if len(dias_calc) > 6 else saldo_bancario
        saldo_30d = dias_calc[-1]["saldo_final_proyectado"] if dias_calc else saldo_bancario

    return {
        "saldo_bancario": saldo_bancario,
        "ingresos_hoy": ingresos_hoy,
        "egresos_hoy": egresos_hoy,
        "saldo_proyectado_7d": saldo_7d,
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

async def get_payable_invoices(db: AsyncSession, company_id: str, supplier_id: str | None = None, hasta: date | None = None) -> list[dict]:
    """Candidatas para armar un lote de pago a mano (Cuentas por Pagar Fase
    2) -- no crea nada, solo lista. Reemplaza la auto-seleccion ciega que
    tenia create_payment_run (agarraba TODAS las vencidas de una, sin que
    nadie eligiera nada)."""
    query = select(SupplierInvoice).where(
        SupplierInvoice.company_id == uuid.UUID(company_id),
        SupplierInvoice.estado.in_(["pendiente", "aprobada", "parcial"]),
        or_(
            SupplierInvoice.bloqueada_para_pago == False,
            SupplierInvoice.bloqueada_para_pago.is_(None),
        ),
        SupplierInvoice.saldo_pendiente > 0,
    )
    if supplier_id:
        query = query.where(SupplierInvoice.supplier_id == uuid.UUID(supplier_id))
    if hasta:
        query = query.where(SupplierInvoice.fecha_vencimiento <= hasta)
    query = query.order_by(SupplierInvoice.fecha_vencimiento.asc())
    result = await db.execute(query)
    invoices = list(result.scalars().all())

    supplier_ids = {i.supplier_id for i in invoices}
    sup_map = {}
    if supplier_ids:
        sup_result = await db.execute(select(Supplier).where(Supplier.id.in_(supplier_ids)))
        sup_map = {s.id: s.razon_social for s in sup_result.scalars().all()}

    today = _today()
    return [
        {
            "id": str(i.id),
            "numero_factura": i.numero_factura,
            "timbrado": i.timbrado,
            "supplier_id": str(i.supplier_id),
            "supplier_nombre": sup_map.get(i.supplier_id, "Desconocido"),
            "fecha_emision": i.fecha_emision.isoformat() if i.fecha_emision else None,
            "fecha_vencimiento": i.fecha_vencimiento.isoformat(),
            "total": float(i.total) if i.total is not None else 0,
            "saldo_pendiente": float(i.saldo_pendiente) if i.saldo_pendiente is not None else 0,
            "moneda": i.moneda,
            "tipo_cambio": float(i.tipo_cambio) if i.tipo_cambio is not None else 1,
            "total_brl": float(i.total_brl) if i.total_brl is not None else None,
            "saldo_pendiente_brl": float(i.saldo_pendiente_brl) if i.saldo_pendiente_brl is not None else None,
            "dias_vencido": (today - i.fecha_vencimiento).days if i.fecha_vencimiento < today else 0,
        }
        for i in invoices
    ]


async def create_payment_run(db: AsyncSession, data: PaymentRunCreate) -> PaymentRun | dict:
    """Crea un lote de pago SOLO con las facturas que el usuario eligio a
    mano (data.invoice_ids) y que estén en estado pendiente/aprobada/parcial y NO bloqueadas
    por falta de Nota de Crédito o discrepancias en muelle."""
    invoices_result = await db.execute(
        select(SupplierInvoice).where(
            SupplierInvoice.id.in_(data.invoice_ids),
            SupplierInvoice.company_id == data.company_id,
            SupplierInvoice.estado.in_(["pendiente", "aprobada", "parcial"]),
            or_(
                SupplierInvoice.bloqueada_para_pago == False,
                SupplierInvoice.bloqueada_para_pago.is_(None),
            ),
            SupplierInvoice.saldo_pendiente > 0,
        )
    )
    invoices = list(invoices_result.scalars().all())
    if not invoices:
        return {"error": "Ninguna de las facturas seleccionadas es válida para pago (deben tener saldo pendiente y sin retenciones pendientes)."}


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


async def get_payment_run_with_items(db: AsyncSession, run_id: str) -> dict | None:
    """Devuelve un dict plano (no el objeto ORM con .items reasignado) --
    PaymentRun.items es una relationship() de SQLAlchemy de verdad, y
    pisarla a mano (run.items = [...]) dispara su maquinaria de tracking de
    coleccion, que intenta un lazy-load fuera del contexto async/greenlet
    de FastAPI al serializar la respuesta ("greenlet_spawn has not been
    called"). Construir el dict a mano lo evita del todo."""
    result = await db.execute(select(PaymentRun).where(PaymentRun.id == uuid.UUID(run_id)))
    run = result.scalar_one_or_none()
    if not run:
        return None

    items_result = await db.execute(
        select(PaymentRunItem).where(PaymentRunItem.payment_run_id == uuid.UUID(run_id))
    )
    items = list(items_result.scalars().all())

    numero_map, sup_map = {}, {}
    if items:
        inv_result = await db.execute(
            select(SupplierInvoice.id, SupplierInvoice.numero_factura).where(
                SupplierInvoice.id.in_({i.invoice_id for i in items})
            )
        )
        numero_map = {row.id: row.numero_factura for row in inv_result.all()}

        sup_result = await db.execute(
            select(Supplier.id, Supplier.razon_social).where(
                Supplier.id.in_({i.supplier_id for i in items})
            )
        )
        sup_map = {row.id: row.razon_social for row in sup_result.all()}

    return {
        "id": run.id, "company_id": run.company_id, "nombre": run.nombre,
        "fecha_programada": run.fecha_programada, "total_monto": run.total_monto,
        "estado": run.estado, "metodo_pago": run.metodo_pago, "bank_account_id": run.bank_account_id,
        "created_by": run.created_by, "approved_by": run.approved_by,
        "created_at": run.created_at, "updated_at": run.updated_at,
        "items": [
            {
                "id": i.id, "payment_run_id": i.payment_run_id, "invoice_id": i.invoice_id,
                "supplier_id": i.supplier_id, "supplier_nombre": sup_map.get(i.supplier_id),
                "numero_factura": numero_map.get(i.invoice_id),
                "monto_programado": i.monto_programado, "monto_pagado": i.monto_pagado,
                "estado": i.estado, "created_at": i.created_at,
            }
            for i in items
        ],
    }


# ── Consolidated Dashboard ─────────────────────────────────────────────────────

async def get_financial_dashboard(db: AsyncSession, company_id: str) -> dict:
    ap = await get_ap_dashboard(db, company_id)
    cash_flow = await get_cash_flow_dashboard(db, company_id)

    from sqlalchemy import text as _text
    ar_result = await db.execute(
        _text("""
            SELECT COALESCE(SUM(saldo_pendiente), 0) FROM accounts_receivable
            WHERE company_id = :company_id AND estado = 'pendiente'
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

    from sqlalchemy import text as _text
    ar_total = await db.execute(
        _text("""
            SELECT COALESCE(SUM(saldo_pendiente), 0) FROM accounts_receivable
            WHERE company_id = :company_id AND estado = 'pendiente'
        """),
        {"company_id": str(cid)},
    )
    ar_val = Decimal(str(ar_total.scalar() or "0"))

    bank_result = await db.execute(
        select(func.coalesce(func.sum(BankAccount.saldo_actual), 0)).where(
            BankAccount.company_id == cid, BankAccount.activo == True, BankAccount.moneda == "PYG",
        )
    )
    # Solo PYG -- ver nota en get_cash_flow_dashboard.
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


_CREDIT_NOTE_UPLOAD_DIR = Path(__file__).resolve().parents[3] / "uploads" / "credit_notes"
_CREDIT_NOTE_ALLOWED_EXTS = {".pdf", ".jpg", ".jpeg", ".png", ".webp"}
_CREDIT_NOTE_MAX_SIZE = 15 * 1024 * 1024  # 15MB


def save_credit_note_attachment(content: bytes, filename: str) -> str:
    ext = Path(filename).suffix.lower()
    if ext not in _CREDIT_NOTE_ALLOWED_EXTS:
        raise ValueError(f"Extensión no permitida: '{ext}'. Se aceptan PDF e imágenes (.pdf, .jpg, .png, .webp)")
    if len(content) > _CREDIT_NOTE_MAX_SIZE:
        raise ValueError("El archivo supera el tamaño máximo permitido (15MB)")
    if len(content) == 0:
        raise ValueError("El archivo está vacío")

    _CREDIT_NOTE_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    unique_name = f"nc_{uuid.uuid4()}{ext}"
    (_CREDIT_NOTE_UPLOAD_DIR / unique_name).write_bytes(content)
    return f"/uploads/credit_notes/{unique_name}"


async def list_supplier_credit_notes(db: AsyncSession, company_id: str, supplier_id: str | None = None, limit: int = 100) -> list[dict]:
    cid = uuid.UUID(company_id)
    query = select(SupplierCreditNote, Supplier.razon_social).join(
        Supplier, Supplier.id == SupplierCreditNote.supplier_id, isouter=True
    ).where(SupplierCreditNote.company_id == cid, SupplierCreditNote.cancelado == False)
    if supplier_id:
        query = query.where(SupplierCreditNote.supplier_id == uuid.UUID(supplier_id))
    query = query.order_by(SupplierCreditNote.fecha.desc()).limit(limit)
    result = await db.execute(query)
    return [
        {
            "id": str(note.id),
            "supplier_id": str(note.supplier_id),
            "supplier_nombre": razon_social,
            "numero": note.numero,
            "numero_factura_origen": note.numero_factura_origen,
            "timbrado": note.timbrado,
            "fecha": note.fecha.isoformat(),
            "motivo": note.motivo,
            "motivo_categoria": note.motivo_categoria or "devolucion_rotura",
            "impacto_contable": note.impacto_contable or "otros_ingresos",
            "archivo_adjunto_path": note.archivo_adjunto_path,
            "monto": float(note.monto),
            "saldo_disponible": float(note.saldo_disponible if note.saldo_disponible is not None else note.monto),
            "moneda": note.moneda,
            "observaciones": note.observaciones,
        }
        for note, razon_social in result.all()
    ]


async def create_supplier_credit_note(db: AsyncSession, company_id: str, data: SupplierCreditNoteCreate) -> dict:
    cid = uuid.UUID(company_id)
    sid = uuid.UUID(data.supplier_id)
    
    # Verificar proveedor
    res_sup = await db.execute(select(Supplier).where(Supplier.id == sid, Supplier.company_id == cid))
    supplier = res_sup.scalar_one_or_none()
    if not supplier:
        raise ValueError("Proveedor no encontrado o no pertenece a la empresa")

    monto_dec = Decimal(str(data.monto))
    if monto_dec <= 0:
        raise ValueError("El monto de la Nota de Crédito debe ser mayor a 0")

    note = SupplierCreditNote(
        company_id=cid,
        supplier_id=sid,
        numero=data.numero.strip(),
        numero_factura_origen=data.numero_factura_origen.strip() if data.numero_factura_origen else None,
        timbrado=data.timbrado.strip() if data.timbrado else None,
        fecha=data.fecha,
        motivo=data.motivo.strip(),
        motivo_categoria=data.motivo_categoria or "devolucion_rotura",
        impacto_contable=data.impacto_contable or "otros_ingresos",
        archivo_adjunto_path=data.archivo_adjunto_path,
        monto=monto_dec,
        saldo_disponible=monto_dec,
        moneda=data.moneda or "PYG",
        observaciones=data.observaciones,
        cancelado=False,
    )
    db.add(note)
    await db.commit()
    await db.refresh(note)

    return {
        "id": str(note.id),
        "supplier_id": str(note.supplier_id),
        "supplier_nombre": supplier.razon_social,
        "numero": note.numero,
        "numero_factura_origen": note.numero_factura_origen,
        "timbrado": note.timbrado,
        "fecha": note.fecha.isoformat(),
        "motivo": note.motivo,
        "motivo_categoria": note.motivo_categoria,
        "impacto_contable": note.impacto_contable,
        "archivo_adjunto_path": note.archivo_adjunto_path,
        "monto": float(note.monto),
        "saldo_disponible": float(note.saldo_disponible),
        "moneda": note.moneda,
        "observaciones": note.observaciones,
    }


async def apply_supplier_credit_note(db: AsyncSession, company_id: str, credit_note_id: str, data: SupplierCreditNoteApply) -> dict:
    cid = uuid.UUID(company_id)
    cn_id = uuid.UUID(credit_note_id)
    inv_id = uuid.UUID(data.invoice_id)
    monto_aplicar = Decimal(str(data.monto))

    if monto_aplicar <= 0:
        raise ValueError("El monto a aplicar debe ser mayor a 0")

    # Obtener Nota de Credito
    res_cn = await db.execute(select(SupplierCreditNote).where(SupplierCreditNote.id == cn_id, SupplierCreditNote.company_id == cid))
    credit_note = res_cn.scalar_one_or_none()
    if not credit_note:
        raise ValueError("Nota de Crédito no encontrada")
    if credit_note.cancelado:
        raise ValueError("La Nota de Crédito está cancelada")

    saldo_nc = Decimal(str(credit_note.saldo_disponible if credit_note.saldo_disponible is not None else credit_note.monto))
    if monto_aplicar > saldo_nc:
        raise ValueError(f"El monto a aplicar ({monto_aplicar:,.0f}) supera el saldo disponible de la Nota de Crédito ({saldo_nc:,.0f})")

    # Obtener Factura
    res_inv = await db.execute(select(SupplierInvoice).where(SupplierInvoice.id == inv_id, SupplierInvoice.company_id == cid))
    invoice = res_inv.scalar_one_or_none()
    if not invoice:
        raise ValueError("Factura de proveedor no encontrada")

    saldo_factura = Decimal(str(invoice.saldo_pendiente or 0))
    if saldo_factura <= 0:
        raise ValueError("La factura seleccionada ya no tiene saldo pendiente")
    if monto_aplicar > saldo_factura:
        raise ValueError(f"El monto a aplicar ({monto_aplicar:,.0f}) supera el saldo pendiente de la Factura ({saldo_factura:,.0f})")

    # Actualizar saldos
    nuevo_saldo_nc = saldo_nc - monto_aplicar
    nuevo_saldo_inv = saldo_factura - monto_aplicar

    credit_note.saldo_disponible = nuevo_saldo_nc
    invoice.saldo_pendiente = nuevo_saldo_inv
    if nuevo_saldo_inv <= 0:
        invoice.estado = "pagado"
    else:
        invoice.estado = "parcial"

    # Registrar aplicacion
    app_record = SupplierCreditNoteApplication(
        company_id=cid,
        credit_note_id=cn_id,
        invoice_id=inv_id,
        monto_aplicado=monto_aplicar,
        observaciones=data.observaciones,
    )
    db.add(app_record)

    await db.commit()
    await db.refresh(credit_note)
    await db.refresh(invoice)

    return {
        "success": True,
        "application_id": str(app_record.id),
        "credit_note_id": str(credit_note.id),
        "saldo_disponible_nc": float(nuevo_saldo_nc),
        "invoice_id": str(invoice.id),
        "numero_factura": invoice.numero_factura,
        "saldo_pendiente_factura": float(nuevo_saldo_inv),
        "estado_factura": invoice.estado,
    }


async def list_credit_note_applications(db: AsyncSession, company_id: str, credit_note_id: str | None = None) -> list[dict]:
    cid = uuid.UUID(company_id)
    query = (
        select(
            SupplierCreditNoteApplication,
            SupplierCreditNote.numero.label("numero_nc"),
            SupplierInvoice.numero_factura,
            Supplier.razon_social.label("supplier_nombre"),
        )
        .join(SupplierCreditNote, SupplierCreditNote.id == SupplierCreditNoteApplication.credit_note_id)
        .join(SupplierInvoice, SupplierInvoice.id == SupplierCreditNoteApplication.invoice_id)
        .join(Supplier, Supplier.id == SupplierCreditNote.supplier_id, isouter=True)
        .where(SupplierCreditNoteApplication.company_id == cid)
    )
    if credit_note_id:
        query = query.where(SupplierCreditNoteApplication.credit_note_id == uuid.UUID(credit_note_id))
    query = query.order_by(SupplierCreditNoteApplication.created_at.desc())
    result = await db.execute(query)

    return [
        {
            "id": str(app.id),
            "credit_note_id": str(app.credit_note_id),
            "numero_nc": num_nc,
            "invoice_id": str(app.invoice_id),
            "numero_factura": num_fac,
            "supplier_nombre": sup_nom,
            "monto_aplicado": float(app.monto_aplicado),
            "fecha": app.fecha.isoformat() if app.fecha else None,
            "observaciones": app.observaciones,
        }
        for app, num_nc, num_fac, sup_nom in result.all()
    ]


async def list_supplier_returns(db: AsyncSession, company_id: str, supplier_id: str | None = None, limit: int = 100) -> list[dict]:
    cid = uuid.UUID(company_id)
    query = select(SupplierReturn, Supplier.razon_social).join(
        Supplier, Supplier.id == SupplierReturn.supplier_id, isouter=True
    ).where(SupplierReturn.company_id == cid)
    if supplier_id:
        query = query.where(SupplierReturn.supplier_id == uuid.UUID(supplier_id))
    query = query.order_by(SupplierReturn.fecha.desc()).limit(limit)
    result = await db.execute(query)
    return [
        {
            "id": str(r.id),
            "supplier_id": str(r.supplier_id),
            "supplier_nombre": razon_social,
            "numero_factura_origen": r.numero_factura_origen,
            "numero_nota_credito": r.numero_nota_credito,
            "fecha": r.fecha.isoformat(),
            "monto": float(r.monto),
            "moneda": r.moneda,
            "observaciones": r.observaciones,
        }
        for r, razon_social in result.all()
    ]


async def get_payroll_by_concepto(db: AsyncSession, company_id: str, fecha_desde: date | None = None, fecha_hasta: date | None = None) -> list[dict]:
    cid = uuid.UUID(company_id)
    query = select(
        PayrollMovement.concepto,
        PayrollMovement.es_credito,
        func.count().label("cantidad"),
        func.sum(PayrollMovement.monto).label("monto"),
    ).where(PayrollMovement.company_id == cid)
    if fecha_desde:
        query = query.where(PayrollMovement.fecha >= fecha_desde)
    if fecha_hasta:
        query = query.where(PayrollMovement.fecha <= fecha_hasta)
    query = query.group_by(PayrollMovement.concepto, PayrollMovement.es_credito).order_by(func.sum(PayrollMovement.monto).desc())
    result = await db.execute(query)
    rows = result.all()
    total_creditos = float(sum(r.monto for r in rows if r.es_credito)) or 1
    return [
        {
            "concepto": r.concepto,
            "es_credito": r.es_credito,
            "cantidad": r.cantidad,
            "monto": float(r.monto),
            "porcentaje": round((float(r.monto) / total_creditos) * 100, 1) if r.es_credito else None,
        }
        for r in rows
    ]


async def list_payroll_movements(db: AsyncSession, company_id: str, empleado_nombre: str | None = None, limit: int = 200) -> list[dict]:
    cid = uuid.UUID(company_id)
    query = select(PayrollMovement).where(PayrollMovement.company_id == cid)
    if empleado_nombre:
        query = query.where(PayrollMovement.empleado_nombre.ilike(f"%{empleado_nombre}%"))
    query = query.order_by(PayrollMovement.fecha.desc()).limit(limit)
    result = await db.execute(query)
    return [
        {
            "id": str(m.id),
            "empleado_nombre": m.empleado_nombre,
            "concepto": m.concepto,
            "es_credito": m.es_credito,
            "monto": float(m.monto),
            "fecha": m.fecha.isoformat(),
            "cerrado": m.cerrado,
            "observaciones": m.observaciones,
        }
        for m in result.scalars().all()
    ]


# ── Órdenes de Pago a Proveedores (AP Multifactura & Multimedio) ─────────────

async def _generate_order_number(db: AsyncSession, company_id: uuid.UUID, offset: int = 0) -> str:
    """Genera número correlativo de Orden de Pago con formato OP-YYYYMMDD-XXXX."""
    py_tz = ZoneInfo("America/Asuncion")
    today_str = datetime.now(py_tz).strftime("%Y%m%d")
    prefix = f"OP-{today_str}-"
    q = (
        select(func.count(SupplierPaymentOrder.id))
        .where(
            SupplierPaymentOrder.company_id == company_id,
            SupplierPaymentOrder.numero_orden.like(f"{prefix}%")
        )
    )
    count = (await db.execute(q)).scalar_one() or 0
    return f"{prefix}{count + 1 + offset:04d}"


async def create_supplier_payment_order(
    db: AsyncSession,
    company_id: str,
    data: SupplierPaymentOrderCreate,
    user_id: str | None = None
) -> dict:
    """Crea una Orden de Pago a Proveedor (AP).
    Permite amortizar una o varias facturas del mismo proveedor.
    Si se incluyen disbursements, se liquida de inmediato en el mismo acto;
    si no, queda en estado 'registrado' para su posterior asignación de medios de pago.
    """
    cid = uuid.UUID(company_id)
    sup_id = data.supplier_id

    # 1. Validar Proveedor
    sup_res = await db.execute(select(Supplier).where(Supplier.id == sup_id, Supplier.company_id == cid))
    supplier = sup_res.scalar_one_or_none()
    if not supplier:
        raise HTTPException(status_code=404, detail="Proveedor no encontrado en esta empresa.")

    if not data.allocations:
        raise HTTPException(status_code=400, detail="Debe incluir al menos una factura a pagar en la orden.")

    # 2. Validar Facturas
    inv_ids = [a.invoice_id for a in data.allocations]
    invoices_res = await db.execute(
        select(SupplierInvoice).where(
            SupplierInvoice.id.in_(inv_ids),
            SupplierInvoice.company_id == cid,
            SupplierInvoice.supplier_id == sup_id
        )
    )
    invoices_by_id = {inv.id: inv for inv in invoices_res.scalars().all()}

    if len(invoices_by_id) != len(inv_ids):
        raise HTTPException(
            status_code=400,
            detail="Una o más facturas seleccionadas no pertenecen a este proveedor o no existen."
        )

    monto_total = Decimal("0")
    monto_retenido = Decimal("0")
    allocations_to_create = []

    for alloc_in in data.allocations:
        inv = invoices_by_id[alloc_in.invoice_id]
        if inv.estado in ("pagada", "cancelada"):
            raise HTTPException(
                status_code=400,
                detail=f"La factura {inv.numero_factura} ya se encuentra {inv.estado}."
            )

        aplicado = alloc_in.monto_aplicado
        retencion = alloc_in.monto_retencion or Decimal("0")
        total_amortizar = aplicado + retencion

        if total_amortizar > inv.saldo_pendiente:
            raise HTTPException(
                status_code=400,
                detail=f"El monto a amortizar (₲ {total_amortizar:,.0f}) supera el saldo pendiente (₲ {inv.saldo_pendiente:,.0f}) de la factura {inv.numero_factura}."
            )

        saldo_anterior = inv.saldo_pendiente
        saldo_restante = saldo_anterior - total_amortizar

        monto_total += aplicado
        monto_retenido += retencion

        allocations_to_create.append({
            "invoice": inv,
            "monto_aplicado": aplicado,
            "monto_retencion": retencion,
            "saldo_anterior": saldo_anterior,
            "saldo_restante": saldo_restante,
        })

    monto_neto = monto_total - monto_retenido
    if monto_neto < Decimal("0"):
        raise HTTPException(status_code=400, detail="El monto retenido no puede superar el monto total.")

    # 3. Crear Orden de Pago
    num_orden = await _generate_order_number(db, cid)
    order = SupplierPaymentOrder(
        company_id=cid,
        supplier_id=sup_id,
        numero_orden=num_orden,
        fecha_emision=data.fecha_emision or _today(),
        estado="registrado",
        moneda="PYG",
        monto_total=monto_total,
        monto_retenido=monto_retenido,
        monto_neto=monto_neto,
        observaciones=data.observaciones,
        recibo_proveedor=data.recibo_proveedor,
        created_by=uuid.UUID(user_id) if user_id else None,
    )
    db.add(order)
    await db.flush()

    # 4. Crear Allocations
    for item in allocations_to_create:
        db.add(SupplierPaymentOrderAllocation(
            payment_order_id=order.id,
            invoice_id=item["invoice"].id,
            monto_aplicado=item["monto_aplicado"],
            monto_retencion=item["monto_retencion"],
            saldo_anterior=item["saldo_anterior"],
            saldo_restante=item["saldo_restante"],
        ))

    await db.flush()

    # 5. Si vinieron medios de pago, liquidar de inmediato
    if data.disbursements and len(data.disbursements) > 0:
        disburse_payload = SupplierPaymentOrderDisburse(
            fecha_pago=data.fecha_emision or _today(),
            recibo_proveedor=data.recibo_proveedor,
            observaciones=data.observaciones,
            disbursements=data.disbursements,
        )
        await _execute_disbursements_internal(
            db=db,
            order=order,
            supplier=supplier,
            payload=disburse_payload,
            user_id=user_id,
            user_nombre=None
        )

    await db.commit()
    return await get_supplier_payment_order_detail(db, company_id, str(order.id))


async def _execute_disbursements_internal(
    db: AsyncSession,
    order: SupplierPaymentOrder,
    supplier: Supplier,
    payload: SupplierPaymentOrderDisburse,
    user_id: str | None,
    user_nombre: str | None
) -> None:
    """Lógica atómica interna de liquidación de medios de pago para una Orden de Pago."""
    cid = order.company_id
    total_desembolso_pyg = Decimal("0")

    if not payload.disbursements:
        raise HTTPException(status_code=400, detail="Debe asignar al menos un medio de pago para liquidar la orden.")

    # 1. Validar cuadre exacto de importes
    for d in payload.disbursements:
        tc = d.tipo_cambio or Decimal("1")
        m_pyg = Decimal(str(d.monto)) * tc
        total_desembolso_pyg += m_pyg

    diff = abs(total_desembolso_pyg - order.monto_neto)
    if diff > Decimal("50"):  # Margen de 50 Gs por posibles redondeos
        raise HTTPException(
            status_code=400,
            detail=f"El total de los medios de pago (₲ {total_desembolso_pyg:,.0f}) no coincide con el monto neto de la orden (₲ {order.monto_neto:,.0f}). Diferencia: ₲ {diff:,.0f}."
        )

    # 2. Cargar allocations de la orden
    alloc_res = await db.execute(
        select(SupplierPaymentOrderAllocation)
        .where(SupplierPaymentOrderAllocation.payment_order_id == order.id)
    )
    allocations = list(alloc_res.scalars().all())
    primera_factura_id = allocations[0].invoice_id if allocations else None

    # 3. Procesar cada forma de pago
    for d in payload.disbursements:
        fp = (d.forma_pago or "").lower().strip()
        tc = d.tipo_cambio or Decimal("1")
        m_pyg = Decimal(str(d.monto)) * tc
        monto_original = Decimal(str(d.monto))

        disb_record = SupplierPaymentOrderDisbursement(
            payment_order_id=order.id,
            forma_pago=fp,
            monto=monto_original,
            moneda=d.moneda or "PYG",
            tipo_cambio=tc,
            monto_pyg=m_pyg,
            referencia_transferencia=d.referencia_transferencia,
            comprobante_url=d.comprobante_url,
            observaciones=d.observaciones,
        )

        # ── A. EFECTIVO BÓVEDA CENTRAL ───────────────────────────────────────
        if fp == "boveda":
            is_brl = (d.moneda or "PYG").upper() == "BRL"
            now_dt = datetime.now(timezone.utc)

            if is_brl:
                monto_solicitado_brl = monto_original
                # Verificar saldo en bóveda en Reales (R$)
                bov_saldo_res = await db.execute(
                    select(func.coalesce(func.sum(VaultEntry.monto_brl), 0))
                    .where(VaultEntry.company_id == cid, VaultEntry.estado == "en_boveda")
                )
                saldo_boveda_brl = bov_saldo_res.scalar_one() or Decimal("0")
                if saldo_boveda_brl < monto_solicitado_brl:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Saldo insuficiente de Reales (R$) en Bóveda Central. Disponible: R$ {saldo_boveda_brl:,.2f} | Solicitado: R$ {monto_solicitado_brl:,.2f}"
                    )

                # Consumo FIFO de VaultEntry con saldo en Reales
                entries_res = await db.execute(
                    select(VaultEntry)
                    .where(VaultEntry.company_id == cid, VaultEntry.estado == "en_boveda", VaultEntry.monto_brl > 0)
                    .order_by(VaultEntry.created_at.asc())
                )
                vault_entries = list(entries_res.scalars().all())
                remaining_brl = monto_solicitado_brl

                for e in vault_entries:
                    if remaining_brl <= Decimal("0"):
                        break
                    e_monto_brl = Decimal(str(e.monto_brl or 0))
                    if e_monto_brl <= remaining_brl:
                        e.estado = "pagado_proveedor"
                        e.fecha_deposito = now_dt
                        e.observaciones = f"Egreso R$ por Pago Proveedor {order.numero_orden}"
                        if user_id:
                            e.registrado_por = uuid.UUID(user_id)
                        remaining_brl -= e_monto_brl
                    else:
                        remanente_brl = e_monto_brl - remaining_brl
                        db.add(VaultEntry(
                            company_id=cid,
                            branch_id=e.branch_id,
                            origen="remanente",
                            handoff_id=e.handoff_id,
                            monto_pyg=Decimal("0"),
                            monto_usd=Decimal("0"),
                            monto_brl=remanente_brl,
                            estado="en_boveda",
                            registrado_por=uuid.UUID(user_id) if user_id else e.registrado_por,
                            observaciones=f"Remanente R$ en bóveda tras pago a proveedor {order.numero_orden}",
                        ))
                        e.monto_brl = remaining_brl
                        e.estado = "pagado_proveedor"
                        e.fecha_deposito = now_dt
                        e.observaciones = f"Egreso R$ por Pago Proveedor {order.numero_orden}"
                        remaining_brl = Decimal("0")

                # Registrar movimiento de caja/bóveda en Reales
                from api.src.caja.models import CashRegister
                reg_res = await db.execute(
                    select(CashRegister).where(CashRegister.company_id == cid).order_by(CashRegister.activo.desc(), CashRegister.created_at.asc()).limit(1)
                )
                main_reg = reg_res.scalar_one_or_none()
                if main_reg:
                    db.add(CashRegisterMovement(
                        company_id=cid,
                        register_id=main_reg.id,
                        tipo="retiro",
                        monto=monto_solicitado_brl,
                        moneda="BRL",
                        fecha=datetime.now(TZ_ASUNCION),
                        usuario=user_nombre or "Tesorería",
                        observaciones=f"Pago Proveedor {order.numero_orden} (R$ {monto_solicitado_brl:,.2f} @ TC {tc:,.0f}) - {supplier.razon_social}",
                    ))
            else:
                # Verificar saldo en bóveda en Guaraníes (₲)
                bov_saldo_res = await db.execute(
                    select(func.coalesce(func.sum(VaultEntry.monto_pyg), 0))
                    .where(VaultEntry.company_id == cid, VaultEntry.estado == "en_boveda")
                )
                saldo_boveda = bov_saldo_res.scalar_one() or Decimal("0")
                if saldo_boveda < m_pyg:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Saldo insuficiente en Bóveda Central. Disponible: ₲ {saldo_boveda:,.0f} | Solicitado: ₲ {m_pyg:,.0f}"
                    )

                # Consumo FIFO de VaultEntry con saldo en Guaraníes
                entries_res = await db.execute(
                    select(VaultEntry)
                    .where(VaultEntry.company_id == cid, VaultEntry.estado == "en_boveda", VaultEntry.monto_pyg > 0)
                    .order_by(VaultEntry.created_at.asc())
                )
                vault_entries = list(entries_res.scalars().all())
                remaining = m_pyg

                for e in vault_entries:
                    if remaining <= Decimal("0"):
                        break
                    e_monto = Decimal(str(e.monto_pyg or 0))
                    if e_monto <= remaining:
                        e.estado = "pagado_proveedor"
                        e.fecha_deposito = now_dt
                        e.observaciones = f"Egreso por Pago Proveedor {order.numero_orden}"
                        if user_id:
                            e.registrado_por = uuid.UUID(user_id)
                        remaining -= e_monto
                    else:
                        remanente_monto = e_monto - remaining
                        db.add(VaultEntry(
                            company_id=cid,
                            branch_id=e.branch_id,
                            origen="remanente",
                            handoff_id=e.handoff_id,
                            monto_pyg=remanente_monto,
                            monto_usd=Decimal("0"),
                            monto_brl=Decimal("0"),
                            estado="en_boveda",
                            registrado_por=uuid.UUID(user_id) if user_id else e.registrado_por,
                            observaciones=f"Remanente en bóveda tras pago a proveedor {order.numero_orden}",
                        ))
                        e.monto_pyg = remaining
                        e.estado = "pagado_proveedor"
                        e.fecha_deposito = now_dt
                        e.observaciones = f"Egreso por Pago Proveedor {order.numero_orden}"
                        remaining = Decimal("0")

                # Registrar movimiento de caja/bóveda en Guaraníes
                from api.src.caja.models import CashRegister
                reg_res = await db.execute(
                    select(CashRegister).where(CashRegister.company_id == cid).order_by(CashRegister.activo.desc(), CashRegister.created_at.asc()).limit(1)
                )
                main_reg = reg_res.scalar_one_or_none()
                if main_reg:
                    db.add(CashRegisterMovement(
                        company_id=cid,
                        register_id=main_reg.id,
                        tipo="retiro",
                        monto=m_pyg,
                        moneda="PYG",
                        fecha=datetime.now(TZ_ASUNCION),
                        usuario=user_nombre or "Tesorería",
                        observaciones=f"Pago Proveedor {order.numero_orden} - {supplier.razon_social}",
                    ))

        # ── B. EFECTIVO FONDO FIJO (CAJA CHICA) ──────────────────────────────
        elif fp == "fondo_fijo":
            if not d.petty_cash_fund_id:
                # Buscar fondo por defecto si no viene especificado
                f_res = await db.execute(
                    select(PettyCashFund).where(PettyCashFund.company_id == cid, PettyCashFund.activo == True).limit(1)
                )
                fund = f_res.scalar_one_or_none()
            else:
                f_res = await db.execute(
                    select(PettyCashFund).where(PettyCashFund.id == d.petty_cash_fund_id, PettyCashFund.company_id == cid)
                )
                fund = f_res.scalar_one_or_none()

            if not fund:
                raise HTTPException(status_code=400, detail="Fondo Fijo (Caja Chica) no encontrado o inactivo.")

            if fund.saldo_actual < m_pyg:
                raise HTTPException(
                    status_code=400,
                    detail=f"Saldo insuficiente en Fondo Fijo '{fund.nombre}'. Disponible: ₲ {fund.saldo_actual:,.0f} | Solicitado: ₲ {m_pyg:,.0f}"
                )

            s_ant = fund.saldo_actual
            fund.saldo_actual -= m_pyg
            s_nuevo = fund.saldo_actual

            db.add(PettyCashFundMovement(
                fund_id=fund.id,
                tipo="gasto",
                monto=m_pyg,
                saldo_anterior=s_ant,
                saldo_nuevo=s_nuevo,
                referencia_type="payment_order",
                referencia_id=order.id,
                observaciones=f"Pago Proveedor {order.numero_orden} - {supplier.razon_social}",
                created_by=uuid.UUID(user_id) if user_id else None,
            ))
            disb_record.petty_cash_fund_id = fund.id

        # ── C. BANCO - TRANSFERENCIA ─────────────────────────────────────────
        elif fp == "transferencia":
            if not d.bank_account_id:
                raise HTTPException(status_code=400, detail="Debe seleccionar la cuenta bancaria para la transferencia.")

            b_res = await db.execute(
                select(BankAccount).where(BankAccount.id == d.bank_account_id, BankAccount.company_id == cid)
            )
            bank_acc = b_res.scalar_one_or_none()
            if not bank_acc:
                raise HTTPException(status_code=400, detail="Cuenta bancaria no encontrada.")

            bank_acc.saldo_actual -= m_pyg

            bt = BankTransaction(
                company_id=cid,
                bank_account_id=bank_acc.id,
                fecha=payload.fecha_pago or _today(),
                tipo="debito",
                monto=m_pyg,
                moneda="PYG",
                descripcion=f"Pago Proveedor {order.numero_orden} - {supplier.razon_social}",
                referencia=d.referencia_transferencia,
                contraparte=supplier.razon_social,
                conciliado=True,
                fecha_conciliacion=datetime.now(timezone.utc),
                invoice_id=primera_factura_id,
                categoria="proveedores",
            )
            db.add(bt)
            disb_record.bank_account_id = bank_acc.id

        # ── D. BANCO - CHEQUE EMITIDO (AL DÍA O DIFERIDO / COMPARTIDO) ───────
        elif fp == "cheque":
            if d.cheque_id:
                # El usuario vinculó un cheque ya emitido o compartido existente con saldo disponible
                ch_res = await db.execute(
                    select(Cheque).where(Cheque.id == d.cheque_id, Cheque.company_id == cid)
                )
                cheque = ch_res.scalar_one_or_none()
                if not cheque:
                    raise HTTPException(status_code=404, detail="El cheque seleccionado no existe.")

                # Calcular cuánto se ha consumido de este cheque en otras OPs
                consumed_res = await db.execute(
                    select(func.coalesce(func.sum(SupplierPaymentOrderDisbursement.monto_pyg), 0))
                    .where(
                        SupplierPaymentOrderDisbursement.cheque_id == cheque.id,
                        SupplierPaymentOrderDisbursement.payment_order_id != order.id
                    )
                )
                consumed_monto = consumed_res.scalar_one() or Decimal("0")
                monto_total_ch = Decimal(str(cheque.monto or 0))
                disponible = monto_total_ch - consumed_monto

                if m_pyg > disponible:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Saldo insuficiente en cheque N° {cheque.numero}. Total: ₲ {monto_total_ch:,.0f} | Consumido: ₲ {consumed_monto:,.0f} | Disponible: ₲ {disponible:,.0f} | Requerido: ₲ {m_pyg:,.0f}"
                    )

                db.add(ChequeHistorial(
                    cheque_id=cheque.id,
                    estado_anterior=cheque.estado,
                    estado_nuevo=cheque.estado,
                    user_id=uuid.UUID(user_id) if user_id else None,
                    user_nombre=user_nombre or "Finanzas",
                    notas=f"Vinculado a OP {order.numero_orden} ({supplier.razon_social}) por ₲ {m_pyg:,.0f}",
                ))

                disb_record.cheque_id = cheque.id
                disb_record.bank_account_id = cheque.bank_account_id
                disb_record.numero_cheque = cheque.numero
                disb_record.banco_cheque = cheque.banco_emisor
                disb_record.fecha_cheque_emision = cheque.fecha_emision
                disb_record.fecha_cheque_vencimiento = cheque.fecha_pago
                disb_record.es_cheque_diferido = cheque.diferido
                disb_record.titular_cheque = cheque.beneficiario
            else:
                if not d.numero_cheque:
                    raise HTTPException(status_code=400, detail="Debe ingresar el número de cheque.")

                fecha_em = d.fecha_cheque_emision or _today()
                fecha_venc = d.fecha_cheque_vencimiento or fecha_em
                es_dif = bool(d.es_cheque_diferido or (fecha_venc > fecha_em))

                # Monto nominal del cheque: si se especificó monto_total_cheque (para cheque matriz compartido)
                monto_cheque = Decimal(str(d.monto_total_cheque)) if (d.monto_total_cheque and Decimal(str(d.monto_total_cheque)) >= m_pyg) else m_pyg

                cheque = Cheque(
                    company_id=cid,
                    numero=d.numero_cheque,
                    numero_confiable=True,
                    banco_emisor=d.banco_cheque or "Banco",
                    bank_account_id=d.bank_account_id,
                    beneficiario=d.titular_cheque or supplier.razon_social,
                    supplier_id=supplier.id,
                    tipo_cheque="emitido",
                    monto=monto_cheque,
                    moneda="PYG",
                    fecha_emision=fecha_em,
                    fecha_entrega=_today(),
                    fecha_pago=fecha_venc,
                    diferido=es_dif,
                    estado="pendiente",
                    concepto=f"Pago Proveedor {order.numero_orden}" if monto_cheque == m_pyg else f"Cheque Compartido / Matriz (OP {order.numero_orden})",
                    notas=f"OP {order.numero_orden} - Ref: {d.observaciones or ''}",
                    created_by=uuid.UUID(user_id) if user_id else None,
                )
                db.add(cheque)
                await db.flush()

                db.add(ChequeHistorial(
                    cheque_id=cheque.id,
                    estado_anterior=None,
                    estado_nuevo="pendiente",
                    user_id=uuid.UUID(user_id) if user_id else None,
                    user_nombre=user_nombre or "Finanzas",
                    notas=f"Emitido en OP {order.numero_orden} por total ₲ {monto_cheque:,.0f} (Aplicado a esta OP: ₲ {m_pyg:,.0f})",
                ))

                disb_record.cheque_id = cheque.id
                disb_record.bank_account_id = d.bank_account_id
                disb_record.numero_cheque = d.numero_cheque
                disb_record.banco_cheque = d.banco_cheque
                disb_record.fecha_cheque_emision = fecha_em
                disb_record.fecha_cheque_vencimiento = fecha_venc
                disb_record.es_cheque_diferido = es_dif
                disb_record.titular_cheque = d.titular_cheque or supplier.razon_social

        # ── E. NOTA DE CRÉDITO DE PROVEEDOR ──────────────────────────────────
        elif fp == "nota_credito":
            if not d.credit_note_id:
                raise HTTPException(status_code=400, detail="Debe seleccionar la Nota de Crédito a aplicar.")

            cn_res = await db.execute(
                select(SupplierCreditNote).where(
                    SupplierCreditNote.id == d.credit_note_id,
                    SupplierCreditNote.company_id == cid,
                    SupplierCreditNote.supplier_id == supplier.id
                )
            )
            nc = cn_res.scalar_one_or_none()
            if not nc:
                raise HTTPException(status_code=400, detail="Nota de Crédito no encontrada o no pertenece al proveedor.")

            saldo_nc = Decimal(str(nc.saldo_disponible or nc.monto or 0))
            if saldo_nc < m_pyg:
                raise HTTPException(
                    status_code=400,
                    detail=f"Saldo insuficiente en NC N° {nc.numero}. Disponible: ₲ {saldo_nc:,.0f} | Requerido: ₲ {m_pyg:,.0f}"
                )

            nc.saldo_disponible = saldo_nc - m_pyg
            if primera_factura_id:
                db.add(SupplierCreditNoteApplication(
                    company_id=cid,
                    credit_note_id=nc.id,
                    invoice_id=primera_factura_id,
                    monto_aplicado=m_pyg,
                    observaciones=f"Aplicado vía OP {order.numero_orden}",
                ))
            disb_record.credit_note_id = nc.id

        db.add(disb_record)

    # 4. Amortizar Facturas vinculadas (SupplierInvoice)
    for alloc in allocations:
        inv_res = await db.execute(
            select(SupplierInvoice).where(SupplierInvoice.id == alloc.invoice_id)
        )
        inv = inv_res.scalar_one_or_none()
        if inv:
            total_amort = alloc.monto_aplicado + alloc.monto_retencion
            inv.saldo_pendiente = max(Decimal("0"), inv.saldo_pendiente - total_amort)
            if inv.saldo_pendiente_brl is not None and inv.total and inv.total > 0:
                proporcion = min(Decimal("1"), total_amort / inv.total)
                amort_brl = (inv.total_brl or Decimal("0")) * proporcion
                inv.saldo_pendiente_brl = max(Decimal("0"), (inv.saldo_pendiente_brl or Decimal("0")) - amort_brl)
            if inv.saldo_pendiente <= Decimal("0"):
                inv.estado = "pagada"
                if inv.saldo_pendiente_brl is not None:
                    inv.saldo_pendiente_brl = Decimal("0")
            else:
                inv.estado = "parcial"

            # Registrar compatibilidad con SupplierInvoicePayment
            db.add(SupplierInvoicePayment(
                invoice_id=inv.id,
                payment_method="orden_de_pago",
                monto=alloc.monto_aplicado,
                moneda="PYG",
                fecha_pago=payload.fecha_pago or _today(),
                referencia=f"{order.numero_orden} (OP)",
                estado="conciliado",
            ))

    # 5. Marcar Orden como Pagada
    order.estado = "pagado"
    order.fecha_pago = payload.fecha_pago or _today()
    if payload.recibo_proveedor:
        order.recibo_proveedor = payload.recibo_proveedor
    if payload.observaciones:
        order.observaciones = (order.observaciones or "") + ("\n" if order.observaciones else "") + payload.observaciones
    order.paid_by = uuid.UUID(user_id) if user_id else None


async def disburse_supplier_payment_order(
    db: AsyncSession,
    company_id: str,
    order_id: str,
    data: SupplierPaymentOrderDisburse,
    user_id: str | None = None,
    user_nombre: str | None = None
) -> dict:
    """Paso 2: Liquidar y desembolsar fondos para una Orden de Pago en estado 'registrado'."""
    cid = uuid.UUID(company_id)
    ord_id = uuid.UUID(order_id)

    q = select(SupplierPaymentOrder).where(SupplierPaymentOrder.id == ord_id, SupplierPaymentOrder.company_id == cid)
    order = (await db.execute(q)).scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Orden de Pago no encontrada.")

    if order.estado != "registrado":
        raise HTTPException(
            status_code=400,
            detail=f"La orden no puede ser liquidada porque su estado actual es '{order.estado}'."
        )

    sup_res = await db.execute(select(Supplier).where(Supplier.id == order.supplier_id))
    supplier = sup_res.scalar_one_or_none()
    if not supplier:
        raise HTTPException(status_code=404, detail="Proveedor de la orden no encontrado.")

    await _execute_disbursements_internal(
        db=db,
        order=order,
        supplier=supplier,
        payload=data,
        user_id=user_id,
        user_nombre=user_nombre,
    )
    await db.commit()
    return await get_supplier_payment_order_detail(db, company_id, order_id)


async def list_supplier_payment_orders(
    db: AsyncSession,
    company_id: str,
    supplier_id: str | None = None,
    estado: str | None = None,
    forma_pago: str | None = None,
    fecha_desde: date | None = None,
    fecha_hasta: date | None = None,
    limit: int = 100,
    offset: int = 0
) -> dict:
    """Lista las Órdenes de Pago a proveedores con filtros y metadatos calculados."""
    cid = uuid.UUID(company_id)
    query = (
        select(
            SupplierPaymentOrder,
            Supplier.razon_social.label("supplier_nombre"),
            Supplier.ruc.label("supplier_ruc"),
            func.count(SupplierPaymentOrderAllocation.id).label("total_facturas")
        )
        .join(Supplier, Supplier.id == SupplierPaymentOrder.supplier_id, isouter=True)
        .join(SupplierPaymentOrderAllocation, SupplierPaymentOrderAllocation.payment_order_id == SupplierPaymentOrder.id, isouter=True)
        .where(SupplierPaymentOrder.company_id == cid)
        .group_by(SupplierPaymentOrder.id, Supplier.razon_social, Supplier.ruc)
    )

    if supplier_id:
        query = query.where(SupplierPaymentOrder.supplier_id == uuid.UUID(supplier_id))
    if estado:
        query = query.where(SupplierPaymentOrder.estado == estado)
    if fecha_desde:
        query = query.where(SupplierPaymentOrder.fecha_emision >= fecha_desde)
    if fecha_hasta:
        query = query.where(SupplierPaymentOrder.fecha_emision <= fecha_hasta)

    query = query.order_by(SupplierPaymentOrder.created_at.desc()).limit(limit).offset(offset)
    results = (await db.execute(query)).all()

    orders_list = []
    order_ids = [r.SupplierPaymentOrder.id for r in results]

    # Pre-cargar resumen de formas de pago
    disb_map = {}
    if order_ids:
        disb_q = select(
            SupplierPaymentOrderDisbursement.payment_order_id,
            SupplierPaymentOrderDisbursement.forma_pago,
            SupplierPaymentOrderDisbursement.monto_pyg,
            SupplierPaymentOrderDisbursement.es_cheque_diferido
        ).where(SupplierPaymentOrderDisbursement.payment_order_id.in_(order_ids))
        disb_rows = (await db.execute(disb_q)).all()
        for d in disb_rows:
            fp_label = d.forma_pago.replace("_", " ").title()
            if d.forma_pago == "cheque" and d.es_cheque_diferido:
                fp_label = "Cheque Dif."
            disb_map.setdefault(d.payment_order_id, []).append(fp_label)

    for r in results:
        o = r.SupplierPaymentOrder
        fps = list(set(disb_map.get(o.id, [])))
        if forma_pago and forma_pago not in [f.lower().replace(" ", "_") for f in fps]:
            continue

        orders_list.append({
            "id": str(o.id),
            "company_id": str(o.company_id),
            "supplier_id": str(o.supplier_id),
            "supplier_nombre": r.supplier_nombre or "Proveedor General",
            "supplier_ruc": r.supplier_ruc or "-",
            "numero_orden": o.numero_orden,
            "fecha_emision": o.fecha_emision.isoformat() if o.fecha_emision else None,
            "fecha_pago": o.fecha_pago.isoformat() if o.fecha_pago else None,
            "estado": o.estado,
            "moneda": o.moneda,
            "monto_total": float(o.monto_total),
            "monto_retenido": float(o.monto_retenido),
            "monto_neto": float(o.monto_neto),
            "diferencia_cambio": float(o.diferencia_cambio or 0),
            "observaciones": o.observaciones,
            "recibo_proveedor": o.recibo_proveedor,
            "created_at": o.created_at.isoformat() if o.created_at else None,
            "updated_at": o.updated_at.isoformat() if o.updated_at else None,
            "total_facturas": r.total_facturas or 0,
            "formas_pago_resumen": ", ".join(fps) if fps else ("Pendiente de pago" if o.estado == "registrado" else "-"),
        })

    return {"items": orders_list, "total": len(orders_list)}


async def get_supplier_payment_order_detail(
    db: AsyncSession,
    company_id: str,
    order_id: str
) -> dict | None:
    """Obtiene el detalle completo de una Orden de Pago con facturas y desembolsos."""
    cid = uuid.UUID(company_id)
    ord_id = uuid.UUID(order_id)

    q = (
        select(
            SupplierPaymentOrder,
            Supplier.razon_social.label("supplier_nombre"),
            Supplier.ruc.label("supplier_ruc")
        )
        .join(Supplier, Supplier.id == SupplierPaymentOrder.supplier_id, isouter=True)
        .where(SupplierPaymentOrder.id == ord_id, SupplierPaymentOrder.company_id == cid)
    )
    row = (await db.execute(q)).first()
    if not row:
        return None

    o = row.SupplierPaymentOrder

    # Cargar Allocations enriquecidas
    alloc_q = (
        select(
            SupplierPaymentOrderAllocation,
            SupplierInvoice.numero_factura,
            SupplierInvoice.timbrado,
            SupplierInvoice.fecha_emision,
            SupplierInvoice.fecha_vencimiento
        )
        .join(SupplierInvoice, SupplierInvoice.id == SupplierPaymentOrderAllocation.invoice_id)
        .where(SupplierPaymentOrderAllocation.payment_order_id == o.id)
    )
    alloc_rows = (await db.execute(alloc_q)).all()
    allocations_data = [
        {
            "id": str(a.SupplierPaymentOrderAllocation.id),
            "invoice_id": str(a.SupplierPaymentOrderAllocation.invoice_id),
            "numero_factura": a.numero_factura,
            "timbrado": a.timbrado,
            "fecha_emision": a.fecha_emision.isoformat() if a.fecha_emision else None,
            "fecha_vencimiento": a.fecha_vencimiento.isoformat() if a.fecha_vencimiento else None,
            "monto_aplicado": float(a.SupplierPaymentOrderAllocation.monto_aplicado),
            "monto_retencion": float(a.SupplierPaymentOrderAllocation.monto_retencion),
            "saldo_anterior": float(a.SupplierPaymentOrderAllocation.saldo_anterior),
            "saldo_restante": float(a.SupplierPaymentOrderAllocation.saldo_restante),
        }
        for a in alloc_rows
    ]

    # Cargar Disbursements enriquecidos
    disb_q = (
        select(
            SupplierPaymentOrderDisbursement,
            BankAccount.banco.label("banco_nombre"),
            PettyCashFund.nombre.label("fondo_nombre"),
            SupplierCreditNote.numero.label("numero_nc")
        )
        .join(BankAccount, BankAccount.id == SupplierPaymentOrderDisbursement.bank_account_id, isouter=True)
        .join(PettyCashFund, PettyCashFund.id == SupplierPaymentOrderDisbursement.petty_cash_fund_id, isouter=True)
        .join(SupplierCreditNote, SupplierCreditNote.id == SupplierPaymentOrderDisbursement.credit_note_id, isouter=True)
        .where(SupplierPaymentOrderDisbursement.payment_order_id == o.id)
    )
    disb_rows = (await db.execute(disb_q)).all()
    disbursements_data = [
        {
            "id": str(d.SupplierPaymentOrderDisbursement.id),
            "forma_pago": d.SupplierPaymentOrderDisbursement.forma_pago,
            "monto": float(d.SupplierPaymentOrderDisbursement.monto),
            "moneda": d.SupplierPaymentOrderDisbursement.moneda,
            "tipo_cambio": float(d.SupplierPaymentOrderDisbursement.tipo_cambio),
            "monto_pyg": float(d.SupplierPaymentOrderDisbursement.monto_pyg),
            "bank_account_id": str(d.SupplierPaymentOrderDisbursement.bank_account_id) if d.SupplierPaymentOrderDisbursement.bank_account_id else None,
            "banco_nombre": d.banco_nombre or d.SupplierPaymentOrderDisbursement.banco_cheque,
            "referencia_transferencia": d.SupplierPaymentOrderDisbursement.referencia_transferencia,
            "cheque_id": str(d.SupplierPaymentOrderDisbursement.cheque_id) if d.SupplierPaymentOrderDisbursement.cheque_id else None,
            "numero_cheque": d.SupplierPaymentOrderDisbursement.numero_cheque,
            "banco_cheque": d.SupplierPaymentOrderDisbursement.banco_cheque,
            "fecha_cheque_emision": d.SupplierPaymentOrderDisbursement.fecha_cheque_emision.isoformat() if d.SupplierPaymentOrderDisbursement.fecha_cheque_emision else None,
            "fecha_cheque_vencimiento": d.SupplierPaymentOrderDisbursement.fecha_cheque_vencimiento.isoformat() if d.SupplierPaymentOrderDisbursement.fecha_cheque_vencimiento else None,
            "es_cheque_diferido": d.SupplierPaymentOrderDisbursement.es_cheque_diferido,
            "titular_cheque": d.SupplierPaymentOrderDisbursement.titular_cheque,
            "petty_cash_fund_id": str(d.SupplierPaymentOrderDisbursement.petty_cash_fund_id) if d.SupplierPaymentOrderDisbursement.petty_cash_fund_id else None,
            "fondo_nombre": d.fondo_nombre,
            "credit_note_id": str(d.SupplierPaymentOrderDisbursement.credit_note_id) if d.SupplierPaymentOrderDisbursement.credit_note_id else None,
            "numero_nc": d.numero_nc,
            "comprobante_url": d.SupplierPaymentOrderDisbursement.comprobante_url,
            "observaciones": d.SupplierPaymentOrderDisbursement.observaciones,
            "created_at": d.SupplierPaymentOrderDisbursement.created_at.isoformat() if d.SupplierPaymentOrderDisbursement.created_at else None,
        }
        for d in disb_rows
    ]

    fps = list(set([d["forma_pago"].replace("_", " ").title() for d in disbursements_data]))

    return {
        "id": str(o.id),
        "company_id": str(o.company_id),
        "supplier_id": str(o.supplier_id),
        "supplier_nombre": row.supplier_nombre or "Proveedor General",
        "supplier_ruc": row.supplier_ruc or "-",
        "numero_orden": o.numero_orden,
        "fecha_emision": o.fecha_emision.isoformat() if o.fecha_emision else None,
        "fecha_pago": o.fecha_pago.isoformat() if o.fecha_pago else None,
        "estado": o.estado,
        "moneda": o.moneda,
        "monto_total": float(o.monto_total),
        "monto_retenido": float(o.monto_retenido),
        "monto_neto": float(o.monto_neto),
        "diferencia_cambio": float(o.diferencia_cambio or 0),
        "observaciones": o.observaciones,
        "recibo_proveedor": o.recibo_proveedor,
        "created_at": o.created_at.isoformat() if o.created_at else None,
        "updated_at": o.updated_at.isoformat() if o.updated_at else None,
        "total_facturas": len(allocations_data),
        "formas_pago_resumen": ", ".join(fps) if fps else ("Pendiente de pago" if o.estado == "registrado" else "-"),
        "allocations": allocations_data,
        "disbursements": disbursements_data,
    }


async def get_cheques_available_for_disbursement(
    db: AsyncSession,
    company_id: str
) -> list[dict]:
    """Obtiene cheques emitidos pendientes/en cartera con saldo remanente disponible para ser vinculados a OPs."""
    cid = uuid.UUID(company_id)

    consumed_subq = (
        select(
            SupplierPaymentOrderDisbursement.cheque_id,
            func.coalesce(func.sum(SupplierPaymentOrderDisbursement.monto_pyg), 0).label("consumido_pyg")
        )
        .where(SupplierPaymentOrderDisbursement.cheque_id.isnot(None))
        .group_by(SupplierPaymentOrderDisbursement.cheque_id)
        .subquery()
    )

    stmt = (
        select(
            Cheque,
            func.coalesce(consumed_subq.c.consumido_pyg, 0).label("consumido")
        )
        .outerjoin(consumed_subq, Cheque.id == consumed_subq.c.cheque_id)
        .where(
            Cheque.company_id == cid,
            Cheque.tipo_cheque == "emitido",
            Cheque.estado.in_(["pendiente", "en_cartera", "entregado"]),
        )
        .order_by(Cheque.fecha_emision.desc(), Cheque.created_at.desc())
    )

    rows = (await db.execute(stmt)).all()
    results = []
    for ch, consumido in rows:
        monto_total = Decimal(str(ch.monto or 0))
        monto_consumido = Decimal(str(consumido or 0))
        disponible = monto_total - monto_consumido
        if disponible > Decimal("0"):
            results.append({
                "id": str(ch.id),
                "numero": ch.numero,
                "banco_emisor": ch.banco_emisor,
                "bank_account_id": str(ch.bank_account_id) if ch.bank_account_id else None,
                "beneficiario": ch.beneficiario,
                "monto_total": float(monto_total),
                "monto_consumido": float(monto_consumido),
                "saldo_disponible": float(disponible),
                "fecha_emision": ch.fecha_emision.isoformat() if ch.fecha_emision else None,
                "fecha_pago": ch.fecha_pago.isoformat() if ch.fecha_pago else None,
                "diferido": ch.diferido,
                "estado": ch.estado,
                "concepto": ch.concepto,
            })
    return results


async def create_multi_supplier_payment_batch(
    db: AsyncSession,
    company_id: str,
    payload: MultiSupplierPaymentBatchCreate,
    user_id: str | None = None,
    user_nombre: str | None = None
) -> dict:
    """Crea un Lote de Pago Multi-Proveedor (e.g. Lote Brasil / Cambista).
    Genera 1 Orden de Pago individual por cada proveedor con sus facturas amortizadas,
    y respalda todo el lote bajo UN SOLO instrumento de desembolso (Cheque único, Transferencia bancaria o Bóveda).
    """
    cid = uuid.UUID(company_id)
    if not payload.items:
        raise HTTPException(status_code=400, detail="Debe incluir al menos un proveedor en el lote.")

    # 1. Validar sumatorias
    total_desembolso_declarado = Decimal(str(payload.monto_total_desembolso_pyg))
    total_items_pyg = Decimal("0")

    for item in payload.items:
        if not item.allocations:
            raise HTTPException(status_code=400, detail=f"El proveedor {item.supplier_id} no tiene facturas asignadas.")
        total_item_alloc = sum(Decimal(str(a.monto_aplicado)) for a in item.allocations)
        if abs(total_item_alloc - Decimal(str(item.monto_pyg))) > Decimal("50"):
            raise HTTPException(
                status_code=400,
                detail=f"La suma de facturas para el proveedor (₲ {total_item_alloc:,.0f}) no coincide con su monto en Guaraníes (₲ {item.monto_pyg:,.0f})."
            )
        total_items_pyg += Decimal(str(item.monto_pyg))

    if total_desembolso_declarado <= Decimal("0"):
        raise HTTPException(status_code=400, detail="El monto total de desembolso debe ser mayor a 0.")

    # Diferencia de cambio total entre el instrumento emitido/desembolsado y la deuda neta de facturas:
    # diff_cambio_total > 0: El cheque/desembolso es MAYOR a la deuda (sobrecosto o pérdida por cotización cambiaria)
    # diff_cambio_total < 0: El cheque/desembolso es MENOR a la deuda (ganancia o descuento por cotización cambiaria)
    diff_cambio_total = total_desembolso_declarado - total_items_pyg

    fp = (payload.forma_pago or "").lower().strip()
    fecha_pago_efectiva = payload.fecha_pago or _today()

    # 2. Desembolso centralizado (Instrumento Financiero Único)
    cheque_obj: Cheque | None = None
    bank_acc_obj: BankAccount | None = None

    if fp == "cheque":
        if payload.cheque_id:
            # Cheque existente
            ch_res = await db.execute(select(Cheque).where(Cheque.id == payload.cheque_id, Cheque.company_id == cid))
            cheque_obj = ch_res.scalar_one_or_none()
            if not cheque_obj:
                raise HTTPException(status_code=404, detail="El cheque seleccionado no existe.")

            consumed_res = await db.execute(
                select(func.coalesce(func.sum(SupplierPaymentOrderDisbursement.monto_pyg), 0))
                .where(SupplierPaymentOrderDisbursement.cheque_id == cheque_obj.id)
            )
            consumed_monto = consumed_res.scalar_one() or Decimal("0")
            disponible = Decimal(str(cheque_obj.monto or 0)) - consumed_monto
            if total_desembolso_declarado > disponible:
                raise HTTPException(
                    status_code=400,
                    detail=f"Saldo insuficiente en cheque N° {cheque_obj.numero}. Total: ₲ {cheque_obj.monto:,.0f} | Disponible: ₲ {disponible:,.0f} | Requerido por lote: ₲ {total_desembolso_declarado:,.0f}"
                )

            db.add(ChequeHistorial(
                cheque_id=cheque_obj.id,
                estado_anterior=cheque_obj.estado,
                estado_nuevo=cheque_obj.estado,
                user_id=uuid.UUID(user_id) if user_id else None,
                user_nombre=user_nombre or "Finanzas",
                notas=f"Asignado a Lote Multi-Proveedor ({len(payload.items)} prov.) por ₲ {total_desembolso_declarado:,.0f} (Facturas: ₲ {total_items_pyg:,.0f}, Dif. Cambio: ₲ {diff_cambio_total:+,.0f})",
            ))
        else:
            if not payload.numero_cheque:
                raise HTTPException(status_code=400, detail="Debe indicar el número de cheque.")

            fecha_em = payload.fecha_cheque_emision or _today()
            fecha_venc = payload.fecha_cheque_vencimiento or fecha_em
            es_dif = bool(payload.es_cheque_diferido or (fecha_venc > fecha_em))

            cheque_obj = Cheque(
                company_id=cid,
                numero=payload.numero_cheque,
                numero_confiable=True,
                banco_emisor=payload.banco_cheque or "Banco",
                bank_account_id=payload.bank_account_id,
                beneficiario=payload.titular_cheque or f"Lote Brasil ({len(payload.items)} proveedores)",
                tipo_cheque="emitido",
                monto=total_desembolso_declarado,
                moneda="PYG",
                fecha_emision=fecha_em,
                fecha_entrega=_today(),
                fecha_pago=fecha_venc,
                diferido=es_dif,
                estado="pendiente",
                concepto=f"Lote Multi-Proveedor / Brasil ({len(payload.items)} proveedores)",
                notas=payload.observaciones or f"Cheque por compra de divisas / pago agrupado (Dif. Cambio: ₲ {diff_cambio_total:+,.0f})",
                created_by=uuid.UUID(user_id) if user_id else None,
            )
            db.add(cheque_obj)
            await db.flush()

            db.add(ChequeHistorial(
                cheque_id=cheque_obj.id,
                estado_anterior=None,
                estado_nuevo="pendiente",
                user_id=uuid.UUID(user_id) if user_id else None,
                user_nombre=user_nombre or "Finanzas",
                notas=f"Emitido en Lote Multi-Proveedor ({len(payload.items)} prov.) por ₲ {total_desembolso_declarado:,.0f} (Dif. Cambio: ₲ {diff_cambio_total:+,.0f})",
            ))

    elif fp == "transferencia":
        if not payload.bank_account_id:
            raise HTTPException(status_code=400, detail="Debe seleccionar la cuenta bancaria de origen para la transferencia.")

        b_res = await db.execute(
            select(BankAccount).where(BankAccount.id == payload.bank_account_id, BankAccount.company_id == cid)
        )
        bank_acc_obj = b_res.scalar_one_or_none()
        if not bank_acc_obj:
            raise HTTPException(status_code=404, detail="Cuenta bancaria no encontrada.")

        bank_acc_obj.saldo_actual -= total_desembolso_declarado

        bt = BankTransaction(
            company_id=cid,
            bank_account_id=bank_acc_obj.id,
            fecha=fecha_pago_efectiva,
            tipo="debito",
            monto=total_desembolso_declarado,
            moneda="PYG",
            descripcion=f"Transferencia Lote Multi-Proveedor ({len(payload.items)} prov.)",
            referencia=payload.referencia_transferencia,
            contraparte=payload.titular_cheque or "Lote Proveedores",
            conciliado=True,
            fecha_conciliacion=datetime.now(timezone.utc),
            categoria="proveedores",
        )
        db.add(bt)

    elif fp == "boveda":
        is_brl_batch = payload.moneda_desembolso == "BRL" or any(it.moneda == "BRL" for it in payload.items)
        now_dt = datetime.now(timezone.utc)

        if is_brl_batch:
            total_brl_declarado = payload.monto_total_desembolso_brl or sum(Decimal(str(it.monto_moneda)) for it in payload.items if it.moneda == "BRL")
            bov_saldo_res = await db.execute(
                select(func.coalesce(func.sum(VaultEntry.monto_brl), 0))
                .where(VaultEntry.company_id == cid, VaultEntry.estado == "en_boveda")
            )
            saldo_boveda_brl = bov_saldo_res.scalar_one() or Decimal("0")
            if saldo_boveda_brl < total_brl_declarado:
                raise HTTPException(
                    status_code=400,
                    detail=f"Saldo insuficiente de Reales (R$) en Bóveda Central. Disponible: R$ {saldo_boveda_brl:,.2f} | Solicitado por lote: R$ {total_brl_declarado:,.2f}"
                )

            entries_res = await db.execute(
                select(VaultEntry)
                .where(VaultEntry.company_id == cid, VaultEntry.estado == "en_boveda", VaultEntry.monto_brl > 0)
                .order_by(VaultEntry.created_at.asc())
            )
            vault_entries = list(entries_res.scalars().all())
            remaining_brl = total_brl_declarado

            for e in vault_entries:
                if remaining_brl <= Decimal("0"):
                    break
                e_monto = Decimal(str(e.monto_brl or 0))
                if e_monto <= remaining_brl:
                    e.estado = "pagado_proveedor"
                    e.fecha_deposito = now_dt
                    e.observaciones = f"Egreso R$ Lote Multi-Proveedor ({len(payload.items)} prov.)"
                    if user_id:
                        e.registrado_por = uuid.UUID(user_id)
                    remaining_brl -= e_monto
                else:
                    remanente_monto = e_monto - remaining_brl
                    db.add(VaultEntry(
                        company_id=cid,
                        branch_id=e.branch_id,
                        origen="remanente",
                        handoff_id=e.handoff_id,
                        monto_pyg=Decimal("0"),
                        monto_usd=Decimal("0"),
                        monto_brl=remanente_monto,
                        estado="en_boveda",
                        registrado_por=uuid.UUID(user_id) if user_id else e.registrado_por,
                        observaciones="Remanente R$ en bóveda tras pago Lote Multi-Proveedor",
                    ))
                    e.monto_brl = remaining_brl
                    e.estado = "pagado_proveedor"
                    e.fecha_deposito = now_dt
                    e.observaciones = f"Egreso R$ Lote Multi-Proveedor ({len(payload.items)} prov.)"
                    remaining_brl = Decimal("0")

            from api.src.caja.models import CashRegister
            reg_res = await db.execute(
                select(CashRegister).where(CashRegister.company_id == cid).order_by(CashRegister.activo.desc(), CashRegister.created_at.asc()).limit(1)
            )
            main_reg = reg_res.scalar_one_or_none()
            if main_reg:
                db.add(CashRegisterMovement(
                    company_id=cid,
                    register_id=main_reg.id,
                    tipo="retiro",
                    monto=total_brl_declarado,
                    moneda="BRL",
                    fecha=datetime.now(TZ_ASUNCION),
                    usuario=user_nombre or "Tesorería",
                    observaciones=f"Egreso Bóveda R$ Lote Multi-Proveedor ({len(payload.items)} prov.)",
                ))
        else:
            bov_saldo_res = await db.execute(
                select(func.coalesce(func.sum(VaultEntry.monto_pyg), 0))
                .where(VaultEntry.company_id == cid, VaultEntry.estado == "en_boveda")
            )
            saldo_boveda = bov_saldo_res.scalar_one() or Decimal("0")
            if saldo_boveda < total_desembolso_declarado:
                raise HTTPException(
                    status_code=400,
                    detail=f"Saldo insuficiente en Bóveda Central. Disponible: ₲ {saldo_boveda:,.0f} | Solicitado: ₲ {total_desembolso_declarado:,.0f}"
                )

            entries_res = await db.execute(
                select(VaultEntry)
                .where(VaultEntry.company_id == cid, VaultEntry.estado == "en_boveda", VaultEntry.monto_pyg > 0)
                .order_by(VaultEntry.created_at.asc())
            )
            vault_entries = list(entries_res.scalars().all())
            remaining = total_desembolso_declarado

            for e in vault_entries:
                if remaining <= Decimal("0"):
                    break
                e_monto = Decimal(str(e.monto_pyg or 0))
                if e_monto <= remaining:
                    e.estado = "pagado_proveedor"
                    e.fecha_deposito = now_dt
                    e.observaciones = f"Egreso por Lote Multi-Proveedor ({len(payload.items)} prov.)"
                    if user_id:
                        e.registrado_por = uuid.UUID(user_id)
                    remaining -= e_monto
                else:
                    remanente_monto = e_monto - remaining
                    db.add(VaultEntry(
                        company_id=cid,
                        branch_id=e.branch_id,
                        origen="remanente",
                        handoff_id=e.handoff_id,
                        monto_pyg=remanente_monto,
                        monto_usd=Decimal("0"),
                        monto_brl=Decimal("0"),
                        estado="en_boveda",
                        registrado_por=uuid.UUID(user_id) if user_id else e.registrado_por,
                        observaciones="Remanente en bóveda tras pago Lote Multi-Proveedor",
                    ))
                    e.monto_pyg = remaining
                    e.estado = "pagado_proveedor"
                    e.fecha_deposito = now_dt
                    e.observaciones = f"Egreso por Lote Multi-Proveedor ({len(payload.items)} prov.)"
                    remaining = Decimal("0")

            from api.src.caja.models import CashRegister
            reg_res = await db.execute(
                select(CashRegister).where(CashRegister.company_id == cid).order_by(CashRegister.activo.desc(), CashRegister.created_at.asc()).limit(1)
            )
            main_reg = reg_res.scalar_one_or_none()
            if main_reg:
                db.add(CashRegisterMovement(
                    company_id=cid,
                    register_id=main_reg.id,
                    tipo="retiro",
                    monto=total_desembolso_declarado,
                    moneda="PYG",
                    fecha=datetime.now(TZ_ASUNCION),
                    usuario=user_nombre or "Tesorería",
                    observaciones=f"Egreso Bóveda Lote Multi-Proveedor ({len(payload.items)} prov.)",
                ))

    # 3. Iterar cada proveedor y generar su OP individual
    sum_dif_asignada = Decimal("0")
    created_orders = []

    for idx, item in enumerate(payload.items):
        sup_res = await db.execute(select(Supplier).where(Supplier.id == item.supplier_id, Supplier.company_id == cid))
        sup = sup_res.scalar_one_or_none()
        if not sup:
            raise HTTPException(status_code=404, detail=f"Proveedor con ID {item.supplier_id} no encontrado.")

        num_orden = await _generate_order_number(db, cid, offset=idx)
        monto_item_pyg = Decimal(str(item.monto_pyg))
        monto_moneda = Decimal(str(item.monto_moneda))
        tc = Decimal(str(item.tipo_cambio or 1))

        # Calcular la diferencia de cambio imputada para este proveedor
        if getattr(item, "diferencia_cambio", None) is not None and item.diferencia_cambio != Decimal("0"):
            diff_item = Decimal(str(item.diferencia_cambio))
        elif diff_cambio_total != Decimal("0") and total_items_pyg > Decimal("0"):
            if idx == len(payload.items) - 1:
                diff_item = diff_cambio_total - sum_dif_asignada
            else:
                diff_item = (diff_cambio_total * monto_item_pyg / total_items_pyg).quantize(Decimal("1"))
                sum_dif_asignada += diff_item
        else:
            diff_item = Decimal("0")

        total_ret = sum(Decimal(str(a.monto_retencion or 0)) for a in item.allocations)
        monto_disb_pyg = monto_item_pyg + diff_item

        dif_obs = f" [Dif. Cambio: ₲ {diff_item:+,.0f}]" if diff_item != Decimal("0") else ""
        op = SupplierPaymentOrder(
            company_id=cid,
            supplier_id=sup.id,
            numero_orden=num_orden,
            fecha_emision=_today(),
            fecha_pago=fecha_pago_efectiva,
            estado="pagado",
            moneda="PYG",
            monto_total=monto_item_pyg + total_ret,
            monto_retenido=total_ret,
            monto_neto=monto_item_pyg,
            diferencia_cambio=diff_item,
            observaciones=f"[Lote Multi-Proveedor / Brasil]{dif_obs} {item.observaciones or payload.observaciones or ''}".strip(),
            recibo_proveedor=item.recibo_proveedor,
            created_by=uuid.UUID(user_id) if user_id else None,
        )
        db.add(op)
        await db.flush()

        # Allocations y amortización de facturas
        for alloc in item.allocations:
            inv_res = await db.execute(
                select(SupplierInvoice).where(SupplierInvoice.id == alloc.invoice_id, SupplierInvoice.company_id == cid)
            )
            inv = inv_res.scalar_one_or_none()
            if not inv:
                raise HTTPException(status_code=404, detail=f"Factura {alloc.invoice_id} no encontrada.")

            m_aplicado = Decimal(str(alloc.monto_aplicado))
            m_ret = Decimal(str(alloc.monto_retencion or 0))
            saldo_ant = Decimal(str(inv.saldo_pendiente or inv.total))
            total_amort = m_aplicado + m_ret
            saldo_rest = max(Decimal("0"), saldo_ant - total_amort)

            db.add(SupplierPaymentOrderAllocation(
                payment_order_id=op.id,
                invoice_id=inv.id,
                monto_aplicado=m_aplicado,
                monto_retencion=m_ret,
                saldo_anterior=saldo_ant,
                saldo_restante=saldo_rest,
            ))

            inv.saldo_pendiente = saldo_rest
            if inv.saldo_pendiente_brl is not None and inv.total and inv.total > 0:
                proporcion = min(Decimal("1"), total_amort / inv.total)
                amort_brl = (inv.total_brl or Decimal("0")) * proporcion
                inv.saldo_pendiente_brl = max(Decimal("0"), (inv.saldo_pendiente_brl or Decimal("0")) - amort_brl)
            if inv.saldo_pendiente <= Decimal("0"):
                inv.estado = "pagada"
                if inv.saldo_pendiente_brl is not None:
                    inv.saldo_pendiente_brl = Decimal("0")
            else:
                inv.estado = "parcial"

            db.add(SupplierInvoicePayment(
                invoice_id=inv.id,
                payment_method="orden_de_pago",
                monto=m_aplicado,
                moneda="PYG",
                fecha_pago=fecha_pago_efectiva,
                referencia=f"{op.numero_orden} (Lote Brasil)",
                estado="conciliado",
            ))

        # Disbursement individual vinculado a esta OP
        disb = SupplierPaymentOrderDisbursement(
            payment_order_id=op.id,
            forma_pago=fp,
            monto=monto_moneda,
            moneda=item.moneda or "PYG",
            tipo_cambio=tc,
            monto_pyg=monto_disb_pyg,
            bank_account_id=payload.bank_account_id if fp == "transferencia" else (cheque_obj.bank_account_id if cheque_obj else None),
            referencia_transferencia=payload.referencia_transferencia if fp == "transferencia" else None,
            cheque_id=cheque_obj.id if cheque_obj else None,
            numero_cheque=cheque_obj.numero if cheque_obj else None,
            banco_cheque=cheque_obj.banco_emisor if cheque_obj else None,
            fecha_cheque_emision=cheque_obj.fecha_emision if cheque_obj else None,
            fecha_cheque_vencimiento=cheque_obj.fecha_pago if cheque_obj else None,
            es_cheque_diferido=cheque_obj.diferido if cheque_obj else False,
            titular_cheque=cheque_obj.beneficiario if cheque_obj else None,
            observaciones=f"Lote Multi-Proveedor{f' (Imputación Cheque: ₲ {monto_disb_pyg:,.0f}, Dif. Cambio: ₲ {diff_item:+,.0f})' if diff_item != Decimal('0') else ''} {item.observaciones or ''}".strip(),
        )
        db.add(disb)

        # Si hubo diferencia de cambio, registrar renglón complementario de Diferencia de Cambio
        if diff_item != Decimal("0"):
            disb_dif = SupplierPaymentOrderDisbursement(
                payment_order_id=op.id,
                forma_pago="diferencia_cambio",
                monto=abs(diff_item),
                moneda="PYG",
                tipo_cambio=Decimal("1"),
                monto_pyg=diff_item,
                observaciones=f"Diferencia de Cambio Imputada ({'Sobrecosto / Pérdida Cambiaria' if diff_item > 0 else 'Ganancia Cambiaria Favorable'})",
            )
            db.add(disb_dif)

        created_orders.append({
            "order_id": str(op.id),
            "numero_orden": op.numero_orden,
            "supplier_id": str(sup.id),
            "supplier_nombre": sup.razon_social,
            "monto_pyg": float(monto_item_pyg),
            "monto_moneda": float(monto_moneda),
            "diferencia_cambio": float(diff_item),
            "moneda": item.moneda,
        })

    await db.commit()

    return {
        "success": True,
        "message": f"Se procesó con éxito el Lote Multi-Proveedor con {len(created_orders)} órdenes de pago.",
        "forma_pago": fp,
        "total_pyg": float(total_desembolso_declarado),
        "total_facturas_pyg": float(total_items_pyg),
        "diferencia_cambio_total": float(diff_cambio_total),
        "cheque_id": str(cheque_obj.id) if cheque_obj else None,
        "numero_cheque": cheque_obj.numero if cheque_obj else None,
        "order_ids": [o["order_id"] for o in created_orders],
        "orders": created_orders,
    }


async def get_batch_payment_report_data(
    db: AsyncSession,
    company_id: str,
    order_ids: list[str] | None = None,
    cheque_id: str | None = None,
) -> dict:
    """Recupera toda la información analítica de un conjunto de Órdenes de Pago
    generadas en un Lote Multi-Proveedor para emitir el acta PDF de uso interno.
    Soporta búsqueda por lista de order_ids o por cheque_id.
    """
    cid = uuid.UUID(company_id)
    uuids = []
    if order_ids:
        uuids = [uuid.UUID(oid.strip()) for oid in order_ids if oid.strip()]
    elif cheque_id:
        chq_uuid = uuid.UUID(cheque_id.strip())
        disbs_q = await db.execute(
            select(SupplierPaymentOrderDisbursement.payment_order_id)
            .where(SupplierPaymentOrderDisbursement.cheque_id == chq_uuid)
        )
        uuids = [r[0] for r in disbs_q.all()]

    if not uuids:
        raise HTTPException(status_code=400, detail="No se proporcionaron órdenes de pago ni un cheque válido para el lote.")

    stmt = (
        select(SupplierPaymentOrder)
        .where(SupplierPaymentOrder.company_id == cid, SupplierPaymentOrder.id.in_(uuids))
        .order_by(SupplierPaymentOrder.created_at.asc())
    )
    res = await db.execute(stmt)
    orders_db = list(res.scalars().all())
    if not orders_db:
        raise HTTPException(status_code=404, detail="No se encontraron órdenes de pago para el lote especificado.")

    orders_data = []
    instrument_data = {}
    total_desembolsado_pyg = Decimal("0")
    total_facturas_pyg = Decimal("0")
    total_diff_pyg = Decimal("0")
    total_moneda_extranjera = Decimal("0")
    moneda_ext = None
    fecha_operacion = None
    obs_list = []

    from api.src.cheques.models import Cheque
    from api.src.financial.models import BankAccount

    for o in orders_db:
        sup_res = await db.execute(select(Supplier).where(Supplier.id == o.supplier_id))
        sup = sup_res.scalar_one_or_none()

        allocs_res = await db.execute(
            select(SupplierPaymentOrderAllocation, SupplierInvoice)
            .join(SupplierInvoice, SupplierInvoice.id == SupplierPaymentOrderAllocation.invoice_id)
            .where(SupplierPaymentOrderAllocation.payment_order_id == o.id)
        )
        allocs_list = []
        for alloc, inv in allocs_res.all():
            allocs_list.append({
                "id": str(alloc.id),
                "invoice_id": str(alloc.invoice_id),
                "numero_factura": inv.numero_factura if inv else "Factura",
                "timbrado": inv.timbrado if inv else "",
                "monto_aplicado": float(alloc.monto_aplicado or 0),
                "monto_retencion": float(alloc.monto_retencion or 0),
                "saldo_anterior": float(alloc.saldo_anterior or 0),
                "saldo_restante": float(alloc.saldo_restante or 0),
            })
            total_facturas_pyg += Decimal(str(alloc.monto_aplicado or 0))

        disb_res = await db.execute(
            select(SupplierPaymentOrderDisbursement)
            .where(SupplierPaymentOrderDisbursement.payment_order_id == o.id)
        )
        disbs_db = list(disb_res.scalars().all())
        disbs_list = []
        for d in disbs_db:
            if d.forma_pago == "diferencia_cambio":
                continue
            disbs_list.append({
                "id": str(d.id),
                "forma_pago": d.forma_pago,
                "monto": float(d.monto or 0),
                "moneda": d.moneda,
                "tipo_cambio": float(d.tipo_cambio or 1),
                "monto_pyg": float(d.monto_pyg or 0),
                "numero_cheque": d.numero_cheque,
                "banco_cheque": d.banco_cheque,
                "titular_cheque": d.titular_cheque,
                "referencia_transferencia": d.referencia_transferencia,
            })
            if not instrument_data:
                instrument_data["tipo"] = d.forma_pago
                if d.forma_pago == "cheque":
                    instrument_data["numero_cheque"] = d.numero_cheque
                    instrument_data["banco_cheque"] = d.banco_cheque
                    instrument_data["titular_cheque"] = d.titular_cheque
                    instrument_data["fecha_emision"] = d.fecha_cheque_emision or o.fecha_emision
                    instrument_data["fecha_vencimiento"] = d.fecha_cheque_vencimiento or o.fecha_pago
                    instrument_data["es_diferido"] = d.es_cheque_diferido
                    if d.cheque_id:
                        chq_res = await db.execute(select(Cheque).where(Cheque.id == d.cheque_id))
                        chq_obj = chq_res.scalar_one_or_none()
                        if chq_obj:
                            instrument_data["numero_cheque"] = chq_obj.numero
                            instrument_data["banco_cheque"] = chq_obj.banco_emisor
                            instrument_data["titular_cheque"] = chq_obj.beneficiario
                            instrument_data["fecha_emision"] = chq_obj.fecha_emision
                            instrument_data["fecha_vencimiento"] = chq_obj.fecha_pago
                            instrument_data["es_diferido"] = chq_obj.diferido
                            if chq_obj.bank_account_id:
                                b_res = await db.execute(select(BankAccount).where(BankAccount.id == chq_obj.bank_account_id))
                                b_acc = b_res.scalar_one_or_none()
                                if b_acc:
                                    instrument_data["cuenta_bancaria"] = f"{b_acc.banco} ({b_acc.numero_cuenta or 'S/N'})"
                elif d.forma_pago == "transferencia":
                    instrument_data["referencia_transferencia"] = d.referencia_transferencia
                    instrument_data["titular_cheque"] = d.titular_cheque
                    if d.bank_account_id:
                        b_res = await db.execute(select(BankAccount).where(BankAccount.id == d.bank_account_id))
                        b_acc = b_res.scalar_one_or_none()
                        if b_acc:
                            instrument_data["banco"] = b_acc.banco
                            instrument_data["cuenta_bancaria"] = b_acc.numero_cuenta

            if d.moneda and d.moneda != "PYG":
                moneda_ext = d.moneda
                total_moneda_extranjera += Decimal(str(d.monto or 0))

        m_neto = Decimal(str(o.monto_neto or 0))
        m_diff = Decimal(str(o.diferencia_cambio or 0))
        total_desembolsado_pyg += m_neto
        total_diff_pyg += m_diff

        if o.observaciones:
            obs_clean = o.observaciones.replace("[Lote Multi-Proveedor / Brasil]", "").strip()
            if obs_clean and obs_clean not in obs_list:
                obs_list.append(obs_clean)

        if not fecha_operacion:
            fecha_operacion = o.fecha_pago or o.fecha_emision

        orders_data.append({
            "order_id": str(o.id),
            "numero_orden": o.numero_orden,
            "fecha_emision": str(o.fecha_emision),
            "fecha_pago": str(o.fecha_pago or o.fecha_emision),
            "estado": o.estado,
            "supplier_id": str(sup.id) if sup else "",
            "supplier_nombre": sup.razon_social if sup else "Proveedor",
            "supplier_ruc": sup.ruc if sup else "",
            "monto_pyg": float(m_neto),
            "monto_moneda": float(disbs_list[0]["monto"]) if disbs_list else float(m_neto),
            "moneda": disbs_list[0]["moneda"] if disbs_list else "PYG",
            "diferencia_cambio": float(m_diff),
            "recibo_proveedor": o.recibo_proveedor or "-",
            "allocations": allocs_list,
            "disbursements": disbs_list,
        })

    if instrument_data.get("tipo") == "cheque" and instrument_data.get("numero_cheque"):
        identificador = f"CHEQUE #{instrument_data['numero_cheque']}"
    else:
        identificador = f"LOTE-{orders_db[0].numero_orden}-AL-{orders_db[-1].numero_orden}"

    instrument_data["monto_pyg"] = float(total_desembolsado_pyg)

    return {
        "identificador": identificador,
        "fecha_operacion": fecha_operacion,
        "instrument": instrument_data,
        "observaciones_generales": " | ".join(obs_list) if obs_list else "Pago agrupado a proveedores procesado exitosamente.",
        "totales": {
            "total_desembolsado_pyg": float(total_desembolsado_pyg),
            "total_facturas_pyg": float(total_facturas_pyg),
            "total_diferencia_cambio_pyg": float(total_diff_pyg),
            "total_moneda_extranjera": float(total_moneda_extranjera) if total_moneda_extranjera > 0 else None,
            "moneda_extranjera": moneda_ext,
        },
        "orders": orders_data,
    }


async def list_unbilled_purchase_receipts(
    db: AsyncSession,
    company_id: str,
    supplier_id: str | None = None
) -> list[dict]:
    """Lista las recepciones / notas de control interno de depósito que aún no han sido facturadas legalmente."""
    cid = uuid.UUID(company_id)

    # Subconsulta de recepciones ya asociadas a una factura
    invoiced_subq = (
        select(SupplierInvoice.receipt_id)
        .where(SupplierInvoice.company_id == cid, SupplierInvoice.receipt_id.isnot(None))
        .subquery()
    )

    stmt = (
        select(PurchaseReceipt, Supplier.razon_social, Supplier.ruc)
        .outerjoin(Supplier, Supplier.id == PurchaseReceipt.supplier_id)
        .where(
            PurchaseReceipt.company_id == cid,
            PurchaseReceipt.estado != "facturado",
            PurchaseReceipt.estado != "cancelado",
            PurchaseReceipt.id.notin_(select(invoiced_subq))
        )
    )
    if supplier_id:
        stmt = stmt.where(PurchaseReceipt.supplier_id == uuid.UUID(supplier_id))

    stmt = stmt.order_by(PurchaseReceipt.fecha.desc())
    rows = (await db.execute(stmt)).all()

    results = []
    for r, sup_nombre, sup_ruc in rows:
        results.append({
            "id": str(r.id),
            "numero": r.numero,
            "proveedor_ref": r.proveedor_ref or "S/N",
            "supplier_id": str(r.supplier_id) if r.supplier_id else None,
            "supplier_nombre": sup_nombre or "Proveedor No Asignado",
            "supplier_ruc": sup_ruc or "-",
            "fecha": r.fecha.isoformat() if r.fecha else None,
            "total": float(r.total or 0),
            "observaciones": r.observaciones or "",
            "estado": r.estado,
        })
    return results


async def settle_vales_and_pay(
    db: AsyncSession,
    company_id: str,
    payload: SettleValesAndPayRequest,
    user_id: str | None = None,
    user_nombre: str | None = None
) -> dict:
    """Flujo de liquidación en ventanilla para frutihorti / entregas diarias por nota de control interno:
    1. Registra la Factura Legal emitida en el acto de cobro.
    2. Vincula y marca las Notas de Recepción / Vales como facturados.
    3. Emite la Orden de Pago (OP) y liquida en el acto con Bóveda, Fondo Fijo, Cheque o Transferencia.
    """
    cid = uuid.UUID(company_id)
    sup_res = await db.execute(select(Supplier).where(Supplier.id == payload.supplier_id, Supplier.company_id == cid))
    supplier = sup_res.scalar_one_or_none()
    if not supplier:
        raise HTTPException(status_code=404, detail="Proveedor no encontrado.")

    monto_factura = Decimal(str(payload.monto_total_factura))
    if monto_factura <= Decimal("0"):
        raise HTTPException(status_code=400, detail="El monto de la factura debe ser mayor a 0.")

    # 1. Verificar si la factura ya existe para este proveedor
    inv_check = await db.execute(
        select(SupplierInvoice).where(
            SupplierInvoice.company_id == cid,
            SupplierInvoice.supplier_id == supplier.id,
            SupplierInvoice.numero_factura == payload.numero_factura.strip()
        )
    )
    if inv_check.scalar_one_or_none():
        raise HTTPException(
            status_code=400,
            detail=f"Ya existe una factura registrada con el número '{payload.numero_factura}' para este proveedor."
        )

    # 2. Cargar y marcar las recepciones
    vales_refs = []
    total_vales = Decimal("0")
    primary_receipt_id = None

    if payload.receipt_ids:
        rc_res = await db.execute(
            select(PurchaseReceipt).where(
                PurchaseReceipt.id.in_(payload.receipt_ids),
                PurchaseReceipt.company_id == cid
            )
        )
        receipts = list(rc_res.scalars().all())
        for rc in receipts:
            rc.estado = "facturado"
            ref_str = rc.proveedor_ref or rc.numero
            vales_refs.append(ref_str)
            total_vales += Decimal(str(rc.total or 0))
            rc.observaciones = f"Facturado con Factura {payload.numero_factura} el {payload.fecha_factura}. {rc.observaciones or ''}".strip()
        if receipts:
            primary_receipt_id = receipts[0].id

    for v in payload.vales_adicionales:
        vales_refs.append(v.numero_vale or v.descripcion)
        total_vales += Decimal(str(v.monto or 0))

    # 3. Crear Factura Legal
    vales_summary = ", ".join(vales_refs) if vales_refs else "Entregas varias"
    invoice = SupplierInvoice(
        company_id=cid,
        supplier_id=supplier.id,
        numero_factura=payload.numero_factura.strip(),
        timbrado=payload.timbrado,
        cdc=payload.cdc,
        fecha_emision=payload.fecha_factura,
        fecha_recepcion=payload.fecha_factura,
        fecha_vencimiento=payload.fecha_factura,
        total=monto_factura,
        saldo_pendiente=Decimal("0"),
        moneda="PYG",
        tipo_cambio=Decimal("1"),
        receipt_id=primary_receipt_id,
        condicion=payload.condicion or "contado",
        tipo_comprobante="factura",
        estado="pagada",
        concepto=f"Liquidación Frutihorti / Vales: {vales_summary}"[:300],
        created_by=uuid.UUID(user_id) if user_id else None,
    )
    db.add(invoice)
    await db.flush()

    # 4. Crear Orden de Pago (OP)
    num_orden = await _generate_order_number(db, cid)
    op = SupplierPaymentOrder(
        company_id=cid,
        supplier_id=supplier.id,
        numero_orden=num_orden,
        fecha_emision=_today(),
        fecha_pago=payload.fecha_factura or _today(),
        estado="pagado",
        moneda="PYG",
        monto_total=monto_factura,
        monto_retenido=Decimal("0"),
        monto_neto=monto_factura,
        observaciones=f"[Liquidación Vales / Frutihorti] Factura {invoice.numero_factura} — Vales: {vales_summary}. {payload.observaciones or ''}".strip(),
        recibo_proveedor=payload.recibo_proveedor,
        created_by=uuid.UUID(user_id) if user_id else None,
    )
    db.add(op)
    await db.flush()

    # 5. Allocation & Pago Factura
    db.add(SupplierPaymentOrderAllocation(
        payment_order_id=op.id,
        invoice_id=invoice.id,
        monto_aplicado=monto_factura,
        monto_retencion=Decimal("0"),
        saldo_anterior=monto_factura,
        saldo_restante=Decimal("0"),
    ))

    db.add(SupplierInvoicePayment(
        invoice_id=invoice.id,
        payment_method="orden_de_pago",
        monto=monto_factura,
        moneda="PYG",
        fecha_pago=payload.fecha_factura or _today(),
        referencia=f"{op.numero_orden} (Liquidación Vales)",
        estado="conciliado",
    ))

    # 6. Desembolso
    disb_create = PaymentOrderDisbursementCreate(
        forma_pago=payload.forma_pago,
        monto=monto_factura,
        moneda="PYG",
        tipo_cambio=Decimal("1"),
        bank_account_id=payload.bank_account_id,
        referencia_transferencia=payload.referencia_transferencia,
        petty_cash_fund_id=payload.petty_cash_fund_id,
        cheque_id=payload.cheque_id,
        numero_cheque=payload.numero_cheque,
        banco_cheque=payload.banco_cheque,
        titular_cheque=payload.titular_cheque or supplier.razon_social,
        fecha_cheque_emision=payload.fecha_cheque_emision or _today(),
        fecha_cheque_vencimiento=payload.fecha_cheque_vencimiento or payload.fecha_cheque_emision or _today(),
        es_cheque_diferido=payload.es_cheque_diferido,
        monto_total_cheque=payload.monto_total_cheque,
        observaciones=f"Liquidación Vales Factura {invoice.numero_factura}",
    )

    disburse_payload = SupplierPaymentOrderDisburse(
        fecha_pago=payload.fecha_factura or _today(),
        recibo_proveedor=payload.recibo_proveedor,
        observaciones=f"Liquidación Vales Factura {invoice.numero_factura}",
        disbursements=[disb_create],
    )

    await _execute_disbursements_internal(
        db=db,
        order=op,
        supplier=supplier,
        payload=disburse_payload,
        user_id=user_id,
        user_nombre=user_nombre
    )

    await db.commit()

    return {
        "success": True,
        "message": f"Se liquidaron exitosamente las notas de entrega contra la Factura {invoice.numero_factura} y se emitió la Orden de Pago {op.numero_orden}.",
        "order_id": str(op.id),
        "numero_orden": op.numero_orden,
        "invoice_id": str(invoice.id),
        "numero_factura": invoice.numero_factura,
        "monto_total": float(monto_factura),
        "total_vales_liquidados": len(vales_refs),
    }



