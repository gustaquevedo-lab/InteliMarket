import asyncio
from decimal import Decimal
from sqlalchemy import text
from api.src.db import async_session_factory

async def audit_every_ticket_details():
    async with async_session_factory() as db:
        print("=================================================================")
        print("AUDITORIA TICKET POR TICKET - BUSQUEDA DE DIFERENCIAS")
        print("=================================================================")

        sessions = [
            ("TOMASA (Caja 4)", "81225f58-1c20-43b6-9e28-4c5bc0ce6be1"),
            ("EVELIN (Caja 3)", "914e7eaf-23c2-49e6-9ed0-6fa838b9d891"),
            ("ZUNILDA (Caja 5)", "c64d4688-9c20-45a6-8d45-97a4b6fcca7e"),
        ]

        for cashier_name, sid in sessions:
            print("\n" + "="*80)
            print(f"📌 {cashier_name} | Sesión: {sid}")
            print("="*80)

            res_sales = await db.execute(text("""
                SELECT sa.id, sa.numero, sa.total, sa.condicion, sa.estado, sa.created_at
                FROM sales sa
                WHERE sa.session_id = :sid
                ORDER BY sa.created_at ASC;
            """), {"sid": sid})


            sales = res_sales.fetchall()

            for s in sales:
                sale_id, num, total, cond, estado, f = s
                
                # Obtener pagos registrados
                res_pay = await db.execute(text("""
                    SELECT id, forma_pago, moneda, monto
                    FROM sale_payments
                    WHERE sale_id = :sale_id;
                """), {"sale_id": sale_id})
                pays = res_pay.fetchall()

                
                # Obtener items
                res_items = await db.execute(text("""
                    SELECT si.descripcion, si.cantidad, si.precio_unitario, si.total
                    FROM sale_items si
                    WHERE si.sale_id = :sale_id;
                """), {"sale_id": sale_id})
                items = res_items.fetchall()


                print(f"\n🧾 Ticket #{num} | Total: {total:,.0f} Gs | Cond: {cond} | Estado: {estado} | Hora: {f.strftime('%H:%M:%S')}")

                print("   💳 Formas de Pago:")
                for p in pays:
                    print(f"      - {p[1]} | {p[2]} {p[3]}")
                print(f"   📦 Items ({len(items)}):")

                for it in items:
                    print(f"      * {it[0]}: {it[1]} x {it[2]:,.0f} = {it[3]:,.0f} Gs")

asyncio.run(audit_every_ticket_details())
