import asyncio
from sqlalchemy import text
from api.src.db import async_session_factory

async def check_diversos_products():
    async with async_session_factory() as db:
        print("=== BUSQUEDA DE PRODUCTOS 'DIVERSOS' O CODIGOS SIMILARES ===")
        res = await db.execute(text("SELECT id, sku, codigo_barra, nombre, activo FROM products WHERE UPPER(nombre) LIKE '%DIVERS%' OR UPPER(sku) LIKE '%DIVERS%' OR codigo_barra LIKE '%DIVERS%';"))

        rows = res.fetchall()
        print(f"Encontrados: {len(rows)}")
        for r in rows:
            print(f"ID: {r[0]} | SKU: {r[1]} | Código: {r[2]} | Nombre: {r[3]} | Activo: {r[4]}")

        res2 = await db.execute(text("SELECT id, numero, total, estado FROM sales WHERE estado = 'anulado' ORDER BY created_at DESC LIMIT 10;"))
        print("\n=== VENTAS ANULADAS RECIENTES ===")
        for r in res2.fetchall():
            print(r)


asyncio.run(check_diversos_products())
