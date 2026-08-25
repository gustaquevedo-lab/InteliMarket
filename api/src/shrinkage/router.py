from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
from datetime import date

from api.src.db import get_db
from api.src.auth.middleware import require_auth
from api.src.shrinkage import service

router = APIRouter(
    prefix="/api/v1/shrinkage",
    tags=["shrinkage"],
    dependencies=[Depends(require_auth)],
)


@router.get("/dashboard")
async def get_dashboard(
    fecha: Optional[str] = Query(None),
    fecha_desde: Optional[str] = Query(None),
    fecha_hasta: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    today_str = str(date.today())
    desde = fecha_desde or fecha or today_str
    hasta = fecha_hasta or today_str
    return await service.get_dashboard(db, user.get("company_id", "00000000-0000-0000-0000-000000000010"), desde, hasta)


@router.get("/alerts")
async def list_alerts(
    status: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.list_alerts(db, user.get("company_id", "00000000-0000-0000-0000-000000000010"), status)


@router.get("/recommendations")
async def list_recommendations(
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.list_recommendations(db, user.get("company_id", "00000000-0000-0000-0000-000000000010"))
