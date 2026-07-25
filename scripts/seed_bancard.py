"""Seed for Bancard - payment gateway transactions"""
import asyncio
import asyncpg
from datetime import date, datetime, timedelta
from scripts.seed_data import DB, CID, BAN_TX1, BAN_TX2


async def seed():
    conn = await asyncpg.connect(DB)
    try:
        # 1 completed transaction
        await conn.execute("""
            INSERT INTO bancard_transactions (id, company_id, order_id, amount, currency, status, payment_type, authorization_code, created_at)
            VALUES ($1, $2, 'Coca Cola 2L x10', 45000, 'PYG', 'completed', 'credit', 'AUTH-001', $3)
            ON CONFLICT (id) DO NOTHING
        """, BAN_TX1, CID, datetime.utcnow())

        # 1 pending transaction
        await conn.execute("""
            INSERT INTO bancard_transactions (id, company_id, order_id, amount, currency, status, payment_type, created_at)
            VALUES ($1, $2, 'Supermercado Central compra mayo', 125000, 'PYG', 'pending', 'debit', $3)
            ON CONFLICT (id) DO NOTHING
        """, BAN_TX2, CID, datetime.utcnow())

        print("✅ Bancard seeded")
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(seed())
