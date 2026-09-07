import asyncio
from sqlalchemy import text
from api.src.db import async_session_factory

async def check_carrito_promos():
    async with async_session_factory() as db:
        res = await db.execute(text("""
            SELECT id, nombre, tipo, aplica_a, producto_ids, categoria_ids, valido_desde, valido_hasta, activo, estado
            FROM promotions 
            WHERE activo = true AND estado = 'activa' AND (aplica_a = 'carrito' OR producto_ids IS NOT NULL)
            LIMIT 20;

        """))
        print("=== PROMOCIONES ACTIVAS QUE AFECTAN ESCALAS ===")
        for r in res.fetchall():
            print(f"ID: {r[0]} | Nombre: '{r[1]}' | Tipo: {r[2]} | AplicaA: {r[3]} | Desde: {r[6]} Hasta: {r[7]}")

        res_count_carrito = await db.execute(text("""
            SELECT count(*) FROM promotions WHERE activo = true AND estado = 'activa' AND aplica_a = 'carrito';
        """))
        print(f"\nTotal promociones de carrito activas: {res_count_carrito.scalar()}")

asyncio.run(check_carrito_promos())
