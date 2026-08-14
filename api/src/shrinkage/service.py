from sqlalchemy import select, func as sa_func, and_, desc, asc, delete
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime, date, timedelta, timezone
from typing import Optional
import uuid

from api.src.shrinkage.models import ShrinkageRecord, ShrinkageAlert, ShrinkageRecommendation
from api.src.shrinkage.schemas import (
    ShrinkageRecordResponse, ShrinkageAlertResponse, ShrinkageRecommendationResponse,
    ComputeShrinkageRequest, ResolveAlertRequest, ApplyRecommendationRequest,
    ShrinkageDashboardResponse, CategoryShrinkageSummary, ShrinkageDecomposition,
)

# Medir shrinkage real requiere comparar stock de libro contra un conteo
# físico real (inventario físico por categoría). Hoy no existe esa fuente:
# las tablas de conteo físico (supermer_count_sessions, adv_cycle_counts)
# están vacías, y los inventory_adjustments migrados del legacy tienen motivo
# en texto libre (mezcla devoluciones/fraccionamiento/correcciones con
# posible merma real, sin forma de distinguir) y costo_unitario NULL en el
# 100% de las líneas — no alcanza para calcular un valor confiable.
# Por eso este módulo NO fabrica ni aproxima un número: hasta que exista un
# primer conteo físico real, se muestra explícitamente que no hay datos.
NO_DATA_MESSAGE = (
    "Sin datos reales de shrinkage todavía. Se necesita un primer conteo físico "
    "real por categoría (stock de libro vs. stock contado) para poder calcularlo — "
    "los ajustes de inventario migrados no tienen costo unitario ni una causa "
    "clasificable, así que no alcanzan para un cálculo confiable."
)


# ── Compute Shrinkage ────────────────────────────────────────────
# Sin fuente de datos reales, no hay nada que calcular ni persistir.

async def compute_shrinkage(
    db: AsyncSession, company_id: str, fecha: str, categories: Optional[list[str]] = None,
) -> list[dict]:
    return []


# ── CRUD ─────────────────────────────────────────────────────────

async def list_records(
    db: AsyncSession, company_id: str, fecha_desde: str, fecha_hasta: str,
    category: Optional[str] = None,
) -> list[dict]:
    q = select(ShrinkageRecord).where(
        ShrinkageRecord.company_id == uuid.UUID(company_id),
        ShrinkageRecord.fecha.between(
            datetime.strptime(fecha_desde, "%Y-%m-%d").date(),
            datetime.strptime(fecha_hasta, "%Y-%m-%d").date(),
        ),
    )
    if category:
        q = q.where(ShrinkageRecord.category == category)
    q = q.order_by(desc(ShrinkageRecord.fecha))
    r = await db.execute(q)
    return [ShrinkageRecordResponse.model_validate(row).model_dump() for row in r.scalars().all()]


async def list_alerts(
    db: AsyncSession, company_id: str, category: Optional[str] = None,
    is_resolved: Optional[bool] = None, min_severity: Optional[str] = None,
) -> list[dict]:
    severities = {"low": 0, "medium": 1, "high": 2, "critical": 3}
    q = select(ShrinkageAlert).where(ShrinkageAlert.company_id == uuid.UUID(company_id))
    if category:
        q = q.where(ShrinkageAlert.category == category)
    if is_resolved is not None:
        q = q.where(ShrinkageAlert.is_resolved == is_resolved)
    if min_severity:
        min_level = severities.get(min_severity, 0)
        q = q.where(ShrinkageAlert.severity.in_([k for k, v in severities.items() if v >= min_level]))
    q = q.order_by(desc(ShrinkageAlert.created_at))
    r = await db.execute(q)
    return [ShrinkageAlertResponse.model_validate(row).model_dump() for row in r.scalars().all()]


async def resolve_alert(db: AsyncSession, company_id: str, alert_id: str, data: ResolveAlertRequest) -> Optional[dict]:
    r = await db.execute(
        select(ShrinkageAlert).where(
            ShrinkageAlert.id == uuid.UUID(alert_id),
            ShrinkageAlert.company_id == uuid.UUID(company_id),
        )
    )
    alert = r.scalar_one_or_none()
    if not alert:
        return None
    alert.is_resolved = True
    alert.resolved_by = uuid.UUID(data.resolved_by)
    alert.resolved_at = datetime.now(timezone.utc)
    await db.flush()
    return ShrinkageAlertResponse.model_validate(alert).model_dump()


async def list_recommendations(
    db: AsyncSession, company_id: str, category: Optional[str] = None,
    is_applied: Optional[bool] = None,
) -> list[dict]:
    q = select(ShrinkageRecommendation).where(ShrinkageRecommendation.company_id == uuid.UUID(company_id))
    if category:
        q = q.where(ShrinkageRecommendation.category == category)
    if is_applied is not None:
        q = q.where(ShrinkageRecommendation.is_applied == is_applied)
    q = q.order_by(desc(ShrinkageRecommendation.priority), desc(ShrinkageRecommendation.created_at))
    r = await db.execute(q)
    return [ShrinkageRecommendationResponse.model_validate(row).model_dump() for row in r.scalars().all()]


async def apply_recommendation(db: AsyncSession, company_id: str, rec_id: str) -> Optional[dict]:
    r = await db.execute(
        select(ShrinkageRecommendation).where(
            ShrinkageRecommendation.id == uuid.UUID(rec_id),
            ShrinkageRecommendation.company_id == uuid.UUID(company_id),
        )
    )
    rec = r.scalar_one_or_none()
    if not rec:
        return None
    rec.is_applied = True
    rec.applied_at = datetime.now(timezone.utc)
    await db.flush()
    return ShrinkageRecommendationResponse.model_validate(rec).model_dump()


# ── Dashboard ────────────────────────────────────────────────────

async def get_dashboard(db: AsyncSession, company_id: str, fecha: str) -> dict:
    # todo lo de abajo queda en 0 salvo que en algún momento se carguen
    # registros reales (vía un futuro conteo físico) — no se fabrica nada.
    alerts = await list_alerts(db, company_id, is_resolved=False)
    recommendations = await list_recommendations(db, company_id, is_applied=False)

    trends = [
        {"date": (datetime.strptime(fecha, "%Y-%m-%d").date() - timedelta(days=6 - i)).isoformat(), "shrinkage_pct": 0, "shrinkage_amount": 0}
        for i in range(7)
    ]

    return ShrinkageDashboardResponse(
        date=fecha,
        total_theoretical_sales=0,
        total_actual_sales=0,
        total_shrinkage=0,
        overall_shrinkage_pct=0,
        benchmark_pct=0,
        variance_vs_benchmark=0,
        decomposition=ShrinkageDecomposition(
            external_theft=0, internal_theft=0, pricing_error=0, unrecorded_waste=0, breakage=0,
        ).model_dump(),
        by_category=[],
        active_alerts=alerts,
        pending_recommendations=recommendations,
        trends_7d=trends,
        anomaly_categories=[],
        data_status="sin_datos_reales",
        message=NO_DATA_MESSAGE,
    ).model_dump()
