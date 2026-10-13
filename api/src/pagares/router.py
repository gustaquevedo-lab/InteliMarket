from typing import Optional
import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.db import get_db
from api.src.auth import require_auth
from api.src.pagares.schemas import PagareCreate, PagarePayInput, PagareProtestInput, PagareResponse
from api.src.pagares.service import PagareService

router = APIRouter(prefix="/api/v1/distribuidora/pagares", tags=["pagares"])


@router.post("", response_model=PagareResponse)
async def create_pagare(
    body: PagareCreate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    svc = PagareService(db)
    user_id = str(user.get("sub") or user.get("id", ""))
    return await svc.create(body, created_by=user_id)


@router.get("", response_model=list[PagareResponse])
async def list_pagares(
    company_id: str = Query(...),
    estado: Optional[str] = Query(None),
    cobrador_id: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    svc = PagareService(db)
    return await svc.list(company_id, estado=estado, cobrador_id=cobrador_id)


@router.get("/{pagare_id}", response_model=PagareResponse)
async def get_pagare(
    pagare_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    svc = PagareService(db)
    pagare = await svc.get(pagare_id)
    if not pagare:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Pagaré no encontrado")
    return pagare


@router.post("/{pagare_id}/pay", response_model=PagareResponse)
async def pay_pagare(
    pagare_id: uuid.UUID,
    body: PagarePayInput,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    svc = PagareService(db)
    user_id = str(user.get("sub") or user.get("id", ""))
    return await svc.pay(pagare_id, body, created_by=user_id)


@router.post("/{pagare_id}/protest", response_model=PagareResponse)
async def protest_pagare(
    pagare_id: uuid.UUID,
    body: PagareProtestInput,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    svc = PagareService(db)
    user_id = str(user.get("sub") or user.get("id", ""))
    return await svc.protest(pagare_id, body, created_by=user_id)
