import asyncio
from sqlalchemy import text
from api.src.db import async_session_factory

async def print_exchange_rates():
    async with async_session_factory() as db:
        res = await db.execute(text("SELECT * FROM exchange_rates;"))
        cols = list(res.keys())
        print("=== TODAS LAS COTIZACIONES EN EXCHANGE_RATES ===")
        for r in res.fetchall():
            print(dict(zip(cols, r)))

asyncio.run(print_exchange_rates())
