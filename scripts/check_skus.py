import asyncio
from sqlalchemy import text
from api.src.db import async_session_factory

async def check_skus():
    async with async_session_factory() as db:
        res = await db.execute(text("SELECT sku, codigo_barra, nombre, precio_venta FROM products WHERE sku IS NOT NULL LIMIT 10;"))
        print("=== MUESTRA DE SKU Y CODIGO BARRA EN POSTGRES ===")
        for r in res.fetchall():
            print(f"SKU: '{r[0]}' | Barra: '{r[1]}' | Nombre: {r[2]} | Precio: {r[3]}")

asyncio.run(check_skus())
