"""Mobile service — inventory count, receive remit, approve suggestions, dashboard"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.inventory.models import Stock, StockLot, InventoryMovement
from api.src.purchases.models import PurchaseOrder, PurchaseOrderItem, PurchaseSuggestion
from api.src.sales.models import Sale


async def count_inventory(
    db: AsyncSession,
    company_id: str,
    data: dict,
    user_id: str,
) -> dict:
    warehouse_id = uuid.UUID(data["warehouse_id"])
    items = data["items"]
    procesados = 0
    discrepancias = []

    for item in items:
        product_id = uuid.UUID(item["product_id"])
        cantidad_real = int(item["cantidad_real"])

        result = await db.execute(
            select(Stock).where(
                Stock.warehouse_id == warehouse_id,
                Stock.product_id == product_id,
            )
        )
        stock = result.scalar_one_or_none()
        cantidad_sistema = stock.cantidad if stock else 0
        diferencia = cantidad_real - cantidad_sistema

        if diferencia != 0:
            discrepancias.append({
                "product_id": str(product_id),
                "cantidad_sistema": cantidad_sistema,
                "cantidad_real": cantidad_real,
                "diferencia": diferencia,
            })

        if stock:
            stock.cantidad = cantidad_real
        else:
            stock = Stock(
                warehouse_id=warehouse_id,
                product_id=product_id,
                cantidad=cantidad_real,
            )
            db.add(stock)

        movement = InventoryMovement(
            company_id=uuid.UUID(company_id),
            warehouse_id=warehouse_id,
            product_id=product_id,
            tipo="inventario_fisico",
            cantidad=diferencia,
            referencia_type="mobile_count",
            user_id=uuid.UUID(user_id),
            motivo="Conteo fisico desde app movil",
        )
        db.add(movement)
        procesados += 1

    await db.flush()
    return {
        "procesados": procesados,
        "discrepancias": discrepancias,
    }


async def receive_remit(
    db: AsyncSession,
    company_id: str,
    data: dict,
    user_id: str,
) -> dict:
    orden_id = uuid.UUID(data["orden_id"])
    items = data["items"]
    errores = []
    procesados = 0

    result = await db.execute(
        select(PurchaseOrder).where(
            PurchaseOrder.id == orden_id,
            PurchaseOrder.company_id == uuid.UUID(company_id),
        )
    )
    orden = result.scalar_one_or_none()
    if not orden:
        return {"orden_id": orden_id, "procesados": 0, "errores": ["Orden de compra no encontrada"]}
    if orden.estado not in ("confirmada", "parcial"):
        return {"orden_id": orden_id, "procesados": 0, "errores": [f"Estado invalido: {orden.estado}"]}

    # Get the first warehouse from purchase items
    warehouse_id = None
    result = await db.execute(
        select(PurchaseOrderItem.warehouse_id).where(
            PurchaseOrderItem.purchase_order_id == orden_id,
        ).limit(1)
    )
    wh_row = result.scalar_one_or_none()
    if wh_row:
        warehouse_id = wh_row

    for item in items:
        product_id = uuid.UUID(item["product_id"])
        cantidad_recibida = int(item["cantidad_recibida"])

        result = await db.execute(
            select(PurchaseOrderItem).where(
                PurchaseOrderItem.purchase_order_id == orden_id,
                PurchaseOrderItem.product_id == product_id,
            )
        )
        order_item = result.scalar_one_or_none()
        if not order_item:
            errores.append(f"Producto {product_id} no esta en la orden")
            continue

        order_item.cantidad_recibida = (order_item.cantidad_recibida or 0) + cantidad_recibida

        if warehouse_id:
            result = await db.execute(
                select(Stock).where(
                    Stock.warehouse_id == warehouse_id,
                    Stock.product_id == product_id,
                )
            )
            stock = result.scalar_one_or_none()
            if stock:
                stock.cantidad = (stock.cantidad or 0) + cantidad_recibida
            else:
                stock = Stock(
                    warehouse_id=warehouse_id,
                    product_id=product_id,
                    cantidad=cantidad_recibida,
                )
                db.add(stock)
        else:
            stock = None

        movement = InventoryMovement(
            company_id=uuid.UUID(company_id),
            warehouse_id=warehouse_id or uuid.UUID("00000000-0000-0000-0000-000000000000"),
            product_id=product_id,
            tipo="recepcion_compra",
            cantidad=cantidad_recibida,
            referencia_type="purchase_order",
            referencia_id=orden_id,
            user_id=uuid.UUID(user_id),
            motivo="Recepcion desde app movil",
        )
        db.add(movement)

        lote_val = item.get("lote")
        fecha_venc = item.get("fecha_vencimiento")
        if lote_val:
            lot = StockLot(
                company_id=uuid.UUID(company_id),
                warehouse_id=warehouse_id or uuid.UUID("00000000-0000-0000-0000-000000000000"),
                product_id=product_id,
                cantidad=cantidad_recibida,
                cantidad_disponible=cantidad_recibida,
                costo_unitario=order_item.precio_unitario or 0,
                costo_total=(order_item.precio_unitario or 0) * cantidad_recibida,
                referencia=lote_val,
                fecha_vencimiento=datetime.combine(fecha_venc, datetime.min.time()) if fecha_venc else None,
            )
            db.add(lot)

        procesados += 1

    all_received = True
    result = await db.execute(
        select(PurchaseOrderItem).where(PurchaseOrderItem.purchase_order_id == orden_id)
    )
    for oi in result.scalars().all():
        if (oi.cantidad_recibida or 0) < oi.cantidad:
            all_received = False
            break
    orden.estado = "completado" if all_received else "parcial"

    await db.flush()
    return {
        "orden_id": orden_id,
        "procesados": procesados,
        "errores": errores,
    }


async def approve_suggestions(
    db: AsyncSession,
    company_id: str,
    data: dict,
) -> dict:
    suggestion_ids = [uuid.UUID(sid) for sid in data["suggestion_ids"]]
    aprobadas = 0

    result = await db.execute(
        select(PurchaseSuggestion).where(
            PurchaseSuggestion.id.in_(suggestion_ids),
            PurchaseSuggestion.company_id == uuid.UUID(company_id),
            PurchaseSuggestion.estado == "pendiente",
        )
    )
    suggestions = result.scalars().all()

    for suggestion in suggestions:
        suggestion.estado = "aprobada"
        aprobadas += 1

    await db.flush()
    return {"aprobadas": aprobadas, "total": len(suggestion_ids)}


async def get_mobile_dashboard(
    db: AsyncSession,
    company_id: str,
) -> dict:
    company_uuid = uuid.UUID(company_id)

    result = await db.execute(
        select(func.count(PurchaseOrder.id)).where(
            PurchaseOrder.company_id == company_uuid,
            PurchaseOrder.estado.in_(["confirmada", "parcial"]),
        )
    )
    recepciones_pendientes = result.scalar() or 0

    result = await db.execute(
        select(func.count(PurchaseSuggestion.id)).where(
            PurchaseSuggestion.company_id == company_uuid,
            PurchaseSuggestion.estado == "pendiente",
        )
    )
    sugerencias_pendientes = result.scalar() or 0

    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    result = await db.execute(
        select(func.count(Sale.id)).where(
            Sale.company_id == company_uuid,
            Sale.fecha >= today_start,
            Sale.condicion == "delivery",
        )
    )
    entregas_hoy = result.scalar() or 0

    return {
        "recepciones_pendientes": recepciones_pendientes,
        "inventarios_pendientes": 0,
        "sugerencias_pendientes": sugerencias_pendientes,
        "entregas_hoy": entregas_hoy,
    }


async def receive_remit(
    db: AsyncSession,
    company_id: str,
    data: dict,
    user_id: str,
) -> dict:
    orden_id = uuid.UUID(data["orden_id"])
    items = data["items"]
    errores = []
    procesados = 0

    # Verify order exists and is in correct state
    result = await db.execute(
        select(PurchaseOrder).where(
            PurchaseOrder.id == orden_id,
            PurchaseOrder.company_id == uuid.UUID(company_id),
        )
    )
    orden = result.scalar_one_or_none()
    if not orden:
        return {"orden_id": orden_id, "procesados": 0, "errores": ["Orden de compra no encontrada"]}
    if orden.estado not in ("confirmada", "parcial"):
        return {"orden_id": orden_id, "procesados": 0, "errores": [f"Estado inválido: {orden.estado}"]}

    for item in items:
        product_id = uuid.UUID(item["product_id"])
        cantidad_recibida = int(item["cantidad_recibida"])

        # Find matching order item
        result = await db.execute(
            select(PurchaseOrderItem).where(
                PurchaseOrderItem.purchase_order_id == orden_id,
                PurchaseOrderItem.product_id == product_id,
            )
        )
        order_item = result.scalar_one_or_none()
        if not order_item:
            errores.append(f"Producto {product_id} no está en la orden")
            continue

        # Update received quantity
        order_item.cantidad_recibida = (order_item.cantidad_recibida or 0) + cantidad_recibida

        # Update stock
        result = await db.execute(
            select(Stock).where(
                Stock.warehouse_id == orden.warehouse_id if hasattr(orden, "warehouse_id") else True,
                Stock.product_id == product_id,
            )
        )
        stock = result.scalar_one_or_none()
        if stock:
            stock.cantidad = (stock.cantidad or 0) + cantidad_recibida
        else:
            stock = Stock(
                warehouse_id=uuid.UUID(orden.warehouse_id) if hasattr(orden, "warehouse_id") and orden.warehouse_id else uuid.UUID("00000000-0000-0000-0000-000000000000"),
                product_id=product_id,
                cantidad=cantidad_recibida,
            )
            db.add(stock)

        # Log movement
        movement = InventoryMovement(
            company_id=uuid.UUID(company_id),
            warehouse_id=stock.warehouse_id,
            product_id=product_id,
            tipo="recepcion_compra",
            cantidad=cantidad_recibida,
            referencia_type="purchase_order",
            referencia_id=orden_id,
            user_id=uuid.UUID(user_id),
            motivo="Recepción desde app móvil",
        )
        db.add(movement)

        # Update StockLot if lote provided
        lote_val = item.get("lote")
        fecha_venc = item.get("fecha_vencimiento")
        if lote_val:
            lot = StockLot(
                company_id=uuid.UUID(company_id),
                warehouse_id=stock.warehouse_id,
                product_id=product_id,
                cantidad=cantidad_recibida,
                cantidad_disponible=cantidad_recibida,
                costo_unitario=order_item.precio_unitario or 0,
                costo_total=(order_item.precio_unitario or 0) * cantidad_recibida,
                referencia=lote_val,
                fecha_vencimiento=datetime.combine(fecha_venc, datetime.min.time()) if fecha_venc else None,
            )
            db.add(lot)

        procesados += 1

    # Update order status
    all_received = True
    result = await db.execute(
        select(PurchaseOrderItem).where(PurchaseOrderItem.purchase_order_id == orden_id)
    )
    order_items = result.scalars().all()
    for oi in order_items:
        if (oi.cantidad_recibida or 0) < oi.cantidad:
            all_received = False
            break
    orden.estado = "completado" if all_received else "parcial"

    await db.flush()
    return {
        "orden_id": orden_id,
        "procesados": procesados,
        "errores": errores,
    }


async def approve_suggestions(
    db: AsyncSession,
    company_id: str,
    data: dict,
) -> dict:
    suggestion_ids = [uuid.UUID(sid) for sid in data["suggestion_ids"]]
    aprobadas = 0

    result = await db.execute(
        select(PurchaseSuggestion).where(
            PurchaseSuggestion.id.in_(suggestion_ids),
            PurchaseSuggestion.company_id == uuid.UUID(company_id),
            PurchaseSuggestion.estado == "pendiente",
        )
    )
    suggestions = result.scalars().all()

    for suggestion in suggestions:
        suggestion.estado = "aprobada"
        aprobadas += 1

    await db.flush()
    return {"aprobadas": aprobadas, "total": len(suggestion_ids)}


async def get_mobile_dashboard(
    db: AsyncSession,
    company_id: str,
) -> dict:
    company_uuid = uuid.UUID(company_id)

    # Pending purchase receipts
    result = await db.execute(
        select(func.count(PurchaseOrder.id)).where(
            PurchaseOrder.company_id == company_uuid,
            PurchaseOrder.estado.in_(["confirmada", "parcial"]),
        )
    )
    recepciones_pendientes = result.scalar() or 0

    # Pending suggestions
    result = await db.execute(
        select(func.count(PurchaseSuggestion.id)).where(
            PurchaseSuggestion.company_id == company_uuid,
            PurchaseSuggestion.estado == "pendiente",
        )
    )
    sugerencias_pendientes = result.scalar() or 0

    # Deliveries today (using sales orders or logistics deliveries)
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    try:
        from api.src.sales.models import Sale
        result = await db.execute(
            select(func.count(Sale.id)).where(
                Sale.company_id == company_uuid,
                Sale.fecha >= today_start,
                Sale.condicion == "delivery",
            )
        )
        entregas_hoy = result.scalar() or 0
    except Exception:
        entregas_hoy = 0

    return {
        "recepciones_pendientes": recepciones_pendientes,
        "inventarios_pendientes": 0,
        "sugerencias_pendientes": sugerencias_pendientes,
        "entregas_hoy": entregas_hoy,
    }

