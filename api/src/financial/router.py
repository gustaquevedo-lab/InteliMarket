"""Financial API router — AP, banking, cash flow, budgets, payment runs, dashboards"""

from fastapi import APIRouter, Depends, HTTPException, Query, status, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import date

from api.src.db import get_db
from sqlalchemy import text
from fastapi.responses import StreamingResponse
from api.src.integrated_finance import pdf_reports
from api.src.financial import pdf_reports as bancos_pdf_reports
from api.src.financial import ap_pdf_reports
from api.src.auth.middleware import require_auth
from api.src.financial.schemas import (
    SupplierInvoiceCreate, SupplierInvoiceResponse, SupplierInvoiceWithPayments,
    SupplierInvoicePaymentCreate, SupplierInvoicePaymentResponse,
    BankAccountCreate, BankAccountUpdate, BankAccountResponse,
    BankTransactionCreate, BankTransactionImport, BankTransactionResponse,
    ReconcileRequest,
    BulkReconcileRequest,
    BalanceCorrectionCreate, BalanceCorrectionDecision, BankBalanceCorrectionResponse,
    CashFlowProjectionResponse, CashFlowProjectionUpdate,
    BudgetCreate, BudgetUpdate, BudgetResponse, BudgetVsActual,
    PaymentRunCreate, PaymentRunResponse, PaymentRunWithItems, PaymentRunItemResponse,
    APPaymentRejectRequest,
    CashFlowAlertConfig,
)
from api.src.financial import service

router = APIRouter(prefix="/api/v1/financial", tags=["financial"])


async def _get_company_info(db: AsyncSession, company_id: str) -> dict:
    r = await db.execute(text("SELECT razon_social, ruc, logo_url FROM companies WHERE id = :cid"), {"cid": company_id})
    row = r.first()
    return {"razon_social": row.razon_social, "ruc": row.ruc, "logo_url": row.logo_url} if row else {"razon_social": "Empresa", "ruc": "N/A"}


# ── AP: Supplier Invoices ──────────────────────────────────────────────────────

@router.post("/invoices", response_model=SupplierInvoiceResponse, status_code=status.HTTP_201_CREATED)
async def create_invoice(body: SupplierInvoiceCreate, user_id: str | None = Query(None), db: AsyncSession = Depends(get_db)):
    return await service.create_invoice(db, body, user_id)


@router.get("/invoices", response_model=list[SupplierInvoiceResponse])
async def list_invoices(
    company_id: str = Query(),
    estado: str | None = Query(None),
    supplier_id: str | None = Query(None),
    vencidas: bool | None = Query(None),
    desde: date | None = Query(None),
    hasta: date | None = Query(None),
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    return await service.list_invoices(db, company_id, estado, supplier_id, vencidas, desde, hasta, limit, offset)


@router.get("/invoices/{invoice_id}", response_model=SupplierInvoiceWithPayments)
async def get_invoice(invoice_id: str, db: AsyncSession = Depends(get_db)):
    invoice = await service.get_invoice_with_payments(db, invoice_id)
    if not invoice:
        raise HTTPException(status_code=404, detail="Factura no encontrada")
    return invoice


@router.get("/invoices/by-receipt/{receipt_id}", response_model=dict)
async def get_invoice_by_receipt(receipt_id: str, db: AsyncSession = Depends(get_db)):
    invoice = await service.get_invoice_by_receipt(db, receipt_id)
    if not invoice:
        return {"found": False}
    return {"found": True, "id": str(invoice.id), "numero_factura": invoice.numero_factura, "total": float(invoice.total), "estado": invoice.estado}


@router.post("/invoices/{invoice_id}/approve", response_model=SupplierInvoiceResponse)
async def approve_invoice(invoice_id: str, user_id: str | None = Query(None), db: AsyncSession = Depends(get_db)):
    result = await service.approve_invoice(db, invoice_id, user_id)
    if not result:
        raise HTTPException(status_code=400, detail="No se pudo aprobar. Verifique el estado actual")
    return result


@router.post("/invoices/{invoice_id}/pay", response_model=dict)
async def pay_invoice(invoice_id: str, body: SupplierInvoicePaymentCreate, user_id: str | None = Query(None), db: AsyncSession = Depends(get_db)):
    result = await service.register_payment_gated(db, invoice_id, body, user_id)
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    if result["pending_approval"]:
        return {"pending_approval": True, "request_id": str(result["request"].id), "monto": float(result["request"].monto)}
    payment = result["payment"]
    return {"pending_approval": False, "id": str(payment.id), "invoice_id": str(payment.invoice_id), "monto": float(payment.monto), "estado": payment.estado}


@router.get("/aging", response_model=dict)
async def get_aging(company_id: str = Query(), db: AsyncSession = Depends(get_db)):
    return await service.get_ap_aging(db, company_id)


@router.get("/dashboard", response_model=dict)
async def get_ap_dashboard(company_id: str = Query(), db: AsyncSession = Depends(get_db)):
    return await service.get_ap_dashboard(db, company_id)


@router.get("/ap/payment-queue", response_model=dict)
async def get_payment_queue(company_id: str = Query(), db: AsyncSession = Depends(get_db)):
    return await service.get_payment_queue(db, company_id)


@router.get("/suppliers/{supplier_id}/statement.pdf")
async def supplier_statement_pdf(supplier_id: str, company_id: str = Query(...), db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    sup_r = await db.execute(text("SELECT razon_social, ruc FROM suppliers WHERE id = :id"), {"id": supplier_id})
    sup = sup_r.first()
    if not sup:
        raise HTTPException(404, "Proveedor no encontrado")

    docs_r = await db.execute(
        text("""
            SELECT numero_factura, fecha_emision, fecha_vencimiento, total, saldo_pendiente
            FROM supplier_invoices
            WHERE company_id = :cid AND supplier_id = :sup_id AND estado IN ('pendiente', 'aprobada', 'parcial')
            ORDER BY fecha_vencimiento
        """),
        {"cid": company_id, "sup_id": supplier_id},
    )
    from datetime import date as _date
    today = _date.today()
    documentos = []
    for r in docs_r.all():
        dias_mora = (today - r.fecha_vencimiento).days if r.fecha_vencimiento and r.fecha_vencimiento < today else None
        documentos.append({
            "numero": r.numero_factura or "-",
            "fecha_emision": r.fecha_emision.strftime("%d/%m/%Y") if r.fecha_emision else "-",
            "fecha_vencimiento": r.fecha_vencimiento.strftime("%d/%m/%Y") if r.fecha_vencimiento else "-",
            "monto_original": float(r.total or 0),
            "saldo_pendiente": float(r.saldo_pendiente or 0),
            "dias_mora": dias_mora,
        })

    comp_r = await db.execute(text("SELECT razon_social, ruc, logo_url FROM companies WHERE id = :cid"), {"cid": company_id})
    comp = comp_r.first()
    company = {"razon_social": comp.razon_social, "ruc": comp.ruc, "logo_url": comp.logo_url} if comp else {"razon_social": "Empresa", "ruc": "N/A"}
    generated_by = user.get("user_nombre") or user.get("user_email") or "Sistema"

    pdf_bytes = pdf_reports.generate_account_statement_pdf(
        company, {"nombre": sup.razon_social, "ruc": sup.ruc}, "proveedor", documentos, generated_by
    )
    return StreamingResponse(
        iter([pdf_bytes]),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename=estado_cuenta_proveedor_{supplier_id[:8]}.pdf",
            "Content-Length": str(len(pdf_bytes)),
        },
    )


# ── Banking ────────────────────────────────────────────────────────────────────

@router.post("/banks", response_model=BankAccountResponse, status_code=status.HTTP_201_CREATED)
async def create_bank_account(body: BankAccountCreate, db: AsyncSession = Depends(get_db)):
    return await service.create_bank_account(db, body)


@router.get("/banks", response_model=list[BankAccountResponse])
async def list_bank_accounts(company_id: str = Query(), db: AsyncSession = Depends(get_db)):
    return await service.list_bank_accounts(db, company_id)


@router.get("/banks/dashboard", response_model=dict)
async def get_bank_dashboard(company_id: str = Query(), db: AsyncSession = Depends(get_db)):
    return await service.get_bank_dashboard(db, company_id)


@router.get("/banks/cash-position", response_model=dict)
async def get_cash_position(company_id: str = Query(), db: AsyncSession = Depends(get_db)):
    return await service.get_cash_position(db, company_id)


@router.get("/banks/outstanding-items", response_model=dict)
async def get_outstanding_items(company_id: str = Query(), db: AsyncSession = Depends(get_db)):
    return await service.get_outstanding_items(db, company_id)


# ── Reportes PDF (Bancos Fase 7) ────────────────────────────────────────────

@router.get("/banks/{account_id}/export/reconciliation.pdf")
async def export_reconciliation_pdf(
    account_id: str, company_id: str = Query(), desde: date | None = Query(None), hasta: date | None = Query(None),
    db: AsyncSession = Depends(get_db), user=Depends(require_auth),
):
    try:
        reporte = await service.get_reconciliation_report(db, company_id, account_id, desde, hasta)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    company = await _get_company_info(db, company_id)
    generated_by = user.get("user_nombre") or user.get("user_email") or "Sistema"
    pdf_bytes = bancos_pdf_reports.generate_reconciliation_pdf(company, reporte["account"], reporte, desde, hasta, generated_by)
    return StreamingResponse(
        iter([pdf_bytes]), media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=conciliacion_bancaria_{account_id[:8]}.pdf", "Content-Length": str(len(pdf_bytes))},
    )


@router.get("/banks/export/cash-position.pdf")
async def export_cash_position_pdf(company_id: str = Query(), db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    cash_position = await service.get_cash_position(db, company_id)
    company = await _get_company_info(db, company_id)
    generated_by = user.get("user_nombre") or user.get("user_email") or "Sistema"
    pdf_bytes = bancos_pdf_reports.generate_cash_position_pdf(company, cash_position, generated_by)
    return StreamingResponse(
        iter([pdf_bytes]), media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=posicion_de_caja.pdf", "Content-Length": str(len(pdf_bytes))},
    )


@router.get("/ap/export/aging.pdf")
async def export_ap_aging_pdf(company_id: str = Query(), db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    aging = await service.get_ap_aging(db, company_id)
    company = await _get_company_info(db, company_id)
    generated_by = user.get("user_nombre") or user.get("user_email") or "Sistema"
    pdf_bytes = ap_pdf_reports.generate_ap_aging_pdf(company, aging, generated_by)
    return StreamingResponse(
        iter([pdf_bytes]), media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=antiguedad_saldos_ap.pdf", "Content-Length": str(len(pdf_bytes))},
    )


@router.get("/ap/export/top-suppliers.pdf")
async def export_top_suppliers_pdf(
    company_id: str = Query(), desde: date | None = Query(None), hasta: date | None = Query(None),
    db: AsyncSession = Depends(get_db), user=Depends(require_auth),
):
    report = await service.get_top_suppliers_report(db, company_id, desde, hasta)
    company = await _get_company_info(db, company_id)
    generated_by = user.get("user_nombre") or user.get("user_email") or "Sistema"
    pdf_bytes = ap_pdf_reports.generate_top_suppliers_pdf(company, report, desde, hasta, generated_by)
    return StreamingResponse(
        iter([pdf_bytes]), media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=top_proveedores_dpo.pdf", "Content-Length": str(len(pdf_bytes))},
    )


@router.get("/banks/transactions", response_model=list[BankTransactionResponse])
async def list_all_bank_transactions(
    company_id: str = Query(),
    categoria: str | None = Query(None),
    conciliado: bool | None = Query(None),
    desde: date | None = Query(None),
    hasta: date | None = Query(None),
    limit: int = Query(200, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    """Movimientos bancarios de todas las cuentas de la empresa, sin filtrar por cuenta.

    Registrada antes de /banks/{account_id} — Starlette resuelve rutas en orden
    de registro, y "transactions" caía en ese account_id (ValueError: badly
    formed hexadecimal UUID string) cuando este endpoint estaba más abajo.
    """
    return await service.list_bank_transactions(db, company_id, None, conciliado, desde, hasta, categoria, limit, offset)


@router.get("/banks/balance-corrections", response_model=list[BankBalanceCorrectionResponse])
async def list_balance_corrections(company_id: str = Query(), estado: str | None = Query("pendiente"), db: AsyncSession = Depends(get_db)):
    """Registrada antes de /banks/{account_id} — mismo problema de orden de
    rutas que /banks/transactions: "balance-corrections" caía en account_id
    (ValueError: badly formed hexadecimal UUID string) cuando este endpoint
    estaba más abajo, junto con los otros endpoints de Bancos Fase 5."""
    return await service.list_balance_corrections(db, company_id, estado)


@router.get("/banks/{account_id}", response_model=BankAccountResponse)
async def get_bank_account(account_id: str, db: AsyncSession = Depends(get_db)):
    account = await service.get_bank_account(db, account_id)
    if not account:
        raise HTTPException(status_code=404, detail="Cuenta bancaria no encontrada")
    return account


@router.put("/banks/{account_id}", response_model=BankAccountResponse)
async def update_bank_account(account_id: str, body: BankAccountUpdate, db: AsyncSession = Depends(get_db)):
    result = await service.update_bank_account(db, account_id, body)
    if not result:
        raise HTTPException(status_code=404, detail="Cuenta bancaria no encontrada")
    return result


@router.delete("/banks/{account_id}")
async def delete_bank_account(account_id: str, db: AsyncSession = Depends(get_db)):
    deleted = await service.delete_bank_account(db, account_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Cuenta bancaria no encontrada")
    return {"message": "Cuenta bancaria eliminada"}


@router.get("/banks/{account_id}/transactions", response_model=list[BankTransactionResponse])
async def list_bank_transactions(
    account_id: str,
    company_id: str = Query(),
    conciliado: bool | None = Query(None),
    desde: date | None = Query(None),
    hasta: date | None = Query(None),
    categoria: str | None = Query(None),
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    return await service.list_bank_transactions(db, company_id, account_id, conciliado, desde, hasta, categoria, limit, offset)


@router.post("/banks/{account_id}/import", response_model=list[BankTransactionResponse])
async def import_bank_statement(
    account_id: str,
    company_id: str = Query(),
    body: BankTransactionImport = ...,
    db: AsyncSession = Depends(get_db),
):
    return await service.import_bank_statement(db, company_id, account_id, body.transactions)


# ── Carga real de extractos bancarios (Bancos Fase 6) ──────────────────────────

@router.post("/banks/{account_id}/import-file/preview")
async def preview_import_bank_statement_file(
    account_id: str,
    mes: int = Form(...),
    anio: int = Form(...),
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    if not file.filename.lower().endswith((".xlsx", ".xls")):
        raise HTTPException(status_code=400, detail="Solo se aceptan archivos Excel (.xlsx/.xls)")
    content = await file.read()
    try:
        return await service.preview_bank_statement_file(db, account_id, content, mes, anio)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/banks/{account_id}/import-file")
async def import_bank_statement_file(
    account_id: str,
    company_id: str = Form(...),
    mes: int = Form(...),
    anio: int = Form(...),
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    if not file.filename.lower().endswith((".xlsx", ".xls")):
        raise HTTPException(status_code=400, detail="Solo se aceptan archivos Excel (.xlsx/.xls)")
    content = await file.read()
    try:
        return await service.import_bank_statement_file(db, company_id, account_id, content, mes, anio)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ── Verificación de saldo y correcciones (Bancos Fase 5) ───────────────────────

@router.post("/banks/{account_id}/verify-balance", response_model=BankAccountResponse)
async def verify_balance(account_id: str, db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    result = await service.verify_bank_balance(db, account_id, user["id"])
    if not result:
        raise HTTPException(status_code=404, detail="Cuenta bancaria no encontrada")
    return result


@router.post("/banks/{account_id}/request-correction", status_code=status.HTTP_201_CREATED)
async def request_balance_correction(account_id: str, body: BalanceCorrectionCreate, db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    result = await service.request_balance_correction(db, account_id, body.saldo_propuesto, body.motivo, str(user["id"]))
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return {"success": True, "request_id": str(result["request"].id)}


@router.post("/banks/balance-corrections/{request_id}/approve")
async def approve_balance_correction(request_id: str, db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    result = await service.approve_balance_correction(db, request_id, user["id"], user["tenant_id"])
    if "error" in result:
        raise HTTPException(status_code=403 if "No autorizado" in result["error"] else 400, detail=result["error"])
    return {"success": True, "completo": result["completo"]}


@router.post("/banks/balance-corrections/{request_id}/reject")
async def reject_balance_correction(request_id: str, body: BalanceCorrectionDecision, db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    result = await service.reject_balance_correction(db, request_id, user["id"], user["tenant_id"], body.motivo)
    if "error" in result:
        raise HTTPException(status_code=403 if "No autorizado" in result["error"] else 400, detail=result["error"])
    return {"success": True}


@router.get("/transactions/{transaction_id}/suggestions")
async def suggest_matches(transaction_id: str, company_id: str = Query(...), db: AsyncSession = Depends(get_db)):
    return await service.suggest_reconciliation_matches(db, company_id, transaction_id)


@router.post("/transactions/{transaction_id}/reconcile", response_model=BankTransactionResponse)
async def reconcile_transaction(transaction_id: str, body: ReconcileRequest, db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    matched_id = str(body.matched_id) if body.matched_id else None
    result = await service.reconcile_transaction(
        db, transaction_id, body.matched_type, matched_id,
        user.get("id") or user.get("sub"), user.get("user_nombre"),
    )
    if not result:
        raise HTTPException(status_code=404, detail="Transacción no encontrada")
    return result


@router.post("/transactions/bulk-reconcile")
async def bulk_reconcile(body: BulkReconcileRequest, db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    matches = [
        {"transaction_id": str(m.transaction_id), "matched_type": m.matched_type, "matched_id": str(m.matched_id) if m.matched_id else None}
        for m in body.matches
    ]
    return await service.bulk_reconcile(db, matches, user.get("id") or user.get("sub"), user.get("user_nombre"))


@router.post("/transactions/{transaction_id}/unreconcile", response_model=BankTransactionResponse)
async def unreconcile_transaction(transaction_id: str, db: AsyncSession = Depends(get_db)):
    result = await service.unreconcile_transaction(db, transaction_id)
    if not result:
        raise HTTPException(status_code=404, detail="Transacción no encontrada")
    return result


# ── Cash Flow ──────────────────────────────────────────────────────────────────

@router.get("/cash-flow", response_model=list[CashFlowProjectionResponse])
async def list_projections(
    company_id: str = Query(),
    desde: date | None = Query(None),
    hasta: date | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    return await service.get_projections(db, company_id, desde, hasta)


@router.post("/cash-flow/generate", response_model=list[CashFlowProjectionResponse])
async def generate_cash_flow(
    company_id: str = Query(),
    dias: int = Query(90, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
):
    return await service.generate_projection(db, company_id, dias)


@router.post("/cash-flow/{projection_id}", response_model=CashFlowProjectionResponse)
async def update_projection(projection_id: str, body: CashFlowProjectionUpdate, db: AsyncSession = Depends(get_db)):
    result = await service.update_projection(db, projection_id, body)
    if not result:
        raise HTTPException(status_code=404, detail="Proyección no encontrada")
    return result


@router.get("/cash-flow/dashboard", response_model=dict)
async def get_cash_flow_dashboard(company_id: str = Query(), db: AsyncSession = Depends(get_db)):
    return await service.get_cash_flow_dashboard(db, company_id)


@router.get("/cash-flow/alert-config", response_model=CashFlowAlertConfig)
async def get_cash_flow_alert_config(company_id: str = Query(), db: AsyncSession = Depends(get_db)):
    return await service.get_cash_flow_alert_config(db, company_id)


@router.put("/cash-flow/alert-config", response_model=CashFlowAlertConfig)
async def update_cash_flow_alert_config(body: CashFlowAlertConfig, company_id: str = Query(), db: AsyncSession = Depends(get_db)):
    return await service.update_cash_flow_alert_config(db, company_id, body)


@router.post("/cash-flow/alert-check", response_model=dict)
async def trigger_cash_flow_alert_check(company_id: str = Query(), db: AsyncSession = Depends(get_db)):
    return await service.check_negative_cash_flow_alert(db, company_id)


# ── Budgets ────────────────────────────────────────────────────────────────────

@router.post("/budgets", response_model=BudgetResponse, status_code=status.HTTP_201_CREATED)
async def create_budget(body: BudgetCreate, db: AsyncSession = Depends(get_db)):
    return await service.create_budget(db, body)


@router.get("/budgets", response_model=list[BudgetResponse])
async def list_budgets(
    company_id: str = Query(),
    periodo: str | None = Query(None),
    area: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    return await service.list_budgets(db, company_id, periodo, area)


@router.put("/budgets/{budget_id}", response_model=BudgetResponse)
async def update_budget(budget_id: str, body: BudgetUpdate, db: AsyncSession = Depends(get_db)):
    result = await service.update_budget(db, budget_id, body)
    if not result:
        raise HTTPException(status_code=404, detail="Presupuesto no encontrado")
    return result


@router.delete("/budgets/{budget_id}")
async def delete_budget(budget_id: str, db: AsyncSession = Depends(get_db)):
    deleted = await service.delete_budget(db, budget_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Presupuesto no encontrado")
    return {"message": "Presupuesto eliminado"}


@router.get("/budgets/vs-actual", response_model=list[BudgetVsActual])
async def get_budget_vs_actual(company_id: str = Query(), periodo: str = Query(), db: AsyncSession = Depends(get_db)):
    return await service.get_budget_vs_actual(db, company_id, periodo)


# ── Payment Runs ───────────────────────────────────────────────────────────────

@router.get("/ap/payable-invoices", response_model=list[dict])
async def get_payable_invoices(
    company_id: str = Query(), supplier_id: str | None = Query(None), hasta: date | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    return await service.get_payable_invoices(db, company_id, supplier_id, hasta)


@router.post("/payment-runs", response_model=PaymentRunResponse, status_code=status.HTTP_201_CREATED)
async def create_payment_run(body: PaymentRunCreate, db: AsyncSession = Depends(get_db)):
    result = await service.create_payment_run(db, body)
    if isinstance(result, dict) and "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result


@router.get("/payment-runs", response_model=list[PaymentRunResponse])
async def list_payment_runs(company_id: str = Query(), db: AsyncSession = Depends(get_db)):
    return await service.list_payment_runs(db, company_id)


@router.get("/payment-runs/{run_id}", response_model=PaymentRunWithItems)
async def get_payment_run(run_id: str, db: AsyncSession = Depends(get_db)):
    run = await service.get_payment_run_with_items(db, run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Lote de pago no encontrado")
    return run


@router.post("/payment-runs/{run_id}/execute", response_model=dict)
async def execute_payment_run(
    run_id: str,
    user_id: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    result = await service.execute_payment_run_gated(db, run_id, user_id)
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    if result["pending_approval"]:
        return {"pending_approval": True, "request_id": str(result["request"].id), "monto": float(result["request"].monto)}
    run = result["run"]
    return {"pending_approval": False, "id": str(run.id), "estado": run.estado, "total_monto": float(run.total_monto)}


# ── Aprobación de pagos grandes (Cuentas por Pagar Fase 3) ──────────────────────

@router.get("/ap/approvals", response_model=list[dict])
async def list_ap_approvals(company_id: str = Query(), estado: str | None = Query("pendiente"), db: AsyncSession = Depends(get_db)):
    requests = await service.list_ap_approvals(db, company_id, estado)
    return [
        {
            "id": str(r.id), "entidad_tipo": r.entidad_tipo, "entidad_id": str(r.entidad_id),
            "monto": float(r.monto), "estado": r.estado,
            "aprobado_supervisor_id": str(r.aprobado_supervisor_id) if r.aprobado_supervisor_id else None,
            "aprobado_gerente_id": str(r.aprobado_gerente_id) if r.aprobado_gerente_id else None,
            "created_at": r.created_at,
        }
        for r in requests
    ]


@router.post("/ap/approvals/{request_id}/approve")
async def approve_ap_payment(request_id: str, db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    result = await service.approve_ap_payment(db, request_id, user["id"], user["tenant_id"])
    if "error" in result:
        raise HTTPException(status_code=403 if "No autorizado" in result["error"] else 400, detail=result["error"])
    return {"success": True, "completo": result["completo"]}


@router.post("/ap/approvals/{request_id}/reject")
async def reject_ap_payment(request_id: str, body: APPaymentRejectRequest, db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    result = await service.reject_ap_payment(db, request_id, user["id"], user["tenant_id"], body.motivo)
    if "error" in result:
        raise HTTPException(status_code=403 if "No autorizado" in result["error"] else 400, detail=result["error"])
    return {"success": True}


# ── Consolidated ───────────────────────────────────────────────────────────────

@router.get("/financial-dashboard", response_model=dict)
async def get_financial_dashboard(company_id: str = Query(), db: AsyncSession = Depends(get_db)):
    return await service.get_financial_dashboard(db, company_id)


@router.get("/ratios", response_model=dict)
async def get_financial_ratios(company_id: str = Query(), db: AsyncSession = Depends(get_db)):
    return await service.get_financial_ratios(db, company_id)


# ── Supplier Credit Notes ────────────────────────────────────────────────────

@router.get("/supplier-credit-notes")
async def list_supplier_credit_notes(company_id: str = Query(), supplier_id: str | None = Query(None), db: AsyncSession = Depends(get_db)):
    return await service.list_supplier_credit_notes(db, company_id, supplier_id)


# ── Supplier Returns (devoluciones a proveedor) ─────────────────────────────

@router.get("/supplier-returns")
async def list_supplier_returns(company_id: str = Query(), supplier_id: str | None = Query(None), db: AsyncSession = Depends(get_db)):
    return await service.list_supplier_returns(db, company_id, supplier_id)


# ── Nomina (rh_movimento) ────────────────────────────────────────────────────

@router.get("/payroll/by-concepto")
async def payroll_by_concepto(
    company_id: str = Query(),
    fecha_desde: date | None = Query(None),
    fecha_hasta: date | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    return await service.get_payroll_by_concepto(db, company_id, fecha_desde, fecha_hasta)


@router.get("/payroll-movements")
async def list_payroll_movements(company_id: str = Query(), empleado_nombre: str | None = Query(None), db: AsyncSession = Depends(get_db)):
    return await service.list_payroll_movements(db, company_id, empleado_nombre)
