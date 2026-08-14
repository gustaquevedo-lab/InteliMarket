from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
from datetime import date, timedelta

from api.src.db import get_db
from api.src.auth.middleware import require_auth
from api.src.petty_cash import service
from api.src.petty_cash.schemas import (
    ExpenseCategoryCreate, ExpenseCategoryResponse,
    ExpenseCreate, ExpenseUpdate, ExpenseResponse, ExpenseSummary,
    CostCenterCreate, CostCenterResponse, ExpenseDashboard,
    PettyCashFundCreate, PettyCashFundUpdate, PettyCashFundResponse, PettyCashFundMovementResponse,
    ExpenseApprovalConfig, ExpenseRejectBody, FundReplenishRequest,
    ExpenseVoidBody, ComprobanteUploadResponse,
    FundCountCreate, FundCountConfirm, PettyCashFundCountResponse,
)

router = APIRouter(
    prefix="/api/v1/expenses",
    tags=["expenses"],
)

# Router separado (no /{expense_id} de por medio) para evitar el bug de
# orden de rutas ya visto en este sistema: si /funds viviera bajo el mismo
# prefix que /{expense_id} y se registrara despues, "funds" se interpretaria
# como un expense_id.
funds_router = APIRouter(
    prefix="/api/v1/petty-cash-funds",
    tags=["expenses"],
)


@funds_router.get("", response_model=list[PettyCashFundResponse])
async def list_funds(
    activo: Optional[bool] = Query(None),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.list_funds(db, user["company_id"], activo=activo)


@funds_router.post("", response_model=PettyCashFundResponse, status_code=status.HTTP_201_CREATED)
async def create_fund(
    data: PettyCashFundCreate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.create_fund(db, user["company_id"], data, user.get("id"))


@funds_router.patch("/{fund_id}", response_model=PettyCashFundResponse)
async def update_fund(
    fund_id: str,
    data: PettyCashFundUpdate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    result = await service.update_fund(db, fund_id, data)
    if not result:
        raise HTTPException(status_code=404, detail="Fondo no encontrado")
    return result


@funds_router.post("/{fund_id}/replenish", response_model=PettyCashFundResponse)
async def replenish_fund(
    fund_id: str,
    data: FundReplenishRequest,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    from api.src.rbac.service import get_user_roles
    import uuid as _uuid

    roles = {r["role_name"] for r in await get_user_roles(db, _uuid.UUID(user["id"]), _uuid.UUID(user["tenant_id"]))}
    if not roles & {"Gerente", "Finanzas"}:
        raise HTTPException(status_code=403, detail="Se requiere rol Gerente o Finanzas para reponer un fondo de caja chica")

    result = await service.replenish_fund(db, user["company_id"], fund_id, data, user["id"])
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result["fund"]


@funds_router.get("/{fund_id}/movements", response_model=list[PettyCashFundMovementResponse])
async def list_fund_movements(
    fund_id: str,
    limit: int = Query(50, le=200),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.get_fund_movements(db, fund_id, limit=limit)


# ── Arqueo de caja chica (Fase 5) ──────────────────────────────

@funds_router.get("/counts/pending", response_model=list[PettyCashFundCountResponse])
async def list_pending_fund_counts(
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.list_pending_fund_counts(db, user["company_id"])


@funds_router.post("/{fund_id}/counts", response_model=PettyCashFundCountResponse, status_code=status.HTTP_201_CREATED)
async def create_fund_count(
    fund_id: str,
    data: FundCountCreate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    result = await service.create_fund_count(db, user["company_id"], fund_id, data, user["id"])
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result["count"]


@funds_router.get("/{fund_id}/counts", response_model=list[PettyCashFundCountResponse])
async def list_fund_counts(
    fund_id: str,
    limit: int = Query(50, le=200),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.list_fund_counts(db, fund_id, limit=limit)


@funds_router.post("/counts/{count_id}/confirm", response_model=PettyCashFundCountResponse)
async def confirm_fund_count(
    count_id: str,
    data: FundCountConfirm,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    result = await service.confirm_fund_count(db, user["company_id"], count_id, user["id"], user["tenant_id"], data)
    if "error" in result:
        raise HTTPException(status_code=403 if "No autorizado" in result["error"] else 400, detail=result["error"])
    return result["count"]


# ── Categories ──────────────────────────────────────────────

@router.get("/categories", response_model=list[ExpenseCategoryResponse])
async def list_categories(
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.list_categories(db, user["company_id"])


@router.post("/categories", response_model=ExpenseCategoryResponse, status_code=status.HTTP_201_CREATED)
async def create_category(
    data: ExpenseCategoryCreate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.create_category(db, user["company_id"], data)


# ── Cost centers (sectores) ────────────────────────────────

@router.get("/cost-centers", response_model=list[CostCenterResponse])
async def list_cost_centers(
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.list_cost_centers(db, user["company_id"])


@router.post("/cost-centers", response_model=CostCenterResponse, status_code=status.HTTP_201_CREATED)
async def create_cost_center(
    data: CostCenterCreate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.create_cost_center(db, user["company_id"], data)


# ── Expenses ────────────────────────────────────────────────

@router.get("", response_model=list[ExpenseResponse])
async def list_expenses(
    branch_id: Optional[str] = Query(None),
    category_id: Optional[str] = Query(None),
    estado: Optional[str] = Query(None),
    desde: Optional[date] = Query(None),
    hasta: Optional[date] = Query(None),
    limit: int = Query(50, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.list_expenses(db, user["company_id"], branch_id, category_id, estado, desde, hasta, limit, offset)


@router.get("/summary", response_model=ExpenseSummary)
async def expense_summary(
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.get_summary(db, user["company_id"])


@router.get("/dashboard", response_model=ExpenseDashboard)
async def expense_dashboard(
    fecha_desde: Optional[date] = Query(None),
    fecha_hasta: Optional[date] = Query(None),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    hasta = fecha_hasta or date.today()
    desde = fecha_desde or (hasta - timedelta(days=29))
    return await service.get_expense_dashboard(db, user["company_id"], desde, hasta)


@router.get("/config/approval", response_model=ExpenseApprovalConfig)
async def get_approval_config(
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.get_approval_config(db, user["company_id"])


@router.patch("/config/approval", response_model=ExpenseApprovalConfig)
async def update_approval_config(
    data: ExpenseApprovalConfig,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    from api.src.rbac.service import get_user_roles
    import uuid as _uuid

    roles = {r["role_name"] for r in await get_user_roles(db, _uuid.UUID(user["id"]), _uuid.UUID(user["tenant_id"]))}
    if not roles & {"Gerente", "Finanzas"}:
        raise HTTPException(status_code=403, detail="Se requiere rol Gerente o Finanzas para configurar el umbral de aprobación")
    return await service.update_approval_config(db, user["company_id"], data)


@router.post("/{expense_id}/approve", response_model=ExpenseResponse)
async def approve_expense(
    expense_id: str,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    result = await service.approve_expense(db, expense_id, user["id"], user["tenant_id"])
    if "error" in result:
        raise HTTPException(status_code=403 if "No autorizado" in result["error"] else 400, detail=result["error"])
    return result["expense"]


@router.post("/{expense_id}/reject", response_model=ExpenseResponse)
async def reject_expense(
    expense_id: str,
    body: ExpenseRejectBody,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    result = await service.reject_expense(db, expense_id, user["id"], user["tenant_id"], body.motivo)
    if "error" in result:
        raise HTTPException(status_code=403 if "No autorizado" in result["error"] else 400, detail=result["error"])
    return result["expense"]


@router.post("/{expense_id}/void", response_model=ExpenseResponse)
async def void_expense(
    expense_id: str,
    body: ExpenseVoidBody,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    result = await service.void_expense(db, expense_id, user["id"], user["tenant_id"], body.motivo)
    if "error" in result:
        raise HTTPException(status_code=403 if "No autorizado" in result["error"] else 400, detail=result["error"])
    return result["expense"]


@router.post("/upload-comprobante", response_model=ComprobanteUploadResponse)
async def upload_comprobante(
    file: UploadFile = File(...),
    user=Depends(require_auth),
):
    content = await file.read()
    try:
        url = service.save_comprobante(content, file.filename or "comprobante")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return ComprobanteUploadResponse(url=url, filename=file.filename or "comprobante")


@router.get("/{expense_id}", response_model=ExpenseResponse)
async def get_expense(
    expense_id: str,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    result = await service.get_expense(db, expense_id)
    if not result:
        raise HTTPException(status_code=404, detail="Gasto no encontrado")
    return result


@router.post("", response_model=ExpenseResponse, status_code=status.HTTP_201_CREATED)
async def create_expense(
    data: ExpenseCreate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    try:
        return await service.create_expense(db, user["company_id"], data, user.get("id"))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/{expense_id}", response_model=ExpenseResponse)
async def update_expense(
    expense_id: str,
    data: ExpenseUpdate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    try:
        result = await service.update_expense(db, expense_id, data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    if not result:
        raise HTTPException(status_code=404, detail="Gasto no encontrado")
    return result


@router.delete("/{expense_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_expense(
    expense_id: str,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    ok = await service.delete_expense(db, expense_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Gasto no encontrado")
