import asyncio, asyncpg

async def f():
    conn = await asyncpg.connect("postgresql://intelimarket:intelimarket_dev@db:5432/intelimarket")
    for table in ["loyalty_config", "loyalty_configs", "loyalty_points",
                  "di_delivery_integrations", "adv_inventory_locations", "if_withholding_taxes"]:
        rows = await conn.fetch("""
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_name=$1 ORDER BY ordinal_position
        """, table)
        if rows:
            print(f"\n=== {table} ===")
            for r in rows:
                print(f"  {r['column_name']} ({r['data_type']})")
            pks = await conn.fetch("""
                SELECT kcu.column_name FROM information_schema.table_constraints tc
                JOIN information_schema.key_column_usage kcu USING (constraint_name, table_schema, table_name)
                WHERE tc.table_name=$1 AND tc.constraint_type='PRIMARY KEY'
            """, table)
            print(f"  PK: {[r['column_name'] for r in pks]}")
    await conn.close()

asyncio.run(f())
