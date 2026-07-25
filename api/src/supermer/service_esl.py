"""Fase 3 — ESL Service: devices, zones, price sync
💡 ESL workflow: assign device to product → sync price → confirm.
Battery <20% triggers alert. Offline devices need attention."""

from datetime import datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID
from sqlalchemy import func
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException

from .models import EslDevice, EslZone, EslPriceSync



# ---------------------------------------------------------------------------
# ZONES
# ---------------------------------------------------------------------------

async def list_esl_zones(company_id: UUID, db: AsyncSession):
    return db.query(EslZone).filter(EslZone.company_id == company_id).order_by(EslZone.nombre).all()

async def create_esl_zone(company_id: UUID, data, db: AsyncSession):
    z = EslZone(company_id=company_id, **data.model_dump(exclude_none=True))
    db.add(z); db.commit(); db.refresh(z)
    return z


# ---------------------------------------------------------------------------
# DEVICES
# ---------------------------------------------------------------------------

async def list_esl_devices(company_id: UUID, db: AsyncSession, zona_id: Optional[UUID] = None, estado: Optional[str] = None):
    q = db.query(EslDevice).filter(EslDevice.company_id == company_id)
    if zona_id: q = q.filter(EslDevice.zona_id == zona_id)
    if estado: q = q.filter(EslDevice.estado == estado)
    return q.order_by(EslDevice.ubicacion).all()

async def create_esl_device(company_id: UUID, data, db: AsyncSession):
    d = EslDevice(company_id=company_id, **data.model_dump(exclude_none=True))
    d.estado = "online"
    db.add(d); db.commit(); db.refresh(d)
    return d

async def update_esl_device(device_id: UUID, data, db: AsyncSession):
    d = db.query(EslDevice).get(device_id)
    if not d: raise HTTPException(404, "ESL device not found")
    for k, v in data.model_dump(exclude_none=True).items():
        setattr(d, k, v)
    db.commit(); db.refresh(d)
    return d


# ---------------------------------------------------------------------------
# PRICE SYNC
# ---------------------------------------------------------------------------

async def sync_esl_price(company_id: UUID, data, db: AsyncSession):
    """Send a price update to an ESL device. Records sync attempt."""
    device = db.query(EslDevice).get(data.esl_device_id)
    if not device: raise HTTPException(404, "ESL device not found")
    if device.estado == "offline":
        raise HTTPException(400, "Device is offline — cannot sync. Check device connectivity first.")

    sync = EslPriceSync(
        company_id=company_id,
        esl_device_id=data.esl_device_id,
        producto_id=data.producto_id,
        precio_anterior=device.precio_actual,
        precio_nuevo=data.precio_nuevo,
        estado="enviado",
    )
    db.add(sync)
    device.precio_actual = data.precio_nuevo
    device.ultima_sync = datetime.utcnow()
    db.commit(); db.refresh(sync)
    return sync

async def confirm_esl_sync(sync_id: UUID, db: AsyncSession):
    """Confirm an ESL sync was acknowledged by the device."""
    sync = db.query(EslPriceSync).get(sync_id)
    if not sync: raise HTTPException(404, "Sync not found")
    sync.estado = "confirmado"
    sync.completado_at = datetime.utcnow()
    db.commit(); db.refresh(sync)
    return sync

async def list_esl_syncs(company_id: UUID, db: AsyncSession, estado: Optional[str] = None):
    q = db.query(EslPriceSync).filter(EslPriceSync.company_id == company_id)
    if estado: q = q.filter(EslPriceSync.estado == estado)
    return q.order_by(EslPriceSync.created_at.desc()).limit(100).all()


# ---------------------------------------------------------------------------
# DASHBOARD
# ---------------------------------------------------------------------------

async def get_esl_dashboard(company_id: UUID, db: AsyncSession):
    total = db.query(EslDevice).filter(EslDevice.company_id == company_id).count()
    online = db.query(EslDevice).filter(EslDevice.company_id == company_id, EslDevice.estado == "online").count()
    offline = db.query(EslDevice).filter(EslDevice.company_id == company_id, EslDevice.estado == "offline").count()
    bateria_baja = db.query(EslDevice).filter(
        EslDevice.company_id == company_id, EslDevice.bateria_pct < 20,
    ).count() if total else 0
    syncs_pendientes = db.query(EslPriceSync).filter(
        EslPriceSync.company_id == company_id, EslPriceSync.estado.in_(["pendiente", "enviado"]),
    ).count()
    return {
        "total_dispositivos": total,
        "online": online,
        "offline": offline,
        "bateria_baja": bateria_baja,
        "syncs_pendientes": syncs_pendientes,
    }
