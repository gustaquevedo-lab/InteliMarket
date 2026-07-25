from sqlalchemy import select, func as sa_func, and_, desc, asc, delete
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime, date, timedelta, timezone
from typing import Optional
import uuid, random, math

from api.src.pygdiario.models import DailyDepartmentPnl, PnlAdjustment, PnlBudget
from api.src.pygdiario.schemas import (
    DailyPnlCreate, DailyPnlResponse,
    PnlAdjustmentCreate, PnlAdjustmentResponse,
    PnlBudgetCreate, PnlBudgetResponse,
    DailyPnlDashboard, DepartmentComparison, NegativeMarginProduct,
)

DEPARTMENTS = ["carniceria", "panaderia", "verduleria", "almacen", "limpieza", "bebidas"]

DEPARTMENT_LABELS = {
    "carniceria": "Carnicería", "panaderia": "Panadería",
    "verduleria": "Verdulería", "almacen": "Almacén",
    "limpieza": "Limpieza", "bebidas": "Bebidas",
}

# synthetic generation parameters
SYNTHETIC_CONFIG = {
    "carniceria": {"avg_daily_sales": 4500000, "cost_pct": 0.65, "margin_pct": 0.35, "shrinkage_pct": 0.04, "labor_pct": 0.08},
    "panaderia": {"avg_daily_sales": 2800000, "cost_pct": 0.55, "margin_pct": 0.45, "shrinkage_pct": 0.05, "labor_pct": 0.10},
    "verduleria": {"avg_daily_sales": 3200000, "cost_pct": 0.60, "margin_pct": 0.40, "shrinkage_pct": 0.07, "labor_pct": 0.06},
    "almacen": {"avg_daily_sales": 8000000, "cost_pct": 0.70, "margin_pct": 0.30, "shrinkage_pct": 0.02, "labor_pct": 0.05},
    "limpieza": {"avg_daily_sales": 1500000, "cost_pct": 0.62, "margin_pct": 0.38, "shrinkage_pct": 0.03, "labor_pct": 0.04},
    "bebidas": {"avg_daily_sales": 5500000, "cost_pct": 0.68, "margin_pct": 0.32, "shrinkage_pct": 0.02, "labor_pct": 0.04},
}

# Department-specific products for negative margin tracking
DEPARTMENT_PRODUCTS = {
    "carniceria": [
        {"name": "Carne Vacío kg", "base_cost": 58000, "sale_price": 75000},
        {"name": "Carne Picada kg", "base_cost": 32000, "sale_price": 42000},
        {"name": "Pechuga Pollo kg", "base_cost": 25000, "sale_price": 35000},
        {"name": "Costilla Cerdo kg", "base_cost": 38000, "sale_price": 48000},
        {"name": "Milanesa kg", "base_cost": 45000, "sale_price": 58000},
    ],
    "panaderia": [
        {"name": "Pan Frances un.", "base_cost": 300, "sale_price": 500},
        {"name": "Pan Hamburguesa un.", "base_cost": 800, "sale_price": 1200},
        {"name": "Medialuna un.", "base_cost": 600, "sale_price": 1000},
        {"name": "Pan de Queso kg", "base_cost": 15000, "sale_price": 22000},
        {"name": "Bizcocho kg", "base_cost": 12000, "sale_price": 18000},
    ],
    "verduleria": [
        {"name": "Tomate kg", "base_cost": 8000, "sale_price": 12000},
        {"name": "Cebolla kg", "base_cost": 5000, "sale_price": 8000},
        {"name": "Papa kg", "base_cost": 4000, "sale_price": 6000},
        {"name": "Lechuga un.", "base_cost": 3000, "sale_price": 5000},
        {"name": "Zanahoria kg", "base_cost": 3500, "sale_price": 5500},
    ],
    "almacen": [
        {"name": "Arroz 1kg", "base_cost": 5000, "sale_price": 7500},
        {"name": "Fideo 500g", "base_cost": 3000, "sale_price": 4500},
        {"name": "Aceite 1L", "base_cost": 10000, "sale_price": 15000},
        {"name": "Azúcar 1kg", "base_cost": 4000, "sale_price": 6000},
        {"name": "Harina 1kg", "base_cost": 3500, "sale_price": 5500},
    ],
    "limpieza": [
        {"name": "Detergente 500ml", "base_cost": 5000, "sale_price": 8500},
        {"name": "Jabón Barra", "base_cost": 2000, "sale_price": 3500},
        {"name": "Lavandina 1L", "base_cost": 4000, "sale_price": 6500},
        {"name": "Esponja", "base_cost": 1500, "sale_price": 3000},
        {"name": "Bolsa Basura paq.", "base_cost": 8000, "sale_price": 12000},
    ],
    "bebidas": [
        {"name": "Coca-Cola 2L", "base_cost": 6000, "sale_price": 10000},
        {"name": "Agua 500ml", "base_cost": 1500, "sale_price": 3000},
        {"name": "Cerveza 6pk", "base_cost": 25000, "sale_price": 36000},
        {"name": "Jugo Natural 1L", "base_cost": 7000, "sale_price": 11000},
        {"name": "Gaseosa 500ml", "base_cost": 3000, "sale_price": 5000},
    ],
}


# ── Synthetic Demo Data ──────────────────────────────────────────

def _generate_demo_pnl(fecha: date, dept: str) -> dict:
    cfg = SYNTHETIC_CONFIG[dept]
    day_factor = {0: 1.0, 1: 0.85, 2: 0.90, 3: 0.90, 4: 0.95, 5: 1.20, 6: 1.30}.get(fecha.weekday(), 1.0)
    noise = random.uniform(0.85, 1.15)

    sales = round(cfg["avg_daily_sales"] * day_factor * noise, -2)
    transactions = max(1, int(sales / random.randint(15000, 45000)))
    theoretical_cost = round(sales * cfg["cost_pct"], 0)
    actual_cost = round(theoretical_cost * random.uniform(1.02, 1.08), 0)
    cost_of_sales = round(actual_cost * random.uniform(0.95, 1.0), 0)

    gross_margin_real = sales - cost_of_sales
    gross_margin_real_pct = round((gross_margin_real / sales) * 100, 1) if sales else 0
    gross_margin_theoretical = sales - theoretical_cost
    gross_margin_theoretical_pct = round((gross_margin_theoretical / sales) * 100, 1) if sales else 0
    margin_variance = gross_margin_theoretical - gross_margin_real
    margin_variance_pct = round((margin_variance / gross_margin_theoretical) * 100, 1) if gross_margin_theoretical else 0

    shrinkage = round(sales * cfg["shrinkage_pct"] * random.uniform(0.7, 1.3), 0)
    labor = round(sales * cfg["labor_pct"] * random.uniform(0.9, 1.1), 0)
    equipment = round(sales * 0.01 * random.uniform(0.8, 1.2), 0)
    other = round(sales * 0.005 * random.uniform(0.5, 1.5), 0)
    total_costs = shrinkage + labor + equipment + other

    net_margin = gross_margin_real - total_costs
    net_margin_pct = round((net_margin / sales) * 100, 1) if sales else 0

    # product-level analysis
    products = DEPARTMENT_PRODUCTS.get(dept, [])
    neg_products = []
    top_products = []
    for p in products:
        qty = max(1, int(sales / len(products) / p["sale_price"] * random.uniform(0.5, 1.5)))
        product_sales = qty * p["sale_price"]
        product_cost = qty * p["base_cost"] * random.uniform(0.95, 1.10)
        margin = product_sales - product_cost
        margin_pct = round((margin / product_sales) * 100, 1) if product_sales else 0
        if margin < 0:
            neg_products.append({"name": p["name"], "margin": round(margin), "margin_pct": margin_pct, "sales": round(product_sales)})
        top_products.append({"name": p["name"], "margin": round(margin), "margin_pct": margin_pct, "sales": round(product_sales)})
    top_products.sort(key=lambda x: x["margin"], reverse=True)

    return {
        "sales_amount": sales,
        "transaction_count": transactions,
        "theoretical_cost": round(theoretical_cost, 0),
        "actual_cost": round(actual_cost, 0),
        "cost_of_sales": round(cost_of_sales, 0),
        "gross_margin_real": round(gross_margin_real, 0),
        "gross_margin_real_pct": gross_margin_real_pct,
        "gross_margin_theoretical": round(gross_margin_theoretical, 0),
        "gross_margin_theoretical_pct": gross_margin_theoretical_pct,
        "margin_variance": round(margin_variance, 0),
        "margin_variance_pct": margin_variance_pct,
        "shrinkage_cost": round(shrinkage, 0),
        "labor_cost": round(labor, 0),
        "equipment_depreciation": round(equipment, 0),
        "other_costs": round(other, 0),
        "total_assignable_costs": round(total_costs, 0),
        "net_margin": round(net_margin, 0),
        "net_margin_pct": net_margin_pct,
        "products_negative_margin": neg_products[:3],
        "top_products": top_products[:5],
    }


# ── Compute Daily PnL ────────────────────────────────────────────

async def compute_daily_pnl(
    db: AsyncSession, company_id: str, fecha: str, departments: Optional[list[str]] = None,
) -> list[dict]:
    target_date = datetime.strptime(fecha, "%Y-%m-%d").date()
    depts = departments or list(DEPARTMENTS)

    results = []
    for dept in depts:
        # check if already computed
        r = await db.execute(
            select(DailyDepartmentPnl).where(
                DailyDepartmentPnl.company_id == uuid.UUID(company_id),
                DailyDepartmentPnl.department == dept,
                DailyDepartmentPnl.fecha == target_date,
            )
        )
        existing = r.scalar_one_or_none()
        if existing:
            results.append(DailyPnlResponse.model_validate(existing).model_dump())
            continue

        demo = _generate_demo_pnl(target_date, dept)
        pnl = DailyDepartmentPnl(
            company_id=uuid.UUID(company_id),
            department=dept,
            fecha=target_date,
            **demo,
        )
        db.add(pnl)
        await db.flush()
        results.append(DailyPnlResponse.model_validate(pnl).model_dump())

    return results


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

    # ensure all depts computed for today
    await compute_daily_pnl(db, company_id, fecha)

    today_results = await list_pnl(db, company_id, fecha, fecha)
    yesterday_results = await list_pnl(db, company_id, yesterday.isoformat(), yesterday.isoformat()) if await db.execute(
        select(DailyDepartmentPnl).where(
            DailyDepartmentPnl.company_id == uuid.UUID(company_id),
            DailyDepartmentPnl.fecha == yesterday,
        ).limit(1)
    ) else []

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
    for dept in DEPARTMENTS:
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

    # negative margin products
    neg_products = []
    for r in today_results:
        for p in (r.get("products_negative_margin") or []):
            neg_products.append(NegativeMarginProduct(**p).model_dump())

    # 7-day trends
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
