"""Seed Demand Forecast — predicciones, anomalías, sugerencias de compra para PY"""
import asyncio
import uuid
import asyncpg
from datetime import date, timedelta
from scripts.seed_data import (
    DB, CID,
    P001, P003, P005, P008, P010,
    DF_CFG1, DF_PRED1, DF_PRED2, DF_ANOM1, DF_SUGG1, DF_ACC1,
)

async def seed():
    conn = await asyncpg.connect(DB)
    try:
        today = date(2026, 6, 11)

        # 1. Forecast config
        await conn.execute("""
            INSERT INTO df_forecast_configs (id, company_id, model_type, horizon_days, seasonality_period, confidence_level, min_history_days, anomaly_threshold, reorder_weeks, safety_stock_days, default_markup_pct, activo)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
            ON CONFLICT (id) DO NOTHING
        """, DF_CFG1, CID, "exponential_smoothing", 90, 7, 95.0, 60, 2.5, 2, 7, 15.0, True)

        # 2. Forecast predictions — 7-day horizon for 5 products
        products = [P001, P003, P005, P008, P010]
        base_qty = {P001: 120, P003: 85, P005: 200, P008: 50, P010: 160}
        pred_ids = [DF_PRED1, DF_PRED2]
        for i, pid in enumerate(products):
            base = base_qty[pid]
            for day_offset in range(7):
                dt = today + timedelta(days=day_offset)
                pid_uuid = str(uuid.uuid4()) if i > 1 else (pred_ids[i] if day_offset == 0 else str(uuid.uuid4()))
                variance = 1 + (day_offset * 0.02)
                qty = round(base * variance, 1)
                await conn.execute("""
                    INSERT INTO df_forecast_predictions (id, company_id, product_id, forecast_date, predicted_qty, confidence_lower, confidence_upper, confidence_score, model_used, created_at)
                    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
                    ON CONFLICT (id) DO NOTHING
                """, pid_uuid, CID, pid, dt, qty, round(qty * 0.85, 1), round(qty * 1.15, 1),
                    85.0, "exponential_smoothing", dt)

        # 3. Forecast override: P003 adjusted from 120 to 150
        await conn.execute("""
            INSERT INTO df_forecast_overrides (id, company_id, product_id, forecast_date, original_qty, adjusted_qty, reason, created_by, created_at)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
            ON CONFLICT (id) DO NOTHING
        """, str(uuid.uuid4()), CID, P003, today + timedelta(days=3), 120, 150,
            "Promoción especial — ajuste por evento", "00000000-0000-0000-0000-000000000020", today)

        # 4. Anomaly detection: P010 demand spike +35%
        await conn.execute("""
            INSERT INTO df_anomaly_detections (id, company_id, product_id, tipo, severity, detected_date, expected_value, actual_value, deviation_pct, z_score, details, reviewed, created_at)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
            ON CONFLICT (id) DO NOTHING
        """, DF_ANOM1, CID, P010, "demand_spike", "warning", today - timedelta(days=1),
            120, 162, 35.0, 2.8, '{"possible_cause": "promo_no_registrada", "affected_days": 1}', False, today)

        # 5. Purchase suggestion: P001 qty 500
        await conn.execute("""
            INSERT INTO df_purchase_suggestions (id, company_id, product_id, suggested_qty, suggested_date, expected_price, expected_total, current_stock, lead_time_days, status, created_at)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
            ON CONFLICT (id) DO NOTHING
        """, DF_SUGG1, CID, P001, 500, today + timedelta(days=7), 6500, 3250000, 80, 7, "suggested", today)

        # 6. Forecast accuracy: P001 4.5% error
        await conn.execute("""
            INSERT INTO df_forecast_accuracy (id, company_id, product_id, forecast_date, predicted_qty, actual_qty, error_absolute, error_pct, modelo, recorded_at)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
            ON CONFLICT (id) DO NOTHING
        """, DF_ACC1, CID, P001, today - timedelta(days=1), 118, 123, 5.0, 4.5, "exponential_smoothing", today)

        print("✅ Demand Forecast seeded")
    finally:
        await conn.close()

if __name__ == "__main__":
    asyncio.run(seed())
