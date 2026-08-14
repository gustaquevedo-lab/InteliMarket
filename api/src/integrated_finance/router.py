"""Integrated Financial Management API — Retenciones, Cierre Contable, Conciliación, Scoring, EBITDA"""

from fastapi import APIRouter, Depends, HTTPException, Query, status, Path
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.db import get_db
from api.src.auth.middleware import require_auth
from api.src.integrated_finance.schemas import (
    WithholdingConfigCreate, WithholdingConfigUpdate, WithholdingConfigResponse,
    WithholdingDocumentCreate, WithholdingDocumentResponse, WithholdingDashboard,
    AccountPlanCreate, AccountPlanResponse,
    AccountingPeriodCreate, AccountingPeriodResponse,
    AccountingEntryCreate, AccountingEntryResponse,
    ManualEntryCreate, ManualEntryResponse,
    PeriodReopenBody,
    EntryReversalBody, EntryReversalResponse,
    CollectionActionCreate, CollectionActionResponse,
    CustomerScoreResponse, EbitdaResponse,
    AutoReconcileResult, ConsolidatedDashboard,
    CashReconciliationResponse, PnlReconciliationResponse,
)
from api.src.integrated_finance import service, auto_posting, pdf_reports
from datetime import date
from fastapi.responses import StreamingResponse
from sqlalchemy import text
import uuid

router = APIRouter(prefix="/api/v1/integrated-finance", tags=["integrated-finance"])

_LEDGER_ROLES = {"Finanzas", "Gerente"}


async def _require_ledger_role(db: AsyncSession, user: dict):
    """Cargar el plan de cuentas, abrir/cerrar periodos y postear asientos son
    acciones contables sensibles -- antes este router no tenia NINGUN control
    de auth ni de rol (company_id llegaba como query param sin validar).
    Se restringe a Finanzas/Gerente, mismo patron ya usado en Caja Chica y AP."""
    from api.src.rbac.service import get_user_roles

    roles = {r["role_name"] for r in await get_user_roles(db, uuid.UUID(user["id"]), uuid.UUID(user["tenant_id"]))}
    if not roles & _LEDGER_ROLES:
        raise HTTPException(status_code=403, detail="Se requiere rol Finanzas o Gerente para esta acción contable")


async def _get_company(db: AsyncSession, company_id: str) -> dict:
    r = await db.execute(text("SELECT razon_social, ruc FROM companies WHERE id = :cid"), {"cid": company_id})
    row = r.first()
    return {"razon_social": row.razon_social, "ruc": row.ruc} if row else {"razon_social": "Empresa", "ruc": "N/A"}


def _pdf_response(pdf_bytes: bytes, filename: str) -> StreamingResponse:
    return StreamingResponse(
        iter([pdf_bytes]),
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}", "Content-Length": str(len(pdf_bytes))},
    )


@router.get("/accounting/pnl/{period_id}/pdf")
async def get_pnl_pdf(period_id: str, company_id: str = Query(...), db: AsyncSession = Depends(get_db)):
    pnl = await service.get_pnl(db, company_id, period_id)
    company = await _get_company(db, company_id)
    pdf_bytes = pdf_reports.generate_pnl_pdf(company, pnl)
    return _pdf_response(pdf_bytes, f"estado_resultados_{pnl.get('periodo', period_id[:8])}.pdf")


@router.get("/accounting/trial-balance/{period_id}/pdf")
async def get_trial_balance_pdf(period_id: str, company_id: str = Query(...), db: AsyncSession = Depends(get_db)):
    tb = await service.get_trial_balance(db, company_id, period_id)
    company = await _get_company(db, company_id)
    pdf_bytes = pdf_reports.generate_trial_balance_pdf(company, tb)
    return _pdf_response(pdf_bytes, f"balance_comprobacion_{tb.get('periodo', period_id[:8])}.pdf")


@router.get("/statement/customer/{customer_id}/pdf")
async def get_customer_statement_pdf(customer_id: str, company_id: str = Query(...), db: AsyncSession = Depends(get_db)):
    cust_r = await db.execute(text("SELECT razon_social, ruc FROM customers WHERE id = :id"), {"id": customer_id})
    cust = cust_r.first()
    if not cust:
        raise HTTPException(404, "Cliente no encontrado")

    docs_r = await db.execute(
        text("""
            SELECT numero_documento, fecha_emision, fecha_vencimiento, monto_original, saldo_pendiente, dias_mora
            FROM accounts_receivable
            WHERE company_id = :cid AND customer_id = :cust_id AND estado = 'pendiente'
            ORDER BY fecha_vencimiento
        """),
        {"cid": company_id, "cust_id": customer_id},
    )
    documentos = [
        {
            "numero": r.numero_documento or "-",
            "fecha_emision": r.fecha_emision.isoformat() if r.fecha_emision else "-",
            "fecha_vencimiento": r.fecha_vencimiento.isoformat() if r.fecha_vencimiento else "-",
            "monto_original": float(r.monto_original or 0),
            "saldo_pendiente": float(r.saldo_pendiente or 0),
            "dias_mora": r.dias_mora,
        }
        for r in docs_r.all()
    ]
    company = await _get_company(db, company_id)
    pdf_bytes = pdf_reports.generate_account_statement_pdf(
        company, {"nombre": cust.razon_social, "ruc": cust.ruc}, "cliente", documentos
    )
    return _pdf_response(pdf_bytes, f"estado_cuenta_cliente_{customer_id[:8]}.pdf")


@router.get("/statement/supplier/{supplier_id}/pdf")
async def get_supplier_statement_pdf(supplier_id: str, company_id: str = Query(...), db: AsyncSession = Depends(get_db)):
    sup_r = await db.execute(text("SELECT razon_social, ruc FROM suppliers WHERE id = :id"), {"id": supplier_id})
    sup = sup_r.first()
    if not sup:
        raise HTTPException(404, "Proveedor no encontrado")

    docs_r = await db.execute(
        text("""
            SELECT numero_factura, fecha_emision, fecha_vencimiento, total, saldo_pendiente
            FROM supplier_invoices
            WHERE company_id = :cid AND supplier_id = :sup_id AND estado = 'pendiente'
            ORDER BY fecha_vencimiento
        """),
        {"cid": company_id, "sup_id": supplier_id},
    )
    documentos = [
        {
            "numero": r.numero_factura or "-",
            "fecha_emision": r.fecha_emision.isoformat() if r.fecha_emision else "-",
            "fecha_vencimiento": r.fecha_vencimiento.isoformat() if r.fecha_vencimiento else "-",
            "monto_original": float(r.total or 0),
            "saldo_pendiente": float(r.saldo_pendiente or 0),
            "dias_mora": None,
        }
        for r in docs_r.all()
    ]
    company = await _get_company(db, company_id)
    pdf_bytes = pdf_reports.generate_account_statement_pdf(
        company, {"nombre": sup.razon_social, "ruc": sup.ruc}, "proveedor", documentos
    )
    return _pdf_response(pdf_bytes, f"estado_cuenta_proveedor_{supplier_id[:8]}.pdf")


@router.post("/accounting/auto-post")
async def run_auto_posting(
    company_id: str = Query(...),
    desde: date = Query(...),
    hasta: date = Query(...),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    """Postea automaticamente asientos contables desde ventas/compras/pagos/
    cobros/nomina reales para el rango dado. Idempotente: correr de nuevo
    sobre un rango ya posteado no duplica asientos."""
    await _require_ledger_role(db, user)
    return await auto_posting.run_auto_posting(db, company_id, desde, hasta)


# ── WITHHOLDING CONFIG ───────────────────────────────────────────────────────

@router.get("/withholding/configs", response_model=list[WithholdingConfigResponse])
async def list_withholding_configs(
    company_id: str = Query(),
    tipo: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    return await service.list_withholding_configs(db, company_id, tipo)


@router.post("/withholding/configs", response_model=WithholdingConfigResponse, status_code=status.HTTP_201_CREATED)
async def create_withholding_config(body: WithholdingConfigCreate, db: AsyncSession = Depends(get_db)):
    return await service.create_withholding_config(db, body)


@router.put("/withholding/configs/{config_id}", response_model=WithholdingConfigResponse)
async def update_withholding_config(config_id: str, body: WithholdingConfigUpdate, db: AsyncSession = Depends(get_db)):
    result = await service.update_withholding_config(db, config_id, body)
    if not result:
        raise HTTPException(status_code=404, detail="Configuración no encontrada")
    return result


@router.get("/withholding/dashboard", response_model=WithholdingDashboard)
async def get_withholding_dashboard(company_id: str = Query(), db: AsyncSession = Depends(get_db)):
    return await service.get_withholding_dashboard(db, company_id)


# ── WITHHOLDING DOCUMENTS ────────────────────────────────────────────────────

@router.get("/withholding/documents", response_model=list[WithholdingDocumentResponse])
async def list_withholding_documents(
    company_id: str = Query(),
    tipo: str | None = Query(None),
    estado: str | None = Query(None),
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    return await service.list_withholding_documents(db, company_id, tipo, estado, limit, offset)


@router.post("/withholding/documents", response_model=WithholdingDocumentResponse, status_code=status.HTTP_201_CREATED)
async def create_withholding_document(body: WithholdingDocumentCreate, user_id: str | None = Query(None), db: AsyncSession = Depends(get_db)):
    result = await service.create_withholding_document(db, body, user_id)
    if not result:
        raise HTTPException(status_code=400, detail="No se pudo generar. Verifique configuración de retención para el proveedor")
    return result


@router.post("/withholding/documents/{doc_id}/approve", response_model=WithholdingDocumentResponse)
async def approve_withholding_document(doc_id: str, db: AsyncSession = Depends(get_db)):
    result = await service.approve_withholding_document(db, doc_id)
    if not result:
        raise HTTPException(status_code=400, detail="No se pudo aprobar. El documento debe estar pendiente")
    return result


# ── ACCOUNT PLAN ──────────────────────────────────────────────────────────────

@router.get("/account-plan", response_model=list[AccountPlanResponse])
async def list_account_plans(company_id: str = Query(), db: AsyncSession = Depends(get_db)):
    return await service.list_account_plans(db, company_id)


@router.post("/account-plan", response_model=AccountPlanResponse, status_code=status.HTTP_201_CREATED)
async def create_account_plan(body: AccountPlanCreate, db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    await _require_ledger_role(db, user)
    return await service.create_account_plan(db, body)


# ── ACCOUNTING PERIODS ────────────────────────────────────────────────────────

@router.get("/accounting/periods", response_model=list[AccountingPeriodResponse])
async def list_accounting_periods(company_id: str = Query(), db: AsyncSession = Depends(get_db)):
    return await service.list_accounting_periods(db, company_id)


@router.post("/accounting/periods", response_model=AccountingPeriodResponse, status_code=status.HTTP_201_CREATED)
async def open_accounting_period(body: AccountingPeriodCreate, db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    await _require_ledger_role(db, user)
    return await service.open_accounting_period(db, body)


@router.post("/accounting/periods/{period_id}/close", response_model=AccountingPeriodResponse)
async def close_accounting_period(period_id: str, db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    await _require_ledger_role(db, user)
    result = await service.close_accounting_period(db, period_id, user["id"])
    if not result:
        raise HTTPException(status_code=400, detail="No se pudo cerrar. El período debe estar abierto")
    return result


@router.post("/accounting/periods/{period_id}/reopen", response_model=AccountingPeriodResponse)
async def reopen_accounting_period(period_id: str, body: PeriodReopenBody, db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    """Reabrir un periodo cerrado -- accion excepcional, gateada solo a
    Gerente (no Finanzas), y con motivo obligatorio para dejar rastro de
    por que se reabrio algo que ya se habia dado por definitivo."""
    from api.src.rbac.service import get_user_roles

    roles = {r["role_name"] for r in await get_user_roles(db, uuid.UUID(user["id"]), uuid.UUID(user["tenant_id"]))}
    if "Gerente" not in roles:
        raise HTTPException(status_code=403, detail="Se requiere rol Gerente para reabrir un período contable")

    result = await service.reopen_accounting_period(db, period_id, user["id"], body.motivo)
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result["period"]


# ── ACCOUNTING ENTRIES ───────────────────────────────────────────────────────

@router.get("/accounting/entries", response_model=list[AccountingEntryResponse])
async def list_accounting_entries(
    company_id: str = Query(),
    period_id: str = Query(),
    limit: int = Query(200, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    from sqlalchemy import select
    from api.src.integrated_finance.models import AccountingEntry as AEModel
    import uuid
    q = select(AEModel).where(
        AEModel.company_id == uuid.UUID(company_id),
        AEModel.period_id == uuid.UUID(period_id),
    ).order_by(AEModel.fecha.desc()).offset(offset).limit(limit)
    r = await db.execute(q)
    return list(r.scalars().all())


@router.post("/accounting/entries", response_model=AccountingEntryResponse, status_code=status.HTTP_201_CREATED)
async def post_accounting_entry(body: AccountingEntryCreate, db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    await _require_ledger_role(db, user)
    result = await service.post_accounting_entry(db, body, user["id"])
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result["entry"]


@router.post("/accounting/entries/manual", response_model=ManualEntryResponse, status_code=status.HTTP_201_CREATED)
async def create_manual_entry(
    body: ManualEntryCreate,
    company_id: str = Query(...),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    """Asiento manual real de partida doble -- hasta ahora un contador no
    tenia forma de cargar un ajuste, una apertura o una depreciacion: solo
    existian los asientos automaticos de auto_posting.py. Requiere que las
    lineas balanceen (debe == haber) y que la cuenta acepte asientos
    directos (no sea una cuenta de agrupacion)."""
    await _require_ledger_role(db, user)
    result = await service.create_manual_entry(db, company_id, body, user["id"])
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result


@router.post("/accounting/entries/{asiento_numero}/reverse", response_model=EntryReversalResponse, status_code=status.HTTP_201_CREATED)
async def reverse_accounting_entry(
    asiento_numero: str,
    body: EntryReversalBody,
    company_id: str = Query(...),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    """Reverso real de un asiento (manual o automático) -- crea un asiento
    nuevo con las líneas invertidas, sin tocar el original. No se puede
    reversar un asiento que ya fue reversado."""
    await _require_ledger_role(db, user)
    result = await service.reverse_accounting_entry(db, company_id, asiento_numero, user["id"], body.motivo)
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result


@router.get("/accounting/trial-balance", response_model=dict)
async def get_trial_balance(
    company_id: str = Query(),
    period_id: str = Query(),
    db: AsyncSession = Depends(get_db),
):
    return await service.get_trial_balance(db, company_id, period_id)


@router.get("/accounting/pnl", response_model=dict)
async def get_pnl(
    company_id: str = Query(),
    period_id: str = Query(),
    db: AsyncSession = Depends(get_db),
):
    return await service.get_pnl(db, company_id, period_id)


# ── COLLECTION ACTIONS ───────────────────────────────────────────────────────

@router.get("/collection", response_model=list[CollectionActionResponse])
async def list_collection_actions(
    company_id: str = Query(),
    customer_id: str | None = Query(None),
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    return await service.list_collection_actions(db, company_id, customer_id, limit, offset)


@router.post("/collection", response_model=CollectionActionResponse, status_code=status.HTTP_201_CREATED)
async def create_collection_action(body: CollectionActionCreate, user_id: str | None = Query(None), db: AsyncSession = Depends(get_db)):
    return await service.create_collection_action(db, body, user_id)


@router.get("/collection/dashboard", response_model=dict)
async def get_collection_dashboard(company_id: str = Query(), db: AsyncSession = Depends(get_db)):
    return await service.get_collection_dashboard(db, company_id)


# ── CUSTOMER SCORING ─────────────────────────────────────────────────────────

@router.get("/scoring", response_model=list[CustomerScoreResponse])
async def list_customer_scores(
    company_id: str = Query(),
    min_score: int | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    return await service.list_customer_scores(db, company_id, min_score)


@router.get("/scoring/{customer_id}", response_model=CustomerScoreResponse)
async def get_customer_score(company_id: str = Query(), customer_id: str = Path(), db: AsyncSession = Depends(get_db)):
    result = await service.get_customer_score(db, company_id, customer_id)
    if not result:
        raise HTTPException(status_code=404, detail="Score no encontrado. Recalcule primero")
    return result


@router.post("/scoring/{customer_id}/recalculate", response_model=CustomerScoreResponse)
async def recalculate_score(
    company_id: str = Query(),
    customer_id: str = Path(),
    db: AsyncSession = Depends(get_db),
):
    return await service.recalculate_score(db, company_id, customer_id)


@router.post("/scoring/recalculate-all")
async def recalculate_all_scores(company_id: str = Query(), db: AsyncSession = Depends(get_db)):
    count = await service.recalculate_all_scores(db, company_id)
    return {"clientes_recalculados": count}


# ── EBITDA ────────────────────────────────────────────────────────────────────

@router.get("/ebitda", response_model=EbitdaResponse)
async def get_ebitda(
    company_id: str = Query(),
    periodo: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    return await service.compute_ebitda(db, company_id, periodo)


# ── AUTO RECONCILIATION ──────────────────────────────────────────────────────

@router.post("/reconciliation/auto", response_model=AutoReconcileResult)
async def auto_reconcile(
    company_id: str = Query(),
    bank_account_id: str = Query(),
    db: AsyncSession = Depends(get_db),
):
    return await service.auto_reconcile(db, company_id, bank_account_id)


# ── CONSOLIDATED DASHBOARD ────────────────────────────────────────────────────

@router.get("/dashboard", response_model=ConsolidatedDashboard)
async def get_consolidated_dashboard(company_id: str = Query(), db: AsyncSession = Depends(get_db)):
    return await service.get_consolidated_dashboard(db, company_id)


# ── Integración de silos (Fase 4) ────────────────────────────────────────────

@router.get("/reconciliation/cash", response_model=CashReconciliationResponse)
async def get_cash_reconciliation(company_id: str = Query(), db: AsyncSession = Depends(get_db)):
    return await service.get_cash_reconciliation(db, company_id)


@router.get("/reconciliation/pnl", response_model=dict)
async def get_pnl_reconciliation(company_id: str = Query(), period_id: str = Query(), db: AsyncSession = Depends(get_db)):
    result = await service.get_pnl_reconciliation(db, company_id, period_id)
    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])
    return result
