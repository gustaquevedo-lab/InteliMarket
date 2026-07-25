"""Seed for Comerciales - oportunidades, afinidad, recomendaciones, churn"""
import asyncio
import asyncpg
from datetime import date, datetime, timedelta
from uuid import uuid4
from scripts.seed_data import DB, CID, P001, P003, P005, P011, CUST02, CUST03, CUST05, CO_OPP1, CO_AFFIN1, CO_AFFIN2, CO_REC1, CO_CHURN1


async def seed():
    conn = await asyncpg.connect(DB)
    try:
        # co_opportunities
        await conn.execute("""
            INSERT INTO co_opportunities (id, company_id, customer_id, product_id, suggested_product_id, opportunity_type, title, description, priority, score, status, suggested_discount_pct, suggested_action, metadata_json, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
            ON CONFLICT (id) DO NOTHING
        """, CO_OPP1, CID, CUST05, P001, None, "discount_dormant", "Cliente inactivo 45 días — ofrecer descuento 10% en Coca Cola", "Ferretería Martínez no compra desde hace 45 días. Producto estrella: Coca Cola 2L. Ofrecer descuento del 10% para reactivar.", "high", 75, "pending", 10.00, "send_whatsapp_discount", '{"source": "automatic_detection"}', datetime.utcnow())
        # Insert second opportunity with uuid4 for ID
        opp2_id = uuid4()
        await conn.execute("""
            INSERT INTO co_opportunities (id, company_id, customer_id, product_id, suggested_product_id, opportunity_type, title, description, priority, score, status, suggested_action, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
            ON CONFLICT (id) DO NOTHING
        """, opp2_id, CID, CUST03, P003, P011, "cross_selling", "Venta cruzada: Leche + Queso fundido", None, "medium", 62, "pending", "suggest_in_cart", datetime.utcnow())

        # co_product_affinity
        await conn.execute("""
            INSERT INTO co_product_affinity (id, company_id, product_a_id, product_b_id, support, confidence, lift, times_bought_together, last_computed_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            ON CONFLICT (id) DO NOTHING
        """, CO_AFFIN1, CID, P003, P011, 0.15, 0.72, 2.3, 18, datetime.utcnow())
        await conn.execute("""
            INSERT INTO co_product_affinity (id, company_id, product_a_id, product_b_id, support, confidence, lift, times_bought_together, last_computed_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            ON CONFLICT (id) DO NOTHING
        """, CO_AFFIN2, CID, P001, P005, 0.08, 0.35, 1.5, 7, datetime.utcnow())

        # co_recommendations
        await conn.execute("""
            INSERT INTO co_recommendations (id, company_id, customer_id, product_id, recommendation_type, score, reason, is_applied, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            ON CONFLICT (id) DO NOTHING
        """, CO_REC1, CID, CUST02, P005, "up_sell", 80, "Cliente compra aceite regularmente — sugerir presentación económica 3L", False, datetime.utcnow())

        # co_churn_analysis
        await conn.execute("""
            INSERT INTO co_churn_analysis (id, company_id, customer_id, churn_score, churn_risk, days_since_last_purchase, previous_frequency_days, current_frequency_days, frequency_drop_pct, average_purchase_amount, evaluated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            ON CONFLICT (id) DO NOTHING
        """, CO_CHURN1, CID, CUST05, 78, "high", 65, 14.0, 45.0, 68.9, 1850000, datetime.utcnow())

        print("✅ Comerciales seeded")
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(seed())
