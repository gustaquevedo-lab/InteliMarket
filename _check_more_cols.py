import asyncio, asyncpg

async def f():
    conn = await asyncpg.connect("postgresql://intelimarket:intelimarket_dev@db:5432/intelimarket")
    for t in ["sr_subscription_plans", "sr_generated_orders", "sr_subscription_payments",
              "di_delivery_orders", "di_menu_sync_logs", "di_platform_logs", "di_daily_stats"]:
        print(f"\n=== {t} ===")
        rows = await conn.fetch(f"SELECT column_name, data_type FROM information_schema.columns WHERE table_name='{t}' ORDER BY ordinal_position")
        for r in rows:
            print(f"  {r['column_name']} ({r['data_type']})")
    await conn.close()

asyncio.run(f())
