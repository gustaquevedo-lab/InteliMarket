import asyncio
from sqlalchemy import text
from api.src.db import async_session_factory

async def inspect():
    async with async_session_factory() as db:
        res = await db.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name = 'customers';"))
        cols_all = [r[0] for r in res.fetchall()]
        print("COLUMNAS DE CUSTOMERS:", cols_all)

        res_cust = await db.execute(text("SELECT * FROM customers WHERE ruc LIKE '%3425101%' OR razon_social LIKE '%3425101%';"))
        cols = list(res_cust.keys())
        for c in res_cust.fetchall():
            print("\nCLIENTE POSTGRES:", dict(zip(cols, c)))


asyncio.run(inspect())
