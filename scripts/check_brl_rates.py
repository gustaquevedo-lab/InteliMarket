import asyncio
from sqlalchemy import text
from api.src.db import async_session_factory

async def check_rates_and_brl_sales():
    async with async_session_factory() as db:
        # Cotizaciones en DB
        res_r = await db.execute(text("SELECT * FROM exchange_rates;"))
        cols = list(res_r.keys())
        print("=== TABLA EXCHANGE_RATES ===")
        for r in res_r.fetchall():
            print(dict(zip(cols, r)))

        # Ventas de hoy con pagos en BRL
        res_brl = await db.execute(text("""
            SELECT sa.numero, u.nombre, sa.total, sp.forma_pago, sp.moneda, sp.monto as monto_brl, sa.created_at
            FROM sale_payments sp
            JOIN sales sa ON sp.sale_id = sa.id
            LEFT JOIN users u ON sa.user_id = u.id
            WHERE sp.moneda = 'BRL' AND sa.created_at >= '2026-08-31 00:00:00'
            ORDER BY sa.created_at DESC;
        """))

        print("\n=== VENTAS COBRADAS EN REALES (BRL) HOY ===")
        for b in res_brl.fetchall():
            num, caj, tot, fp, mon, mnt, f = b
            # Calcular tasa implicita = total en Gs / monto en BRL
            tasa_imp = (tot / mnt) if mnt and mnt > 0 else 0
            print(f"Factura {num} | Cajero: {caj} | Total Ticket: {tot:,.0f} Gs | Cobrado: R$ {mnt:.2f} (Tasa: {tasa_imp:,.0f} Gs/R$) a las {f.strftime('%H:%M:%S')}")

asyncio.run(check_rates_and_brl_sales())
