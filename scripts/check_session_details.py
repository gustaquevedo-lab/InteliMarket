import asyncio
from sqlalchemy import text
from api.src.db import async_session_factory

SESSION_ID = "c64d4688-9c20-45a6-8d45-97a4b6fcca7e"

async def check_session_details():
    async with async_session_factory() as db:
        res_s = await db.execute(text("""
            SELECT id, register_id, user_id, cajero_nombre, monto_apertura, fecha_apertura, fecha_cierre, monto_cierre, estado
            FROM cash_sessions WHERE id = :sid;
        """), {"sid": SESSION_ID})
        print("=== SESION ===")
        print(dict(zip(res_s.keys(), res_s.fetchone())))

        # Ventas de la sesion
        res_v = await db.execute(text("""
            SELECT id, numero, total, condicion, estado, created_at FROM sales WHERE session_id = :sid ORDER BY created_at ASC;
        """), {"sid": SESSION_ID})
        sales = res_v.fetchall()
        print(f"\n=== VENTAS DE LA SESION ({len(sales)}) ===")
        for s in sales:
            print(dict(zip(res_v.keys(), s)))

        # Pagos de la sesion
        res_p = await db.execute(text("""
            SELECT sp.id, s.numero, sp.forma_pago, sp.moneda, sp.monto, sp.created_at
            FROM sale_payments sp
            JOIN sales s ON sp.sale_id = s.id
            WHERE s.session_id = :sid;
        """), {"sid": SESSION_ID})
        payments = res_p.fetchall()
        print(f"\n=== PAGOS DE LA SESION ({len(payments)}) ===")
        for p in payments:
            print(dict(zip(res_p.keys(), p)))

asyncio.run(check_session_details())
