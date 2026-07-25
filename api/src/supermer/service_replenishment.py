"""Fase 2 — Auto Replenishment & Cross-Docking service"""

from datetime import date, datetime, timedelta
from decimal import Decimal
from typing import Optional
from uuid import UUID
from sqlalchemy import func, and_, extract
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from fastapi import HTTPException

from .models import ReplenishmentRule, ReplenishmentSuggestion, CrossDockOrder



# ---------------------------------------------------------------------------
# RULES
# ---------------------------------------------------------------------------

async def list_replenishment_rules(company_id: UUID, db: AsyncSession, activa: Optional[bool] = None, producto_id: Optional[UUID] = None):
    q = db.query(ReplenishmentRule).filter(ReplenishmentRule.company_id == company_id)
    if activa is not None:
        q = q.filter(ReplenishmentRule.activa == activa)
    if producto_id:
        q = q.filter(ReplenishmentRule.producto_id == producto_id)
    return q.order_by(ReplenishmentRule.created_at.desc()).all()


async def get_replenishment_rule(rule_id: UUID, db: AsyncSession):
    r = db.query(ReplenishmentRule).get(rule_id)
    if not r:
        raise HTTPException(404, "Replenishment rule not found")
    return r


async def create_replenishment_rule(company_id: UUID, data, db: AsyncSession):
    r = ReplenishmentRule(company_id=company_id, **data.model_dump(exclude_none=True))
    db.add(r)
    db.commit()
    db.refresh(r)
    return r


async def update_replenishment_rule(rule_id: UUID, data, db: AsyncSession):
    r = await get_replenishment_rule(rule_id, db)
    for k, v in data.model_dump(exclude_none=True).items():
        setattr(r, k, v)
    db.commit()
    db.refresh(r)
    return r


# ---------------------------------------------------------------------------
# SUGGESTION ENGINE
# ---------------------------------------------------------------------------

def _calculate_seasonal_demand(db, producto_id: UUID, dias: int) -> Decimal:
    """Simple seasonal forecast using same-period-last-week average."""
    from app.models import OrderItem, Order
    hoy = date.today()
    inicio = hoy - timedelta(days=dias)
    # Get sales from order_items joined with orders
    rows = db.query(func.avg(OrderItem.quantity)).join(
        Order, OrderItem.order_id == Order.id,
    ).filter(
        OrderItem.product_id == producto_id,
        Order.status == "delivered",
        func.date(Order.created_at) >= inicio,
    ).scalar()
    return Decimal(str(rows)) if rows else Decimal("0")


async def generate_suggestions(company_id: UUID, db: AsyncSession, proveedor_id: Optional[UUID] = None, solo_criticos: bool = False):
    rules = db.query(ReplenishmentRule).filter(
        ReplenishmentRule.company_id == company_id,
        ReplenishmentRule.activa == True,
    )
    if proveedor_id:
        rules = rules.filter(
            (ReplenishmentRule.proveedor_preferente_id == proveedor_id) |
            (ReplenishmentRule.proveedor_secundario_id == proveedor_id),
        )
    rules = rules.all()

    # Get current stock from products
    from app.models import Product, Inventory
    productos = {str(p.id): p for p in db.query(Product).all()}

    suggestions = []
    for rule in rules:
        producto_id = rule.producto_id
        prod = productos.get(str(producto_id))
        if not prod:
            continue

        # Get current stock
        inv = db.query(Inventory).filter(
            Inventory.product_id == producto_id,
            Inventory.company_id == company_id,
        ).first()

        stock_actual = Decimal(str(inv.quantity_on_hand)) if inv else Decimal("0")
        stock_pendiente = Decimal(str(inv.quantity_on_order)) if inv and inv.quantity_on_order else Decimal("0")

        # Calculate average daily demand
        demanda = _calculate_seasonal_demand(db, producto_id, rule.dias_historial)
        demanda_diaria = demanda / Decimal(str(max(rule.dias_historial, 1)))

        # Calculate reorder point
        punto_pedido = (demanda_diaria * Decimal(str(rule.lead_time_dias))) + (
            rule.stock_seguridad_unidades or (demanda_diaria * Decimal(str(rule.stock_seguridad_dias)))
        )

        if solo_criticos and stock_actual > punto_pedido:
            continue

        # Calculate suggested quantity
        if stock_actual <= punto_pedido:
            deficit = punto_pedido - stock_actual + demanda_diaria * Decimal(str(rule.lead_time_dias))
            cantidad = deficit
            if rule.multiplo_pedido and rule.multiplo_pedido > 0:
                # Round up to nearest multiple
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

    db.commit()
    return suggestions


async def list_suggestions(company_id: UUID, db: AsyncSession, estado: Optional[str] = None):
    q = db.query(ReplenishmentSuggestion).filter(ReplenishmentSuggestion.company_id == company_id)
    if estado:
        q = q.filter(ReplenishmentSuggestion.estado == estado)
    return q.order_by(ReplenishmentSuggestion.fecha_generacion.desc()).all()


async def review_suggestion(suggestion_id: UUID, data, db: AsyncSession, user_id: UUID):
    sug = db.query(ReplenishmentSuggestion).get(suggestion_id)
    if not sug:
        raise HTTPException(404, "Suggestion not found")
    if data.accion == "aprobar":
        sug.estado = "aprobada"
    elif data.accion == "rechazar":
        sug.estado = "rechazada"
    else:
        raise HTTPException(400, "Invalid action, use 'aprobar' or 'rechazar'")
    sug.revisado_por = user_id
    sug.revisado_at = datetime.utcnow()
    if data.notas:
        sug.notas = data.notas
    db.commit()
    db.refresh(sug)
    return sug


# ---------------------------------------------------------------------------
# CROSS-DOCKING
# ---------------------------------------------------------------------------

async def list_crossdock_orders(company_id: UUID, db: AsyncSession, fecha: Optional[date] = None, estado: Optional[str] = None):
    q = db.query(CrossDockOrder).filter(CrossDockOrder.company_id == company_id)
    if fecha:
        q = q.filter(CrossDockOrder.fecha_crossdock == fecha)
    if estado:
        q = q.filter(CrossDockOrder.estado == estado)
    return q.order_by(CrossDockOrder.fecha_crossdock).all()


async def create_crossdock_order(company_id: UUID, data, db: AsyncSession):
    o = CrossDockOrder(company_id=company_id, **data.model_dump(exclude_none=True))
    db.add(o)
    db.commit()
    db.refresh(o)
    return o


async def complete_crossdock_order(order_id: UUID, db: AsyncSession):
    o = db.query(CrossDockOrder).get(order_id)
    if not o:
        raise HTTPException(404, "Cross-dock order not found")
    o.estado = "completado"
    o.completado_at = datetime.utcnow()
    db.commit()
    db.refresh(o)
    return o


# ---------------------------------------------------------------------------
# DASHBOARD
# ---------------------------------------------------------------------------

async def get_replenishment_dashboard(company_id: UUID, db: AsyncSession):
    reglas_activas = db.query(ReplenishmentRule).filter(
        ReplenishmentRule.company_id == company_id,
        ReplenishmentRule.activa == True,
    ).count()

    pendientes = db.query(ReplenishmentSuggestion).filter(
        ReplenishmentSuggestion.company_id == company_id,
        ReplenishmentSuggestion.estado == "pendiente",
    ).count()

    aprobadas = db.query(ReplenishmentSuggestion).filter(
        ReplenishmentSuggestion.company_id == company_id,
        ReplenishmentSuggestion.estado == "aprobada",
    ).count()

    hoy = date.today()
    crossdock_hoy = db.query(CrossDockOrder).filter(
        CrossDockOrder.company_id == company_id,
        CrossDockOrder.fecha_crossdock == hoy,
    ).count()

    return {
        "reglas_activas": reglas_activas,
        "sugerencias_pendientes": pendientes,
        "sugerencias_aprobadas": aprobadas,
        "crossdock_hoy": crossdock_hoy,
    }
