import asyncio
import asyncpg

async def main():
    conn = await asyncpg.connect(host="db", port=5432, user="intelimarket", password="intelimarket_dev", database="intelimarket")
    rows = await conn.fetch("SELECT version_num FROM alembic_version")
    print("ALEMBIC:", rows)
    tables = await conn.fetch("SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename LIKE 'sv_%' ORDER BY tablename")
    print("SV TABLES:", [r["tablename"] for r in tables])
    count = len(tables)
    print(f"COUNT: {count}/28")
    await conn.close()

asyncio.run(main())
