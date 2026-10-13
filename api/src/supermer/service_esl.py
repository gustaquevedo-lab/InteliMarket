"""Fase 3 — ESL Service: devices, zones, price sync
💡 ESL workflow: assign device to product → sync price → confirm.
Battery <20% triggers alert. Offline devices need attention."""

from datetime import datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException

from .models import EslDevice, EslZone, EslPriceSync



# ---------------------------------------------------------------------------
# ZONES
# ---------------------------------------------------------------------------

async def list_esl_zones(company_id: UUID, db: AsyncSession):
    result = await db.execute(
        select(EslZone).where(EslZone.company_id == company_id).order_by(EslZone.nombre)
    )
    return result.scalars().all()

async def create_esl_zone(company_id: UUID, data, db: AsyncSession):
    z = EslZone(company_id=company_id, **data.model_dump(exclude_none=True))
    db.add(z)
    await db.commit()
    await db.refresh(z)
    return z


# ---------------------------------------------------------------------------
# DEVICES
# ---------------------------------------------------------------------------

async def list_esl_devices(company_id: UUID, db: AsyncSession, zona_id: Optional[UUID] = None, estado: Optional[str] = None):
    q = select(EslDevice).where(EslDevice.company_id == company_id)
    if zona_id:
        q = q.where(EslDevice.zona_id == zona_id)
    if estado:
        q = q.where(EslDevice.estado == estado)
    q = q.order_by(EslDevice.ubicacion)
    result = await db.execute(q)
    return result.scalars().all()

async def create_esl_device(company_id: UUID, data, db: AsyncSession):
    d = EslDevice(company_id=company_id, **data.model_dump(exclude_none=True))
    d.estado = "online"
    db.add(d)
    await db.commit()
    await db.refresh(d)
    return d

async def update_esl_device(device_id: UUID, data, db: AsyncSession):
    result = await db.execute(select(EslDevice).where(EslDevice.id == device_id))
    d = result.scalar_one_or_none()
    if not d: raise HTTPException(404, "ESL device not found")
    for k, v in data.model_dump(exclude_none=True).items():
        setattr(d, k, v)
    await db.commit()
    await db.refresh(d)
    return d


# ---------------------------------------------------------------------------
# PRICE SYNC
# ---------------------------------------------------------------------------

async def sync_esl_price(company_id: UUID, data, db: AsyncSession):
    """Send a price update to an ESL device. Records sync attempt."""
    result = await db.execute(select(EslDevice).where(EslDevice.id == data.esl_device_id))
    device = result.scalar_one_or_none()
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
    await db.commit()
    await db.refresh(sync)
    return sync

async def confirm_esl_sync(sync_id: UUID, db: AsyncSession):
    """Confirm an ESL sync was acknowledged by the device."""
    result = await db.execute(select(EslPriceSync).where(EslPriceSync.id == sync_id))
    sync = result.scalar_one_or_none()
    if not sync: raise HTTPException(404, "Sync not found")
    sync.estado = "confirmado"
    sync.completado_at = datetime.utcnow()
    await db.commit()
    await db.refresh(sync)
    return sync

async def list_esl_syncs(company_id: UUID, db: AsyncSession, estado: Optional[str] = None):
    q = select(EslPriceSync).where(EslPriceSync.company_id == company_id)
    if estado:
        q = q.where(EslPriceSync.estado == estado)
    q = q.order_by(EslPriceSync.created_at.desc()).limit(100)
    result = await db.execute(q)
    return result.scalars().all()


# ---------------------------------------------------------------------------
# DASHBOARD
# ---------------------------------------------------------------------------

async def get_esl_dashboard(company_id: UUID, db: AsyncSession):
    total = (await db.execute(
        select(func.count()).select_from(EslDevice).where(EslDevice.company_id == company_id)
    )).scalar()

    online = (await db.execute(
        select(func.count()).select_from(EslDevice).where(
            EslDevice.company_id == company_id, EslDevice.estado == "online",
        )
    )).scalar()

    offline = (await db.execute(
        select(func.count()).select_from(EslDevice).where(
            EslDevice.company_id == company_id, EslDevice.estado == "offline",
        )
    )).scalar()

    bateria_baja = (await db.execute(
        select(func.count()).select_from(EslDevice).where(
            EslDevice.company_id == company_id, EslDevice.bateria_pct < 20,
        )
    )).scalar() if total else 0

    syncs_pendientes = (await db.execute(
        select(func.count()).select_from(EslPriceSync).where(
            EslPriceSync.company_id == company_id, EslPriceSync.estado.in_(["pendiente", "enviado"]),
        )
    )).scalar()

    return {
        "total_dispositivos": total,
        "online": online,
        "offline": offline,
        "bateria_baja": bateria_baja,
        "syncs_pendientes": syncs_pendientes,
    }
