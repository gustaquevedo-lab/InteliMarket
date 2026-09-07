import asyncio
from sqlalchemy import text
from api.src.db import async_session_factory

async def inspect_tables():
    async with async_session_factory() as db:
        print("=== PUNTO_EMISION_SECUENCIAS ===")
        res = await db.execute(text("SELECT * FROM punto_emision_secuencias"))
        cols = res.keys()
        for r in res.fetchall():
            print(dict(zip(cols, r)))

asyncio.run(inspect_tables())
