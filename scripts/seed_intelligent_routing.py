"""Seed Intelligent Routing — rutas optimizadas, carga, ETA, eficiencia PY"""
import asyncio
import json
import uuid
import asyncpg
from datetime import date, datetime, time
from scripts.seed_data import (
    DB, CID,
    USER_SA,
    IR_ROUTE1, IR_VEH1, IR_LOAD1, IR_REROUT, IR_ETA1, IR_EFF1,
)

async def seed():
    conn = await asyncpg.connect(DB)
    try:
        today = date(2026, 6, 11)

        # 1. Route optimization
        stops_order = [
            {"stop": 1, "lat": -25.295, "lng": -57.635, "address": "Av. Mariscal López 1200, Asunción"},
            {"stop": 2, "lat": -25.300, "lng": -57.640, "address": "Av. Eusebio Ayala 800, Asunción"},
            {"stop": 3, "lat": -25.310, "lng": -57.620, "address": "Av. España 500, Asunción"},
            {"stop": 4, "lat": -25.320, "lng": -57.600, "address": "Av. Aviadores del Chaco 300, Asunción"},
            {"stop": 5, "lat": -25.330, "lng": -57.570, "address": "Ruta 2 km 10, San Lorenzo"},
            {"stop": 6, "lat": -25.340, "lng": -57.510, "address": "Ruta 2 km 14, San Lorenzo"},
            {"stop": 7, "lat": -25.270, "lng": -57.490, "address": "Av. Gral. Aquino 400, Luque"},
            {"stop": 8, "lat": -25.250, "lng": -57.520, "address": "Av. Rodríguez de Francia 200, Luque"},
        ]
        await conn.execute("""
            INSERT INTO ir_route_optimizations (id, company_id, driver_id, vehicle_id, date, total_stops, total_distance_km, total_duration_min, optimized_distance_km, optimized_duration_min, saving_distance_pct, saving_duration_pct, algorithm, constraints_applied, stops_order, status, created_at)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
            ON CONFLICT (id) DO NOTHING
        """, IR_ROUTE1, CID, USER_SA, str(uuid.uuid4()), today, 8, 42.5, 95.0, 34.2, 76.0, 19.5, 20.0,
            "nearest_neighbor_2opt",
            '{"time_windows": true, "capacity": true, "temperature_zones": false}',
            json.dumps(stops_order), "completed", datetime(2026, 6, 11, 8, 0, 0))

        # 2. Vehicle load config
        await conn.execute("""
            INSERT INTO ir_vehicle_load_configs (id, company_id, vehicle_id, max_volume_m3, max_weight_kg, max_pallets, has_refrigeration, preferred_order, created_at)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
            ON CONFLICT (id) DO NOTHING
        """, IR_VEH1, CID, str(uuid.uuid4()), 35.0, 1500.0, 12, False, "lifo", datetime(2026, 6, 11, 8, 0, 0))

        # 3. Load optimization result
        await conn.execute("""
            INSERT INTO ir_load_optimization_results (id, company_id, vehicle_id, route_optimization_id, total_volume_m3, total_weight_kg, total_pallets, utilization_volume_pct, utilization_weight_pct, load_order, constraints_satisfied, created_at)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
            ON CONFLICT (id) DO NOTHING
        """, IR_LOAD1, CID, str(uuid.uuid4()), IR_ROUTE1, 27.3, 975.0, 9, 78.0, 65.0,
            '[{"stop": 1, "items": 12}, {"stop": 2, "items": 8}, {"stop": 3, "items": 10}]',
            True, datetime(2026, 6, 11, 8, 0, 0))

        # 4. Dynamic reroute request
        await conn.execute("""
            INSERT INTO ir_dynamic_reroute_requests (id, company_id, driver_id, route_optimization_id, reason, original_order, optimized_order, extra_distance_km, extra_duration_min, status, created_at)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
            ON CONFLICT (id) DO NOTHING
        """, IR_REROUT, CID, USER_SA, IR_ROUTE1, "urgent_delivery",
            '[1, 2, 3, 4, 5, 6, 7, 8]', '[1, 2, 7, 8, 3, 4, 5, 6]', 3.2, 8.5, "applied", datetime(2026, 6, 11, 9, 0, 0))

        # 5. ETA predictions
        await conn.execute("""
            INSERT INTO ir_eta_predictions (id, company_id, origin_lat, origin_lng, dest_lat, dest_lng, distance_km, base_duration_min, traffic_factor, zone_factor, time_factor, predicted_duration_min, confidence_score, zone, hora_dia, dia_semana, created_at)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
            ON CONFLICT (id) DO NOTHING
        """, IR_ETA1, CID, -25.295, -57.635, -25.340, -57.510, 8.5, 15.0, 1.2, 1.0, 1.0, 18.0, 88.0, "urbano", time(10, 30), 4, datetime(2026, 6, 11, 10, 30, 0))

        await conn.execute("""
            INSERT INTO ir_eta_predictions (id, company_id, origin_lat, origin_lng, dest_lat, dest_lng, distance_km, base_duration_min, traffic_factor, zone_factor, time_factor, predicted_duration_min, confidence_score, zone, hora_dia, dia_semana, created_at)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
            ON CONFLICT (id) DO NOTHING
        """, str(uuid.uuid4()), CID, -25.295, -57.635, -25.380, -57.350, 22.0, 30.0, 1.0, 0.9, 1.3, 35.1, 72.0, "rural", time(14, 0), 4, datetime(2026, 6, 11, 14, 0, 0))

        # 6. Route efficiency metric
        await conn.execute("""
            INSERT INTO ir_route_efficiency_metrics (id, company_id, driver_id, vehicle_id, date, total_stops, completed_stops, total_distance_km, distance_efficiency_pct, deliveries_per_hour, avg_stop_duration_min, eta_accuracy_pct, created_at)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
            ON CONFLICT (id) DO NOTHING
        """, IR_EFF1, CID, USER_SA, str(uuid.uuid4()), today, 8, 8, 34.2, 95.0, 4.2, 11.5, 90.0, datetime(2026, 6, 11, 18, 0, 0))

        print("✅ Intelligent Routing seeded")
    finally:
        await conn.close()

if __name__ == "__main__":
    asyncio.run(seed())
