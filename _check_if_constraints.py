import asyncio, asyncpg

async def f():
    conn = await asyncpg.connect("postgresql://intelimarket:intelimarket_dev@db:5432/intelimarket")
    for table in ["withholding_configs", "withholding_documents", "account_plans", "accounting_periods", "accounting_entries", "collection_actions", "customer_scores"]:
        cons = await conn.fetch("""
            SELECT con.conname, pg_get_constraintdef(con.oid) as def
            FROM pg_constraint con JOIN pg_class rel ON rel.oid = con.conrelid
            WHERE rel.relname = $1 AND con.contype IN ('p', 'u')
        """, table)
        if cons:
            print(f"\n=== {table} ===")
            for c in cons:
                print(f"  {c['conname']}: {c['def']}")
    await conn.close()

asyncio.run(f())
