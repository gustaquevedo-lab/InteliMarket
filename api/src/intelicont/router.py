"""InteliCont integration API router"""

from fastapi import APIRouter, Depends, HTTPException, Query, Body
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.db import get_db
from api.src.auth.middleware import require_auth
from api.src.intelicont import service

router = APIRouter(prefix="/api/v1/intelicont", tags=["intelicont"], dependencies=[Depends(require_auth)])


@router.get("/sync-config")
async def get_config(db: AsyncSession = Depends(get_db)):
    return {"message": "Configuraci\u00f3n de sync no configurada"}


@router.get("/sync-config/{tenant_id}")
async def get_tenant_config(tenant_id: str, db: AsyncSession = Depends(get_db)):
    config = await service.get_sync_config(db, tenant_id)
    if not config:
        return {"enabled": False, "auto_sync": False}
    return config


@router.post("/sync-config/{tenant_id}")
async def create_config(tenant_id: str, data: dict = Body(...), db: AsyncSession = Depends(get_db)):
    return await service.create_sync_config(db, tenant_id, data)


@router.put("/sync-config/{tenant_id}")
async def update_config(tenant_id: str, data: dict = Body(...), db: AsyncSession = Depends(get_db)):
    config = await service.update_sync_config(db, tenant_id, data)
    if not config:
        raise HTTPException(status_code=404, detail="Configuraci\u00f3n no encontrada")
    return config


@router.get("/entries")
async def list_entries(
    tenant_id: str | None = Query(None),
    estado: str | None = Query(None),
    limit: int = Query(50, le=200),
    db: AsyncSession = Depends(get_db),
):
    return await service.get_entries(db, tenant_id, estado, limit)


@router.get("/entries/{entry_id}")
async def get_entry(entry_id: str, db: AsyncSession = Depends(get_db)):
    lines = await service.get_entry_lines(db, entry_id)
    return {"lines": lines}


@router.post("/generate/sale/{sale_id}")
async def generate_from_sale(sale_id: str, db: AsyncSession = Depends(get_db)):
    result = await service.generate_sale_entry(db, sale_id)
    if not result:
        raise HTTPException(status_code=400, detail="No se pudo generar el asiento")
    return result


@router.post("/sync/{entry_id}")
async def sync_entry(entry_id: str, db: AsyncSession = Depends(get_db)):
    config = await service.get_sync_config(db, "default")
    if not config:
        raise HTTPException(status_code=400, detail="Configuraci\u00f3n de sync no configurada")
    result = await service.sync_entry(db, entry_id, config)
    if result["status"] == "error":
        raise HTTPException(status_code=400, detail=result.get("message"))
    return result


@router.post("/sync-all")
async def sync_all(db: AsyncSession = Depends(get_db)):
    config = await service.get_sync_config(db, "default")
    if not config:
        raise HTTPException(status_code=400, detail="Configuraci\u00f3n de sync no configurada")
    return await service.sync_all_pending(db, config)


@router.get("/events")
async def available_events():
    return service.get_available_events()
