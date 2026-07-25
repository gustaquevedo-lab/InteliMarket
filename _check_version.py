import asyncio, asyncpg

async def f():
    conn = await asyncpg.connect("postgresql://intelimarket:intelimarket_dev@db:5432/intelimarket")
    rows = await conn.fetch("SELECT version_num FROM alembic_version")
    await conn.close()
    print(rows[0]["version_num"] if rows else "NO VERSION")

asyncio.run(f())
