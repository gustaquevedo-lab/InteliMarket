from decimal import Decimal
from datetime import date, datetime, time
import uuid

from sqlalchemy import select, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from api.src.promotions.models import Promotion, PromotionUsage
from api.src.promotions.schemas import (
    PromotionCreate, PromotionUpdate,
    ValidateCartInput, ValidatedPromotion, CalculatePromoResponse,
)


async def create_promotion(db: AsyncSession, company_id: str, data: PromotionCreate) -> Promotion:
    promo = Promotion(
        company_id=uuid.UUID(company_id),
        nombre=data.nombre,
        descripcion=data.descripcion,
        tipo=data.tipo,
        valor=data.valor,
        valor_maximo=data.valor_maximo,
        aplica_a=data.aplica_a,
        producto_ids=[uuid.UUID(p) for p in (data.producto_ids or [])] if data.producto_ids else None,
        categoria_ids=[uuid.UUID(c) for c in (data.categoria_ids or [])] if data.categoria_ids else None,
        monto_minimo_compra=data.monto_minimo_compra,
        cantidad_minima=data.cantidad_minima,
        cantidad_maxima_items=data.cantidad_maxima_items,
        aplicaciones_por_cliente=data.aplicaciones_por_cliente,
        combinable=data.combinable,
        valido_desde=data.valido_desde,
        valido_hasta=data.valido_hasta,
        horario_desde=data.horario_desde,
        horario_hasta=data.horario_hasta,
        dias_semana=data.dias_semana,
        codigo_cupon=data.codigo_cupon,
        requiere_cupon=data.requiere_cupon,
        usos_maximos=data.usos_maximos,
        activo=data.activo,
    )
    db.add(promo)
    await db.flush()
    await db.refresh(promo)
    return promo


async def get_promotion(db: AsyncSession, promo_id: str) -> Promotion | None:
    result = await db.execute(select(Promotion).where(Promotion.id == uuid.UUID(promo_id)))
    return result.scalar_one_or_none()


async def list_promotions(
    db: AsyncSession, company_id: str, activo: bool | None = None, tipo: str | None = None,
) -> list[Promotion]:
    query = select(Promotion).where(Promotion.company_id == uuid.UUID(company_id))
    if activo is not None:
        query = query.where(Promotion.activo == activo)
    if tipo:
        query = query.where(Promotion.tipo == tipo)
    query = query.order_by(Promotion.created_at.desc())
    result = await db.execute(query)
    return list(result.scalars().all())


async def update_promotion(db: AsyncSession, promo_id: str, data: PromotionUpdate) -> Promotion | None:
    promo = await get_promotion(db, promo_id)
    if not promo:
        return None
    update_data = data.model_dump(exclude_unset=True)
    if "producto_ids" in update_data and update_data["producto_ids"] is not None:
        update_data["producto_ids"] = [uuid.UUID(p) for p in update_data["producto_ids"]]
    if "categoria_ids" in update_data and update_data["categoria_ids"] is not None:
        update_data["categoria_ids"] = [uuid.UUID(c) for c in update_data["categoria_ids"]]
    for field, value in update_data.items():
        setattr(promo, field, value)
    await db.flush()
    await db.refresh(promo)
    return promo


async def delete_promotion(db: AsyncSession, promo_id: str) -> bool:
    promo = await get_promotion(db, promo_id)
    if not promo:
        return False
    await db.delete(promo)
    await db.flush()
    return True


async def calculate_applicable(
    db: AsyncSession, company_id: str, input: ValidateCartInput,
) -> CalculatePromoResponse:
    """Validates cart against all active promotions, returns applicable ones."""
    today = date.today()
    now = datetime.now().time()

    result = await db.execute(
        select(Promotion).where(
            Promotion.company_id == uuid.UUID(company_id),
            Promotion.activo == True,
            Promotion.valido_desde <= today,
            Promotion.valido_hasta >= today,
        )
    )
    promos = list(result.scalars().all())

    total_cart = sum(item.cantidad * item.precio_unitario for item in input.items)
    total_items = sum(item.cantidad for item in input.items)
    product_ids = [item.producto_id for item in input.items]
    today_dow = today.weekday()  # 0=Monday → convert to 0=Sunday

    applicable: list[ValidatedPromotion] = []
    total_descuento = Decimal("0")

    for p in promos:
        # Check max usage
        if p.usos_maximos and (p.usos_actuales or 0) >= p.usos_maximos:
            continue

        # Check schedule
        if p.dias_semana:
            # Convert Python weekday (0=Mon) to Sunday-based (0=Sun)
            py_dow = today.weekday()
            sunday_dow = (py_dow + 1) % 7
            if sunday_dow not in p.dias_semana:
                continue

        if p.horario_desde and p.horario_hasta:
            if not (p.horario_desde <= now <= p.horario_hasta):
                continue

        # Check coupon requirement
        if p.requiere_cupon:
            if not input.codigo_cupon or input.codigo_cupon.lower() != (p.codigo_cupon or "").lower():
                continue

        # Check min purchase
        if p.monto_minimo_compra and total_cart < p.monto_minimo_compra:
            continue

        # Check min items
        if p.cantidad_minima and total_items < p.cantidad_minima:
            continue

        # Determine which items apply
        aplica_items: list[str] = []
        if p.aplica_a == "carrito":
            aplica_items = product_ids
        elif p.aplica_a == "producto" and p.producto_ids:
            pids = {str(pid) for pid in p.producto_ids}
            aplica_items = [pid for pid in product_ids if pid in pids]
        elif p.aplica_a == "categoria" and p.categoria_ids:
            cids = {str(cid) for cid in p.categoria_ids}
            aplica_items = [
                item.producto_id for item in input.items
                if item.categoria_id and item.categoria_id in cids
            ]

        if not aplica_items:
            continue

        # Calculate discount
        descuento = Decimal("0")
        if p.tipo == "porcentaje":
            applicable_total = sum(
                item.cantidad * item.precio_unitario
                for item in input.items if item.producto_id in aplica_items
            )
            descuento = applicable_total * (p.valor or Decimal("0")) / Decimal("100")
            if p.valor_maximo and descuento > p.valor_maximo:
                descuento = p.valor_maximo

        elif p.tipo == "monto_fijo":
            descuento = p.valor or Decimal("0")

        elif p.tipo == "dos_por_uno":
            applicable_items = [item for item in input.items if item.producto_id in aplica_items]
            if applicable_items:
                applicable_items.sort(key=lambda x: x.precio_unitario)
                free_items = sum(item.cantidad for item in applicable_items) // 2
                # Discount = cheapest item price * free items
                cheapest = min(item.precio_unitario for item in applicable_items)
                descuento = cheapest * min(free_items, p.cantidad_maxima_items or free_items)

        elif p.tipo == "cantidad_lleva":
            applicable_items = [item for item in input.items if item.producto_id in aplica_items]
            if applicable_items:
                applicable_items.sort(key=lambda x: x.precio_unitario)
                free_items = sum(item.cantidad for item in applicable_items) // (p.cantidad_minima or 2)
                cheapest = min(item.precio_unitario for item in applicable_items)
                descuento = cheapest * min(free_items, p.cantidad_maxima_items or free_items)

        elif p.tipo == "combo_precio":
            applicable_items = [item for item in input.items if item.producto_id in aplica_items]
            if len(applicable_items) >= (p.cantidad_minima or 2):
                original = sum(item.cantidad * item.precio_unitario for item in applicable_items)
                combo_price = p.valor or Decimal("0")
                descuento = original - combo_price

        if descuento > 0:
            applicable.append(ValidatedPromotion(
                promotion_id=str(p.id),
                nombre=p.nombre,
                tipo=p.tipo,
                descuento=float(descuento),
                descuento_maximo=float(p.valor_maximo) if p.valor_maximo else None,
                items_aplicados=aplica_items,
                descripcion=p.descripcion,
            ))
            total_descuento += descuento

    total_final = max(total_cart - total_descuento, Decimal("0"))
    return CalculatePromoResponse(
        applicable_promotions=applicable,
        total_descuento=float(total_descuento),
        total_final=float(total_final),
    )


async def log_promotion_usage(
    db: AsyncSession, promotion_id: str, company_id: str, sale_id: str,
    descuento: Decimal, customer_id: str | None = None,
    branch_id: str | None = None, codigo_cupon: str | None = None,
    items_aplicados: list[str] | None = None,
) -> None:
    usage = PromotionUsage(
        promotion_id=uuid.UUID(promotion_id),
        company_id=uuid.UUID(company_id),
        sale_id=uuid.UUID(sale_id),
        customer_id=uuid.UUID(customer_id) if customer_id else None,
        branch_id=uuid.UUID(branch_id) if branch_id else None,
        codigo_cupon=codigo_cupon,
        descuento_aplicado=descuento,
        items_aplicados=[uuid.UUID(i) for i in (items_aplicados or [])] if items_aplicados else None,
    )
    db.add(usage)
    # Increment counter
    promo = await get_promotion(db, promotion_id)
    if promo:
        promo.usos_actuales = (promo.usos_actuales or 0) + 1
    await db.flush()


async def list_usage(
    db: AsyncSession, company_id: str, promotion_id: str | None = None,
    limit: int = 50, offset: int = 0,
) -> list[PromotionUsage]:
    query = select(PromotionUsage).where(
        PromotionUsage.company_id == uuid.UUID(company_id)
    )
    if promotion_id:
        query = query.where(PromotionUsage.promotion_id == uuid.UUID(promotion_id))
    query = query.order_by(PromotionUsage.created_at.desc()).limit(limit).offset(offset)
    result = await db.execute(query)
    return list(result.scalars().all())
