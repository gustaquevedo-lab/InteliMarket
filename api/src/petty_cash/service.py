from decimal import Decimal
from datetime import date, datetime, timedelta
import uuid

from sqlalchemy import select, text, func as sa_func
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.petty_cash.models import Expense, ExpenseCategory
from api.src.petty_cash.schemas import (
    ExpenseCreate, ExpenseUpdate, ExpenseSummary,
)


async def create_category(db: AsyncSession, company_id: str, data) -> ExpenseCategory:
    cat = ExpenseCategory(company_id=uuid.UUID(company_id), **data.model_dump(exclude_unset=True))
    db.add(cat)
    await db.flush()
    await db.refresh(cat)
    return cat


async def list_categories(db: AsyncSession, company_id: str) -> list[ExpenseCategory]:
    result = await db.execute(
        select(ExpenseCategory).where(
            ExpenseCategory.company_id == uuid.UUID(company_id),
            ExpenseCategory.activo == True,
        ).order_by(ExpenseCategory.nombre)
    )
    return list(result.scalars().all())


async def create_expense(db: AsyncSession, company_id: str, data: ExpenseCreate, user_id: str) -> Expense:
    exp = Expense(
        company_id=uuid.UUID(company_id),
        branch_id=uuid.UUID(data.branch_id) if data.branch_id else None,
        category_id=uuid.UUID(data.category_id) if data.category_id else None,
        monto=data.monto,
        descripcion=data.descripcion,
        proveedor=data.proveedor,
        comprobante_url=data.comprobante_url,
        tipo_pago=data.tipo_pago,
        fecha_gasto=data.fecha_gasto or date.today(),
        registrado_por=uuid.UUID(user_id),
        estado="pendiente",
    )
    db.add(exp)
    await db.flush()
    await db.refresh(exp)
    return exp


async def get_expense(db: AsyncSession, expense_id: str) -> Expense | None:
    result = await db.execute(select(Expense).where(Expense.id == uuid.UUID(expense_id)))
    return result.scalar_one_or_none()


async def list_expenses(
    db: AsyncSession, company_id: str, branch_id: str | None = None,
    category_id: str | None = None, estado: str | None = None,
    desde: date | None = None, hasta: date | None = None,
    limit: int = 100, offset: int = 0,
) -> list[dict]:
    cid = uuid.UUID(company_id)
    where_clauses = ["e.company_id = :cid"]
    params: dict = {"cid": cid, "limit": limit, "offset": offset}

    if branch_id:
        where_clauses.append("e.branch_id = :branch_id")
        params["branch_id"] = uuid.UUID(branch_id)
    if category_id:
        where_clauses.append("e.category_id = :category_id")
        params["category_id"] = uuid.UUID(category_id)
    if estado:
        where_clauses.append("e.estado = :estado")
        params["estado"] = estado
    if desde:
        where_clauses.append("e.fecha_gasto >= :desde")
        params["desde"] = desde
    if hasta:
        where_clauses.append("e.fecha_gasto <= :hasta")
        params["hasta"] = hasta

    where_stmt = " AND ".join(where_clauses)

    query = text(f"""
        SELECT 
            e.id, e.company_id, e.branch_id, e.category_id, c.nombre as category_name,
            e.monto, e.descripcion, e.proveedor, e.comprobante_url, e.tipo_pago,
            e.fecha_gasto, e.registrado_por, e.aprobado_por, e.estado, e.notas, e.created_at
        FROM expenses e
        LEFT JOIN expense_categories c ON c.id = e.category_id
        WHERE {where_stmt}
        ORDER BY e.fecha_gasto DESC, e.created_at DESC
        LIMIT :limit OFFSET :offset
    """)

    res = await db.execute(query, params)
    rows = res.fetchall()
    return [dict(r._mapping) for r in rows]


async def update_expense(db: AsyncSession, expense_id: str, data: ExpenseUpdate) -> Expense | None:
    exp = await get_expense(db, expense_id)
    if not exp:
        return None
    for field, value in data.model_dump(exclude_unset=True).items():
        if value is not None:
            setattr(exp, field, value)
    await db.flush()
    await db.refresh(exp)
    return exp


async def delete_expense(db: AsyncSession, expense_id: str) -> bool:
    exp = await get_expense(db, expense_id)
    if not exp:
        return False
    await db.delete(exp)
    await db.flush()
    return True


async def get_summary(db: AsyncSession, company_id: str) -> ExpenseSummary:
    cid = uuid.UUID(company_id)
    today = date.today()
    week_start = today - timedelta(days=7)
    month_start = today.replace(day=1)

    # Daily total
    r1 = await db.execute(
        select(sa_func.coalesce(sa_func.sum(Expense.monto), 0))
        .where(Expense.company_id == cid, Expense.fecha_gasto == today)
    )
    total_dia = float(r1.scalar())

    # Weekly total (last 7 days)
    r2 = await db.execute(
        select(sa_func.coalesce(sa_func.sum(Expense.monto), 0))
        .where(Expense.company_id == cid, Expense.fecha_gasto >= week_start)
    )
    total_semana = float(r2.scalar())

    # Monthly total
    r3 = await db.execute(
        select(sa_func.coalesce(sa_func.sum(Expense.monto), 0))
        .where(Expense.company_id == cid, Expense.fecha_gasto >= month_start)
    )
    total_mes = float(r3.scalar())

    # By category (with category name join)
    query_cat = text("""
        SELECT 
            COALESCE(c.nombre, 'Sin Categoría') as category_name,
            SUM(e.monto) as total
        FROM expenses e
        LEFT JOIN expense_categories c ON c.id = e.category_id
        WHERE e.company_id = :cid AND e.fecha_gasto >= :month_start
        GROUP BY c.nombre
        ORDER BY total DESC
    """)
    res_cat = await db.execute(query_cat, {"cid": cid, "month_start": month_start})
    por_categoria = [{"category_id": r.category_name, "total": float(r.total)} for r in res_cat.fetchall()]

    # By branch
    r5 = await db.execute(
        select(Expense.branch_id, sa_func.sum(Expense.monto))
        .where(Expense.company_id == cid, Expense.fecha_gasto >= month_start)
        .group_by(Expense.branch_id)
    )
    por_sucursal = [{"branch_id": str(k) if k else None, "total": float(v)} for k, v in r5.all()]

    # Pending approval
    r6 = await db.execute(
        select(sa_func.count())
        .where(Expense.company_id == cid, Expense.estado == "pendiente")
    )
    pendientes = int(r6.scalar())

    return ExpenseSummary(
        total_dia=total_dia, total_semana=total_semana, total_mes=total_mes,
        por_categoria=por_categoria, por_sucursal=por_sucursal,
        pendientes_aprobacion=pendientes,
    )
