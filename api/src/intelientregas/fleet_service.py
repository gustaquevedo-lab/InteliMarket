"""Fleet management service."""

from datetime import datetime, timezone, timedelta
from uuid import UUID

from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.intelientregas.models import Vehicle, Driver
from api.src.intelientregas.fleet_models import (
    VehicleMaintenance, VehicleFuelEntry, VehicleExpense,
    VehicleChecklistItem, VehicleChecklistLog,
    MaintenanceType, MaintenanceStatus, FuelType,
)


# ── Maintenance ──────────────────────────────────────────────────

async def list_maintenance(db: AsyncSession, tenant_id: UUID, vehicle_id: UUID | None = None, status: str | None = None):
    q = select(VehicleMaintenance).where(VehicleMaintenance.tenant_id == tenant_id)
    if vehicle_id:
        q = q.where(VehicleMaintenance.vehicle_id == vehicle_id)
    if status:
        q = q.where(VehicleMaintenance.status == status)
    q = q.order_by(VehicleMaintenance.scheduled_date.desc().nullslast()).limit(100)
    r = await db.execute(q)
    return r.scalars().all()


async def create_maintenance(db: AsyncSession, tenant_id: UUID, data: dict):
    obj = VehicleMaintenance(tenant_id=tenant_id, **data)
    db.add(obj)
    await db.commit()
    await db.refresh(obj)
    return obj


async def update_maintenance(db: AsyncSession, maintenance_id: UUID, data: dict):
    r = await db.execute(select(VehicleMaintenance).where(VehicleMaintenance.id == maintenance_id))
    obj = r.scalar_one_or_none()
    if not obj:
        raise ValueError("Mantenimiento no encontrado")
    for k, v in data.items():
        if v is not None:
            setattr(obj, k, v)
    await db.commit()
    await db.refresh(obj)
    return obj


# ── Fuel ─────────────────────────────────────────────────────────

async def list_fuel_entries(db: AsyncSession, tenant_id: UUID, vehicle_id: UUID | None = None, limit: int = 100):
    q = select(VehicleFuelEntry).where(VehicleFuelEntry.tenant_id == tenant_id)
    if vehicle_id:
        q = q.where(VehicleFuelEntry.vehicle_id == vehicle_id)
    q = q.order_by(VehicleFuelEntry.fecha.desc()).limit(limit)
    r = await db.execute(q)
    return r.scalars().all()


async def create_fuel_entry(db: AsyncSession, tenant_id: UUID, data: dict):
    data["costo_total"] = data.get("litros", 0) * data.get("costo_por_litro", 0)
    obj = VehicleFuelEntry(tenant_id=tenant_id, **data)
    db.add(obj)
    await db.commit()
    await db.refresh(obj)
    return obj


# ── Expenses ─────────────────────────────────────────────────────

async def list_expenses(db: AsyncSession, tenant_id: UUID, vehicle_id: UUID | None = None, limit: int = 100):
    q = select(VehicleExpense).where(VehicleExpense.tenant_id == tenant_id)
    if vehicle_id:
        q = q.where(VehicleExpense.vehicle_id == vehicle_id)
    q = q.order_by(VehicleExpense.fecha.desc()).limit(limit)
    r = await db.execute(q)
    return r.scalars().all()


async def create_expense(db: AsyncSession, tenant_id: UUID, data: dict):
    obj = VehicleExpense(tenant_id=tenant_id, **data)
    db.add(obj)
    await db.commit()
    await db.refresh(obj)
    return obj


# ── Checklist ────────────────────────────────────────────────────

async def list_checklist_items(db: AsyncSession, tenant_id: UUID, categoria: str | None = None):
    q = select(VehicleChecklistItem).where(VehicleChecklistItem.tenant_id == tenant_id, VehicleChecklistItem.activo == True)
    if categoria:
        q = q.where(VehicleChecklistItem.categoria == categoria)
    r = await db.execute(q)
    return r.scalars().all()


async def create_checklist_item(db: AsyncSession, tenant_id: UUID, data: dict):
    obj = VehicleChecklistItem(tenant_id=tenant_id, **data)
    db.add(obj)
    await db.commit()
    await db.refresh(obj)
    return obj


async def submit_checklist(db: AsyncSession, tenant_id: UUID, data: dict):
    obj = VehicleChecklistLog(tenant_id=tenant_id, **data)
    db.add(obj)
    await db.commit()
    await db.refresh(obj)
    return obj


# ── Dashboard ────────────────────────────────────────────────────

async def get_fleet_dashboard(db: AsyncSession, tenant_id: UUID) -> dict:
    # Total vehicles
    r = await db.execute(select(func.count(Vehicle.id)).where(Vehicle.tenant_id == tenant_id))
    total_vehicles = r.scalar() or 0

    # Active vehicles (with active driver assigned)
    r = await db.execute(
        select(func.count(Vehicle.id)).where(Vehicle.tenant_id == tenant_id, Vehicle.driver_id.isnot(None), Vehicle.activo == True)
    )
    active_vehicles = r.scalar() or 0

    # Maintenance pending
    r = await db.execute(
        select(func.count(VehicleMaintenance.id)).where(
            VehicleMaintenance.tenant_id == tenant_id,
            VehicleMaintenance.status.in_(["scheduled", "in_progress"]),
        )
    )
    maintenance_pending = r.scalar() or 0

    # Overdue maintenance
    r = await db.execute(
        select(func.count(VehicleMaintenance.id)).where(
            VehicleMaintenance.tenant_id == tenant_id,
            VehicleMaintenance.status == "scheduled",
            VehicleMaintenance.scheduled_date < func.now(),
        )
    )
    maintenance_overdue = r.scalar() or 0

    # Fuel this month
    month_start = datetime.now(timezone.utc).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    r = await db.execute(
        select(
            func.coalesce(func.sum(VehicleFuelEntry.costo_total), 0),
            func.coalesce(func.sum(VehicleFuelEntry.litros), 0),
        ).where(
            VehicleFuelEntry.tenant_id == tenant_id,
            VehicleFuelEntry.fecha >= month_start,
        )
    )
    fuel_row = r.one()
    fuel_month_cost = float(fuel_row[0])
    fuel_month_liters = float(fuel_row[1])

    # Total expenses
    r = await db.execute(
        select(func.coalesce(func.sum(VehicleExpense.monto), 0)).where(
            VehicleExpense.tenant_id == tenant_id,
            VehicleExpense.fecha >= month_start,
        )
    )
    total_expenses = float(r.scalar() or 0)

    return {
        "total_vehicles": total_vehicles,
        "active_vehicles": active_vehicles,
        "maintenance_pending": maintenance_pending,
        "maintenance_overdue": maintenance_overdue,
        "fuel_month_cost": round(fuel_month_cost, 0),
        "fuel_month_liters": round(fuel_month_liters, 1),
        "total_expenses": round(total_expenses, 0),
    }


# ── Alerts ────────────────────────────────────────────────────────

async def get_fleet_alerts(db: AsyncSession, company_id: str) -> list[dict]:
    """Check for all fleet alerts: license, insurance, ITV, maintenance."""
    now = datetime.now(timezone.utc)
    in_7_days = now + timedelta(days=7)
    in_30_days = now + timedelta(days=30)
    alerts = []

    # ── 1. Driver license expiration ──
    r = await db.execute(
        select(Driver).where(
            Driver.company_id == company_id,
            Driver.activo == True,
            Driver.licencia_vencimiento.isnot(None),
        ).order_by(Driver.licencia_vencimiento)
    )
    for driver in r.scalars().all():
        venc = driver.licencia_vencimiento.replace(tzinfo=timezone.utc) if driver.licencia_vencimiento.tzinfo is None else driver.licencia_vencimiento
        if venc < now:
            alerts.append({
                "tipo": "licencia_vencida", "severidad": "critical",
                "titulo": f"Licencia vencida — {driver.nombre}",
                "descripcion": f"Venció el {venc.strftime('%d/%m/%Y')}",
                "entidad": "driver", "entidad_id": str(driver.id),
                "driver_nombre": driver.nombre, "fecha": venc.isoformat(),
            })
        elif venc <= in_7_days:
            alerts.append({
                "tipo": "licencia_por_vencer", "severidad": "warning",
                "titulo": f"Licencia próxima a vencer — {driver.nombre}",
                "descripcion": f"Vence el {venc.strftime('%d/%m/%Y')} ({(venc - now).days} días)",
                "entidad": "driver", "entidad_id": str(driver.id),
                "driver_nombre": driver.nombre, "fecha": venc.isoformat(),
            })
        elif venc <= in_30_days:
            alerts.append({
                "tipo": "licencia_por_vencer", "severidad": "info",
                "titulo": f"Licencia por vencer — {driver.nombre}",
                "descripcion": f"Vence el {venc.strftime('%d/%m/%Y')} ({(venc - now).days} días)",
                "entidad": "driver", "entidad_id": str(driver.id),
                "driver_nombre": driver.nombre, "fecha": venc.isoformat(),
            })

    # ── 2. Vehicle insurance expiration ──
    r = await db.execute(
        select(Vehicle).where(
            Vehicle.company_id == company_id,
            Vehicle.activo == True,
            Vehicle.seguro_vencimiento.isnot(None),
        ).order_by(Vehicle.seguro_vencimiento)
    )
    for v in r.scalars().all():
        venc = v.seguro_vencimiento.replace(tzinfo=timezone.utc) if v.seguro_vencimiento.tzinfo is None else v.seguro_vencimiento
        label = f"{v.marca or ''} {v.modelo or ''} ({v.patente or 'sin patente'})"
        if venc < now:
            alerts.append({
                "tipo": "seguro_vencido", "severidad": "critical",
                "titulo": f"Seguro vencido — {label}",
                "descripcion": f"Venció el {venc.strftime('%d/%m/%Y')}",
                "entidad": "vehicle", "entidad_id": str(v.id),
                "fecha": venc.isoformat(),
            })
        elif venc <= in_7_days:
            alerts.append({
                "tipo": "seguro_por_vencer", "severidad": "warning",
                "titulo": f"Seguro próximo a vencer — {label}",
                "descripcion": f"Vence el {venc.strftime('%d/%m/%Y')} ({(venc - now).days} días)",
                "entidad": "vehicle", "entidad_id": str(v.id),
                "fecha": venc.isoformat(),
            })
        elif venc <= in_30_days:
            alerts.append({
                "tipo": "seguro_por_vencer", "severidad": "info",
                "titulo": f"Seguro por vencer — {label}",
                "descripcion": f"Vence el {venc.strftime('%d/%m/%Y')} ({(venc - now).days} días)",
                "entidad": "vehicle", "entidad_id": str(v.id),
                "fecha": venc.isoformat(),
            })

    # ── 3. Vehicle ITV/DGR expiration ──
    r = await db.execute(
        select(Vehicle).where(
            Vehicle.company_id == company_id,
            Vehicle.activo == True,
            Vehicle.itv_vencimiento.isnot(None),
        ).order_by(Vehicle.itv_vencimiento)
    )
    for v in r.scalars().all():
        venc = v.itv_vencimiento.replace(tzinfo=timezone.utc) if v.itv_vencimiento.tzinfo is None else v.itv_vencimiento
        label = f"{v.marca or ''} {v.modelo or ''} ({v.patente or 'sin patente'})"
        if venc < now:
            alerts.append({
                "tipo": "itv_vencida", "severidad": "critical",
                "titulo": f"ITV/DGR vencida — {label}",
                "descripcion": f"Venció el {venc.strftime('%d/%m/%Y')}",
                "entidad": "vehicle", "entidad_id": str(v.id),
                "fecha": venc.isoformat(),
            })
        elif venc <= in_7_days:
            alerts.append({
                "tipo": "itv_por_vencer", "severidad": "warning",
                "titulo": f"ITV/DGR próxima a vencer — {label}",
                "descripcion": f"Vence el {venc.strftime('%d/%m/%Y')} ({(venc - now).days} días)",
                "entidad": "vehicle", "entidad_id": str(v.id),
                "fecha": venc.isoformat(),
            })
        elif venc <= in_30_days:
            alerts.append({
                "tipo": "itv_por_vencer", "severidad": "info",
                "titulo": f"ITV/DGR por vencer — {label}",
                "descripcion": f"Vence el {venc.strftime('%d/%m/%Y')} ({(venc - now).days} días)",
                "entidad": "vehicle", "entidad_id": str(v.id),
                "fecha": venc.isoformat(),
            })

    # ── 4. Upcoming/overdue maintenance ──
    r = await db.execute(
        select(VehicleMaintenance).where(
            VehicleMaintenance.tenant_id == UUID(company_id),
            VehicleMaintenance.status.in_(["scheduled", "in_progress"]),
        ).order_by(VehicleMaintenance.scheduled_date.asc().nullslast())
    )
    for m in r.scalars().all():
        if m.scheduled_date:
            sd = m.scheduled_date.replace(tzinfo=timezone.utc) if m.scheduled_date.tzinfo is None else m.scheduled_date
            tipo_label = {
                "oil_change": "Cambio de aceite", "tires": "Neumáticos",
                "brakes": "Frenos", "general_service": "Service general",
                "itv": "ITV", "insurance": "Seguro",
            }.get(m.tipo, m.tipo.replace("_", " ").title())

            if sd < now:
                alerts.append({
                    "tipo": "mantenimiento_vencido", "severidad": "critical",
                    "titulo": f"Mantenimiento vencido — {tipo_label}",
                    "descripcion": f"Programado para {sd.strftime('%d/%m/%Y')} (venció hace {(now - sd).days} días)",
                    "entidad": "maintenance", "entidad_id": str(m.id),
                    "fecha": sd.isoformat(),
                })
            elif sd <= in_7_days:
                alerts.append({
                    "tipo": "mantenimiento_proximo", "severidad": "warning",
                    "titulo": f"Mantenimiento próximo — {tipo_label}",
                    "descripcion": f"Programado para {sd.strftime('%d/%m/%Y')} (en {(sd - now).days} días)",
                    "entidad": "maintenance", "entidad_id": str(m.id),
                    "fecha": sd.isoformat(),
                })
            elif sd <= in_30_days:
                alerts.append({
                    "tipo": "mantenimiento_proximo", "severidad": "info",
                    "titulo": f"Mantenimiento próximo — {tipo_label}",
                    "descripcion": f"Programado para {sd.strftime('%d/%m/%Y')} (en {(sd - now).days} días)",
                    "entidad": "maintenance", "entidad_id": str(m.id),
                    "fecha": sd.isoformat(),
                })

    alerts.sort(key=lambda a: {"critical": 0, "warning": 1, "info": 2}[a["severidad"]])
    return alerts
