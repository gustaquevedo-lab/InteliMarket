"""Purchases service — suppliers, orders, receipts, requisitions, forecasting, suggestions, budgets, reports"""

from sqlalchemy import select, text, case
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime, timezone, date
from decimal import Decimal
import uuid
import math

from api.src.purchases.models import (
    Supplier, PurchaseOrder, PurchaseOrderItem, PurchaseOrderHistory,
    PurchaseReceipt, PurchaseReceiptItem,
    PurchaseRequisition, PurchaseRequisitionItem,
    SupplierContract, SupplierContractItem,
    SupplierEvaluation, SupplierPriceHistory,
    ForecastRule, ForecastProjection,
    PurchaseSuggestion, PurchaseBudget,
)
from api.src.purchases.schemas import (
    SupplierCreate, SupplierUpdate,
    POCreate, POUpdate, POItemInput,
    ReceiptCreate,
    RequisitionCreate, RequisitionUpdate, RequisitionItemInput,
    ContractCreate, ContractUpdate, ContractItemInput,
    EvaluationCreate,
    ForecastRuleCreate, ForecastRuleUpdate,
    BudgetCreate, BudgetUpdate,
)
from api.src.inventory.models import Stock, StockLot, InventoryMovement


# ── Helpers ───────────────────────────────────────────────────────────────────

def calculate_taxes(precio: Decimal, cantidad: Decimal, descuento_pct: Decimal, iva_tasa: Decimal) -> dict:
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


async def generate_po_number(db: AsyncSession) -> str:
    date_part = datetime.now(timezone.utc).strftime("%Y%m%d")
    result = await db.execute(
        select(PurchaseOrder).order_by(PurchaseOrder.created_at.desc()).limit(1)
    )
    last = result.scalar_one_or_none()
    seq = int(last.numero.split("-")[-1]) + 1 if last else 1
    return f"OC-{date_part}-{seq:06d}"


async def generate_receipt_number(db: AsyncSession) -> str:
    date_part = datetime.now(timezone.utc).strftime("%Y%m%d")
    result = await db.execute(
        select(PurchaseReceipt).order_by(PurchaseReceipt.created_at.desc()).limit(1)
    )
    last = result.scalar_one_or_none()
    seq = int(last.numero.split("-")[-1]) + 1 if last else 1
    return f"REC-{date_part}-{seq:06d}"


async def generate_requisition_number(db: AsyncSession) -> str:
    date_part = datetime.now(timezone.utc).strftime("%Y%m%d")
    result = await db.execute(
        select(PurchaseRequisition).order_by(PurchaseRequisition.created_at.desc()).limit(1)
    )
    last = result.scalar_one_or_none()
    seq = int(last.numero.split("-")[-1]) + 1 if last else 1
    return f"REQ-{date_part}-{seq:06d}"


async def generate_contract_number(db: AsyncSession) -> str:
    date_part = datetime.now(timezone.utc).strftime("%Y%m%d")
    result = await db.execute(
        select(SupplierContract).order_by(SupplierContract.created_at.desc()).limit(1)
    )
    last = result.scalar_one_or_none()
    seq = int(last.numero.split("-")[-1]) + 1 if last else 1
    return f"CTR-{date_part}-{seq:06d}"


async def add_po_history(db: AsyncSession, po_id: str, estado_anterior: str, estado_nuevo: str,
                         cambiado_por: str | None = None, cambiado_por_nombre: str | None = None,
                         observaciones: str | None = None):
    entry = PurchaseOrderHistory(
        purchase_order_id=uuid.UUID(po_id),
        estado_anterior=estado_anterior,
        estado_nuevo=estado_nuevo,
        cambiado_por=uuid.UUID(cambiado_por) if cambiado_por else None,
        cambiado_por_nombre=cambiado_por_nombre,
        observaciones=observaciones,
    )
    db.add(entry)


# ── Suppliers ─────────────────────────────────────────────────────────────────

async def create_supplier(db: AsyncSession, data: SupplierCreate) -> Supplier:
    supplier = Supplier(**data.model_dump())
    db.add(supplier)
    await db.flush()
    await db.refresh(supplier)
    return supplier


async def list_suppliers(db: AsyncSession, company_id: str, search: str | None = None) -> list[Supplier]:
    query = select(Supplier).where(Supplier.company_id == uuid.UUID(company_id))
    if search:
        query = query.where(
            (Supplier.razon_social.ilike(f"%{search}%")) |
            (Supplier.ruc.ilike(f"%{search}%")) |
            (Supplier.contacto_nombre.ilike(f"%{search}%"))
        )
    query = query.order_by(Supplier.razon_social)
    result = await db.execute(query)
    return list(result.scalars().all())


async def get_supplier(db: AsyncSession, supplier_id: str) -> Supplier | None:
    result = await db.execute(select(Supplier).where(Supplier.id == uuid.UUID(supplier_id)))
    return result.scalar_one_or_none()


async def update_supplier(db: AsyncSession, supplier_id: str, data: SupplierUpdate) -> Supplier | None:
    supplier = await get_supplier(db, supplier_id)
    if not supplier:
        return None
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(supplier, key, value)
    await db.flush()
    await db.refresh(supplier)
    return supplier


# ── Purchase Orders ───────────────────────────────────────────────────────────

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
        estado="borrador",
        moneda=data.moneda,
        tipo_cambio=data.tipo_cambio,
        observaciones=data.observaciones,
        user_id=data.user_id,
        tipo_compra=data.tipo_compra,
        prioridad=data.prioridad,
        condiciones_pago=data.condiciones_pago,
        dias_validez=data.dias_validez,
        shipping_cost=data.shipping_cost,
        insurance_cost=data.insurance_cost,
        customs_cost=data.customs_cost,
        otros_costos=data.otros_costos,
        created_by_name=data.created_by_name,
        seguimiento_numero=data.seguimiento_numero,
    )
    db.add(order)
    await db.flush()

    for item_data in data.items:
        iva_tasa = item_data.iva_tasa or Decimal("10")
        taxes = calculate_taxes(
            item_data.precio_unitario,
            item_data.cantidad,
            item_data.descuento_pct,
            iva_tasa,
        )

        if iva_tasa == Decimal("10"):
            iva_10 += taxes["iva_monto"]
        elif iva_tasa == Decimal("5"):
            iva_5 += taxes["iva_monto"]

        subtotal += taxes["subtotal_bruto"]
        descuento_total += taxes["descuento_monto"]

        item = PurchaseOrderItem(
            purchase_order_id=order.id,
            product_id=item_data.product_id,
            variant_id=item_data.variant_id,
            descripcion=item_data.descripcion,
            cantidad=item_data.cantidad,
            precio_unitario=item_data.precio_unitario,
            descuento_pct=item_data.descuento_pct,
            iva_tasa=iva_tasa,
            total=taxes["total"],
            warehouse_id=item_data.warehouse_id,
            fecha_entrega_esperada=item_data.fecha_entrega_esperada,
        )
        db.add(item)

    shipping_total = data.shipping_cost + data.insurance_cost + data.customs_cost + data.otros_costos
    order.subtotal = subtotal.quantize(Decimal("1"))
    order.descuento_total = descuento_total.quantize(Decimal("1"))
    order.iva_10 = iva_10
    order.iva_5 = iva_5

    landed = shipping_total + subtotal - descuento_total
    order.costo_landed_total = landed.quantize(Decimal("1"))
    order.total = (landed + iva_10 + iva_5).quantize(Decimal("1"))

    await db.flush()
    await db.refresh(order)
    return order


async def list_purchase_orders(
    db: AsyncSession,
    company_id: str,
    supplier_id: str | None = None,
    estado: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> list[PurchaseOrder]:
    query = select(PurchaseOrder).options(selectinload(PurchaseOrder.supplier)).where(
        PurchaseOrder.company_id == uuid.UUID(company_id)
    )
    if supplier_id:
        query = query.where(PurchaseOrder.supplier_id == uuid.UUID(supplier_id))
    if estado:
        query = query.where(PurchaseOrder.estado == estado)
    # Sin limit/offset esto devolvia las 106.726 ordenes de Casa Gonzalito de
    # una sola vez.
    query = query.order_by(PurchaseOrder.fecha.desc()).limit(limit).offset(offset)
    result = await db.execute(query)
    return list(result.scalars().all())


async def get_purchase_order(db: AsyncSession, po_id: str) -> PurchaseOrder | None:
    result = await db.execute(select(PurchaseOrder).where(PurchaseOrder.id == uuid.UUID(po_id)))
    return result.scalar_one_or_none()


async def get_purchase_order_with_items(db: AsyncSession, po_id: str) -> PurchaseOrder | None:
    result = await db.execute(
        select(PurchaseOrder).options(selectinload(PurchaseOrder.supplier)).where(PurchaseOrder.id == uuid.UUID(po_id))
    )
    order = result.scalar_one_or_none()
    if order:
        items_result = await db.execute(
            select(PurchaseOrderItem).where(PurchaseOrderItem.purchase_order_id == order.id)
        )
        order.items = list(items_result.scalars().all())
    return order


async def update_purchase_order(db: AsyncSession, po_id: str, data: POUpdate) -> PurchaseOrder | None:
    order = await get_purchase_order(db, po_id)
    if not order or order.estado != "borrador":
        return None

    update_fields = data.model_dump(exclude_unset=True, exclude={"items"})
    for key, value in update_fields.items():
        setattr(order, key, value)

    if data.items is not None:
        existing = await db.execute(
            select(PurchaseOrderItem).where(PurchaseOrderItem.purchase_order_id == order.id)
        )
        for item in existing.scalars().all():
            await db.delete(item)

        subtotal = descuento_total = iva_10 = iva_5 = Decimal("0")
        for item_data in data.items:
            iva_tasa = item_data.iva_tasa or Decimal("10")
            taxes = calculate_taxes(item_data.precio_unitario, item_data.cantidad, item_data.descuento_pct, iva_tasa)
            if iva_tasa == Decimal("10"):
                iva_10 += taxes["iva_monto"]
            elif iva_tasa == Decimal("5"):
                iva_5 += taxes["iva_monto"]
            subtotal += taxes["subtotal_bruto"]
            descuento_total += taxes["descuento_monto"]

            item = PurchaseOrderItem(
                purchase_order_id=order.id,
                product_id=item_data.product_id,
                variant_id=item_data.variant_id,
                descripcion=item_data.descripcion,
                cantidad=item_data.cantidad,
                precio_unitario=item_data.precio_unitario,
                descuento_pct=item_data.descuento_pct,
                iva_tasa=iva_tasa,
                total=taxes["total"],
                warehouse_id=item_data.warehouse_id,
                fecha_entrega_esperada=item_data.fecha_entrega_esperada,
            )
            db.add(item)

        shipping = (order.shipping_cost or Decimal("0")) + (order.insurance_cost or Decimal("0")) + (order.customs_cost or Decimal("0")) + (order.otros_costos or Decimal("0"))
        order.subtotal = subtotal.quantize(Decimal("1"))
        order.descuento_total = descuento_total.quantize(Decimal("1"))
        order.iva_10 = iva_10
        order.iva_5 = iva_5
        landed = shipping + subtotal - descuento_total
        order.costo_landed_total = landed.quantize(Decimal("1"))
        order.total = (landed + iva_10 + iva_5).quantize(Decimal("1"))

    await db.flush()
    await db.refresh(order)
    return order


async def confirm_purchase_order(db: AsyncSession, po_id: str, user_id: str | None = None, user_name: str | None = None) -> PurchaseOrder | None:
    result = await db.execute(select(PurchaseOrder).where(PurchaseOrder.id == uuid.UUID(po_id)))
    order = result.scalar_one_or_none()
    if not order or order.estado != "borrador":
        return None

    items_result = await db.execute(select(PurchaseOrderItem).where(PurchaseOrderItem.purchase_order_id == order.id))
    items = list(items_result.scalars().all())
    if not items:
        return None

    old_estado = order.estado
    order.estado = "confirmado"
    await add_po_history(db, po_id, old_estado, "confirmado", user_id, user_name, "Orden confirmada")

    await db.flush()
    await db.refresh(order)
    return order


async def send_purchase_order(db: AsyncSession, po_id: str, seguimiento_numero: str | None = None,
                              user_id: str | None = None, user_name: str | None = None) -> PurchaseOrder | None:
    order = await get_purchase_order(db, po_id)
    if not order or order.estado not in ("confirmado",):
        return None

    old_estado = order.estado
    order.estado = "enviado"
    order.fecha_envio = datetime.now(timezone.utc)
    if seguimiento_numero:
        order.seguimiento_numero = seguimiento_numero
    await add_po_history(db, po_id, old_estado, "enviado", user_id, user_name, "Orden enviada al proveedor")

    await db.flush()
    await db.refresh(order)
    return order


async def cancel_purchase_order(db: AsyncSession, po_id: str, motivo: str | None = None,
                                user_id: str | None = None, user_name: str | None = None) -> PurchaseOrder | None:
    order = await get_purchase_order(db, po_id)
    if not order or order.estado in ("completado", "recibido", "cancelado"):
        return None

    old_estado = order.estado
    order.estado = "cancelado"
    order.rechazado_motivo = motivo
    await add_po_history(db, po_id, old_estado, "cancelado", user_id, user_name, motivo or "Orden cancelada")

    await db.flush()
    await db.refresh(order)
    return order


async def get_po_items(db: AsyncSession, po_id: str) -> list[PurchaseOrderItem]:
    result = await db.execute(
        select(PurchaseOrderItem).where(PurchaseOrderItem.purchase_order_id == uuid.UUID(po_id))
    )
    return list(result.scalars().all())


async def get_po_history(db: AsyncSession, po_id: str) -> list[PurchaseOrderHistory]:
    result = await db.execute(
        select(PurchaseOrderHistory)
        .where(PurchaseOrderHistory.purchase_order_id == uuid.UUID(po_id))
        .order_by(PurchaseOrderHistory.created_at.desc())
    )
    return list(result.scalars().all())


# ── Purchase Receipts ─────────────────────────────────────────────────────────

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
        cost = item_data.costo_unitario
        qty = int(item_data.cantidad_recibida)

        receipt_item = PurchaseReceiptItem(
            receipt_id=receipt.id,
            product_id=item_data.product_id,
            variant_id=item_data.variant_id,
            cantidad_ordenada=item_data.cantidad_ordenada,
            cantidad_recibida=item_data.cantidad_recibida,
            costo_unitario=cost,
            batch_id=item_data.batch_id,
        )
        db.add(receipt_item)

        stock_result = await db.execute(
            select(Stock).where(
                Stock.warehouse_id == data.warehouse_id,
                Stock.product_id == item_data.product_id,
            )
        )
        stock_obj = stock_result.scalar_one_or_none()

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

        stock_lot = StockLot(
            company_id=data.company_id,
            warehouse_id=data.warehouse_id,
            product_id=item_data.product_id,
            variant_id=item_data.variant_id,
            cantidad=qty,
            cantidad_disponible=qty,
            costo_unitario=cost,
            costo_total=cost * qty,
            referencia=receipt.numero,
        )
        db.add(stock_lot)

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
                await db.execute(
                    text("""
                        UPDATE purchase_order_items
                        SET cantidad_recibida = COALESCE(cantidad_recibida, 0) + :recibida
                        WHERE purchase_order_id = :po_id AND product_id = :product_id
                    """),
                    {
                        "recibida": float(item_data.cantidad_recibida),
                        "po_id": data.purchase_order_id,
                        "product_id": item_data.product_id,
                    }
                )

            items_result = await db.execute(
                select(PurchaseOrderItem).where(PurchaseOrderItem.purchase_order_id == data.purchase_order_id)
            )
            po_items = list(items_result.scalars().all())
            all_received = all(
                (item.cantidad_recibida or 0) >= item.cantidad
                for item in po_items
            )
            po.estado = "completado" if all_received else "parcial"

            if all_received and po.fecha_entrega_estimada:
                for item_data in data.items:
                    await db.execute(
                        text("""
                            UPDATE purchase_order_items
                            SET fecha_entrega_real = :hoy
                            WHERE purchase_order_id = :po_id AND product_id = :product_id
                        """),
                        {
                            "hoy": date.today(),
                            "po_id": data.purchase_order_id,
                            "product_id": item_data.product_id,
                        }
                    )

    await db.flush()
    await db.refresh(receipt)
    return receipt


async def list_receipts(db: AsyncSession, company_id: str) -> list[PurchaseReceipt]:
    result = await db.execute(
        select(PurchaseReceipt)
        .where(PurchaseReceipt.company_id == uuid.UUID(company_id))
        .order_by(PurchaseReceipt.fecha.desc())
    )
    return list(result.scalars().all())


async def get_receipt(db: AsyncSession, receipt_id: str) -> PurchaseReceipt | None:
    result = await db.execute(select(PurchaseReceipt).where(PurchaseReceipt.id == uuid.UUID(receipt_id)))
    return result.scalar_one_or_none()


async def get_receipt_items(db: AsyncSession, receipt_id: str) -> list[PurchaseReceiptItem]:
    result = await db.execute(
        select(PurchaseReceiptItem).where(PurchaseReceiptItem.receipt_id == uuid.UUID(receipt_id))
    )
    return list(result.scalars().all())


# ── Requisitions ──────────────────────────────────────────────────────────────

async def create_requisition(db: AsyncSession, data: RequisitionCreate) -> PurchaseRequisition:
    numero = await generate_requisition_number(db)
    subtotal = Decimal("0")

    req = PurchaseRequisition(
        company_id=data.company_id,
        numero=numero,
        estado="borrador",
        fecha_necesidad=data.fecha_necesidad,
        departamento=data.departamento,
        solicitante_id=data.solicitante_id,
        solicitante_nombre=data.solicitante_nombre,
        prioridad=data.prioridad,
        moneda=data.moneda,
        motivo=data.motivo,
        observaciones=data.observaciones,
        user_id=data.user_id,
    )
    db.add(req)
    await db.flush()

    for item_data in data.items:
        total_est = (item_data.precio_estimado or Decimal("0")) * item_data.cantidad_solicitada
        subtotal += total_est

        item = PurchaseRequisitionItem(
            requisition_id=req.id,
            product_id=item_data.product_id,
            variant_id=item_data.variant_id,
            descripcion=item_data.descripcion,
            cantidad_solicitada=item_data.cantidad_solicitada,
            precio_estimado=item_data.precio_estimado,
            total_estimado=total_est.quantize(Decimal("1")),
            observaciones=item_data.observaciones,
        )
        db.add(item)

    req.subtotal = subtotal.quantize(Decimal("1"))
    req.total = subtotal.quantize(Decimal("1"))

    await db.flush()
    await db.refresh(req)
    return req


async def list_requisitions(db: AsyncSession, company_id: str, estado: str | None = None) -> list[PurchaseRequisition]:
    query = select(PurchaseRequisition).where(PurchaseRequisition.company_id == uuid.UUID(company_id))
    if estado:
        query = query.where(PurchaseRequisition.estado == estado)
    query = query.order_by(PurchaseRequisition.fecha.desc())
    result = await db.execute(query)
    return list(result.scalars().all())


async def get_requisition(db: AsyncSession, req_id: str) -> PurchaseRequisition | None:
    result = await db.execute(select(PurchaseRequisition).where(PurchaseRequisition.id == uuid.UUID(req_id)))
    req = result.scalar_one_or_none()
    if req:
        items_result = await db.execute(
            select(PurchaseRequisitionItem).where(PurchaseRequisitionItem.requisition_id == req.id)
        )
        req.items = list(items_result.scalars().all())
    return req


async def update_requisition(db: AsyncSession, req_id: str, data: RequisitionUpdate) -> PurchaseRequisition | None:
    req = await get_requisition(db, req_id)
    if not req or req.estado not in ("borrador",):
        return None

    update_fields = data.model_dump(exclude_unset=True, exclude={"items"})
    for key, value in update_fields.items():
        setattr(req, key, value)

    if data.items is not None:
        existing = await db.execute(
            select(PurchaseRequisitionItem).where(PurchaseRequisitionItem.requisition_id == req.id)
        )
        for item in existing.scalars().all():
            await db.delete(item)

        subtotal = Decimal("0")
        for item_data in data.items:
            total_est = (item_data.precio_estimado or Decimal("0")) * item_data.cantidad_solicitada
            subtotal += total_est
            item = PurchaseRequisitionItem(
                requisition_id=req.id,
                product_id=item_data.product_id,
                variant_id=item_data.variant_id,
                descripcion=item_data.descripcion,
                cantidad_solicitada=item_data.cantidad_solicitada,
                precio_estimado=item_data.precio_estimado,
                total_estimado=total_est.quantize(Decimal("1")),
                observaciones=item_data.observaciones,
            )
            db.add(item)

        req.subtotal = subtotal.quantize(Decimal("1"))
        req.total = subtotal.quantize(Decimal("1"))

    await db.flush()
    await db.refresh(req)
    return req


async def approve_requisition(db: AsyncSession, req_id: str, aprobado_por: str | None = None) -> PurchaseRequisition | None:
    req = await get_requisition(db, req_id)
    if not req or req.estado not in ("borrador", "pendiente"):
        return None

    req.estado = "aprobado"
    req.aprobado_por = uuid.UUID(aprobado_por) if aprobado_por else None
    req.fecha_aprobacion = datetime.now(timezone.utc)

    for item in req.items:
        item.cantidad_aprobada = item.cantidad_solicitada

    await db.flush()
    await db.refresh(req)
    return req


async def reject_requisition(db: AsyncSession, req_id: str, motivo: str | None = None) -> PurchaseRequisition | None:
    req = await get_requisition(db, req_id)
    if not req or req.estado not in ("borrador", "pendiente"):
        return None

    req.estado = "rechazado"
    req.rechazado_motivo = motivo
    await db.flush()
    await db.refresh(req)
    return req


async def convert_requisition_to_po(db: AsyncSession, req_id: str, user_id: str | None = None,
                                    user_name: str | None = None,
                                    supplier_id: str | None = None) -> PurchaseOrder | None:
    req = await get_requisition(db, req_id)
    if not req or req.estado != "aprobado":
        return None

    from api.src.products.models import Product
    product_ids = [item.product_id for item in req.items]
    products_result = await db.execute(
        select(Product).where(Product.id.in_(product_ids))
    )
    products = {str(p.id): p for p in products_result.scalars().all()}

    if not supplier_id:
        first_item = req.items[0] if req.items else None
        if first_item:
            pref = await db.execute(
                text("""
                    SELECT proveedor_preferido_id FROM forecast_rules
                    WHERE company_id = :cid AND product_id = :pid AND activo = true
                    LIMIT 1
                """),
                {"cid": req.company_id, "pid": first_item.product_id},
            )
            row = pref.fetchone()
            if row and row[0]:
                supplier_id = str(row[0])

        if not supplier_id:
            last_po = await db.execute(
                text("""
                    SELECT po.supplier_id FROM purchase_order_items poi
                    JOIN purchase_orders po ON po.id = poi.purchase_order_id
                    WHERE poi.product_id = :pid AND po.company_id = :cid
                    ORDER BY po.fecha DESC LIMIT 1
                """),
                {"pid": req.items[0].product_id, "cid": req.company_id},
            )
            row = last_po.fetchone()
            if row:
                supplier_id = str(row[0])

    if not supplier_id:
        return None

    supplier_uuid = uuid.UUID(supplier_id)

    numero = await generate_po_number(db)
    subtotal = descuento_total = iva_10 = iva_5 = Decimal("0")

    order = PurchaseOrder(
        company_id=req.company_id,
        supplier_id=supplier_uuid,
        numero=numero,
        estado="borrador",
        moneda=req.moneda or "PYG",
        tipo_cambio=Decimal("1"),
        observaciones=f"Generado desde requisición {req.numero}",
        user_id=user_id,
        prioridad=req.prioridad or "normal",
        created_by_name=user_name,
    )
    db.add(order)
    await db.flush()

    for req_item in req.items:
        prod = products.get(str(req_item.product_id))
        precio = req_item.precio_estimado or Decimal("0")
        cantidad = req_item.cantidad_aprobada or req_item.cantidad_solicitada
        iva_tasa = Decimal(str(prod.iva_tasa)) if prod else Decimal("10")

        taxes = calculate_taxes(precio, cantidad, Decimal("0"), iva_tasa)
        if iva_tasa == Decimal("10"):
            iva_10 += taxes["iva_monto"]
        elif iva_tasa == Decimal("5"):
            iva_5 += taxes["iva_monto"]
        subtotal += taxes["subtotal_bruto"]

        item = PurchaseOrderItem(
            purchase_order_id=order.id,
            product_id=req_item.product_id,
            variant_id=req_item.variant_id,
            descripcion=req_item.descripcion,
            cantidad=cantidad,
            precio_unitario=precio,
            descuento_pct=Decimal("0"),
            iva_tasa=iva_tasa,
            total=taxes["total"],
        )
        db.add(item)

    order.subtotal = subtotal.quantize(Decimal("1"))
    order.descuento_total = Decimal("0")
    order.iva_10 = iva_10
    order.iva_5 = iva_5
    order.total = (subtotal + iva_10 + iva_5).quantize(Decimal("1"))

    req.estado = "convertido"
    req.purchase_order_id = order.id

    await add_po_history(db, str(order.id), "borrador", "borrador", user_id, user_name,
                         f"Generado desde requisición {req.numero}")

    await db.flush()
    await db.refresh(order)
    return order


# ── Forecasting ───────────────────────────────────────────────────────────────

async def create_forecast_rule(db: AsyncSession, data: ForecastRuleCreate) -> ForecastRule:
    rule = ForecastRule(**data.model_dump())
    db.add(rule)
    await db.flush()
    await db.refresh(rule)
    return rule


async def list_forecast_rules(db: AsyncSession, company_id: str) -> list[ForecastRule]:
    result = await db.execute(
        select(ForecastRule)
        .where(ForecastRule.company_id == uuid.UUID(company_id))
        .order_by(ForecastRule.nombre)
    )
    return list(result.scalars().all())


async def update_forecast_rule(db: AsyncSession, rule_id: str, data: ForecastRuleUpdate) -> ForecastRule | None:
    result = await db.execute(select(ForecastRule).where(ForecastRule.id == uuid.UUID(rule_id)))
    rule = result.scalar_one_or_none()
    if not rule:
        return None
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(rule, key, value)
    await db.flush()
    await db.refresh(rule)
    return rule


async def delete_forecast_rule(db: AsyncSession, rule_id: str) -> bool:
    result = await db.execute(select(ForecastRule).where(ForecastRule.id == uuid.UUID(rule_id)))
    rule = result.scalar_one_or_none()
    if not rule:
        return False
    await db.delete(rule)
    await db.flush()
    return True


async def run_forecast(db: AsyncSession, rule_id: str) -> dict:
    result = await db.execute(select(ForecastRule).where(ForecastRule.id == uuid.UUID(rule_id)))
    rule = result.scalar_one_or_none()
    if not rule:
        return {"error": "Regla no encontrada"}

    company_id = rule.company_id
    product_id_filter = rule.product_id
    days_history = rule.dias_historial or 90
    days_projection = rule.dias_proyeccion or 30
    projection_count = 0

    if product_id_filter:
        product_ids = [product_id_filter]
    elif rule.categoria_id:
        cat_result = await db.execute(
            text("SELECT id FROM products WHERE company_id = :cid AND category_id = :cat"),
            {"cid": company_id, "cat": rule.categoria_id},
        )
        product_ids = [r[0] for r in cat_result.fetchall()]
    else:
        return {"error": "La regla debe tener un producto o categoría asignada"}

    for pid in product_ids:
        sales_result = await db.execute(
            text("""
                SELECT DATE(s.fecha) as dia, SUM(si.cantidad) as total_qty
                FROM sales s
                JOIN sale_items si ON si.sale_id = s.id
                WHERE s.company_id = :cid
                  AND si.product_id = :pid
                  AND s.estado IN ('confirmado', 'completado', 'pagado')
                  AND s.fecha >= NOW() - INTERVAL :days DAY
                GROUP BY DATE(s.fecha)
                ORDER BY dia
            """),
            {"cid": company_id, "pid": pid, "days": days_history},
        )
        daily_sales = sales_result.fetchall()

        if not daily_sales:
            continue

        total_qty = sum(float(r[1]) for r in daily_sales)
        avg_daily = total_qty / max(len(daily_sales), 1)

        confidence = min(Decimal(str(min(len(daily_sales) / days_history * 100, 99))).quantize(Decimal("0.1")), Decimal("99.0"))

        for d in range(1, days_projection + 1):
            proj_date = date.today().replace(day=1) + __import__('datetime').timedelta(days=d)
            proj = ForecastProjection(
                company_id=company_id,
                rule_id=rule.id,
                product_id=pid,
                fecha_proyeccion=proj_date,
                demanda_pronosticada=Decimal(str(round(avg_daily))),
                confianza=confidence,
            )
            db.add(proj)
            projection_count += 1

    rule.ultima_ejecucion = datetime.now(timezone.utc)
    await db.flush()
    return {"message": "Forecast ejecutado", "projections_created": projection_count}


# ── Purchase Suggestions ──────────────────────────────────────────────────────

async def generate_purchase_suggestions(db: AsyncSession, company_id: str) -> dict:
    rules_result = await db.execute(
        select(ForecastRule).where(
            ForecastRule.company_id == uuid.UUID(company_id),
            ForecastRule.activo == True,
        )
    )
    rules = list(rules_result.scalars().all())

    if not rules:
        return {"message": "No hay reglas de forecast activas", "suggestions": 0}

    suggestions_created = 0

    for rule in rules:
        product_ids = []
        if rule.product_id:
            product_ids = [rule.product_id]
        elif rule.categoria_id:
            cat_result = await db.execute(
                text("SELECT id FROM products WHERE company_id = :cid AND category_id = :cat AND activo = true"),
                {"cid": company_id, "cat": rule.categoria_id},
            )
            product_ids = [r[0] for r in cat_result.fetchall()]
        else:
            continue

        for pid in product_ids:
            days_history = rule.dias_historial or 90
            lead_time = rule.lead_time_dias or 7
            safety_stock_days = rule.stock_seguridad_dias or 7
            service_level = float(rule.nivel_servicio or 95)
            multiple = float(rule.multiplo_pedido or 1)
            min_order = float(rule.minimo_pedido or 0)
            max_order = float(rule.maximo_pedido or 999999)
            preferred_supplier = rule.proveedor_preferido_id

            sales_result = await db.execute(
                text("""
                    SELECT DATE(s.fecha) as dia, SUM(si.cantidad) as total_qty
                    FROM sales s
                    JOIN sale_items si ON si.sale_id = s.id
                    WHERE s.company_id = :cid
                      AND si.product_id = :pid
                      AND s.estado IN ('confirmado', 'completado', 'pagado')
                      AND s.fecha >= NOW() - INTERVAL :days DAY
                    GROUP BY DATE(s.fecha)
                """),
                {"cid": company_id, "pid": pid, "days": days_history},
            )
            daily_sales = sales_result.fetchall()

            total_qty = sum(float(r[1]) for r in daily_sales)
            days_with_data = len(daily_sales)
            if days_with_data == 0:
                continue

            daily_avg = Decimal(str(total_qty / days_with_data))

            stock_result = await db.execute(
                select(Stock).where(Stock.product_id == pid)
            )
            stocks = list(stock_result.scalars().all())
            current_stock = Decimal(str(sum(int(s.cantidad) for s in stocks)))

            z_factor = Decimal("1.645")
            if service_level >= 99:
                z_factor = Decimal("2.33")
            elif service_level >= 97:
                z_factor = Decimal("1.88")
            elif service_level >= 95:
                z_factor = Decimal("1.645")
            elif service_level >= 90:
                z_factor = Decimal("1.28")

            safety_stock = (daily_avg * Decimal(str(lead_time)) * z_factor / Decimal("2")).quantize(Decimal("1"), rounding="ROUND_HALF_UP")
            reorder_point = safety_stock + (daily_avg * Decimal(str(lead_time))).quantize(Decimal("1"), rounding="ROUND_HALF_UP")

            if current_stock >= reorder_point:
                continue

            suggested_qty = (reorder_point - current_stock).quantize(Decimal("1"), rounding="ROUND_HALF_UP")

            if multiple > 1:
                rounded = math.ceil(float(suggested_qty) / multiple) * multiple
                suggested_qty = Decimal(str(rounded))

            if min_order > 0 and suggested_qty < Decimal(str(min_order)):
                suggested_qty = Decimal(str(min_order))

            if max_order > 0 and suggested_qty > Decimal(str(max_order)):
                suggested_qty = Decimal(str(max_order))

            coverage_days = int(current_stock / daily_avg) if daily_avg > 0 else 0
            if coverage_days < lead_time:
                urgency = "alta"
            elif coverage_days < lead_time * 2:
                urgency = "media"
            else:
                urgency = "baja"

            data_quality = days_with_data / days_history
            confidence = min(Decimal(str(round(data_quality * 100, 1))), Decimal("99.0"))

            prod_result = await db.execute(
                text("SELECT nombre FROM products WHERE id = :pid"),
                {"pid": pid},
            )
            prod_name = prod_result.scalar()

            motivo = "stock_minimo"
            if urgency == "alta":
                motivo = "urgencia"
            elif current_stock <= safety_stock:
                motivo = "stock_seguridad"
            elif current_stock <= reorder_point:
                motivo = "punto_reorden"

            detalle = f"Stock actual: {current_stock}, Punto reorden: {reorder_point}, Stock seguridad: {safety_stock}, Demanda diaria: {daily_avg}"

            supplier_id = preferred_supplier
            if not supplier_id:
                last_supp = await db.execute(
                    text("""
                        SELECT po.supplier_id FROM purchase_order_items poi
                        JOIN purchase_orders po ON po.id = poi.purchase_order_id
                        WHERE poi.product_id = :pid AND po.company_id = :cid
                        ORDER BY po.fecha DESC LIMIT 1
                    """),
                    {"pid": pid, "cid": company_id},
                )
                row = last_supp.fetchone()
                if row:
                    supplier_id = row[0]

            price_est = None
            if supplier_id:
                price_result = await db.execute(
                    text("""
                        SELECT precio FROM supplier_price_history
                        WHERE supplier_id = :sid AND product_id = :pid
                        ORDER BY fecha DESC LIMIT 1
                    """),
                    {"sid": supplier_id, "pid": pid},
                )
                price_row = price_result.fetchone()
                if price_row:
                    price_est = Decimal(str(price_row[0]))

                if not price_est:
                    po_price = await db.execute(
                        text("""
                            SELECT poi.precio_unitario FROM purchase_order_items poi
                            JOIN purchase_orders po ON po.id = poi.purchase_order_id
                            WHERE po.supplier_id = :sid AND poi.product_id = :pid
                            ORDER BY po.fecha DESC LIMIT 1
                        """),
                        {"sid": supplier_id, "pid": pid},
                    )
                    price_row = po_price.fetchone()
                    if price_row:
                        price_est = Decimal(str(price_row[0]))

            total_est = (price_est * suggested_qty).quantize(Decimal("1")) if price_est else None

            suggestion = PurchaseSuggestion(
                company_id=uuid.UUID(company_id),
                product_id=pid,
                supplier_id=supplier_id,
                cantidad_sugerida=suggested_qty,
                precio_estimado=price_est,
                total_estimado=total_est,
                moneda="PYG",
                motivo=motivo,
                detalle=detalle,
                urgencia=urgency,
                confianza=confidence,
                stock_actual=current_stock,
                stock_seguridad=safety_stock,
                demanda_diaria_promedio=daily_avg,
                dias_cobertura=coverage_days,
                lead_time_dias=lead_time,
                estado="pendiente",
            )
            db.add(suggestion)
            suggestions_created += 1

    await db.flush()
    return {"message": "Sugerencias generadas", "suggestions": suggestions_created}


async def list_suggestions(db: AsyncSession, company_id: str, estado: str | None = None) -> list[PurchaseSuggestion]:
    query = select(PurchaseSuggestion).where(PurchaseSuggestion.company_id == uuid.UUID(company_id))
    if estado:
        query = query.where(PurchaseSuggestion.estado == estado)
    query = query.order_by(
        case(
            (PurchaseSuggestion.urgencia == "alta", 1),
            (PurchaseSuggestion.urgencia == "media", 2),
            (PurchaseSuggestion.urgencia == "baja", 3),
            else_=4,
        ),
        PurchaseSuggestion.created_at.desc(),
    )
    result = await db.execute(query)
    return list(result.scalars().all())


async def apply_suggestion(db: AsyncSession, suggestion_id: str, user_id: str | None = None,
                           user_name: str | None = None) -> PurchaseOrder | None:
    result = await db.execute(select(PurchaseSuggestion).where(PurchaseSuggestion.id == uuid.UUID(suggestion_id)))
    suggestion = result.scalar_one_or_none()
    if not suggestion or suggestion.estado != "pendiente":
        return None

    prod_result = await db.execute(
        text("SELECT nombre, iva_tasa FROM products WHERE id = :pid"),
        {"pid": suggestion.product_id},
    )
    product = prod_result.fetchone()
    if not product:
        return None

    from api.src.purchases.schemas import POCreate
    po_data = POCreate(
        company_id=suggestion.company_id,
        supplier_id=suggestion.supplier_id or uuid.UUID(int=0),
        moneda="PYG",
        items=[],
        observaciones=f"Generado desde sugerencia de compra #{suggestion.id}",
        user_id=uuid.UUID(user_id) if user_id else None,
    )

    numero = await generate_po_number(db)
    iva_tasa = Decimal(str(product[1])) if product[1] else Decimal("10")
    taxes = calculate_taxes(
        suggestion.precio_estimado or Decimal("0"),
        suggestion.cantidad_sugerida,
        Decimal("0"),
        iva_tasa,
    )

    order = PurchaseOrder(
        company_id=suggestion.company_id,
        supplier_id=suggestion.supplier_id or uuid.UUID(int=0),
        numero=numero,
        estado="borrador",
        moneda="PYG",
        tipo_cambio=Decimal("1"),
        observaciones=f"Generado desde sugerencia de compra",
        user_id=uuid.UUID(user_id) if user_id else None,
        created_by_name=user_name,
        sugerencia_id=suggestion.id,
    )
    db.add(order)
    await db.flush()

    item = PurchaseOrderItem(
        purchase_order_id=order.id,
        product_id=suggestion.product_id,
        variant_id=suggestion.variant_id,
        descripcion=product[0],
        cantidad=suggestion.cantidad_sugerida,
        precio_unitario=suggestion.precio_estimado or Decimal("0"),
        descuento_pct=Decimal("0"),
        iva_tasa=iva_tasa,
        total=taxes["total"],
    )
    db.add(item)

    order.subtotal = taxes["subtotal_bruto"].quantize(Decimal("1"))
    order.descuento_total = Decimal("0")
    iva_amt = taxes["iva_monto"] if iva_tasa in (Decimal("5"), Decimal("10")) else Decimal("0")
    if iva_tasa == Decimal("10"):
        order.iva_10 = iva_amt
    elif iva_tasa == Decimal("5"):
        order.iva_5 = iva_amt
    order.total = (order.subtotal + iva_amt).quantize(Decimal("1"))

    suggestion.estado = "aplicado"
    suggestion.purchase_order_id = order.id

    await add_po_history(db, str(order.id), "borrador", "borrador", user_id, user_name,
                         "Generado automáticamente desde sugerencia de compra")

    await db.flush()
    await db.refresh(order)
    return order


async def dismiss_suggestion(db: AsyncSession, suggestion_id: str) -> PurchaseSuggestion | None:
    result = await db.execute(select(PurchaseSuggestion).where(PurchaseSuggestion.id == uuid.UUID(suggestion_id)))
    suggestion = result.scalar_one_or_none()
    if not suggestion or suggestion.estado != "pendiente":
        return None
    suggestion.estado = "descartado"
    await db.flush()
    await db.refresh(suggestion)
    return suggestion


# ── Supplier Intelligence ─────────────────────────────────────────────────────

async def evaluate_supplier(db: AsyncSession, data: EvaluationCreate) -> SupplierEvaluation:
    scores = []
    if data.puntaje_calidad is not None:
        scores.append(float(data.puntaje_calidad))
    if data.puntaje_entrega is not None:
        scores.append(float(data.puntaje_entrega))
    if data.puntaje_precio is not None:
        scores.append(float(data.puntaje_precio))
    if data.puntaje_atencion is not None:
        scores.append(float(data.puntaje_atencion))

    puntaje_total = Decimal(str(round(sum(scores) / len(scores), 1))) if scores else Decimal("0")

    evaluation = SupplierEvaluation(
        company_id=data.company_id,
        supplier_id=data.supplier_id,
        periodo=data.periodo,
        puntaje_calidad=data.puntaje_calidad,
        puntaje_entrega=data.puntaje_entrega,
        puntaje_precio=data.puntaje_precio,
        puntaje_atencion=data.puntaje_atencion,
        puntaje_total=puntaje_total,
        ordenes_completadas=data.ordenes_completadas,
        ordenes_totales=data.ordenes_totales,
        entregas_a_tiempo=data.entregas_a_tiempo,
        entregas_totales=data.entregas_totales,
        comentarios=data.comentarios,
        user_id=data.user_id,
    )
    db.add(evaluation)
    await db.flush()
    await db.refresh(evaluation)
    return evaluation


async def get_supplier_evaluations(db: AsyncSession, supplier_id: str) -> list[SupplierEvaluation]:
    result = await db.execute(
        select(SupplierEvaluation)
        .where(SupplierEvaluation.supplier_id == uuid.UUID(supplier_id))
        .order_by(SupplierEvaluation.fecha.desc())
    )
    return list(result.scalars().all())


async def get_supplier_price_history(db: AsyncSession, supplier_id: str, product_id: str | None = None) -> list[SupplierPriceHistory]:
    query = select(SupplierPriceHistory).where(SupplierPriceHistory.supplier_id == uuid.UUID(supplier_id))
    if product_id:
        query = query.where(SupplierPriceHistory.product_id == uuid.UUID(product_id))
    query = query.order_by(SupplierPriceHistory.fecha.desc())
    result = await db.execute(query)
    return list(result.scalars().all())


async def get_supplier_performance(db: AsyncSession, supplier_id: str) -> dict:
    supplier = await get_supplier(db, supplier_id)
    if not supplier:
        return {"error": "Proveedor no encontrado"}

    evals_result = await db.execute(
        select(SupplierEvaluation)
        .where(SupplierEvaluation.supplier_id == uuid.UUID(supplier_id))
        .order_by(SupplierEvaluation.fecha.desc())
    )
    evaluations = list(evals_result.scalars().all())

    orders_result = await db.execute(
        select(PurchaseOrder).where(PurchaseOrder.supplier_id == uuid.UUID(supplier_id))
    )
    orders = list(orders_result.scalars().all())

    total_orders = len(orders)
    total_spent = sum(int(o.total or 0) for o in orders)
    completed = sum(1 for o in orders if o.estado in ("completado", "recibido"))
    on_time = sum(1 for o in orders if o.fecha_envio and o.fecha_entrega_estimada and o.fecha_envio.date() <= o.fecha_entrega_estimada)

    if evaluations:
        avg_quality = sum(float(e.puntaje_calidad or 0) for e in evaluations) / len(evaluations)
        avg_delivery = sum(float(e.puntaje_entrega or 0) for e in evaluations) / len(evaluations)
        avg_price = sum(float(e.puntaje_precio or 0) for e in evaluations) / len(evaluations)
        avg_attention = sum(float(e.puntaje_atencion or 0) for e in evaluations) / len(evaluations)
        overall = sum(float(e.puntaje_total or 0) for e in evaluations) / len(evaluations)
        last_eval = evaluations[0].fecha
    else:
        avg_quality = avg_delivery = avg_price = avg_attention = overall = 0
        last_eval = None

    on_time_rate = Decimal(str(round(on_time / completed * 100, 1))) if completed > 0 else None

    return {
        "supplier_id": supplier_id,
        "razon_social": supplier.razon_social,
        "total_orders": total_orders,
        "total_spent": Decimal(str(total_spent)),
        "on_time_rate": on_time_rate,
        "avg_quality_score": Decimal(str(round(avg_quality, 1))) if evaluations else None,
        "avg_delivery_score": Decimal(str(round(avg_delivery, 1))) if evaluations else None,
        "avg_price_score": Decimal(str(round(avg_price, 1))) if evaluations else None,
        "avg_attention_score": Decimal(str(round(avg_attention, 1))) if evaluations else None,
        "overall_rating": Decimal(str(round(overall, 1))) if evaluations else None,
        "last_evaluation_date": last_eval,
    }


# ── Supplier Contracts ────────────────────────────────────────────────────────

async def create_supplier_contract(db: AsyncSession, data: ContractCreate) -> SupplierContract:
    numero = await generate_contract_number(db)

    contract = SupplierContract(
        company_id=data.company_id,
        supplier_id=data.supplier_id,
        numero=numero,
        nombre=data.nombre,
        fecha_inicio=data.fecha_inicio,
        fecha_fin=data.fecha_fin,
        moneda=data.moneda,
        tipo_cambio_fijo=data.tipo_cambio_fijo,
        condiciones_pago=data.condiciones_pago,
        plazo_entrega_dias=data.plazo_entrega_dias,
        monto_minimo_mensual=data.monto_minimo_mensual,
        monto_maximo_mensual=data.monto_maximo_mensual,
        observaciones=data.observaciones,
        user_id=data.user_id,
    )
    db.add(contract)
    await db.flush()

    for item_data in data.items:
        item = SupplierContractItem(
            contract_id=contract.id,
            product_id=item_data.product_id,
            variant_id=item_data.variant_id,
            precio_acordado=item_data.precio_acordado,
            moneda=item_data.moneda,
            cantidad_minima=item_data.cantidad_minima,
            descuento_pct=item_data.descuento_pct,
        )
        db.add(item)

    await db.flush()
    await db.refresh(contract)
    return contract


async def list_supplier_contracts(db: AsyncSession, company_id: str) -> list[SupplierContract]:
    result = await db.execute(
        select(SupplierContract)
        .where(SupplierContract.company_id == uuid.UUID(company_id))
        .order_by(SupplierContract.created_at.desc())
    )
    return list(result.scalars().all())


async def get_supplier_contract(db: AsyncSession, contract_id: str) -> SupplierContract | None:
    result = await db.execute(select(SupplierContract).where(SupplierContract.id == uuid.UUID(contract_id)))
    contract = result.scalar_one_or_none()
    if contract:
        items_result = await db.execute(
            select(SupplierContractItem).where(SupplierContractItem.contract_id == contract.id)
        )
        contract.items = list(items_result.scalars().all())
    return contract


async def update_supplier_contract(db: AsyncSession, contract_id: str, data: ContractUpdate) -> SupplierContract | None:
    contract = await get_supplier_contract(db, contract_id)
    if not contract:
        return None

    update_fields = data.model_dump(exclude_unset=True, exclude={"items"})
    for key, value in update_fields.items():
        setattr(contract, key, value)

    if data.items is not None:
        existing = await db.execute(
            select(SupplierContractItem).where(SupplierContractItem.contract_id == contract.id)
        )
        for item in existing.scalars().all():
            await db.delete(item)

        for item_data in data.items:
            item = SupplierContractItem(
                contract_id=contract.id,
                product_id=item_data.product_id,
                variant_id=item_data.variant_id,
                precio_acordado=item_data.precio_acordado,
                moneda=item_data.moneda,
                cantidad_minima=item_data.cantidad_minima,
                descuento_pct=item_data.descuento_pct,
            )
            db.add(item)

    await db.flush()
    await db.refresh(contract)
    return contract


# ── Purchase Budgets ──────────────────────────────────────────────────────────

async def create_budget(db: AsyncSession, data: BudgetCreate) -> PurchaseBudget:
    budget = PurchaseBudget(
        company_id=data.company_id,
        nombre=data.nombre,
        anio=data.anio,
        mes=data.mes,
        tipo=data.tipo,
        moneda=data.moneda,
        monto_presupuestado=data.monto_presupuestado,
        monto_ejecutado=Decimal("0"),
        monto_disponible=data.monto_presupuestado,
        categoria_id=data.categoria_id,
        departamento=data.departamento,
        observaciones=data.observaciones,
        user_id=data.user_id,
    )
    db.add(budget)
    await db.flush()
    await db.refresh(budget)
    return budget


async def list_budgets(db: AsyncSession, company_id: str, anio: int | None = None) -> list[PurchaseBudget]:
    query = select(PurchaseBudget).where(PurchaseBudget.company_id == uuid.UUID(company_id))
    if anio:
        query = query.where(PurchaseBudget.anio == anio)
    query = query.order_by(PurchaseBudget.anio.desc(), PurchaseBudget.mes.asc().nullsfirst())
    result = await db.execute(query)
    return list(result.scalars().all())


async def get_budget(db: AsyncSession, budget_id: str) -> PurchaseBudget | None:
    result = await db.execute(select(PurchaseBudget).where(PurchaseBudget.id == uuid.UUID(budget_id)))
    return result.scalar_one_or_none()


async def update_budget(db: AsyncSession, budget_id: str, data: BudgetUpdate) -> PurchaseBudget | None:
    budget = await get_budget(db, budget_id)
    if not budget:
        return None
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(budget, key, value)
    budget.monto_disponible = budget.monto_presupuestado - (budget.monto_ejecutado or Decimal("0"))
    await db.flush()
    await db.refresh(budget)
    return budget


async def get_budget_consumption(db: AsyncSession, company_id: str, anio: int | None = None) -> list[dict]:
    query = select(PurchaseBudget).where(PurchaseBudget.company_id == uuid.UUID(company_id))
    if anio:
        query = query.where(PurchaseBudget.anio == anio)
    query = query.where(PurchaseBudget.activo == True)
    result = await db.execute(query)
    budgets = list(result.scalars().all())

    return [
        {
            "budget_id": b.id,
            "nombre": b.nombre,
            "anio": b.anio,
            "mes": b.mes,
            "monto_presupuestado": b.monto_presupuestado,
            "monto_ejecutado": b.monto_ejecutado or Decimal("0"),
            "monto_disponible": b.monto_disponible or (b.monto_presupuestado - (b.monto_ejecutado or Decimal("0"))),
            "porcentaje_ejecutado": (b.monto_ejecutado / b.monto_presupuestado * Decimal("100")).quantize(Decimal("0.1"))
            if b.monto_presupuestado > 0 else Decimal("0"),
        }
        for b in budgets
    ]


async def update_budget_consumption(db: AsyncSession, company_id: str, po_total: Decimal | None = None) -> None:
    if po_total is None:
        result = await db.execute(
            text("""
                SELECT COALESCE(SUM(total), 0) FROM purchase_orders
                WHERE company_id = :cid AND estado IN ('confirmado', 'enviado', 'parcial', 'completado')
            """),
            {"cid": company_id},
        )
        po_total = Decimal(str(result.scalar() or 0))

    current_year = datetime.now(timezone.utc).year
    current_month = datetime.now(timezone.utc).month

    await db.execute(
        text("""
            UPDATE purchase_budgets
            SET monto_ejecutado = :total,
                monto_disponible = monto_presupuestado - :total
            WHERE company_id = :cid AND anio = :year AND activo = true
        """),
        {"total": float(po_total), "cid": company_id, "year": current_year},
    )
    await db.flush()


# ── Reports ───────────────────────────────────────────────────────────────────

async def get_spend_by_supplier(db: AsyncSession, company_id: str) -> list[dict]:
    result = await db.execute(
        text("""
            SELECT
                po.supplier_id,
                s.razon_social,
                COUNT(po.id) as cantidad_ordenes,
                COALESCE(SUM(po.total), 0) as total_gastado,
                po.moneda
            FROM purchase_orders po
            JOIN suppliers s ON s.id = po.supplier_id
            WHERE po.company_id = :cid
              AND po.estado IN ('confirmado', 'enviado', 'parcial', 'completado')
            GROUP BY po.supplier_id, s.razon_social, po.moneda
            ORDER BY total_gastado DESC
        """),
        {"cid": company_id},
    )
    rows = result.fetchall()
    return [
        {
            "supplier_id": str(r[0]),
            "razon_social": r[1],
            "cantidad_ordenes": r[2],
            "total_gastado": Decimal(str(r[3])),
            "moneda": r[4],
        }
        for r in rows
    ]


async def get_spend_by_category(db: AsyncSession, company_id: str) -> list[dict]:
    result = await db.execute(
        text("""
            SELECT
                p.category_id,
                COALESCE(pc.nombre, 'Sin categoría') as categoria_nombre,
                COUNT(DISTINCT poi.product_id) as cantidad_productos,
                COALESCE(SUM(poi.total), 0) as total_gastado
            FROM purchase_order_items poi
            JOIN purchase_orders po ON po.id = poi.purchase_order_id
            JOIN products p ON p.id = poi.product_id
            LEFT JOIN product_categories pc ON pc.id = p.category_id
            WHERE po.company_id = :cid
              AND po.estado IN ('confirmado', 'enviado', 'parcial', 'completado')
            GROUP BY p.category_id, pc.nombre
            ORDER BY total_gastado DESC
        """),
        {"cid": company_id},
    )
    rows = result.fetchall()
    return [
        {
            "category_id": str(r[0]) if r[0] else None,
            "categoria_nombre": r[1],
            "cantidad_productos": r[2],
            "total_gastado": Decimal(str(r[3])),
        }
        for r in rows
    ]


async def get_price_variance(db: AsyncSession, company_id: str) -> list[dict]:
    result = await db.execute(
        text("""
            SELECT
                poi.product_id,
                p.nombre,
                AVG(poi.precio_unitario) as avg_price,
                MIN(poi.precio_unitario) as min_price,
                MAX(poi.precio_unitario) as max_price,
                MAX(po.fecha) as last_purchase_date,
                (SELECT s2.razon_social FROM purchase_orders po2
                 JOIN suppliers s2 ON s2.id = po2.supplier_id
                 WHERE po2.id = MAX(po.id)) as last_supplier
            FROM purchase_order_items poi
            JOIN purchase_orders po ON po.id = poi.purchase_order_id
            JOIN products p ON p.id = poi.product_id
            WHERE po.company_id = :cid
              AND po.estado IN ('confirmado', 'enviado', 'parcial', 'completado')
            GROUP BY poi.product_id, p.nombre
            HAVING COUNT(poi.id) > 1
            ORDER BY (MAX(poi.precio_unitario) - MIN(poi.precio_unitario)) DESC
        """),
        {"cid": company_id},
    )
    rows = result.fetchall()
    return [
        {
            "product_id": str(r[0]),
            "nombre": r[1],
            "average_price": Decimal(str(round(r[2], 0))) if r[2] else Decimal("0"),
            "min_price": Decimal(str(r[3])) if r[3] else Decimal("0"),
            "max_price": Decimal(str(r[4])) if r[4] else Decimal("0"),
            "variance_pct": Decimal(str(round((r[4] - r[3]) / r[3] * 100, 1))) if r[3] and r[3] > 0 else Decimal("0"),
            "last_purchase_date": r[5],
            "last_supplier": r[6],
        }
        for r in rows
    ]


async def get_purchase_kpis(db: AsyncSession, company_id: str) -> dict:
    result = await db.execute(
        text("""
            SELECT
                COUNT(po.id) as total_pos,
                COALESCE(SUM(po.total), 0) as total_gastado,
                COALESCE(SUM(po.iva_10 + po.iva_5), 0) as total_iva,
                COALESCE(AVG(po.total), 0) as prom_pedido,
                COUNT(DISTINCT po.supplier_id) as proveedores_activos
            FROM purchase_orders po
            WHERE po.company_id = :cid
              AND po.estado IN ('confirmado', 'enviado', 'parcial', 'completado')
        """),
        {"cid": company_id},
    )
    row = result.fetchone()

    pending = await db.execute(
        text("""
            SELECT COUNT(*) FROM purchase_orders
            WHERE company_id = :cid AND estado IN ('borrador', 'confirmado', 'enviado')
        """),
        {"cid": company_id},
    )
    pending_count = pending.scalar() or 0

    delayed = await db.execute(
        text("""
            SELECT COUNT(*) FROM purchase_orders
            WHERE company_id = :cid
              AND estado IN ('confirmado', 'enviado', 'parcial')
              AND fecha_entrega_estimada < CURRENT_DATE
        """),
        {"cid": company_id},
    )
    delayed_count = delayed.scalar() or 0

    ahorro = await db.execute(
        text("""
            SELECT COALESCE(SUM(po.descuento_total), 0)
            FROM purchase_orders po
            WHERE po.company_id = :cid AND po.estado IN ('confirmado', 'enviado', 'parcial', 'completado')
        """),
        {"cid": company_id},
    )
    ahorro_total = ahorro.scalar() or 0

    cumplimiento = await db.execute(
        text("""
            SELECT
                CASE WHEN COUNT(*) > 0
                    THEN SUM(CASE WHEN po.estado = 'completado' THEN 1 ELSE 0 END)::decimal / COUNT(*) * 100
                    ELSE 0
                END
            FROM purchase_orders po
            WHERE po.company_id = :cid
        """),
        {"cid": company_id},
    )
    cumplimiento_rate = cumplimiento.scalar() or 0

    return {
        "total_pos": row[0],
        "total_gastado": Decimal(str(row[1])),
        "total_iva": Decimal(str(row[2])),
        "prom_pedido": Decimal(str(round(row[3], 0))),
        "proveedores_activos": row[4],
        "ordenes_pendientes": pending_count,
        "ordenes_atrasadas": delayed_count,
        "ahorro_estimado": Decimal(str(ahorro_total)),
        "cumplimiento_rate": Decimal(str(round(cumplimiento_rate, 1))),
    }
