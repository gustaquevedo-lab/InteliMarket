import asyncio
import uuid
from decimal import Decimal
from sqlalchemy import text
from api.src.db import async_session_factory
from api.src.caja.service import get_session_payment_breakdown, get_session_pre_close_summary

COMPANY_ID = "00000000-0000-0000-0000-000000000010"

async def inspect_zunilda():
    async with async_session_factory() as db:
        # 1. Buscar sesiones de Zunilda
        res_sess = await db.execute(text("""
            SELECT cs.id, cs.register_id, cr.nombre as caja_nombre, cs.user_id, cs.cajero_nombre,
                   cs.monto_apertura, cs.fecha_apertura, cs.fecha_cierre, cs.monto_cierre, cs.estado
            FROM cash_sessions cs
            JOIN cash_registers cr ON cs.register_id = cr.id
            WHERE cs.cajero_nombre ILIKE '%zunilda%' OR cr.nombre ILIKE '%5%' OR cr.nombre ILIKE '%15%'
            ORDER BY cs.fecha_apertura DESC
            LIMIT 5;
        """))
        cols = list(res_sess.keys())
        sessions = res_sess.fetchall()
        print("=== SESIONES DE ZUNILDA / CAJA 5 ===")
        for s in sessions:
            sd = dict(zip(cols, s))
            print(sd)

        open_session = next((s for s in sessions if s[9] == 'abierta'), None)
        if not open_session:
            print("\nNo se encontró sesión abierta para Zunilda.")
            return

        sid = str(open_session[0])
        print(f"\n>>> SESION ABIERTA ACTUAL: {sid} (Caja: {open_session[2]}) <<<")

        # 2. Consultar ventas y formas de pago vinculadas a la sesión
        res_sales = await db.execute(text("""
            SELECT s.id, s.numero, s.total, s.condicion, s.estado, s.fecha
            FROM sales s
            WHERE s.session_id = :sid
            ORDER BY s.fecha ASC;
        """), {"sid": sid})
        sales = res_sales.fetchall()
        print(f"Total ventas en la sesión: {len(sales)}")
        for sa in sales:
            print(f"Venta: {sa[1]} | Total: {sa[2]} | Condicion: {sa[3]} | Estado: {sa[4]} | Fecha: {sa[5]}")

        # 3. Consultar sale_payments
        res_sp = await db.execute(text("""
            SELECT sp.id, sp.sale_id, s.numero, sp.forma_pago, sp.moneda, sp.monto, sp.fecha
            FROM sale_payments sp
            JOIN sales s ON sp.sale_id = s.id
            WHERE s.session_id = :sid;
        """), {"sid": sid})
        cols_sp = list(res_sp.keys())
        payments = res_sp.fetchall()
        print(f"\nTotal pagos registrados en la sesión: {len(payments)}")
        for p in payments:
            print(dict(zip(cols_sp, p)))

        # 4. Probar get_session_payment_breakdown
        try:
            breakdown = await get_session_payment_breakdown(db, sid)
            print(f"\nBreakdown obtenido:", breakdown)
        except Exception as e:
            print(f"\nError en get_session_payment_breakdown: {e}")

        # 5. Probar get_session_pre_close_summary
        try:
            pre_close = await get_session_pre_close_summary(db, sid)
            print(f"\nPre-close summary:", pre_close)
        except Exception as e:
            print(f"\nError en get_session_pre_close_summary: {e}")

asyncio.run(inspect_zunilda())
