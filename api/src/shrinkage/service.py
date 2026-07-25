from sqlalchemy import select, func as sa_func, and_, desc, asc, delete
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime, date, timedelta, timezone
from typing import Optional
import uuid, random, math, statistics

from api.src.shrinkage.models import ShrinkageRecord, ShrinkageAlert, ShrinkageRecommendation
from api.src.shrinkage.schemas import (
    ShrinkageRecordResponse, ShrinkageAlertResponse, ShrinkageRecommendationResponse,
    ComputeShrinkageRequest, ResolveAlertRequest, ApplyRecommendationRequest,
    ShrinkageDashboardResponse, CategoryShrinkageSummary, ShrinkageDecomposition,
)

CATEGORIES = [
    "carniceria", "panaderia", "verduleria", "almacen", "limpieza", "bebidas",
    "lacteos", "congelados", "perfumeria", "bazar",
]

CATEGORY_BENCHMARK = {
    "carniceria": 0.035, "panaderia": 0.040, "verduleria": 0.060, "almacen": 0.020,
    "limpieza": 0.025, "bebidas": 0.015, "lacteos": 0.020, "congelados": 0.030,
    "perfumeria": 0.035, "bazar": 0.025,
}

CATEGORY_LABELS = {
    "carniceria": "Carnicería", "panaderia": "Panadería", "verduleria": "Verdulería",
    "almacen": "Almacén", "limpieza": "Limpieza", "bebidas": "Bebidas",
    "lacteos": "Lácteos", "congelados": "Congelados", "perfumeria": "Perfumería", "bazar": "Bazar",
}

HIGH_VALUE_CATEGORIES = {"carniceria", "bebidas", "perfumeria"}
FRAGILE_CATEGORIES = {"bebidas", "bazar"}

# synthetic generation parameters
SYNTHETIC_CONFIG = {
    "carniceria": {"avg_sales": 4500000, "base_shrinkage": 0.035, "volatility": 0.4},
    "panaderia": {"avg_sales": 2800000, "base_shrinkage": 0.040, "volatility": 0.5},
    "verduleria": {"avg_sales": 3200000, "base_shrinkage": 0.060, "volatility": 0.6},
    "almacen": {"avg_sales": 8000000, "base_shrinkage": 0.020, "volatility": 0.3},
    "limpieza": {"avg_sales": 1500000, "base_shrinkage": 0.025, "volatility": 0.35},
    "bebidas": {"avg_sales": 5500000, "base_shrinkage": 0.015, "volatility": 0.3},
    "lacteos": {"avg_sales": 3500000, "base_shrinkage": 0.020, "volatility": 0.3},
    "congelados": {"avg_sales": 2000000, "base_shrinkage": 0.030, "volatility": 0.4},
    "perfumeria": {"avg_sales": 1800000, "base_shrinkage": 0.035, "volatility": 0.45},
    "bazar": {"avg_sales": 1200000, "base_shrinkage": 0.025, "volatility": 0.35},
}


def _generate_demo_shrinkage(fecha: date, category: str) -> dict:
    cfg = SYNTHETIC_CONFIG[category]
    day_factor = {0: 1.0, 1: 0.85, 2: 0.90, 3: 0.90, 4: 0.95, 5: 1.20, 6: 1.30}.get(fecha.weekday(), 1.0)
    noise = random.uniform(0.85, 1.15)

    actual_sales = round(cfg["avg_sales"] * day_factor * noise, -2)

    # theoretical sales = actual / (1 - shrinkage)
    base_shrink = cfg["base_shrinkage"]
    shrink_noise = random.uniform(0.6, 1.8)
    actual_shrink_pct = base_shrink * shrink_noise

    # occasionally inject anomaly (1 in 15 chance)
    if random.random() < 0.067:
        actual_shrink_pct *= random.uniform(1.5, 2.5)

    theoretical_sales = round(actual_sales / (1 - actual_shrink_pct), 0)
    total_shrinkage = theoretical_sales - actual_sales
    shrinkage_pct = round((total_shrinkage / theoretical_sales) * 100, 2)

    # decomposition heuristics
    is_high_value = category in HIGH_VALUE_CATEGORIES
    is_fragile = category in FRAGILE_CATEGORIES
    is_weekend = fecha.weekday() >= 5

    external_theft_pct = random.uniform(0.20, 0.40)
    if is_high_value:
        external_theft_pct += 0.10
    if is_weekend:
        external_theft_pct += 0.05

    internal_theft_pct = random.uniform(0.10, 0.25)
    if is_high_value:
        internal_theft_pct += 0.05
    if not is_weekend and fecha.hour < 7:  # night shift
        internal_theft_pct += 0.08

    pricing_error_pct = random.uniform(0.08, 0.18)
    breakage_pct = random.uniform(0.02, 0.08) if is_fragile else random.uniform(0.01, 0.04)
    waste_pct = 1.0 - external_theft_pct - internal_theft_pct - pricing_error_pct - breakage_pct

    total = external_theft_pct + internal_theft_pct + pricing_error_pct + breakage_pct + waste_pct
    external_theft_pct /= total
    internal_theft_pct /= total
    pricing_error_pct /= total
    breakage_pct /= total
    waste_pct /= total

    external_theft_est = round(total_shrinkage * external_theft_pct, 0)
    internal_theft_est = round(total_shrinkage * internal_theft_pct, 0)
    pricing_error_est = round(total_shrinkage * pricing_error_pct, 0)
    breakage_est = round(total_shrinkage * breakage_pct, 0)
    unrecorded_waste_est = round(total_shrinkage * waste_pct, 0)

    high_value_shrinkage = round(external_theft_est * 0.6 if is_high_value else external_theft_est * 0.2, 0)
    night_shift_shrinkage = round(internal_theft_est * 0.3 if not is_weekend else internal_theft_est * 0.1, 0)
    price_discrepancy_count = max(0, int(pricing_error_est / random.randint(5000, 15000)))

    # anomaly score — z-score relative to base
    deviation = (actual_shrink_pct - base_shrink) / (base_shrink * 0.3) if base_shrink else 0
    anomaly_score = round(deviation, 2)
    is_anomaly = anomaly_score > 3.0

    return {
        "theoretical_sales": theoretical_sales,
        "actual_sales": actual_sales,
        "total_shrinkage": total_shrinkage,
        "shrinkage_pct": shrinkage_pct,
        "external_theft_est": external_theft_est,
        "internal_theft_est": internal_theft_est,
        "pricing_error_est": pricing_error_est,
        "unrecorded_waste_est": unrecorded_waste_est,
        "breakage_est": breakage_est,
        "high_value_shrinkage": high_value_shrinkage,
        "night_shift_shrinkage": night_shift_shrinkage,
        "price_discrepancy_count": price_discrepancy_count,
        "anomaly_score": anomaly_score,
        "is_anomaly": is_anomaly,
    }


# ── Compute Shrinkage ────────────────────────────────────────────

async def compute_shrinkage(
    db: AsyncSession, company_id: str, fecha: str, categories: Optional[list[str]] = None,
) -> list[dict]:
    target_date = datetime.strptime(fecha, "%Y-%m-%d").date()
    cats = categories or list(CATEGORIES)

    results = []
    for cat in cats:
        r = await db.execute(
            select(ShrinkageRecord).where(
                ShrinkageRecord.company_id == uuid.UUID(company_id),
                ShrinkageRecord.category == cat,
                ShrinkageRecord.fecha == target_date,
            )
        )
        existing = r.scalar_one_or_none()
        if existing:
            results.append(ShrinkageRecordResponse.model_validate(existing).model_dump())
            continue

        demo = _generate_demo_shrinkage(target_date, cat)
        rec = ShrinkageRecord(
            company_id=uuid.UUID(company_id),
            category=cat,
            fecha=target_date,
            **demo,
        )
        db.add(rec)
        await db.flush()

        # generate alerts for anomalies
        if rec.is_anomaly:
            await _generate_alerts(db, company_id, cat, rec)

        results.append(ShrinkageRecordResponse.model_validate(rec).model_dump())

    # generate recommendations based on accumulated data
    await _generate_recommendations(db, company_id, target_date)

    return results


async def _generate_alerts(db: AsyncSession, company_id: str, category: str, rec: ShrinkageRecord):
    cfg = SYNTHETIC_CONFIG[category]
    base = cfg["base_shrinkage"]

    if rec.shrinkage_pct > base * 2.5:
        alert = ShrinkageAlert(
            company_id=uuid.UUID(company_id),
            category=category,
            severity="high",
            description=f"Shrinkage crítico en {CATEGORY_LABELS.get(category, category)}: {rec.shrinkage_pct:.1f}% vs benchmark {base*100:.1f}%",
            recommendation=f"Auditar proceso completo en {CATEGORY_LABELS.get(category, category)}. Revisar inventario, mermas registradas y vigilancia.",
            metric_name="shrinkage_pct",
            metric_value=rec.shrinkage_pct,
            threshold=base * 100 * 2.5,
            detected_pattern="category_pattern",
        )
        db.add(alert)

    if rec.external_theft_est > rec.total_shrinkage * 0.45:
        alert = ShrinkageAlert(
            company_id=uuid.UUID(company_id),
            category=category,
            severity="medium",
            description=f"Alta estimación de robo externo en {CATEGORY_LABELS.get(category, category)}: {(rec.external_theft_est / rec.total_shrinkage * 100):.0f}% del shrinkage total",
            recommendation=f"Reforzar vigilancia en categoría {CATEGORY_LABELS.get(category, category)}. Revisar cámaras en horario pico.",
            metric_name="external_theft_pct",
            metric_value=round(rec.external_theft_est / rec.total_shrinkage * 100, 1),
            threshold=45,
            detected_pattern="category_pattern",
        )
        db.add(alert)

    if rec.internal_theft_est > rec.total_shrinkage * 0.30:
        alert = ShrinkageAlert(
            company_id=uuid.UUID(company_id),
            category=category,
            severity="high",
            description=f"Posible robo interno detectado en {CATEGORY_LABELS.get(category, category)}: noche/backroom",
            recommendation=f"Auditar empleados de turno nocturno y acceso a backroom en {CATEGORY_LABELS.get(category, category)}.",
            metric_name="internal_theft_est",
            metric_value=rec.internal_theft_est,
            threshold=rec.total_shrinkage * 0.3,
            detected_pattern="time_pattern",
        )
        db.add(alert)

    await db.flush()


async def _generate_recommendations(db: AsyncSession, company_id: str, target_date: date, force: bool = False):
    # get recent 7 days of data
    week_ago = target_date - timedelta(days=7)
    r = await db.execute(
        select(ShrinkageRecord).where(
            ShrinkageRecord.company_id == uuid.UUID(company_id),
            ShrinkageRecord.fecha.between(week_ago, target_date),
        )
    )
    records_list = r.scalars().all()
    if not records_list:
        return

    # check for existing pending recommendations
    r2 = await db.execute(
        select(ShrinkageRecommendation).where(
            ShrinkageRecommendation.company_id == uuid.UUID(company_id),
            ShrinkageRecommendation.is_applied == False,
        ).limit(1)
    )
    if r2.scalar() and not force:
        return

    # category with highest avg shrinkage
    from collections import defaultdict
    cat_shrink = defaultdict(list)
    for rec in records_list:
        cat_shrink[rec.category].append(rec.shrinkage_pct)

    for cat, values in cat_shrink.items():
        avg_shrink = statistics.mean(values)
        cfg = SYNTHETIC_CONFIG.get(cat, {})
        base = cfg.get("base_shrinkage", 0.02) * 100

        if avg_shrink > base * 1.5:
            rec = ShrinkageRecommendation(
                company_id=uuid.UUID(company_id),
                category=cat,
                recommendation_type="surveillance" if cat in HIGH_VALUE_CATEGORIES else "audit",
                title=f"Reforzar control en {CATEGORY_LABELS.get(cat, cat)}",
                description=f"Shrinkage promedio de {avg_shrink:.1f}% vs benchmark {base:.1f}%. Se recomienda {'reforzar vigilancia' if cat in HIGH_VALUE_CATEGORIES else 'auditar proceso'}.",
                priority="high" if avg_shrink > base * 2 else "medium",
                potential_savings=round(avg_shrink / 100 * sum(r.actual_sales for r in records_list if r.category == cat) * 0.3, 0),
            )
            db.add(rec)

    await db.flush()


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
    target_date = datetime.strptime(fecha, "%Y-%m-%d").date()

    # ensure today computed
    await compute_shrinkage(db, company_id, fecha)

    today_records = await list_records(db, company_id, fecha, fecha)

    total_theoretical = sum(r["theoretical_sales"] for r in today_records)
    total_actual = sum(r["actual_sales"] for r in today_records)
    total_shrinkage = sum(r["total_shrinkage"] for r in today_records)
    overall_pct = round((total_shrinkage / total_theoretical) * 100, 2) if total_theoretical else 0

    # decomposition
    total_external = sum(r["external_theft_est"] for r in today_records)
    total_internal = sum(r["internal_theft_est"] for r in today_records)
    total_pricing = sum(r["pricing_error_est"] for r in today_records)
    total_waste = sum(r["unrecorded_waste_est"] for r in today_records)
    total_breakage = sum(r["breakage_est"] for r in today_records)
    decomp_total = total_external + total_internal + total_pricing + total_waste + total_breakage or 1

    decomposition = ShrinkageDecomposition(
        external_theft=round(total_external / decomp_total * 100, 1),
        internal_theft=round(total_internal / decomp_total * 100, 1),
        pricing_error=round(total_pricing / decomp_total * 100, 1),
        unrecorded_waste=round(total_waste / decomp_total * 100, 1),
        breakage=round(total_breakage / decomp_total * 100, 1),
    ).model_dump()

    # by category
    cat_summaries = []
    for r in today_records:
        cat = r["category"]
        cfg = SYNTHETIC_CONFIG.get(cat, {})
        base = cfg.get("base_shrinkage", 0.02) * 100
        if r["shrinkage_pct"] > base * 1.8:
            cause = "robo_externo" if r["external_theft_est"] > r["total_shrinkage"] * 0.35 else "merma_operativa"
        elif r["shrinkage_pct"] > base * 1.3:
            cause = "error_precio" if r["pricing_error_est"] > r["total_shrinkage"] * 0.2 else "merma_operativa"
        else:
            cause = "dentro_benchmark"

        cat_summaries.append(CategoryShrinkageSummary(
            category=cat,
            total_shrinkage=r["total_shrinkage"],
            shrinkage_pct=r["shrinkage_pct"],
            theoretical_sales=r["theoretical_sales"],
            actual_sales=r["actual_sales"],
            primary_cause=cause,
            anomaly_count=1 if r["is_anomaly"] else 0,
            trend_direction="up",
        ).model_dump())

    # alerts
    alerts = await list_alerts(db, company_id, is_resolved=False)
    recommendations = await list_recommendations(db, company_id, is_applied=False)

    # 7-day trends
    trends = []
    for i in range(7):
        d = target_date - timedelta(days=6 - i)
        day_records = await list_records(db, company_id, d.isoformat(), d.isoformat())
        if not day_records:
            await compute_shrinkage(db, company_id, d.isoformat())
            day_records = await list_records(db, company_id, d.isoformat(), d.isoformat())
        day_theoretical = sum(r["theoretical_sales"] for r in day_records)
        day_actual = sum(r["actual_sales"] for r in day_records)
        day_shrink = day_theoretical - day_actual
        day_pct = round((day_shrink / day_theoretical) * 100, 2) if day_theoretical else 0
        trends.append({"date": d.isoformat(), "shrinkage_pct": day_pct, "shrinkage_amount": day_shrink})

    # anomaly categories
    anomaly_cats = [r["category"] for r in today_records if r["is_anomaly"]]

    # benchmark (weighted avg)
    total_sales_for_bench = 0
    total_bench = 0
    for r in today_records:
        cat = r["category"]
        bench = CATEGORY_BENCHMARK.get(cat, 0.025)
        total_sales_for_bench += r["theoretical_sales"]
        total_bench += r["theoretical_sales"] * bench
    benchmark_pct = round((total_bench / total_sales_for_bench) * 100, 2) if total_sales_for_bench else 2.5

    return ShrinkageDashboardResponse(
        date=fecha,
        total_theoretical_sales=total_theoretical,
        total_actual_sales=total_actual,
        total_shrinkage=total_shrinkage,
        overall_shrinkage_pct=overall_pct,
        benchmark_pct=benchmark_pct,
        variance_vs_benchmark=round(overall_pct - benchmark_pct, 2),
        decomposition=decomposition,
        by_category=cat_summaries,
        active_alerts=alerts,
        pending_recommendations=recommendations,
        trends_7d=trends,
        anomaly_categories=anomaly_cats,
    ).model_dump()
