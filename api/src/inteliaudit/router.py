"""InteliAudit integration API router"""

from fastapi import APIRouter, Depends, HTTPException, Query, Body
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional

from api.src.db import get_db
from api.src.auth.middleware import require_auth
from api.src.inteliaudit import service

router = APIRouter(prefix="/api/v1/inteliaudit", tags=["inteliaudit"])


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


@router.post("/audit-event")
async def record_event(data: dict = Body(...), db: AsyncSession = Depends(get_db)):
    return await service.record_audit_event(db, data)


@router.get("/logs")
async def list_logs(
    accion: Optional[str] = Query(None),
    entidad: Optional[str] = Query(None),
    limit: int = Query(100),
    offset: int = Query(0),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.get_audit_logs(
        db, user["company_id"],
        accion=accion, entidad=entidad,
        limit=limit, offset=offset,
    )


@router.post("/sync-all")
async def sync_all(db: AsyncSession = Depends(get_db)):
    config = await service.get_sync_config(db, "default")
    if not config:
        raise HTTPException(status_code=400, detail="Configuración de sync no configurada")
    return await service.sync_pending_events(db, config)


@router.get("/events")
async def available_events():
    return service.get_available_events()


@router.post("/push-anomalies")
async def push_anomalies(db: AsyncSession = Depends(get_db)):
    config = await service.get_sync_config(db, "default")
    if not config:
        raise HTTPException(status_code=400, detail="Configuración de sync no configurada")
    return await service.push_sale_anomalies(db, config, "00000000-0000-0000-0000-000000000010")
