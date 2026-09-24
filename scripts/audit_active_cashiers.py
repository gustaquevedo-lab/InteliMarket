import asyncio
from decimal import Decimal
from sqlalchemy import text
from api.src.db import async_session_factory

async def audit_all_active_cashiers():
    async with async_session_factory() as db:
        print("==================================================")
        print("AUDITORIA COMPLETA DE SESIONES ACTIVAS DE CAJA")
        print("==================================================")

        # 1. Listar todas las sesiones abiertas o recientes de hoy
        res_sess = await db.execute(text("""
            SELECT cs.id, cs.register_id, cr.nombre as caja_nombre, cr.codigo as caja_codigo,
                   cs.user_id, cs.cajero_nombre, u.email,
                   cs.monto_apertura, cs.fecha_apertura, cs.fecha_cierre, cs.estado
            FROM cash_sessions cs
            JOIN cash_registers cr ON cs.register_id = cr.id
            LEFT JOIN users u ON cs.user_id = u.id
            WHERE cs.fecha_apertura >= '2026-08-31 00:00:00' OR cs.estado = 'abierta'
            ORDER BY cs.fecha_apertura DESC;
        """))
        sessions = res_sess.fetchall()
        cols_s = list(res_sess.keys())

        for s in sessions:
            sd = dict(zip(cols_s, s))
            sid = str(sd['id'])
            print(f"\n🔹 SESION: {sid}")
            print(f"   Cajero: {sd['cajero_nombre']} | Caja: {sd['caja_nombre']} ({sd['caja_codigo']}) | Estado: {sd['estado']}")
            print(f"   Apertura: {sd['fecha_apertura']} | Fondo: {sd['monto_apertura']:,.0f} Gs")

            # Ventas vinculadas a esta sesion
            res_v = await db.execute(text("""
                SELECT s.id, s.numero, s.numero_interno, s.total, s.condicion, s.estado, s.created_at
                FROM sales s
                WHERE s.session_id = :sid
                ORDER BY s.created_at ASC;
            """), {"sid": sid})
            sales = res_v.fetchall()
            print(f"   Total ventas enlazadas: {len(sales)}")

            # Separar ventas reales (001-...) de ventas sandbox / test (1313... o sin punto de emision fiscal)
            real_sales = []
            sandbox_sales = []
            for sa in sales:
                num = str(sa[1] or "")
                if num.startswith("001-"):
                    real_sales.append(sa)
                else:
                    sandbox_sales.append(sa)

            print(f"   -> Ventas Fiscales Reales (001-...): {len(real_sales)}")
            print(f"   -> Ventas Sandbox / Test: {len(sandbox_sales)}")

            # Detalle de ventas reales
            tot_real = sum(r[3] for r in real_sales)
            print(f"   -> Total Facturado Real: {tot_real:,.0f} Gs")
            for r in real_sales[:5]:
                print(f"      • Factura {r[1]} (Venta #{r[2]}): {r[3]:,.0f} Gs [{r[5]}] a las {r[6].strftime('%H:%M:%S')}")
            if len(real_sales) > 5:
                print(f"      ... ({len(real_sales)-5} facturas mas)")

            if sandbox_sales:
                print(f"   ⚠️ Ventas Sandbox encontradas en la sesion:")
                for sb in sandbox_sales[:5]:
                    print(f"      • Sandbox #{sb[1]} (Venta #{sb[2]}): {sb[3]:,.0f} Gs a las {sb[6].strftime('%H:%M:%S')}")

            # Pagos agrupados de las ventas REALES
            res_p_real = await db.execute(text("""
                SELECT sp.forma_pago, sp.moneda, COUNT(*), SUM(sp.monto)
                FROM sale_payments sp
                JOIN sales s ON sp.sale_id = s.id
                WHERE s.session_id = :sid AND s.numero LIKE '001-%'
                GROUP BY sp.forma_pago, sp.moneda;
            """), {"sid": sid})
            print(f"   📊 Resumen Pagos REALES de la Sesión:")
            for pr in res_p_real.fetchall():
                fp, mon, cnt, mnt = pr
                if mon == 'PYG':
                    print(f"      - {fp}: {cnt} cobros = {mnt:,.0f} Gs")
                else:
                    print(f"      - {fp} ({mon}): {cnt} cobros = {mon} {mnt:,.2f}")

asyncio.run(audit_all_active_cashiers())
