"""Sales service"""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime, timezone
from decimal import Decimal
import uuid

from api.src.sales.models import Sale, SaleItem, CashRegister, CashSession
from api.src.sales.schemas import SaleCreate, CashSessionCreate, CashSessionClose
from api.src.inventory.models import Stock, InventoryMovement


def calculate_taxes(item: dict) -> dict:
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


async def generate_sale_number(db: AsyncSession, company_id: str, branch_id: str | None) -> str:
    date_part = datetime.now(timezone.utc).strftime("%Y%m%d")
    result = await db.execute(
        select(Sale)
        .where(Sale.company_id == company_id)
        .order_by(Sale.created_at.desc())
        .limit(1)
    )
    last = result.scalar_one_or_none()
    seq = int(last.numero.split("-")[-1]) + 1 if last else 1
    branch_code = branch_id[:3].upper() if branch_id else "000"
    return f"{date_part}-{branch_code}-{seq:06d}"


async def create_sale(db: AsyncSession, data: SaleCreate) -> Sale:
    numero = await generate_sale_number(db, str(data.company_id), str(data.branch_id) if data.branch_id else None)

    subtotal = Decimal("0")
    descuento_total = Decimal("0")
    base_gravada_10 = Decimal("0")
    base_gravada_5 = Decimal("0")
    base_exenta = Decimal("0")
    iva_10 = Decimal("0")
    iva_5 = Decimal("0")

    sale = Sale(
        company_id=data.company_id,
        branch_id=data.branch_id,
        customer_id=data.customer_id,
        emission_point_id=data.emission_point_id,
        numero=numero,
        tipo_comprobante=data.tipo_comprobante,
        condicion=data.condicion,
        moneda=data.moneda,
        tipo_cambio=data.tipo_cambio,
        estado="confirmado",
        observaciones=data.observaciones,
        user_id=data.user_id,
    )
    db.add(sale)
    await db.flush()

    for item_data in data.items:
        taxes = calculate_taxes(item_data.model_dump())

        item = SaleItem(
            sale_id=sale.id,
            product_id=item_data.product_id,
            variant_id=item_data.variant_id,
            descripcion=item_data.descripcion,
            cantidad=item_data.cantidad,
            precio_unitario=item_data.precio_unitario,
            descuento_pct=item_data.descuento_pct,
            descuento_monto=taxes["descuento_monto"],
            iva_tasa=item_data.iva_tasa,
            iva_monto=taxes["iva_monto"],
            total=taxes["total"],
            costo_unitario=item_data.costo_unitario,
        )
        db.add(item)

        subtotal += taxes["subtotal_bruto"]
        descuento_total += taxes["descuento_monto"]
        iva_tasa = Decimal(str(item_data.iva_tasa))
        if iva_tasa == Decimal("10"):
            base_gravada_10 += taxes["base"]
            iva_10 += taxes["iva_monto"]
        elif iva_tasa == Decimal("5"):
            base_gravada_5 += taxes["base"]
            iva_5 += taxes["iva_monto"]
        else:
            base_exenta += taxes["base"]

    sale.subtotal = subtotal
    sale.descuento_total = descuento_total
    sale.base_gravada_10 = base_gravada_10
    sale.base_gravada_5 = base_gravada_5
    sale.base_exenta = base_exenta
    sale.iva_10 = iva_10
    sale.iva_5 = iva_5
    sale.total = subtotal + iva_10 + iva_5
    sale.saldo = sale.total

    for item_data in data.items:
        stock_result = await db.execute(
            select(Stock).where(Stock.product_id == item_data.product_id).limit(1)
        )
        stock = stock_result.scalar_one_or_none()
        if stock:
            qty = int(item_data.cantidad)
            stock.cantidad -= qty
            stock.updated_at = datetime.now(timezone.utc)

            movement = InventoryMovement(
                company_id=data.company_id,
                warehouse_id=stock.warehouse_id,
                product_id=item_data.product_id,
                variant_id=item_data.variant_id,
                tipo="salida_venta",
                cantidad=-qty,
                costo_unitario=item_data.costo_unitario,
                referencia_type="sale",
                referencia_id=sale.id,
                user_id=data.user_id,
            )
            db.add(movement)

    await db.flush()
    await db.refresh(sale)
    return sale


async def get_sale(db: AsyncSession, sale_id: str) -> Sale | None:
    result = await db.execute(select(Sale).where(Sale.id == uuid.UUID(sale_id)))
    return result.scalar_one_or_none()


async def list_sales(
    db: AsyncSession,
    company_id: str,
    customer_id: str | None = None,
    estado: str | None = None,
    fecha_desde: datetime | None = None,
    fecha_hasta: datetime | None = None,
    limit: int = 50,
    offset: int = 0,
) -> list[Sale]:
    query = select(Sale).where(Sale.company_id == company_id)
    if customer_id:
        query = query.where(Sale.customer_id == customer_id)
    if estado:
        query = query.where(Sale.estado == estado)
    if fecha_desde:
        query = query.where(Sale.fecha >= fecha_desde)
    if fecha_hasta:
        query = query.where(Sale.fecha <= fecha_hasta)
    query = query.order_by(Sale.fecha.desc()).limit(limit).offset(offset)
    result = await db.execute(query)
    return list(result.scalars().all())


async def get_sales_today(db: AsyncSession, company_id: str) -> dict:
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    result = await db.execute(
        select(Sale).where(
            Sale.company_id == company_id,
            Sale.fecha >= today_start,
            Sale.estado == "confirmado",
        )
    )
    sales = result.scalars().all()
    total_ventas = sum(int(s.total) for s in sales)
    total_iva = sum(int(s.iva_10) + int(s.iva_5) for s in sales)
    return {
        "cantidad": len(sales),
        "total_ventas": total_ventas,
        "total_iva": total_iva,
        "base_gravada_10": sum(int(s.base_gravada_10) for s in sales),
        "base_gravada_5": sum(int(s.base_gravada_5) for s in sales),
    }


async def create_cash_session(db: AsyncSession, data: CashSessionCreate) -> CashSession:
    session_obj = CashSession(**data.model_dump())
    db.add(session_obj)
    await db.flush()
    await db.refresh(session_obj)
    return session_obj


async def close_cash_session(db: AsyncSession, session_id: str, data: CashSessionClose) -> CashSession | None:
    result = await db.execute(select(CashSession).where(CashSession.id == uuid.UUID(session_id)))
    session_obj = result.scalar_one_or_none()
    if not session_obj or session_obj.estado != "abierta":
        return None

    sales_result = await db.execute(
        select(Sale).where(Sale.branch_id == session_obj.cash_register_id)
    )

    session_obj.fecha_cierre = datetime.now(timezone.utc)
    session_obj.monto_cierre_real = data.monto_cierre_real
    session_obj.observaciones_cierre = data.observaciones
    session_obj.estado = "cerrada"

    await db.flush()
    await db.refresh(session_obj)
    return session_obj
