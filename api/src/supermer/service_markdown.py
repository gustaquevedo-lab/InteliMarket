"""Fase 3 — Dynamic Markdown service: rules engine, recommendation generator
💡 Operators: The markdown engine calculates the optimal discount based on:
- Days remaining until expiry (shorter = higher discount)
- Product elasticity (elástico = higher discount needed)
- Current inventory level (overstock = more aggressive)
- Hour of day (after 6PM = liquidate before closing)
Urgency score 1-100 helps prioritize which products to mark down first."""

from datetime import date, datetime, timedelta
from decimal import Decimal, ROUND_HALF_UP
from typing import Optional
from uuid import UUID
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException

from .models import DynamicMarkdownRule, MarkdownRecommendation


# Elasticity factors per category (higher = more discount needed to sell)
CATEGORY_ELASTICITY = {
    "lacteos": 1.8, "carnes": 1.5, "panaderia": 1.2, "verduleria": 1.6,
    "bebidas": 1.3, "limpieza": 1.1, "perfumeria": 1.0, "almacen": 1.2,
    "congelados": 1.4, "rotiseria": 1.7,
}

# Hour-of-day urgency multiplier (after 18:00 = more urgent)
HOUR_URGENCY = {h: 1.0 for h in range(24)}
for h in range(16, 19): HOUR_URGENCY[h] = 1.3
for h in range(19, 22): HOUR_URGENCY[h] = 1.8
for h in range(22, 24): HOUR_URGENCY[h] = 2.5


# ---------------------------------------------------------------------------
# DYNAMIC MARKDOWN RULES
# ---------------------------------------------------------------------------

async def list_markdown_rules(company_id: UUID, db: AsyncSession, activa: Optional[bool] = None):
    q = select(DynamicMarkdownRule).where(DynamicMarkdownRule.company_id == company_id)
    if activa is not None:
        q = q.where(DynamicMarkdownRule.activa == activa)
    q = q.order_by(DynamicMarkdownRule.categoria)
    result = await db.execute(q)
    return result.scalars().all()

async def create_markdown_rule(company_id: UUID, data, db: AsyncSession):
    r = DynamicMarkdownRule(company_id=company_id, **data.model_dump(exclude_none=True))
    db.add(r)
    await db.commit()
    await db.refresh(r)
    return r

async def update_markdown_rule(rule_id: UUID, data, db: AsyncSession):
    result = await db.execute(select(DynamicMarkdownRule).where(DynamicMarkdownRule.id == rule_id))
    r = result.scalar_one_or_none()
    if not r: raise HTTPException(404, "Markdown rule not found")
    for k, v in data.model_dump(exclude_none=True).items():
        setattr(r, k, v)
    await db.commit()
    await db.refresh(r)
    return r


# ---------------------------------------------------------------------------
# RECOMMENDATION ENGINE
# ---------------------------------------------------------------------------

def _calculate_urgency_days(dias_restantes: int) -> float:
    if dias_restantes <= 0: return 5.0
    if dias_restantes <= 1: return 4.0
    if dias_restantes <= 3: return 3.0
    if dias_restantes <= 7: return 2.0
    return 1.0

def _calculate_descuento(max_pct: Decimal, min_pct: Optional[Decimal], urgencia: float,
                         elasticidad: float, hora_actual: int, estrategia: str) -> tuple[Decimal, int]:
    """Calculate optimal discount and urgency score."""
    # Base discount: percentage of max based on urgency
    base = urgencia / 5.0  # 0.2 (low urgency) to 1.0 (critical)

    # Elasticity adjustment: higher elasticity = need higher discount
    base *= (elasticidad / 1.5)  # 1.0 = neutral, >1 = more discount, <1 = less

    # Hour urgency boost
    hour_factor = HOUR_URGENCY.get(hora_actual, 1.0)
    base *= hour_factor

    # Strategy caps
    if estrategia == "agresiva": factor = 1.0
    elif estrategia == "conservadora": factor = 0.6
    else: factor = 0.8  # moderada

    discount_pct = Decimal(str(round(base * float(max_pct) * factor, 1)))
    if discount_pct > max_pct: discount_pct = max_pct
    if min_pct and discount_pct < min_pct: discount_pct = min_pct
    if discount_pct < 0: discount_pct = Decimal("0")

    # Urgency score 1-100
    score = min(100, int(base * 100 * hour_factor))
    return discount_pct, score


async def generate_recommendations(company_id: UUID, db: AsyncSession,
                                    solo_urgentes: bool = False, max_recommendations: Optional[int] = None):
    """Generate markdown recommendations based on dynamic rules.
    Scans products with active rules, calculates optimal discount and urgency."""
    from api.src.products.models import Product, ProductCategory
    from api.src.inventory.models import StockLot

    result = await db.execute(select(DynamicMarkdownRule).where(
        DynamicMarkdownRule.company_id == company_id,
        DynamicMarkdownRule.activa == True,
    ))
    rules = result.scalars().all()

    if not rules:
        return []  # No rules configured — operator should create rules first

    now = datetime.utcnow()
    hora_actual = now.hour
    hoy = now.date()

    recommendations = []
    for rule in rules:
        # Get product info
        prod = None
        if rule.producto_id:
            prod_result = await db.execute(select(Product).where(Product.id == rule.producto_id))
            prod = prod_result.scalar_one_or_none()
        elif rule.categoria:
            prod_result = await db.execute(
                select(Product)
                .join(ProductCategory, ProductCategory.id == Product.categoria_id)
                .where(
                    Product.company_id == company_id,
                    func.lower(ProductCategory.nombre) == rule.categoria.lower(),
                )
            )
            prod = prod_result.scalars().first()
        if not prod or not prod.precio_venta:
            continue

        precio = Decimal(str(prod.precio_venta))
        categoria = (rule.categoria or "almacen").lower()
        elasticidad = CATEGORY_ELASTICITY.get(categoria, 1.2)

        # Get inventory to check days remaining (uso el lote con vencimiento más próximo)
        inv_result = await db.execute(
            select(StockLot)
            .where(
                StockLot.product_id == prod.id,
                StockLot.company_id == company_id,
            )
            .order_by(StockLot.fecha_vencimiento.asc())
        )
        inv = inv_result.scalars().first()

        dias_restantes = 30  # default
        if inv and inv.fecha_vencimiento:
            dias_restantes = (inv.fecha_vencimiento.date() - hoy).days

        urgencia = _calculate_urgency_days(dias_restantes)
        if solo_urgentes and urgencia < 2.0:
            continue

        descuento, score = _calculate_descuento(
            rule.descuento_maximo_pct, rule.descuento_minimo_pct,
            urgencia, elasticidad, hora_actual, rule.estrategia,
        )

        if descuento <= 0:
            continue

        precio_recomendado = (precio * (100 - descuento) / 100).quantize(Decimal("1"), rounding=ROUND_HALF_UP)

        # Determine motivo
        if dias_restantes <= 3: motivo = "proximo_vencer"
        elif urgencia >= 3.0: motivo = "excedente"
        elif hora_actual >= 18: motivo = "fin_dia"
        else: motivo = "baja_demanda"

        rec = MarkdownRecommendation(
            company_id=company_id,
            producto_id=prod.id,
            precio_original=precio,
            descuento_recomendado_pct=descuento,
            precio_recomendado=precio_recomendado,
            motivo=motivo,
            score_urgencia=score,
        )
        db.add(rec)
        recommendations.append(rec)

    await db.commit()
    if max_recommendations:
        return recommendations[:max_recommendations]
    return recommendations


async def list_recommendations(company_id: UUID, db: AsyncSession, aplicada: Optional[bool] = None, solo_urgentes: bool = False):
    q = select(MarkdownRecommendation).where(MarkdownRecommendation.company_id == company_id)
    if aplicada is not None:
        q = q.where(MarkdownRecommendation.aplicada == aplicada)
    if solo_urgentes:
        q = q.where(MarkdownRecommendation.score_urgencia >= 70)
    q = q.order_by(MarkdownRecommendation.score_urgencia.desc()).limit(100)
    result = await db.execute(q)
    return result.scalars().all()


async def apply_recommendations(company_id: UUID, recommendation_ids: list[UUID], db: AsyncSession):
    """Apply selected markdown recommendations (update product price + mark as applied)."""
    from api.src.products.models import Product
    from .models import PriceAuditLog
    applied = []
    pesables_cambiados: list[Product] = []
    for rec_id in recommendation_ids:
        rec_result = await db.execute(select(MarkdownRecommendation).where(MarkdownRecommendation.id == rec_id))
        rec = rec_result.scalar_one_or_none()
        if not rec or rec.aplicada: continue
        # Update product price
        prod_result = await db.execute(select(Product).where(Product.id == rec.producto_id))
        prod = prod_result.scalar_one_or_none()
        if prod:
            old_price = Decimal(str(prod.precio_venta))
            new_price = rec.precio_recomendado
            prod.precio_venta = float(new_price)
            if prod.plu_balanza:
                pesables_cambiados.append(prod)
            # Log the change
            audit = PriceAuditLog(
                company_id=company_id,
                producto_id=rec.producto_id,
                precio_anterior=old_price,
                precio_nuevo=new_price,
                motivo=f"Markdown dinámico: {rec.motivo} (urgencia {rec.score_urgencia}/100)",
                cambiado_por=UUID(int=0),  # system user
                requiere_aprobacion=False,
            )
            db.add(audit)
        rec.aplicada = True
        rec.aplicada_at = datetime.utcnow()
        applied.append(rec)
    await db.commit()

    if pesables_cambiados:
        import logging
        from api.src.integrations.scales import service as scales_service
        logger = logging.getLogger(__name__)
        for prod in pesables_cambiados:
            try:
                await scales_service.auto_sync_product(db, company_id, prod)
            except Exception as e:  # noqa: BLE001 -- una balanza offline no debe bloquear el rescate de vencimiento
                logger.warning("Auto PLU sync (markdown) fallo para producto %s: %s", prod.id, e)

    return applied


# ---------------------------------------------------------------------------
# DASHBOARD
# ---------------------------------------------------------------------------

async def get_markdown_dashboard(company_id: UUID, db: AsyncSession):
    hoy = date.today()
    hoy_inicio = datetime(hoy.year, hoy.month, hoy.day)

    reglas_activas = (await db.execute(
        select(func.count()).select_from(DynamicMarkdownRule).where(
            DynamicMarkdownRule.company_id == company_id,
            DynamicMarkdownRule.activa == True,
        )
    )).scalar()

    recomendaciones_hoy = (await db.execute(
        select(func.count()).select_from(MarkdownRecommendation).where(
            MarkdownRecommendation.company_id == company_id,
            MarkdownRecommendation.created_at >= hoy_inicio,
        )
    )).scalar()

    aplicadas_hoy = (await db.execute(
        select(func.count()).select_from(MarkdownRecommendation).where(
            MarkdownRecommendation.company_id == company_id,
            MarkdownRecommendation.aplicada == True,
            MarkdownRecommendation.aplicada_at >= hoy_inicio,
        )
    )).scalar()

    urgencia_alta = (await db.execute(
        select(func.count()).select_from(MarkdownRecommendation).where(
            MarkdownRecommendation.company_id == company_id,
            MarkdownRecommendation.score_urgencia >= 70,
            MarkdownRecommendation.aplicada == False,
        )
    )).scalar()

    return {
        "reglas_activas": reglas_activas,
        "recomendaciones_hoy": recomendaciones_hoy,
        "aplicadas_hoy": aplicadas_hoy,
        "urgencia_alta": urgencia_alta,
    }
