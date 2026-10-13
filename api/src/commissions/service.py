from decimal import Decimal
from datetime import date, datetime, timezone
import uuid

from sqlalchemy import select, func as sa_func, text
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.commissions.models import CommissionRule, SalesCommission
from api.src.commissions.schemas import CommissionRuleCreate, CommissionRuleUpdate
from api.src.sales.models import Sale
from api.src.auth.models import User


async def create_rule(db: AsyncSession, data: CommissionRuleCreate) -> dict:
    rule = CommissionRule(**data.model_dump())
    db.add(rule)
    await db.flush()
    await db.refresh(rule)

    v_nombre = None
    if rule.vendedor_id:
        u_res = await db.execute(select(User.nombre).where(User.id == rule.vendedor_id))
        v_nombre = u_res.scalar_one_or_none()

    d = {c.name: getattr(rule, c.name) for c in rule.__table__.columns}
    d["vendedor_nombre"] = v_nombre
    return d


async def get_rule(db: AsyncSession, rule_id: str) -> dict | None:
    result = await db.execute(select(CommissionRule).where(CommissionRule.id == uuid.UUID(rule_id)))
    rule = result.scalar_one_or_none()
    if not rule:
        return None
    v_nombre = None
    if rule.vendedor_id:
        u_res = await db.execute(select(User.nombre).where(User.id == rule.vendedor_id))
        v_nombre = u_res.scalar_one_or_none()
    d = {c.name: getattr(rule, c.name) for c in rule.__table__.columns}
    d["vendedor_nombre"] = v_nombre
    return d


async def list_rules(db: AsyncSession, company_id: str, activo: bool | None = None) -> list[dict]:
    query = (
        select(CommissionRule, User.nombre.label("vendedor_nombre"))
        .outerjoin(User, CommissionRule.vendedor_id == User.id)
        .where(CommissionRule.company_id == company_id)
    )
    if activo is not None:
        query = query.where(CommissionRule.activo == activo)
    query = query.order_by(CommissionRule.nombre)
    result = await db.execute(query)

    records = []
    for rule, v_name in result.all():
        d = {c.name: getattr(rule, c.name) for c in rule.__table__.columns}
        d["vendedor_nombre"] = v_name
        records.append(d)
    return records


async def update_rule(db: AsyncSession, rule_id: str, data: CommissionRuleUpdate) -> dict | None:
    result = await db.execute(select(CommissionRule).where(CommissionRule.id == uuid.UUID(rule_id)))
    rule = result.scalar_one_or_none()
    if not rule:
        return None
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(rule, field, value)
    await db.flush()
    await db.refresh(rule)

    v_nombre = None
    if rule.vendedor_id:
        u_res = await db.execute(select(User.nombre).where(User.id == rule.vendedor_id))
        v_nombre = u_res.scalar_one_or_none()

    d = {c.name: getattr(rule, c.name) for c in rule.__table__.columns}
    d["vendedor_nombre"] = v_nombre
    return d


async def delete_rule(db: AsyncSession, rule_id: str) -> bool:
    result = await db.execute(select(CommissionRule).where(CommissionRule.id == uuid.UUID(rule_id)))
    rule = result.scalar_one_or_none()
    if not rule:
        return False
    await db.delete(rule)
    await db.flush()
    return True


async def list_commissions(
    db: AsyncSession, company_id: str, vendedor_id: str | None = None,
    estado: str | None = None, limit: int = 500, offset: int = 0,
) -> list[dict]:
    query = (
        select(
            SalesCommission,
            User.nombre.label("vendedor_nombre"),
            Sale.numero.label("sale_numero"),
            CommissionRule.nombre.label("rule_nombre"),
        )
        .outerjoin(User, SalesCommission.vendedor_id == User.id)
        .outerjoin(Sale, SalesCommission.sale_id == Sale.id)
        .outerjoin(CommissionRule, SalesCommission.rule_id == CommissionRule.id)
        .where(SalesCommission.company_id == company_id)
    )
    if vendedor_id:
        query = query.where(SalesCommission.vendedor_id == uuid.UUID(vendedor_id))
    if estado:
        query = query.where(SalesCommission.estado == estado)
    query = query.order_by(SalesCommission.created_at.desc()).limit(limit).offset(offset)
    result = await db.execute(query)

    records = []
    for comm, v_name, s_num, r_name in result.all():
        d = {c.name: getattr(comm, c.name) for c in comm.__table__.columns}
        d["vendedor_nombre"] = v_name or "Vendedor General"
        d["sale_numero"] = s_num or (str(comm.sale_id)[:8] if comm.sale_id else "—")
        d["rule_nombre"] = r_name or "Regla General"
        records.append(d)
    return records


async def pay_commission(db: AsyncSession, commission_id: str, fecha_pago: date | None = None) -> dict | None:
    result = await db.execute(select(SalesCommission).where(SalesCommission.id == uuid.UUID(commission_id)))
    comm = result.scalar_one_or_none()
    if not comm or comm.estado not in ("calculada", "pendiente"):
        return None
    comm.estado = "pagada"
    comm.fecha_pago = fecha_pago or date.today()
    await db.flush()
    await db.refresh(comm)

    # Resolve names
    u_res = await db.execute(select(User.nombre).where(User.id == comm.vendedor_id))
    v_nombre = u_res.scalar_one_or_none()

    s_res = await db.execute(select(Sale.numero).where(Sale.id == comm.sale_id))
    s_num = s_res.scalar_one_or_none()

    d = {c.name: getattr(comm, c.name) for c in comm.__table__.columns}
    d["vendedor_nombre"] = v_nombre
    d["sale_numero"] = s_num
    return d


async def get_commission_summary(db: AsyncSession, company_id: str) -> list[dict]:
    result = await db.execute(
        select(
            SalesCommission.vendedor_id,
            User.nombre.label("vendedor_nombre"),
            sa_func.sum(SalesCommission.base_calculo).label("total_ventas"),
            sa_func.sum(SalesCommission.monto_comision).label("total_comisiones"),
            sa_func.count(SalesCommission.id).label("cantidad"),
        )
        .outerjoin(User, SalesCommission.vendedor_id == User.id)
        .where(SalesCommission.company_id == company_id)
        .group_by(SalesCommission.vendedor_id, User.nombre)
    )
    rows = result.all()

    summary = []
    for row in rows:
        v_id = row.vendedor_id
        pending = await db.execute(
            select(sa_func.sum(SalesCommission.monto_comision)).where(
                SalesCommission.company_id == company_id,
                SalesCommission.vendedor_id == v_id,
                SalesCommission.estado.in_(["calculada", "pendiente"]),
            )
        )
        pendiente = pending.scalar() or 0
        summary.append({
            "vendedor_id": str(v_id) if v_id else None,
            "vendedor_nombre": row.vendedor_nombre or "Vendedor General",
            "total_ventas": float(row.total_ventas or 0),
            "total_comisiones": float(row.total_comisiones or 0),
            "cantidad_operaciones": row.cantidad,
            "pendiente_pago": float(pendiente),
        })

    return summary


async def calculate_batch_commissions(db: AsyncSession, company_id: str) -> dict:
    """Calcula comisiones para ventas confirmadas que aún no tengan comisión calculada."""
    # Obtenemos reglas activas
    rules_res = await db.execute(
        select(CommissionRule).where(CommissionRule.company_id == company_id, CommissionRule.activo == True)
    )
    rules = rules_res.scalars().all()
    if not rules:
        # Si no hay reglas, creamos una regla por defecto (1.5% general)
        default_rule = CommissionRule(
            company_id=company_id,
            nombre="Comisión Estándar Mostrador (1.5%)",
            tipo="porcentaje",
            porcentaje=Decimal("1.50"),
            aplica_a="total",
            activo=True,
        )
        db.add(default_rule)
        await db.flush()
        rules = [default_rule]

    # Obtenemos ventas confirmadas que no tengan registro en sales_commissions
    existing_sales = select(SalesCommission.sale_id).where(SalesCommission.company_id == company_id)
    sales_res = await db.execute(
        select(Sale)
        .where(
            Sale.company_id == company_id,
            Sale.estado == "confirmado",
            Sale.id.not_in(existing_sales),
        )
        .order_by(Sale.fecha.desc())
        .limit(200)
    )
    sales_to_process = sales_res.scalars().all()

    created_count = 0
    total_monto = Decimal("0")

    for sale in sales_to_process:
        base = Decimal(str(sale.total or 0))
        if base <= Decimal("0"):
            continue

        rule = rules[0]
        porc = Decimal(str(rule.porcentaje or "1.5"))
        monto_com = (base * porc / Decimal("100")).quantize(Decimal("1"), rounding="ROUND_HALF_UP")

        comm = SalesCommission(
            company_id=company_id,
            rule_id=rule.id,
            sale_id=sale.id,
            vendedor_id=sale.user_id,
            base_calculo=base,
            porcentaje=porc,
            monto_comision=monto_com,
            moneda="PYG",
            estado="calculada",
        )
        db.add(comm)
        created_count += 1
        total_monto += monto_com

    if created_count > 0:
        await db.flush()

    return {
        "calculadas": created_count,
        "monto_total_comisiones": float(total_monto),
    }
