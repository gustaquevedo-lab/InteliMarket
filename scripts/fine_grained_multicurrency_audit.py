import asyncio
from decimal import Decimal
from sqlalchemy import text
from api.src.db import async_session_factory

async def fine_grained_multicurrency_audit():
    async with async_session_factory() as db:
        print("=================================================================")
        print("AUDITORIA FINA: VUELTOS CRUZADOS MULTIMONEDA (R$ -> GS)")
        print("=================================================================")

        sessions = [
            ("TOMASA (Caja 4)", "81225f58-1c20-43b6-9e28-4c5bc0ce6be1"),
            ("EVELIN (Caja 3)", "914e7eaf-23c2-49e6-9ed0-6fa838b9d891"),
            ("ZUNILDA (Caja 5)", "c64d4688-9c20-45a6-8d45-97a4b6fcca7e"),
        ]

        for name, sid in sessions:
            print("\n" + "="*70)
            print(f"🔎 {name}")
            print("="*70)

            # Buscar todas las ventas donde se cobró en BRL o USD
            res = await db.execute(text("""
                SELECT sa.numero, sa.total, sp.forma_pago, sp.moneda, sp.monto, sa.created_at
                FROM sales sa
                JOIN sale_payments sp ON sa.id = sp.sale_id
                WHERE sa.session_id = :sid AND sp.moneda IN ('BRL', 'USD')
                ORDER BY sa.created_at ASC;
            """), {"sid": sid})
            foreign_pays = res.fetchall()

            total_vuelto_pyg_por_reales = Decimal("0")

            for r in foreign_pays:
                num, tot, fp, mon, mnt, f = r
                mnt = Decimal(str(mnt))
                tot = Decimal(str(tot))
                
                # En Extra Supermercado la cotización aplicada en caja para BRL es 1.100 Gs/R$ (o la registrada)
                # El valor en Gs del billete entregado por el cliente:
                # Si el cliente entregó mnt en BRL, su valor en Gs = mnt * 1100
                valor_brl_en_pyg = mnt * Decimal("1100")
                vuelto_pyg = valor_brl_en_pyg - tot if valor_brl_en_pyg > tot else Decimal("0")
                total_vuelto_pyg_por_reales += vuelto_pyg

                print(f"   • Factura #{num}:")
                print(f"      - Total Ticket: {tot:,.0f} Gs")
                print(f"      - Cliente pagó con: R$ {mnt:.2f} (Equivalente a {valor_brl_en_pyg:,.0f} Gs a cotización 1.100)")
                print(f"      - Vuelto entregado en Guaraníes desde la gaveta: {vuelto_pyg:,.0f} Gs")

            print(f"\n   💵 RESUMEN DE SALIDAS DE GUARANÍES POR COBROS EN REALES:")
            print(f"      Total Vueltos en Guaraníes entregados por Reales: {total_vuelto_pyg_por_reales:,.0f} Gs")

asyncio.run(fine_grained_multicurrency_audit())
