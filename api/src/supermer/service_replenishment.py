"""Fase 2 — Auto Replenishment & Cross-Docking service"""

from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from typing import Optional
from uuid import UUID
from sqlalchemy import select, func, and_, extract
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException

from .models import ReplenishmentRule, ReplenishmentSuggestion, CrossDockOrder
from api.src.sales.models import Sale, SaleItem
from api.src.products.models import Product
from api.src.inventory.models import Stock, Warehouse


# ---------------------------------------------------------------------------
# RULES
# ---------------------------------------------------------------------------

async def list_replenishment_rules(company_id: UUID, db: AsyncSession, activa: Optional[bool] = None, producto_id: Optional[UUID] = None):
    q = select(ReplenishmentRule).where(ReplenishmentRule.company_id == company_id)
    if activa is not None:
        q = q.where(ReplenishmentRule.activa == activa)
    if producto_id:
        q = q.where(ReplenishmentRule.producto_id == producto_id)
    q = q.order_by(ReplenishmentRule.created_at.desc())
    result = await db.execute(q)
    return result.scalars().all()


async def get_replenishment_rule(rule_id: UUID, db: AsyncSession):
    result = await db.execute(select(ReplenishmentRule).where(ReplenishmentRule.id == rule_id))
    r = result.scalar_one_or_none()
    if not r:
        raise HTTPException(404, "Replenishment rule not found")
    return r


async def create_replenishment_rule(company_id: UUID, data, db: AsyncSession):
    r = ReplenishmentRule(company_id=company_id, **data.model_dump(exclude_none=True))
    db.add(r)
    await db.commit()
    await db.refresh(r)
    return r


async def update_replenishment_rule(rule_id: UUID, data, db: AsyncSession):
    r = await get_replenishment_rule(rule_id, db)
    for k, v in data.model_dump(exclude_none=True).items():
        setattr(r, k, v)
    await db.commit()
    await db.refresh(r)
    return r


# ---------------------------------------------------------------------------
# SUGGESTION ENGINE
# ---------------------------------------------------------------------------

async def _calculate_seasonal_demand(db: AsyncSession, company_id: UUID, producto_id: UUID, dias: int) -> Decimal:
    """Real average daily demand from confirmed sales over the last `dias` days."""
    hoy = date.today()
    inicio = hoy - timedelta(days=dias)
    result = await db.execute(
        select(func.avg(SaleItem.cantidad)).join(
            Sale, Sale.id == SaleItem.sale_id,
        ).where(
            SaleItem.product_id == producto_id,
            Sale.company_id == company_id,
            Sale.estado == "confirmado",
            func.date(Sale.fecha) >= inicio,
        )
    )
    avg = result.scalar()
    return Decimal(str(avg)) if avg else Decimal("0")


async def _get_pending_po_qty(db: AsyncSession, company_id: UUID, producto_id: UUID) -> Decimal:
    """Cantidad ya pedida y todavia no recibida (OCs abiertas) para este producto."""
    from api.src.purchases.models import PurchaseOrder, PurchaseOrderItem
    result = await db.execute(
        select(func.coalesce(func.sum(PurchaseOrderItem.cantidad - PurchaseOrderItem.cantidad_recibida), 0))
        .join(PurchaseOrder, PurchaseOrder.id == PurchaseOrderItem.purchase_order_id)
        .where(
            PurchaseOrder.company_id == company_id,
            PurchaseOrder.estado.in_(["borrador", "enviada", "confirmada", "parcial"]),
            PurchaseOrderItem.product_id == producto_id,
        )
    )
    qty = result.scalar() or 0
    return max(Decimal("0"), Decimal(str(qty)))


async def generate_suggestions(company_id: UUID, db: AsyncSession, proveedor_id: Optional[UUID] = None, solo_criticos: bool = False):
    q = select(ReplenishmentRule).where(
        ReplenishmentRule.company_id == company_id,
        ReplenishmentRule.activa == True,
    )
    if proveedor_id:
        q = q.where(
            (ReplenishmentRule.proveedor_preferente_id == proveedor_id) |
            (ReplenishmentRule.proveedor_secundario_id == proveedor_id)
        )
    rules = (await db.execute(q)).scalars().all()

    productos_result = await db.execute(select(Product).where(Product.company_id == company_id))
    productos = {str(p.id): p for p in productos_result.scalars().all()}

    suggestions = []
    for rule in rules:
        producto_id = rule.producto_id
        prod = productos.get(str(producto_id))
        if not prod:
            continue

        # Stock actual = suma de todas las bodegas de la compañía para ese producto
        stock_result = await db.execute(
            select(func.coalesce(func.sum(Stock.cantidad), 0)).join(
                Warehouse, Warehouse.id == Stock.warehouse_id,
            ).where(
                Stock.product_id == producto_id,
                Warehouse.company_id == company_id,
            )
        )
        stock_actual = Decimal(str(stock_result.scalar() or 0))
        stock_pendiente = await _get_pending_po_qty(db, company_id, producto_id)
        stock_disponible = stock_actual + stock_pendiente

        demanda = await _calculate_seasonal_demand(db, company_id, producto_id, rule.dias_historial)
        demanda_diaria = demanda / Decimal(str(max(rule.dias_historial, 1)))

        punto_pedido = (demanda_diaria * Decimal(str(rule.lead_time_dias))) + (
            rule.stock_seguridad_unidades or (demanda_diaria * Decimal(str(rule.stock_seguridad_dias)))
        )

        if solo_criticos and stock_disponible > punto_pedido:
            continue

        if stock_disponible <= punto_pedido:
            deficit = punto_pedido - stock_disponible + demanda_diaria * Decimal(str(rule.lead_time_dias))
            cantidad = deficit
            if rule.multiplo_pedido and rule.multiplo_pedido > 0:
                multiplos = (cantidad / rule.multiplo_pedido).__ceil__()
                cantidad = max(rule.multiplo_pedido * Decimal(multiplos), rule.cantidad_minima_pedido or Decimal("0"))
            elif rule.cantidad_minima_pedido and cantidad < rule.cantidad_minima_pedido:
                cantidad = rule.cantidad_minima_pedido

            sup = ReplenishmentSuggestion(
                company_id=company_id,
                producto_id=producto_id,
                proveedor_id=rule.proveedor_preferente_id,
                regla_id=rule.id,
                stock_actual=stock_actual,
                stock_pendiente_recibir=stock_pendiente,
                demanda_diaria_avg=demanda_diaria,
                demanda_pronosticada=demanda,
                punto_pedido=punto_pedido,
                cantidad_sugerida=cantidad,
                estado="pendiente",
            )
            db.add(sup)
            suggestions.append(sup)

    await db.commit()
    return suggestions


async def list_suggestions(company_id: UUID, db: AsyncSession, estado: Optional[str] = None):
    q = select(ReplenishmentSuggestion).where(ReplenishmentSuggestion.company_id == company_id)
    if estado:
        q = q.where(ReplenishmentSuggestion.estado == estado)
    q = q.order_by(ReplenishmentSuggestion.fecha_generacion.desc())
    result = await db.execute(q)
    return result.scalars().all()


async def review_suggestion(suggestion_id: UUID, data, db: AsyncSession, user_id: UUID):
    result = await db.execute(select(ReplenishmentSuggestion).where(ReplenishmentSuggestion.id == suggestion_id))
    sug = result.scalar_one_or_none()
    if not sug:
        raise HTTPException(404, "Suggestion not found")
    if data.accion == "aprobar":
        sug.estado = "aprobada"
    elif data.accion == "rechazar":
        sug.estado = "rechazada"
    else:
        raise HTTPException(400, "Invalid action, use 'aprobar' or 'rechazar'")
    sug.revisado_por = user_id
    sug.revisado_at = datetime.now(timezone.utc)
    if data.notas:
        sug.notas = data.notas
    await db.commit()
    await db.refresh(sug)
    return sug


# ---------------------------------------------------------------------------
# CROSS-DOCKING
# ---------------------------------------------------------------------------

async def list_crossdock_orders(company_id: UUID, db: AsyncSession, fecha: Optional[date] = None, estado: Optional[str] = None):
    q = select(CrossDockOrder).where(CrossDockOrder.company_id == company_id)
    if fecha:
        q = q.where(CrossDockOrder.fecha_crossdock == fecha)
    if estado:
        q = q.where(CrossDockOrder.estado == estado)
    q = q.order_by(CrossDockOrder.fecha_crossdock)
    result = await db.execute(q)
    return result.scalars().all()


async def create_crossdock_order(company_id: UUID, data, db: AsyncSession):
    o = CrossDockOrder(company_id=company_id, **data.model_dump(exclude_none=True))
    db.add(o)
    await db.commit()
    await db.refresh(o)
    return o


async def complete_crossdock_order(order_id: UUID, db: AsyncSession):
    result = await db.execute(select(CrossDockOrder).where(CrossDockOrder.id == order_id))
    o = result.scalar_one_or_none()
    if not o:
        raise HTTPException(404, "Cross-dock order not found")
    o.estado = "completado"
    o.completado_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(o)
    return o


# ---------------------------------------------------------------------------
# DASHBOARD
# ---------------------------------------------------------------------------

async def get_replenishment_dashboard(company_id: UUID, db: AsyncSession):
    reglas_activas = (await db.execute(
        select(func.count()).select_from(ReplenishmentRule).where(
            ReplenishmentRule.company_id == company_id,
            ReplenishmentRule.activa == True,
        )
    )).scalar()

    pendientes = (await db.execute(
        select(func.count()).select_from(ReplenishmentSuggestion).where(
            ReplenishmentSuggestion.company_id == company_id,
            ReplenishmentSuggestion.estado == "pendiente",
        )
    )).scalar()

    aprobadas = (await db.execute(
        select(func.count()).select_from(ReplenishmentSuggestion).where(
            ReplenishmentSuggestion.company_id == company_id,
            ReplenishmentSuggestion.estado == "aprobada",
        )
    )).scalar()

    hoy = date.today()
    crossdock_hoy = (await db.execute(
        select(func.count()).select_from(CrossDockOrder).where(
            CrossDockOrder.company_id == company_id,
            CrossDockOrder.fecha_crossdock == hoy,
        )
    )).scalar()

    return {
        "reglas_activas": reglas_activas,
        "sugerencias_pendientes": pendientes,
        "sugerencias_aprobadas": aprobadas,
        "crossdock_hoy": crossdock_hoy,
    }
