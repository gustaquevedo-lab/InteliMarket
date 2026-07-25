"""Integrations router"""

from fastapi import APIRouter, Depends, Query, Body
from api.src.db import get_db
from api.src.integrations import service

router = APIRouter(prefix="/api/integrations", tags=["integrations"])


@router.get("/configs")
def list_configs(db=Depends(get_db)):
    return service.get_configs(db)


@router.get("/configs/{config_id}")
def get_config(config_id: int, db=Depends(get_db)):
    config = service.get_config(db, config_id)
    if not config:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Configuraci\u00f3n no encontrada")
    return config


@router.post("/configs", status_code=201)
def create_config(config_data: dict = Body(...), db=Depends(get_db)):
    return service.create_config(db, config_data)


@router.put("/configs/{config_id}")
def update_config(config_id: int, updates: dict = Body(...), db=Depends(get_db)):
    config = service.update_config(db, config_id, updates)
    if not config:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Configuraci\u00f3n no encontrada")
    return config


@router.delete("/configs/{config_id}")
def delete_config(config_id: int, db=Depends(get_db)):
    if not service.delete_config(db, config_id):
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Configuraci\u00f3n no encontrada")
    return {"message": "Eliminada"}


@router.post("/test")
def test_webhook(evento: str = Query("test"), url: str = Query(...), db=Depends(get_db)):
    delivery = service._send_to_url(
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
def list_deliveries(config_id: int | None = Query(None), limit: int = Query(50, le=200), db=Depends(get_db)):
    return service.get_deliveries(db, config_id, limit)
