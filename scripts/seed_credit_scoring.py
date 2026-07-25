"""Seed Credit Scoring — scores, alertas, eventos para clientes PY"""
import asyncio
import uuid
import asyncpg
from datetime import datetime
from scripts.seed_data import (
    DB, CID,
    CUST01, CUST03, CUST05,
    CS_SCORE1, CS_SCORE2, CS_ALERT1, CS_EVENT1, CS_EVENT2,
)

async def seed():
    conn = await asyncpg.connect(DB)
    try:
        now = datetime(2026, 6, 11, 12, 0, 0)

        # 1. Credit score for CUST01 — low risk
        await conn.execute("""
            INSERT INTO sc_credit_scores (id, company_id, customer_id, score, risk_level, payment_history_score, antiquity_score, frequency_score, avg_amount_score, industry_score, credit_utilization_score, suggested_credit_limit, current_credit_limit, used_credit, available_credit, on_time_payment_rate, average_payment_delay_days, total_purchases, months_as_customer, times_overdue, status, is_auto_blocked, last_evaluation_date)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23)
            ON CONFLICT (id) DO NOTHING
        """, CS_SCORE1, CID, CUST01, 720, "low", 280, 200, 150, 130, 80, 100,
            150000000, 150000000, 45000000, 105000000,
            0.98, 2.5, 45, 24, 0, "active", False, now)

        # 2. Credit score for CUST05 — high risk, auto-blocked
        await conn.execute("""
            INSERT INTO sc_credit_scores (id, company_id, customer_id, score, risk_level, payment_history_score, antiquity_score, frequency_score, avg_amount_score, industry_score, credit_utilization_score, suggested_credit_limit, current_credit_limit, used_credit, available_credit, on_time_payment_rate, average_payment_delay_days, total_purchases, months_as_customer, times_overdue, status, is_auto_blocked, block_reason, last_evaluation_date)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24)
            ON CONFLICT (id) DO NOTHING
        """, CS_SCORE2, CID, CUST05, 380, "high", 120, 50, 40, 60, 50, 60,
            5000000, 15000000, 15000000, 0,
            0.65, 18.0, 8, 6, 3, "blocked", True, "Score < 300 o mora > 60 días", now)

        # 3. Risk alert for CUST05 — critical score drop
        await conn.execute("""
            INSERT INTO sc_risk_alerts (id, company_id, customer_id, alert_type, severity, previous_score, new_score, message, metadata_json, is_read, created_at)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
            ON CONFLICT (id) DO NOTHING
        """, CS_ALERT1, CID, CUST05, "score_drop", "critical", 500, 380,
            "Score crítico: 380 — cliente bloqueado automáticamente", '{}', False, now)

        # 4. Risk alert for CUST03 — near limit warning
        await conn.execute("""
            INSERT INTO sc_risk_alerts (id, company_id, customer_id, alert_type, severity, message, metadata_json, is_read, created_at)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
            ON CONFLICT (id) DO NOTHING
        """, str(uuid.uuid4()), CID, CUST03, "near_limit", "warning",
            "Cliente usando 95% del límite de crédito", '{"usage_pct": 95, "limit": 50000000, "used": 47500000}', False, now)

        # 5. Credit event: CUST05 auto block
        await conn.execute("""
            INSERT INTO sc_credit_events (id, company_id, customer_id, event_type, previous_limit, new_limit, reason, created_at)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
            ON CONFLICT (id) DO NOTHING
        """, CS_EVENT1, CID, CUST05, "auto_block", 15000000, 0,
            "Score < 300 o mora > 60 días", now)

        # 6. Credit event: CUST01 limit increase
        await conn.execute("""
            INSERT INTO sc_credit_events (id, company_id, customer_id, event_type, previous_limit, new_limit, reason, created_at)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
            ON CONFLICT (id) DO NOTHING
        """, CS_EVENT2, CID, CUST01, "limit_increase", 100000000, 150000000,
            "Evaluación positiva — score 720", now)

        print("✅ Credit Scoring seeded")
    finally:
        await conn.close()

if __name__ == "__main__":
    asyncio.run(seed())
