import asyncio
from sqlalchemy import text
from api.src.db import async_session_factory

async def check_sales_schema():
    async with async_session_factory() as db:
        res = await db.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name = 'sales';"))
        print("COLUMNAS DE SALES:", [r[0] for r in res.fetchall()])

        res_recent = await db.execute(text("SELECT * FROM sales ORDER BY created_at DESC LIMIT 5;"))
        cols = res_recent.keys()
        for r in res_recent.fetchall():
            print(dict(zip(cols, r)))

asyncio.run(check_sales_schema())
