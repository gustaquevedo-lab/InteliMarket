from decimal import Decimal
from datetime import datetime, timezone
import uuid

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.sales_orders.models import SalesOrder, SalesOrderItem
from api.src.sales_orders.schemas import SalesOrderCreate, SalesOrderUpdate


def _calculate_taxes(item: dict) -> dict:
    precio = Decimal(str(item["precio_unitario"]))
    cantidad = Decimal(str(item["cantidad"]))
    descuento_pct = Decimal(str(item.get("descuento_pct", 0)))
    iva_tasa = Decimal(str(item.get("iva_tasa", 10)))

    subtotal_bruto = precio * cantidad
    descuento_monto = subtotal_bruto * (descuento_pct / Decimal("100"))
    base = subtotal_bruto - descuento_monto

    if iva_tasa == Decimal("0"):
        iva_monto = Decimal("0")
        total = base
    else:
        iva_monto = (base * iva_tasa / Decimal("100")).quantize(Decimal("1"), rounding="ROUND_HALF_UP")
        total = base + iva_monto

    return {
        "subtotal_bruto": subtotal_bruto.quantize(Decimal("1")),
        "descuento_monto": descuento_monto.quantize(Decimal("1")),
        "iva_monto": iva_monto,
        "total": total.quantize(Decimal("1")),
        "base": base.quantize(Decimal("1")),
    }


async def generate_order_number(db: AsyncSession, company_id: str) -> str:
    date_part = datetime.now(timezone.utc).strftime("%Y%m%d")
    result = await db.execute(
        select(SalesOrder).where(SalesOrder.company_id == company_id).order_by(SalesOrder.created_at.desc()).limit(1)
    )
    last = result.scalar_one_or_none()
    seq = int(last.numero.split("-")[-1]) + 1 if last else 1
    return f"PV-{date_part}-{seq:06d}"


async def create_order(db: AsyncSession, data: SalesOrderCreate) -> SalesOrder:
    numero = await generate_order_number(db, str(data.company_id))

    subtotal = Decimal("0")
    descuento_total = Decimal("0")
    base_gravada_10 = Decimal("0")
    base_gravada_5 = Decimal("0")
    base_exenta = Decimal("0")
    iva_10 = Decimal("0")
    iva_5 = Decimal("0")

    order = SalesOrder(
        company_id=data.company_id,
        branch_id=data.branch_id,
        customer_id=data.customer_id,
        numero=numero,
        estado="borrador",
        prioridad=data.prioridad,
        moneda=data.moneda,
        tipo_cambio=data.tipo_cambio,
        condicion=data.condicion,
        fecha_entrega_solicitada=data.fecha_entrega_solicitada,
        observaciones=data.observaciones,
        direccion_entrega=data.direccion_entrega,
        vendedor_id=data.vendedor_id,
        user_id=data.user_id,
    )
    db.add(order)
    await db.flush()

    for item_data in data.items:
        taxes = _calculate_taxes(item_data.model_dump())

        item = SalesOrderItem(
            order_id=order.id,
            product_id=item_data.product_id,
            variant_id=item_data.variant_id,
            descripcion=item_data.descripcion,
            cantidad=item_data.cantidad,
            cantidad_pendiente=item_data.cantidad,
            precio_unitario=item_data.precio_unitario,
            descuento_pct=item_data.descuento_pct,
            iva_tasa=item_data.iva_tasa,
            iva_monto=taxes["iva_monto"],
            total=taxes["total"],
        )
        db.add(item)

        subtotal += taxes["subtotal_bruto"]
        descuento_total += taxes["descuento_monto"]
        tasa = Decimal(str(item_data.iva_tasa))
        if tasa == Decimal("10"):
            base_gravada_10 += taxes["base"]
            iva_10 += taxes["iva_monto"]
        elif tasa == Decimal("5"):
            base_gravada_5 += taxes["base"]
            iva_5 += taxes["iva_monto"]
        else:
            base_exenta += taxes["base"]

    order.subtotal = subtotal
    order.descuento_total = descuento_total
    order.base_gravada_10 = base_gravada_10
    order.base_gravada_5 = base_gravada_5
    order.base_exenta = base_exenta
    order.iva_10 = iva_10
    order.iva_5 = iva_5
    order.total = subtotal + iva_10 + iva_5

    await db.flush()
    await db.refresh(order)
    return order


async def get_order(db: AsyncSession, order_id: str) -> SalesOrder | None:
    result = await db.execute(select(SalesOrder).where(SalesOrder.id == uuid.UUID(order_id)))
    return result.scalar_one_or_none()


async def get_order_with_items(db: AsyncSession, order_id: str) -> dict | None:
    order = await get_order(db, order_id)
    if not order:
        return None
    items_result = await db.execute(select(SalesOrderItem).where(SalesOrderItem.order_id == order.id))
    items = items_result.scalars().all()
    return {**{c.name: getattr(order, c.name) for c in order.__table__.columns}, "items": items}


async def list_orders(
    db: AsyncSession,
    company_id: str,
    customer_id: str | None = None,
    estado: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> list[SalesOrder]:
    query = select(SalesOrder).where(SalesOrder.company_id == company_id)
    if customer_id:
        query = query.where(SalesOrder.customer_id == customer_id)
    if estado:
        query = query.where(SalesOrder.estado == estado)
    query = query.order_by(SalesOrder.fecha.desc()).limit(limit).offset(offset)
    result = await db.execute(query)
    return list(result.scalars().all())


async def update_order(db: AsyncSession, order_id: str, data: SalesOrderUpdate) -> SalesOrder | None:
    order = await get_order(db, order_id)
    if not order or order.estado not in ("borrador", "pendiente_aprobacion"):
        return None

    if data.customer_id is not None:
        order.customer_id = data.customer_id
    if data.fecha_entrega_solicitada is not None:
        order.fecha_entrega_solicitada = data.fecha_entrega_solicitada
    if data.prioridad is not None:
        order.prioridad = data.prioridad
    if data.observaciones is not None:
        order.observaciones = data.observaciones
    if data.direccion_entrega is not None:
        order.direccion_entrega = data.direccion_entrega

    if data.items is not None:
        existing = await db.execute(select(SalesOrderItem).where(SalesOrderItem.order_id == order.id))
        for item in existing.scalars().all():
            await db.delete(item)

        subtotal = descuento_total = base_gravada_10 = base_gravada_5 = base_exenta = iva_10 = iva_5 = Decimal("0")
        for item_data in data.items:
            taxes = _calculate_taxes(item_data.model_dump())
            item = SalesOrderItem(
                order_id=order.id, product_id=item_data.product_id, variant_id=item_data.variant_id,
                descripcion=item_data.descripcion, cantidad=item_data.cantidad, cantidad_pendiente=item_data.cantidad,
                precio_unitario=item_data.precio_unitario, descuento_pct=item_data.descuento_pct,
                iva_tasa=item_data.iva_tasa, iva_monto=taxes["iva_monto"], total=taxes["total"],
            )
            db.add(item)
            subtotal += taxes["subtotal_bruto"]
            descuento_total += taxes["descuento_monto"]
            tasa = Decimal(str(item_data.iva_tasa))
            if tasa == Decimal("10"):
                base_gravada_10 += taxes["base"]; iva_10 += taxes["iva_monto"]
            elif tasa == Decimal("5"):
                base_gravada_5 += taxes["base"]; iva_5 += taxes["iva_monto"]
            else:
                base_exenta += taxes["base"]

        order.subtotal = subtotal
        order.descuento_total = descuento_total
        order.base_gravada_10 = base_gravada_10
        order.base_gravada_5 = base_gravada_5
        order.base_exenta = base_exenta
        order.iva_10 = iva_10
        order.iva_5 = iva_5
        order.total = subtotal + iva_10 + iva_5

    order.updated_at = datetime.now(timezone.utc)
    await db.flush()
    await db.refresh(order)
    return order


ORDER_FLOWS = {
    "borrador": ["pendiente_aprobacion", "cancelado"],
    "pendiente_aprobacion": ["aprobado", "rechazado", "borrador"],
    "aprobado": ["en_preparacion", "cancelado"],
    "rechazado": ["borrador", "cancelado"],
    "en_preparacion": ["listo", "cancelado"],
    "listo": ["facturado", "cancelado"],
    "facturado": ["completado", "cancelado"],
    "completado": [],
    "cancelado": [],
}


async def change_order_status(db: AsyncSession, order_id: str, estado: str, motivo: str | None = None) -> SalesOrder | None:
    order = await get_order(db, order_id)
    if not order:
        return None

    allowed = ORDER_FLOWS.get(order.estado, [])
    if estado not in allowed:
        return None

    order.estado = estado
    if estado == "aprobado":
        order.aprobado_por = None
        order.fecha_aprobacion = datetime.now(timezone.utc)
    if estado == "rechazado" and motivo:
        order.rechazado_motivo = motivo
    if estado == "facturado":
        for item in order.items:
            item.cantidad_facturada = item.cantidad
            item.cantidad_pendiente = Decimal("0")
    if estado == "completado":
        for item in order.items:
            item.cantidad_entregada = item.cantidad

    order.updated_at = datetime.now(timezone.utc)
    await db.flush()
    await db.refresh(order)
    return order


async def approve_order(db: AsyncSession, order_id: str, aprobado_por: str) -> SalesOrder | None:
    order = await get_order(db, order_id)
    if not order or order.estado != "pendiente_aprobacion":
        return None
    order.estado = "aprobado"
    order.aprobado_por = uuid.UUID(aprobado_por) if isinstance(aprobado_por, str) else aprobado_por
    order.fecha_aprobacion = datetime.now(timezone.utc)
    order.updated_at = datetime.now(timezone.utc)
    await db.flush()
    await db.refresh(order)
    return order


async def get_orders_kpi(db: AsyncSession, company_id: str) -> dict:
    result = await db.execute(select(SalesOrder).where(SalesOrder.company_id == company_id))
    orders = list(result.scalars().all())
    total = len(orders)
    pendientes = sum(1 for o in orders if o.estado in ("borrador", "pendiente_aprobacion"))
    en_curso = sum(1 for o in orders if o.estado in ("aprobado", "en_preparacion", "listo"))
    completados = sum(1 for o in orders if o.estado == "completado")
    cancelados = sum(1 for o in orders if o.estado == "cancelado")
    total_monto = sum(int(o.total or 0) for o in orders)
    return {
        "total": total,
        "pendientes": pendientes,
        "en_curso": en_curso,
        "completados": completados,
        "cancelados": cancelados,
        "total_monto": total_monto,
    }
