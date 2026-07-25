"""Check tables and alembic."""
import asyncio
import asyncpg

async def main():
    conn = await asyncpg.connect('postgresql://intelimarket:intelimarket_dev@db:5432/intelimarket', timeout=15)
    rows = await conn.fetch("""
        SELECT table_name FROM information_schema.tables
        WHERE table_schema='public' AND table_name LIKE 'farm%'
        ORDER BY table_name
    """)
    print(f'farm tables: {len(rows)}')
    for r in rows:
        print(f'  - {r["table_name"]}')

    rows = await conn.fetch("SELECT * FROM alembic_version")
    print(f'\nalembic: {[dict(r) for r in rows]}')

    rows = await conn.fetch("SELECT pid, state, query_start, left(query,80) AS q FROM pg_stat_activity WHERE backend_type='client backend' AND pid != pg_backend_pid()")
    print(f'\nOther connections: {len(rows)}')
    for r in rows:
        print(f"  pid={r['pid']} state={r['state']} q={r['q']}")
    await conn.close()

asyncio.run(main())
