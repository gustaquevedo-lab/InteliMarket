from decimal import Decimal
from datetime import date, datetime, timezone
import uuid

from sqlalchemy import select, func as sa_func
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.commissions.models import CommissionRule, SalesCommission
from api.src.commissions.schemas import CommissionRuleCreate, CommissionRuleUpdate
from api.src.sales.models import Sale


async def create_rule(db: AsyncSession, data: CommissionRuleCreate) -> CommissionRule:
    rule = CommissionRule(**data.model_dump())
    db.add(rule)
    await db.flush()
    await db.refresh(rule)
    return rule


async def get_rule(db: AsyncSession, rule_id: str) -> CommissionRule | None:
    result = await db.execute(select(CommissionRule).where(CommissionRule.id == uuid.UUID(rule_id)))
    return result.scalar_one_or_none()


async def list_rules(db: AsyncSession, company_id: str, activo: bool | None = None) -> list[CommissionRule]:
    query = select(CommissionRule).where(CommissionRule.company_id == company_id)
    if activo is not None:
        query = query.where(CommissionRule.activo == activo)
    query = query.order_by(CommissionRule.nombre)
    result = await db.execute(query)
    return list(result.scalars().all())


async def update_rule(db: AsyncSession, rule_id: str, data: CommissionRuleUpdate) -> CommissionRule | None:
    rule = await get_rule(db, rule_id)
    if not rule:
        return None
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(rule, field, value)
    await db.flush()
    await db.refresh(rule)
    return rule


async def delete_rule(db: AsyncSession, rule_id: str) -> bool:
    rule = await get_rule(db, rule_id)
    if not rule:
        return False
    await db.delete(rule)
    await db.flush()
    return True


async def calculate_commission_for_sale(
    db: AsyncSession, sale: Sale, company_id: str, vendedor_id: str | None = None,
) -> list[SalesCommission]:
    if not vendedor_id:
        vendedor_id = str(sale.user_id) if sale.user_id else None
    if not vendedor_id:
        return []

    today = date.today()
    result = await db.execute(
        select(CommissionRule).where(
            CommissionRule.company_id == company_id,
            CommissionRule.activo == True,
            CommissionRule.valido_desde <= today,
            CommissionRule.valido_hasta >= today,
        )
    )
    rules = list(result.scalars().all())
    commissions = []

    for rule in rules:
        if rule.vendedor_id and str(rule.vendedor_id) != vendedor_id:
            continue

        base = Decimal(str(sale.total))
        if rule.monto_minimo and base < rule.monto_minimo:
            continue
        if rule.monto_maximo and base > rule.monto_maximo:
            continue

        comision = (base * Decimal(str(rule.porcentaje)) / Decimal("100")).quantize(Decimal("1"), rounding="ROUND_HALF_UP")

        comm = SalesCommission(
            company_id=company_id,
            rule_id=rule.id,
            sale_id=sale.id,
            vendedor_id=uuid.UUID(vendedor_id),
            base_calculo=base,
            porcentaje=rule.porcentaje,
            monto_comision=comision,
            moneda=sale.moneda,
            estado="calculada",
        )
        db.add(comm)
        commissions.append(comm)

    if commissions:
        await db.flush()

    return commissions


async def list_commissions(
    db: AsyncSession, company_id: str, vendedor_id: str | None = None,
    estado: str | None = None, limit: int = 50, offset: int = 0,
) -> list[SalesCommission]:
    query = select(SalesCommission).where(SalesCommission.company_id == company_id)
    if vendedor_id:
        query = query.where(SalesCommission.vendedor_id == vendedor_id)
    if estado:
        query = query.where(SalesCommission.estado == estado)
    query = query.order_by(SalesCommission.created_at.desc()).limit(limit).offset(offset)
    result = await db.execute(query)
    return list(result.scalars().all())


async def pay_commission(db: AsyncSession, commission_id: str, fecha_pago: date | None = None) -> SalesCommission | None:
    result = await db.execute(select(SalesCommission).where(SalesCommission.id == uuid.UUID(commission_id)))
    comm = result.scalar_one_or_none()
    if not comm or comm.estado != "calculada":
        return None
    comm.estado = "pagada"
    comm.fecha_pago = fecha_pago or date.today()
    await db.flush()
    await db.refresh(comm)
    return comm


async def get_commission_summary(db: AsyncSession, company_id: str) -> list[dict]:
    result = await db.execute(
        select(
            SalesCommission.vendedor_id,
            sa_func.sum(SalesCommission.base_calculo).label("total_ventas"),
            sa_func.sum(SalesCommission.monto_comision).label("total_comisiones"),
            sa_func.count(SalesCommission.id).label("cantidad"),
        ).where(
            SalesCommission.company_id == company_id,
        ).group_by(SalesCommission.vendedor_id)
    )
    rows = result.all()

    summary = []
    for row in rows:
        pending = await db.execute(
            select(sa_func.sum(SalesCommission.monto_comision)).where(
                SalesCommission.company_id == company_id,
                SalesCommission.vendedor_id == row.vendedor_id,
                SalesCommission.estado == "calculada",
            )
        )
        pendiente = pending.scalar() or 0
        summary.append({
            "vendedor_id": str(row.vendedor_id),
            "total_ventas": float(row.total_ventas or 0),
            "total_comisiones": float(row.total_comisiones or 0),
            "cantidad_operaciones": row.cantidad,
            "pendiente_pago": float(pendiente),
        })

    return summary
