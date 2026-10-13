import asyncio
from sqlalchemy import text
from api.src.db import async_session_factory

async def check_caja5_sales():
    async with async_session_factory() as db:
        # Ver usuario Zunilda
        res_u = await db.execute(text("SELECT id, nombre, email, rol, activo FROM users WHERE nombre ILIKE '%zunilda%' OR email ILIKE '%zunilda%';"))
        users = res_u.fetchall()
        print("=== USUARIO ZUNILDA ===")
        for u in users:
            print(dict(zip(res_u.keys(), u)))

        # Ver sesiones de Caja 5 (658ef17c-8c6c-44a7-840f-3d15c665273b)
        res_cs5 = await db.execute(text("""
            SELECT * FROM cash_sessions 
            WHERE register_id = '658ef17c-8c6c-44a7-840f-3d15c665273b' OR user_id = :uid
            ORDER BY fecha_apertura DESC LIMIT 10;
        """), {"uid": users[0][0] if users else None})
        print("\n=== SESIONES DE CAJA 5 O ZUNILDA ===")
        for cs in res_cs5.fetchall():
            print(dict(zip(res_cs5.keys(), cs)))

        # Ver que session_id tienen las ventas del punto 015
        res_s015 = await db.execute(text("""
            SELECT s.id, s.numero, s.session_id, s.user_id, s.total, s.created_at, cs.cajero_nombre, cs.estado as session_estado, cs.register_id
            FROM sales s
            LEFT JOIN cash_sessions cs ON s.session_id = cs.id
            WHERE s.numero LIKE '%015%' OR s.created_at >= '2026-08-31 18:00:00'
            ORDER BY s.created_at DESC
            LIMIT 15;
        """))
        print("\n=== VENTAS RECIENTES Y SU SESSION_ID ===")
        for s in res_s015.fetchall():
            print(dict(zip(res_s015.keys(), s)))

asyncio.run(check_caja5_sales())
