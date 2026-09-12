"""Inventory service — workflow doble aprobación (Gerencia + Administración),
audit trail inmutable, toma física con doble conteo ciego."""

from sqlalchemy import select, update, func
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime, timezone
import uuid

from api.src.inventory.models import (
    Warehouse, Stock, InventoryMovement,
    StockTransfer, StockTransferItem,
    InventoryAdjustment, InventoryAdjustmentItem,
    StockAdjustmentAuditLog,
    PhysicalInventorySession, PhysicalInventorySessionItem,
    MOTIVOS_AJUSTE, RIESGOS_CON_EVIDENCIA,
)
from api.src.inventory.schemas import (
    WarehouseCreate, MovementCreate, TransferCreate, AdjustmentCreate,
    ApproveAdjustmentBody, RejectAdjustmentBody,
    PhysicalSessionCreate, PhysicalSessionItemCountBody, PhysicalSessionItemReconcileBody,
)
from api.src.products.models import Product


async def create_warehouse(db: AsyncSession, data: WarehouseCreate, default_company_id: uuid.UUID | None = None) -> dict:
    dump = data.model_dump(exclude_unset=True)
    if not dump.get("company_id") and default_company_id:
        dump["company_id"] = default_company_id
    if not dump.get("company_id"):
        raise ValueError("company_id es requerido")

    # Validar unicidad de código
    existing = await db.execute(
        select(Warehouse).where(
            Warehouse.company_id == dump["company_id"],
            Warehouse.codigo == dump["codigo"],
            Warehouse.activo == True,
        )
    )
    if existing.scalar_one_or_none():
        raise ValueError(f"Ya existe un depósito activo con el código '{dump['codigo']}'")

    # Validar parent_id si fue provisto
    parent_nombre = None
    if dump.get("parent_id"):
        parent_wh = await db.execute(
            select(Warehouse).where(Warehouse.id == dump["parent_id"], Warehouse.company_id == dump["company_id"])
        )
        p_obj = parent_wh.scalar_one_or_none()
        if not p_obj:
            raise ValueError("El depósito principal indicado no existe")
        parent_nombre = p_obj.nombre
        if not dump.get("tipo") or dump.get("tipo") == "principal":
            dump["tipo"] = "subdeposito"

    warehouse = Warehouse(**dump)
    db.add(warehouse)
    await db.flush()
    await db.commit()
    await db.refresh(warehouse)

    return {
        "id": warehouse.id,
        "company_id": warehouse.company_id,
        "branch_id": warehouse.branch_id,
        "parent_id": warehouse.parent_id,
        "codigo": warehouse.codigo,
        "nombre": warehouse.nombre,
        "direccion": warehouse.direccion,
        "tipo": warehouse.tipo,
        "responsable": warehouse.responsable,
        "descripcion": warehouse.descripcion,
        "activo": warehouse.activo,
        "created_at": warehouse.created_at,
        "parent_nombre": parent_nombre,
        "subdepositos_count": 0,
    }


async def list_warehouses(db: AsyncSession, company_id: str) -> list[dict]:
    cid = uuid.UUID(company_id) if isinstance(company_id, str) else company_id
    result = await db.execute(
        select(Warehouse)
        .where(Warehouse.company_id == cid)
        .order_by(Warehouse.codigo, Warehouse.nombre)
    )
    warehouses = list(result.scalars().all())
    wh_map = {str(w.id): w.nombre for w in warehouses}
    wh_counts: dict[str, int] = {}
    for w in warehouses:
        if w.parent_id:
            pid = str(w.parent_id)
            wh_counts[pid] = wh_counts.get(pid, 0) + 1

    return [
        {
            "id": w.id,
            "company_id": w.company_id,
            "branch_id": w.branch_id,
            "parent_id": w.parent_id,
            "codigo": w.codigo,
            "nombre": w.nombre,
            "direccion": w.direccion,
            "tipo": w.tipo or "principal",
            "responsable": w.responsable,
            "descripcion": w.descripcion,
            "activo": w.activo,
            "created_at": w.created_at,
            "parent_nombre": wh_map.get(str(w.parent_id)) if w.parent_id else None,
            "subdepositos_count": wh_counts.get(str(w.id), 0),
        }
        for w in warehouses
    ]


async def update_warehouse(db: AsyncSession, warehouse_id: str, data: dict, company_id: uuid.UUID) -> dict:
    wid = uuid.UUID(warehouse_id) if isinstance(warehouse_id, str) else warehouse_id
    result = await db.execute(
        select(Warehouse).where(Warehouse.id == wid, Warehouse.company_id == company_id)
    )
    wh = result.scalar_one_or_none()
    if not wh:
        raise ValueError("Depósito no encontrado")

    for k, v in data.items():
        if hasattr(wh, k) and v is not None:
            setattr(wh, k, v)

    await db.flush()
    await db.commit()
    await db.refresh(wh)

    parent_nombre = None
    if wh.parent_id:
        p_res = await db.execute(select(Warehouse.nombre).where(Warehouse.id == wh.parent_id))
        parent_nombre = p_res.scalar_one_or_none()

    sub_count_res = await db.execute(
        select(func.count()).select_from(Warehouse).where(Warehouse.parent_id == wh.id, Warehouse.activo == True)
    )
    sub_count = sub_count_res.scalar() or 0

    return {
        "id": wh.id,
        "company_id": wh.company_id,
        "branch_id": wh.branch_id,
        "parent_id": wh.parent_id,
        "codigo": wh.codigo,
        "nombre": wh.nombre,
        "direccion": wh.direccion,
        "tipo": wh.tipo,
        "responsable": wh.responsable,
        "descripcion": wh.descripcion,
        "activo": wh.activo,
        "created_at": wh.created_at,
        "parent_nombre": parent_nombre,
        "subdepositos_count": sub_count,
    }


async def delete_warehouse(db: AsyncSession, warehouse_id: str, company_id: uuid.UUID) -> bool:
    wid = uuid.UUID(warehouse_id) if isinstance(warehouse_id, str) else warehouse_id
    result = await db.execute(
        select(Warehouse).where(Warehouse.id == wid, Warehouse.company_id == company_id)
    )
    wh = result.scalar_one_or_none()
    if not wh:
        raise ValueError("Depósito no encontrado")

    stock_res = await db.execute(
        select(func.sum(Stock.cantidad)).where(Stock.warehouse_id == wid)
    )
    total_stock = stock_res.scalar() or 0
    if total_stock > 0:
        raise ValueError(f"No se puede dar de baja el depósito porque posee {total_stock} unidades de stock almacenadas. Transfiéralas antes de darlo de baja.")

    wh.activo = False
    await db.flush()
    await db.commit()
    return True


async def get_stock(db: AsyncSession, warehouse_id: str, product_id: str) -> Stock | None:
    # FOR UPDATE: todos los llamadores reales de get_stock() son escrituras
    # (record_movement, complete_transfer, approve_adjustment,
    # record_quick_merma) -- sin esto, dos transferencias/ajustes/mermas
    # concurrentes sobre el mismo producto/deposito pueden leer el mismo
    # stock.cantidad antes de que ninguna confirme, y la que confirma
    # despues pisa silenciosamente el descuento/ajuste de la otra (misma
    # clase de bug ya corregida en caja y credit_accounts).
    result = await db.execute(
        select(Stock).where(Stock.warehouse_id == warehouse_id, Stock.product_id == product_id).with_for_update()
    )
    return result.scalar_one_or_none()


async def get_stock_by_warehouse(db: AsyncSession, warehouse_id: str) -> list[dict]:
    # El frontend siempre esperó s.product?.nombre / s.product?.sku (y
    # s.warehouse?.nombre), pero este endpoint nunca devolvió esa relación
    # -- StockResponse solo tenía product_id crudo. Resultado: en Inventario
    # nunca se veían nombres de producto, solo el ID, en toda la pantalla.
    result = await db.execute(
        select(Stock, Product, Warehouse)
        .join(Product, Stock.product_id == Product.id)
        .join(Warehouse, Stock.warehouse_id == Warehouse.id)
        .where(Stock.warehouse_id == warehouse_id)
    )
    rows = result.all()
    return [
        {
            "id": s.id,
            "warehouse_id": s.warehouse_id,
            "product_id": s.product_id,
            "variant_id": s.variant_id,
            "cantidad": s.cantidad,
            "cantidad_reservada": s.cantidad_reservada,
            "costo_unitario": s.costo_unitario,
            "updated_at": s.updated_at,
            "nombre": p.nombre,
            "sku": p.sku,
            "costo_promedio": p.costo_promedio,
            "product": {
                "id": p.id, "sku": p.sku, "nombre": p.nombre, "categoria_id": p.categoria_id,
                "codigo_barra": p.codigo_barra, "unidad_medida": p.unidad_medida,
                "precio_venta": p.precio_venta, "costo_promedio": p.costo_promedio,
                "activo": p.activo, "created_at": p.created_at, "updated_at": p.updated_at,
            },
            "warehouse": {"id": w.id, "nombre": w.nombre, "codigo": w.codigo, "company_id": w.company_id, "activo": w.activo},
        }
        for s, p, w in rows
    ]


async def get_stock_by_product(db: AsyncSession, company_id: str, product_id: str) -> dict:
    """Stock real (no stock_minimo) de un producto, sumado en todos los
    depositos de la empresa -- usado por Consulta de Precios en el POS,
    que antes no mostraba stock en absoluto."""
    result = await db.execute(
        select(Stock.cantidad, Stock.cantidad_reservada, Warehouse.nombre)
        .join(Warehouse, Stock.warehouse_id == Warehouse.id)
        .where(Stock.product_id == product_id, Warehouse.company_id == company_id)
    )
    rows = result.all()
    total = sum(r[0] for r in rows)
    reservado = sum(r[1] for r in rows)
    return {
        "product_id": product_id,
        "cantidad_total": total,
        "cantidad_reservada": reservado,
        "cantidad_disponible": total - reservado,
        "por_deposito": [{"nombre": r[2], "cantidad": r[0]} for r in rows],
    }


async def get_stock_map(db: AsyncSession, company_id: str) -> dict:
    """Mapa liviano product_id -> cantidad disponible, sumado en todos los
    depositos de la empresa. Usado por la grilla del POS -- antes esa
    pantalla mostraba stock_minimo (el umbral de reposicion) etiquetado
    como si fuera el stock real, con un fallback fijo de 36 si faltaba."""
    result = await db.execute(
        select(Stock.product_id, Stock.cantidad, Stock.cantidad_reservada)
        .join(Warehouse, Stock.warehouse_id == Warehouse.id)
        .where(Warehouse.company_id == company_id)
    )
    totals: dict[str, int] = {}
    for product_id, cantidad, reservada in result.all():
        totals[str(product_id)] = totals.get(str(product_id), 0) + (cantidad - reservada)
    return totals


async def get_low_stock(db: AsyncSession, company_id: str) -> list[dict]:
    result = await db.execute(
        select(Stock, Product.nombre, Product.stock_minimo, Product.sku)
        .join(Product, Stock.product_id == Product.id)
        .where(
            Stock.cantidad <= Product.stock_minimo,
            Product.company_id == company_id,
        )
    )
    rows = result.fetchall()
    return [
        {
            "product_id": str(row[0].product_id),
            "warehouse_id": str(row[0].warehouse_id),
            "nombre": row[1],
            "sku": row[3],
            "cantidad_actual": row[0].cantidad,
            "stock_minimo": row[2],
        }
        for row in rows
    ]


async def record_movement(db: AsyncSession, data: MovementCreate) -> InventoryMovement:
    movement = InventoryMovement(**data.model_dump())
    db.add(movement)

    stock = await get_stock(db, str(data.warehouse_id), str(data.product_id))
    if not stock:
        stock = Stock(
            warehouse_id=data.warehouse_id,
            product_id=data.product_id,
            variant_id=data.variant_id,
            cantidad=0,
            costo_unitario=data.costo_unitario,
        )
        db.add(stock)
        await db.flush()

    new_qty = stock.cantidad + data.cantidad
    stock.cantidad = new_qty

    if data.cantidad > 0 and data.costo_unitario:
        old_cost = stock.costo_unitario or 0
        old_qty = stock.cantidad - data.cantidad
        if old_qty + data.cantidad > 0:
            stock.costo_unitario = (old_cost * old_qty + data.costo_unitario * data.cantidad) / (old_qty + data.cantidad)

    stock.updated_at = datetime.now(timezone.utc)
    await db.flush()
    await db.refresh(movement)
    return movement


async def create_transfer(db: AsyncSession, data: TransferCreate, user_id: uuid.UUID | None = None) -> StockTransfer:
    transfer_code = f"TRF-{datetime.now(timezone.utc).strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"
    transfer = StockTransfer(
        company_id=data.company_id,
        codigo=transfer_code,
        warehouse_origen_id=data.warehouse_origen_id,
        warehouse_destino_id=data.warehouse_destino_id,
        observaciones=data.observaciones,
        user_id_envio=user_id,
    )
    db.add(transfer)
    await db.flush()

    for item_data in data.items:
        item = StockTransferItem(
            transfer_id=transfer.id,
            product_id=uuid.UUID(item_data["product_id"]) if isinstance(item_data["product_id"], str) else item_data["product_id"],
            variant_id=uuid.UUID(item_data["variant_id"]) if item_data.get("variant_id") and isinstance(item_data["variant_id"], str) else item_data.get("variant_id"),
            cantidad_enviada=item_data["cantidad"],
        )
        db.add(item)

    await db.flush()
    await db.refresh(transfer)
    return transfer


async def complete_transfer(db: AsyncSession, transfer_id: str, user_id: uuid.UUID | None = None) -> StockTransfer | None:
    transfer = await db.execute(select(StockTransfer).where(StockTransfer.id == uuid.UUID(transfer_id)))
    transfer_obj = transfer.scalar_one_or_none()
    if not transfer_obj or transfer_obj.estado != "pendiente":
        return None

    items_result = await db.execute(select(StockTransferItem).where(StockTransferItem.transfer_id == transfer_obj.id))
    items = items_result.scalars().all()

    for item in items:
        src_stock = await get_stock(db, str(transfer_obj.warehouse_origen_id), str(item.product_id))
        if src_stock:
            src_stock.cantidad -= item.cantidad_enviada

        dest_stock = await get_stock(db, str(transfer_obj.warehouse_destino_id), str(item.product_id))
        if not dest_stock:
            dest_stock = Stock(
                warehouse_id=transfer_obj.warehouse_destino_id,
                product_id=item.product_id,
                variant_id=item.variant_id,
                cantidad=0,
                costo_unitario=src_stock.costo_unitario if src_stock else None,
            )
            db.add(dest_stock)
            await db.flush()
        dest_stock.cantidad += item.cantidad_enviada
        item.cantidad_recibida = item.cantidad_enviada

    transfer_obj.estado = "completada"
    transfer_obj.fecha_recepcion = datetime.now(timezone.utc)
    transfer_obj.user_id_recepcion = user_id

    await db.flush()
    await db.refresh(transfer_obj)
    return transfer_obj


# ---------------------------------------------------------------------------
# Helpers de audit log
# ---------------------------------------------------------------------------

async def _write_audit_log(
    db: AsyncSession,
    adjustment_id: uuid.UUID,
    accion: str,
    user_id: uuid.UUID,
    user_nombre: str | None = None,
    rol_firmante: str | None = None,
    comentario: str | None = None,
    ip_address: str | None = None,
    metadata_extra: dict | None = None,
) -> None:
    """Escribe un registro inmutable en el audit trail. Solo INSERT, nunca UPDATE."""
    log = StockAdjustmentAuditLog(
        adjustment_id=adjustment_id,
        accion=accion,
        user_id=user_id,
        user_nombre=user_nombre,
        rol_firmante=rol_firmante,
        comentario=comentario,
        ip_address=ip_address,
        metadata_extra=metadata_extra,
    )
    db.add(log)
    await db.flush()


async def _get_user_nombre(db: AsyncSession, user_id: uuid.UUID | None) -> str | None:
    """Recupera el nombre del usuario para desnormalizar en el audit trail."""
    if not user_id:
        return None
    from sqlalchemy import text
    r = await db.execute(
        text("SELECT nombre FROM users WHERE id = :uid LIMIT 1"),
        {"uid": user_id},
    )
    row = r.first()
    return row[0] if row else None


# ---------------------------------------------------------------------------
# Crear ajuste — calcula riesgo e impacto automáticamente
# ---------------------------------------------------------------------------

async def create_adjustment(
    db: AsyncSession,
    data: AdjustmentCreate,
    user_id: uuid.UUID | None = None,
    user_nombre: str | None = None,
    ip_address: str | None = None,
) -> InventoryAdjustment:
    """Crea un ajuste de stock en estado pendiente_gerencia.
    
    NUNCA modifica el stock real — eso ocurre solo cuando el segundo aprobador
    (Administración) firma la aprobación final.
    """
    motivo_info = MOTIVOS_AJUSTE.get(data.motivo_codigo, {})
    riesgo = motivo_info.get("riesgo", "bajo")
    motivo_label = motivo_info.get("label", data.motivo_codigo)

    # Validar evidencia obligatoria para riesgo alto/severo
    if riesgo in RIESGOS_CON_EVIDENCIA:
        if not data.evidencia_urls or len(data.evidencia_urls) == 0:
            raise ValueError(
                f"El motivo '{motivo_label}' tiene riesgo {riesgo.upper()} y requiere "
                "al menos un archivo de evidencia (foto/documento) adjunto."
            )

    # Pre-calcular impacto financiero sumando diferencias valorizadas
    impacto_total = 0
    enriched_items = []
    for item_data in data.items:
        diff = float(item_data.cantidad_fisica) - float(item_data.cantidad_sistema)
        costo = float(item_data.costo_unitario or 0)

        # Si no viene costo, intentar recuperar de la DB
        if costo == 0 and item_data.product_id:
            product = await db.get(Product, item_data.product_id)
            if product:
                costo = float(product.costo_promedio or product.ultimo_costo or 0)

        impacto_item = abs(diff) * costo
        impacto_total += impacto_item
        enriched_items.append((item_data, diff, costo, impacto_item))

    adj_code = f"ADJ-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M')}-{uuid.uuid4().hex[:5].upper()}"
    adjustment = InventoryAdjustment(
        company_id=data.company_id,
        warehouse_id=data.warehouse_id,
        codigo=adj_code,
        motivo_codigo=data.motivo_codigo,
        motivo_label=motivo_label,
        motivo_detalle=data.motivo_detalle,
        motivo=motivo_label,  # legado
        riesgo=riesgo,
        estado="pendiente_gerencia",
        impacto_financiero_gs=int(impacto_total),
        evidencia_urls=data.evidencia_urls,
        observaciones=data.observaciones,
        user_id=user_id,
    )
    db.add(adjustment)
    await db.flush()

    for item_data, diff, costo, impacto_item in enriched_items:
        # Recuperar nombre/sku del producto para desnormalizar
        product = await db.get(Product, item_data.product_id)
        item = InventoryAdjustmentItem(
            adjustment_id=adjustment.id,
            product_id=item_data.product_id,
            variant_id=item_data.variant_id,
            product_nombre=product.nombre if product else None,
            product_sku=product.sku if product else None,
            cantidad_sistema=item_data.cantidad_sistema,
            cantidad_fisica=item_data.cantidad_fisica,
            diferencia=diff,
            costo_unitario=int(costo) if costo else None,
            impacto_gs=int(impacto_item),
        )
        db.add(item)

    await db.flush()

    # Audit log: creación
    await _write_audit_log(
        db,
        adjustment_id=adjustment.id,
        accion="creado",
        user_id=user_id or uuid.UUID(int=0),
        user_nombre=user_nombre,
        rol_firmante="creador",
        comentario=f"Ajuste creado con motivo '{motivo_label}', riesgo {riesgo}, impacto Gs. {int(impacto_total):,}",
        ip_address=ip_address,
        metadata_extra={"riesgo": riesgo, "impacto_gs": int(impacto_total), "items_count": len(enriched_items)},
    )

    await db.refresh(adjustment)
    return adjustment


# ---------------------------------------------------------------------------
# Aprobación paso 1: Gerencia
# ---------------------------------------------------------------------------

async def approve_adjustment_gerencia(
    db: AsyncSession,
    adjustment_id: str,
    user_id: uuid.UUID,
    user_nombre: str | None = None,
    body: "ApproveAdjustmentBody | None" = None,
    ip_address: str | None = None,
) -> InventoryAdjustment:
    """Firma de Gerencia. Pasa el ajuste a estado pendiente_administracion.
    
    El stock NO se modifica todavía.
    """
    adj_uuid = uuid.UUID(adjustment_id) if isinstance(adjustment_id, str) else adjustment_id
    result = await db.execute(select(InventoryAdjustment).where(InventoryAdjustment.id == adj_uuid))
    adjustment = result.scalar_one_or_none()

    if not adjustment:
        raise ValueError("Ajuste no encontrado")
    if adjustment.estado != "pendiente_gerencia":
        raise ValueError(f"El ajuste no está en estado 'pendiente_gerencia' (estado actual: {adjustment.estado})")
    # Seguridad: el creador no puede aprobar como Gerencia
    if adjustment.user_id and adjustment.user_id == user_id:
        raise ValueError("El creador del ajuste no puede aprobarlo como Gerencia")

    comentario = (body.comentario if body else None) or ""
    nombre = user_nombre or await _get_user_nombre(db, user_id)

    adjustment.estado = "pendiente_administracion"
    adjustment.aprobado_por_gerencia = user_id
    adjustment.aprobado_por_gerencia_nombre = nombre
    adjustment.fecha_aprobacion_gerencia = datetime.now(timezone.utc)
    adjustment.comentario_gerencia = comentario

    await db.flush()

    await _write_audit_log(
        db,
        adjustment_id=adjustment.id,
        accion="aprobado_gerencia",
        user_id=user_id,
        user_nombre=nombre,
        rol_firmante="gerencia",
        comentario=comentario or "Aprobado por Gerencia",
        ip_address=ip_address,
    )

    await db.refresh(adjustment)
    return adjustment


# ---------------------------------------------------------------------------
# Aprobación paso 2: Administración — ejecuta el ajuste real de stock
# ---------------------------------------------------------------------------

async def approve_adjustment_administracion(
    db: AsyncSession,
    adjustment_id: str,
    user_id: uuid.UUID,
    user_nombre: str | None = None,
    body: "ApproveAdjustmentBody | None" = None,
    ip_address: str | None = None,
) -> InventoryAdjustment:
    """Firma de Administración. Pasa el ajuste a estado aprobado y EJECUTA
    los cambios de stock y el registro Kardex.
    """
    adj_uuid = uuid.UUID(adjustment_id) if isinstance(adjustment_id, str) else adjustment_id
    result = await db.execute(select(InventoryAdjustment).where(InventoryAdjustment.id == adj_uuid))
    adjustment = result.scalar_one_or_none()

    if not adjustment:
        raise ValueError("Ajuste no encontrado")
    if adjustment.estado != "pendiente_administracion":
        raise ValueError(f"El ajuste no está en estado 'pendiente_administracion' (estado actual: {adjustment.estado})")
    # Mismo usuario no puede aprobar ambas etapas
    if adjustment.aprobado_por_gerencia and adjustment.aprobado_por_gerencia == user_id:
        raise ValueError("El mismo usuario no puede aprobar las dos etapas. Gerencia y Administración deben ser personas distintas.")

    items_result = await db.execute(
        select(InventoryAdjustmentItem).where(InventoryAdjustmentItem.adjustment_id == adjustment.id)
    )
    items = items_result.scalars().all()

    # Ejecutar cambios de stock y registrar en Kardex
    for item in items:
        if item.diferencia != 0:
            movement = InventoryMovement(
                company_id=adjustment.company_id,
                warehouse_id=adjustment.warehouse_id,
                product_id=item.product_id,
                variant_id=item.variant_id,
                tipo="ajuste",
                cantidad=int(item.diferencia),
                costo_unitario=item.costo_unitario,
                referencia_type="adjustment",
                referencia_id=adjustment.id,
                motivo=(
                    f"[{adjustment.riesgo.upper()}] {adjustment.codigo}: "
                    f"{adjustment.motivo_label} — {adjustment.motivo_detalle[:80]}"
                ),
                user_id=user_id,
            )
            db.add(movement)

            stock = await get_stock(db, str(adjustment.warehouse_id), str(item.product_id))
            if stock:
                stock.cantidad = int(item.cantidad_fisica)
                stock.updated_at = datetime.now(timezone.utc)
            else:
                stock = Stock(
                    warehouse_id=adjustment.warehouse_id,
                    product_id=item.product_id,
                    variant_id=item.variant_id,
                    cantidad=int(item.cantidad_fisica),
                    costo_unitario=item.costo_unitario,
                )
                db.add(stock)

    comentario = (body.comentario if body else None) or ""
    nombre = user_nombre or await _get_user_nombre(db, user_id)

    adjustment.estado = "aprobado"
    adjustment.aprobado_por_administracion = user_id
    adjustment.aprobado_por_administracion_nombre = nombre
    adjustment.fecha_aprobacion_administracion = datetime.now(timezone.utc)
    adjustment.comentario_administracion = comentario
    # Mantener legado
    adjustment.aprobado_por = user_id
    adjustment.fecha_aprobacion = datetime.now(timezone.utc)

    await db.flush()

    await _write_audit_log(
        db,
        adjustment_id=adjustment.id,
        accion="aprobado_administracion",
        user_id=user_id,
        user_nombre=nombre,
        rol_firmante="administracion",
        comentario=comentario or "Aprobado por Administración. Stock actualizado.",
        ip_address=ip_address,
        metadata_extra={"items_ejecutados": len(items)},
    )

    await _write_audit_log(
        db,
        adjustment_id=adjustment.id,
        accion="ejecutado",
        user_id=user_id,
        user_nombre="Sistema",
        rol_firmante="sistema",
        comentario=f"Stock actualizado. {len(items)} productos afectados. Impacto: Gs. {int(adjustment.impacto_financiero_gs or 0):,}",
        ip_address=None,
    )

    await db.refresh(adjustment)
    return adjustment


# ---------------------------------------------------------------------------
# Rechazo (cualquier aprobador, cualquier etapa)
# ---------------------------------------------------------------------------

async def reject_adjustment(
    db: AsyncSession,
    adjustment_id: str,
    user_id: uuid.UUID,
    user_nombre: str | None = None,
    body: "RejectAdjustmentBody | None" = None,
    ip_address: str | None = None,
) -> InventoryAdjustment:
    """Rechaza el ajuste. Irreversible — si se necesita ajustar, crear uno nuevo."""
    adj_uuid = uuid.UUID(adjustment_id) if isinstance(adjustment_id, str) else adjustment_id
    result = await db.execute(select(InventoryAdjustment).where(InventoryAdjustment.id == adj_uuid))
    adjustment = result.scalar_one_or_none()

    if not adjustment:
        raise ValueError("Ajuste no encontrado")
    if adjustment.estado in ("aprobado", "rechazado"):
        raise ValueError(f"No se puede rechazar un ajuste en estado '{adjustment.estado}'")

    motivo_rechazo = (body.motivo_rechazo if body else None) or "Sin motivo especificado"
    nombre = user_nombre or await _get_user_nombre(db, user_id)

    # Determinar en qué etapa se rechazó para el audit
    rol_firmante = "gerencia" if adjustment.estado == "pendiente_gerencia" else "administracion"

    adjustment.estado = "rechazado"
    adjustment.rechazado_por = user_id
    adjustment.rechazado_por_nombre = nombre
    adjustment.motivo_rechazo = motivo_rechazo
    adjustment.fecha_rechazo = datetime.now(timezone.utc)

    await db.flush()

    await _write_audit_log(
        db,
        adjustment_id=adjustment.id,
        accion="rechazado",
        user_id=user_id,
        user_nombre=nombre,
        rol_firmante=rol_firmante,
        comentario=f"RECHAZADO: {motivo_rechazo}",
        ip_address=ip_address,
        metadata_extra={"etapa_rechazo": adjustment.estado, "riesgo": adjustment.riesgo},
    )

    await db.refresh(adjustment)
    return adjustment


# ---------------------------------------------------------------------------
# Compatibilidad legado — approve_adjustment (un solo aprobador, path antiguo)
# ---------------------------------------------------------------------------

async def approve_adjustment(db: AsyncSession, adjustment_id: str, user_id: uuid.UUID | None = None) -> InventoryAdjustment | None:
    """Legado: redirige al nuevo flujo de doble aprobación.
    
    Solo funciona para ajustes creados antes de la migración (estado=pendiente).
    Para nuevos ajustes use approve_adjustment_gerencia / approve_adjustment_administracion.
    """
    adj_uuid = uuid.UUID(adjustment_id) if isinstance(adjustment_id, str) else adjustment_id
    result = await db.execute(select(InventoryAdjustment).where(InventoryAdjustment.id == adj_uuid))
    adjustment = result.scalar_one_or_none()
    if not adjustment:
        return None

    # Si ya está en el nuevo workflow, redirigir
    if adjustment.estado == "pendiente_gerencia" and user_id:
        return await approve_adjustment_gerencia(db, adjustment_id, user_id)
    if adjustment.estado == "pendiente_administracion" and user_id:
        return await approve_adjustment_administracion(db, adjustment_id, user_id)

    # Flujo legado para estado=pendiente (ajustes históricos)
    if adjustment.estado != "pendiente":
        return None

    items_result = await db.execute(select(InventoryAdjustmentItem).where(InventoryAdjustmentItem.adjustment_id == adjustment.id))
    items = items_result.scalars().all()

    for item in items:
        if item.diferencia != 0:
            movement = InventoryMovement(
                company_id=adjustment.company_id,
                warehouse_id=adjustment.warehouse_id,
                product_id=item.product_id,
                variant_id=item.variant_id,
                tipo="ajuste",
                cantidad=int(item.diferencia),
                costo_unitario=item.costo_unitario,
                referencia_type="adjustment",
                referencia_id=adjustment.id,
                motivo=f"Ajuste {adjustment.codigo}: {adjustment.motivo}",
                user_id=user_id,
            )
            db.add(movement)

            stock = await get_stock(db, str(adjustment.warehouse_id), str(item.product_id))
            if stock:
                stock.cantidad = int(item.cantidad_fisica)
                stock.updated_at = datetime.now(timezone.utc)

    adjustment.estado = "aprobado"
    adjustment.aprobado_por = user_id
    adjustment.fecha_aprobacion = datetime.now(timezone.utc)

    await db.flush()
    await db.refresh(adjustment)
    return adjustment


async def list_movements(
    db: AsyncSession,
    company_id: str,
    product_id: str | None = None,
    warehouse_id: str | None = None,
    tipo: str | None = None,
    fecha_desde: str | None = None,
    fecha_hasta: str | None = None,
    limit: int = 100,
    offset: int = 0,
    search: str | None = None,
) -> list[dict]:
    from sqlalchemy import text
    import uuid
    from datetime import date as date_type

    comp_uuid = uuid.UUID(company_id) if isinstance(company_id, str) else company_id
    # product_id/warehouse_id SI van en el filtro interno -- solo acotan que
    # particion calcular, no alteran el saldo en si. tipo y el rango de
    # fecha van SOLO en el filtro externo: si fueran internos, dejar afuera
    # una ENTRADA o los movimientos previos a fecha_desde arruinaria el
    # saldo acumulado (mostraria un "saldo" que arranca de cero en la
    # fecha filtrada, no el stock real que habia en ese momento).
    inner_where = "im.company_id = :comp_id"
    params: dict = {"comp_id": comp_uuid, "limit": limit, "offset": offset}

    if product_id:
        inner_where += " AND im.product_id = :prod_id"
        params["prod_id"] = uuid.UUID(product_id) if isinstance(product_id, str) else product_id
    if warehouse_id:
        inner_where += " AND im.warehouse_id = :wh_id"
        params["wh_id"] = uuid.UUID(warehouse_id) if isinstance(warehouse_id, str) else warehouse_id

    outer_where = "1=1"
    if tipo:
        outer_where += " AND sub.tipo = :tipo"
        params["tipo"] = tipo
    if search and search.strip():
        outer_where += " AND (sub.product_nombre ILIKE :search OR sub.product_sku ILIKE :search OR sub.motivo ILIKE :search)"
        params["search"] = f"%{search.strip()}%"
    if fecha_desde:
        outer_where += " AND sub.created_at >= CAST(:fecha_desde AS date)"
        params["fecha_desde"] = date_type.fromisoformat(fecha_desde)
    if fecha_hasta:
        outer_where += " AND sub.created_at < (CAST(:fecha_hasta AS date) + interval '1 day')"
        params["fecha_hasta"] = date_type.fromisoformat(fecha_hasta)

    query = f"""
        SELECT * FROM (
            SELECT
                im.id, im.company_id, im.warehouse_id, im.product_id, im.variant_id,
                im.tipo, im.cantidad, im.costo_unitario, im.referencia_type, im.referencia_id,
                im.motivo, im.user_id, im.created_at,
                p.nombre as product_nombre, p.sku as product_sku,
                w.nombre as warehouse_nombre, w.codigo as warehouse_codigo,
                u.nombre as user_nombre,
                SUM(im.cantidad) OVER (
                    PARTITION BY im.product_id, im.warehouse_id
                    ORDER BY im.created_at, im.id
                ) AS saldo_acumulado
            FROM inventory_movements im
            LEFT JOIN products p ON p.id = im.product_id
            LEFT JOIN warehouses w ON w.id = im.warehouse_id
            LEFT JOIN users u ON u.id = im.user_id
            WHERE {inner_where}
        ) sub
        WHERE {outer_where}
        ORDER BY sub.created_at DESC
        LIMIT :limit OFFSET :offset
    """
    result = await db.execute(text(query), params)
    return [dict(r._mapping) for r in result]


async def list_adjustments(
    db: AsyncSession,
    company_id: str,
    warehouse_id: str | None = None,
    estado: str | None = None,
    riesgo: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> list[dict]:
    from sqlalchemy import text

    comp_uuid = uuid.UUID(company_id) if isinstance(company_id, str) else company_id
    where = "a.company_id = :comp_id"
    params: dict = {"comp_id": comp_uuid, "limit": limit, "offset": offset}

    if warehouse_id:
        where += " AND a.warehouse_id = :wh_id"
        params["wh_id"] = uuid.UUID(warehouse_id) if isinstance(warehouse_id, str) else warehouse_id
    if estado:
        where += " AND a.estado = :estado"
        params["estado"] = estado
    if riesgo:
        where += " AND a.riesgo = :riesgo"
        params["riesgo"] = riesgo

    query = f"""
        SELECT
            a.id, a.codigo,
            a.motivo_codigo, a.motivo_label, a.motivo_detalle, a.motivo,
            a.riesgo, a.estado,
            a.impacto_financiero_gs,
            a.evidencia_urls,
            a.aprobado_por_gerencia, a.aprobado_por_gerencia_nombre, a.fecha_aprobacion_gerencia,
            a.aprobado_por_administracion, a.aprobado_por_administracion_nombre, a.fecha_aprobacion_administracion,
            a.rechazado_por_nombre, a.motivo_rechazo, a.fecha_rechazo,
            a.user_id, a.observaciones, a.physical_session_id,
            a.created_at, a.updated_at,
            w.nombre as warehouse_nombre, w.codigo as warehouse_codigo,
            COUNT(ai.id) as total_items,
            COALESCE(SUM(ai.diferencia), 0) as diferencia_unidades
        FROM inventory_adjustments a
        LEFT JOIN warehouses w ON w.id = a.warehouse_id
        LEFT JOIN inventory_adjustment_items ai ON ai.adjustment_id = a.id
        WHERE {where}
        GROUP BY a.id, w.nombre, w.codigo
        ORDER BY a.created_at DESC
        LIMIT :limit OFFSET :offset
    """
    result = await db.execute(text(query), params)
    return [dict(r._mapping) for r in result]


async def get_adjustment_detail(db: AsyncSession, adjustment_id: str) -> dict | None:
    """Detalle completo de un ajuste: items + audit log."""
    adj_uuid = uuid.UUID(adjustment_id) if isinstance(adjustment_id, str) else adjustment_id
    result = await db.execute(
        select(InventoryAdjustment).where(InventoryAdjustment.id == adj_uuid)
    )
    adjustment = result.scalar_one_or_none()
    if not adjustment:
        return None

    items_result = await db.execute(
        select(InventoryAdjustmentItem).where(InventoryAdjustmentItem.adjustment_id == adj_uuid)
    )
    items = items_result.scalars().all()

    logs_result = await db.execute(
        select(StockAdjustmentAuditLog)
        .where(StockAdjustmentAuditLog.adjustment_id == adj_uuid)
        .order_by(StockAdjustmentAuditLog.created_at)
    )
    logs = logs_result.scalars().all()

    return {
        "adjustment": adjustment,
        "items": items,
        "audit_logs": logs,
    }


async def get_adjustment_motivos() -> list[dict]:
    """Retorna el catálogo de motivos con su nivel de riesgo."""
    return [
        {
            "codigo": code,
            "label": info["label"],
            "riesgo": info["riesgo"],
            "requiere_evidencia": info["riesgo"] in RIESGOS_CON_EVIDENCIA,
        }
        for code, info in MOTIVOS_AJUSTE.items()
    ]


async def record_quick_merma(
    db: AsyncSession,
    company_id: str,
    warehouse_id: str,
    product_id: str,
    cantidad: float,
    motivo: str,
    observaciones: str = "",
    user_id: uuid.UUID | None = None,
) -> dict:
    import uuid
    from datetime import datetime, timezone
    
    comp_uuid = uuid.UUID(company_id) if isinstance(company_id, str) else company_id
    wh_uuid = uuid.UUID(warehouse_id) if isinstance(warehouse_id, str) else warehouse_id
    prod_uuid = uuid.UUID(product_id) if isinstance(product_id, str) else product_id
    
    product = await db.get(Product, prod_uuid)
    if not product:
        raise ValueError("Producto no encontrado")
        
    costo = float(product.costo_promedio or product.ultimo_costo or 0)
    
    # 1. Crear ajuste tipo merma
    adj_code = f"MRM-{datetime.now(timezone.utc).strftime('%Y%m%d')}-{uuid.uuid4().hex[:4].upper()}"
    adjustment = InventoryAdjustment(
        company_id=comp_uuid,
        warehouse_id=wh_uuid,
        codigo=adj_code,
        motivo=f"Merma: {motivo}",
        estado="aprobado",
        observaciones=observaciones,
        user_id=user_id,
        aprobado_por=user_id,
        fecha_aprobacion=datetime.now(timezone.utc),
    )
    db.add(adjustment)
    await db.flush()
    
    # 2. Obtener stock actual
    stock = await get_stock(db, warehouse_id, product_id)
    stock_actual = stock.cantidad if stock else 0
    nuevo_stock = max(0, stock_actual - int(cantidad))
    
    # 3. Item de ajuste
    adj_item = InventoryAdjustmentItem(
        adjustment_id=adjustment.id,
        product_id=prod_uuid,
        cantidad_sistema=stock_actual,
        cantidad_fisica=nuevo_stock,
        diferencia=-int(cantidad),
        costo_unitario=costo,
    )
    db.add(adj_item)
    
    # 4. Movimiento Kardex
    movement = InventoryMovement(
        company_id=comp_uuid,
        warehouse_id=wh_uuid,
        product_id=prod_uuid,
        tipo="merma",
        cantidad=-int(cantidad),
        costo_unitario=costo,
        referencia_type="adjustment",
        referencia_id=adjustment.id,
        motivo=f"Merma ({motivo}): {observaciones}",
        user_id=user_id,
    )
    db.add(movement)
    
    # 5. Actualizar stock
    if stock:
        stock.cantidad = nuevo_stock
        stock.updated_at = datetime.now(timezone.utc)
    else:
        stock = Stock(
            warehouse_id=wh_uuid,
            product_id=prod_uuid,
            cantidad=nuevo_stock,
            costo_unitario=costo,
        )
        db.add(stock)
        
    await db.flush()
    return {
        "id": str(adjustment.id),
        "codigo": adjustment.codigo,
        "product_nombre": product.nombre,
        "cantidad_merma": cantidad,
        "costo_unitario": costo,
        "impacto_financiero_gs": cantidad * costo,
        "stock_restante": nuevo_stock,
    }


async def get_inventory_stats(db: AsyncSession, company_id: str) -> dict:
    from sqlalchemy import text
    import uuid
    
    comp_uuid = uuid.UUID(company_id) if isinstance(company_id, str) else company_id
    
    row = await db.execute(
        text("""
            WITH inv_agg AS (
                SELECT 
                    COUNT(DISTINCT s.product_id) as total_skus_almacenados,
                    COALESCE(SUM(s.cantidad), 0) as total_unidades_fisicas,
                    COALESCE(SUM(s.cantidad_reservada), 0) as total_unidades_reservadas,
                    COALESCE(SUM(s.cantidad * COALESCE(s.costo_unitario, p.costo_promedio, p.ultimo_costo, 0)), 0) as valor_total_costo,
                    COALESCE(SUM(s.cantidad * COALESCE(p.precio_venta, 0)), 0) as valor_total_venta_proyectada,
                    COUNT(p.id) FILTER (WHERE COALESCE(s.cantidad, 0) <= 0) as total_quiebres,
                    COUNT(p.id) FILTER (WHERE COALESCE(s.cantidad, 0) > 0 AND COALESCE(s.cantidad, 0) <= COALESCE(p.stock_minimo, 5)) as total_bajos
                FROM products p
                LEFT JOIN stock s ON s.product_id = p.id
                WHERE p.company_id = :comp_id AND p.activo = true
            ),
            mermas_agg AS (
                SELECT 
                    COALESCE(COUNT(im.id), 0) as cant_mermas_mes,
                    COALESCE(SUM(ABS(im.cantidad) * COALESCE(im.costo_unitario, 0)), 0) as monto_mermas_mes_gs
                FROM inventory_movements im
                WHERE im.company_id = :comp_id 
                  AND im.tipo = 'merma'
                  AND im.created_at >= NOW() - INTERVAL '30 days'
            )
            SELECT * FROM inv_agg, mermas_agg;
        """),
        {"comp_id": comp_uuid}
    )
    res = row.first()
    return {
        "total_skus_almacenados": int(res.total_skus_almacenados or 0) if res else 0,
        "total_unidades_fisicas": float(res.total_unidades_fisicas or 0) if res else 0,
        "total_unidades_reservadas": float(res.total_unidades_reservadas or 0) if res else 0,
        "valor_total_costo": float(res.valor_total_costo or 0) if res else 0.0,
        "valor_total_venta_proyectada": float(res.valor_total_venta_proyectada or 0) if res else 0.0,
        "total_quiebres": int(res.total_quiebres or 0) if res else 0,
        "total_bajos": int(res.total_bajos or 0) if res else 0,
        "cant_mermas_mes": int(res.cant_mermas_mes or 0) if res else 0,
        "monto_mermas_mes_gs": float(res.monto_mermas_mes_gs or 0) if res else 0.0,
    }


async def get_lots_expiries(
    db: AsyncSession,
    company_id: str,
    warehouse_id: str | None = None,
    estado: str | None = None,
    limit: int = 100,
    offset: int = 0,
) -> dict:
    from sqlalchemy import text
    from datetime import datetime, timezone, timedelta
    import uuid

    comp_id = uuid.UUID(company_id) if isinstance(company_id, str) else company_id

    # 1. Query KPIs for lots
    kpis_q = await db.execute(text("""
        SELECT 
            COUNT(*) as total_lotes,
            COALESCE(SUM(CASE WHEN fecha_vencimiento IS NOT NULL AND fecha_vencimiento < NOW() AND cantidad_disponible > 0 THEN 1 ELSE 0 END), 0) as vencidos,
            COALESCE(SUM(CASE WHEN fecha_vencimiento IS NOT NULL AND fecha_vencimiento >= NOW() AND fecha_vencimiento <= NOW() + INTERVAL '7 days' AND cantidad_disponible > 0 THEN 1 ELSE 0 END), 0) as critico_7d,
            COALESCE(SUM(CASE WHEN fecha_vencimiento IS NOT NULL AND fecha_vencimiento > NOW() + INTERVAL '7 days' AND fecha_vencimiento <= NOW() + INTERVAL '30 days' AND cantidad_disponible > 0 THEN 1 ELSE 0 END), 0) as alerta_30d,
            COALESCE(SUM(CASE WHEN fecha_vencimiento IS NOT NULL AND fecha_vencimiento <= NOW() + INTERVAL '30 days' AND cantidad_disponible > 0 THEN costo_unitario * cantidad_disponible ELSE 0 END), 0) as valor_en_riesgo,
            COALESCE(SUM(CASE WHEN cantidad_disponible > 0 THEN costo_unitario * cantidad_disponible ELSE 0 END), 0) as valor_total_stock
        FROM stock_lots
        WHERE company_id = :comp_id AND cantidad_disponible > 0
    """), {"comp_id": comp_id})
    k_row = kpis_q.fetchone()

    # 2. Query individual lots
    query_str = """
        SELECT 
            sl.id,
            sl.referencia,
            sl.warehouse_id,
            sl.product_id,
            COALESCE(p.nombre, 'Producto ' || SUBSTRING(sl.product_id::text, 1, 8)) as product_nombre,
            COALESCE(p.codigo_barra, p.sku, '') as product_codigo,
            COALESCE(cat.nombre, 'General') as categoria,
            sl.cantidad as cantidad_inicial,
            sl.cantidad_disponible,
            sl.costo_unitario,
            (sl.costo_unitario * sl.cantidad_disponible) as costo_total_disponible,
            sl.fecha_ingreso,
            sl.fecha_vencimiento,
            CASE 
                WHEN sl.fecha_vencimiento IS NULL THEN 9999
                ELSE EXTRACT(DAY FROM sl.fecha_vencimiento - NOW())::int
            END as dias_restantes,
            CASE 
                WHEN sl.fecha_vencimiento IS NULL THEN 'sin_vencimiento'
                WHEN sl.fecha_vencimiento < NOW() THEN 'vencido'
                WHEN sl.fecha_vencimiento <= NOW() + INTERVAL '7 days' THEN 'critico_7d'
                WHEN sl.fecha_vencimiento <= NOW() + INTERVAL '30 days' THEN 'alerta_30d'
                ELSE 'vigente'
            END as estado_vencimiento
        FROM stock_lots sl
        LEFT JOIN products p ON sl.product_id = p.id
        LEFT JOIN product_categories cat ON p.categoria_id = cat.id
        WHERE sl.company_id = :comp_id AND sl.cantidad_disponible > 0
    """
    params: dict = {"comp_id": comp_id, "limit": limit, "offset": offset}
    if warehouse_id:
        query_str += " AND sl.warehouse_id = :wh_id"
        params["wh_id"] = uuid.UUID(warehouse_id) if isinstance(warehouse_id, str) else warehouse_id

    if estado == "vencido":
        query_str += " AND sl.fecha_vencimiento IS NOT NULL AND sl.fecha_vencimiento < NOW()"
    elif estado == "critico_7d":
        query_str += " AND sl.fecha_vencimiento IS NOT NULL AND sl.fecha_vencimiento >= NOW() AND sl.fecha_vencimiento <= NOW() + INTERVAL '7 days'"
    elif estado == "alerta_30d":
        query_str += " AND sl.fecha_vencimiento IS NOT NULL AND sl.fecha_vencimiento > NOW() + INTERVAL '7 days' AND sl.fecha_vencimiento <= NOW() + INTERVAL '30 days'"
    elif estado == "vigente":
        query_str += " AND (sl.fecha_vencimiento IS NULL OR sl.fecha_vencimiento > NOW() + INTERVAL '30 days')"

    query_str += """
        ORDER BY 
            CASE 
                WHEN sl.fecha_vencimiento IS NULL THEN 2 
                ELSE 1 
            END,
            sl.fecha_vencimiento ASC
        LIMIT :limit OFFSET :offset
    """

    res = await db.execute(text(query_str), params)
    lots = []
    for r in res.fetchall():
        lots.append({
            "id": str(r.id),
            "referencia": r.referencia or "LOTE-STD",
            "warehouse_id": str(r.warehouse_id),
            "product_id": str(r.product_id),
            "product_nombre": r.product_nombre,
            "product_codigo": r.product_codigo,
            "categoria": r.categoria.strip() if r.categoria else "General",
            "cantidad_inicial": int(r.cantidad_inicial or 0),
            "cantidad_disponible": int(r.cantidad_disponible or 0),
            "costo_unitario": float(r.costo_unitario or 0),
            "costo_total_disponible": float(r.costo_total_disponible or 0),
            "fecha_ingreso": r.fecha_ingreso.isoformat() if r.fecha_ingreso else None,
            "fecha_vencimiento": r.fecha_vencimiento.isoformat() if r.fecha_vencimiento else None,
            "dias_restantes": int(r.dias_restantes),
            "estado_vencimiento": r.estado_vencimiento,
        })

    return {
        "kpis": {
            "total_lotes": int(k_row.total_lotes or 0) if k_row else 0,
            "vencidos": int(k_row.vencidos or 0) if k_row else 0,
            "critico_7d": int(k_row.critico_7d or 0) if k_row else 0,
            "alerta_30d": int(k_row.alerta_30d or 0) if k_row else 0,
            "valor_en_riesgo": float(k_row.valor_en_riesgo or 0) if k_row else 0.0,
            "valor_total_stock": float(k_row.valor_total_stock or 0) if k_row else 0.0,
        },
        "lots": lots,
    }

async def get_kardex_summary(
    db: AsyncSession,
    company_id: str,
    fecha_desde: str | None = None,
    fecha_hasta: str | None = None,
) -> dict:
    """Estadisticas para el dashboard del Kardex: totales del periodo, top
    productos por volumen movido, y movimientos por dia para el mini-grafico.
    Sin fecha_desde/fecha_hasta, se limita a los ultimos 30 dias -- sino,
    con 780K+ movimientos historicos, agregar "todo" seria carisimo y poco
    util como resumen."""
    from sqlalchemy import text
    import uuid
    from datetime import date as date_type

    comp_uuid = uuid.UUID(company_id) if isinstance(company_id, str) else company_id
    where = "im.company_id = :comp_id"
    params: dict = {"comp_id": comp_uuid}

    if fecha_desde:
        where += " AND im.created_at >= :fecha_desde"
        params["fecha_desde"] = date_type.fromisoformat(fecha_desde)
    if fecha_hasta:
        where += " AND im.created_at < (CAST(:fecha_hasta AS date) + interval '1 day')"
        params["fecha_hasta"] = date_type.fromisoformat(fecha_hasta)
    if not fecha_desde and not fecha_hasta:
        where += " AND im.created_at >= NOW() - INTERVAL '30 days'"

    totales_row = await db.execute(
        text(f"""
            SELECT
                COUNT(*) AS total_movimientos,
                COUNT(DISTINCT im.product_id) AS productos_con_movimiento,
                COALESCE(SUM(im.cantidad) FILTER (WHERE im.cantidad > 0), 0) AS total_entradas,
                COALESCE(SUM(im.cantidad) FILTER (WHERE im.cantidad < 0), 0) AS total_salidas,
                COUNT(*) FILTER (WHERE im.referencia_type = 'legacy_import') AS total_legacy
            FROM inventory_movements im
            WHERE {where}
        """),
        params,
    )
    totales = totales_row.first()

    top_result = await db.execute(
        text(f"""
            SELECT p.nombre, p.sku, SUM(ABS(im.cantidad)) AS volumen, COUNT(*) AS movimientos
            FROM inventory_movements im
            LEFT JOIN products p ON p.id = im.product_id
            WHERE {where}
            GROUP BY p.nombre, p.sku
            ORDER BY volumen DESC
            LIMIT 8
        """),
        params,
    )
    top_productos = [
        {"nombre": r[0] or "Producto", "sku": r[1], "volumen": float(r[2]), "movimientos": r[3]}
        for r in top_result
    ]

    dias_result = await db.execute(
        text(f"""
            SELECT
                date_trunc('day', im.created_at)::date AS dia,
                COALESCE(SUM(im.cantidad) FILTER (WHERE im.cantidad > 0), 0) AS entradas,
                COALESCE(SUM(im.cantidad) FILTER (WHERE im.cantidad < 0), 0) AS salidas
            FROM inventory_movements im
            WHERE {where}
            GROUP BY 1
            ORDER BY 1
        """),
        params,
    )
    por_dia = [
        {"dia": r[0].isoformat(), "entradas": float(r[1]), "salidas": float(r[2])}
        for r in dias_result
    ]

    return {
        "total_movimientos": totales.total_movimientos if totales else 0,
        "productos_con_movimiento": totales.productos_con_movimiento if totales else 0,
        "total_entradas": float(totales.total_entradas) if totales else 0.0,
        "total_salidas": float(totales.total_salidas) if totales else 0.0,
        "total_legacy": totales.total_legacy if totales else 0,
        "top_productos": top_productos,
        "por_dia": por_dia,
    }



# ---------------------------------------------------------------------------
# Toma Física de Inventario
# ---------------------------------------------------------------------------

async def create_physical_session(
    db: AsyncSession,
    data: PhysicalSessionCreate,
    user_id: uuid.UUID | None = None,
    user_nombre: str | None = None,
) -> PhysicalInventorySession:
    """Crea una sesión de toma física y pre-carga los ítems con el stock actual.
    
    El stock del sistema queda congelado en cada ítem (cantidad_sistema).
    Los contadores registran sus conteos sin ver los valores del sistema.
    """
    from sqlalchemy import text as sqtext

    session_code = f"TF-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M')}-{uuid.uuid4().hex[:4].upper()}"
    session = PhysicalInventorySession(
        company_id=data.company_id,
        warehouse_id=data.warehouse_id,
        codigo=session_code,
        tipo=data.tipo,
        categoria_id=data.categoria_id,
        pasillo=data.pasillo,
        descripcion_alcance=data.descripcion_alcance,
        notas=data.notas,
        estado="abierta",
        creado_por=user_id,
        creado_por_nombre=user_nombre,
        contador_1_id=data.contador_1_id,
        contador_1_nombre=data.contador_1_nombre,
        contador_2_id=data.contador_2_id,
        contador_2_nombre=data.contador_2_nombre,
        fecha_inicio=datetime.now(timezone.utc),
    )
    db.add(session)
    await db.flush()

    # Pre-cargar ítems con stock actual del depósito
    query_params: dict = {"wh_id": data.warehouse_id}
    items_query = """
        SELECT
            s.product_id,
            p.nombre as product_nombre,
            p.sku as product_sku,
            COALESCE(p.codigo_barra, '') as product_codigo_barra,
            s.cantidad as cantidad_sistema,
            COALESCE(s.costo_unitario, p.costo_promedio, p.ultimo_costo, 0) as costo_unitario
        FROM stock s
        JOIN products p ON p.id = s.product_id
        WHERE s.warehouse_id = :wh_id AND p.activo = true
    """
    if data.categoria_id:
        items_query += " AND p.categoria_id = :cat_id"
        query_params["cat_id"] = data.categoria_id

    items_query += " ORDER BY p.nombre"

    items_result = await db.execute(sqtext(items_query), query_params)
    items_rows = items_result.fetchall()

    for row in items_rows:
        item = PhysicalInventorySessionItem(
            session_id=session.id,
            product_id=row.product_id,
            product_nombre=row.product_nombre,
            product_sku=row.product_sku,
            product_codigo_barra=row.product_codigo_barra,
            cantidad_sistema=float(row.cantidad_sistema or 0),
            costo_unitario=int(row.costo_unitario or 0) if row.costo_unitario else None,
            estado="pendiente",
        )
        db.add(item)

    session.total_items = len(items_rows)
    session.estado = "en_conteo"
    await db.flush()
    await db.refresh(session)
    return session


async def get_physical_session(db: AsyncSession, session_id: str) -> PhysicalInventorySession | None:
    sid = uuid.UUID(session_id) if isinstance(session_id, str) else session_id
    result = await db.execute(
        select(PhysicalInventorySession).where(PhysicalInventorySession.id == sid)
    )
    return result.scalar_one_or_none()


async def list_physical_sessions(
    db: AsyncSession,
    company_id: str,
    warehouse_id: str | None = None,
    estado: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> list[dict]:
    from sqlalchemy import text as sqtext

    comp_uuid = uuid.UUID(company_id) if isinstance(company_id, str) else company_id
    where = "s.company_id = :comp_id"
    params: dict = {"comp_id": comp_uuid, "limit": limit, "offset": offset}

    if warehouse_id:
        where += " AND s.warehouse_id = :wh_id"
        params["wh_id"] = uuid.UUID(warehouse_id) if isinstance(warehouse_id, str) else warehouse_id
    if estado:
        where += " AND s.estado = :estado"
        params["estado"] = estado

    query = f"""
        SELECT
            s.id, s.codigo, s.tipo, s.estado,
            s.total_items, s.items_con_diferencia,
            s.diferencia_total_unidades, s.diferencia_total_gs,
            s.creado_por_nombre, s.contador_1_nombre, s.contador_2_nombre, s.cerrado_por_nombre,
            s.fecha_inicio, s.fecha_cierre,
            s.adjustment_id, s.notas, s.descripcion_alcance,
            s.created_at,
            w.nombre as warehouse_nombre
        FROM physical_inventory_sessions s
        LEFT JOIN warehouses w ON w.id = s.warehouse_id
        WHERE {where}
        ORDER BY s.created_at DESC
        LIMIT :limit OFFSET :offset
    """
    result = await db.execute(sqtext(query), params)
    return [dict(r._mapping) for r in result]


async def register_item_count(
    db: AsyncSession,
    session_id: str,
    item_id: str,
    body: PhysicalSessionItemCountBody,
    user_id: uuid.UUID | None = None,
) -> PhysicalInventorySessionItem:
    """Registra el conteo 1 o 2 de un ítem. El contador 2 no ve el conteo 1 (doble ciego)."""
    sid = uuid.UUID(session_id) if isinstance(session_id, str) else session_id
    iid = uuid.UUID(item_id) if isinstance(item_id, str) else item_id

    session_res = await db.execute(
        select(PhysicalInventorySession).where(PhysicalInventorySession.id == sid)
    )
    session = session_res.scalar_one_or_none()
    if not session or session.estado not in ("en_conteo", "abierta"):
        raise ValueError("La sesión no está activa para recibir conteos")

    item_res = await db.execute(
        select(PhysicalInventorySessionItem).where(
            PhysicalInventorySessionItem.id == iid,
            PhysicalInventorySessionItem.session_id == sid,
        )
    )
    item = item_res.scalar_one_or_none()
    if not item:
        raise ValueError("Ítem no encontrado en la sesión")

    now = datetime.now(timezone.utc)
    if body.numero_conteo == 1:
        item.cantidad_conteo_1 = float(body.cantidad)
        item.contado_1_at = now
        item.contado_1_by = user_id
        item.estado = "conteo_1"
    else:
        if item.cantidad_conteo_1 is None:
            raise ValueError("Debe completarse el primer conteo antes del segundo")
        item.cantidad_conteo_2 = float(body.cantidad)
        item.contado_2_at = now
        item.contado_2_by = user_id

        # Si ambos conteos son iguales, auto-reconciliar
        if abs(float(body.cantidad) - float(item.cantidad_conteo_1)) < 0.001:
            item.cantidad_final = float(body.cantidad)
            item.diferencia = float(body.cantidad) - float(item.cantidad_sistema)
            item.impacto_gs = int(abs(item.diferencia) * float(item.costo_unitario or 0))
            item.estado = "reconciliado"
        else:
            item.estado = "conteo_2"  # Discrepancia — requiere reconciliación manual

    await db.flush()
    await db.refresh(item)
    return item


async def reconcile_item(
    db: AsyncSession,
    session_id: str,
    item_id: str,
    body: PhysicalSessionItemReconcileBody,
    user_id: uuid.UUID | None = None,
) -> PhysicalInventorySessionItem:
    """Supervisor reconcilia diferencia entre conteo 1 y 2."""
    sid = uuid.UUID(session_id) if isinstance(session_id, str) else session_id
    iid = uuid.UUID(item_id) if isinstance(item_id, str) else item_id

    item_res = await db.execute(
        select(PhysicalInventorySessionItem).where(
            PhysicalInventorySessionItem.id == iid,
            PhysicalInventorySessionItem.session_id == sid,
        )
    )
    item = item_res.scalar_one_or_none()
    if not item:
        raise ValueError("Ítem no encontrado")
    if item.estado not in ("conteo_2", "conteo_1"):
        raise ValueError(f"El ítem no requiere reconciliación (estado: {item.estado})")

    item.cantidad_final = float(body.cantidad_final)
    item.diferencia = float(body.cantidad_final) - float(item.cantidad_sistema)
    item.impacto_gs = int(abs(item.diferencia) * float(item.costo_unitario or 0))
    item.reconciliado_by = user_id
    item.nota_reconciliacion = body.nota_reconciliacion
    item.estado = "reconciliado"

    await db.flush()
    await db.refresh(item)
    return item


async def close_physical_session(
    db: AsyncSession,
    session_id: str,
    user_id: uuid.UUID | None = None,
    user_nombre: str | None = None,
    ip_address: str | None = None,
) -> dict:
    """Cierra la sesión y genera automáticamente un InventoryAdjustment con las diferencias.
    
    El ajuste generado entra directamente al workflow de doble aprobación.
    Solo items con diferencia != 0 se incluyen en el ajuste.
    """
    sid = uuid.UUID(session_id) if isinstance(session_id, str) else session_id

    session_res = await db.execute(
        select(PhysicalInventorySession).where(PhysicalInventorySession.id == sid)
    )
    session = session_res.scalar_one_or_none()
    if not session:
        raise ValueError("Sesión no encontrada")
    if session.estado not in ("en_conteo", "abierta"):
        raise ValueError(f"La sesión no puede cerrarse (estado: {session.estado})")

    # Verificar que todos los ítems estén reconciliados
    items_result = await db.execute(
        select(PhysicalInventorySessionItem).where(
            PhysicalInventorySessionItem.session_id == sid
        )
    )
    items = items_result.scalars().all()

    pendientes = [i for i in items if i.estado in ("pendiente", "conteo_2") and i.cantidad_conteo_1 is not None]
    if pendientes:
        raise ValueError(
            f"Hay {len(pendientes)} ítem(s) con discrepancias sin reconciliar. "
            "Reconcílielos antes de cerrar la sesión."
        )

    # Calcular totales
    items_con_diff = [i for i in items if i.diferencia and abs(float(i.diferencia)) > 0.001]
    diferencia_total_unidades = sum(float(i.diferencia or 0) for i in items_con_diff)
    diferencia_total_gs = sum(float(i.impacto_gs or 0) for i in items_con_diff)

    session.estado = "cerrada"
    session.items_con_diferencia = len(items_con_diff)
    session.diferencia_total_unidades = diferencia_total_unidades
    session.diferencia_total_gs = diferencia_total_gs
    session.cerrado_por = user_id
    session.cerrado_por_nombre = user_nombre
    session.fecha_cierre = datetime.now(timezone.utc)

    adjustment = None
    if items_con_diff:
        # Crear ajuste automáticamente para las diferencias
        adj_code = f"ADJ-TF-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M')}-{uuid.uuid4().hex[:4].upper()}"
        motivo_info = MOTIVOS_AJUSTE["conteo_fisico"]

        adjustment = InventoryAdjustment(
            company_id=session.company_id,
            warehouse_id=session.warehouse_id,
            codigo=adj_code,
            motivo_codigo="conteo_fisico",
            motivo_label=motivo_info["label"],
            motivo_detalle=(
                f"Toma física {session.codigo} ({session.tipo}). "
                f"{len(items_con_diff)} productos con diferencia. "
                f"Impacto total: Gs. {int(diferencia_total_gs):,}"
            ),
            motivo=motivo_info["label"],
            riesgo=motivo_info["riesgo"],
            estado="pendiente_gerencia",
            impacto_financiero_gs=int(diferencia_total_gs),
            user_id=user_id,
            physical_session_id=session.id,
        )
        db.add(adjustment)
        await db.flush()

        for item in items_con_diff:
            adj_item = InventoryAdjustmentItem(
                adjustment_id=adjustment.id,
                product_id=item.product_id,
                product_nombre=item.product_nombre,
                product_sku=item.product_sku,
                cantidad_sistema=float(item.cantidad_sistema),
                cantidad_fisica=float(item.cantidad_final or item.cantidad_conteo_1 or 0),
                diferencia=float(item.diferencia or 0),
                costo_unitario=item.costo_unitario,
                impacto_gs=int(item.impacto_gs or 0),
            )
            db.add(adj_item)

        await db.flush()

        # Audit log del ajuste generado automáticamente
        await _write_audit_log(
            db,
            adjustment_id=adjustment.id,
            accion="creado",
            user_id=user_id or uuid.UUID(int=0),
            user_nombre=user_nombre,
            rol_firmante="sistema",
            comentario=(
                f"Ajuste generado automáticamente al cerrar toma física {session.codigo}. "
                f"{len(items_con_diff)} productos afectados."
            ),
            ip_address=ip_address,
            metadata_extra={"origen": "toma_fisica", "session_id": str(session.id)},
        )

        session.adjustment_id = adjustment.id
        await db.flush()

    await db.refresh(session)
    return {
        "session": session,
        "adjustment_id": str(adjustment.id) if adjustment else None,
        "items_con_diferencia": len(items_con_diff),
        "diferencia_total_gs": diferencia_total_gs,
    }

