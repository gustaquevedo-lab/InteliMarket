from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional

from api.src.db import get_db
from api.src.auth.middleware import require_auth
from api.src.features.deps import require_feature
from api.src.cold_chain import service
from api.src.cold_chain.schemas import SensorCreate, ReadingIn

router = APIRouter(
    prefix="/api/v1/cold-chain",
    tags=["cold-chain"],
    dependencies=[Depends(require_feature("cold_chain")), Depends(require_auth)],
)


# === SENSORS ===

@router.post("/sensors")
async def create_sensor(
    data: SensorCreate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.create_sensor(db, user["company_id"], data.model_dump())


@router.get("/sensors")
async def list_sensors(
    location_type: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.list_sensors(db, user["company_id"], location_type)


@router.get("/sensors/{sensor_id}")
async def get_sensor(
    sensor_id: str,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    result = await service.get_sensor(db, user["company_id"], sensor_id)
    if not result:
        raise HTTPException(status_code=404, detail="Sensor not found")
    return result


@router.patch("/sensors/{sensor_id}")
async def update_sensor(
    sensor_id: str,
    data: dict,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    result = await service.update_sensor_config(db, user["company_id"], sensor_id, data)
    if not result:
        raise HTTPException(status_code=404, detail="Sensor not found")
    return result


# === READINGS ===

@router.post("/readings")
async def register_reading(
    data: ReadingIn,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    result = await service.register_reading(db, user["company_id"], data.model_dump())
    if not result:
        raise HTTPException(status_code=404, detail="Sensor not found")
    return result


@router.get("/readings/{sensor_id}")
async def get_readings(
    sensor_id: str,
    hours_back: int = Query(24),
    limit: int = Query(500),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.get_readings(db, user["company_id"], sensor_id, hours_back, limit)


# === MQTT SIMULATION ===

@router.post("/simulate")
async def simulate_mqtt(
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.simulate_mqtt_reading(db, user["company_id"])


# === ALERTS ===

@router.get("/alerts")
async def list_alerts(
    alert_type: Optional[str] = Query(None),
    severity: Optional[str] = Query(None),
    unresolved_only: bool = Query(False),
    limit: int = Query(100),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.list_alerts(db, user["company_id"], alert_type, severity, unresolved_only, limit)


@router.post("/alerts/{alert_id}/resolve")
async def resolve_alert(
    alert_id: str,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    result = await service.resolve_alert(db, user["company_id"], alert_id)
    if not result:
        raise HTTPException(status_code=404, detail="Alert not found")
    return result


@router.post("/alerts/{alert_id}/notify-whatsapp")
async def notify_whatsapp(
    alert_id: str,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    result = await service.notify_whatsapp(db, user["company_id"], alert_id)
    if not result:
        raise HTTPException(status_code=404, detail="Alert not found")
    return result


# === COMPLIANCE ===

@router.post("/compliance/start")
async def start_compliance_log(
    data: dict,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.start_compliance_log(db, user["company_id"], data)


@router.post("/compliance/{log_id}/close")
async def close_compliance_log(
    log_id: str,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    result = await service.close_compliance_log(db, user["company_id"], log_id)
    if not result:
        raise HTTPException(status_code=404, detail="Compliance log not found")
    return result


@router.get("/compliance")
async def list_compliance_logs(
    compliant: Optional[bool] = Query(None),
    limit: int = Query(50),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.list_compliance_logs(db, user["company_id"], compliant, limit)


# === DASHBOARD ===

@router.get("/dashboard")
async def get_dashboard(
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.get_dashboard(db, user["company_id"])
