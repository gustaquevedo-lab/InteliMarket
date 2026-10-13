import asyncio
from sqlalchemy import text
from api.src.db import async_session_factory

async def check_sales():
    async with async_session_factory() as db:
        res = await db.execute(text("SELECT * FROM sales LIMIT 1;"))
        print("COLUMNAS DE SALES:", list(res.keys()))

        res_recent = await db.execute(text("SELECT * FROM sales ORDER BY created_at DESC LIMIT 10;"))
        cols = list(res_recent.keys())
        for r in res_recent.fetchall():
            print(dict(zip(cols, r)))

asyncio.run(check_sales())
