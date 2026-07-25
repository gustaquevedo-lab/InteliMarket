"""Fase 3 — Pricing service: zones, competitor prices, price audit, psychological rules
💡 For operators: price changes >10% require approval. Use competitor prices to stay competitive.
Psychological pricing automatically rounds to .990/.900 for better perceived value."""

from datetime import datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID
from sqlalchemy import func, and_
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException

from .models import StorePriceZone, CompetitorPrice, PriceAuditLog, PsychologicalPriceRule



# ---------------------------------------------------------------------------
# PRICE ZONES
# ---------------------------------------------------------------------------

async def list_price_zones(company_id: UUID, db: AsyncSession, activa: Optional[bool] = None):
    q = db.query(StorePriceZone).filter(StorePriceZone.company_id == company_id)
    if activa is not None:
        q = q.filter(StorePriceZone.activa == activa)
    return q.order_by(StorePriceZone.nombre).all()

async def create_price_zone(company_id: UUID, data, db: AsyncSession):
    z = StorePriceZone(company_id=company_id, **data.model_dump(exclude_none=True))
    db.add(z); db.commit(); db.refresh(z)
    return z

async def update_price_zone(zone_id: UUID, data, db: AsyncSession):
    z = db.query(StorePriceZone).get(zone_id)
    if not z: raise HTTPException(404, "Price zone not found")
    for k, v in data.model_dump(exclude_none=True).items():
        setattr(z, k, v)
    db.commit(); db.refresh(z)
    return z


# ---------------------------------------------------------------------------
# COMPETITOR PRICES
# ---------------------------------------------------------------------------

async def list_competitor_prices(company_id: UUID, db: AsyncSession, producto_id: Optional[UUID] = None, competidor: Optional[str] = None):
    q = db.query(CompetitorPrice).filter(CompetitorPrice.company_id == company_id)
    if producto_id: q = q.filter(CompetitorPrice.producto_id == producto_id)
    if competidor: q = q.filter(CompetitorPrice.competidor.ilike(f"%{competidor}%"))
    return q.order_by(CompetitorPrice.fecha_captura.desc()).all()

async def create_competitor_price(company_id: UUID, data, db: AsyncSession):
    cp = CompetitorPrice(company_id=company_id, **data.model_dump(exclude_none=True))
    # Calculate difference vs our current price
    try:
        from app.models import Product
        prod = db.query(Product).get(cp.producto_id)
        if prod and prod.sale_price:
            our_price = Decimal(str(prod.sale_price))
            if our_price > 0:
                cp.diferencia_pct = ((cp.precio - our_price) / our_price) * 100
    except: pass
    db.add(cp); db.commit(); db.refresh(cp)
    return cp

async def get_competitor_price_latest(company_id: UUID, producto_id: UUID, db: AsyncSession):
    """Get latest price from each competitor for a product."""
    rows = db.query(CompetitorPrice).filter(
        CompetitorPrice.company_id == company_id,
        CompetitorPrice.producto_id == producto_id,
    ).order_by(CompetitorPrice.fecha_captura.desc()).all()
    seen = set()
    result = []
    for r in rows:
        if r.competidor not in seen:
            seen.add(r.competidor)
            result.append(r)
    return result


# ---------------------------------------------------------------------------
# PRICE AUDIT LOG
# ---------------------------------------------------------------------------

async def list_price_audit_logs(company_id: UUID, db: AsyncSession, producto_id: Optional[UUID] = None, estado: Optional[str] = None):
    q = db.query(PriceAuditLog).filter(PriceAuditLog.company_id == company_id)
    if producto_id: q = q.filter(PriceAuditLog.producto_id == producto_id)
    if estado: q = q.filter(PriceAuditLog.estado == estado)
    return q.order_by(PriceAuditLog.cambiado_at.desc()).all()

async def create_price_audit_log(company_id: UUID, data, db: AsyncSession, user_id: UUID):
    log = PriceAuditLog(company_id=company_id, cambiado_por=user_id, **data.model_dump(exclude_none=True))
    if log.precio_anterior and log.precio_nuevo and log.precio_anterior > 0:
        log.diferencia_pct = ((log.precio_nuevo - log.precio_anterior) / log.precio_anterior) * 100
        # Auto-flag for approval if change > 10%
        if abs(log.diferencia_pct) > 10:
            log.requiere_aprobacion = True
            log.estado = "pendiente"
    db.add(log); db.commit(); db.refresh(log)
    return log

async def approve_price_change(log_id: UUID, approved_by: UUID, db: AsyncSession):
    log = db.query(PriceAuditLog).get(log_id)
    if not log: raise HTTPException(404, "Price audit log not found")
    log.estado = "aplicado"
    log.aprobado_por = approved_by
    log.aprobado_at = datetime.utcnow()
    db.commit(); db.refresh(log)
    return log


# ---------------------------------------------------------------------------
# PSYCHOLOGICAL PRICING RULES
# ---------------------------------------------------------------------------

async def list_psychological_rules(company_id: UUID, db: AsyncSession, activa: Optional[bool] = None):
    q = db.query(PsychologicalPriceRule).filter(PsychologicalPriceRule.company_id == company_id)
    if activa is not None: q = q.filter(PsychologicalPriceRule.activa == activa)
    return q.order_by(PsychologicalPriceRule.nombre).all()

async def create_psychological_rule(company_id: UUID, data, db: AsyncSession):
    r = PsychologicalPriceRule(company_id=company_id, **data.model_dump(exclude_none=True))
    db.add(r); db.commit(); db.refresh(r)
    return r

def apply_psychological_price(precio: Decimal, tipo_redondeo: str) -> Decimal:
    """Apply psychological rounding to a price.
    .990 → 1.990 instead of 2.000  |  .900 → 1.900  |  .500 → 1.500
    .000 → 2.000 (integer)         |  .999 → 1.999"""
    entero = int(precio)
    if tipo_redondeo == ".990": return Decimal(f"{entero}.990")
    elif tipo_redondeo == ".900": return Decimal(f"{entero}.900")
    elif tipo_redondeo == ".500": return Decimal(f"{entero}.500")
    elif tipo_redondeo == ".000": return Decimal(str(entero + 1))
    elif tipo_redondeo == ".999": return Decimal(f"{entero}.999")
    return precio

async def apply_psychological_to_product(producto_id: UUID, rule_id: UUID, db: AsyncSession):
    rule = db.query(PsychologicalPriceRule).get(rule_id)
    if not rule: raise HTTPException(404, "Rule not found")
    from app.models import Product
    prod = db.query(Product).get(producto_id)
    if not prod or not prod.sale_price: raise HTTPException(400, "Product not found or no price")
    original = Decimal(str(prod.sale_price))
    new_price = apply_psychological_price(original, rule.tipo_redondeo)
    return {"producto_id": str(producto_id), "precio_original": original, "precio_psicologico": new_price, "regla": rule.nombre}


# ---------------------------------------------------------------------------
# PRICING DASHBOARD
# ---------------------------------------------------------------------------

async def get_pricing_dashboard(company_id: UUID, db: AsyncSession):
    return {
        "zonas_activas": db.query(StorePriceZone).filter(StorePriceZone.company_id == company_id, StorePriceZone.activa == True).count(),
        "competidores_seguidos": len(db.query(CompetitorPrice.competidor).filter(CompetitorPrice.company_id == company_id).distinct().all()),
        "cambios_24h": db.query(PriceAuditLog).filter(
            PriceAuditLog.company_id == company_id,
            PriceAuditLog.cambiado_at >= datetime.utcnow().replace(hour=0, minute=0, second=0),
        ).count(),
        "cambios_pendientes_aprobacion": db.query(PriceAuditLog).filter(
            PriceAuditLog.company_id == company_id, PriceAuditLog.estado == "pendiente",
        ).count(),
        "reglas_psicologicas": db.query(PsychologicalPriceRule).filter(
            PsychologicalPriceRule.company_id == company_id, PsychologicalPriceRule.activa == True,
        ).count(),
    }
