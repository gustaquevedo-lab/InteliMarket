"""Financial API router — AP, banking, cash flow, budgets, payment runs, dashboards"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import date

from api.src.db import get_db
from api.src.financial.schemas import (
    SupplierInvoiceCreate, SupplierInvoiceResponse, SupplierInvoiceWithPayments,
    SupplierInvoicePaymentCreate, SupplierInvoicePaymentResponse,
    BankAccountCreate, BankAccountUpdate, BankAccountResponse,
    BankTransactionCreate, BankTransactionImport, BankTransactionResponse,
    ReconcileRequest,
    CashFlowProjectionResponse, CashFlowProjectionUpdate,
    BudgetCreate, BudgetUpdate, BudgetResponse, BudgetVsActual,
    PaymentRunCreate, PaymentRunResponse, PaymentRunWithItems, PaymentRunItemResponse,
)
from api.src.financial import service

router = APIRouter(prefix="/api/v1/financial", tags=["financial"])


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


@router.post("/invoices/{invoice_id}/approve", response_model=SupplierInvoiceResponse)
async def approve_invoice(invoice_id: str, user_id: str | None = Query(None), db: AsyncSession = Depends(get_db)):
    result = await service.approve_invoice(db, invoice_id, user_id)
    if not result:
        raise HTTPException(status_code=400, detail="No se pudo aprobar. Verifique el estado actual")
    return result


@router.post("/invoices/{invoice_id}/pay", response_model=SupplierInvoicePaymentResponse)
async def pay_invoice(invoice_id: str, body: SupplierInvoicePaymentCreate, db: AsyncSession = Depends(get_db)):
    result = await service.register_payment(db, invoice_id, body)
    if not result:
        raise HTTPException(status_code=400, detail="No se pudo registrar el pago")
    payment, _ = result
    return payment


@router.get("/aging", response_model=dict)
async def get_aging(company_id: str = Query(), db: AsyncSession = Depends(get_db)):
    return await service.get_ap_aging(db, company_id)


@router.get("/dashboard", response_model=dict)
async def get_ap_dashboard(company_id: str = Query(), db: AsyncSession = Depends(get_db)):
    return await service.get_ap_dashboard(db, company_id)


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


@router.post("/transactions/{transaction_id}/reconcile", response_model=BankTransactionResponse)
async def reconcile_transaction(transaction_id: str, body: ReconcileRequest, db: AsyncSession = Depends(get_db)):
    result = await service.reconcile_transaction(db, transaction_id, str(body.invoice_id))
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

@router.post("/payment-runs", response_model=PaymentRunResponse, status_code=status.HTTP_201_CREATED)
async def create_payment_run(body: PaymentRunCreate, db: AsyncSession = Depends(get_db)):
    return await service.create_payment_run(db, body)


@router.get("/payment-runs", response_model=list[PaymentRunResponse])
async def list_payment_runs(company_id: str = Query(), db: AsyncSession = Depends(get_db)):
    return await service.list_payment_runs(db, company_id)


@router.get("/payment-runs/{run_id}", response_model=PaymentRunWithItems)
async def get_payment_run(run_id: str, db: AsyncSession = Depends(get_db)):
    run = await service.get_payment_run_with_items(db, run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Lote de pago no encontrado")
    return run


@router.post("/payment-runs/{run_id}/execute", response_model=PaymentRunResponse)
async def execute_payment_run(
    run_id: str,
    user_id: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    result = await service.execute_payment_run(db, run_id, user_id)
    if not result:
        raise HTTPException(status_code=400, detail="No se pudo ejecutar. El lote debe estar en borrador")
    return result


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
