from sqlalchemy import select, func as sa_func, and_, desc, asc, delete
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime, date, timedelta
from typing import Optional
import uuid

from api.src.productividad.models import ProductivityRecord, ProductivityTarget, EmployeeEfficiency
from api.src.productividad.schemas import (
    ProductivityRecordCreate, ProductivityRecordResponse,
    ProductivityTargetCreate, ProductivityTargetResponse,
    EmployeeEfficiencyResponse,
    AreaMetricsResponse, ProductivityDashboardResponse,
)


AREA_METRICS = {
    "caja": {"label": "Caja", "metric": "transactions_processed", "unit": "transacciones/hora", "display": "Transacciones/hora"},
    "carniceria": {"label": "Carnicería", "metric": "kg_processed", "unit": "kg/hora", "display": "Kg procesados/hora"},
    "panaderia": {"label": "Panadería", "metric": "units_processed", "unit": "unidades/hora", "display": "Unidades/hora"},
    "reposicion": {"label": "Reposición", "metric": "boxes_processed", "unit": "cajas/hora", "display": "Cajas repuestas/hora"},
}


# ── Productivity Records ─────────────────────────────────────────

async def create_record(db: AsyncSession, company_id: str, data: ProductivityRecordCreate) -> dict:
    rec = ProductivityRecord(
        company_id=uuid.UUID(company_id),
        branch_id=uuid.UUID(data.branch_id) if data.branch_id else None,
        employee_id=uuid.UUID(data.employee_id),
        employee_name=data.employee_name,
        area=data.area,
        fecha=datetime.strptime(data.fecha, "%Y-%m-%d").date(),
        transactions_processed=data.transactions_processed,
        kg_processed=data.kg_processed,
        units_processed=data.units_processed,
        boxes_processed=data.boxes_processed,
        sales_amount=data.sales_amount,
        hours_worked=data.hours_worked,
        planned_hours=data.planned_hours,
    )
    db.add(rec)
    await db.flush()
    return ProductivityRecordResponse.model_validate(rec).model_dump()


async def list_records(
    db: AsyncSession, company_id: str, area: Optional[str] = None,
    employee_id: Optional[str] = None, fecha_desde: Optional[str] = None,
    fecha_hasta: Optional[str] = None, limit: int = 100, offset: int = 0,
) -> list[dict]:
    q = select(ProductivityRecord).where(ProductivityRecord.company_id == company_id)
    if area:
        q = q.where(ProductivityRecord.area == area)
    if employee_id:
        q = q.where(ProductivityRecord.employee_id == uuid.UUID(employee_id))
    if fecha_desde:
        q = q.where(ProductivityRecord.fecha >= datetime.strptime(fecha_desde, "%Y-%m-%d").date())
    if fecha_hasta:
        q = q.where(ProductivityRecord.fecha <= datetime.strptime(fecha_hasta, "%Y-%m-%d").date())
    q = q.order_by(desc(ProductivityRecord.fecha)).limit(limit).offset(offset)
    r = await db.execute(q)
    return [ProductivityRecordResponse.model_validate(row).model_dump() for row in r.scalars().all()]


# ── Targets ──────────────────────────────────────────────────────

async def set_target(db: AsyncSession, company_id: str, data: ProductivityTargetCreate) -> dict:
    tgt = ProductivityTarget(
        company_id=uuid.UUID(company_id),
        branch_id=uuid.UUID(data.branch_id) if data.branch_id else None,
        area=data.area,
        metric_name=data.metric_name,
        target_value=data.target_value,
        budget_cost_per_unit=data.budget_cost_per_unit,
        effective_from=datetime.strptime(data.effective_from, "%Y-%m-%d").date(),
        effective_to=datetime.strptime(data.effective_to, "%Y-%m-%d").date() if data.effective_to else None,
    )
    db.add(tgt)
    await db.flush()
    return ProductivityTargetResponse.model_validate(tgt).model_dump()


async def list_targets(db: AsyncSession, company_id: str, area: Optional[str] = None) -> list[dict]:
    q = select(ProductivityTarget).where(ProductivityTarget.company_id == company_id)
    if area:
        q = q.where(ProductivityTarget.area == area)
    q = q.order_by(ProductivityTarget.effective_from.desc())
    r = await db.execute(q)
    return [ProductivityTargetResponse.model_validate(row).model_dump() for row in r.scalars().all()]


# ── Compute Employee Efficiency ──────────────────────────────────

async def compute_employee_efficiency(
    db: AsyncSession, company_id: str, employee_id: str,
    fecha_desde: str, fecha_hasta: str,
) -> dict:
    desde = datetime.strptime(fecha_desde, "%Y-%m-%d").date()
    hasta = datetime.strptime(fecha_hasta, "%Y-%m-%d").date()

    r = await db.execute(
        select(ProductivityRecord).where(
            ProductivityRecord.company_id == uuid.UUID(company_id),
            ProductivityRecord.employee_id == uuid.UUID(employee_id),
            ProductivityRecord.fecha.between(desde, hasta),
        )
    )
    records = r.scalars().all()
    if not records:
        return {"error": "No records found for this period"}

    area = records[0].area
    meta = AREA_METRICS.get(area, {})
    metric_field = meta.get("metric", "transactions_processed")

    total_metric = sum(getattr(rec, metric_field) or 0 for rec in records)
    total_hours = sum(rec.hours_worked or 0 for rec in records)
    total_planned = sum(rec.planned_hours or 0 for rec in records)
    total_sales = sum(rec.sales_amount or 0 for rec in records)

    metric_per_hour = round(total_metric / total_hours, 2) if total_hours > 0 else 0
    efficiency_pct = round((total_hours / total_planned) * 100, 1) if total_planned > 0 else 0

    # cost per unit: sales / total_metric
    cost_per_unit = round(total_sales / total_metric, 0) if total_metric > 0 else 0

    trend = await _compute_trend(db, company_id, employee_id, area, metric_field, hasta)

    # ranking within area
    ranking = await _compute_ranking(db, company_id, area, desde, hasta, metric_field, employee_id)

    eff = EmployeeEfficiency(
        company_id=uuid.UUID(company_id),
        employee_id=uuid.UUID(employee_id),
        employee_name=records[0].employee_name,
        area=area,
        fecha_desde=desde,
        fecha_hasta=hasta,
        total_hours=total_hours,
        planned_hours=total_planned,
        efficiency_pct=efficiency_pct,
        metric_name=meta.get("metric"),
        metric_value=total_metric,
        metric_per_hour=metric_per_hour,
        cost_per_unit=cost_per_unit,
        ranking_in_area=ranking,
        trend=trend,
    )
    db.add(eff)
    await db.flush()
    return EmployeeEfficiencyResponse.model_validate(eff).model_dump()


async def _compute_trend(
    db: AsyncSession, company_id: str, employee_id: str,
    area: str, metric_field: str, hasta: date,
) -> str:
    # compare current period vs previous period
    period_len = 14
    current_start = hasta - timedelta(days=period_len)
    prev_start = current_start - timedelta(days=period_len)

    r = await db.execute(
        select(sa_func.coalesce(sa_func.sum(getattr(ProductivityRecord, metric_field)), 0))
        .where(
            ProductivityRecord.company_id == uuid.UUID(company_id),
            ProductivityRecord.employee_id == uuid.UUID(employee_id),
            ProductivityRecord.fecha.between(prev_start, current_start),
        )
    )
    prev_val = r.scalar() or 0

    r2 = await db.execute(
        select(sa_func.coalesce(sa_func.sum(getattr(ProductivityRecord, metric_field)), 0))
        .where(
            ProductivityRecord.company_id == uuid.UUID(company_id),
            ProductivityRecord.employee_id == uuid.UUID(employee_id),
            ProductivityRecord.fecha.between(current_start, hasta),
        )
    )
    curr_val = r2.scalar() or 0

    if prev_val == 0:
        return "stable"
    change = (curr_val - prev_val) / prev_val
    if change > 0.1:
        return "up"
    elif change < -0.1:
        return "down"
    return "stable"


async def _compute_ranking(
    db: AsyncSession, company_id: str, area: str,
    desde: date, hasta: date, metric_field: str, exclude_employee_id: str,
) -> int:
    # aggregate per employee
    r = await db.execute(
        select(
            ProductivityRecord.employee_id,
            sa_func.sum(getattr(ProductivityRecord, metric_field)).label("total"),
        )
        .where(
            ProductivityRecord.company_id == uuid.UUID(company_id),
            ProductivityRecord.area == area,
            ProductivityRecord.fecha.between(desde, hasta),
        )
        .group_by(ProductivityRecord.employee_id)
        .order_by(desc("total"))
    )
    rows = r.all()
    for i, row in enumerate(rows):
        if str(row.employee_id) == exclude_employee_id:
            return i + 1
    return len(rows) + 1 if rows else 1


# ── Compute All ──────────────────────────────────────────────────

async def compute_all_efficiencies(db: AsyncSession, company_id: str, fecha_desde: str, fecha_hasta: str) -> list[dict]:
    desde = datetime.strptime(fecha_desde, "%Y-%m-%d").date()
    hasta = datetime.strptime(fecha_hasta, "%Y-%m-%d").date()

    r = await db.execute(
        select(ProductivityRecord.employee_id, ProductivityRecord.area, ProductivityRecord.employee_name)
        .where(
            ProductivityRecord.company_id == uuid.UUID(company_id),
            ProductivityRecord.fecha.between(desde, hasta),
        )
        .distinct()
    )
    employees = r.all()

    results = []
    for emp_id, area, emp_name in employees:
        result = await compute_employee_efficiency(db, company_id, str(emp_id), fecha_desde, fecha_hasta)
        if "error" not in result:
            results.append(result)
    return results


# ── Ranking ──────────────────────────────────────────────────────

async def get_ranking(
    db: AsyncSession, company_id: str, area: Optional[str] = None,
    limit: int = 20, order_by: str = "efficiency_pct",
) -> list[dict]:
    q = select(EmployeeEfficiency).where(
        EmployeeEfficiency.company_id == uuid.UUID(company_id),
    )
    if area:
        q = q.where(EmployeeEfficiency.area == area)

    if order_by == "efficiency_pct":
        q = q.order_by(desc(EmployeeEfficiency.efficiency_pct))
    elif order_by == "metric_per_hour":
        q = q.order_by(desc(EmployeeEfficiency.metric_per_hour))
    elif order_by == "cost_per_unit":
        q = q.order_by(asc(EmployeeEfficiency.cost_per_unit))
    else:
        q = q.order_by(desc(EmployeeEfficiency.efficiency_pct))

    q = q.limit(limit)
    r = await db.execute(q)
    return [EmployeeEfficiencyResponse.model_validate(row).model_dump() for row in r.scalars().all()]


# ── Area Metrics ─────────────────────────────────────────────────

async def get_area_metrics(db: AsyncSession, company_id: str, fecha_desde: str, fecha_hasta: str) -> list[dict]:
    desde = datetime.strptime(fecha_desde, "%Y-%m-%d").date()
    hasta = datetime.strptime(fecha_hasta, "%Y-%m-%d").date()

    results = []
    for area_key, meta in AREA_METRICS.items():
        metric_field = meta["metric"]

        r = await db.execute(
            select(
                sa_func.count(sa_func.distinct(ProductivityRecord.employee_id)),
                sa_func.coalesce(sa_func.sum(ProductivityRecord.hours_worked), 0),
                sa_func.coalesce(sa_func.sum(ProductivityRecord.planned_hours), 0),
                sa_func.coalesce(sa_func.sum(getattr(ProductivityRecord, metric_field)), 0),
                sa_func.coalesce(sa_func.sum(ProductivityRecord.sales_amount), 0),
            )
            .where(
                ProductivityRecord.company_id == uuid.UUID(company_id),
                ProductivityRecord.area == area_key,
                ProductivityRecord.fecha.between(desde, hasta),
            )
        )
        row = r.one()
        emp_count = row[0]
        total_hours = row[1]
        total_planned = row[2]
        total_metric = row[3]
        total_sales = row[4]

        if emp_count == 0:
            results.append(AreaMetricsResponse(
                area=area_key, employees_count=0, total_hours=0, planned_hours=0,
                avg_efficiency_pct=0, avg_metric_per_hour=0, avg_cost_per_unit=0,
                top_performer=None, bottom_performer=None,
            ))
            continue

        avg_metric_per_hour = round(total_metric / total_hours, 2) if total_hours > 0 else 0
        avg_efficiency = round((total_hours / total_planned) * 100, 1) if total_planned > 0 else 0
        avg_cost_per_unit = round(total_sales / total_metric, 0) if total_metric > 0 else 0

        # top/bottom
        r2 = await db.execute(
            select(
                ProductivityRecord.employee_name,
                sa_func.sum(getattr(ProductivityRecord, metric_field)).label("total"),
            )
            .where(
                ProductivityRecord.company_id == uuid.UUID(company_id),
                ProductivityRecord.area == area_key,
                ProductivityRecord.fecha.between(desde, hasta),
            )
            .group_by(ProductivityRecord.employee_name)
            .order_by(desc("total"))
            .limit(1)
        )
        top = r2.first()
        r3 = await db.execute(
            select(
                ProductivityRecord.employee_name,
                sa_func.sum(getattr(ProductivityRecord, metric_field)).label("total"),
            )
            .where(
                ProductivityRecord.company_id == uuid.UUID(company_id),
                ProductivityRecord.area == area_key,
                ProductivityRecord.fecha.between(desde, hasta),
            )
            .group_by(ProductivityRecord.employee_name)
            .order_by(asc("total"))
            .limit(1)
        )
        bottom = r3.first()

        results.append(AreaMetricsResponse(
            area=area_key,
            employees_count=emp_count,
            total_hours=total_hours,
            planned_hours=total_planned,
            avg_efficiency_pct=avg_efficiency,
            avg_metric_per_hour=avg_metric_per_hour,
            avg_cost_per_unit=avg_cost_per_unit,
            top_performer=top[0] if top else None,
            bottom_performer=bottom[0] if bottom else None,
        ).model_dump())

    return results


# ── Weekly Trends ────────────────────────────────────────────────

async def get_weekly_trends(db: AsyncSession, company_id: str, weeks: int = 8) -> list[dict]:
    today = date.today()
    trends = []
    for w in range(weeks):
        week_end = today - timedelta(days=today.weekday() + 7 * w)
        week_start = week_end - timedelta(days=6)
        week_label = week_start.strftime("%Y-%m-%d")

        total_metric = 0
        total_hours = 0
        for meta in AREA_METRICS.values():
            metric_field = meta["metric"]
            r = await db.execute(
                select(
                    sa_func.coalesce(sa_func.sum(getattr(ProductivityRecord, metric_field)), 0),
                    sa_func.coalesce(sa_func.sum(ProductivityRecord.hours_worked), 0),
                )
                .where(
                    ProductivityRecord.company_id == uuid.UUID(company_id),
                    ProductivityRecord.fecha.between(week_start, week_end),
                )
            )
            row = r.one()
            total_metric += row[0]
            total_hours += row[1]

        avg = round(total_metric / total_hours, 2) if total_hours > 0 else 0
        trends.append({"week": week_label, "avg_productivity": avg})

    trends.reverse()
    return trends


# ── Dashboard ────────────────────────────────────────────────────

async def get_dashboard(
    db: AsyncSession, company_id: str, fecha_desde: str, fecha_hasta: str,
) -> dict:
    area_metrics = await get_area_metrics(db, company_id, fecha_desde, fecha_hasta)
    ranking = await get_ranking(db, company_id, limit=50)
    weekly_trends = await get_weekly_trends(db, company_id)

    total_employees = sum(m["employees_count"] for m in area_metrics)
    total_hours = sum(m["total_hours"] for m in area_metrics)
    total_planned = sum(m["planned_hours"] for m in area_metrics)
    total_cost = sum(m["avg_cost_per_unit"] for m in area_metrics)

    overall_avg_efficiency = round((total_hours / total_planned) * 100, 1) if total_planned > 0 else 0
    overall_avg_cost = round(total_cost / max(1, len(area_metrics)), 0) if area_metrics else 0

    return ProductivityDashboardResponse(
        area_metrics=area_metrics,
        ranking=ranking,
        weekly_trends=weekly_trends,
        total_employees_evaluated=total_employees,
        overall_avg_efficiency=overall_avg_efficiency,
        overall_avg_cost_per_unit=overall_avg_cost,
    ).model_dump()
