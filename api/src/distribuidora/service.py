"""Distribuidora — Business logic for import, supplier/customer agreements, routes, credit, approvals, margins."""

from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from sqlalchemy import select, func, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException

from api.src.distribuidora import models as m


# ═══════════════════════════════════════════════════════════════
# 0. ACUERDOS CON PROVEEDORES
# ═══════════════════════════════════════════════════════════════

async def list_supplier_agreements(db: AsyncSession, company_id: str, supplier_id: str | None = None):
    q = select(m.SupplierAgreement).where(m.SupplierAgreement.company_id == UUID(company_id))
    if supplier_id:
        q = q.where(m.SupplierAgreement.supplier_id == UUID(supplier_id))
    q = q.order_by(m.SupplierAgreement.created_at.desc()).limit(100)
    r = await db.execute(q)
    return r.scalars().all()


async def create_supplier_agreement(db: AsyncSession, company_id: str, data: dict):
    obj = m.SupplierAgreement(company_id=UUID(company_id), **data)
    db.add(obj)
    await db.commit()
    await db.refresh(obj)
    return obj


async def get_supplier_agreement(db: AsyncSession, agreement_id: str):
    r = await db.execute(select(m.SupplierAgreement).where(m.SupplierAgreement.id == UUID(agreement_id)))
    return r.scalar_one_or_none()


async def update_supplier_agreement(db: AsyncSession, agreement_id: str, data: dict):
    obj = await get_supplier_agreement(db, agreement_id)
    if not obj:
        raise HTTPException(404, "Acuerdo con proveedor no encontrado")
    for k, v in data.items():
        if v is not None:
            setattr(obj, k, v)
    obj.updated_at = func.now()
    await db.commit()
    await db.refresh(obj)
    return obj


async def add_supplier_agreement_item(db: AsyncSession, agreement_id: str, data: dict):
    obj = m.SupplierAgreementItem(agreement_id=UUID(agreement_id), **data)
    db.add(obj)
    await db.commit()
    await db.refresh(obj)
    return obj


async def list_agreement_items(db: AsyncSession, agreement_id: str):
    r = await db.execute(
        select(m.SupplierAgreementItem).where(m.SupplierAgreementItem.agreement_id == UUID(agreement_id))
    )
    return r.scalars().all()


# ═══════════════════════════════════════════════════════════════
# 0b. APROBACIÓN DE ÓRDENES DE COMPRA
# ═══════════════════════════════════════════════════════════════

async def get_po_approval_config(db: AsyncSession, company_id: str):
    r = await db.execute(select(m.POApprovalConfig).where(m.POApprovalConfig.company_id == UUID(company_id)))
    return r.scalar_one_or_none()


async def upsert_po_approval_config(db: AsyncSession, company_id: str, data: dict):
    existing = await get_po_approval_config(db, company_id)
    if existing:
        for k, v in data.items():
            if v is not None:
                setattr(existing, k, v)
        existing.updated_at = func.now()
        obj = existing
    else:
        obj = m.POApprovalConfig(company_id=UUID(company_id), **data)
        db.add(obj)
    await db.commit()
    await db.refresh(obj)
    return obj


async def get_po_approvals(db: AsyncSession, purchase_order_id: str):
    r = await db.execute(
        select(m.POApproval).where(m.POApproval.purchase_order_id == UUID(purchase_order_id))
        .order_by(m.POApproval.nivel)
    )
    return r.scalars().all()


async def approve_purchase_order(db: AsyncSession, purchase_order_id: str, data: dict):
    """Approve or reject a purchase order. Auto-creates approval record."""
    from api.src.purchases.models import PurchaseOrder, PurchaseOrderHistory

    po_id = UUID(purchase_order_id)
    r = await db.execute(select(PurchaseOrder).where(PurchaseOrder.id == po_id))
    po = r.scalar_one_or_none()
    if not po:
        raise HTTPException(404, "Orden de compra no encontrada")

    cfg = await get_po_approval_config(db, str(po.company_id))

    # Auto-create approval record
    aprobador_id = UUID(data["aprobador_id"])
    action = data.get("action", "approve")

    nivel = 1
    if cfg and po.total and cfg.monto_maximo_nivel1 and po.total > cfg.monto_maximo_nivel1:
        nivel = 2

    # Check if already approved at this level
    r = await db.execute(
        select(m.POApproval).where(
            m.POApproval.purchase_order_id == po_id,
            m.POApproval.nivel == nivel,
        )
    )
    existing = r.scalar_one_or_none()
    if existing and existing.estado != "pendiente":
        raise HTTPException(400, f"Este nivel ya fue {existing.estado}")

    if action == "approve":
        aprobacion = existing or m.POApproval(
            purchase_order_id=po_id,
            company_id=po.company_id,
            nivel=nivel,
            aprobador_id=aprobador_id,
        )
        aprobacion.estado = "aprobado"
        aprobacion.fecha_decision = func.now()
        aprobacion.comentarios = data.get("comentarios")
        db.add(aprobacion)

        # Check if all levels are approved
        if cfg and cfg.niveles_aprobacion > nivel:
            po.estado = "en_aprobacion"
        else:
            po.estado = "aprobado"
            po.aprobado_por = aprobador_id
            po.fecha_aprobacion = func.now()
    else:
        aprobacion = existing or m.POApproval(
            purchase_order_id=po_id,
            company_id=po.company_id,
            nivel=nivel,
            aprobador_id=aprobador_id,
        )
        aprobacion.estado = "rechazado"
        aprobacion.fecha_decision = func.now()
        aprobacion.motivo_rechazo = data.get("motivo_rechazo")
        db.add(aprobacion)
        po.estado = "rechazado"
        po.rechazado_motivo = data.get("motivo_rechazo")

    # Record history
    old_estado = f"nivel_{nivel}_{action}"
    history = PurchaseOrderHistory(
        purchase_order_id=po_id,
        estado_anterior=old_estado,
        estado_nuevo=po.estado,
        cambiado_por=aprobador_id,
        observaciones=data.get("comentarios", ""),
    )
    db.add(history)

    await db.commit()
    await db.refresh(aprobacion)
    return aprobacion


# ═══════════════════════════════════════════════════════════════
# 1. IMPORTACIÓN
# ═══════════════════════════════════════════════════════════════

async def list_containers(db: AsyncSession, company_id: str, estado: str | None = None):
    q = select(m.ImportContainer).where(m.ImportContainer.company_id == UUID(company_id))
    if estado:
        q = q.where(m.ImportContainer.estado == estado)
    q = q.order_by(m.ImportContainer.created_at.desc()).limit(100)
    result = await db.execute(q)
    return result.scalars().all()


async def get_container(db: AsyncSession, container_id: str):
    result = await db.execute(select(m.ImportContainer).where(m.ImportContainer.id == UUID(container_id)))
    return result.scalar_one_or_none()


async def create_container(db: AsyncSession, company_id: str, data: dict):
    po_id = data.pop("purchase_order_id", None)
    obj = m.ImportContainer(
        company_id=UUID(company_id),
        purchase_order_id=UUID(po_id) if po_id else None,
        **data,
    )
    db.add(obj)
    await db.commit()
    await db.refresh(obj)
    return obj


async def update_container(db: AsyncSession, container_id: str, data: dict):
    obj = await get_container(db, container_id)
    if not obj:
        raise HTTPException(404, "Contenedor no encontrado")
    for key, val in data.items():
        if val is not None:
            setattr(obj, key, val)
    obj.updated_at = func.now()
    await db.commit()
    await db.refresh(obj)
    return obj


async def calculate_landed_costs(db: AsyncSession, container_id: str):
    """Distribute container-level costs to items proportionally by FOB value, then update product costs."""
    from api.src.products.models import Product

    container = await get_container(db, container_id)
    if not container:
        raise HTTPException(404, "Contenedor no encontrado")

    result = await db.execute(
        select(m.ImportItem).where(m.ImportItem.container_id == UUID(container_id))
    )
    items = result.scalars().all()
    if not items:
        raise HTTPException(400, "El contenedor no tiene items")

    total_fob = sum(i.precio_unitario_fob * i.cantidad for i in items)
    if total_fob == 0:
        raise HTTPException(400, "Valor FOB total es 0, no se pueden distribuir costos")

    flete = container.flete_total or Decimal("0")
    seguro = container.seguro_total or Decimal("0")
    arancel = container.arancel_total or Decimal("0")
    desaduanamiento = container.desaduanamiento_total or Decimal("0")
    almacenaje = container.almacenaje_total or Decimal("0")
    transporte_local = container.transporte_local_total or Decimal("0")
    otros = container.otros_costos_total or Decimal("0")

    updated_products = []
    for item in items:
        item_fob = item.precio_unitario_fob * item.cantidad
        ratio = item_fob / total_fob

        item.costo_unitario_flete = (flete * ratio) / item.cantidad
        item.costo_unitario_seguro = (seguro * ratio) / item.cantidad
        item.costo_unitario_arancel = (arancel * ratio) / item.cantidad
        item.costo_unitario_desaduanamiento = (desaduanamiento * ratio) / item.cantidad
        item.costo_unitario_almacenaje = (almacenaje * ratio) / item.cantidad
        item.costo_unitario_transporte_local = (transporte_local * ratio) / item.cantidad
        item.costo_unitario_otros = (otros * ratio) / item.cantidad

        total_por_unidad = (
            item.precio_unitario_fob * container.tipo_cambio +
            item.costo_unitario_flete * container.tipo_cambio +
            item.costo_unitario_seguro * container.tipo_cambio +
            item.costo_unitario_arancel +
            item.costo_unitario_desaduanamiento +
            item.costo_unitario_almacenaje +
            item.costo_unitario_transporte_local +
            item.costo_unitario_otros
        )
        item.costo_unitario_landed = total_por_unidad

        # Update product cost
        r = await db.execute(select(Product).where(Product.id == item.product_id))
        product = r.scalar_one_or_none()
        if product:
            product.ultimo_costo = total_por_unidad
            product.costo_landed = total_por_unidad
            # Recalculate weighted average
            if product.costo_promedio and product.costo_promedio > 0:
                product.costo_promedio = (product.costo_promedio + total_por_unidad) / Decimal("2")
            else:
                product.costo_promedio = total_por_unidad
            updated_products.append(str(product.id))

    container.costo_landed_total = sum(
        i.costo_unitario_landed * i.cantidad for i in items
    )
    container.valor_fob_total = total_fob

    await db.commit()
    return {"items": len(items), "productos_actualizados": updated_products}


async def add_item_to_container(db: AsyncSession, container_id: str, data: dict):
    po_item_id = data.pop("purchase_order_item_id", None)
    obj = m.ImportItem(
        container_id=UUID(container_id),
        purchase_order_item_id=UUID(po_item_id) if po_item_id else None,
        **data,
    )
    db.add(obj)
    await db.commit()
    await db.refresh(obj)
    return obj


async def delete_container_item(db: AsyncSession, item_id: str):
    result = await db.execute(select(m.ImportItem).where(m.ImportItem.id == UUID(item_id)))
    obj = result.scalar_one_or_none()
    if not obj:
        raise HTTPException(404, "Item no encontrado")
    await db.delete(obj)
    await db.commit()
    return True


async def reconcile_container_po(db: AsyncSession, container_id: str, purchase_order_id: str):
    """Reconcile container items with purchase order items. Report differences."""
    from api.src.purchases.models import PurchaseOrderItem

    container = await get_container(db, container_id)
    if not container:
        raise HTTPException(404, "Contenedor no encontrado")

    r = await db.execute(
        select(m.ImportItem).where(m.ImportItem.container_id == UUID(container_id))
    )
    container_items = r.scalars().all()
    if not container_items:
        raise HTTPException(400, "El contenedor no tiene items")

    r = await db.execute(
        select(PurchaseOrderItem).where(PurchaseOrderItem.purchase_order_id == UUID(purchase_order_id))
    )
    po_items = r.scalars().all()
    if not po_items:
        raise HTTPException(400, "La orden de compra no tiene items")

    diferencias = []
    reconciliados = 0

    for ci in container_items:
        # Auto-match by product_id
        matching_po = [pi for pi in po_items if pi.product_id == ci.product_id]
        if matching_po:
            po_item = matching_po[0]
            ci.purchase_order_item_id = po_item.id
            reconciliados += 1

            diff_qty = float(ci.cantidad) - float(po_item.cantidad)
            diff_price = float(ci.precio_unitario_fob) - float(po_item.precio_unitario or 0)
            if abs(diff_qty) > 0.001 or abs(diff_price) > 0.01:
                diferencias.append({
                    "product_id": str(ci.product_id),
                    "po_cantidad": float(po_item.cantidad),
                    "container_cantidad": float(ci.cantidad),
                    "po_precio": float(po_item.precio_unitario or 0),
                    "container_precio": float(ci.precio_unitario_fob),
                    "diferencia_cantidad": diff_qty,
                    "diferencia_precio": diff_price,
                })

    container.purchase_order_id = UUID(purchase_order_id)
    await db.commit()

    return {
        "container_id": container_id,
        "purchase_order_id": purchase_order_id,
        "items_reconciled": reconciliados,
        "diferencias": diferencias,
    }


# ═══════════════════════════════════════════════════════════════
# 2. ACUERDOS CON CLIENTES
# ═══════════════════════════════════════════════════════════════

async def list_customer_agreements(db: AsyncSession, company_id: str, customer_id: str | None = None, estado: str | None = None):
    q = select(m.CustomerAgreement).where(m.CustomerAgreement.company_id == UUID(company_id))
    if customer_id:
        q = q.where(m.CustomerAgreement.customer_id == UUID(customer_id))
    if estado:
        q = q.where(m.CustomerAgreement.estado == estado)
    q = q.order_by(m.CustomerAgreement.created_at.desc()).limit(100)
    result = await db.execute(q)
    return result.scalars().all()


async def create_customer_agreement(db: AsyncSession, company_id: str, data: dict):
    obj = m.CustomerAgreement(company_id=UUID(company_id), **data)
    db.add(obj)
    await db.commit()
    await db.refresh(obj)
    return obj


async def update_customer_agreement(db: AsyncSession, agreement_id: str, data: dict):
    result = await db.execute(select(m.CustomerAgreement).where(m.CustomerAgreement.id == UUID(agreement_id)))
    obj = result.scalar_one_or_none()
    if not obj:
        raise HTTPException(404, "Acuerdo no encontrado")
    for key, val in data.items():
        if val is not None:
            setattr(obj, key, val)
    obj.updated_at = func.now()
    await db.commit()
    await db.refresh(obj)
    return obj


async def get_customer_agreement(db: AsyncSession, agreement_id: str):
    result = await db.execute(select(m.CustomerAgreement).where(m.CustomerAgreement.id == UUID(agreement_id)))
    return result.scalar_one_or_none()


# ═══════════════════════════════════════════════════════════════
# 3. RUTEO DE VENTA
# ═══════════════════════════════════════════════════════════════

async def list_routes(db: AsyncSession, company_id: str, user_id: str | None = None):
    q = select(m.SalesRoute).where(m.SalesRoute.company_id == UUID(company_id))
    if user_id:
        q = q.where(m.SalesRoute.user_id == UUID(user_id))
    q = q.order_by(m.SalesRoute.nombre).limit(100)
    result = await db.execute(q)
    return result.scalars().all()


async def create_route(db: AsyncSession, company_id: str, data: dict):
    obj = m.SalesRoute(company_id=UUID(company_id), **data)
    db.add(obj)
    await db.commit()
    await db.refresh(obj)
    return obj


async def get_route(db: AsyncSession, route_id: str):
    result = await db.execute(select(m.SalesRoute).where(m.SalesRoute.id == UUID(route_id)))
    return result.scalar_one_or_none()


async def list_route_customers(db: AsyncSession, route_id: str):
    result = await db.execute(
        select(m.RouteCustomer).where(m.RouteCustomer.route_id == UUID(route_id))
        .order_by(m.RouteCustomer.orden_visita)
    )
    return result.scalars().all()


async def add_route_customer(db: AsyncSession, route_id: str, data: dict):
    obj = m.RouteCustomer(route_id=UUID(route_id), **data)
    db.add(obj)
    await db.commit()
    await db.refresh(obj)
    return obj


async def remove_route_customer(db: AsyncSession, rc_id: str):
    result = await db.execute(select(m.RouteCustomer).where(m.RouteCustomer.id == UUID(rc_id)))
    obj = result.scalar_one_or_none()
    if not obj:
        raise HTTPException(404, "Cliente de ruta no encontrado")
    await db.delete(obj)
    await db.commit()
    return True


async def list_visits(db: AsyncSession, company_id: str, route_id: str | None = None, fecha: str | None = None):
    q = (
        select(m.RouteVisit)
        .join(m.SalesRoute, m.RouteVisit.route_id == m.SalesRoute.id)
        .where(m.SalesRoute.company_id == UUID(company_id))
    )
    if route_id:
        q = q.where(m.RouteVisit.route_id == UUID(route_id))
    if fecha:
        q = q.where(m.RouteVisit.fecha_planificada == date.fromisoformat(fecha))
    q = q.order_by(m.RouteVisit.fecha_planificada).limit(200)
    result = await db.execute(q)
    return result.scalars().all()


async def create_visit(db: AsyncSession, route_id: str, data: dict):
    obj = m.RouteVisit(route_id=UUID(route_id), **data)
    db.add(obj)
    await db.commit()
    await db.refresh(obj)
    return obj


async def complete_visit(db: AsyncSession, visit_id: str, data: dict):
    result = await db.execute(select(m.RouteVisit).where(m.RouteVisit.id == UUID(visit_id)))
    obj = result.scalar_one_or_none()
    if not obj:
        raise HTTPException(404, "Visita no encontrada")
    for key, val in data.items():
        if val is not None:
            setattr(obj, key, val)
    obj.fecha_visita = func.now()
    await db.commit()
    await db.refresh(obj)
    return obj


# ═══════════════════════════════════════════════════════════════
# 4. CRÉDITO
# ═══════════════════════════════════════════════════════════════

async def get_credit_limit(db: AsyncSession, company_id: str, customer_id: str):
    result = await db.execute(
        select(m.CustomerCreditLimit).where(
            m.CustomerCreditLimit.company_id == UUID(company_id),
            m.CustomerCreditLimit.customer_id == UUID(customer_id),
        )
    )
    return result.scalar_one_or_none()


async def upsert_credit_limit(db: AsyncSession, company_id: str, customer_id: str, data: dict):
    existing = await get_credit_limit(db, company_id, customer_id)
    if existing:
        for key, val in data.items():
            if val is not None:
                setattr(existing, key, val)
        existing.updated_at = func.now()
        obj = existing
    else:
        obj = m.CustomerCreditLimit(
            company_id=UUID(company_id),
            customer_id=UUID(customer_id),
            **data
        )
        db.add(obj)
    await db.commit()
    await db.refresh(obj)
    return obj


async def list_credit_authorizations(db: AsyncSession, company_id: str, customer_id: str | None = None):
    q = select(m.CreditAuthorization).where(m.CreditAuthorization.company_id == UUID(company_id))
    if customer_id:
        q = q.where(m.CreditAuthorization.customer_id == UUID(customer_id))
    q = q.order_by(m.CreditAuthorization.created_at.desc()).limit(100)
    result = await db.execute(q)
    return result.scalars().all()


async def create_credit_authorization(db: AsyncSession, company_id: str, data: dict):
    obj = m.CreditAuthorization(company_id=UUID(company_id), **data)
    db.add(obj)
    await db.commit()
    await db.refresh(obj)
    return obj


async def approve_credit_authorization(db: AsyncSession, auth_id: str, monto_autorizado: Decimal, user_id: str):
    result = await db.execute(select(m.CreditAuthorization).where(m.CreditAuthorization.id == UUID(auth_id)))
    obj = result.scalar_one_or_none()
    if not obj:
        raise HTTPException(404, "Autorización no encontrada")
    obj.estado = "aprobado"
    obj.monto_autorizado = monto_autorizado
    obj.autorizado_por = UUID(user_id)
    obj.updated_at = func.now()
    await db.commit()
    await db.refresh(obj)
    return obj


async def reject_credit_authorization(db: AsyncSession, auth_id: str):
    result = await db.execute(select(m.CreditAuthorization).where(m.CreditAuthorization.id == UUID(auth_id)))
    obj = result.scalar_one_or_none()
    if not obj:
        raise HTTPException(404, "Autorización no encontrada")
    obj.estado = "rechazado"
    obj.updated_at = func.now()
    await db.commit()
    await db.refresh(obj)
    return obj


# ═══════════════════════════════════════════════════════════════
# 5. MÁRGENES Y RENTABILIDAD
# ═══════════════════════════════════════════════════════════════

async def get_product_margins(db: AsyncSession, company_id: str, category_id: str | None = None):
    """Calculate gross margin per product: (precio_venta - costo) / precio_venta * 100."""
    from api.src.products.models import Product
    from api.src.sales.models import Sale, SaleItem

    cid = UUID(company_id)
    q = select(Product).where(Product.company_id == cid, Product.activo == True)
    if category_id:
        q = q.where(Product.categoria_id == UUID(category_id))
    q = q.order_by(Product.nombre).limit(200)
    r = await db.execute(q)
    products = r.scalars().all()

    # Sales this month per product
    start = date.today().replace(day=1)
    r = await db.execute(
        select(SaleItem.product_id, func.sum(SaleItem.cantidad), func.sum(SaleItem.total))
        .join(Sale, SaleItem.sale_id == Sale.id)
        .where(Sale.company_id == cid, Sale.fecha >= start, Sale.estado == "confirmado")
        .group_by(SaleItem.product_id)
    )
    ventas_mes = {row[0]: (row[1] or 0, row[2] or 0) for row in r}

    results = []
    for p in products:
        costo = p.costo_promedio or p.costo_landed or p.ultimo_costo or Decimal("0")
        precio = p.precio_venta or Decimal("0")
        margen = precio - costo if costo > 0 and precio > 0 else Decimal("0")
        margen_pct = (margen / precio * 100) if precio > 0 else Decimal("0")
        vendido = ventas_mes.get(p.id, (0, 0))

        results.append({
            "product_id": p.id,
            "product_name": p.nombre,
            "sku": p.sku,
            "costo_unitario": costo,
            "precio_venta": precio,
            "margen_bruto": margen,
            "margen_pct": round(margen_pct, 2),
            "vendido_mes": vendido[0],
            "ganancia_mes": round(margen * vendido[0], 2),
        })

    results.sort(key=lambda x: x["margen_pct"])
    return results


async def get_route_profitability(db: AsyncSession, company_id: str):
    """Profitability per sales route for the current month."""
    from api.src.sales.models import Sale
    from api.src.products.models import Product

    cid = UUID(company_id)
    r = await db.execute(
        select(m.SalesRoute).where(m.SalesRoute.company_id == cid, m.SalesRoute.estado == "activo")
    )
    routes = r.scalars().all()

    start = date.today().replace(day=1)
    results = []

    for route in routes:
        r = await db.execute(
            select(func.count(m.RouteVisit.id))
            .where(m.RouteVisit.route_id == route.id)
        )
        total_visitas = r.scalar() or 0

        r = await db.execute(
            select(func.count(m.RouteVisit.id))
            .where(m.RouteVisit.route_id == route.id, m.RouteVisit.estado == "visitado")
        )
        completadas = r.scalar() or 0

        r = await db.execute(
            select(func.coalesce(func.sum(Sale.total), 0))
            .where(Sale.company_id == cid, Sale.user_id == route.user_id, Sale.fecha >= start, Sale.estado == "confirmado")
        )
        monto = r.scalar() or Decimal("0")

        results.append({
            "route_id": route.id,
            "route_name": route.nombre,
            "vendedor_id": route.user_id,
            "vendedor_nombre": "",
            "total_visitas": total_visitas,
            "visitas_completadas": completadas,
            "monto_vendido": monto,
            "margen_promedio": Decimal("0"),
            "ganancia_total": Decimal("0"),
        })

    return results


async def get_customer_profitability(db: AsyncSession, company_id: str):
    """Profitability per customer for the current month."""
    from api.src.sales.models import Sale, SaleItem
    from api.src.customers.models import Customer
    from api.src.products.models import Product

    cid = UUID(company_id)
    start = date.today().replace(day=1)

    r = await db.execute(
        select(
            Sale.customer_id,
            func.count(Sale.id),
            func.sum(Sale.total),
            func.max(Sale.fecha),
        )
        .where(Sale.company_id == cid, Sale.fecha >= start, Sale.estado == "confirmado")
        .group_by(Sale.customer_id)
        .limit(100)
    )
    rows = r.all()

    results = []
    for customer_id, count, total, ultima_fecha in rows:
        r = await db.execute(select(Customer).where(Customer.id == customer_id))
        customer = r.scalar_one_or_none()
        if not customer:
            continue

        results.append({
            "customer_id": customer_id,
            "customer_name": getattr(customer, "nombre", getattr(customer, "razon_social", "N/A")),
            "total_ventas": total or Decimal("0"),
            "margen_promedio": Decimal("0"),
            "ganancia_total": Decimal("0"),
            "frecuencia_compra_dias": 30 // count if count else 30,
            "ultima_compra": ultima_fecha.date() if ultima_fecha else None,
        })

    return results


# ═══════════════════════════════════════════════════════════════
# 6. DASHBOARD
# ═══════════════════════════════════════════════════════════════

async def get_dashboard(db: AsyncSession, company_id: str) -> dict:
    from api.src.sales.models import Sale
    from api.src.products.models import Product
    from api.src.customers.models import Customer
    from api.src.financial.models import SupplierInvoice
    from api.src.accounts_receivable.models import Account

    cid = UUID(company_id)

    r = await db.execute(select(func.count(Customer.id)).where(Customer.company_id == cid))
    total_clientes = r.scalar() or 0

    r = await db.execute(
        select(func.count(m.CustomerCreditLimit.id)).where(m.CustomerCreditLimit.company_id == cid)
    )
    clientes_con_credito = r.scalar() or 0

    r = await db.execute(
        select(func.count(m.CustomerCreditLimit.id)).where(
            and_(m.CustomerCreditLimit.company_id == cid, m.CustomerCreditLimit.bloqueado_por_mora == True)
        )
    )
    clientes_bloqueados = r.scalar() or 0

    start_of_month = date.today().replace(day=1)
    r = await db.execute(
        select(func.coalesce(func.sum(Sale.total), 0))
        .where(and_(Sale.company_id == cid, Sale.fecha >= start_of_month))
    )
    ventas_mes = r.scalar() or Decimal("0")

    r = await db.execute(
        select(func.count(m.ImportContainer.id))
        .where(and_(m.ImportContainer.company_id == cid, m.ImportContainer.estado == "en_transito"))
    )
    en_transito = r.scalar() or 0

    r = await db.execute(
        select(func.count(m.ImportContainer.id))
        .where(and_(m.ImportContainer.company_id == cid, m.ImportContainer.estado == "en_aduanas"))
    )
    en_aduanas = r.scalar() or 0

    r = await db.execute(
        select(func.count(SupplierInvoice.id))
        .where(and_(
            SupplierInvoice.company_id == cid,
            SupplierInvoice.estado == "pendiente",
            SupplierInvoice.fecha_vencimiento < date.today(),
        ))
    )
    facturas_vencidas = r.scalar() or 0

    r = await db.execute(
        select(func.coalesce(func.sum(SupplierInvoice.saldo_pendiente), 0))
        .where(and_(
            SupplierInvoice.company_id == cid,
            SupplierInvoice.estado == "pendiente",
            SupplierInvoice.fecha_vencimiento < date.today(),
        ))
    )
    monto_vencido = r.scalar() or Decimal("0")

    r = await db.execute(
        select(func.count(Product.id))
        .where(and_(Product.company_id == cid, Product.stock_minimo > 0))
    )
    bajo_stock = r.scalar() or 0

    today = date.today()
    r = await db.execute(
        select(func.count(m.RouteVisit.id))
        .where(and_(
            m.RouteVisit.fecha_planificada == today,
            m.SalesRoute.company_id == cid,
        ))
        .select_from(m.RouteVisit.__table__.join(m.SalesRoute.__table__, m.RouteVisit.route_id == m.SalesRoute.id))
    )
    visitas_hoy = r.scalar() or 0

    r = await db.execute(
        select(func.count(m.RouteVisit.id))
        .where(and_(
            m.RouteVisit.fecha_planificada == today,
            m.RouteVisit.estado == "visitado",
            m.SalesRoute.company_id == cid,
        ))
        .select_from(m.RouteVisit.__table__.join(m.SalesRoute.__table__, m.RouteVisit.route_id == m.SalesRoute.id))
    )
    visitas_completadas = r.scalar() or 0

    # Containers pending landed cost calculation
    r = await db.execute(
        select(func.count(m.ImportContainer.id))
        .where(and_(
            m.ImportContainer.company_id == cid,
            m.ImportContainer.estado.in_(["nacionalizado", "en_almacen"]),
            m.ImportContainer.costo_landed_total == 0,
        ))
    )
    costo_pendiente = r.scalar() or 0

    # PO pending approval
    from api.src.purchases.models import PurchaseOrder
    r = await db.execute(
        select(func.count(PurchaseOrder.id))
        .where(and_(
            PurchaseOrder.company_id == cid,
            PurchaseOrder.estado.in_(["pendiente", "en_aprobacion"]),
        ))
    )
    po_pendientes = r.scalar() or 0

    return {
        "total_clientes": total_clientes,
        "clientes_con_credito": clientes_con_credito,
        "clientes_bloqueados": clientes_bloqueados,
        "ventas_mes": ventas_mes,
        "margen_promedio": Decimal("0"),
        "facturas_vencidas": facturas_vencidas,
        "monto_vencido": monto_vencido,
        "contenedores_en_transito": en_transito,
        "contenedores_en_aduanas": en_aduanas,
        "productos_bajo_stock": bajo_stock,
        "visitas_hoy": visitas_hoy,
        "visitas_completadas_hoy": visitas_completadas,
        "costo_landed_pendiente": costo_pendiente,
        "po_pendientes_aprobacion": po_pendientes,
    }
