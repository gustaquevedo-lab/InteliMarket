"""Fase 1 — HACCP service: plans, critical points, monitoring, corrective actions"""

from datetime import datetime, date
from decimal import Decimal
from typing import Optional
from uuid import UUID
from sqlalchemy import func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from fastapi import HTTPException

from .models import HaccpPlan, HaccpCriticalPoint, HaccpMonitoringLog, HaccpCorrectiveAction



# ---------------------------------------------------------------------------
# PLANS
# ---------------------------------------------------------------------------

async def list_haccp_plans(company_id: UUID, db: AsyncSession, activo: Optional[bool] = None):
    q = db.query(HaccpPlan).filter(HaccpPlan.company_id == company_id)
    if activo is not None:
        q = q.filter(HaccpPlan.activo == activo)
    return q.order_by(HaccpPlan.nombre).all()


async def get_haccp_plan(plan_id: UUID, db: AsyncSession):
    p = db.query(HaccpPlan).options(
        selectinload(HaccpPlan.critical_points).selectinload(HaccpCriticalPoint.monitoring_logs),
    ).get(plan_id)
    if not p:
        raise HTTPException(404, "HACCP plan not found")
    return p


async def create_haccp_plan(company_id: UUID, data, db: AsyncSession):
    p = HaccpPlan(company_id=company_id, **data.model_dump(exclude_none=True))
    db.add(p)
    db.commit()
    db.refresh(p)
    return await get_haccp_plan(p.id, db)


async def update_haccp_plan(plan_id: UUID, data, db: AsyncSession):
    p = await get_haccp_plan(plan_id, db)
    for k, v in data.model_dump(exclude_none=True).items():
        setattr(p, k, v)
    db.commit()
    db.refresh(p)
    return await get_haccp_plan(plan_id, db)


# ---------------------------------------------------------------------------
# CRITICAL POINTS
# ---------------------------------------------------------------------------

async def list_critical_points(plan_id: UUID, db: AsyncSession):
    return db.query(HaccpCriticalPoint).filter(
        HaccpCriticalPoint.plan_id == plan_id,
    ).order_by(HaccpCriticalPoint.orden).all()


async def create_critical_point(plan_id: UUID, data, db: AsyncSession):
    plan = db.query(HaccpPlan).get(plan_id)
    if not plan:
        raise HTTPException(404, "HACCP plan not found")
    cp = HaccpCriticalPoint(plan_id=plan_id, **data.model_dump(exclude_none=True))
    db.add(cp)
    db.commit()
    db.refresh(cp)
    return cp


async def update_critical_point(cp_id: UUID, data, db: AsyncSession):
    cp = db.query(HaccpCriticalPoint).get(cp_id)
    if not cp:
        raise HTTPException(404, "Critical point not found")
    for k, v in data.model_dump(exclude_none=True).items():
        setattr(cp, k, v)
    db.commit()
    db.refresh(cp)
    return cp


async def delete_critical_point(cp_id: UUID, db: AsyncSession):
    cp = db.query(HaccpCriticalPoint).get(cp_id)
    if not cp:
        raise HTTPException(404, "Critical point not found")
    db.delete(cp)
    db.commit()
    return {"ok": True}


# ---------------------------------------------------------------------------
# MONITORING LOGS
# ---------------------------------------------------------------------------

async def create_monitoring_log(cp_id: UUID, user_id: UUID, data, db: AsyncSession):
    cp = db.query(HaccpCriticalPoint).get(cp_id)
    if not cp:
        raise HTTPException(404, "Critical point not found")
    lim_inf = data.limite_inferior or cp.limite_inferior
    lim_sup = data.limite_superior or cp.limite_superior
    conforme = True
    if lim_inf is not None and lim_sup is not None:
        conforme = lim_inf <= data.valor <= lim_sup
    log = HaccpMonitoringLog(
        critical_point_id=cp_id,
        registrado_por=user_id,
        conforme=conforme,
        **data.model_dump(exclude_none=True),
    )
    db.add(log)

    # Auto-create corrective action if not conforming
    if not conforme and cp.accion_correctiva_template:
        ca = HaccpCorrectiveAction(
            monitoring_log_id=log.id,
            critical_point_id=cp_id,
            descripcion=f"Desviación en {cp.nombre}: {data.valor} fuera de rango [{lim_inf}, {lim_sup}]",
            accion_tomada=cp.accion_correctiva_template,
            responsable_id=user_id,
        )
        db.add(ca)

    db.commit()
    db.refresh(log)
    return log


async def list_monitoring_logs(cp_id: UUID, db: AsyncSession):
    return db.query(HaccpMonitoringLog).filter(
        HaccpMonitoringLog.critical_point_id == cp_id,
    ).order_by(HaccpMonitoringLog.registrado_at.desc()).all()


# ---------------------------------------------------------------------------
# CORRECTIVE ACTIONS
# ---------------------------------------------------------------------------

async def list_corrective_actions(company_id: UUID, db: AsyncSession, resuelto: Optional[bool] = None):
    q = db.query(HaccpCorrectiveAction).join(HaccpCriticalPoint).join(HaccpPlan).filter(
        HaccpPlan.company_id == company_id,
    )
    if resuelto is not None:
        q = q.filter(HaccpCorrectiveAction.resuelto == resuelto)
    return q.order_by(HaccpCorrectiveAction.created_at.desc()).all()


async def create_corrective_action(data, db: AsyncSession):
    ca = HaccpCorrectiveAction(**data.model_dump(exclude_none=True))
    db.add(ca)
    db.commit()
    db.refresh(ca)
    return ca


async def resolve_corrective_action(ca_id: UUID, db: AsyncSession):
    ca = db.query(HaccpCorrectiveAction).get(ca_id)
    if not ca:
        raise HTTPException(404, "Corrective action not found")
    ca.resuelto = True
    ca.resuelto_at = datetime.utcnow()
    db.commit()
    db.refresh(ca)
    return ca


# ---------------------------------------------------------------------------
# COMPLIANCE REPORT
# ---------------------------------------------------------------------------

async def compliance_report(company_id: UUID, db: AsyncSession, periodo: str = "mes"):
    plans = db.query(HaccpPlan).filter(
        HaccpPlan.company_id == company_id, HaccpPlan.activo == True,
    ).all()
    total_cp = 0
    total_logs = 0
    total_conforme = 0
    total_ca = 0
    total_cost = 0
    for p in plans:
        for cp in p.critical_points or []:
            total_cp += 1
            for log in cp.monitoring_logs or []:
                total_logs += 1
                if log.conforme:
                    total_conforme += 1
    conformity = Decimal("0")
    if total_logs > 0:
        conformity = Decimal(total_conforme) / Decimal(total_logs) * 100
    return {
        "periodo": periodo,
        "total_puntos_criticos": total_cp,
        "monitoreos_realizados": total_logs,
        "conformidad_pct": round(conformity, 2),
        "acciones_correctivas": total_ca,
        "costo_total_perdidas": 0,
        "puntos_fuera_control": [],
        "por_area": [],
    }


# ---------------------------------------------------------------------------
# DASHBOARD
# ---------------------------------------------------------------------------

async def haccp_dashboard(company_id: UUID, db: AsyncSession):
    active_plans = db.query(HaccpPlan).filter(
        HaccpPlan.company_id == company_id, HaccpPlan.activo == True,
    ).count()
    cp_count = db.query(HaccpCriticalPoint).join(HaccpPlan).filter(
        HaccpPlan.company_id == company_id, HaccpCriticalPoint.activo == True,
    ).count()
    today = date.today()
    logs_today = db.query(HaccpMonitoringLog).join(HaccpCriticalPoint).join(HaccpPlan).filter(
        HaccpPlan.company_id == company_id,
        func.date(HaccpMonitoringLog.registrado_at) == today,
    ).count()
    total_logs = db.query(HaccpMonitoringLog).join(HaccpCriticalPoint).join(HaccpPlan).filter(
        HaccpPlan.company_id == company_id,
    ).count()
    conforming = db.query(HaccpMonitoringLog).join(HaccpCriticalPoint).join(HaccpPlan).filter(
        HaccpPlan.company_id == company_id,
        HaccpMonitoringLog.conforme == True,
    ).count()
    pct = Decimal("0")
    if total_logs > 0:
        pct = Decimal(conforming) / Decimal(total_logs) * 100
    pending_actions = db.query(HaccpCorrectiveAction).join(HaccpCriticalPoint).join(HaccpPlan).filter(
        HaccpPlan.company_id == company_id,
        HaccpCorrectiveAction.resuelto == False,
    ).count()
    return {
        "planes_activos": active_plans,
        "puntos_criticos": cp_count,
        "monitoreos_hoy": logs_today,
        "conformidad_pct": round(pct, 2),
        "alertas_activas": total_logs - conforming,
        "acciones_pendientes": pending_actions,
    }
