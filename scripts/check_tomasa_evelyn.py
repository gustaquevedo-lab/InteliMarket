import asyncio
from sqlalchemy import text
from api.src.db import async_session_factory

async def check_tomasa_evelyn():
    async with async_session_factory() as db:
        for name, sid in [("TOMASA", "81225f58-1c20-43b6-9e28-4c5bc0ce6be1"), ("EVELIN", "914e7eaf-23c2-49e6-9ed0-6fa838b9d891")]:
            print(f"\n==================================================")
            print(f"AUDITORIA SESION {name}: {sid}")
            print(f"==================================================")
            
            res_sess = await db.execute(text("""
                SELECT cs.id, cs.register_id, cr.nombre as caja_nombre, cr.codigo as caja_codigo,
                       cs.user_id, cs.cajero_nombre, cs.monto_apertura, cs.fecha_apertura, cs.estado
                FROM cash_sessions cs
                JOIN cash_registers cr ON cs.register_id = cr.id
                WHERE cs.id = :sid;
            """), {"sid": sid})
            print(dict(zip(res_sess.keys(), res_sess.fetchone())))

            res_v = await db.execute(text("""
                SELECT s.id, s.numero, s.numero_interno, s.total, s.condicion, s.estado, s.created_at
                FROM sales s WHERE s.session_id = :sid ORDER BY s.created_at ASC;
            """), {"sid": sid})
            sales = res_v.fetchall()
            print(f"Total ventas enlazadas: {len(sales)}")

            real_sales = [sa for sa in sales if str(sa[1] or "").startswith("001-")]
            sandbox_sales = [sa for sa in sales if not str(sa[1] or "").startswith("001-")]
            print(f"-> Ventas Fiscales Reales (001-...): {len(real_sales)}")
            print(f"-> Ventas Sandbox / Test: {len(sandbox_sales)}")

            tot_real = sum(r[3] for r in real_sales)
            print(f"-> Total Facturado Real: {tot_real:,.0f} Gs")
            for r in real_sales:
                print(f"   • Factura {r[1]} (Venta #{r[2]}): {r[3]:,.0f} Gs [{r[5]}] a las {r[6].strftime('%H:%M:%S')}")

            if sandbox_sales:
                print(f"⚠️ Ventas Sandbox encontradas ({len(sandbox_sales)}):")
                for sb in sandbox_sales[:5]:
                    print(f"   • Sandbox #{sb[1]}: {sb[3]:,.0f} Gs a las {sb[6].strftime('%H:%M:%S')}")

            res_p_real = await db.execute(text("""
                SELECT sp.forma_pago, sp.moneda, COUNT(*), SUM(sp.monto)
                FROM sale_payments sp
                JOIN sales s ON sp.sale_id = s.id
                WHERE s.session_id = :sid AND s.numero LIKE '001-%'
                GROUP BY sp.forma_pago, sp.moneda;
            """), {"sid": sid})
            print(f"\n📊 Resumen Pagos REALES de {name}:")
            for pr in res_p_real.fetchall():
                fp, mon, cnt, mnt = pr
                if mon == 'PYG':
                    print(f"   - {fp}: {cnt} cobros = {mnt:,.0f} Gs")
                else:
                    print(f"   - {fp} ({mon}): {cnt} cobros = {mon} {mnt:,.2f}")

asyncio.run(check_tomasa_evelyn())
