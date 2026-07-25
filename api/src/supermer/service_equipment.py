"""Fase 1 — Equipment Maintenance service: equipment, schedules, work orders, alerts"""

from datetime import date, datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID
from sqlalchemy import func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from fastapi import HTTPException

from .models import StoreEquipment, MaintenanceSchedule, WorkOrder, EquipmentAlert


# ---------------------------------------------------------------------------
# EQUIPMENT
# ---------------------------------------------------------------------------

async def list_equipment(company_id: UUID, db: AsyncSession, categoria: Optional[str] = None, activo: Optional[bool] = None):
    q = db.query(StoreEquipment).filter(StoreEquipment.company_id == company_id)
    if categoria:
        q = q.filter(StoreEquipment.categoria == categoria)
    if activo is not None:
        q = q.filter(StoreEquipment.activo == activo)
    return q.order_by(StoreEquipment.nombre).all()


async def get_equipment(equipment_id: UUID, db: AsyncSession):
    e = db.query(StoreEquipment).get(equipment_id)
    if not e:
        raise HTTPException(404, "Equipment not found")
    return e


async def create_equipment(company_id: UUID, data, db: AsyncSession):
    e = StoreEquipment(company_id=company_id, **data.model_dump(exclude_none=True))
    db.add(e)
    db.commit()
    db.refresh(e)
    return await get_equipment(e.id, db)


async def update_equipment(equipment_id: UUID, data, db: AsyncSession):
    e = await get_equipment(equipment_id, db)
    for k, v in data.model_dump(exclude_none=True).items():
        setattr(e, k, v)
    db.commit()
    db.refresh(e)
    return await get_equipment(equipment_id, db)


async def delete_equipment(equipment_id: UUID, db: AsyncSession):
    e = await get_equipment(equipment_id, db)
    db.delete(e)
    db.commit()
    return {"ok": True}


# ---------------------------------------------------------------------------
# MAINTENANCE SCHEDULES
# ---------------------------------------------------------------------------

async def list_schedules(company_id: UUID, db: AsyncSession, equipo_id: Optional[UUID] = None):
    q = db.query(MaintenanceSchedule).filter(MaintenanceSchedule.company_id == company_id)
    if equipo_id:
        q = q.filter(MaintenanceSchedule.equipo_id == equipo_id)
    return q.order_by(MaintenanceSchedule.created_at.desc()).all()


async def create_schedule(company_id: UUID, data, db: AsyncSession):
    equip = await get_equipment(data.equipo_id, db)
    s = MaintenanceSchedule(company_id=company_id, **data.model_dump())
    db.add(s)
    db.commit()
    db.refresh(s)
    return s


async def update_schedule(schedule_id: UUID, data, db: AsyncSession):
    s = db.query(MaintenanceSchedule).get(schedule_id)
    if not s:
        raise HTTPException(404, "Schedule not found")
    for k, v in data.model_dump(exclude_none=True).items():
        setattr(s, k, v)
    db.commit()
    db.refresh(s)
    return s


async def delete_schedule(schedule_id: UUID, db: AsyncSession):
    s = db.query(MaintenanceSchedule).get(schedule_id)
    if not s:
        raise HTTPException(404, "Schedule not found")
    db.delete(s)
    db.commit()
    return {"ok": True}


# ---------------------------------------------------------------------------
# WORK ORDERS
# ---------------------------------------------------------------------------

async def list_work_orders(
    company_id: UUID, db: AsyncSession,
    estado: Optional[str] = None,
    equipo_id: Optional[UUID] = None,
):
    q = db.query(WorkOrder).filter(WorkOrder.company_id == company_id)
    if estado:
        q = q.filter(WorkOrder.estado == estado)
    if equipo_id:
        q = q.filter(WorkOrder.equipo_id == equipo_id)
    return q.order_by(WorkOrder.created_at.desc()).all()


async def get_work_order(wo_id: UUID, db: AsyncSession):
    wo = db.query(WorkOrder).get(wo_id)
    if not wo:
        raise HTTPException(404, "Work order not found")
    return wo


async def create_work_order(company_id: UUID, data, db: AsyncSession):
    equip = await get_equipment(data.equipo_id, db)
    # Generate OT number
    count = db.query(WorkOrder).filter(WorkOrder.company_id == company_id).count() + 1
    wo = WorkOrder(
        company_id=company_id,
        numero_ot=f"OT-{company_id.hex[:4].upper()}-{count:04d}",
        **data.model_dump(exclude_none=True),
    )
    db.add(wo)
    db.commit()
    db.refresh(wo)
    return await get_work_order(wo.id, db)


async def update_work_order(wo_id: UUID, data, db: AsyncSession):
    wo = await get_work_order(wo_id, db)
    for k, v in data.model_dump(exclude_none=True).items():
        setattr(wo, k, v)
    db.commit()
    db.refresh(wo)
    return await get_work_order(wo_id, db)


async def start_work_order(wo_id: UUID, db: AsyncSession):
    wo = await get_work_order(wo_id, db)
    wo.estado = "en_progreso"
    wo.fecha_inicio = datetime.utcnow()
    db.commit()
    db.refresh(wo)
    return await get_work_order(wo_id, db)


async def complete_work_order(wo_id: UUID, data, db: AsyncSession):
    wo = await get_work_order(wo_id, db)
    wo.estado = "completado"
    wo.fecha_fin = datetime.utcnow()
    wo.diagnostico = data.diagnostico
    wo.acciones_realizadas = data.acciones_realizadas
    wo.resultado = data.resultado
    if data.horas_trabajadas:
        wo.horas_trabajadas = data.horas_trabajadas
    total = Decimal("0")
    if data.costo_repuestos:
        total += data.costo_repuestos
    if data.costo_mano_obra:
        total += data.costo_mano_obra
    wo.costo_total = total
    # Update equipment last maintenance date
    equip = await get_equipment(wo.equipo_id, db)
    equip.fecha_ultimo_mantenimiento = date.today()
    db.commit()
    db.refresh(wo)
    return await get_work_order(wo_id, db)


# ---------------------------------------------------------------------------
# ALERTS
# ---------------------------------------------------------------------------

async def list_alerts(company_id: UUID, db: AsyncSession, resuelta: Optional[bool] = None):
    q = db.query(EquipmentAlert).filter(EquipmentAlert.company_id == company_id)
    if resuelta is not None:
        q = q.filter(EquipmentAlert.resuelta == resuelta)
    return q.order_by(EquipmentAlert.created_at.desc()).all()


async def create_alert(company_id: UUID, data: dict, db: AsyncSession):
    alert = EquipmentAlert(company_id=company_id, **data)
    db.add(alert)
    db.commit()
    db.refresh(alert)
    return alert


async def resolve_alert(alert_id: UUID, db: AsyncSession):
    alert = db.query(EquipmentAlert).get(alert_id)
    if not alert:
        raise HTTPException(404, "Alert not found")
    alert.resuelta = True
    db.commit()
    db.refresh(alert)
    return alert


async def check_equipment_alerts(company_id: UUID, db: AsyncSession):
    """Auto-generate alerts for equipment overdue for maintenance."""
    today = date.today()
    overdue = db.query(StoreEquipment).filter(
        StoreEquipment.company_id == company_id,
        StoreEquipment.activo == True,
        StoreEquipment.fecha_proximo_mantenimiento <= today,
    ).all()
    created = []
    for equip in overdue:
        existing = db.query(EquipmentAlert).filter(
            EquipmentAlert.equipo_id == equip.id,
            EquipmentAlert.resuelta == False,
            EquipmentAlert.tipo == "mantenimiento_vencido",
        ).count()
        if existing == 0:
            alert = EquipmentAlert(
                company_id=company_id,
                equipo_id=equip.id,
                tipo="mantenimiento_vencido",
                severidad=equip.prioridad or "media",
                mensaje=f"Mantenimiento vencido para {equip.nombre} (vencía {equip.fecha_proximo_mantenimiento})",
            )
            db.add(alert)
            created.append(alert)
    if created:
        db.commit()
    return created


# ---------------------------------------------------------------------------
# DASHBOARD
# ---------------------------------------------------------------------------

async def equipment_dashboard(company_id: UUID, db: AsyncSession):
    total = db.query(StoreEquipment).filter(StoreEquipment.company_id == company_id).count()
    active = db.query(StoreEquipment).filter(
        StoreEquipment.company_id == company_id, StoreEquipment.activo == True,
    ).count()
    pending_mtto = db.query(StoreEquipment).filter(
        StoreEquipment.company_id == company_id,
        StoreEquipment.activo == True,
        StoreEquipment.fecha_proximo_mantenimiento <= date.today(),
    ).count()
    open_orders = db.query(WorkOrder).filter(
        WorkOrder.company_id == company_id,
        WorkOrder.estado.in_(["pendiente", "en_progreso"]),
    ).count()
    active_alerts = db.query(EquipmentAlert).filter(
        EquipmentAlert.company_id == company_id,
        EquipmentAlert.resuelta == False,
    ).count()
    return {
        "total_equipos": total,
        "equipos_activos": active,
        "mantenimientos_pendientes": pending_mtto,
        "ordenes_abiertas": open_orders,
        "alertas_activas": active_alerts,
        "por_categoria": [],
        "proximos_mantenimientos": [],
        "costo_mantenimiento_mes": 0,
        "uptime_promedio_pct": Decimal("0"),
    }
