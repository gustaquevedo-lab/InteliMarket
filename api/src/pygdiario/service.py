from sqlalchemy import select, func as sa_func, and_, desc, asc, delete, text
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime, date, timedelta, timezone
from typing import Optional
import uuid

from api.src.pygdiario.models import DailyDepartmentPnl, PnlAdjustment, PnlBudget
from api.src.pygdiario.schemas import (
    DailyPnlCreate, DailyPnlResponse,
    PnlAdjustmentCreate, PnlAdjustmentResponse,
    PnlBudgetCreate, PnlBudgetResponse,
    DailyPnlDashboard, DepartmentComparison, NegativeMarginProduct,
)

# El legacy migrado no trae categorización real de productos (0 categorías,
# 11k productos sin categoria_id) — no existe un desglose real por
# departamento todavía. Hasta que haya categorización real, todo se calcula
# como un único bucket "general" a nivel compañía, con datos 100% reales.
GENERAL_DEPARTMENT = "general"


# ── Compute Daily PnL (datos reales, sin fabricación) ────────────

async def compute_daily_pnl(
    db: AsyncSession, company_id: str, fecha: str, departments: Optional[list[str]] = None,
) -> list[dict]:
    target_date = datetime.strptime(fecha, "%Y-%m-%d").date()

    # ya calculado para ese día → no recalcular (evita duplicar si se llama de nuevo)
    r = await db.execute(
        select(DailyDepartmentPnl).where(
            DailyDepartmentPnl.company_id == uuid.UUID(company_id),
            DailyDepartmentPnl.department == GENERAL_DEPARTMENT,
            DailyDepartmentPnl.fecha == target_date,
        )
    )
    existing = r.scalar_one_or_none()
    if existing:
        return [DailyPnlResponse.model_validate(existing).model_dump()]

    sales_row = (await db.execute(
        text("""
            SELECT COALESCE(SUM(total), 0) AS sales_amount, COUNT(*) AS transaction_count
            FROM sales
            WHERE company_id = :cid AND estado = 'confirmado' AND fecha::date = :fecha
        """),
        {"cid": company_id, "fecha": target_date},
    )).first()
    sales_amount = float(sales_row.sales_amount)
    transaction_count = int(sales_row.transaction_count)

    cost_row = (await db.execute(
        text("""
            SELECT COALESCE(SUM(si.costo_unitario * si.cantidad), 0) AS cost_of_sales
            FROM sale_items si
            JOIN sales s ON s.id = si.sale_id
            WHERE s.company_id = :cid AND s.estado = 'confirmado' AND s.fecha::date = :fecha
        """),
        {"cid": company_id, "fecha": target_date},
    )).first()
    cost_of_sales = float(cost_row.cost_of_sales)

    gross_margin_real = sales_amount - cost_of_sales
    gross_margin_real_pct = round((gross_margin_real / sales_amount) * 100, 1) if sales_amount else 0

    # No tenemos todavía costo teórico (costo estándar) separado del costo real,
    # ni shrinkage/labor/equipment reales asignados a ventas — se dejan en 0
    # de forma explícita en vez de inventarlos. shrinkage_cost se puede
    # conectar al módulo Shrinkage (una vez que también deje de fabricar datos).
    theoretical_cost = cost_of_sales
    gross_margin_theoretical = gross_margin_real
    gross_margin_theoretical_pct = gross_margin_real_pct
    margin_variance = 0.0
    margin_variance_pct = 0.0
    shrinkage_cost = 0.0
    labor_cost = 0.0
    equipment_depreciation = 0.0
    other_costs = 0.0
    total_costs = 0.0
    net_margin = gross_margin_real - total_costs
    net_margin_pct = round((net_margin / sales_amount) * 100, 1) if sales_amount else 0

    product_rows = (await db.execute(
        text("""
            SELECT p.nombre AS name,
                   COALESCE(SUM(si.total), 0) AS sales,
                   COALESCE(SUM(si.total - (COALESCE(si.costo_unitario, 0) * si.cantidad)), 0) AS margin
            FROM sale_items si
            JOIN sales s ON s.id = si.sale_id
            JOIN products p ON p.id = si.product_id
            WHERE s.company_id = :cid AND s.estado = 'confirmado' AND s.fecha::date = :fecha
            GROUP BY p.id, p.nombre
        """),
        {"cid": company_id, "fecha": target_date},
    )).all()

    top_products = []
    neg_products = []
    for row in product_rows:
        row_sales = float(row.sales)
        margin = float(row.margin)
        margin_pct = round((margin / row_sales) * 100, 1) if row_sales else 0
        item = {"name": row.name, "margin": round(margin), "margin_pct": margin_pct, "sales": round(row_sales)}
        top_products.append(item)
        if margin < 0:
            neg_products.append(item)
    top_products.sort(key=lambda x: x["margin"], reverse=True)
    neg_products.sort(key=lambda x: x["margin"])

    pnl = DailyDepartmentPnl(
        company_id=uuid.UUID(company_id),
        department=GENERAL_DEPARTMENT,
        fecha=target_date,
        sales_amount=sales_amount,
        transaction_count=transaction_count,
        theoretical_cost=round(theoretical_cost, 0),
        actual_cost=round(cost_of_sales, 0),
        cost_of_sales=round(cost_of_sales, 0),
        gross_margin_real=round(gross_margin_real, 0),
        gross_margin_real_pct=gross_margin_real_pct,
        gross_margin_theoretical=round(gross_margin_theoretical, 0),
        gross_margin_theoretical_pct=gross_margin_theoretical_pct,
        margin_variance=round(margin_variance, 0),
        margin_variance_pct=margin_variance_pct,
        shrinkage_cost=shrinkage_cost,
        labor_cost=labor_cost,
        equipment_depreciation=equipment_depreciation,
        other_costs=other_costs,
        total_assignable_costs=round(total_costs, 0),
        net_margin=round(net_margin, 0),
        net_margin_pct=net_margin_pct,
        products_negative_margin=neg_products[:5],
        top_products=top_products[:5],
    )
    db.add(pnl)
    await db.flush()
    return [DailyPnlResponse.model_validate(pnl).model_dump()]


# ── CRUD PnL ─────────────────────────────────────────────────────

async def list_pnl(
    db: AsyncSession, company_id: str, fecha_desde: str, fecha_hasta: str,
    department: Optional[str] = None, limit: int = 100,
) -> list[dict]:
    q = select(DailyDepartmentPnl).where(
        DailyDepartmentPnl.company_id == uuid.UUID(company_id),
        DailyDepartmentPnl.fecha.between(
            datetime.strptime(fecha_desde, "%Y-%m-%d").date(),
            datetime.strptime(fecha_hasta, "%Y-%m-%d").date(),
        ),
    )
    if department:
        q = q.where(DailyDepartmentPnl.department == department)
    q = q.order_by(DailyDepartmentPnl.fecha.desc(), DailyDepartmentPnl.department).limit(limit)
    r = await db.execute(q)
    return [DailyPnlResponse.model_validate(row).model_dump() for row in r.scalars().all()]


async def create_pnl_entry(db: AsyncSession, company_id: str, data: DailyPnlCreate) -> dict:
    act = data.actual_cost or data.cost_of_sales
    theo = data.theoretical_cost
    sales = data.sales_amount

    gross_margin_real = sales - act
    gross_margin_theoretical = sales - theo
    margin_variance = gross_margin_theoretical - gross_margin_real

    total_costs = sum([data.shrinkage_cost, data.labor_cost, data.equipment_depreciation, data.other_costs])
    net_margin = gross_margin_real - total_costs

    pnl = DailyDepartmentPnl(
        company_id=uuid.UUID(company_id),
        branch_id=uuid.UUID(data.branch_id) if data.branch_id else None,
        department=data.department,
        fecha=datetime.strptime(data.fecha, "%Y-%m-%d").date(),
        sales_amount=data.sales_amount,
        transaction_count=data.transaction_count,
        theoretical_cost=data.theoretical_cost,
        actual_cost=data.actual_cost,
        cost_of_sales=data.actual_cost,
        gross_margin_real=round(gross_margin_real, 0),
        gross_margin_real_pct=round((gross_margin_real / sales) * 100, 1) if sales else 0,
        gross_margin_theoretical=round(gross_margin_theoretical, 0),
        gross_margin_theoretical_pct=round((gross_margin_theoretical / sales) * 100, 1) if sales else 0,
        margin_variance=round(margin_variance, 0),
        margin_variance_pct=round((margin_variance / gross_margin_theoretical) * 100, 1) if gross_margin_theoretical else 0,
        shrinkage_cost=data.shrinkage_cost,
        labor_cost=data.labor_cost,
        equipment_depreciation=data.equipment_depreciation,
        other_costs=data.other_costs,
        total_assignable_costs=round(total_costs, 0),
        net_margin=round(net_margin, 0),
        net_margin_pct=round((net_margin / sales) * 100, 1) if sales else 0,
    )
    db.add(pnl)
    await db.flush()
    return DailyPnlResponse.model_validate(pnl).model_dump()


# ── Adjustments ──────────────────────────────────────────────────

async def add_adjustment(db: AsyncSession, company_id: str, data: PnlAdjustmentCreate) -> dict:
    # verify pnl exists
    r = await db.execute(
        select(DailyDepartmentPnl).where(
            DailyDepartmentPnl.id == uuid.UUID(data.pnl_id),
            DailyDepartmentPnl.company_id == uuid.UUID(company_id),
        )
    )
    pnl = r.scalar_one_or_none()
    if not pnl:
        raise ValueError("PnL entry not found")

    adj = PnlAdjustment(
        company_id=uuid.UUID(company_id),
        pnl_id=uuid.UUID(data.pnl_id),
        description=data.description,
        adjustment_type=data.adjustment_type,
        amount=data.amount,
        reason=data.reason,
    )
    db.add(adj)
    await db.flush()

    # update pnl totals
    if data.adjustment_type == "shrinkage":
        pnl.shrinkage_cost += data.amount
    elif data.adjustment_type == "labor":
        pnl.labor_cost += data.amount
    else:
        pnl.other_costs += data.amount

    pnl.total_assignable_costs = pnl.shrinkage_cost + pnl.labor_cost + pnl.equipment_depreciation + pnl.other_costs
    pnl.net_margin = pnl.gross_margin_real - pnl.total_assignable_costs
    pnl.net_margin_pct = round((pnl.net_margin / pnl.sales_amount) * 100, 1) if pnl.sales_amount else 0
    await db.flush()

    return PnlAdjustmentResponse.model_validate(adj).model_dump()


async def list_adjustments(db: AsyncSession, company_id: str, pnl_id: Optional[str] = None) -> list[dict]:
    q = select(PnlAdjustment).where(PnlAdjustment.company_id == uuid.UUID(company_id))
    if pnl_id:
        q = q.where(PnlAdjustment.pnl_id == uuid.UUID(pnl_id))
    q = q.order_by(desc(PnlAdjustment.created_at))
    r = await db.execute(q)
    return [PnlAdjustmentResponse.model_validate(row).model_dump() for row in r.scalars().all()]


# ── Budgets ──────────────────────────────────────────────────────

async def set_budget(db: AsyncSession, company_id: str, data: PnlBudgetCreate) -> dict:
    budget = PnlBudget(
        company_id=uuid.UUID(company_id),
        branch_id=uuid.UUID(data.branch_id) if data.branch_id else None,
        department=data.department,
        period_start=datetime.strptime(data.period_start, "%Y-%m-%d").date(),
        period_end=datetime.strptime(data.period_end, "%Y-%m-%d").date() if data.period_end else None,
        budgeted_sales=data.budgeted_sales,
        budgeted_cost=data.budgeted_cost,
        budgeted_margin_pct=data.budgeted_margin_pct,
        budgeted_shrinkage=data.budgeted_shrinkage,
        budgeted_labor=data.budgeted_labor,
    )
    db.add(budget)
    await db.flush()
    return PnlBudgetResponse.model_validate(budget).model_dump()


async def list_budgets(db: AsyncSession, company_id: str, department: Optional[str] = None) -> list[dict]:
    q = select(PnlBudget).where(PnlBudget.company_id == uuid.UUID(company_id))
    if department:
        q = q.where(PnlBudget.department == department)
    q = q.order_by(desc(PnlBudget.period_start))
    r = await db.execute(q)
    return [PnlBudgetResponse.model_validate(row).model_dump() for row in r.scalars().all()]


# ── Dashboard ────────────────────────────────────────────────────

async def get_dashboard(db: AsyncSession, company_id: str, fecha: str) -> dict:
    target_date = datetime.strptime(fecha, "%Y-%m-%d").date()
    yesterday = target_date - timedelta(days=1)

    # asegura que "hoy" esté calculado con datos reales (idempotente)
    await compute_daily_pnl(db, company_id, fecha)
    # calcula "ayer" también si todavía no existe, para poder comparar
    await compute_daily_pnl(db, company_id, yesterday.isoformat())

    today_results = await list_pnl(db, company_id, fecha, fecha)
    yesterday_results = await list_pnl(db, company_id, yesterday.isoformat(), yesterday.isoformat())

    today_by_dept = {r["department"]: r for r in today_results}
    yesterday_by_dept = {r["department"]: r for r in yesterday_results}

    # budgets
    r = await db.execute(
        select(PnlBudget).where(
            PnlBudget.company_id == uuid.UUID(company_id),
            PnlBudget.period_start <= target_date,
            (PnlBudget.period_end >= target_date) | (PnlBudget.period_end == None),
        )
    )
    budgets = {b.department: b for b in r.scalars().all()}

    comparisons = []
    for dept in today_by_dept.keys() | yesterday_by_dept.keys() | {GENERAL_DEPARTMENT}:
        today = today_by_dept.get(dept, {})
        yesterday_entry = yesterday_by_dept.get(dept, {})
        budget = budgets.get(dept)

        comparisons.append(DepartmentComparison(
            department=dept,
            today_sales=today.get("sales_amount", 0),
            today_margin_pct=today.get("gross_margin_real_pct", 0),
            yesterday_sales=yesterday_entry.get("sales_amount", 0),
            yesterday_margin_pct=yesterday_entry.get("gross_margin_real_pct", 0),
            budgeted_margin_pct=budget.budgeted_margin_pct if budget else 0,
            variance_vs_yesterday=round(today.get("gross_margin_real_pct", 0) - yesterday_entry.get("gross_margin_real_pct", 0), 1),
            variance_vs_budget=round(today.get("gross_margin_real_pct", 0) - (budget.budgeted_margin_pct if budget else 0), 1),
        ).model_dump())

    # negative margin products (reales)
    neg_products = []
    for r in today_results:
        for p in (r.get("products_negative_margin") or []):
            neg_products.append(NegativeMarginProduct(**p).model_dump())

    # 7-day trends (reales; días sin ventas quedan en 0, no se fabrican)
    trends = []
    for i in range(7):
        d = target_date - timedelta(days=6 - i)
        day_results = await list_pnl(db, company_id, d.isoformat(), d.isoformat())
        total_sales = sum(r["sales_amount"] for r in day_results) if day_results else 0
        total_margin = sum(r["gross_margin_real"] for r in day_results) if day_results else 0
        total_margin_pct = round((total_margin / total_sales) * 100, 1) if total_sales else 0
        trends.append({"date": d.isoformat(), "total_sales": total_sales, "total_margin": total_margin, "total_margin_pct": total_margin_pct})

    total_sales = sum(r["sales_amount"] for r in today_results) if today_results else 0
    total_cost = sum(r["cost_of_sales"] for r in today_results) if today_results else 0
    total_margin = sum(r["gross_margin_real"] for r in today_results) if today_results else 0
    total_margin_pct = round((total_margin / total_sales) * 100, 1) if total_sales else 0
    total_shrinkage = sum(r["shrinkage_cost"] for r in today_results) if today_results else 0
    total_labor = sum(r["labor_cost"] for r in today_results) if today_results else 0

    return DailyPnlDashboard(
        date=fecha,
        total_sales=total_sales,
        total_cost=total_cost,
        total_margin=total_margin,
        total_margin_pct=total_margin_pct,
        total_shrinkage=total_shrinkage,
        total_labor=total_labor,
        department_comparisons=comparisons,
        negative_margin_products=neg_products,
        trends_7d=trends,
    ).model_dump()
