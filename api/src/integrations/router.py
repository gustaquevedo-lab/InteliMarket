"""Integrations router"""

from fastapi import APIRouter, Depends, Query, Body
from api.src.db import get_db
from api.src.integrations import service

router = APIRouter(prefix="/api/integrations", tags=["integrations"])


@router.get("/configs")
async def list_configs(db=Depends(get_db)):
    return await service.get_configs(db)


@router.get("/configs/{config_id}")
async def get_config(config_id: int, db=Depends(get_db)):
    config = await service.get_config(db, config_id)
    if not config:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Configuración no encontrada")
    return config


@router.post("/configs", status_code=201)
async def create_config(config_data: dict = Body(...), db=Depends(get_db)):
    return await service.create_config(db, config_data)


@router.put("/configs/{config_id}")
async def update_config(config_id: int, updates: dict = Body(...), db=Depends(get_db)):
    config = await service.update_config(db, config_id, updates)
    if not config:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Configuración no encontrada")
    return config


@router.delete("/configs/{config_id}")
async def delete_config(config_id: int, db=Depends(get_db)):
    if not await service.delete_config(db, config_id):
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Configuración no encontrada")
    return {"message": "Eliminada"}


@router.post("/test")
async def test_webhook(evento: str = Query("test"), url: str = Query(...), db=Depends(get_db)):
    delivery = await service._send_to_url(
        url=url,
        evento=evento,
        payload={"test": True, "message": "Webhook test from InteliMarket"},
        secret=None,
        config_id=0,
        db=db,
    )
    return delivery


@router.get("/events")
def available_events():
    return service.get_eventos_disponibles()


@router.get("/deliveries")
async def list_deliveries(config_id: int | None = Query(None), limit: int = Query(50, le=200), db=Depends(get_db)):
    return await service.get_deliveries(db, config_id, limit)
