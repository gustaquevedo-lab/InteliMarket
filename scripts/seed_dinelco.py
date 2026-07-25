"""Seed for Dinelco - payment gateway transactions"""
import asyncio
import asyncpg
from datetime import date, datetime, timedelta
from scripts.seed_data import DB, CID, DIN_TX1, DIN_TX2


async def seed():
    conn = await asyncpg.connect(DB)
    try:
        # 1 confirmed transaction
        await conn.execute("""
            INSERT INTO dinelco_transactions (id, company_id, order_id, amount, currency, status, customer_name, authorization_code, created_at)
            VALUES ($1, $2, 'Compra Juan Pérez', 125000, 'PYG', 'confirmed', 'Juan Pérez', 'DIN-001', $3)
            ON CONFLICT (id) DO NOTHING
        """, DIN_TX1, CID, datetime.utcnow())

        # 1 rejected transaction
        await conn.execute("""
            INSERT INTO dinelco_transactions (id, company_id, order_id, amount, currency, status, customer_name, created_at)
            VALUES ($1, $2, 'Intento compra rechazado', 55000, 'PYG', 'rejected', 'Juan Pérez', $3)
            ON CONFLICT (id) DO NOTHING
        """, DIN_TX2, CID, datetime.utcnow())

        print("✅ Dinelco seeded")
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(seed())
