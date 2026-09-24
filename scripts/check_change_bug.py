import asyncio
from decimal import Decimal
from sqlalchemy import text
from api.src.db import async_session_factory

async def check_tendered_vs_actual_total():
    async with async_session_factory() as db:
        print("=== VERIFICACION DE BILLETES RECIBIDOS VS TOTALES NETOS DE TICKET ===")

        sessions = [
            ("TOMASA", "81225f58-1c20-43b6-9e28-4c5bc0ce6be1"),
            ("EVELIN", "914e7eaf-23c2-49e6-9ed0-6fa838b9d891"),
            ("ZUNILDA", "c64d4688-9c20-45a6-8d45-97a4b6fcca7e"),
        ]

        for name, sid in sessions:
            res = await db.execute(text("""
                SELECT sa.numero, sa.total, sp.forma_pago, sp.moneda, sp.monto, (sp.monto - sa.total) as sobrecosto_vuelto
                FROM sales sa
                JOIN sale_payments sp ON sa.id = sp.sale_id
                WHERE sa.session_id = :sid AND sp.forma_pago = 'EFECTIVO' AND sp.moneda = 'PYG'
                ORDER BY sa.created_at ASC;
            """), {"sid": sid})
            print(f"\n--- {name} ---")
            for r in res.fetchall():
                num, tot, fp, mon, mnt, dif = r
                print(f"Factura #{num} | Total Ticket: {tot:,.0f} Gs | Registrado en Pago: {mnt:,.0f} Gs | Vuelto no descontado en el cobro: {dif:,.0f} Gs")

asyncio.run(check_tendered_vs_actual_total())
