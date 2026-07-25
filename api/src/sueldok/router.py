"""SueldOK integration API router"""

from fastapi import APIRouter, Depends, HTTPException, Query, Body
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.db import get_db
from api.src.auth.middleware import require_auth
from api.src.sueldok import service

router = APIRouter(prefix="/api/v1/sueldok", tags=["sueldok"])


@router.get("/sync-config")
async def get_config(db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    config = await service.get_sync_config(db, user.get("tenant_id", ""))
    if not config:
        return {"enabled": False, "auto_sync": False}
    return config


@router.post("/sync-config")
async def create_config(data: dict = Body(...), db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    return await service.create_sync_config(db, user.get("tenant_id", ""), data)


@router.put("/sync-config")
async def update_config(data: dict = Body(...), db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    config = await service.update_sync_config(db, user.get("tenant_id", ""), data)
    if not config:
        raise HTTPException(status_code=404, detail="Configuración no encontrada")
    return config


@router.post("/sync/payroll")
async def sync_payroll(data: dict = Body(...), db: AsyncSession = Depends(get_db)):
    config = await service.get_sync_config(db, data.get("tenant_id", "default"))
    if not config:
        raise HTTPException(status_code=400, detail="Configuración de sync no configurada")
    return await service.sync_payroll_data(db, config, data)


@router.post("/sync/sales-commissions")
async def sync_commissions(
    company_id: str = Body(..., embed=True),
    periodo: str = Body(..., embed=True),
    db: AsyncSession = Depends(get_db),
):
    config = await service.get_sync_config(db, "default")
    if not config:
        raise HTTPException(status_code=400, detail="Configuración de sync no configurada")
    return await service.sync_sales_to_payroll(db, config, company_id, periodo)


@router.get("/events")
async def available_events():
    return service.get_available_events()
