from sqlalchemy import select, delete, func as sa_func, and_, desc
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime, timezone, date, timedelta, time
from typing import Optional
import uuid, math, random, statistics
from collections import defaultdict

from api.src.intelligent_routing.models import (
    RouteOptimization, VehicleLoadConfig, LoadOptimizationResult,
    DynamicRerouteRequest, EtaPrediction, RouteEfficiencyMetric,
)
from api.src.intelligent_routing.schemas import (
    TSPOptimizeRequest, TSPOptimizeResponse, RouteStop,
    VehicleLoadOptimizeRequest, VehicleLoadOptimizeResponse,
    DynamicRerouteRequest as DynReqSchema, DynamicRerouteResponse,
    EtaPredictRequest, EtaPredictResponse, RouteEfficiencyDashboard,
)


# ===== HAVERSINE =====

def _haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = math.sin(dlat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlng / 2) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c


def _estimate_duration_min(distance_km: float, zone_factor: float = 1.0, time_factor: float = 1.0) -> tuple:
    """Estimate driving time. Base avg speed 30 km/h in city."""
    base_speed = 30.0
    base_duration = (distance_km / base_speed) * 60
    traffic_factor = 1.0 + random.uniform(-0.1, 0.2)  # simulate traffic variability
    predicted = base_duration * traffic_factor * zone_factor * time_factor
    confidence = max(30, min(95, 100 - (distance_km * 0.5) - abs(zone_factor - 1) * 20))
    return round(base_duration, 2), round(traffic_factor, 2), round(predicted, 2), round(confidence, 1)


# ===== TSP SOLVER =====

async def optimize_route(db: AsyncSession, company_id: str, req: TSPOptimizeRequest) -> dict:
    """Solve TSP with nearest-neighbor + 2-opt improvement, respecting constraints."""
    stops = req.stops
    if len(stops) < 2:
        return {"error": "Need at least 2 stops", "ordered_stops": []}

    n = len(stops)
    # Distance matrix
    dist_matrix = [[0.0] * n for _ in range(n)]
    dur_matrix = [[0.0] * n for _ in range(n)]
    for i in range(n):
        for j in range(n):
            if i != j:
                d = _haversine_km(stops[i].lat, stops[i].lng, stops[j].lat, stops[j].lng)
                dist_matrix[i][j] = d
                dur_matrix[i][j] = (d / 30) * 60 + stops[j].service_time_min

    # Nearest-neighbor with time window + capacity constraints
    constraints_applied = []
    start_idx = 0
    if req.start_lat is not None and req.start_lng is not None:
        # Find closest stop to start
        min_d = float("inf")
        for i, s in enumerate(stops):
            d = _haversine_km(req.start_lat, req.start_lng, s.lat, s.lng)
            if d < min_d:
                min_d = d
                start_idx = i

    current_time = 8 * 60  # start at 08:00 in minutes

    def time_to_min(t_str: Optional[str]) -> Optional[int]:
        if not t_str:
            return None
        parts = t_str.split(":")
        return int(parts[0]) * 60 + int(parts[1])

    order = [start_idx]
    remaining = list(range(n))
    remaining.remove(start_idx)
    current_volume = 0.0
    current_weight = 0.0

    if req.constraints:
        if "time_windows" in req.constraints:
            constraints_applied.append("time_windows")
        if "capacity" in req.constraints:
            constraints_applied.append("capacity")
            if "max_volume_m3" in req.constraints:
                max_vol = req.constraints["max_volume_m3"]
            else:
                max_vol = float("inf")
            if "max_weight_kg" in req.constraints:
                max_w = req.constraints["max_weight_kg"]
            else:
                max_w = float("inf")

    while remaining:
        last = order[-1]
        best = None
        best_dist = float("inf")

        for r in remaining:
            # Distance
            d = dist_matrix[last][r]

            # Time window check
            if "time_windows" in constraints_applied:
                tw_start = time_to_min(stops[r].time_window_start)
                tw_end = time_to_min(stops[r].time_window_end)
                arrival = current_time + dur_matrix[last][r] - stops[r].service_time_min
                if tw_start and arrival < tw_start:
                    wait = tw_start - arrival
                    arrival = tw_start
                if tw_end and arrival > tw_end:
                    d += 10000  # penalty

            # Capacity check
            if "capacity" in constraints_applied:
                new_vol = current_volume + stops[r].volume_m3
                new_w = current_weight + stops[r].weight_kg
                if new_vol > max_vol or new_w > max_w:
                    d += 10000

            if d < best_dist:
                best_dist = d
                best = r

        if best is not None:
            # Update current time
            current_time += dur_matrix[last][best]
            current_volume += stops[best].volume_m3
            current_weight += stops[best].weight_kg
            order.append(best)
            remaining.remove(best)

    # 2-opt improvement
    if req.algorithm == "nearest_neighbor_2opt" and len(order) > 3:
        order = _two_opt(order, dist_matrix)

    # Compute total distances
    original_dist = sum(
        dist_matrix[order[i]][order[(i + 1) % len(order)]]
        for i in range(len(order))
    )
    # Baseline: simple sequential without optimization (just for comparison)
    sequential_dist = sum(dist_matrix[i][(i + 1) % n] for i in range(n))
    saving = ((sequential_dist - original_dist) / sequential_dist * 100) if sequential_dist > 0 else 0

    ordered_stops = []
    segments = []
    for i in range(len(order)):
        idx = order[i]
        s = stops[idx]
        ordered_stops.append({
            "id": s.id, "lat": s.lat, "lng": s.lng, "priority": s.priority,
            "address": s.address, "zone": s.zone,
            "time_window_start": s.time_window_start,
            "time_window_end": s.time_window_end,
            "order": i + 1,
        })
        if i > 0:
            prev = order[i - 1]
            segments.append({
                "from": stops[prev].id, "to": s.id,
                "distance_km": round(dist_matrix[prev][idx], 2),
                "duration_min": round(dur_matrix[prev][idx], 2),
            })

    total_dist = sum(dist_matrix[order[i]][order[(i + 1) % len(order)]] for i in range(len(order)))
    total_dur = sum(dur_matrix[order[i]][order[(i + 1) % len(order)]] for i in range(len(order)))

    # Save to DB
    cid = uuid.UUID(company_id)
    opt = RouteOptimization(
        company_id=cid,
        driver_id=uuid.UUID(req.driver_id) if req.driver_id else None,
        vehicle_id=uuid.UUID(req.vehicle_id) if req.vehicle_id else None,
        date=date.today(),
        total_stops=n,
        total_distance_km=round(sequential_dist, 2),
        total_duration_min=round(sum(dur_matrix[i][(i + 1) % n] for i in range(n)), 2),
        optimized_distance_km=round(total_dist, 2),
        optimized_duration_min=round(total_dur, 2),
        saving_distance_pct=round(saving, 2),
        algorithm=req.algorithm,
        constraints_applied=constraints_applied,
        stops_order=[s.id for s in ordered_stops],
    )
    db.add(opt)
    await db.flush()
    await db.refresh(opt)

    return {
        "ordered_stops": ordered_stops,
        "total_distance_km": round(total_dist, 2),
        "total_duration_min": round(total_dur, 2),
        "original_distance_km": round(sequential_dist, 2),
        "saving_distance_pct": round(saving, 2),
        "algorithm": req.algorithm,
        "constraints_applied": constraints_applied,
        "segments": segments,
        "optimization_id": str(opt.id),
    }


def _two_opt(order: list[int], dist_matrix: list[list[float]]) -> list[int]:
    """2-opt improvement algorithm."""
    improved = True
    best = order[:]
    n = len(best)
    while improved:
        improved = False
        for i in range(1, n - 1):
            for j in range(i + 1, n):
                if j - i == 1:
                    continue
                new_route = best[:i] + best[i:j][::-1] + best[j:]
                # Compute total distance
                def total_dist(route):
                    return sum(dist_matrix[route[k]][route[(k + 1) % n]] for k in range(n))
                if total_dist(new_route) < total_dist(best):
                    best = new_route
                    improved = True
        if improved:
            break  # one pass for performance
    return best


async def list_optimizations(
    db: AsyncSession, company_id: str, driver_id: Optional[str] = None,
    limit: int = 20,
) -> list[dict]:
    q = select(RouteOptimization).where(
        RouteOptimization.company_id == uuid.UUID(company_id)
    ).order_by(RouteOptimization.created_at.desc()).limit(limit)
    if driver_id:
        q = q.where(RouteOptimization.driver_id == uuid.UUID(driver_id))
    result = await db.execute(q)
    return [_opt_to_dict(r) for r in result.scalars().all()]


# ===== VEHICLE LOAD OPTIMIZATION =====

async def optimize_load(db: AsyncSession, company_id: str, req: VehicleLoadOptimizeRequest) -> dict:
    """Optimize vehicle loading order and calculate utilization."""
    cid = uuid.UUID(company_id)
    vehicle_id = req.vehicle_id

    # Get vehicle config
    cfg_result = await db.execute(
        select(VehicleLoadConfig).where(VehicleLoadConfig.vehicle_id == vehicle_id).limit(1)
    )
    cfg = cfg_result.scalar_one_or_none()

    max_vol = float(cfg.max_volume_m3) if cfg and cfg.max_volume_m3 else 10.0
    max_w = float(cfg.max_weight_kg) if cfg and cfg.max_weight_kg else 1000.0
    max_pallets = cfg.max_pallets if cfg and cfg.max_pallets else 20
    has_fridge = cfg.has_refrigeration if cfg else False
    pref_order = cfg.preferred_order if cfg else "lifo"
    temp_min = float(cfg.temperature_min) if cfg and cfg.temperature_min else None
    temp_max = float(cfg.temperature_max) if cfg and cfg.temperature_max else None

    stops = req.stops
    total_vol = sum(s.volume_m3 for s in stops)
    total_w = sum(s.weight_kg for s in stops)
    total_pal = len(stops)

    # Temperature zone grouping
    temp_zones = defaultdict(list)
    for s in stops:
        zone = "refrigerated" if s.temperature_required is not None and s.temperature_required < 8 else "ambient"
        temp_zones[zone].append(s.id)

    # Determine load order
    load_order_list = list(enumerate(stops))
    if req.load_order or pref_order == "by_zone":
        if pref_order == "fifo":
            load_order_list = sorted(load_order_list, key=lambda x: x[1].priority)
        elif pref_order == "by_zone":
            # Refrigerated last (so it comes off first, LIFO)
            fridge = [(i, s) for i, s in enumerate(stops) if s.temperature_required is not None and s.temperature_required < 8]
            ambient = [(i, s) for i, s in enumerate(stops) if not (s.temperature_required is not None and s.temperature_required < 8)]
            load_order_list = ambient + fridge  # ambient loaded first (at bottom), fridge on top
        else:  # lifo default
            load_order_list = sorted(load_order_list, key=lambda x: x[1].priority, reverse=True)

    load_order = [
        {"order": i + 1, "stop_id": s.id,
         "volume_m3": s.volume_m3, "weight_kg": s.weight_kg,
         "temperature_required": s.temperature_required}
        for i, (_, s) in enumerate(load_order_list)
    ]

    util_vol = (total_vol / max_vol * 100) if max_vol > 0 else 0
    util_w = (total_w / max_w * 100) if max_w > 0 else 0

    warnings = []
    if util_vol > 100:
        warnings.append(f"Volume exceeds capacity by {round(util_vol - 100, 1)}%")
    if util_w > 100:
        warnings.append(f"Weight exceeds capacity by {round(util_w - 100, 1)}%")
    if total_pal > max_pallets:
        warnings.append(f"Pallets ({total_pal}) exceed max ({max_pallets})")

    # Check temperature compatibility
    temp_zones_list = [{"zone": z, "stop_ids": ids} for z, ids in temp_zones.items()]
    if len(temp_zones) > 1 and not has_fridge:
        warnings.append("Mixed temperature zones without refrigeration")

    constraints_ok = len(warnings) == 0 or all("exceeds" not in w for w in warnings)

    # Save result
    result = LoadOptimizationResult(
        company_id=cid, vehicle_id=vehicle_id,
        total_volume_m3=round(total_vol, 2), total_weight_kg=round(total_w, 2),
        total_pallets=total_pal,
        utilization_volume_pct=round(min(util_vol, 100), 2),
        utilization_weight_pct=round(min(util_w, 100), 2),
        load_order=load_order, temperature_zones=temp_zones_list,
        constraints_satisfied=constraints_ok, warnings=warnings,
    )
    db.add(result)
    await db.flush()
    await db.refresh(result)

    return {
        "total_volume_m3": round(total_vol, 2),
        "total_weight_kg": round(total_w, 2),
        "total_pallets": total_pal,
        "utilization_volume_pct": round(min(util_vol, 100), 2),
        "utilization_weight_pct": round(min(util_w, 100), 2),
        "load_order": load_order,
        "temperature_zones": temp_zones_list,
        "constraints_satisfied": constraints_ok,
        "warnings": warnings,
    }


async def get_or_create_vehicle_config(
    db: AsyncSession, company_id: str, vehicle_id: str
) -> dict:
    cid = uuid.UUID(company_id)
    vid = uuid.UUID(vehicle_id)
    result = await db.execute(
        select(VehicleLoadConfig).where(
            VehicleLoadConfig.vehicle_id == vid
        ).limit(1)
    )
    cfg = result.scalar_one_or_none()
    if not cfg:
        cfg = VehicleLoadConfig(company_id=cid, vehicle_id=vid)
        db.add(cfg)
        await db.flush()
        await db.refresh(cfg)
    return _load_config_to_dict(cfg)


async def update_vehicle_config(db: AsyncSession, company_id: str, vehicle_id: str, data: dict) -> Optional[dict]:
    cid = uuid.UUID(company_id)
    vid = uuid.UUID(vehicle_id)
    result = await db.execute(
        select(VehicleLoadConfig).where(VehicleLoadConfig.vehicle_id == vid).limit(1)
    )
    cfg = result.scalar_one_or_none()
    if not cfg:
        cfg = VehicleLoadConfig(company_id=cid, vehicle_id=vid)
        db.add(cfg)
    for k, v in data.items():
        if hasattr(cfg, k):
            setattr(cfg, k, v)
    await db.flush()
    await db.refresh(cfg)
    return _load_config_to_dict(cfg)


# ===== DYNAMIC REROUTE =====

async def dynamic_reroute(db: AsyncSession, company_id: str, req: DynReqSchema) -> dict:
    """Re-optimize a route after a change (new urgent stop, cancellation, etc.)."""
    current_stops = req.current_stops
    current_order = req.current_order
    reason = req.reason

    if not current_stops or not current_order:
        return {"error": "No stops or order provided"}

    # Build stop map
    stop_map = {s.id: s for s in current_stops}

    if req.new_stop:
        # Insert new stop into existing route
        ns = req.new_stop
        stop_map[ns.id] = ns

        best_pos = len(current_order)
        best_extra = float("inf")

        for pos in range(len(current_order) + 1):
            test_order = current_order[:pos] + [ns.id] + current_order[pos:]
            total_d = 0
            for i in range(len(test_order) - 1):
                if test_order[i] in stop_map and test_order[i + 1] in stop_map:
                    s1 = stop_map[test_order[i]]
                    s2 = stop_map[test_order[i + 1]]
                    total_d += _haversine_km(s1.lat, s1.lng, s2.lat, s2.lng)
            if total_d < best_extra or pos == 0:
                best_extra = total_d
                best_pos = pos

        optimized = current_order[:best_pos] + [ns.id] + current_order[best_pos:]

        # Calculate extra distance/duration
        orig_d = 0
        for i in range(len(current_order) - 1):
            if current_order[i] in stop_map and current_order[i + 1] in stop_map:
                s1 = stop_map[current_order[i]]
                s2 = stop_map[current_order[i + 1]]
                orig_d += _haversine_km(s1.lat, s1.lng, s2.lat, s2.lng)

        opt_d = 0
        for i in range(len(optimized) - 1):
            if optimized[i] in stop_map and optimized[i + 1] in stop_map:
                s1 = stop_map[optimized[i]]
                s2 = stop_map[optimized[i + 1]]
                opt_d += _haversine_km(s1.lat, s1.lng, s2.lat, s2.lng)

        extra_dist = max(0, opt_d - orig_d)
        extra_dur = extra_dist / 30 * 60

    elif req.cancel_stop_id:
        # Remove cancelled stop
        optimized = [s for s in current_order if s != req.cancel_stop_id]
        extra_dist = 0
        extra_dur = 0
    else:
        return {"error": "No new stop or cancellation provided"}

    # Build optimized stop list
    optimized_stops = []
    for sid in optimized:
        if sid in stop_map:
            s = stop_map[sid]
            optimized_stops.append({
                "id": sid, "lat": s.lat, "lng": s.lng,
                "address": s.address, "order": len(optimized_stops) + 1,
            })

    # Save request
    cid = uuid.UUID(company_id)
    reroute = DynamicRerouteRequest(
        company_id=cid,
        driver_id=uuid.UUID(req.driver_id) if req.driver_id else None,
        reason=reason,
        new_stop_id=uuid.UUID(req.new_stop.id) if req.new_stop else None,
        cancel_stop_id=uuid.UUID(req.cancel_stop_id) if req.cancel_stop_id else None,
        original_order=current_order,
        optimized_order=optimized,
        extra_distance_km=round(extra_dist, 2),
        extra_duration_min=round(extra_dur, 2),
        status="applied",
    )
    db.add(reroute)
    await db.flush()
    await db.refresh(reroute)

    return {
        "optimized_order": optimized_stops,
        "extra_distance_km": round(extra_dist, 2),
        "extra_duration_min": round(extra_dur, 2),
        "original_order": current_order,
        "reason": reason,
    }


async def list_reroute_requests(
    db: AsyncSession, company_id: str, limit: int = 20,
) -> list[dict]:
    q = select(DynamicRerouteRequest).where(
        DynamicRerouteRequest.company_id == uuid.UUID(company_id)
    ).order_by(DynamicRerouteRequest.created_at.desc()).limit(limit)
    result = await db.execute(q)
    return [_reroute_to_dict(r) for r in result.scalars().all()]


# ===== ETA PREDICTION =====

async def predict_eta(db: AsyncSession, company_id: str, req: EtaPredictRequest) -> dict:
    """Predict ETA based on distance, zone, time-of-day factors."""
    dist = _haversine_km(req.origin_lat, req.origin_lng, req.dest_lat, req.dest_lng)

    # Zone factor
    zone_factors = {
        "centro": 1.4, "céntrico": 1.4, "capiata": 1.2, "lambaré": 1.2,
        "luque": 1.15, "fernando": 1.2, "san_lorenzo": 1.2,
        "rural": 0.9, "troncal": 0.85, "autopista": 0.8,
    }
    zone_factor = 1.0
    if req.zone:
        zl = req.zone.lower().replace(" ", "_")
        for key, factor in zone_factors.items():
            if key in zl or zl in key:
                zone_factor = factor
                break

    # Time-of-day factor
    time_factor = 1.0
    if req.hora_dia:
        parts = req.hora_dia.split(":")
        hour = int(parts[0])
        if 7 <= hour <= 9:
            time_factor = 1.3  # morning rush
        elif 11 <= hour <= 13:
            time_factor = 1.2  # lunch rush
        elif 17 <= hour <= 19:
            time_factor = 1.4  # evening rush
        elif 22 <= hour or hour <= 5:
            time_factor = 0.8  # night

    # Day-of-week factor
    dow_factor = 1.0
    if req.dia_semana is not None:
        if req.dia_semana >= 5:
            dow_factor = 0.9  # weekend less traffic

    combined_factor = zone_factor * time_factor * dow_factor

    base_dur, traffic_factor, pred_dur, confidence = _estimate_duration_min(dist, combined_factor)

    # Save prediction
    cid = uuid.UUID(company_id)
    pred = EtaPrediction(
        company_id=cid,
        origin_lat=req.origin_lat, origin_lng=req.origin_lng,
        dest_lat=req.dest_lat, dest_lng=req.dest_lng,
        distance_km=round(dist, 2),
        base_duration_min=round(base_dur, 2),
        traffic_factor=traffic_factor,
        zone_factor=round(zone_factor, 2),
        time_factor=round(time_factor * dow_factor, 2),
        predicted_duration_min=round(pred_dur, 2),
        confidence_score=confidence,
        zone=req.zone,
        hora_dia=time.fromisoformat(req.hora_dia) if req.hora_dia else None,
        dia_semana=req.dia_semana,
    )
    db.add(pred)
    await db.flush()
    await db.refresh(pred)

    return {
        "distance_km": round(dist, 2),
        "base_duration_min": round(base_dur, 2),
        "traffic_factor": traffic_factor,
        "zone_factor": round(zone_factor, 2),
        "time_factor": round(time_factor * dow_factor, 2),
        "predicted_duration_min": round(pred_dur, 2),
        "confidence_score": confidence,
    }


async def record_actual_eta(
    db: AsyncSession, company_id: str, prediction_id: str, actual_duration_min: float
) -> Optional[dict]:
    result = await db.execute(
        select(EtaPrediction).where(EtaPrediction.id == uuid.UUID(prediction_id))
    )
    pred = result.scalar_one_or_none()
    if not pred:
        return None
    pred.actual_duration_min = actual_duration_min
    pred.error_min = round(actual_duration_min - float(pred.predicted_duration_min), 2)
    await db.flush()
    await db.refresh(pred)
    return {
        "id": str(pred.id),
        "predicted": float(pred.predicted_duration_min),
        "actual": actual_duration_min,
        "error_min": float(pred.error_min) if pred.error_min else None,
    }


# ===== EFFICIENCY DASHBOARD =====

async def get_efficiency_dashboard(db: AsyncSession, company_id: str) -> dict:
    cid = uuid.UUID(company_id)

    total_optimizations = await db.execute(
        select(sa_func.count(RouteOptimization.id)).where(
            RouteOptimization.company_id == cid
        )
    )
    total_routes = total_optimizations.scalar() or 0

    # Average savings
    savings = await db.execute(
        select(
            sa_func.avg(RouteOptimization.saving_distance_pct),
            sa_func.avg(RouteOptimization.saving_duration_pct),
        ).where(RouteOptimization.company_id == cid)
    )
    row = savings.one()
    avg_dist_saving = float(row[0]) if row[0] else None
    avg_dur_saving = float(row[1]) if row[1] else None

    # Total optimized stops
    stops_result = await db.execute(
        select(sa_func.sum(RouteOptimization.total_stops)).where(
            RouteOptimization.company_id == cid
        )
    )
    total_stops = stops_result.scalar() or 0

    # By driver
    driver_result = await db.execute(
        select(
            RouteOptimization.driver_id,
            sa_func.count(RouteOptimization.id),
            sa_func.avg(RouteOptimization.saving_distance_pct),
        ).where(
            RouteOptimization.company_id == cid,
            RouteOptimization.driver_id.isnot(None),
        ).group_by(RouteOptimization.driver_id).limit(10)
    )
    by_driver = [
        {
            "driver_id": str(row[0]),
            "routes_count": row[1],
            "avg_saving_pct": float(row[2]) if row[2] else 0,
        }
        for row in driver_result.all()
    ]

    # Recent optimizations
    recent = await list_optimizations(db, company_id, limit=5)

    return {
        "total_routes": total_routes,
        "avg_distance_efficiency": round(avg_dist_saving, 2) if avg_dist_saving else None,
        "avg_duration_efficiency": round(avg_dur_saving, 2) if avg_dur_saving else None,
        "avg_deliveries_per_hour": None,
        "avg_load_utilization": None,
        "avg_eta_accuracy": None,
        "total_optimized_stops": total_stops,
        "by_driver": by_driver,
        "recent_routes": recent,
    }


async def record_efficiency_metric(db: AsyncSession, company_id: str, data: dict) -> dict:
    cid = uuid.UUID(company_id)
    m = RouteEfficiencyMetric(
        company_id=cid,
        driver_id=uuid.UUID(data.get("driver_id")) if data.get("driver_id") else None,
        vehicle_id=uuid.UUID(data.get("vehicle_id")) if data.get("vehicle_id") else None,
        date=data.get("date", date.today()),
        total_stops=data.get("total_stops", 0),
        completed_stops=data.get("completed_stops", 0),
        total_distance_km=data.get("total_distance_km"),
        optimal_distance_km=data.get("optimal_distance_km"),
        distance_efficiency_pct=data.get("distance_efficiency_pct"),
        total_duration_min=data.get("total_duration_min"),
        optimal_duration_min=data.get("optimal_duration_min"),
        duration_efficiency_pct=data.get("duration_efficiency_pct"),
        deliveries_per_hour=data.get("deliveries_per_hour"),
        avg_stop_duration_min=data.get("avg_stop_duration_min"),
        total_volume_m3=data.get("total_volume_m3"),
        total_weight_kg=data.get("total_weight_kg"),
        load_utilization_pct=data.get("load_utilization_pct"),
        eta_accuracy_pct=data.get("eta_accuracy_pct"),
        notes=data.get("notes"),
    )
    db.add(m)
    await db.flush()
    await db.refresh(m)
    return _metric_to_dict(m)


# ===== HELPERS =====

def _opt_to_dict(o: RouteOptimization) -> dict:
    return {
        "id": str(o.id), "company_id": str(o.company_id),
        "driver_id": str(o.driver_id) if o.driver_id else None,
        "vehicle_id": str(o.vehicle_id) if o.vehicle_id else None,
        "date": o.date.isoformat() if o.date else None,
        "total_stops": o.total_stops,
        "total_distance_km": float(o.total_distance_km) if o.total_distance_km else None,
        "total_duration_min": float(o.total_duration_min) if o.total_duration_min else None,
        "optimized_distance_km": float(o.optimized_distance_km) if o.optimized_distance_km else None,
        "optimized_duration_min": float(o.optimized_duration_min) if o.optimized_duration_min else None,
        "saving_distance_pct": float(o.saving_distance_pct) if o.saving_distance_pct else None,
        "algorithm": o.algorithm,
        "constraints_applied": o.constraints_applied,
        "stops_order": o.stops_order,
        "status": o.status, "created_at": o.created_at,
    }


def _load_config_to_dict(c: VehicleLoadConfig) -> dict:
    return {
        "id": str(c.id), "company_id": str(c.company_id),
        "vehicle_id": str(c.vehicle_id),
        "max_volume_m3": float(c.max_volume_m3) if c.max_volume_m3 else None,
        "max_weight_kg": float(c.max_weight_kg) if c.max_weight_kg else None,
        "max_pallets": c.max_pallets,
        "temperature_min": float(c.temperature_min) if c.temperature_min else None,
        "temperature_max": float(c.temperature_max) if c.temperature_max else None,
        "has_refrigeration": c.has_refrigeration,
        "preferred_order": c.preferred_order,
    }


def _reroute_to_dict(r: DynamicRerouteRequest) -> dict:
    return {
        "id": str(r.id), "company_id": str(r.company_id),
        "driver_id": str(r.driver_id) if r.driver_id else None,
        "reason": r.reason,
        "new_stop_id": str(r.new_stop_id) if r.new_stop_id else None,
        "cancel_stop_id": str(r.cancel_stop_id) if r.cancel_stop_id else None,
        "extra_distance_km": float(r.extra_distance_km) if r.extra_distance_km else None,
        "extra_duration_min": float(r.extra_duration_min) if r.extra_duration_min else None,
        "status": r.status, "created_at": r.created_at,
    }


def _metric_to_dict(m: RouteEfficiencyMetric) -> dict:
    return {
        "id": str(m.id), "company_id": str(m.company_id),
        "driver_id": str(m.driver_id) if m.driver_id else None,
        "vehicle_id": str(m.vehicle_id) if m.vehicle_id else None,
        "date": m.date.isoformat() if m.date else None,
        "total_stops": m.total_stops, "completed_stops": m.completed_stops,
        "total_distance_km": float(m.total_distance_km) if m.total_distance_km else None,
        "optimal_distance_km": float(m.optimal_distance_km) if m.optimal_distance_km else None,
        "distance_efficiency_pct": float(m.distance_efficiency_pct) if m.distance_efficiency_pct else None,
        "total_duration_min": float(m.total_duration_min) if m.total_duration_min else None,
        "optimal_duration_min": float(m.optimal_duration_min) if m.optimal_duration_min else None,
        "duration_efficiency_pct": float(m.duration_efficiency_pct) if m.duration_efficiency_pct else None,
        "deliveries_per_hour": float(m.deliveries_per_hour) if m.deliveries_per_hour else None,
        "avg_stop_duration_min": float(m.avg_stop_duration_min) if m.avg_stop_duration_min else None,
        "load_utilization_pct": float(m.load_utilization_pct) if m.load_utilization_pct else None,
        "eta_accuracy_pct": float(m.eta_accuracy_pct) if m.eta_accuracy_pct else None,
        "notes": m.notes, "created_at": m.created_at,
    }
