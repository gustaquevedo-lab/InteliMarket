import asyncio
from sqlalchemy import text
from api.src.db import async_session_factory

async def list_and_clean():
    async with async_session_factory() as db:
        res = await db.execute(text("SELECT * FROM users WHERE nombre ILIKE '%evel%' OR email ILIKE '%evel%'"))
        cols = res.keys()
        rows = res.fetchall()
        print("COLUMNAS:", list(cols))
        for r in rows:
            print(dict(zip(cols, r)))

asyncio.run(list_and_clean())
