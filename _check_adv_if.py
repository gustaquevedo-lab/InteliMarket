import asyncio, asyncpg

async def f():
    conn = await asyncpg.connect("postgresql://intelimarket:intelimarket_dev@db:5432/intelimarket")
    tables = await conn.fetch("""
        SELECT table_name FROM information_schema.tables
        WHERE table_schema='public' AND (table_name LIKE 'adv_%' OR table_name LIKE 'if_%')
        ORDER BY table_name
    """)
    for t in tables:
        print(t['table_name'])
        # Get constraints
        cons = await conn.fetch("""
            SELECT con.conname, pg_get_constraintdef(con.oid) as def
            FROM pg_constraint con
            JOIN pg_class rel ON rel.oid = con.conrelid
            WHERE rel.relname = $1 AND con.contype = 'u'
        """, t['table_name'])
        for c in cons:
            print(f"  UK: {c['conname']}: {c['def']}")
    await conn.close()

asyncio.run(f())
