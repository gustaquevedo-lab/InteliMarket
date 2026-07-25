"""Seed for Delivery Integrations - demo data"""
import asyncio
import asyncpg
from datetime import date, datetime, timedelta
from scripts.seed_data import DB, CID, DI_INT1, DI_ORD1, DI_MENU1, DI_LOG1, DI_STAT1, CUST02
from uuid import uuid4


async def seed():
    conn = await asyncpg.connect(DB)
    try:
        await conn.execute("""
            INSERT INTO di_delivery_integrations (id, company_id, platform, enabled, store_id,
                config, is_active)
            VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)
            ON CONFLICT (id) DO NOTHING
        """, DI_INT1, CID, "pedidosya", True, "PY-12345",
           '{"store_id": "PY-12345", "webhook_url": "https://api.intelimarket.py/delivery/pedidosya/webhook"}',
           True)

        await conn.execute("""
            INSERT INTO di_delivery_integrations (id, company_id, platform, enabled, store_id,
                config, is_active)
            VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)
            ON CONFLICT (company_id, platform) DO NOTHING
        """, uuid4(), CID, "uber_eats", True, "UE-67890",
           '{"store_id": "UE-67890"}', True)

        await conn.execute("""
            INSERT INTO di_delivery_orders (id, company_id, platform, platform_order_id, status,
               customer_name, subtotal, commission, total, currency)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            ON CONFLICT (id) DO NOTHING
        """, DI_ORD1, CID, "pedidosya", "PY-ORD-001", "completed",
           "Cliente CUST02", 125000, 18750, 125000, "PYG")

        await conn.execute("""
            INSERT INTO di_menu_sync_logs (id, company_id, platform, status, products_count, sync_type)
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (id) DO NOTHING
        """, DI_MENU1, CID, "pedidosya", "success", 25, "full")

        await conn.execute("""
            INSERT INTO di_platform_logs (id, company_id, platform, event_type, direction, status, error_message)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            ON CONFLICT (id) DO NOTHING
        """, DI_LOG1, CID, "pedidosya", "webhook_received", "inbound", "success",
           "Webhook recibido — nuevo pedido PY-ORD-001")

        yesterday = date.today() - timedelta(days=1)
        net = 2450000 - 367500
        await conn.execute("""
            INSERT INTO di_daily_stats (id, company_id, stat_date, platform, orders_count, total_sales,
               total_commission, net_sales, cancelled_orders)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            ON CONFLICT (id) DO NOTHING
        """, DI_STAT1, CID, yesterday, "pedidosya", 12, 2450000, 367500, net, 1)

        print("✅ Delivery Integrations seeded")
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(seed())
