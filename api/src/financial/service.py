"""Financial service — AP, banking, cash flow, budgets, payment runs, dashboards"""

from sqlalchemy import select, func, and_, or_, text, case
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime, timezone, date, timedelta
from decimal import Decimal
import json
import uuid

from api.src.financial.models import (
    SupplierInvoice, SupplierInvoicePayment,
    BankAccount, BankTransaction,
    BankBalanceCorrectionRequest,
    APPaymentApprovalRequest,
    CashFlowProjection, Budget,
    PaymentRun, PaymentRunItem,
    SupplierCreditNote, SupplierReturn, PayrollMovement,
)
from api.src.financial.schemas import (
    SupplierInvoiceCreate, SupplierInvoicePaymentCreate,
    BankAccountCreate, BankAccountUpdate,
    CashFlowProjectionUpdate,
    BudgetCreate, BudgetUpdate,
    PaymentRunCreate,
    CashFlowAlertConfig,
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

async def get_payable_invoices(db: AsyncSession, company_id: str, supplier_id: str | None, hasta: date | None) -> list[dict]:
    """Candidatas para armar un lote de pago a mano (Cuentas por Pagar Fase
    2) -- no crea nada, solo lista. Reemplaza la auto-seleccion ciega que
    tenia create_payment_run (agarraba TODAS las vencidas de una, sin que
    nadie eligiera nada)."""
    query = select(SupplierInvoice).where(
        SupplierInvoice.company_id == uuid.UUID(company_id),
        SupplierInvoice.estado.in_(["aprobada", "parcial"]),
        SupplierInvoice.bloqueada_para_pago == False,
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
            "supplier_id": str(i.supplier_id),
            "supplier_nombre": sup_map.get(i.supplier_id, "Desconocido"),
            "fecha_vencimiento": i.fecha_vencimiento.isoformat(),
            "saldo_pendiente": i.saldo_pendiente,
            "moneda": i.moneda,
            "dias_vencido": (today - i.fecha_vencimiento).days if i.fecha_vencimiento < today else 0,
        }
        for i in invoices
    ]


async def create_payment_run(db: AsyncSession, data: PaymentRunCreate) -> PaymentRun | dict:
    """Crea un lote de pago SOLO con las facturas que el usuario eligio a
    mano (data.invoice_ids) y que estén estrictamente APROBADAS y NO bloqueadas
    por falta de Nota de Crédito o discrepancias en muelle."""
    invoices_result = await db.execute(
        select(SupplierInvoice).where(
            SupplierInvoice.id.in_(data.invoice_ids),
            SupplierInvoice.company_id == data.company_id,
            SupplierInvoice.estado.in_(["aprobada", "parcial"]),
            SupplierInvoice.bloqueada_para_pago == False,
            SupplierInvoice.saldo_pendiente > 0,
        )
    )
    invoices = list(invoices_result.scalars().all())
    if not invoices:
        return {"error": "Ninguna de las facturas seleccionadas es válida para pago (deben estar APROBADAS por 3-Way Match y sin retenciones de NC pendientes)."}


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
            "fecha": note.fecha.isoformat(),
            "motivo": note.motivo,
            "monto": float(note.monto),
            "moneda": note.moneda,
            "observaciones": note.observaciones,
        }
        for note, razon_social in result.all()
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
