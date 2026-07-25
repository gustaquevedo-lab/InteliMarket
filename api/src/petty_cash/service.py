from decimal import Decimal
from datetime import date, datetime
import uuid

from sqlalchemy import select, func as sa_func, and_
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
    limit: int = 50, offset: int = 0,
) -> list[Expense]:
    query = select(Expense).where(Expense.company_id == uuid.UUID(company_id))
    if branch_id:
        query = query.where(Expense.branch_id == uuid.UUID(branch_id))
    if category_id:
        query = query.where(Expense.category_id == uuid.UUID(category_id))
    if estado:
        query = query.where(Expense.estado == estado)
    if desde:
        query = query.where(Expense.fecha_gasto >= desde)
    if hasta:
        query = query.where(Expense.fecha_gasto <= hasta)
    query = query.order_by(Expense.created_at.desc()).limit(limit).offset(offset)
    result = await db.execute(query)
    return list(result.scalars().all())


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

    # Daily total
    r1 = await db.execute(
        select(sa_func.coalesce(sa_func.sum(Expense.monto), 0))
        .where(Expense.company_id == cid, Expense.fecha_gasto == today)
    )
    total_dia = float(r1.scalar())

    # Weekly total
    r2 = await db.execute(
        select(sa_func.coalesce(sa_func.sum(Expense.monto), 0))
        .where(Expense.company_id == cid, Expense.fecha_gasto >= today)
    )
    total_semana = float(r2.scalar())

    # Monthly total
    month_start = today.replace(day=1)
    r3 = await db.execute(
        select(sa_func.coalesce(sa_func.sum(Expense.monto), 0))
        .where(Expense.company_id == cid, Expense.fecha_gasto >= month_start)
    )
    total_mes = float(r3.scalar())

    # By category
    r4 = await db.execute(
        select(Expense.category_id, sa_func.sum(Expense.monto))
        .where(Expense.company_id == cid, Expense.fecha_gasto >= month_start)
        .group_by(Expense.category_id)
    )
    por_categoria = [{"category_id": str(k) if k else None, "total": float(v)} for k, v in r4.all()]

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
