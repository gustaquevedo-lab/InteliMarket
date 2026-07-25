from decimal import Decimal
from datetime import datetime, timezone, date
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.quotes.models import Quote, QuoteItem
from api.src.quotes.schemas import QuoteCreate, QuoteUpdate, QuoteConvertToSale
from api.src.sales.service import create_sale as create_sale_service
from api.src.sales.schemas import SaleCreate, SaleItemInput


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


async def generate_quote_number(db: AsyncSession, company_id: str) -> str:
    date_part = datetime.now(timezone.utc).strftime("%Y%m%d")
    result = await db.execute(
        select(Quote).where(Quote.company_id == company_id).order_by(Quote.created_at.desc()).limit(1)
    )
    last = result.scalar_one_or_none()
    seq = int(last.numero.split("-")[-1]) + 1 if last else 1
    return f"COT-{date_part}-{seq:06d}"


async def create_quote(db: AsyncSession, data: QuoteCreate) -> Quote:
    numero = await generate_quote_number(db, str(data.company_id))

    subtotal = Decimal("0")
    descuento_total = Decimal("0")
    base_gravada_10 = Decimal("0")
    base_gravada_5 = Decimal("0")
    base_exenta = Decimal("0")
    iva_10 = Decimal("0")
    iva_5 = Decimal("0")

    quote = Quote(
        company_id=data.company_id,
        customer_id=data.customer_id,
        branch_id=data.branch_id,
        numero=numero,
        moneda=data.moneda,
        tipo_cambio=data.tipo_cambio,
        estado="vigente",
        valido_hasta=data.valido_hasta or date.today(),
        observaciones=data.observaciones,
        condiciones_pago=data.condiciones_pago,
        user_id=data.user_id,
    )
    db.add(quote)
    await db.flush()

    for item_data in data.items:
        taxes = _calculate_taxes(item_data.model_dump())

        item = QuoteItem(
            quote_id=quote.id,
            product_id=item_data.product_id,
            variant_id=item_data.variant_id,
            descripcion=item_data.descripcion,
            cantidad=item_data.cantidad,
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

    quote.subtotal = subtotal
    quote.descuento_total = descuento_total
    quote.base_gravada_10 = base_gravada_10
    quote.base_gravada_5 = base_gravada_5
    quote.base_exenta = base_exenta
    quote.iva_10 = iva_10
    quote.iva_5 = iva_5
    quote.total = subtotal + iva_10 + iva_5

    await db.flush()
    await db.refresh(quote)
    return quote


async def get_quote(db: AsyncSession, quote_id: str) -> Quote | None:
    result = await db.execute(select(Quote).where(Quote.id == uuid.UUID(quote_id)))
    return result.scalar_one_or_none()


async def get_quote_with_items(db: AsyncSession, quote_id: str) -> dict | None:
    quote = await get_quote(db, quote_id)
    if not quote:
        return None
    items_result = await db.execute(select(QuoteItem).where(QuoteItem.quote_id == quote.id))
    items = items_result.scalars().all()
    return {**{c.name: getattr(quote, c.name) for c in quote.__table__.columns}, "items": items}


async def list_quotes(
    db: AsyncSession,
    company_id: str,
    customer_id: str | None = None,
    estado: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> list[Quote]:
    query = select(Quote).where(Quote.company_id == company_id)
    if customer_id:
        query = query.where(Quote.customer_id == customer_id)
    if estado:
        query = query.where(Quote.estado == estado)
    query = query.order_by(Quote.fecha.desc()).limit(limit).offset(offset)
    result = await db.execute(query)
    return list(result.scalars().all())


async def update_quote(db: AsyncSession, quote_id: str, data: QuoteUpdate) -> Quote | None:
    quote = await get_quote(db, quote_id)
    if not quote or quote.estado != "vigente":
        return None

    if data.customer_id is not None:
        quote.customer_id = data.customer_id
    if data.valido_hasta is not None:
        quote.valido_hasta = data.valido_hasta
    if data.moneda is not None:
        quote.moneda = data.moneda
    if data.tipo_cambio is not None:
        quote.tipo_cambio = data.tipo_cambio
    if data.observaciones is not None:
        quote.observaciones = data.observaciones
    if data.condiciones_pago is not None:
        quote.condiciones_pago = data.condiciones_pago

    if data.items is not None:
        existing = await db.execute(select(QuoteItem).where(QuoteItem.quote_id == quote.id))
        for item in existing.scalars().all():
            await db.delete(item)

        subtotal = Decimal("0")
        descuento_total = Decimal("0")
        base_gravada_10 = Decimal("0")
        base_gravada_5 = Decimal("0")
        base_exenta = Decimal("0")
        iva_10 = Decimal("0")
        iva_5 = Decimal("0")

        for item_data in data.items:
            taxes = _calculate_taxes(item_data.model_dump())
            item = QuoteItem(
                quote_id=quote.id,
                product_id=item_data.product_id,
                variant_id=item_data.variant_id,
                descripcion=item_data.descripcion,
                cantidad=item_data.cantidad,
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

        quote.subtotal = subtotal
        quote.descuento_total = descuento_total
        quote.base_gravada_10 = base_gravada_10
        quote.base_gravada_5 = base_gravada_5
        quote.base_exenta = base_exenta
        quote.iva_10 = iva_10
        quote.iva_5 = iva_5
        quote.total = subtotal + iva_10 + iva_5

    quote.updated_at = datetime.now(timezone.utc)
    await db.flush()
    await db.refresh(quote)
    return quote


async def change_quote_status(db: AsyncSession, quote_id: str, estado: str, sale_id: str | None = None) -> Quote | None:
    quote = await get_quote(db, quote_id)
    if not quote:
        return None

    valid_states = {"vigente", "aceptada", "rechazada", "expirada", "convertida"}
    if estado not in valid_states:
        return None

    quote.estado = estado
    if sale_id:
        quote.sale_id = uuid.UUID(sale_id) if isinstance(sale_id, str) else sale_id
    quote.updated_at = datetime.now(timezone.utc)
    await db.flush()
    await db.refresh(quote)
    return quote


async def convert_quote_to_sale(db: AsyncSession, quote_id: str, data: QuoteConvertToSale) -> dict | None:
    quote = await get_quote(db, quote_id)
    if not quote or quote.estado not in ("vigente", "aceptada"):
        return {"error": "Cotización no disponible para conversión"}

    items_result = await db.execute(select(QuoteItem).where(QuoteItem.quote_id == quote.id))
    quote_items = list(items_result.scalars().all())
    if not quote_items:
        return {"error": "Cotización sin items"}

    sale_input_items = []
    for qi in quote_items:
        sale_input_items.append(SaleItemInput(
            product_id=qi.product_id,
            variant_id=qi.variant_id,
            descripcion=qi.descripcion,
            cantidad=qi.cantidad,
            precio_unitario=qi.precio_unitario,
            descuento_pct=qi.descuento_pct,
            iva_tasa=qi.iva_tasa or Decimal("10"),
        ))

    sale_create = SaleCreate(
        company_id=quote.company_id,
        branch_id=data.branch_id or quote.branch_id,
        customer_id=quote.customer_id,
        emission_point_id=data.emission_point_id,
        tipo_comprobante=data.tipo_comprobante,
        condicion=data.condicion,
        moneda=quote.moneda,
        tipo_cambio=quote.tipo_cambio,
        items=sale_input_items,
        observaciones=f"Convertido de cotización {quote.numero}" + (f" - {quote.observaciones}" if quote.observaciones else ""),
        user_id=data.user_id or quote.user_id,
    )

    try:
        sale = await create_sale_service(db, sale_create)
        await change_quote_status(db, str(quote.id), "convertida", str(sale.id))
        return {"sale": sale, "quote": quote}
    except ValueError as e:
        return {"error": str(e)}


async def expire_quotes(db: AsyncSession, company_id: str | None = None) -> int:
    query = select(Quote).where(Quote.estado == "vigente", Quote.valido_hasta < date.today())
    if company_id:
        query = query.where(Quote.company_id == company_id)
    result = await db.execute(query)
    expired = 0
    for quote in result.scalars().all():
        quote.estado = "expirada"
        expired += 1
    if expired:
        await db.flush()
    return expired
