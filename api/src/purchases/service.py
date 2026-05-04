"""Purchases service"""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime, timezone
from decimal import Decimal
import uuid

from api.src.purchases.supplier_models import Supplier
from api.src.purchases.models import PurchaseOrder, PurchaseOrderItem, PurchaseReceipt, PurchaseReceiptItem
from api.src.purchases.schemas import SupplierCreate, SupplierUpdate, POCreate, ReceiptCreate
from api.src.inventory.models import Stock, InventoryMovement


async def create_supplier(db: AsyncSession, data: SupplierCreate) -> Supplier:
    supplier = Supplier(**data.model_dump())
    db.add(supplier)
    await db.flush()
    await db.refresh(supplier)
    return supplier


async def list_suppliers(db: AsyncSession, company_id: str, search: str | None = None) -> list[Supplier]:
    query = select(Supplier).where(Supplier.company_id == company_id, Supplier.activo == True)
    if search:
        query = query.where(
            (Supplier.razon_social.ilike(f"%{search}%")) |
            (Supplier.ruc.ilike(f"%{search}%"))
        )
    query = query.order_by(Supplier.razon_social)
    result = await db.execute(query)
    return list(result.scalars().all())


async def get_supplier(db: AsyncSession, supplier_id: str) -> Supplier | None:
    result = await db.execute(select(Supplier).where(Supplier.id == uuid.UUID(supplier_id)))
    return result.scalar_one_or_none()


async def generate_po_number(db: AsyncSession) -> str:
    date_part = datetime.now(timezone.utc).strftime("%Y%m%d")
    result = await db.execute(
        select(PurchaseOrder).order_by(PurchaseOrder.created_at.desc()).limit(1)
    )
    last = result.scalar_one_or_none()
    seq = int(last.numero.split("-")[-1]) + 1 if last else 1
    return f"OC-{date_part}-{seq:06d}"


async def create_purchase_order(db: AsyncSession, data: POCreate) -> PurchaseOrder:
    numero = await generate_po_number(db)
    subtotal = Decimal("0")
    descuento_total = Decimal("0")
    iva_10 = Decimal("0")
    iva_5 = Decimal("0")

    order = PurchaseOrder(
        company_id=data.company_id,
        supplier_id=data.supplier_id,
        numero=numero,
        fecha_entrega_estimada=data.fecha_entrega_estimada,
        moneda=data.moneda,
        tipo_cambio=data.tipo_cambio,
        observaciones=data.observaciones,
        user_id=data.user_id,
        estado="borrador",
    )
    db.add(order)
    await db.flush()

    for item_data in data.items:
        cantidad = item_data.cantidad
        precio = item_data.precio_unitario
        desc_pct = item_data.descuento_pct
        iva_tasa = item_data.iva_tasa or Decimal("10")

        subtotal_bruto = cantidad * precio
        descuento = subtotal_bruto * (desc_pct / Decimal("100"))
        base = subtotal_bruto - descuento

        if iva_tasa == Decimal("10"):
            iva_monto = (base * Decimal("0.10")).quantize(Decimal("1"), rounding="ROUND_HALF_UP")
            iva_10 += iva_monto
        elif iva_tasa == Decimal("5"):
            iva_monto = (base * Decimal("0.05")).quantize(Decimal("1"), rounding="ROUND_HALF_UP")
            iva_5 += iva_monto
        else:
            iva_monto = Decimal("0")

        total_item = base + iva_monto
        subtotal += subtotal_bruto
        descuento_total += descuento

        item = PurchaseOrderItem(
            purchase_order_id=order.id,
            product_id=item_data.product_id,
            variant_id=item_data.variant_id,
            descripcion=item_data.descripcion,
            cantidad=item_data.cantidad,
            precio_unitario=item_data.precio_unitario,
            descuento_pct=item_data.descuento_pct,
            iva_tasa=item_data.iva_tasa,
            total=total_item.quantize(Decimal("1")),
        )
        db.add(item)

    order.subtotal = subtotal.quantize(Decimal("1"))
    order.descuento_total = descuento_total.quantize(Decimal("1"))
    order.iva_10 = iva_10
    order.iva_5 = iva_5
    order.total = (subtotal + iva_10 + iva_5).quantize(Decimal("1"))

    await db.flush()
    await db.refresh(order)
    return order


async def confirm_purchase_order(db: AsyncSession, po_id: str) -> PurchaseOrder | None:
    result = await db.execute(select(PurchaseOrder).where(PurchaseOrder.id == uuid.UUID(po_id)))
    order = result.scalar_one_or_none()
    if not order or order.estado != "borrador":
        return None
    order.estado = "confirmado"
    await db.flush()
    await db.refresh(order)
    return order


async def list_purchase_orders(
    db: AsyncSession,
    company_id: str,
    supplier_id: str | None = None,
    estado: str | None = None,
) -> list[PurchaseOrder]:
    query = select(PurchaseOrder).where(PurchaseOrder.company_id == company_id)
    if supplier_id:
        query = query.where(PurchaseOrder.supplier_id == supplier_id)
    if estado:
        query = query.where(PurchaseOrder.estado == estado)
    query = query.order_by(PurchaseOrder.fecha.desc())
    result = await db.execute(query)
    return list(result.scalars().all())


async def generate_receipt_number(db: AsyncSession) -> str:
    date_part = datetime.now(timezone.utc).strftime("%Y%m%d")
    result = await db.execute(
        select(PurchaseReceipt).order_by(PurchaseReceipt.created_at.desc()).limit(1)
    )
    last = result.scalar_one_or_none()
    seq = int(last.numero.split("-")[-1]) + 1 if last else 1
    return f"REC-{date_part}-{seq:06d}"


async def create_receipt(db: AsyncSession, data: ReceiptCreate) -> PurchaseReceipt:
    numero = await generate_receipt_number(db)

    receipt = PurchaseReceipt(
        company_id=data.company_id,
        purchase_order_id=data.purchase_order_id,
        warehouse_id=data.warehouse_id,
        numero=numero,
        proveedor_ref=data.proveedor_ref,
        observaciones=data.observaciones,
        user_id=data.user_id,
    )
    db.add(receipt)
    await db.flush()

    for item_data in data.items:
        receipt_item = PurchaseReceiptItem(
            receipt_id=receipt.id,
            product_id=item_data.product_id,
            variant_id=item_data.variant_id,
            cantidad_ordenada=item_data.cantidad_ordenada,
            cantidad_recibida=item_data.cantidad_recibida,
            costo_unitario=item_data.costo_unitario,
            batch_id=item_data.batch_id,
        )
        db.add(receipt_item)

        stock = await db.execute(
            select(Stock).where(
                Stock.warehouse_id == data.warehouse_id,
                Stock.product_id == item_data.product_id,
            )
        )
        stock_obj = stock.scalar_one_or_none()
        qty = int(item_data.cantidad_recibida)
        cost = item_data.costo_unitario

        if not stock_obj:
            stock_obj = Stock(
                warehouse_id=data.warehouse_id,
                product_id=item_data.product_id,
                variant_id=item_data.variant_id,
                cantidad=0,
                costo_unitario=cost,
            )
            db.add(stock_obj)
            await db.flush()

        old_cost = stock_obj.costo_unitario or Decimal("0")
        old_qty = stock_obj.cantidad
        stock_obj.cantidad += qty
        if old_qty + qty > 0:
            stock_obj.costo_unitario = ((old_cost * old_qty + cost * qty) / (old_qty + qty)).quantize(Decimal("1"), rounding="ROUND_HALF_UP")
        stock_obj.updated_at = datetime.now(timezone.utc)

        movement = InventoryMovement(
            company_id=data.company_id,
            warehouse_id=data.warehouse_id,
            product_id=item_data.product_id,
            variant_id=item_data.variant_id,
            tipo="entrada_compra",
            cantidad=qty,
            costo_unitario=cost,
            referencia_type="purchase_receipt",
            referencia_id=receipt.id,
            user_id=data.user_id,
        )
        db.add(movement)

    if data.purchase_order_id:
        po_result = await db.execute(select(PurchaseOrder).where(PurchaseOrder.id == data.purchase_order_id))
        po = po_result.scalar_one_or_none()
        if po:
            for item_data in data.items:
                for po_item in po.items:
                    if po_item.product_id == item_data.product_id:
                        po_item.cantidad_recibida = (po_item.cantidad_recibida or 0) + item_data.cantidad_recibida
                        break

            all_received = all(
                (item.cantidad_recibida or 0) >= item.cantidad
                for item in po.items
            )
            po.estado = "completado" if all_received else "parcial"

    await db.flush()
    await db.refresh(receipt)
    return receipt


async def list_receipts(db: AsyncSession, company_id: str) -> list[PurchaseReceipt]:
    result = await db.execute(
        select(PurchaseReceipt)
        .where(PurchaseReceipt.company_id == company_id)
        .order_by(PurchaseReceipt.fecha.desc())
    )
    return list(result.scalars().all())
