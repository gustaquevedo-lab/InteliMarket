"""Advanced Inventory service — locations, picking, cycles, FIFO, consignment, auto-replenish"""

import uuid
from datetime import datetime, timezone, timedelta
from decimal import Decimal
from uuid import UUID

from sqlalchemy import select, func, and_, text
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.advanced_inventory.models import (
    StorageLocation, PickingList, PickingListItem, CycleCount, CycleCountItem,
    ConsignmentStock, ConsignmentMovement, AutoReplenishRule,
)
from api.src.inventory.models import StockLot, Stock, InventoryMovement, Warehouse
from api.src.products.models import Product


# ═══════════════════════════════════════════════════════════════════
#  STORAGE LOCATIONS
# ═══════════════════════════════════════════════════════════════════

async def create_location(db: AsyncSession, company_id: str, data: dict) -> dict:
    loc = StorageLocation(
        company_id=UUID(company_id), warehouse_id=UUID(data["warehouse_id"]),
        codigo=data["codigo"], pasillo=data.get("pasillo"), estante=data.get("estante"),
        posicion=data.get("posicion"), capacidad_maxima=Decimal(str(data["capacidad_maxima"])) if data.get("capacidad_maxima") else None,
    )
    db.add(loc); await db.flush(); await db.refresh(loc)
    return _loc_to_dict(loc)


async def list_locations(db: AsyncSession, company_id: str, warehouse_id: str = "") -> list[dict]:
    q = select(StorageLocation).where(StorageLocation.company_id == UUID(company_id), StorageLocation.activo == True)
    if warehouse_id:
        q = q.where(StorageLocation.warehouse_id == UUID(warehouse_id))
    q = q.order_by(StorageLocation.codigo)
    r = await db.execute(q)
    return [_loc_to_dict(l) for l in r.scalars().all()]


async def update_location(db: AsyncSession, company_id: str, loc_id: str, data: dict) -> dict:
    r = await db.execute(select(StorageLocation).where(StorageLocation.id == UUID(loc_id), StorageLocation.company_id == UUID(company_id)))
    loc = r.scalar_one_or_none()
    if not loc: raise ValueError("Ubicación no encontrada")
    for k, v in data.items():
        if v is not None and hasattr(loc, k):
            if k == "capacidad_maxima": v = Decimal(str(v))
            setattr(loc, k, v)
    await db.flush(); await db.refresh(loc)
    return _loc_to_dict(loc)


def _loc_to_dict(l):
    return {"id": str(l.id), "warehouse_id": str(l.warehouse_id), "codigo": l.codigo,
            "pasillo": l.pasillo, "estante": l.estante, "posicion": l.posicion,
            "capacidad_maxima": float(l.capacidad_maxima) if l.capacidad_maxima else None,
            "activo": l.activo, "created_at": l.created_at}


# ═══════════════════════════════════════════════════════════════════
#  PICKING LISTS
# ═══════════════════════════════════════════════════════════════════

async def create_picking_list(db: AsyncSession, company_id: str, data: dict) -> dict:
    pl = PickingList(
        company_id=UUID(company_id), warehouse_id=UUID(data["warehouse_id"]),
        numero=data["numero"], referencia_tipo=data.get("referencia_tipo"),
        referencia_id=UUID(data["referencia_id"]) if data.get("referencia_id") else None,
        notas=data.get("notas"),
    )
    db.add(pl); await db.flush()
    total = 0
    for item_data in data.get("items", []):
        item = PickingListItem(
            picking_list_id=pl.id, product_id=UUID(item_data["product_id"]),
            product_nombre=item_data.get("product_nombre"),
            cantidad_solicitada=Decimal(str(item_data["cantidad"])),
        )
        db.add(item); total += 1
    pl.total_items = total
    await db.flush(); await db.refresh(pl)
    return await get_picking_list(db, company_id, str(pl.id))


async def list_picking_lists(db: AsyncSession, company_id: str, estado: str = "", limit: int = 50) -> list[dict]:
    q = select(PickingList).where(PickingList.company_id == UUID(company_id))
    if estado: q = q.where(PickingList.estado == estado)
    q = q.order_by(PickingList.created_at.desc()).limit(limit)
    r = await db.execute(q)
    return [_pl_to_dict(pl) for pl in r.scalars().all()]


async def get_picking_list(db: AsyncSession, company_id: str, pl_id: str) -> dict:
    r = await db.execute(select(PickingList).where(PickingList.id == UUID(pl_id), PickingList.company_id == UUID(company_id)))
    pl = r.scalar_one_or_none()
    if not pl: raise ValueError("Picking list no encontrada")
    return _pl_to_dict(pl)


async def assign_picking_list(db: AsyncSession, company_id: str, pl_id: str, user_id: str) -> dict:
    r = await db.execute(select(PickingList).where(PickingList.id == UUID(pl_id), PickingList.company_id == UUID(company_id)))
    pl = r.scalar_one_or_none()
    if not pl: raise ValueError("Picking list no encontrada")
    pl.assigned_to = UUID(user_id)
    pl.estado = "asignado"
    pl.started_at = datetime.now(timezone.utc)
    await db.flush()
    return _pl_to_dict(pl)


async def pick_item(db: AsyncSession, company_id: str, pl_id: str, item_id: str, data: dict) -> dict:
    r = await db.execute(select(PickingList).where(PickingList.id == UUID(pl_id), PickingList.company_id == UUID(company_id)))
    pl = r.scalar_one_or_none()
    if not pl: raise ValueError("Picking list no encontrada")
    item = next((i for i in pl.items if str(i.id) == item_id), None)
    if not item: raise ValueError("Item no encontrado")

    cantidad = Decimal(str(data["cantidad"]))
    item.cantidad_pickeada = (item.cantidad_pickeada or Decimal(0)) + cantidad
    if data.get("lot_id"): item.lot_id = UUID(data["lot_id"])
    if data.get("location_id"): item.location_id = UUID(data["location_id"])
    item.estado = "completado"

    # FIFO allocation: reduce from StockLot
    if data.get("lot_id"):
        lr = await db.execute(select(StockLot).where(StockLot.id == UUID(data["lot_id"])))
        lot = lr.scalar_one_or_none()
        if lot:
            lot.cantidad_disponible = (lot.cantidad_disponible or Decimal(0)) - cantidad

    # Reduce main stock
    sr = await db.execute(
        select(Stock).where(Stock.warehouse_id == pl.warehouse_id, Stock.product_id == item.product_id)
    )
    stock = sr.scalar_one_or_none()
    if stock:
        stock.cantidad = (stock.cantidad or Decimal(0)) - cantidad

    # Record movement
    mov = InventoryMovement(
        company_id=UUID(company_id), warehouse_id=pl.warehouse_id,
        product_id=item.product_id, tipo="salida_picking",
        cantidad=cantidad, referencia_type="picking", referencia_id=pl.id,
    )
    db.add(mov)
    pl.picked_items = sum(1 for i in pl.items if i.estado == "completado")
    if pl.picked_items >= pl.total_items:
        pl.estado = "completado"
        pl.completed_at = datetime.now(timezone.utc)
    await db.flush()
    return _pl_to_dict(pl)


def _pl_to_dict(pl):
    items = []
    for i in (pl.items or []):
        items.append({"id": str(i.id), "product_id": str(i.product_id),
                      "product_nombre": i.product_nombre,
                      "cantidad_solicitada": float(i.cantidad_solicitada),
                      "cantidad_pickeada": float(i.cantidad_pickeada or 0),
                      "location_id": str(i.location_id) if i.location_id else None,
                      "lot_id": str(i.lot_id) if i.lot_id else None,
                      "estado": i.estado, "notas": i.notas})
    return {"id": str(pl.id), "warehouse_id": str(pl.warehouse_id), "numero": pl.numero,
            "estado": pl.estado, "assigned_to": str(pl.assigned_to) if pl.assigned_to else None,
            "total_items": pl.total_items, "picked_items": pl.picked_items,
            "notas": pl.notas, "items": items,
            "started_at": pl.started_at, "completed_at": pl.completed_at, "created_at": pl.created_at}


# ═══════════════════════════════════════════════════════════════════
#  CYCLE COUNTS
# ═══════════════════════════════════════════════════════════════════

async def create_cycle_count(db: AsyncSession, company_id: str, data: dict) -> dict:
    num = f"CC-{datetime.now(timezone.utc).strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"
    cc = CycleCount(
        company_id=UUID(company_id), warehouse_id=UUID(data["warehouse_id"]),
        numero=num, tipo=data.get("tipo", "rotativo"), notas=data.get("notas"),
    )
    db.add(cc); await db.flush(); await db.refresh(cc)
    return _cc_to_dict(cc)


async def list_cycle_counts(db: AsyncSession, company_id: str, estado: str = "") -> list[dict]:
    q = select(CycleCount).where(CycleCount.company_id == UUID(company_id))
    if estado: q = q.where(CycleCount.estado == estado)
    q = q.order_by(CycleCount.created_at.desc())
    r = await db.execute(q)
    return [_cc_to_dict(cc) for cc in r.scalars().all()]


async def add_cycle_count_item(db: AsyncSession, company_id: str, cc_id: str, data: dict) -> dict:
    r = await db.execute(select(CycleCount).where(CycleCount.id == UUID(cc_id), CycleCount.company_id == UUID(company_id)))
    cc = r.scalar_one_or_none()
    if not cc: raise ValueError("Conteo no encontrado")
    # Get product name
    pr = await db.execute(select(Product).where(Product.id == UUID(data["product_id"])))
    p = pr.scalar_one_or_none()
    item = CycleCountItem(
        cycle_count_id=cc.id, product_id=UUID(data["product_id"]),
        product_nombre=p.nombre if p else None,
        cantidad_sistema=Decimal(str(data["cantidad_sistema"])),
    )
    db.add(item)
    cc.conteo_total = (cc.conteo_total or 0) + 1
    await db.flush()
    return _cc_to_dict(cc)


async def record_count(db: AsyncSession, company_id: str, cc_id: str, item_id: str, data: dict) -> dict:
    r = await db.execute(select(CycleCount).where(CycleCount.id == UUID(cc_id), CycleCount.company_id == UUID(company_id)))
    cc = r.scalar_one_or_none()
    if not cc: raise ValueError("Conteo no encontrado")
    item = next((i for i in cc.items if str(i.id) == item_id), None)
    if not item: raise ValueError("Item no encontrado")
    item.cantidad_fisica = Decimal(str(data["cantidad_fisica"]))
    item.diferencia = (item.cantidad_fisica or Decimal(0)) - (item.cantidad_sistema or Decimal(0))
    item.estado = "contado"
    item.counted_at = datetime.now(timezone.utc)
    if data.get("location_id"): item.location_id = UUID(data["location_id"])
    if data.get("notas"): item.notas = data["notas"]
    cc.conteo_completado = sum(1 for i in cc.items if i.estado == "contado")
    if item.diferencia != 0: cc.discrepancias = sum(1 for i in cc.items if i.diferencia and i.diferencia != 0)
    await db.flush()
    return _cc_to_dict(cc)


async def complete_cycle_count(db: AsyncSession, company_id: str, cc_id: str) -> dict:
    r = await db.execute(select(CycleCount).where(CycleCount.id == UUID(cc_id), CycleCount.company_id == UUID(company_id)))
    cc = r.scalar_one_or_none()
    if not cc: raise ValueError("Conteo no encontrado")
    # Apply all discrepancies to stock
    for item in cc.items:
        if item.estado == "contado" and item.diferencia and item.diferencia != 0:
            sr = await db.execute(
                select(Stock).where(Stock.warehouse_id == cc.warehouse_id, Stock.product_id == item.product_id)
            )
            stock = sr.scalar_one_or_none()
            if stock:
                stock.cantidad = (stock.cantidad or Decimal(0)) + item.diferencia
            mov = InventoryMovement(
                company_id=UUID(company_id), warehouse_id=cc.warehouse_id,
                product_id=item.product_id, tipo="ajuste_conteo",
                cantidad=abs(item.diferencia), motivo=f"Conteo cíclico {cc.numero}: diff {float(item.diferencia)}",
                referencia_type="cycle_count", referencia_id=cc.id,
            )
            db.add(mov)
    cc.estado = "completado"
    cc.completed_at = datetime.now(timezone.utc)
    await db.flush()
    return _cc_to_dict(cc)


def _cc_to_dict(cc):
    items = [{"id": str(i.id), "product_id": str(i.product_id), "product_nombre": i.product_nombre,
              "cantidad_sistema": float(i.cantidad_sistema), "cantidad_fisica": float(i.cantidad_fisica) if i.cantidad_fisica is not None else None,
              "diferencia": float(i.diferencia) if i.diferencia is not None else None,
              "estado": i.estado, "notas": i.notas, "counted_at": i.counted_at} for i in (cc.items or [])]
    return {"id": str(cc.id), "warehouse_id": str(cc.warehouse_id), "numero": cc.numero,
            "tipo": cc.tipo, "estado": cc.estado, "conteo_total": cc.conteo_total,
            "conteo_completado": cc.conteo_completado, "discrepancias": cc.discrepancias,
            "items": items, "notas": cc.notas, "created_at": cc.created_at}


# ═══════════════════════════════════════════════════════════════════
#  LOTS / FIFO
# ═══════════════════════════════════════════════════════════════════

async def list_lots(db: AsyncSession, company_id: str, product_id: str = "", warehouse_id: str = "",
                    expiring_soon_days: int = 0) -> list[dict]:
    from api.src.inventory.models import StockLot
    q = select(StockLot).where(StockLot.company_id == UUID(company_id))
    if product_id: q = q.where(StockLot.product_id == UUID(product_id))
    if warehouse_id: q = q.where(StockLot.warehouse_id == UUID(warehouse_id))
    if expiring_soon_days > 0:
        cutoff = datetime.now(timezone.utc) + timedelta(days=expiring_soon_days)
        q = q.where(StockLot.fecha_vencimiento <= cutoff)
    q = q.order_by(StockLot.fecha_ingreso.asc())
    r = await db.execute(q)
    return [_lot_to_dict(l) for l in r.scalars().all()]


async def allocate_fifo(db: AsyncSession, company_id: str, data: dict) -> dict:
    """Allocate quantity from lots using FIFO (oldest first)."""
    from api.src.inventory.models import StockLot
    q = select(StockLot).where(
        StockLot.company_id == UUID(company_id),
        StockLot.product_id == UUID(data["product_id"]),
        StockLot.warehouse_id == UUID(data["warehouse_id"]),
        StockLot.cantidad_disponible > 0,
    ).order_by(StockLot.fecha_ingreso.asc())
    r = await db.execute(q)
    lots = r.scalars().all()

    needed = Decimal(str(data["cantidad"]))
    allocations = []
    for lot in lots:
        if needed <= 0: break
        take = min(needed, lot.cantidad_disponible)
        lot.cantidad_disponible = (lot.cantidad_disponible or Decimal(0)) - take
        needed -= take
        allocations.append({"lot_id": str(lot.id), "cantidad": float(take),
                            "referencia": lot.referencia, "fecha_vencimiento": lot.fecha_vencimiento})

    if needed > 0:
        raise ValueError(f"Stock insuficiente en lotes. Faltan {float(needed)} unidades")

    await db.flush()
    return {"allocations": allocations, "total_allocated": float(Decimal(str(data["cantidad"])) - needed)}


def _lot_to_dict(l):
    return {"id": str(l.id), "product_id": str(l.product_id), "warehouse_id": str(l.warehouse_id),
            "cantidad": float(l.cantidad or 0), "cantidad_disponible": float(l.cantidad_disponible or 0),
            "referencia": l.referencia, "fecha_ingreso": l.fecha_ingreso,
            "fecha_vencimiento": l.fecha_vencimiento,
            "costo_unitario": float(l.costo_unitario) if l.costo_unitario else None}


# ═══════════════════════════════════════════════════════════════════
#  CONSIGNMENT
# ═══════════════════════════════════════════════════════════════════

async def create_consignment(db: AsyncSession, company_id: str, data: dict) -> dict:
    cs = ConsignmentStock(
        company_id=UUID(company_id), warehouse_id=UUID(data["warehouse_id"]),
        product_id=UUID(data["product_id"]), supplier_id=UUID(data["supplier_id"]),
        supplier_nombre=data["supplier_nombre"],
        cantidad=Decimal(str(data["cantidad"])),
        costo_acordado=Decimal(str(data["costo_acordado"])) if data.get("costo_acordado") else None,
        moneda=data.get("moneda", "PYG"),
        fecha_vencimiento=datetime.fromisoformat(data["fecha_vencimiento"]) if data.get("fecha_vencimiento") else None,
        notas=data.get("notas"),
    )
    db.add(cs); await db.flush(); await db.refresh(cs)
    return _cons_to_dict(cs)


async def list_consignment(db: AsyncSession, company_id: str, supplier_id: str = "") -> list[dict]:
    q = select(ConsignmentStock).where(ConsignmentStock.company_id == UUID(company_id), ConsignmentStock.activo == True)
    if supplier_id: q = q.where(ConsignmentStock.supplier_id == UUID(supplier_id))
    q = q.order_by(ConsignmentStock.created_at.desc())
    r = await db.execute(q)
    return [_cons_to_dict(cs) for cs in r.scalars().all()]


async def add_consignment_movement(db: AsyncSession, company_id: str, cons_id: str, data: dict) -> dict:
    r = await db.execute(select(ConsignmentStock).where(ConsignmentStock.id == UUID(cons_id), ConsignmentStock.company_id == UUID(company_id)))
    cs = r.scalar_one_or_none()
    if not cs: raise ValueError("Consignación no encontrada")
    cantidad = Decimal(str(data["cantidad"]))
    if data["tipo"] in ("venta", "devolucion") and cantidad > (cs.cantidad or Decimal(0)):
        raise ValueError("Cantidad excede stock en consignación")
    mov = ConsignmentMovement(
        consignment_id=cs.id, tipo=data["tipo"], cantidad=cantidad,
        referencia_tipo=data.get("referencia_tipo"), referencia_id=UUID(data["referencia_id"]) if data.get("referencia_id") else None,
        notas=data.get("notas"),
    )
    db.add(mov)
    if data["tipo"] == "venta":
        cs.cantidad = (cs.cantidad or Decimal(0)) - cantidad
    elif data["tipo"] == "devolucion":
        cs.cantidad = (cs.cantidad or Decimal(0)) + cantidad
    await db.flush(); await db.refresh(cs)
    return _cons_to_dict(cs)


def _cons_to_dict(cs):
    items = [{"id": str(m.id), "tipo": m.tipo, "cantidad": float(m.cantidad),
              "referencia_tipo": m.referencia_tipo, "created_at": m.created_at} for m in (cs.items or [])]
    return {"id": str(cs.id), "warehouse_id": str(cs.warehouse_id), "product_id": str(cs.product_id),
            "supplier_id": str(cs.supplier_id), "supplier_nombre": cs.supplier_nombre,
            "cantidad": float(cs.cantidad), "costo_acordado": float(cs.costo_acordado) if cs.costo_acordado else None,
            "moneda": cs.moneda, "fecha_vencimiento": cs.fecha_vencimiento,
            "activo": cs.activo, "notas": cs.notas, "items": items, "created_at": cs.created_at}


# ═══════════════════════════════════════════════════════════════════
#  AUTO REPLENISH
# ═══════════════════════════════════════════════════════════════════

async def create_replenish_rule(db: AsyncSession, company_id: str, data: dict) -> dict:
    rule = AutoReplenishRule(
        company_id=UUID(company_id), product_id=UUID(data["product_id"]),
        warehouse_id=UUID(data["warehouse_id"]),
        stock_minimo=Decimal(str(data["stock_minimo"])),
        stock_seguridad=Decimal(str(data.get("stock_seguridad", 0))),
        cantidad_reorden=Decimal(str(data["cantidad_reorden"])) if data.get("cantidad_reorden") else None,
        lead_time_dias=data.get("lead_time_dias", 1),
        supplier_id=UUID(data["supplier_id"]) if data.get("supplier_id") else None,
        auto_generar_oc=data.get("auto_generar_oc", False),
    )
    db.add(rule); await db.flush(); await db.refresh(rule)
    return _rule_to_dict(rule)


async def list_replenish_rules(db: AsyncSession, company_id: str) -> list[dict]:
    r = await db.execute(
        select(AutoReplenishRule).where(AutoReplenishRule.company_id == UUID(company_id), AutoReplenishRule.activo == True)
        .order_by(AutoReplenishRule.ultima_alerta_at.desc().nullslast())
    )
    return [_rule_to_dict(rule) for rule in r.scalars().all()]


async def check_alerts(db: AsyncSession, company_id: str) -> list[dict]:
    """Check all rules and return alerts for products below minimum stock."""
    alerts = []
    r = await db.execute(
        select(AutoReplenishRule).where(AutoReplenishRule.company_id == UUID(company_id), AutoReplenishRule.activo == True)
    )
    rules = r.scalars().all()
    for rule in rules:
        sr = await db.execute(
            select(func.coalesce(func.sum(Stock.cantidad), 0)).where(
                Stock.warehouse_id == rule.warehouse_id, Stock.product_id == rule.product_id
            )
        )
        current_stock = sr.scalar() or Decimal(0)
        if current_stock < rule.stock_minimo:
            rule.ultima_alerta_at = datetime.now(timezone.utc)
            alerts.append({
                "rule_id": str(rule.id), "product_id": str(rule.product_id),
                "warehouse_id": str(rule.warehouse_id),
                "current_stock": float(current_stock), "stock_minimo": float(rule.stock_minimo),
                "stock_seguridad": float(rule.stock_seguridad) if rule.stock_seguridad else 0,
                "cantidad_reorden": float(rule.cantidad_reorden) if rule.cantidad_reorden else float(rule.stock_minimo * 2),
                "lead_time_dias": rule.lead_time_dias,
                "supplier_id": str(rule.supplier_id) if rule.supplier_id else None,
                "auto_generar_oc": rule.auto_generar_oc,
            })
    await db.flush()
    return alerts


async def delete_replenish_rule(db: AsyncSession, company_id: str, rule_id: str) -> bool:
    r = await db.execute(
        select(AutoReplenishRule).where(AutoReplenishRule.id == UUID(rule_id), AutoReplenishRule.company_id == UUID(company_id))
    )
    rule = r.scalar_one_or_none()
    if not rule:
        return False
    await db.delete(rule)
    await db.flush()
    return True


async def get_replenish_suggestions(db: AsyncSession, company_id: str) -> list[dict]:
    """Sugerencias reales de reposicion: por cada regla activa, cruza stock
    actual, velocidad de venta real (ultimos 30 dias) y lead time del
    proveedor para calcular cuanto reponer. Solo devuelve items con reglas
    configuradas — no inventa productos ni proveedores."""
    result = await db.execute(
        text("""
            SELECT
                r.id AS rule_id, r.product_id, r.warehouse_id,
                r.stock_minimo, r.stock_seguridad, r.cantidad_reorden, r.lead_time_dias,
                r.supplier_id,
                p.nombre AS producto, p.sku, p.precio_venta AS costo_unitario,
                sup.razon_social AS proveedor,
                COALESCE(st.cantidad, 0) AS stock_actual,
                COALESCE(v.velocidad, 0) AS velocidad_venta
            FROM adv_auto_replenish_rules r
            JOIN products p ON p.id = r.product_id
            LEFT JOIN suppliers sup ON sup.id = r.supplier_id
            LEFT JOIN stock st ON st.warehouse_id = r.warehouse_id AND st.product_id = r.product_id
            LEFT JOIN (
                SELECT si.product_id, SUM(si.cantidad) / 30.0 AS velocidad
                FROM sale_items si
                JOIN sales sa ON sa.id = si.sale_id
                WHERE sa.company_id = :company_id
                  AND sa.estado <> 'cancelado'
                  AND sa.fecha >= NOW() - INTERVAL '30 days'
                GROUP BY si.product_id
            ) v ON v.product_id = r.product_id
            WHERE r.company_id = :company_id AND r.activo = true
            ORDER BY p.nombre
        """),
        {"company_id": company_id},
    )
    rows = result.fetchall()

    out = []
    for row in rows:
        stock_actual = float(row.stock_actual or 0)
        stock_minimo = float(row.stock_minimo or 0)
        stock_seguridad = float(row.stock_seguridad or 0)
        velocidad = float(row.velocidad_venta or 0)
        lead_time = row.lead_time_dias or 1

        sugerido = 0.0
        if stock_actual < stock_minimo:
            if row.cantidad_reorden:
                sugerido = float(row.cantidad_reorden)
            else:
                sugerido = max(0.0, stock_seguridad + lead_time * velocidad - stock_actual)

        if stock_actual <= stock_seguridad * 0.5:
            prioridad = "Alta"
        elif stock_actual < stock_minimo:
            prioridad = "Media"
        else:
            prioridad = "Baja"

        out.append({
            "id": str(row.rule_id),
            "producto": row.producto,
            "sku": row.sku,
            "proveedor": row.proveedor or "Sin proveedor asignado",
            "stockActual": stock_actual,
            "stockSeguridad": stock_seguridad,
            "velocidadVenta": round(velocidad, 2),
            "leadTime": lead_time,
            "sugerido": round(sugerido),
            "costoUnitario": float(row.costo_unitario or 0),
            "prioridad": prioridad,
        })
    return out


def _rule_to_dict(rule):
    return {"id": str(rule.id), "product_id": str(rule.product_id), "warehouse_id": str(rule.warehouse_id),
            "stock_minimo": float(rule.stock_minimo), "stock_seguridad": float(rule.stock_seguridad or 0),
            "cantidad_reorden": float(rule.cantidad_reorden) if rule.cantidad_reorden else None,
            "lead_time_dias": rule.lead_time_dias,
            "supplier_id": str(rule.supplier_id) if rule.supplier_id else None,
            "activo": rule.activo, "auto_generar_oc": rule.auto_generar_oc,
            "ultima_alerta_at": rule.ultima_alerta_at}


# ═══════════════════════════════════════════════════════════════════
#  DASHBOARD
# ═══════════════════════════════════════════════════════════════════

async def get_dashboard(db: AsyncSession, company_id: str) -> dict:
    cu = UUID(company_id)

    # Location count
    lr = await db.execute(select(func.count()).where(StorageLocation.company_id == cu, StorageLocation.activo == True))
    total_locations = lr.scalar() or 0

    # Active picking lists
    pr = await db.execute(select(func.count()).where(PickingList.company_id == cu, PickingList.estado.in_(["pendiente", "asignado"])))
    active_picking_lists = pr.scalar() or 0

    # Open cycle counts
    cr = await db.execute(select(func.count()).where(CycleCount.company_id == cu, CycleCount.estado == "abierto"))
    open_cycle_counts = cr.scalar() or 0

    # Consignment items
    csr = await db.execute(select(func.count()).where(ConsignmentStock.company_id == cu, ConsignmentStock.activo == True))
    consignment_items = csr.scalar() or 0

    # Lots expiring in 30 days
    cutoff = datetime.now(timezone.utc) + timedelta(days=30)
    er = await db.execute(
        select(func.count()).where(
            StockLot.company_id == cu, StockLot.cantidad_disponible > 0,
            StockLot.fecha_vencimiento <= cutoff, StockLot.fecha_vencimiento.isnot(None),
        )
    )
    lots_expiring_soon = er.scalar() or 0

    # Low stock rules
    rules_r = await db.execute(
        select(AutoReplenishRule).where(AutoReplenishRule.company_id == cu, AutoReplenishRule.activo == True)
    )
    low_stock_alerts = 0
    low_stock_items = []
    for rule in rules_r.scalars().all():
        sr = await db.execute(
            select(func.coalesce(func.sum(Stock.cantidad), 0)).where(
                Stock.warehouse_id == rule.warehouse_id, Stock.product_id == rule.product_id
            )
        )
        cs = sr.scalar() or Decimal(0)
        if cs < rule.stock_minimo:
            low_stock_alerts += 1
            pr = await db.execute(select(Product).where(Product.id == rule.product_id))
            p = pr.scalar_one_or_none()
            low_stock_items.append({
                "product_id": str(rule.product_id), "product_nombre": p.nombre if p else "—",
                "current_stock": float(cs), "stock_minimo": float(rule.stock_minimo),
            })

    # Recent picking lists
    recent_pl = await list_picking_lists(db, company_id, limit=5)
    recent_cc = await list_cycle_counts(db, company_id)
    recent_cc = recent_cc[:5]

    # Expiring lots
    exp_lots = await list_lots(db, company_id, expiring_soon_days=30)
    exp_lots = exp_lots[:10]

    # Pending picks
    pending_picks_r = await db.execute(
        select(func.coalesce(func.sum(PickingListItem.cantidad_solicitada - func.coalesce(PickingListItem.cantidad_pickeada, 0)), 0))
        .select_from(PickingListItem).join(PickingList)
        .where(PickingList.company_id == cu, PickingList.estado.in_(["pendiente", "asignado"]))
    )
    pending_picks = float(pending_picks_r.scalar() or 0)

    # Discrepancies (from cycle counts)
    disc_r = await db.execute(
        select(func.count()).where(CycleCount.company_id == cu, CycleCount.discrepancias > 0, CycleCount.estado == "abierto")
    )
    total_discrepancies = disc_r.scalar() or 0

    return {
        "total_locations": total_locations, "active_picking_lists": active_picking_lists,
        "open_cycle_counts": open_cycle_counts, "consignment_items": consignment_items,
        "low_stock_alerts": low_stock_alerts, "lots_expiring_soon": lots_expiring_soon,
        "pending_picks": pending_picks, "total_discrepancies": total_discrepancies,
        "recent_picking_lists": recent_pl, "recent_cycle_counts": recent_cc,
        "expiring_lots": exp_lots, "low_stock_items": low_stock_items,
    }
