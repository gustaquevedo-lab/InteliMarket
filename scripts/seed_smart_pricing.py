"""Seed Smart Pricing — promociones, precios escalonados, cambios para PY"""
import asyncio
import uuid
import asyncpg
from datetime import date, datetime, timedelta
from scripts.seed_data import (
    DB, CID,
    P001, P005, P010, P015, P020,
    CUST01, CUST05, CUST10,
    SP_ASSIGN1, SP_TIER1, SP_PROMO1, SP_PROMO2, SP_SUGG1, SP_CHANGE1,
)

async def seed():
    conn = await asyncpg.connect(DB)
    try:
        now = datetime(2026, 6, 1, 12, 0, 0)

        # 1. Price list assignment
        await conn.execute("""
            INSERT INTO sp_price_list_assignments (id, company_id, price_list_id, tipo, ref_id, created_at)
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (id) DO NOTHING
        """, SP_ASSIGN1, CID, "00000000-0000-0000-0000-000000000001", "cliente", CUST01, now)

        # 2. Tiered prices for P001
        tiers = [
            (SP_TIER1,       CID, "00000000-0000-0000-0000-000000000001", P001, 1,   11,  7200, "PYG", True, now),
            (str(uuid.uuid4()), CID, "00000000-0000-0000-0000-000000000001", P001, 12,  49,  6500, "PYG", True, now),
            (str(uuid.uuid4()), CID, "00000000-0000-0000-0000-000000000001", P001, 50,  None, 5900, "PYG", True, now),
        ]
        for t in tiers:
            await conn.execute("""
                INSERT INTO sp_tiered_prices (id, company_id, price_list_id, product_id, min_qty, max_qty, precio_unitario, moneda, activo, created_at)
                VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
                ON CONFLICT (id) DO NOTHING
            """, *t)

        # 3. Promotions
        promo1_id = SP_PROMO1
        promo2_id = SP_PROMO2
        await conn.execute("""
            INSERT INTO sp_promotions (id, company_id, nombre, descripcion, tipo, fecha_inicio, fecha_fin, activo, condiciones, prioridad, max_usos, created_at)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
            ON CONFLICT (id) DO NOTHING
        """, promo1_id, CID, "2x1 Coca Cola", "Llévate 2 pagando 1 — Coca Cola 2L", "2x1",
            datetime(2026, 7, 1, 0, 0, 0), datetime(2026, 7, 31, 23, 59, 59),
            True, '{"min_purchase": 50000}', 10, 500, now)

        await conn.execute("""
            INSERT INTO sp_promotions (id, company_id, nombre, descripcion, tipo, fecha_inicio, fecha_fin, activo, condiciones, prioridad, max_usos, created_at)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
            ON CONFLICT (id) DO NOTHING
        """, promo2_id, CID, "10% OFF Lácteos", "10% de descuento en toda la línea de lácteos", "percentage_discount",
            datetime(2026, 8, 1, 0, 0, 0), datetime(2026, 8, 31, 23, 59, 59),
            True, '{"min_purchase": 100000}', 5, 1000, now)

        # 4. Promotion rewards (for 2x1 promo)
        await conn.execute("""
            INSERT INTO sp_promotion_rewards (id, promotion_id, product_id, qty_required, qty_free, discount_pct, created_at)
            VALUES ($1,$2,$3,$4,$5,$6,$7)
            ON CONFLICT (id) DO NOTHING
        """, str(uuid.uuid4()), promo1_id, P001, 2, 1, 0, now)
        await conn.execute("""
            INSERT INTO sp_promotion_rewards (id, promotion_id, product_id, qty_required, qty_free, discount_pct, created_at)
            VALUES ($1,$2,$3,$4,$5,$6,$7)
            ON CONFLICT (id) DO NOTHING
        """, str(uuid.uuid4()), promo1_id, P005, 2, 1, 0, now)

        # 5. Promotion assignments
        await conn.execute("""
            INSERT INTO sp_promotion_assignments (id, promotion_id, tipo, created_at)
            VALUES ($1,$2,$3,$4)
            ON CONFLICT (id) DO NOTHING
        """, str(uuid.uuid4()), promo1_id, "all", now)
        await conn.execute("""
            INSERT INTO sp_promotion_assignments (id, promotion_id, tipo, created_at)
            VALUES ($1,$2,$3,$4)
            ON CONFLICT (id) DO NOTHING
        """, str(uuid.uuid4()), promo2_id, "all", now)

        # 6. Price suggestions
        await conn.execute("""
            INSERT INTO sp_price_suggestions (id, company_id, product_id, current_price, suggested_price, confidence, source, estado, created_at)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
            ON CONFLICT (id) DO NOTHING
        """, SP_SUGG1, CID, P001, 7200, 6800, 87.0, "demanda", "pending", now)
        await conn.execute("""
            INSERT INTO sp_price_suggestions (id, company_id, product_id, current_price, suggested_price, confidence, source, estado, created_at)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
            ON CONFLICT (id) DO NOTHING
        """, str(uuid.uuid4()), CID, P005, 10500, 9800, 72.0, "competencia", "pending", now)

        # 7. Price change request
        await conn.execute("""
            INSERT INTO sp_price_change_requests (id, company_id, product_id, price_list_id, old_price, new_price, reason, requested_by, status, approval_level, created_at)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
            ON CONFLICT (id) DO NOTHING
        """, SP_CHANGE1, CID, P001, "00000000-0000-0000-0000-000000000001", 7200, 6800,
            "Ajuste competitivo — precio sugerido por demanda", "00000000-0000-0000-0000-000000000020", "approved", 1, now)

        # 8. Price change history
        await conn.execute("""
            INSERT INTO sp_price_change_history (id, company_id, product_id, price_list_id, old_price, new_price, changed_by, change_type, reason, created_at)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
            ON CONFLICT (id) DO NOTHING
        """, str(uuid.uuid4()), CID, P001, "00000000-0000-0000-0000-000000000001", 7200, 6800,
            "00000000-0000-0000-0000-000000000020", "approval", "Ajuste competitivo aprobado", now)

        print("✅ Smart Pricing seeded")
    finally:
        await conn.close()

if __name__ == "__main__":
    asyncio.run(seed())
