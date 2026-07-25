"""Seed for Suscripciones - demo data"""
import asyncio
import asyncpg
from datetime import date, datetime, timedelta
from scripts.seed_data import DB, CID, SR_PLAN1, SR_PLAN2, SR_ORD1, SR_PAY1, SR_LOG1, P003, P011, P012, CUST01, CUST03, BR_CENTRAL
from uuid import uuid4


async def seed():
    conn = await asyncpg.connect(DB)
    try:
        await conn.execute("""
            INSERT INTO sr_subscription_plans (id, company_id, customer_id, branch_id, customer_name,
               customer_email, frequency, delivery_day, delivery_address, status, notes, start_date,
               next_generation_date, is_active)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
            ON CONFLICT (id) DO NOTHING
        """, SR_PLAN1, CID, CUST03, BR_CENTRAL, "Juan Perez", "juan.perez@email.com",
           "weekly", 1, "Av. Mariscal Lopez 1234, Asunción", "active",
           "Plan Agua Semanal - 6 botellones de agua/semana", date.today(),
           date.today() + timedelta(days=7), True)

        await conn.execute("""
            INSERT INTO sr_subscription_plans (id, company_id, customer_id, branch_id, customer_name,
               customer_email, frequency, delivery_day, delivery_address, status, notes, start_date,
               next_generation_date, is_active)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
            ON CONFLICT (id) DO NOTHING
        """, SR_PLAN2, CID, CUST01, BR_CENTRAL, "Maria Gonzalez", "maria.gonzalez@email.com",
           "biweekly", 15, "Av. España 567, Asunción", "active",
           "Plan Lácteos Pack - Leche + yogur + queso cada semana", date.today(),
           date.today() + timedelta(days=14), True)

        await conn.execute("""
            INSERT INTO sr_subscription_plan_items (id, plan_id, product_id, product_name, quantity, unit_price)
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (id) DO NOTHING
        """, uuid4(), SR_PLAN1, P012, "Agua Mineral 2L", 6, 7500)

        await conn.execute("""
            INSERT INTO sr_subscription_plan_items (id, plan_id, product_id, product_name, quantity, unit_price)
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (id) DO NOTHING
        """, uuid4(), SR_PLAN2, P003, "Leche Entera 1L", 4, 8500)

        await conn.execute("""
            INSERT INTO sr_subscription_plan_items (id, plan_id, product_id, product_name, quantity, unit_price)
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (id) DO NOTHING
        """, uuid4(), SR_PLAN2, P011, "Queso Paraguay", 1, 25000)

        await conn.execute("""
            INSERT INTO sr_generated_orders (id, company_id, plan_id, customer_id, order_number,
               status, total, scheduled_date)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            ON CONFLICT (id) DO NOTHING
        """, SR_ORD1, CID, SR_PLAN1, CUST03, "SR-ORD-001", "generated", 45000,
           date.today() + timedelta(days=7))

        await conn.execute("""
            INSERT INTO sr_subscription_payments (id, company_id, plan_id, generated_order_id,
               amount, payment_method, status, paid_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            ON CONFLICT (id) DO NOTHING
        """, SR_PAY1, CID, SR_PLAN1, SR_ORD1, 45000, "transferencia", "confirmed",
           datetime.now())

        await conn.execute("""
            INSERT INTO sr_subscription_logs (id, company_id, plan_id, action, details)
            VALUES ($1, $2, $3, $4, $5::jsonb)
            ON CONFLICT (id) DO NOTHING
        """, SR_LOG1, CID, SR_PLAN1, "creacion",
           '{"detail": "Plan Agua Semanal creado para Supermercado Central"}')

        print("✅ Suscripciones seeded")
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(seed())
