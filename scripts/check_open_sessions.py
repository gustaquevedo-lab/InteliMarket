import asyncio
from sqlalchemy import text
from api.src.db import async_session_factory

async def check_open_sessions():
    async with async_session_factory() as db:
        res = await db.execute(text("""
            SELECT cs.id, cs.register_id, cr.nombre as caja_nombre, cs.user_id, u.nombre as user_nombre, u.email,
                   cs.monto_apertura, cs.fecha_apertura, cs.estado
            FROM cash_sessions cs
            JOIN cash_registers cr ON cs.register_id = cr.id
            LEFT JOIN users u ON cs.user_id = u.id
            WHERE cs.estado = 'abierta'
            ORDER BY cs.fecha_apertura DESC;
        """))
        cols = list(res.keys())
        sessions = res.fetchall()
        print(f"=== SESIONES ABIERTAS ACTUALMENTE ({len(sessions)}) ===")
        for s in sessions:
            print(dict(zip(cols, s)))

        # Ver todas las cajas registradas
        res_cr = await db.execute(text("SELECT * FROM cash_registers;"))

        print("\n=== CAJAS REGISTRADAS ===")
        for cr in res_cr.fetchall():
            print(dict(zip(res_cr.keys(), cr)))

asyncio.run(check_open_sessions())
