from sqlalchemy import select, func as sa_func, and_, desc, delete, text
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime, timezone, timedelta, date, time
from typing import Optional
import uuid, math

from api.src.schedule.models import (
    ShiftTemplate, ShiftPlan, TimeClockEntry, ShiftSwap, ShiftCostConfig,
)
from api.src.schedule.schemas import (
    ShiftTemplateCreate, ShiftTemplateResponse,
    ShiftPlanCreate, ShiftPlanResponse,
    TimeClockEntryCreate, TimeClockEntryResponse,
    ShiftSwapCreate, ShiftSwapResponse,
    ShiftCostConfigCreate, ShiftCostConfigResponse,
    HoursSummaryResponse, ScheduleDashboardResponse,
)


def _parse_time(val: str) -> time:
    parts = val.split(":")
    return time(int(parts[0]), int(parts[1]) if len(parts) > 1 else 0)


def _time_to_str(t: time) -> str:
    return f"{t.hour:02d}:{t.minute:02d}"


# ── Shift Templates ──────────────────────────────────────────────

async def create_template(db: AsyncSession, company_id: str, data: ShiftTemplateCreate) -> dict:
    tpl = ShiftTemplate(
        company_id=uuid.UUID(company_id),
        branch_id=data.branch_id,
        nombre=data.nombre,
        area=data.area,
        rol=data.rol,
        hora_inicio=_parse_time(data.hora_inicio),
        hora_fin=_parse_time(data.hora_fin),
        days_of_week=data.days_of_week,
        quantity_required=data.quantity_required,
        min_break_minutes=data.min_break_minutes,
        is_night_shift=data.is_night_shift,
        is_holiday=data.is_holiday,
    )
    db.add(tpl)
    await db.flush()
    return ShiftTemplateResponse.model_validate(tpl).model_dump()


async def list_templates(db: AsyncSession, company_id: str, area: Optional[str] = None, activo: Optional[bool] = None) -> list[dict]:
    q = select(ShiftTemplate).where(ShiftTemplate.company_id == company_id)
    if area:
        q = q.where(ShiftTemplate.area == area)
    if activo is not None:
        q = q.where(ShiftTemplate.activo == activo)
    q = q.order_by(ShiftTemplate.area, ShiftTemplate.nombre)
    r = await db.execute(q)
    return [ShiftTemplateResponse.model_validate(t).model_dump() for t in r.scalars().all()]


async def update_template(db: AsyncSession, company_id: str, tpl_id: str, data: dict) -> Optional[dict]:
    r = await db.execute(
        select(ShiftTemplate).where(ShiftTemplate.id == tpl_id, ShiftTemplate.company_id == company_id)
    )
    tpl = r.scalar_one_or_none()
    if not tpl:
        return None
    if "hora_inicio" in data:
        data["hora_inicio"] = _parse_time(data["hora_inicio"])
    if "hora_fin" in data:
        data["hora_fin"] = _parse_time(data["hora_fin"])
    for k, v in data.items():
        if hasattr(tpl, k):
            setattr(tpl, k, v)
    await db.flush()
    return ShiftTemplateResponse.model_validate(tpl).model_dump()


# ── Shift Plans ──────────────────────────────────────────────────

async def create_plan(db: AsyncSession, company_id: str, data: ShiftPlanCreate) -> dict:
    plan_date = datetime.strptime(data.fecha, "%Y-%m-%d").date() if isinstance(data.fecha, str) else data.fecha

    plan = ShiftPlan(
        company_id=uuid.UUID(company_id),
        branch_id=data.branch_id,
        template_id=data.template_id,
        employee_id=data.employee_id,
        employee_name=data.employee_name,
        area=data.area,
        rol=data.rol,
        fecha=plan_date,
        hora_inicio=_parse_time(data.hora_inicio),
        hora_fin=_parse_time(data.hora_fin),
        is_night_shift=data.is_night_shift,
        is_holiday=data.is_holiday,
        notes=data.notes,
    )

    conflicts = await _detect_conflicts(db, company_id, data.employee_id, plan_date, data.hora_inicio, data.hora_fin, None)
    if conflicts:
        plan.conflict_detected = True
        plan.conflict_detail = "; ".join(conflicts)
        plan.status = "conflict"

    db.add(plan)
    await db.flush()
    return ShiftPlanResponse.model_validate(plan).model_dump()


async def _detect_conflicts(db, company_id, employee_id, plan_date, hora_inicio, hora_fin, exclude_id):
    conflicts = []
    hi = _parse_time(hora_inicio) if isinstance(hora_inicio, str) else hora_inicio
    hf = _parse_time(hora_fin) if isinstance(hora_fin, str) else hora_fin

    q = select(ShiftPlan).where(
        ShiftPlan.company_id == company_id,
        ShiftPlan.employee_id == employee_id,
        ShiftPlan.fecha == plan_date,
        ShiftPlan.status != "cancelled",
    )
    if exclude_id:
        q = q.where(ShiftPlan.id != exclude_id)
    r = await db.execute(q)
    existing = r.scalars().all()

    for e in existing:
        e_hi = e.hora_inicio
        e_hf = e.hora_fin
        if hi < e_hf and hf > e_hi:
            hours_overlap = []
            if hi < e_hf and hf > e_hi:
                start = max(hi, e_hi)
                end = min(hf, e_hf)
                mins = (datetime.combine(date.today(), end) - datetime.combine(date.today(), start)).seconds // 60
                if mins > 0:
                    conflicts.append(f"Solapa con turno {e.id.hex[:8]} ({_time_to_str(e_hi)}-{_time_to_str(e_hf)}) por {mins}min")
    return conflicts


async def list_plans(
    db: AsyncSession, company_id: str,
    area: Optional[str] = None, fecha: Optional[str] = None,
    employee_id: Optional[str] = None, status: Optional[str] = None,
    limit: int = 100, offset: int = 0,
) -> list[dict]:
    q = select(ShiftPlan).where(ShiftPlan.company_id == company_id)
    if area:
        q = q.where(ShiftPlan.area == area)
    if fecha:
        plan_date = datetime.strptime(fecha, "%Y-%m-%d").date()
        q = q.where(ShiftPlan.fecha == plan_date)
    if employee_id:
        q = q.where(ShiftPlan.employee_id == employee_id)
    if status:
        q = q.where(ShiftPlan.status == status)
    q = q.order_by(ShiftPlan.fecha, ShiftPlan.hora_inicio).offset(offset).limit(limit)
    r = await db.execute(q)
    return [ShiftPlanResponse.model_validate(p).model_dump() for p in r.scalars().all()]


async def update_plan_status(db: AsyncSession, company_id: str, plan_id: str, status: str) -> Optional[dict]:
    r = await db.execute(
        select(ShiftPlan).where(ShiftPlan.id == plan_id, ShiftPlan.company_id == company_id)
    )
    p = r.scalar_one_or_none()
    if not p:
        return None
    p.status = status
    await db.flush()
    return ShiftPlanResponse.model_validate(p).model_dump()


async def generate_weekly_plan(db: AsyncSession, company_id: str, start_date: str) -> dict:
    from api.src.customers.models import Partner as Employee

    start = datetime.strptime(start_date, "%Y-%m-%d").date()
    end = start + timedelta(days=6)

    r = await db.execute(
        select(ShiftTemplate).where(
            ShiftTemplate.company_id == company_id,
            ShiftTemplate.activo == True,
        )
    )
    templates = r.scalars().all()

    r = await db.execute(
        select(Employee).where(Employee.company_id == company_id)
    )
    employees = r.scalars().all()

    created = 0
    skipped = 0
    for day_offset in range(7):
        day = start + timedelta(days=day_offset)
        dow = day.weekday()
        for tpl in templates:
            if tpl.days_of_week and dow not in tpl.days_of_week:
                continue
            for _ in range(tpl.quantity_required):
                emp = _pick_employee(employees, tpl.area, day, company_id)
                if not emp:
                    skipped += 1
                    continue
                try:
                    await create_plan(db, company_id, ShiftPlanCreate(
                        template_id=tpl.id,
                        employee_id=emp.id,
                        employee_name=emp.nombre,
                        area=tpl.area,
                        rol=tpl.rol,
                        fecha=day.isoformat(),
                        hora_inicio=_time_to_str(tpl.hora_inicio),
                        hora_fin=_time_to_str(tpl.hora_fin),
                        is_night_shift=tpl.is_night_shift,
                        is_holiday=tpl.is_holiday,
                    ))
                    created += 1
                except:
                    skipped += 1

    return {"created": created, "skipped": skipped, "start_date": start_date, "end_date": end.isoformat()}


def _pick_employee(employees, area, day, company_id):
    import random
    candidates = [e for e in employees]
    if not candidates:
        return None
    return random.choice(candidates)


# ── Time Clock ───────────────────────────────────────────────────

async def clock_in_out(db: AsyncSession, company_id: str, employee_id: str, data: TimeClockEntryCreate) -> dict:
    entry = TimeClockEntry(
        company_id=uuid.UUID(company_id),
        branch_id=data.branch_id,
        employee_id=uuid.UUID(employee_id),
        plan_id=data.plan_id,
        tipo=data.tipo,
        timestamp=datetime.now(timezone.utc),
        source=data.source,
        latitude=data.latitude,
        longitude=data.longitude,
        device_id=data.device_id,
        notes=data.notes,
    )
    db.add(entry)
    await db.flush()
    return TimeClockEntryResponse.model_validate(entry).model_dump()


async def get_today_entries(db: AsyncSession, company_id: str, employee_id: str) -> list[dict]:
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    r = await db.execute(
        select(TimeClockEntry).where(
            TimeClockEntry.company_id == company_id,
            TimeClockEntry.employee_id == employee_id,
            TimeClockEntry.timestamp >= today_start,
        ).order_by(TimeClockEntry.timestamp)
    )
    return [TimeClockEntryResponse.model_validate(e).model_dump() for e in r.scalars().all()]


# ── Shift Swaps ──────────────────────────────────────────────────

async def request_swap(db: AsyncSession, company_id: str, requester_id: str, data: ShiftSwapCreate) -> dict:
    swap = ShiftSwap(
        company_id=uuid.UUID(company_id),
        plan_id=data.plan_id,
        requester_id=uuid.UUID(requester_id),
        receiver_id=data.receiver_id,
        reason=data.reason,
    )
    db.add(swap)
    await db.flush()
    return ShiftSwapResponse.model_validate(swap).model_dump()


async def list_swaps(db: AsyncSession, company_id: str, status: Optional[str] = None, limit: int = 50) -> list[dict]:
    q = select(ShiftSwap).where(ShiftSwap.company_id == company_id)
    if status:
        q = q.where(ShiftSwap.status == status)
    q = q.order_by(desc(ShiftSwap.created_at)).limit(limit)
    r = await db.execute(q)
    return [ShiftSwapResponse.model_validate(s).model_dump() for s in r.scalars().all()]


async def approve_swap(db: AsyncSession, company_id: str, swap_id: str, approved_by: str) -> Optional[dict]:
    r = await db.execute(
        select(ShiftSwap).where(ShiftSwap.id == swap_id, ShiftSwap.company_id == company_id)
    )
    swap = r.scalar_one_or_none()
    if not swap:
        return None
    swap.status = "approved"
    swap.approved_by = uuid.UUID(approved_by)
    swap.approved_at = datetime.now(timezone.utc)

    plan_r = await db.execute(select(ShiftPlan).where(ShiftPlan.id == swap.plan_id))
    plan = plan_r.scalar_one_or_none()
    if plan:
        plan.employee_id = swap.receiver_id
        plan.status = "swapped"

    await db.flush()
    return ShiftSwapResponse.model_validate(swap).model_dump()


# ── Cost Config ──────────────────────────────────────────────────

DEFAULT_COST_FACTORS = {
    "normal": 1.0, "extra": 1.5, "night": 1.3, "holiday": 2.0,
}

async def get_or_init_cost_configs(db: AsyncSession, company_id: str) -> list[dict]:
    existing = (await db.execute(
        select(ShiftCostConfig).where(ShiftCostConfig.company_id == company_id)
    )).scalars().all()

    if not existing:
        for tipo, factor in DEFAULT_COST_FACTORS.items():
            descs = {"normal": "Horas normales", "extra": "Horas extra (50% recargo)", "night": "Horas nocturnas (30% recargo)", "holiday": "Horas feriadas (100% recargo)"}
            cfg = ShiftCostConfig(company_id=uuid.UUID(company_id), tipo_hora=tipo, factor_pct=factor, descripcion=descs.get(tipo))
            db.add(cfg)
        await db.flush()
        existing = (await db.execute(
            select(ShiftCostConfig).where(ShiftCostConfig.company_id == company_id)
        )).scalars().all()

    return [ShiftCostConfigResponse.model_validate(c).model_dump() for c in existing]


async def update_cost_config(db: AsyncSession, company_id: str, config_id: str, data: ShiftCostConfigCreate) -> Optional[dict]:
    r = await db.execute(
        select(ShiftCostConfig).where(ShiftCostConfig.id == config_id, ShiftCostConfig.company_id == company_id)
    )
    cfg = r.scalar_one_or_none()
    if not cfg:
        return None
    cfg.tipo_hora = data.tipo_hora
    cfg.factor_pct = data.factor_pct
    cfg.descripcion = data.descripcion
    await db.flush()
    return ShiftCostConfigResponse.model_validate(cfg).model_dump()


# ── Hours Calculation & Dashboard ────────────────────────────────

async def compute_hours_summary(db: AsyncSession, company_id: str, fecha_desde: str, fecha_hasta: str) -> list[dict]:
    desde = datetime.strptime(fecha_desde, "%Y-%m-%d").date()
    hasta = datetime.strptime(fecha_hasta, "%Y-%m-%d").date()

    r = await db.execute(
        select(ShiftPlan).where(
            ShiftPlan.company_id == company_id,
            ShiftPlan.fecha.between(desde, hasta),
            ShiftPlan.status.in_(["planned", "confirmed", "swapped"]),
        ).order_by(ShiftPlan.employee_id, ShiftPlan.fecha)
    )
    plans = r.scalars().all()

    cost_cfgs = await get_or_init_cost_configs(db, company_id)
    cost_map = {c["tipo_hora"]: c["factor_pct"] for c in cost_cfgs}

    clock_r = await db.execute(
        select(TimeClockEntry).where(
            TimeClockEntry.company_id == company_id,
            TimeClockEntry.timestamp >= datetime.combine(desde, time.min).replace(tzinfo=timezone.utc),
            TimeClockEntry.timestamp <= datetime.combine(hasta, time.max).replace(tzinfo=timezone.utc),
        )
    )
    clock_entries = r2 = clock_r.scalars().all()

    emp_data = {}
    for p in plans:
        eid = str(p.employee_id)
        if eid not in emp_data:
            emp_data[eid] = {"employee_id": eid, "employee_name": p.employee_name, "area": p.area, "total_minutes": 0, "normal_minutes": 0, "extra_minutes": 0, "night_minutes": 0, "holiday_minutes": 0, "clocked_minutes": 0}
        d = emp_data[eid]
        hi = p.hora_inicio
        hf = p.hora_fin
        if hf <= hi:
            mins = ((datetime.combine(date.today(), hf) + timedelta(days=1)) - datetime.combine(date.today(), hi)).seconds // 60
        else:
            mins = (datetime.combine(date.today(), hf) - datetime.combine(date.today(), hi)).seconds // 60

        d["total_minutes"] += mins
        if p.is_holiday:
            d["holiday_minutes"] += mins
        elif p.is_night_shift:
            d["night_minutes"] += mins
        elif mins > 480:
            d["normal_minutes"] += 480
            d["extra_minutes"] += mins - 480
        else:
            d["normal_minutes"] += mins

    for e in clock_entries:
        eid = str(e.employee_id)
        if eid in emp_data and e.tipo in ("entrada", "salida"):
            emp_data[eid]["clocked_minutes"] += 1

    result = []
    for eid, d in emp_data.items():
        normal_cost = (d["normal_minutes"] / 60) * 15000 * cost_map.get("normal", 1.0)
        extra_cost = (d["extra_minutes"] / 60) * 15000 * cost_map.get("extra", 1.5)
        night_cost = (d["night_minutes"] / 60) * 15000 * cost_map.get("night", 1.3)
        holiday_cost = (d["holiday_minutes"] / 60) * 15000 * cost_map.get("holiday", 2.0)
        total_cost = round(normal_cost + extra_cost + night_cost + holiday_cost)

        total_hours = d["total_minutes"] / 60
        attendance_pct = round((d["clocked_minutes"] / max(1, total_hours * 2)) * 100, 1)
        total_hours = round(total_hours, 1)

        result.append(HoursSummaryResponse(
            employee_id=uuid.UUID(eid),
            employee_name=d["employee_name"],
            area=d["area"],
            total_hours=total_hours,
            normal_hours=round(d["normal_minutes"] / 60, 1),
            extra_hours=round(d["extra_minutes"] / 60, 1),
            night_hours=round(d["night_minutes"] / 60, 1),
            holiday_hours=round(d["holiday_minutes"] / 60, 1),
            total_cost=total_cost,
            clocked_hours=round(d["clocked_minutes"] / 60, 1),
            attendance_pct=min(100, attendance_pct),
        ).model_dump())

    return result


async def get_dashboard(db: AsyncSession, company_id: str, fecha_desde: str, fecha_hasta: str) -> dict:
    desde = datetime.strptime(fecha_desde, "%Y-%m-%d").date()
    hasta = datetime.strptime(fecha_hasta, "%Y-%m-%d").date()

    summaries = await compute_hours_summary(db, company_id, fecha_desde, fecha_hasta)

    total_planned = sum(s["total_hours"] for s in summaries)
    total_clocked = sum(s["clocked_hours"] for s in summaries)
    total_extra = sum(s["extra_hours"] for s in summaries)
    total_night = sum(s["night_hours"] for s in summaries)
    total_holiday = sum(s["holiday_hours"] for s in summaries)
    total_cost = sum(s["total_cost"] for s in summaries)

    r = await db.execute(
        select(ShiftPlan).where(
            ShiftPlan.company_id == company_id,
            ShiftPlan.fecha.between(desde, hasta),
        )
    )
    all_plans = r.scalars().all()
    total_employees = len(set(str(p.employee_id) for p in all_plans))

    r = await db.execute(
        select(ShiftPlan.area, sa_func.count(sa_func.distinct(ShiftPlan.employee_id)))
        .where(ShiftPlan.company_id == company_id, ShiftPlan.fecha.between(desde, hasta))
        .group_by(ShiftPlan.area)
    )
    by_area = [{"area": row[0], "count": row[1]} for row in r.all()]

    r = await db.execute(
        select(ShiftSwap).where(
            ShiftSwap.company_id == company_id,
            ShiftSwap.status == "pending",
        )
    )
    pending_swaps = len(r.scalars().all())

    absent = sum(1 for s in summaries if s["attendance_pct"] < 50)
    attendance_rate = round((sum(s["attendance_pct"] for s in summaries) / max(1, len(summaries))), 1) if summaries else 0

    clocked_employees = len([s for s in summaries if s["clocked_hours"] > 0])

    return ScheduleDashboardResponse(
        total_employees_planned=total_employees,
        total_employees_clocked=clocked_employees,
        planned_hours=round(total_planned, 1),
        clocked_hours=round(total_clocked, 1),
        extra_hours=round(total_extra, 1),
        night_hours=round(total_night, 1),
        holiday_hours=round(total_holiday, 1),
        total_cost=round(total_cost),
        absent_count=absent,
        attendance_rate=attendance_rate,
        pending_swaps=pending_swaps,
        by_area=by_area,
        employee_summaries=summaries,
    ).model_dump()
