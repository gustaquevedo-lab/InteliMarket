import asyncio
from decimal import Decimal
from sqlalchemy import text
from api.src.db import async_session_factory

async def forensic_cash_analysis():
    async with async_session_factory() as db:
        print("================================================================")
        print("ANALISIS FORENSE DE CAJAS - EXTRA SUPERMERCADO")
        print("================================================================")

        # 1. Cotizaciones
        res_rates = await db.execute(text("SELECT * FROM exchange_rates ORDER BY created_at DESC LIMIT 5;"))
        print("\n--- COTIZACIONES REGISTRADAS EN DB ---")
        cols_r = list(res_rates.keys())
        for r in res_rates.fetchall():
            print(dict(zip(cols_r, r)))

        # 2. Analizar todas las sesiones de hoy (31 de Agosto)
        res_sessions = await db.execute(text("""
            SELECT cs.id, cs.cajero_nombre, cr.nombre as caja, cs.monto_apertura, cs.monto_cierre,
                   cs.fecha_apertura, cs.fecha_cierre, cs.estado
            FROM cash_sessions cs
            JOIN cash_registers cr ON cs.register_id = cr.id
            WHERE cs.fecha_apertura >= '2026-08-31 00:00:00'
            ORDER BY cs.fecha_apertura DESC;
        """))
        sessions = res_sessions.fetchall()

        for s in sessions:
            sid, c_nombre, caja_nom, m_aper, m_cie, f_aper, f_cie, est = s
            print("\n" + "="*70)
            print(f"📌 CAJERO/A: {c_nombre} | CAJA: {caja_nom} | SESION: {sid}")
            print(f"   Apertura: {f_aper.strftime('%H:%M:%S')} | Cierre: {f_cie.strftime('%H:%M:%S') if f_cie else 'ABIERTA'} | Estado: {est}")
            print(f"   Fondo Apertura: {m_aper:,.0f} Gs")

            # Arqueo ingresado por la cajera al cerrar
            res_cc = await db.execute(text("""
                SELECT monto_efectivo, monto_efectivo_usd, monto_efectivo_brl, diferencia, diferencia_usd, diferencia_brl, requiere_revision, created_at
                FROM cash_counts WHERE session_id = :sid ORDER BY created_at DESC LIMIT 1;
            """), {"sid": sid})
            cc = res_cc.fetchone()
            if cc:
                print(f"   📥 CONTEO DECLARADO POR LA CAJERA AL CIERRE:")
                print(f"      • Efectivo PYG Contado: {cc[0]:,.0f} Gs | Diferencia s/ sistema: {cc[3]:,.0f} Gs")
                print(f"      • Efectivo USD Contado: US$ {cc[1]:.2f} | Diferencia USD: US$ {cc[4]:.2f}")
                print(f"      • Efectivo BRL Contado: R$ {cc[2]:.2f} | Diferencia BRL: R$ {cc[5]:.2f}")
                print(f"      • Requiere Revisión: {cc[6]}")
            else:
                print("   📥 Sin arqueo registrado aún en cash_counts.")

            # Desglose de Ventas por Medio de Pago (solo ventas no anuladas)
            res_pay = await db.execute(text("""
                SELECT sp.forma_pago, sp.moneda, COUNT(sp.id) as cant, SUM(sp.monto) as total_monto
                FROM sale_payments sp
                JOIN sales sa ON sp.sale_id = sa.id
                WHERE sa.session_id = :sid AND sa.estado != 'anulado'
                GROUP BY sp.forma_pago, sp.moneda
                ORDER BY sp.forma_pago, sp.moneda;
            """), {"sid": sid})
            payments = res_pay.fetchall()
            print(f"   📊 VENTAS FACTURADAS EN EL SISTEMA POR FORMA DE PAGO:")
            total_ventas_pyg = Decimal("0")
            for p in payments:
                fp, mon, cant, mnt = p
                mnt = Decimal(str(mnt))
                if mon == 'PYG':
                    total_ventas_pyg += mnt
                    print(f"      • {fp}: {cant} comprobantes = {mnt:,.0f} Gs")
                else:
                    print(f"      • {fp} ({mon}): {cant} comprobantes = {mon} {mnt:,.2f}")

            # Listado de todas las facturas emitidas en esta sesión
            res_invoices = await db.execute(text("""
                SELECT sa.id, sa.numero, sa.total, sa.condicion, sa.estado, sa.created_at
                FROM sales sa
                WHERE sa.session_id = :sid
                ORDER BY sa.created_at ASC;
            """), {"sid": sid})
            invs = res_invoices.fetchall()
            print(f"   🧾 FACTURAS EMITIDAS ({len(invs)} facturas):")
            for inv in invs:
                print(f"      - Fac #{inv[1]} | Total: {inv[2]:,.0f} Gs | Cond: {inv[3]} | Estado: {inv[4]} | Hora: {inv[5].strftime('%H:%M:%S')}")

asyncio.run(forensic_cash_analysis())
