import asyncio
from sqlalchemy import text
from api.src.db import async_session_factory

async def check_product_cols():
    async with async_session_factory() as db:
        res = await db.execute(text("""
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'products'
            ORDER BY ordinal_position;
        """))
        print("=== COLUMNAS DE PRODUCTS ===")
        for r in res.fetchall():
            print(f"{r[0]} ({r[1]})")

asyncio.run(check_product_cols())
