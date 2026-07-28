"""Sales service"""

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime, timezone
from decimal import Decimal
import uuid

from api.src.sales.models import Sale, SaleItem
from api.src.caja.models import CashRegister, CashSession
from api.src.sales.schemas import SaleCreate, SaleUpdate, SaleAddPayment, CashSessionCreate, CashSessionClose
from api.src.inventory.models import Stock, StockLot, InventoryMovement
from api.src.customers.models import Customer
from api.src.products.models import Product


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

    if data.condicion == "credito" and data.customer_id:
        from api.src.credit_accounts.service import process_purchase
        credit_result = await process_purchase(
            db,
            str(data.company_id),
            str(data.customer_id),
            sale.total,
            sale.id,
        )
        if "error" in credit_result:
            raise ValueError(f"Credit account error: {credit_result['error']}")
        sale.estado = "confirmado"
        sale.total_pagado = sale.total
        sale.saldo = Decimal("0")

    for item_data in data.items:
        qty_to_deduct = int(item_data.cantidad)
        warehouse_id = None

        stock_result = await db.execute(
            select(Stock).where(Stock.product_id == item_data.product_id).limit(1)
        )
        stock = stock_result.scalar_one_or_none()
        if stock:
            stock.cantidad -= qty_to_deduct
            stock.updated_at = datetime.now(timezone.utc)
            warehouse_id = stock.warehouse_id

            lots_result = await db.execute(
                select(StockLot)
                .where(
                    StockLot.product_id == item_data.product_id,
                    StockLot.cantidad_disponible > 0,
                )
                .order_by(StockLot.fecha_ingreso.asc())
            )
            lots = list(lots_result.scalars().all())

            remaining = qty_to_deduct
            actual_cost = Decimal("0")
            for lot in lots:
                if remaining <= 0:
                    break
                deduct = min(remaining, int(lot.cantidad_disponible))
                lot.cantidad_disponible -= deduct
                lot.cantidad -= deduct
                actual_cost += Decimal(str(deduct)) * Decimal(str(lot.costo_unitario))

                lot_movement = InventoryMovement(
                    company_id=data.company_id,
                    warehouse_id=warehouse_id,
                    product_id=item_data.product_id,
                    variant_id=item_data.variant_id,
                    tipo="salida_venta_lote",
                    cantidad=-deduct,
                    costo_unitario=lot.costo_unitario,
                    referencia_type="sale",
                    referencia_id=sale.id,
                    user_id=data.user_id,
                )
                db.add(lot_movement)
                remaining -= deduct

            if remaining > 0:
                pass

            avg_cost = (actual_cost / Decimal(str(qty_to_deduct))).quantize(Decimal("1")) if qty_to_deduct > 0 else Decimal("0")

            movement = InventoryMovement(
                company_id=data.company_id,
                warehouse_id=warehouse_id,
                product_id=item_data.product_id,
                variant_id=item_data.variant_id,
                tipo="salida_venta",
                cantidad=-qty_to_deduct,
                costo_unitario=avg_cost,
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
    sale = result.scalar_one_or_none()
    if sale and sale.customer_id:
        cust_result = await db.execute(select(Customer).where(Customer.id == sale.customer_id))
        sale.customer = cust_result.scalar_one_or_none()
    elif sale:
        sale.customer = None
    return sale


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
    sales = list(result.scalars().all())

    # No hay relacion ORM customer<->sale (customer_id es un UUID suelto, sin
    # FK mapeada) — sin esto, SaleResponse.customer siempre queda None y el
    # frontend cae al fallback "Consumidor Final" para TODAS las ventas, aunque
    # el customer_id real este cargado (verificado: 99.998% de las ventas de
    # Casa Gonzalito tienen cliente real asignado).
    customer_ids = {s.customer_id for s in sales if s.customer_id}
    if customer_ids:
        cust_result = await db.execute(select(Customer).where(Customer.id.in_(customer_ids)))
        customers_by_id = {c.id: c for c in cust_result.scalars().all()}
        for s in sales:
            s.customer = customers_by_id.get(s.customer_id) if s.customer_id else None
    else:
        for s in sales:
            s.customer = None

    return sales


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


async def cancel_sale(db: AsyncSession, sale_id: str) -> Sale | None:
    sale = await get_sale(db, sale_id)
    if not sale:
        return None
    if sale.estado in ("cancelado", "devuelto"):
        return None

    sale.estado = "cancelado"
    sale.updated_at = datetime.now(timezone.utc)

    items_result = await db.execute(select(SaleItem).where(SaleItem.sale_id == sale.id))
    for item in items_result.scalars().all():
        stock_result = await db.execute(select(Stock).where(Stock.product_id == item.product_id).limit(1))
        stock = stock_result.scalar_one_or_none()
        if stock:
            qty = int(item.cantidad)
            stock.cantidad += qty
            stock.updated_at = datetime.now(timezone.utc)

            lots_result = await db.execute(
                select(StockLot)
                .where(
                    StockLot.product_id == item.product_id,
                    StockLot.warehouse_id == stock.warehouse_id,
                )
                .order_by(StockLot.fecha_ingreso.desc())
            )
            lots = list(lots_result.scalars().all())

            remaining = qty
            for lot in lots:
                if remaining <= 0:
                    break
                lot.cantidad_disponible += remaining
                lot.cantidad += remaining
                remaining = 0

    await db.flush()
    await db.refresh(sale)
    return sale


async def get_sale_items(db: AsyncSession, sale_id: str) -> list[dict]:
    result = await db.execute(select(SaleItem).where(SaleItem.sale_id == uuid.UUID(sale_id)))
    items = result.scalars().all()

    # Igual que con el cliente de la venta: no hay relacion ORM SaleItem->Product,
    # y "descripcion" quedo vacia en los items migrados/sincronizados desde el
    # legacy (nunca se cargo un texto libre, solo product_id) — sin esto el
    # modal de detalle no tenia forma de mostrar que producto era cada linea.
    product_ids = {i.product_id for i in items if i.product_id}
    products_by_id = {}
    if product_ids:
        prod_result = await db.execute(select(Product).where(Product.id.in_(product_ids)))
        products_by_id = {p.id: p for p in prod_result.scalars().all()}

    return [
        {
            "id": str(i.id),
            "sale_id": str(i.sale_id),
            "product_id": str(i.product_id),
            "descripcion": i.descripcion,
            "product": {
                "id": str(i.product_id),
                "nombre": products_by_id[i.product_id].nombre,
                "sku": products_by_id[i.product_id].sku,
            } if i.product_id in products_by_id else None,
            "cantidad": float(i.cantidad),
            "precio_unitario": int(i.precio_unitario),
            "descuento_pct": float(i.descuento_pct),
            "descuento_monto": int(i.descuento_monto),
            "iva_tasa": float(i.iva_tasa),
            "iva_monto": int(i.iva_monto),
            "total": int(i.total),
            "costo_unitario": int(i.costo_unitario) if i.costo_unitario else None,
            "created_at": i.created_at,
        }
        for i in items
    ]


async def update_sale(db: AsyncSession, sale_id: str, data: SaleUpdate) -> Sale | None:
    sale = await get_sale(db, sale_id)
    if not sale or sale.estado in ("cancelado", "devuelto", "completado"):
        return None

    if data.customer_id is not None:
        sale.customer_id = data.customer_id
    if data.observaciones is not None:
        sale.observaciones = data.observaciones
    if data.items is not None:
        existing = await db.execute(select(SaleItem).where(SaleItem.sale_id == sale.id))
        for item in existing.scalars().all():
            await db.delete(item)

        subtotal = descuento_total = base_gravada_10 = base_gravada_5 = base_exenta = iva_10 = iva_5 = Decimal("0")
        for item_data in data.items:
            taxes = calculate_taxes(item_data.model_dump())
            item = SaleItem(
                sale_id=sale.id, product_id=item_data.product_id, variant_id=item_data.variant_id,
                descripcion=item_data.descripcion, cantidad=item_data.cantidad,
                precio_unitario=item_data.precio_unitario, descuento_pct=item_data.descuento_pct,
                descuento_monto=taxes["descuento_monto"], iva_tasa=item_data.iva_tasa,
                iva_monto=taxes["iva_monto"], total=taxes["total"],
            )
            db.add(item)
            subtotal += taxes["subtotal_bruto"]; descuento_total += taxes["descuento_monto"]
            tasa = Decimal(str(item_data.iva_tasa))
            if tasa == Decimal("10"):
                base_gravada_10 += taxes["base"]; iva_10 += taxes["iva_monto"]
            elif tasa == Decimal("5"):
                base_gravada_5 += taxes["base"]; iva_5 += taxes["iva_monto"]
            else:
                base_exenta += taxes["base"]

        sale.subtotal = subtotal; sale.descuento_total = descuento_total
        sale.base_gravada_10 = base_gravada_10; sale.base_gravada_5 = base_gravada_5
        sale.base_exenta = base_exenta; sale.iva_10 = iva_10; sale.iva_5 = iva_5
        sale.total = subtotal + iva_10 + iva_5
        sale.saldo = sale.total - (sale.total_pagado or 0)

    sale.updated_at = datetime.now(timezone.utc)
    await db.flush()
    await db.refresh(sale)
    return sale


async def add_payment(db: AsyncSession, sale_id: str, data: SaleAddPayment) -> dict:
    sale = await get_sale(db, sale_id)
    if not sale:
        return {"error": "Venta no encontrada"}
    if sale.estado in ("cancelado", "devuelto"):
        return {"error": "Venta cancelada o devuelta"}

    from api.src.payments.models import Payment
    from api.src.payments.schemas import PaymentCreate

    payment = Payment(
        company_id=sale.company_id,
        tipo="cobro",
        payment_method_id=data.payment_method_id,
        moneda=sale.moneda,
        tipo_cambio=sale.tipo_cambio,
        monto=data.monto,
        monto_pyg=data.monto if sale.moneda == "PYG" else data.monto * sale.tipo_cambio,
        referencia=data.referencia,
        estado="confirmado",
        user_id=data.user_id,
    )
    db.add(payment)
    await db.flush()

    await db.execute(
        text("""
            INSERT INTO payment_allocations (payment_id, sale_id, monto_asignado)
            VALUES (:payment_id, :sale_id, :monto)
        """),
        {"payment_id": payment.id, "sale_id": sale.id, "monto": float(data.monto)},
    )

    sale.total_pagado = (sale.total_pagado or 0) + data.monto
    sale.saldo = sale.total - sale.total_pagado

    if sale.saldo <= 0:
        sale.estado = "pagado"
        sale.saldo = Decimal("0")

    if sale.condicion == "credito" and sale.saldo > 0:
        sale.estado = "parcial"

    sale.updated_at = datetime.now(timezone.utc)

    from api.src.accounts_receivable.service import apply_payment_to_receivable
    await apply_payment_to_receivable(db, str(sale.company_id), str(sale.id), data.monto)

    await db.flush()
    await db.refresh(sale)
    return {"sale": sale, "payment": payment}


async def link_quote(db: AsyncSession, sale_id: str, quote_id: str) -> bool:
    sale = await get_sale(db, sale_id)
    if not sale:
        return False
    from api.src.quotes.service import change_quote_status
    result = await change_quote_status(db, quote_id, "convertida", sale_id)
    return result is not None


async def link_order(db: AsyncSession, sale_id: str, order_id: str) -> bool:
    sale = await get_sale(db, sale_id)
    if not sale:
        return False
    from api.src.sales_orders.service import change_order_status
    result = await change_order_status(db, order_id, "facturado")
    return result is not None
