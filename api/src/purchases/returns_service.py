"""Purchases Supplier Returns Service — Circuito de devoluciones a proveedor con aprobación, stock y finanzas"""

import logging
import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Optional, List, Dict, Any

from fastapi import HTTPException
from sqlalchemy import select, func, and_, or_, distinct
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from api.src.supermer.models import SupplierReturn, SupplierReturnItem
from api.src.products.models import Product
from api.src.financial.models import SupplierInvoice, SupplierInvoiceItem, SupplierReturn as FinancialSupplierReturn
from api.src.purchases.models import Supplier
from api.src.inventory.models import Stock, InventoryMovement, Warehouse

logger = logging.getLogger(__name__)


async def list_supplier_products(db: AsyncSession, company_id: uuid.UUID, supplier_id: uuid.UUID) -> List[Dict[str, Any]]:
    """
    Lista todos los productos que el proveedor vende:
    1. Aquellos asignados directamente en products.supplier_id
    2. Aquellos que hayan sido facturados por este proveedor en supplier_invoice_items
    """
    # 1. Por supplier_id directo
    q_direct = select(
        Product.id,
        Product.nombre,
        Product.sku,
        Product.codigo_barra,
        Product.costo_promedio,
        Product.ultimo_costo,
        Product.unidad_medida,
    ).where(
        Product.company_id == company_id,
        Product.supplier_id == supplier_id,
        Product.activo == True,
    )
    res_direct = await db.execute(q_direct)
    direct_products = {r.id: {
        "id": str(r.id),
        "nombre": r.nombre,
        "sku": r.sku,
        "codigo_barra": r.codigo_barra,
        "costo_promedio": float(r.costo_promedio or r.ultimo_costo or 0),
        "unidad_medida": r.unidad_medida or "UN",
    } for r in res_direct.all()}

    # 2. Por historial de facturas de compra
    q_invoices = select(
        Product.id,
        Product.nombre,
        Product.sku,
        Product.codigo_barra,
        Product.costo_promedio,
        Product.ultimo_costo,
        Product.unidad_medida,
    ).join(
        SupplierInvoiceItem, SupplierInvoiceItem.product_id == Product.id
    ).join(
        SupplierInvoice, SupplierInvoice.id == SupplierInvoiceItem.invoice_id
    ).where(
        SupplierInvoice.company_id == company_id,
        SupplierInvoice.supplier_id == supplier_id,
        Product.activo == True,
    ).distinct()

    res_invoices = await db.execute(q_invoices)
    for r in res_invoices.all():
        if r.id not in direct_products:
            direct_products[r.id] = {
                "id": str(r.id),
                "nombre": r.nombre,
                "sku": r.sku,
                "codigo_barra": r.codigo_barra,
                "costo_promedio": float(r.costo_promedio or r.ultimo_costo or 0),
                "unidad_medida": r.unidad_medida or "UN",
            }

    product_list = list(direct_products.values())
    product_list.sort(key=lambda p: p["nombre"].lower())
    return product_list


async def list_product_invoices(db: AsyncSession, company_id: uuid.UUID, supplier_id: uuid.UUID, product_id: uuid.UUID) -> List[Dict[str, Any]]:
    """
    Lista las facturas de compra emitidas por el proveedor donde figura un producto específico.
    """
    q = select(
        SupplierInvoice.id.label("invoice_id"),
        SupplierInvoice.numero_factura,
        SupplierInvoice.timbrado,
        SupplierInvoice.fecha_emision,
        SupplierInvoice.saldo_pendiente,
        SupplierInvoice.total,
        SupplierInvoiceItem.cantidad,
        SupplierInvoiceItem.precio_unitario,
        SupplierInvoiceItem.total.label("item_total"),
    ).join(
        SupplierInvoiceItem, SupplierInvoiceItem.invoice_id == SupplierInvoice.id
    ).where(
        SupplierInvoice.company_id == company_id,
        SupplierInvoice.supplier_id == supplier_id,
        SupplierInvoiceItem.product_id == product_id,
    ).order_by(SupplierInvoice.fecha_emision.desc())

    result = await db.execute(q)
    invoices = []
    for r in result.all():
        invoices.append({
            "invoice_id": str(r.invoice_id),
            "numero_factura": r.numero_factura,
            "timbrado": r.timbrado,
            "fecha_emision": r.fecha_emision.isoformat() if r.fecha_emision else None,
            "cantidad_comprada": float(r.cantidad or 0),
            "precio_unitario": float(r.precio_unitario or 0),
            "item_total": float(r.item_total or 0),
            "saldo_pendiente_factura": float(r.saldo_pendiente or 0),
        })
    return invoices


async def list_supplier_returns(
    db: AsyncSession,
    company_id: uuid.UUID,
    estado: Optional[str] = None,
    supplier_id: Optional[uuid.UUID] = None,
) -> List[Dict[str, Any]]:
    """Lista las devoluciones a proveedor enriquecidas con nombres de proveedor, almacén y productos."""
    q = select(
        SupplierReturn,
        Supplier.razon_social.label("proveedor_nombre"),
        Supplier.ruc.label("proveedor_ruc"),
        Warehouse.nombre.label("almacen_nombre"),
    ).outerjoin(
        Supplier, Supplier.id == SupplierReturn.proveedor_id
    ).outerjoin(
        Warehouse, Warehouse.id == SupplierReturn.warehouse_id
    ).options(
        selectinload(SupplierReturn.items)
    ).where(
        SupplierReturn.company_id == company_id
    )

    if estado and estado != "todos":
        q = q.where(SupplierReturn.estado == estado)
    if supplier_id:
        q = q.where(SupplierReturn.proveedor_id == supplier_id)

    q = q.order_by(SupplierReturn.fecha_creacion.desc())
    res = await db.execute(q)
    rows = res.all()

    # Obtener nombres de productos de los ítems
    all_prod_ids = set()
    for row in rows:
        r = row[0]
        for item in r.items:
            all_prod_ids.add(item.producto_id)

    prod_names = {}
    if all_prod_ids:
        pq = select(Product.id, Product.nombre, Product.sku, Product.codigo_barra).where(Product.id.in_(all_prod_ids))
        pres = await db.execute(pq)
        for p in pres.all():
            prod_names[p.id] = {"nombre": p.nombre, "sku": p.sku, "codigo_barra": p.codigo_barra}

    out = []
    for r, prov_nom, prov_ruc, wh_nom in rows:
        items_map: Dict[uuid.UUID, Dict[str, Any]] = {}
        for it in r.items:
            p_info = prod_names.get(it.producto_id, {})
            pid = it.producto_id
            cant = float(it.cantidad or 0)
            val_u = float(it.valor_unitario or it.costo_promedio or 0)
            val_tot = float(it.valor_total or (cant * val_u))

            if pid in items_map:
                existing = items_map[pid]
                prev_cant = existing["cantidad"]
                prev_tot = existing["valor_total"]
                new_cant = prev_cant + cant
                new_tot = prev_tot + val_tot
                new_u = round(new_tot / new_cant, 2) if new_cant > 0 else val_u

                lotes = [existing.get("lote"), it.lote]
                unique_lotes = ", ".join(filter(None, set(lotes)))

                vtos = [existing.get("fecha_vencimiento"), it.fecha_vencimiento.isoformat() if it.fecha_vencimiento else None]
                unique_vtos = ", ".join(filter(None, set(vtos)))

                facturas = [existing.get("factura_numero"), it.factura_numero]
                unique_facturas = ", ".join(filter(None, set(facturas)))

                detalles = [existing.get("detalle"), it.detalle]
                unique_detalles = " | ".join(filter(None, set(detalles)))

                existing["cantidad"] = new_cant
                existing["valor_unitario"] = new_u
                existing["valor_total"] = new_tot
                existing["lote"] = unique_lotes or None
                existing["fecha_vencimiento"] = unique_vtos or None
                existing["factura_numero"] = unique_facturas or None
                existing["detalle"] = unique_detalles or None
            else:
                items_map[pid] = {
                    "id": str(it.id),
                    "producto_id": str(it.producto_id),
                    "producto_nombre": p_info.get("nombre", "Producto"),
                    "sku": p_info.get("sku"),
                    "codigo_barra": p_info.get("codigo_barra"),
                    "factura_id": str(it.factura_id) if it.factura_id else None,
                    "factura_numero": it.factura_numero,
                    "cantidad": cant,
                    "valor_unitario": val_u,
                    "valor_total": val_tot,
                    "motivo": it.motivo,
                    "lote": it.lote,
                    "fecha_vencimiento": it.fecha_vencimiento.isoformat() if it.fecha_vencimiento else None,
                    "detalle": it.detalle,
                }

        items_detail = list(items_map.values())

        out.append({
            "id": str(r.id),
            "codigo": r.codigo,
            "tipo": r.tipo or "devolucion",
            "proveedor_id": str(r.proveedor_id),
            "proveedor_nombre": prov_nom or "Proveedor",
            "proveedor_ruc": prov_ruc,
            "warehouse_id": str(r.warehouse_id) if r.warehouse_id else None,
            "almacen_nombre": wh_nom or "Depósito Principal",
            "fecha_creacion": r.fecha_creacion.isoformat() if r.fecha_creacion else None,
            "fecha_estimada_retiro": r.fecha_estimada_retiro.isoformat() if r.fecha_estimada_retiro else None,
            "total_items": len(items_detail) if items_detail else (r.total_items or 0),
            "valor_total_estimado": float(sum(it["valor_total"] for it in items_detail)) if items_detail else float(r.valor_total_estimado or 0),
            "nota_credito_numero": r.nota_credito_numero,
            "nota_credito_monto": float(r.nota_credito_monto or 0) if r.nota_credito_monto else None,
            "estado": r.estado or "pendiente",
            "autorizado_por": str(r.autorizado_por) if r.autorizado_por else None,
            "autorizado_at": r.autorizado_at.isoformat() if r.autorizado_at else None,
            "completado_por": str(r.completado_por) if r.completado_por else None,
            "completado_at": r.completado_at.isoformat() if r.completado_at else None,
            "rechazado_por": str(r.rechazado_por) if r.rechazado_por else None,
            "rechazado_at": r.rechazado_at.isoformat() if r.rechazado_at else None,
            "motivo_rechazo": r.motivo_rechazo,
            "observaciones": r.observaciones,
            "items": items_detail,
        })
    return out


def consolidate_return_items(items: List[Any]) -> List[Dict[str, Any]]:
    """
    Unifica ítems repetidos por producto_id en una sola línea,
    sumando sus cantidades y recalculando el nuevo subtotal y precio unitario ponderado.
    """
    consolidated: Dict[uuid.UUID, Dict[str, Any]] = {}
    for it in items:
        pid = it.producto_id if isinstance(it.producto_id, uuid.UUID) else uuid.UUID(str(it.producto_id))
        cant = Decimal(str(it.cantidad))
        val_u = Decimal(str(it.valor_unitario))
        val_tot = cant * val_u

        if pid in consolidated:
            entry = consolidated[pid]
            prev_cant = entry["cantidad"]
            prev_tot = entry["valor_total"]
            new_cant = prev_cant + cant
            new_tot = prev_tot + val_tot
            new_u = (new_tot / new_cant) if new_cant > 0 else val_u

            if not entry.get("factura_id") and getattr(it, "factura_id", None):
                entry["factura_id"] = it.factura_id
                entry["factura_numero"] = getattr(it, "factura_numero", None)
            if not entry.get("lote") and getattr(it, "lote", None):
                entry["lote"] = it.lote
            if not entry.get("fecha_vencimiento") and getattr(it, "fecha_vencimiento", None):
                entry["fecha_vencimiento"] = it.fecha_vencimiento
            it_detalle = getattr(it, "detalle", None)
            if it_detalle:
                entry["detalle"] = (entry["detalle"] + " | " + it_detalle) if entry.get("detalle") else it_detalle

            entry["cantidad"] = new_cant
            entry["valor_unitario"] = new_u
            entry["valor_total"] = new_tot
        else:
            consolidated[pid] = {
                "producto_id": pid,
                "factura_id": getattr(it, "factura_id", None),
                "factura_numero": getattr(it, "factura_numero", None),
                "cantidad": cant,
                "valor_unitario": val_u,
                "valor_total": val_tot,
                "motivo": getattr(it, "motivo", "vencido") or "vencido",
                "lote": getattr(it, "lote", None),
                "fecha_vencimiento": getattr(it, "fecha_vencimiento", None),
                "detalle": getattr(it, "detalle", None),
            }
    return list(consolidated.values())


async def create_supplier_return(
    db: AsyncSession,
    company_id: uuid.UUID,
    user_id: uuid.UUID,
    data: Any,
) -> Dict[str, Any]:
    """Crea una devolución a proveedor en estado inicial 'pendiente' unificando ítems repetidos."""
    now = datetime.utcnow()
    # Generar código correlativo DEV-AAAAMMDD-XXXX
    sec_q = select(func.count(SupplierReturn.id)).where(
        SupplierReturn.company_id == company_id,
        func.date(SupplierReturn.fecha_creacion) == date.today(),
    )
    sec_res = await db.execute(sec_q)
    correlativo = (sec_res.scalar() or 0) + 1
    codigo = f"DEV-{date.today().strftime('%Y%m%d')}-{correlativo:04d}"

    # Consolidar ítems por producto antes de persistir
    unified_items = consolidate_return_items(data.items)
    total_val = Decimal(0)
    item_objects = []
    for it in unified_items:
        cant = it["cantidad"]
        val_u = it["valor_unitario"]
        val_tot = it["valor_total"]
        total_val += val_tot

        # Obtener número de factura si vino factura_id y no vino factura_numero
        factura_num = it.get("factura_numero")
        fac_id = it.get("factura_id")
        if fac_id and not factura_num:
            inv_res = await db.execute(select(SupplierInvoice.numero_factura).where(SupplierInvoice.id == fac_id))
            factura_num = inv_res.scalar_one_or_none()

        item_obj = SupplierReturnItem(
            producto_id=it["producto_id"],
            factura_id=fac_id,
            factura_numero=factura_num,
            cantidad=cant,
            costo_promedio=val_u,
            valor_unitario=val_u,
            valor_total=val_tot,
            motivo=it.get("motivo") or "vencido",
            lote=it.get("lote"),
            fecha_vencimiento=it.get("fecha_vencimiento"),
            detalle=it.get("detalle"),
        )
        item_objects.append(item_obj)

    supplier_return = SupplierReturn(
        company_id=company_id,
        proveedor_id=data.proveedor_id,
        codigo=codigo,
        tipo=data.tipo or "devolucion",
        fecha_creacion=now,
        fecha_estimada_retiro=data.fecha_estimada_retiro,
        warehouse_id=data.warehouse_id,
        total_items=len(item_objects),
        valor_total_estimado=total_val,
        estado="pendiente",
        observaciones=data.observaciones,
        items=item_objects,
    )
    db.add(supplier_return)
    await db.commit()
    await db.refresh(supplier_return)

    res = await list_supplier_returns(db, company_id, supplier_id=data.proveedor_id)
    matched = [r for r in res if r["id"] == str(supplier_return.id)]
    return matched[0] if matched else {"id": str(supplier_return.id), "codigo": codigo, "estado": "pendiente"}


async def update_supplier_return(
    db: AsyncSession,
    company_id: uuid.UUID,
    return_id: uuid.UUID,
    user_id: uuid.UUID,
    data: Any,
) -> Dict[str, Any]:
    """
    Edita una devolución a proveedor mientras no esté completamente aprobada (estado != 'completado').
    Actualiza cabecera, unifica ítems por producto y recalcula totales.
    """
    q = select(SupplierReturn).options(selectinload(SupplierReturn.items)).where(
        SupplierReturn.id == return_id,
        SupplierReturn.company_id == company_id,
    )
    res = await db.execute(q)
    sr = res.scalar_one_or_none()
    if not sr:
        raise HTTPException(404, "Devolución a proveedor no encontrada")

    if sr.estado == "completado":
        raise HTTPException(400, "No se puede editar una devolución que ya fue completada (stock y finanzas impactados)")

    # Eliminar ítems anteriores
    for old_item in list(sr.items):
        await db.delete(old_item)
    sr.items.clear()
    await db.flush()

    # Consolidar nuevos ítems
    unified_items = consolidate_return_items(data.items)
    total_val = Decimal(0)
    new_item_objects = []

    for it in unified_items:
        cant = it["cantidad"]
        val_u = it["valor_unitario"]
        val_tot = it["valor_total"]
        total_val += val_tot

        factura_num = it.get("factura_numero")
        fac_id = it.get("factura_id")
        if fac_id and not factura_num:
            inv_res = await db.execute(select(SupplierInvoice.numero_factura).where(SupplierInvoice.id == fac_id))
            factura_num = inv_res.scalar_one_or_none()

        item_obj = SupplierReturnItem(
            return_id=sr.id,
            producto_id=it["producto_id"],
            factura_id=fac_id,
            factura_numero=factura_num,
            cantidad=cant,
            costo_promedio=val_u,
            valor_unitario=val_u,
            valor_total=val_tot,
            motivo=it.get("motivo") or "vencido",
            lote=it.get("lote"),
            fecha_vencimiento=it.get("fecha_vencimiento"),
            detalle=it.get("detalle"),
        )
        new_item_objects.append(item_obj)
        db.add(item_obj)

    if data.warehouse_id is not None:
        sr.warehouse_id = data.warehouse_id
    if data.fecha_estimada_retiro is not None:
        sr.fecha_estimada_retiro = data.fecha_estimada_retiro
    if data.observaciones is not None:
        sr.observaciones = data.observaciones
    if data.tipo is not None:
        sr.tipo = data.tipo
    if getattr(data, "proveedor_id", None) and data.proveedor_id != sr.proveedor_id:
        sr.proveedor_id = data.proveedor_id

    sr.total_items = len(new_item_objects)
    sr.valor_total_estimado = total_val
    sr.updated_at = datetime.utcnow()

    # Si estaba rechazada y se editó, vuelve a pendiente para reevaluación
    if sr.estado == "rechazado":
        sr.estado = "pendiente"
        sr.motivo_rechazo = None
        sr.rechazado_por = None
        sr.rechazado_at = None

    await db.commit()
    await db.refresh(sr)

    res_list = await list_supplier_returns(db, company_id)
    matched = [r for r in res_list if r["id"] == str(sr.id)]
    return matched[0] if matched else {"id": str(sr.id), "codigo": sr.codigo, "estado": sr.estado}



async def approve_supplier_return(
    db: AsyncSession,
    company_id: uuid.UUID,
    return_id: uuid.UUID,
    user_id: uuid.UUID,
) -> Dict[str, Any]:
    """Aprueba la devolución para autorizar el retiro."""
    q = select(SupplierReturn).where(SupplierReturn.id == return_id, SupplierReturn.company_id == company_id)
    res = await db.execute(q)
    sr = res.scalar_one_or_none()
    if not sr:
        raise HTTPException(404, "Devolución a proveedor no encontrada")

    if sr.estado not in ("pendiente", "rechazado"):
        raise HTTPException(400, f"No se puede aprobar una devolución en estado '{sr.estado}'")

    sr.estado = "autorizado"
    sr.autorizado_por = user_id
    sr.autorizado_at = datetime.utcnow()
    sr.rechazado_por = None
    sr.rechazado_at = None
    sr.motivo_rechazo = None

    await db.commit()
    await db.refresh(sr)
    res_list = await list_supplier_returns(db, company_id)
    return next((r for r in res_list if r["id"] == str(return_id)), {"id": str(return_id), "estado": "autorizado"})


async def reject_supplier_return(
    db: AsyncSession,
    company_id: uuid.UUID,
    return_id: uuid.UUID,
    user_id: uuid.UUID,
    motivo_rechazo: Optional[str] = None,
) -> Dict[str, Any]:
    """Rechaza la solicitud de devolución."""
    q = select(SupplierReturn).where(SupplierReturn.id == return_id, SupplierReturn.company_id == company_id)
    res = await db.execute(q)
    sr = res.scalar_one_or_none()
    if not sr:
        raise HTTPException(404, "Devolución a proveedor no encontrada")

    if sr.estado == "completado":
        raise HTTPException(400, "No se puede rechazar una devolución que ya fue completada e impactó stock/finanzas")

    sr.estado = "rechazado"
    sr.rechazado_por = user_id
    sr.rechazado_at = datetime.utcnow()
    sr.motivo_rechazo = motivo_rechazo or "Rechazado por supervisión comercial"

    await db.commit()
    await db.refresh(sr)
    res_list = await list_supplier_returns(db, company_id)
    return next((r for r in res_list if r["id"] == str(return_id)), {"id": str(return_id), "estado": "rechazado"})


async def complete_supplier_return(
    db: AsyncSession,
    company_id: uuid.UUID,
    return_id: uuid.UUID,
    user_id: uuid.UUID,
    nota_credito_numero: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Completa la devolución:
    1. Cambia estado a 'completado'.
    2. IMPACTO EN STOCK: Descuenta existencia del almacén y registra InventoryMovement negativo.
    3. IMPACTO FINANCIERO:
       - Si los ítems tienen factura de compra vinculada, descuenta el saldo pendiente de SupplierInvoice.
       - Asienta un SupplierReturn financiero en la cuenta corriente del proveedor.
    """
    q = select(SupplierReturn).options(selectinload(SupplierReturn.items)).where(
        SupplierReturn.id == return_id,
        SupplierReturn.company_id == company_id,
    )
    res = await db.execute(q)
    sr = res.scalar_one_or_none()
    if not sr:
        raise HTTPException(404, "Devolución a proveedor no encontrada")

    if sr.estado == "completado":
        raise HTTPException(400, "Esta devolución ya fue completada previamente")

    now = datetime.utcnow()
    sr.estado = "completado"
    sr.completado_por = user_id
    sr.completado_at = now
    if nota_credito_numero:
        sr.nota_credito_numero = nota_credito_numero
        sr.nota_credito_monto = sr.valor_total_estimado

    # Si no tenía warehouse asignado, buscamos el depósito principal de la empresa
    wh_id = sr.warehouse_id
    if not wh_id:
        wh_q = select(Warehouse.id).where(Warehouse.company_id == company_id, Warehouse.activo == True).limit(1)
        wh_res = await db.execute(wh_q)
        wh_id = wh_res.scalar_one_or_none()

    facturas_impactadas: Dict[uuid.UUID, Decimal] = {}

    for item in sr.items:
        cant = int(item.cantidad)
        # 1. IMPACTO EN STOCK
        if wh_id and cant > 0:
            stk_q = select(Stock).where(Stock.warehouse_id == wh_id, Stock.product_id == item.producto_id)
            stk_res = await db.execute(stk_q)
            stk = stk_res.scalar_one_or_none()
            if stk:
                stk.cantidad -= cant
            else:
                stk = Stock(
                    warehouse_id=wh_id,
                    product_id=item.producto_id,
                    cantidad=-cant,
                    costo_unitario=item.valor_unitario,
                )
                db.add(stk)

            # Movimiento de inventario
            mov = InventoryMovement(
                company_id=company_id,
                warehouse_id=wh_id,
                product_id=item.producto_id,
                tipo="devolucion_proveedor",
                cantidad=-cant,
                costo_unitario=item.valor_unitario,
                referencia_type="supplier_return",
                referencia_id=sr.id,
                motivo=f"Devolución {sr.codigo} - Motivo: {item.motivo}" + (f" (Fact. {item.factura_numero})" if item.factura_numero else ""),
                user_id=user_id,
                created_at=now,
            )
            db.add(mov)

        # Acumular monto por factura afectada
        if item.factura_id:
            facturas_impactadas[item.factura_id] = facturas_impactadas.get(item.factura_id, Decimal(0)) + (item.valor_total or Decimal(0))

    # 2. IMPACTO FINANCIERO EN FACTURAS DE PROVEEDOR
    for inv_id, monto_devuelto in facturas_impactadas.items():
        inv_q = select(SupplierInvoice).where(SupplierInvoice.id == inv_id, SupplierInvoice.company_id == company_id)
        inv_res = await db.execute(inv_q)
        inv = inv_res.scalar_one_or_none()
        if inv:
            nuevo_saldo = max(Decimal(0), (inv.saldo_pendiente or Decimal(0)) - monto_devuelto)
            inv.saldo_pendiente = nuevo_saldo
            inv.monto_retenido_nc = (inv.monto_retenido_nc or Decimal(0)) + monto_devuelto
            if nuevo_saldo == 0 and inv.estado != "pagada":
                inv.estado = "pagada"
            logger.info(f"Devolución {sr.codigo}: Saldo de Factura {inv.numero_factura} reducido en {monto_devuelto}. Nuevo saldo: {nuevo_saldo}")

    # 3. REGISTRO FINANCIERO EN CUENTA CORRIENTE PROVEEDOR (supplier_returns)
    fin_return = FinancialSupplierReturn(
        company_id=company_id,
        supplier_id=sr.proveedor_id,
        numero_factura_origen=", ".join(filter(None, {item.factura_numero for item in sr.items})) or None,
        numero_nota_credito=nota_credito_numero or sr.codigo,
        fecha=date.today(),
        monto=sr.valor_total_estimado or Decimal(0),
        moneda="PYG",
        observaciones=f"Devolución de mercadería {sr.codigo}. Total {sr.total_items} ítems entregados al proveedor.",
    )
    db.add(fin_return)

    await db.commit()
    await db.refresh(sr)

    res_list = await list_supplier_returns(db, company_id)
    return next((r for r in res_list if r["id"] == str(return_id)), {"id": str(return_id), "estado": "completado"})
