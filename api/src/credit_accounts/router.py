"""Credit account router"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from decimal import Decimal

from api.src.db import get_db
from api.src.auth.middleware import require_auth
from api.src.auth.rbac import require_role
from api.src.credit_accounts import service
from api.src.credit_accounts.schemas import (
    CreditAccountCreate,
    CreditAccountUpdate,
    CreditAccountResponse,
    CreditPayment,
    CreditMovementResponse,
    AuthorizeExcessRequest,
    AuthorizeExcessResponse,
)

router = APIRouter(prefix="/api/v1/credit-accounts", tags=["credit-accounts"])


@router.post("", response_model=CreditAccountResponse)
async def create_account(
    data: CreditAccountCreate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    data.company_id = user["company_id"]
    return await service.create_credit_account(db, data)


@router.get("", response_model=list[CreditAccountResponse])
async def list_accounts(
    company_id: str | None = Query(None),
    activo: bool | None = None,
    search: str | None = None,
    limit: int = Query(100, le=1000),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    target_company_id = company_id or user.get("company_id") or "00000000-0000-0000-0000-000000000010"
    return await service.list_credit_accounts(
        db, target_company_id, activo=activo, search=search, limit=limit, offset=offset
    )


@router.get("/companies/{company_id}", response_model=list[CreditAccountResponse])
async def list_accounts_by_company(
    company_id: str,
    activo: bool | None = None,
    search: str | None = None,
    limit: int = Query(100, le=1000),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.list_credit_accounts(
        db, company_id, activo=activo, search=search, limit=limit, offset=offset
    )


@router.get("/customer/{customer_id}", response_model=CreditAccountResponse | None)
async def get_account_by_customer(
    customer_id: str,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    account = await service.get_credit_account_by_customer(db, user["company_id"], customer_id)
    return account


@router.get("/{account_id}", response_model=CreditAccountResponse)
async def get_account(
    account_id: str,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    account = await service.get_credit_account(db, account_id)
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    return account


@router.patch("/{account_id}", response_model=CreditAccountResponse)
async def update_account(
    account_id: str,
    data: CreditAccountUpdate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    account = await service.update_credit_account(db, account_id, data)
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    return account


@router.post("/{account_id}/payment")
async def make_payment(
    account_id: str,
    data: CreditPayment,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    account = await service.get_credit_account(db, account_id)
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    result = await service.process_payment(db, user["company_id"], str(account.customer_id), data)
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result


@router.post("/{account_id}/authorize-excess", response_model=AuthorizeExcessResponse)
async def authorize_excess(
    account_id: str,
    data: AuthorizeExcessRequest,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_role("supervisor", "gerente_comercial", "admin")),
):
    result = await service.authorize_excess(db, user["company_id"], account_id, data, str(user["id"]))
    if not result:
        raise HTTPException(status_code=404, detail="Cuenta de credito no encontrada")
    return result


@router.get("/{account_id}/movements", response_model=list[CreditMovementResponse])
async def list_movements(
    account_id: str,
    limit: int = Query(50, le=100),
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.get_movements(db, account_id, limit=limit, offset=offset)
