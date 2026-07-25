import uuid
from datetime import datetime, date, timedelta
from typing import Optional, Any
from sqlalchemy import select, func as sa_func, and_, desc, asc, delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.dialects.postgresql import UUID

from api.src.benchmarking.models import (
    BenchmarkConfig, BenchmarkRegion, BenchmarkRecord, BenchmarkScore
)
from api.src.benchmarking.schemas import (
    BenchmarkConfigCreate, BenchmarkConfigUpdate,
    BenchmarkRegionCreate, BenchmarkRegionUpdate,
    BenchmarkRecordCreate, BenchmarkRecordUpdate,
)

KPI_META = {
    "sales_per_sqm": {"label": "Ventas/m²", "direction": "higher", "unit": "Gs/m²"},
    "gross_margin_pct": {"label": "Margen Bruto %", "direction": "higher", "unit": "%"},
    "shrinkage_pct": {"label": "Shrinkage %", "direction": "lower", "unit": "%"},
    "inventory_turnover": {"label": "Rotación Inventario", "direction": "higher", "unit": "x"},
    "avg_ticket": {"label": "Ticket Promedio", "direction": "higher", "unit": "Gs"},
    "transactions_per_day": {"label": "Transacciones/día", "direction": "higher", "unit": "trans/día"},
    "labor_productivity": {"label": "Productividad Laboral", "direction": "higher", "unit": "Gs/hora"},
}

KPI_FIELDS = list(KPI_META.keys())


async def _get_branch_name(db: AsyncSession, branch_id: str) -> str:
    try:
        r = await db.execute(
            select(BranchModel).where(BranchModel.id == branch_id)
        )
        b = r.scalar_one_or_none()
        if b:
            return getattr(b, "nombre", getattr(b, "name", str(branch_id)[:8]))
    except Exception:
        pass
    return str(branch_id)[:8]


async def _get_branch_names(db: AsyncSession, company_id: str) -> dict:
    try:
        r = await db.execute(
            select(BranchModel.id, BranchModel.nombre).where(BranchModel.company_id == company_id)
        )
        return {str(row[0]): row[1] for row in r.fetchall()}
    except Exception:
        return {}


try:
    from api.src.branches.models import Branch as BranchModel
except ImportError:
    class BranchModel:
        id: Any
        nombre: str
        company_id: str


async def list_configs(db: AsyncSession, company_id: str) -> list[dict]:
    r = await db.execute(
        select(BenchmarkConfig).where(
            BenchmarkConfig.company_id == company_id
        ).order_by(BenchmarkConfig.kpi_key)
    )
    configs = r.scalars().all()
    result = []
    for c in configs:
        d = {col.name: getattr(c, col.name) for col in c.__table__.columns}
        d["id"] = str(d["id"])
        d["company_id"] = str(d["company_id"])
        result.append(d)
    return result


async def upsert_config(db: AsyncSession, company_id: str, data: BenchmarkConfigCreate) -> dict:
    r = await db.execute(
        select(BenchmarkConfig).where(
            BenchmarkConfig.company_id == company_id,
            BenchmarkConfig.kpi_key == data.kpi_key
        )
    )
    existing = r.scalar_one_or_none()
    if existing:
        for k, v in data.model_dump(exclude_unset=True).items():
            setattr(existing, k, v)
    else:
        existing = BenchmarkConfig(company_id=company_id, **data.model_dump())
        db.add(existing)
    await db.commit()
    d = {col.name: getattr(existing, col.name) for col in existing.__table__.columns}
    d["id"] = str(d["id"])
    d["company_id"] = str(d["company_id"])
    return d


async def delete_config(db: AsyncSession, company_id: str, config_id: str) -> bool:
    r = await db.execute(
        select(BenchmarkConfig).where(
            BenchmarkConfig.id == config_id,
            BenchmarkConfig.company_id == company_id
        )
    )
    c = r.scalar_one_or_none()
    if not c:
        return False
    await db.delete(c)
    await db.commit()
    return True


async def list_regions(db: AsyncSession, company_id: str) -> list[dict]:
    r = await db.execute(
        select(BenchmarkRegion).where(
            BenchmarkRegion.company_id == company_id
        ).order_by(BenchmarkRegion.name)
    )
    regions = r.scalars().all()
    result = []
    for reg in regions:
        d = {col.name: getattr(reg, col.name) for col in reg.__table__.columns}
        d["id"] = str(d["id"])
        d["company_id"] = str(d["company_id"])
        result.append(d)
    return result


async def create_region(db: AsyncSession, company_id: str, data: BenchmarkRegionCreate) -> dict:
    region = BenchmarkRegion(company_id=company_id, **data.model_dump())
    db.add(region)
    await db.commit()
    d = {col.name: getattr(region, col.name) for col in region.__table__.columns}
    d["id"] = str(d["id"])
    d["company_id"] = str(d["company_id"])
    return d


async def update_region(db: AsyncSession, company_id: str, region_id: str, data: BenchmarkRegionUpdate) -> Optional[dict]:
    r = await db.execute(
        select(BenchmarkRegion).where(
            BenchmarkRegion.id == region_id,
            BenchmarkRegion.company_id == company_id
        )
    )
    region = r.scalar_one_or_none()
    if not region:
        return None
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(region, k, v)
    await db.commit()
    d = {col.name: getattr(region, col.name) for col in region.__table__.columns}
    d["id"] = str(d["id"])
    d["company_id"] = str(d["company_id"])
    return d


async def delete_region(db: AsyncSession, company_id: str, region_id: str) -> bool:
    r = await db.execute(
        select(BenchmarkRegion).where(
            BenchmarkRegion.id == region_id,
            BenchmarkRegion.company_id == company_id
        )
    )
    reg = r.scalar_one_or_none()
    if not reg:
        return False
    await db.delete(reg)
    await db.commit()
    return True


async def list_records(
    db: AsyncSession, company_id: str, branch_id: Optional[str] = None,
    period_type: Optional[str] = None, limit: int = 100, offset: int = 0
) -> list[dict]:
    q = select(BenchmarkRecord).where(BenchmarkRecord.company_id == company_id)
    if branch_id:
        q = q.where(BenchmarkRecord.branch_id == branch_id)
    if period_type:
        q = q.where(BenchmarkRecord.period_type == period_type)
    q = q.order_by(BenchmarkRecord.period_start.desc()).limit(limit).offset(offset)
    r = await db.execute(q)
    records = r.scalars().all()
    branch_names = await _get_branch_names(db, company_id)
    result = []
    for rec in records:
        d = {col.name: getattr(rec, col.name) for col in rec.__table__.columns}
        d["id"] = str(d["id"])
        d["company_id"] = str(d["company_id"])
        d["branch_id"] = str(d["branch_id"])
        d["branch_name"] = branch_names.get(str(rec.branch_id), str(rec.branch_id)[:8])
        result.append(d)
    return result


async def create_record(db: AsyncSession, company_id: str, data: BenchmarkRecordCreate) -> dict:
    rec = BenchmarkRecord(company_id=company_id, **data.model_dump())
    db.add(rec)
    await db.commit()
    d = {col.name: getattr(rec, col.name) for col in rec.__table__.columns}
    d["id"] = str(d["id"])
    d["company_id"] = str(d["company_id"])
    d["branch_id"] = str(d["branch_id"])
    return d


async def update_record(db: AsyncSession, company_id: str, record_id: str, data: BenchmarkRecordUpdate) -> Optional[dict]:
    r = await db.execute(
        select(BenchmarkRecord).where(
            BenchmarkRecord.id == record_id,
            BenchmarkRecord.company_id == company_id
        )
    )
    rec = r.scalar_one_or_none()
    if not rec:
        return None
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(rec, k, v)
    await db.commit()
    d = {col.name: getattr(rec, col.name) for col in rec.__table__.columns}
    d["id"] = str(d["id"])
    d["company_id"] = str(d["company_id"])
    d["branch_id"] = str(d["branch_id"])
    return d


async def delete_record(db: AsyncSession, company_id: str, record_id: str) -> bool:
    r = await db.execute(
        select(BenchmarkRecord).where(
            BenchmarkRecord.id == record_id,
            BenchmarkRecord.company_id == company_id
        )
    )
    rec = r.scalar_one_or_none()
    if not rec:
        return False
    await db.delete(rec)
    await db.commit()
    return True


async def compute_rankings(
    db: AsyncSession, company_id: str, period_start: Optional[str] = None,
    period_type: str = "weekly"
) -> dict:
    if period_start:
        target_date = datetime.strptime(period_start, "%Y-%m-%d").date()
    else:
        r = await db.execute(
            select(sa_func.max(BenchmarkRecord.period_start)).where(
                BenchmarkRecord.company_id == company_id,
                BenchmarkRecord.period_type == period_type
            )
        )
        max_date = r.scalar()
        if not max_date:
            return {"error": "No records found", "rankings": []}
        target_date = max_date

    r = await db.execute(
        select(BenchmarkRecord).where(
            BenchmarkRecord.company_id == company_id,
            BenchmarkRecord.period_start == target_date,
            BenchmarkRecord.period_type == period_type
        )
    )
    records = r.scalars().all()
    if not records:
        return {"error": f"No records for {target_date}", "rankings": []}

    branch_names = await _get_branch_names(db, company_id)
    configs_map = {}
    cfg_list = await list_configs(db, company_id)
    for cfg in cfg_list:
        configs_map[cfg["kpi_key"]] = cfg

    rankings = []
    for kpi_key in KPI_FIELDS:
        items = []
        for rec in records:
            val = getattr(rec, kpi_key, 0) or 0
            items.append((str(rec.branch_id), val))

        direction = configs_map.get(kpi_key, {}).get("target_direction", KPI_META.get(kpi_key, {}).get("direction", "higher"))
        reverse = direction == "higher"
        items.sort(key=lambda x: x[1], reverse=reverse)

        for rank, (bid, val) in enumerate(items, 1):
            total = len(items)
            pct = round((rank / total) * 100, 1) if total > 0 else 0

            prev_rankings = await _compute_prev_rank(db, company_id, kpi_key, bid, target_date, period_type)
            trend_data = await _get_trend(db, company_id, bid, kpi_key, period_type, 4)

            rankings.append({
                "branch_id": bid,
                "branch_name": branch_names.get(bid, bid[:8]),
                "kpi_key": kpi_key,
                "kpi_label": KPI_META.get(kpi_key, {}).get("label", kpi_key),
                "value": round(val, 2),
                "rank": rank,
                "total": total,
                "percentile": round(pct, 1),
                "trend": _calc_trend(trend_data),
                "direction": direction,
                "unit": KPI_META.get(kpi_key, {}).get("unit", ""),
                "prev_rank": prev_rankings.get("rank") if isinstance(prev_rankings, dict) else None,
            })

    return {
        "period_start": str(target_date),
        "period_type": period_type,
        "total_stores": len(records),
        "rankings": rankings,
    }


async def _compute_prev_rank(
    db: AsyncSession, company_id: str, kpi_key: str, branch_id: str,
    current_date: date, period_type: str
) -> Optional[dict]:
    if period_type == "weekly":
        prev_start = current_date - timedelta(days=7)
    elif period_type == "monthly":
        prev_start = current_date - timedelta(days=30)
    else:
        prev_start = current_date - timedelta(days=7)

    r = await db.execute(
        select(BenchmarkRecord).where(
            BenchmarkRecord.company_id == company_id,
            BenchmarkRecord.period_start == prev_start,
            BenchmarkRecord.period_type == period_type
        )
    )
    records = r.scalars().all()
    if not records:
        return None

    items = []
    for rec in records:
        val = getattr(rec, kpi_key, 0) or 0
        items.append((str(rec.branch_id), val))

    direction = KPI_META.get(kpi_key, {}).get("direction", "higher")
    items.sort(key=lambda x: x[1], reverse=(direction == "higher"))

    for rank, (bid, _) in enumerate(items, 1):
        if bid == branch_id:
            return {"rank": rank, "total": len(items)}
    return None


async def compute_scores(db: AsyncSession, company_id: str, period_start: Optional[str] = None, period_type: str = "weekly") -> dict:
    if period_start:
        target_date = datetime.strptime(period_start, "%Y-%m-%d").date()
    else:
        r = await db.execute(
            select(sa_func.max(BenchmarkRecord.period_start)).where(
                BenchmarkRecord.company_id == company_id,
                BenchmarkRecord.period_type == period_type
            )
        )
        max_date = r.scalar()
        if not max_date:
            return {"error": "No records found", "scores": []}
        target_date = max_date

    r = await db.execute(
        select(BenchmarkRecord).where(
            BenchmarkRecord.company_id == company_id,
            BenchmarkRecord.period_start == target_date,
            BenchmarkRecord.period_type == period_type
        )
    )
    records = r.scalars().all()
    if not records:
        return {"error": f"No records for {target_date}", "scores": []}

    configs_map = {}
    cfg_list = await list_configs(db, company_id)
    for cfg in cfg_list:
        configs_map[cfg["kpi_key"]] = cfg

    branch_names = await _get_branch_names(db, company_id)
    scores = []
    for rec in records:
        bid = str(rec.branch_id)
        kpi_scores = {}
        kpi_details = {}
        total_weight = 0
        weighted_sum = 0

        for kpi_key in KPI_FIELDS:
            val = getattr(rec, kpi_key, 0) or 0
            cfg = configs_map.get(kpi_key, {})
            weight = cfg.get("weight", 1.0)
            target = cfg.get("target_value")
            direction = cfg.get("target_direction", KPI_META.get(kpi_key, {}).get("direction", "higher"))

            if target and target > 0:
                if direction == "higher":
                    kpi_score = min(100, round((val / target) * 100, 1))
                else:
                    kpi_score = max(0, min(100, round((1 - val / target) * 100, 1))) if val > 0 else 100
            else:
                if records and len(records) > 1:
                    all_vals = [getattr(r, kpi_key, 0) or 0 for r in records]
                    mn, mx = min(all_vals), max(all_vals)
                    if mx > mn:
                        if direction == "higher":
                            kpi_score = round(((val - mn) / (mx - mn)) * 100, 1)
                        else:
                            kpi_score = round(((mx - val) / (mx - mn)) * 100, 1)
                    else:
                        kpi_score = 50.0
                else:
                    kpi_score = 50.0

            kpi_scores[kpi_key] = kpi_score
            kpi_details[kpi_key] = {
                "value": round(val, 2),
                "score": kpi_score,
                "weight": weight,
                "target": target,
                "direction": direction,
            }
            total_weight += weight
            weighted_sum += kpi_score * weight

        overall = round(weighted_sum / total_weight, 1) if total_weight > 0 else 50.0
        if overall >= 75:
            traffic_light = "green"
        elif overall >= 45:
            traffic_light = "yellow"
        else:
            traffic_light = "red"

        scores.append({
            "branch_id": bid,
            "branch_name": branch_names.get(bid, bid[:8]),
            "overall_score": overall,
            "traffic_light": traffic_light,
            "kpi_scores": kpi_scores,
            "kpi_details": kpi_details,
        })

    scores.sort(key=lambda x: x["overall_score"], reverse=True)
    total_stores = len(scores)
    for i, s in enumerate(scores):
        s["rank"] = i + 1
        s["total_stores"] = total_stores
        s["percentile"] = round(((i + 1) / total_stores) * 100, 1) if total_stores > 0 else 0

    avg_score = round(sum(s["overall_score"] for s in scores) / len(scores), 1) if scores else 0

    await _persist_scores(db, company_id, scores, target_date, target_date, period_type)

    return {
        "period_start": str(target_date),
        "period_type": period_type,
        "total_stores": total_stores,
        "avg_score": avg_score,
        "green": sum(1 for s in scores if s["traffic_light"] == "green"),
        "yellow": sum(1 for s in scores if s["traffic_light"] == "yellow"),
        "red": sum(1 for s in scores if s["traffic_light"] == "red"),
        "scores": scores,
    }


async def _persist_scores(
    db: AsyncSession, company_id: str, scores: list[dict],
    period_start: date, period_end: date, period_type: str
):
    for s in scores:
        existing_r = await db.execute(
            select(BenchmarkScore).where(
                BenchmarkScore.company_id == company_id,
                BenchmarkScore.branch_id == s["branch_id"],
                BenchmarkScore.period_start == period_start,
                BenchmarkScore.period_type == period_type
            )
        )
        existing = existing_r.scalar_one_or_none()
        if existing:
            existing.overall_score = s["overall_score"]
            existing.traffic_light = s["traffic_light"]
            existing.kpi_scores = s.get("kpi_scores")
            existing.kpi_details = s.get("kpi_details")
            existing.rank = s.get("rank")
            existing.total_stores = s.get("total_stores")
            existing.percentile = s.get("percentile")
        else:
            bs = BenchmarkScore(
                company_id=company_id,
                branch_id=s["branch_id"],
                period_start=period_start,
                period_end=period_end,
                period_type=period_type,
                overall_score=s["overall_score"],
                traffic_light=s["traffic_light"],
                kpi_scores=s.get("kpi_scores"),
                kpi_details=s.get("kpi_details"),
                rank=s.get("rank"),
                total_stores=s.get("total_stores"),
                percentile=s.get("percentile"),
            )
            db.add(bs)
    await db.commit()


async def get_dashboard(db: AsyncSession, company_id: str, period_type: str = "weekly") -> dict:
    r = await db.execute(
        select(sa_func.max(BenchmarkScore.period_start)).where(
            BenchmarkScore.company_id == company_id,
            BenchmarkScore.period_type == period_type
        )
    )
    max_date = r.scalar()

    if not max_date:
        r2 = await db.execute(
            select(sa_func.max(BenchmarkRecord.period_start)).where(
                BenchmarkRecord.company_id == company_id,
                BenchmarkRecord.period_type == period_type
            )
        )
        max_date = r2.scalar()
        if not max_date:
            return {"error": "No data available", "total_stores": 0}

    scores_r = await db.execute(
        select(BenchmarkScore).where(
            BenchmarkScore.company_id == company_id,
            BenchmarkScore.period_start == max_date,
            BenchmarkScore.period_type == period_type
        )
    )
    scores = scores_r.scalars().all()

    branch_names = await _get_branch_names(db, company_id)
    total_stores = len(scores)
    if total_stores == 0:
        return {"error": "No scores for latest period", "total_stores": 0}

    avg = round(sum(s.overall_score for s in scores) / total_stores, 1)
    green = sum(1 for s in scores if s.traffic_light == "green")
    yellow = sum(1 for s in scores if s.traffic_light == "yellow")
    red = sum(1 for s in scores if s.traffic_light == "red")

    sorted_scores = sorted(scores, key=lambda x: x.overall_score, reverse=True)
    top = sorted_scores[0] if sorted_scores else None
    bottom = sorted_scores[-1] if sorted_scores else None

    rankings_data = await compute_rankings(db, company_id, str(max_date), period_type)
    rankings = rankings_data.get("rankings", []) if isinstance(rankings_data, dict) else []

    top_kpi = None
    worst_kpi = None
    if rankings:
        best_val = max(r["value"] for r in rankings)
        worst_val = min(r["value"] for r in rankings)
        top_rankings = [r for r in rankings if r["value"] == best_val]
        worst_rankings = [r for r in rankings if r["value"] == worst_val]
        if top_rankings:
            top_kpi = {"branch": top_rankings[0]["branch_name"], "kpi": top_rankings[0]["kpi_label"], "value": best_val}
        if worst_rankings:
            worst_kpi = {"branch": worst_rankings[0]["branch_name"], "kpi": worst_rankings[0]["kpi_label"], "value": worst_val}

    records_r = await db.execute(
        select(BenchmarkRecord).where(
            BenchmarkRecord.company_id == company_id,
            BenchmarkRecord.period_start == max_date,
            BenchmarkRecord.period_type == period_type
        )
    )
    records_list = records_r.scalars().all()

    period_count_r = await db.execute(
        select(sa_func.count(sa_func.distinct(BenchmarkRecord.period_start))).where(
            BenchmarkRecord.company_id == company_id,
            BenchmarkRecord.period_type == period_type
        )
    )
    periods_analyzed = period_count_r.scalar() or 1

    return {
        "total_stores": total_stores,
        "periods_analyzed": periods_analyzed,
        "avg_overall_score": avg,
        "green_stores": green,
        "yellow_stores": yellow,
        "red_stores": red,
        "top_store": {"branch_id": str(top.branch_id), "branch_name": branch_names.get(str(top.branch_id), str(top.branch_id)[:8]), "score": top.overall_score} if top else None,
        "bottom_store": {"branch_id": str(bottom.branch_id), "branch_name": branch_names.get(str(bottom.branch_id), str(bottom.branch_id)[:8]), "score": bottom.overall_score} if bottom else None,
        "best_kpi": top_kpi,
        "worst_kpi": worst_kpi,
        "rankings": rankings,
        "trend_data": await _get_avg_trend(db, company_id, period_type),
    }


async def _get_avg_trend(db: AsyncSession, company_id: str, period_type: str, limit: int = 8) -> list[dict]:
    r = await db.execute(
        select(BenchmarkScore.period_start, sa_func.avg(BenchmarkScore.overall_score))
        .where(BenchmarkScore.company_id == company_id, BenchmarkScore.period_type == period_type)
        .group_by(BenchmarkScore.period_start)
        .order_by(BenchmarkScore.period_start.desc())
        .limit(limit)
    )
    trend = [{"period_start": str(row[0]), "avg_score": round(row[1], 1)} for row in r.fetchall()]
    trend.reverse()
    return trend


async def _get_trend(
    db: AsyncSession, company_id: str, branch_id: str, kpi_key: str,
    period_type: str, limit: int = 8
) -> list[dict]:
    r = await db.execute(
        select(BenchmarkRecord.period_start, getattr(BenchmarkRecord, kpi_key))
        .where(
            BenchmarkRecord.company_id == company_id,
            BenchmarkRecord.branch_id == branch_id,
            BenchmarkRecord.period_type == period_type
        )
        .order_by(BenchmarkRecord.period_start.desc())
        .limit(limit)
    )
    trend = [{"period_start": str(row[0]), "value": float(row[1] or 0)} for row in r.fetchall()]
    trend.reverse()
    return trend


def _calc_trend(trend_data: list[dict]) -> str:
    if len(trend_data) < 2:
        return "stable"
    first = trend_data[0].get("value", 0)
    last = trend_data[-1].get("value", 0)
    if last > first * 1.05:
        return "up"
    elif last < first * 0.95:
        return "down"
    return "stable"


async def get_regional_comparison(
    db: AsyncSession, company_id: str, period_start: Optional[str] = None,
    period_type: str = "weekly"
) -> list[dict]:
    if period_start:
        target_date = datetime.strptime(period_start, "%Y-%m-%d").date()
    else:
        r = await db.execute(
            select(sa_func.max(BenchmarkScore.period_start)).where(
                BenchmarkScore.company_id == company_id,
                BenchmarkScore.period_type == period_type
            )
        )
        md = r.scalar()
        if not md:
            r2 = await db.execute(
                select(sa_func.max(BenchmarkRecord.period_start)).where(
                    BenchmarkRecord.company_id == company_id,
                    BenchmarkRecord.period_type == period_type
                )
            )
            md = r2.scalar()
        target_date = md if md else date.today()

    regions_r = await db.execute(
        select(BenchmarkRegion).where(
            BenchmarkRegion.company_id == company_id,
            BenchmarkRegion.is_active == True
        )
    )
    regions = regions_r.scalars().all()

    scores_r = await db.execute(
        select(BenchmarkScore).where(
            BenchmarkScore.company_id == company_id,
            BenchmarkScore.period_start == target_date,
            BenchmarkScore.period_type == period_type
        )
    )
    scores_map = {str(s.branch_id): s for s in scores_r.scalars().all()}

    records_r = await db.execute(
        select(BenchmarkRecord).where(
            BenchmarkRecord.company_id == company_id,
            BenchmarkRecord.period_start == target_date,
            BenchmarkRecord.period_type == period_type
        )
    )
    records_map = {str(r.branch_id): r for r in records_r.scalars().all()}

    branch_names = await _get_branch_names(db, company_id)
    all_bids = set(list(scores_map.keys()) + list(records_map.keys()))

    unassigned = {
        "region_id": "unassigned",
        "region_name": "Sin Región",
        "store_count": 0,
        "avg_score": 0,
        "avg_sales_per_sqm": 0,
        "avg_margin": 0,
        "avg_shrinkage": 0,
        "avg_ticket": 0,
        "best_store": None,
        "worst_store": None,
    }

    unassigned_bids = set(all_bids)
    result = []

    for region in regions:
        r_bids = set(str(b) for b in (region.branch_ids or []))
        r_bids &= all_bids
        unassigned_bids -= r_bids

        if not r_bids:
            continue

        region_scores = []
        region_records = []
        for bid in r_bids:
            if bid in scores_map:
                region_scores.append(scores_map[bid])
            if bid in records_map:
                region_records.append(records_map[bid])

        if not region_scores and not region_records:
            continue

        avg_score = round(sum(s.overall_score for s in region_scores) / len(region_scores), 1) if region_scores else 0
        avg_sqm = round(sum(r.sales_per_sqm for r in region_records) / len(region_records), 1) if region_records else 0
        avg_margin = round(sum(r.gross_margin_pct for r in region_records) / len(region_records), 1) if region_records else 0
        avg_shrink = round(sum(r.shrinkage_pct for r in region_records) / len(region_records), 1) if region_records else 0
        avg_tick = round(sum(r.avg_ticket for r in region_records) / len(region_records), 1) if region_records else 0

        sorted_s = sorted(region_scores, key=lambda x: x.overall_score, reverse=True)
        best = branch_names.get(str(sorted_s[0].branch_id), str(sorted_s[0].branch_id)[:8]) if sorted_s else None
        worst = branch_names.get(str(sorted_s[-1].branch_id), str(sorted_s[-1].branch_id)[:8]) if sorted_s else None

        result.append({
            "region_id": str(region.id),
            "region_name": region.name,
            "store_count": len(r_bids),
            "avg_score": avg_score,
            "avg_sales_per_sqm": avg_sqm,
            "avg_margin": avg_margin,
            "avg_shrinkage": avg_shrink,
            "avg_ticket": avg_tick,
            "best_store": best,
            "worst_store": worst,
        })

    for bid in unassigned_bids:
        unassigned["store_count"] += 1
        s = scores_map.get(bid)
        r = records_map.get(bid)
        if s:
            unassigned["avg_score"] += s.overall_score
        if r:
            unassigned["avg_sales_per_sqm"] += r.sales_per_sqm
            unassigned["avg_margin"] += r.gross_margin_pct
            unassigned["avg_shrinkage"] += r.shrinkage_pct
            unassigned["avg_ticket"] += r.avg_ticket

    if unassigned["store_count"] > 0:
        c = unassigned["store_count"]
        unassigned["avg_score"] = round(unassigned["avg_score"] / c, 1)
        unassigned["avg_sales_per_sqm"] = round(unassigned["avg_sales_per_sqm"] / c, 1)
        unassigned["avg_margin"] = round(unassigned["avg_margin"] / c, 1)
        unassigned["avg_shrinkage"] = round(unassigned["avg_shrinkage"] / c, 1)
        unassigned["avg_ticket"] = round(unassigned["avg_ticket"] / c, 1)
        result.append(unassigned)

    return result


async def get_scores_history(db: AsyncSession, company_id: str, branch_id: str, period_type: str = "weekly", limit: int = 12) -> list[dict]:
    r = await db.execute(
        select(BenchmarkScore)
        .where(
            BenchmarkScore.company_id == company_id,
            BenchmarkScore.branch_id == branch_id,
            BenchmarkScore.period_type == period_type
        )
        .order_by(BenchmarkScore.period_start.desc())
        .limit(limit)
    )
    scores = r.scalars().all()
    result = []
    for s in scores:
        result.append({
            "id": str(s.id),
            "branch_id": str(s.branch_id),
            "period_start": str(s.period_start),
            "period_end": str(s.period_end),
            "overall_score": s.overall_score,
            "traffic_light": s.traffic_light,
            "kpi_scores": s.kpi_scores,
            "rank": s.rank,
            "total_stores": s.total_stores,
            "percentile": s.percentile,
        })
    result.reverse()
    return result
