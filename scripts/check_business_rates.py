import asyncio
from sqlalchemy import text
from api.src.db import async_session_factory

async def check_business_rates():
    async with async_session_factory() as db:
        print("=== COTIZACIONES ACTIVAS EN EL SISTEMA ===")
        res_r = await db.execute(text("SELECT id, moneda, tasa_compra, tasa_venta, fecha, created_at FROM exchange_rates ORDER BY created_at DESC LIMIT 10;"))
        for r in res_r.fetchall():
            print(f"Moneda: {r[1]} | Compra: {r[2]} | Venta: {r[3]} | Fecha: {r[4]} | Guardado: {r[5]}")

        res_comp = await db.execute(text("SELECT id, razon_social, ruc FROM companies;"))
        print("\n=== EMPRESAS REGISTRADAS ===")
        for c in res_comp.fetchall():
            print(c)

asyncio.run(check_business_rates())
