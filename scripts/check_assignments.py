import asyncio
from sqlalchemy import text
from api.src.db import async_session_factory

async def check_assignments():
    async with async_session_factory() as db:
        res = await db.execute(text("SELECT id, hostname, ip_address, punto_emision, caja_nombre, activo FROM pos_terminal_assignments ORDER BY punto_emision ASC"))
        print("=== ASIGNACIONES DE CAJAS / TERMINALES ===")
        for r in res.fetchall():
            print(f"IP: {r[2]} | Punto: {r[3]} | Caja: {r[4]} | Hostname: {r[1]} | Activo: {r[5]}")

asyncio.run(check_assignments())
