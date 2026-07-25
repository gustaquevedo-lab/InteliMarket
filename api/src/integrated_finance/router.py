"""Integrated Financial Management API — Retenciones, Cierre Contable, Conciliación, Scoring, EBITDA"""

from fastapi import APIRouter, Depends, HTTPException, Query, status, Path
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.db import get_db
from api.src.integrated_finance.schemas import (
    WithholdingConfigCreate, WithholdingConfigUpdate, WithholdingConfigResponse,
    WithholdingDocumentCreate, WithholdingDocumentResponse, WithholdingDashboard,
    AccountPlanCreate, AccountPlanResponse,
    AccountingPeriodCreate, AccountingPeriodResponse,
    AccountingEntryCreate, AccountingEntryResponse,
    CollectionActionCreate, CollectionActionResponse,
    CustomerScoreResponse, EbitdaResponse,
    AutoReconcileResult, ConsolidatedDashboard,
)
from api.src.integrated_finance import service

router = APIRouter(prefix="/api/v1/integrated-finance", tags=["integrated-finance"])


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


@router.post("/withholding/documents/{doc_id}/send", response_model=WithholdingDocumentResponse)
async def send_withholding_to_sifen(doc_id: str, db: AsyncSession = Depends(get_db)):
    result = await service.send_withholding_to_sifen(db, doc_id)
    if not result:
        raise HTTPException(status_code=400, detail="No se pudo enviar a SIFEN")
    return result


# ── ACCOUNT PLAN ──────────────────────────────────────────────────────────────

@router.get("/account-plan", response_model=list[AccountPlanResponse])
async def list_account_plans(company_id: str = Query(), db: AsyncSession = Depends(get_db)):
    return await service.list_account_plans(db, company_id)


@router.post("/account-plan", response_model=AccountPlanResponse, status_code=status.HTTP_201_CREATED)
async def create_account_plan(body: AccountPlanCreate, db: AsyncSession = Depends(get_db)):
    return await service.create_account_plan(db, body)


# ── ACCOUNTING PERIODS ────────────────────────────────────────────────────────

@router.get("/accounting/periods", response_model=list[AccountingPeriodResponse])
async def list_accounting_periods(company_id: str = Query(), db: AsyncSession = Depends(get_db)):
    return await service.list_accounting_periods(db, company_id)


@router.post("/accounting/periods", response_model=AccountingPeriodResponse, status_code=status.HTTP_201_CREATED)
async def open_accounting_period(body: AccountingPeriodCreate, db: AsyncSession = Depends(get_db)):
    return await service.open_accounting_period(db, body)


@router.post("/accounting/periods/{period_id}/close", response_model=AccountingPeriodResponse)
async def close_accounting_period(period_id: str, user_id: str | None = Query(None), db: AsyncSession = Depends(get_db)):
    result = await service.close_accounting_period(db, period_id, user_id)
    if not result:
        raise HTTPException(status_code=400, detail="No se pudo cerrar. El período debe estar abierto")
    return result


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
async def post_accounting_entry(body: AccountingEntryCreate, user_id: str | None = Query(None), db: AsyncSession = Depends(get_db)):
    return await service.post_accounting_entry(db, body, user_id)


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
