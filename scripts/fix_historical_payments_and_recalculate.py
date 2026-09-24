import asyncio
from decimal import Decimal
from sqlalchemy import text
from api.src.db import async_session_factory

async def fix_historical_payments_and_recalculate():
    async with async_session_factory() as db:
        print("=================================================================")
        print("CORRECCION HISTORICA DE SALE_PAYMENTS Y RECALCULO DE ARQUEOS")
        print("=================================================================")

        # 1. Corregir sale_payments donde el efectivo PYG excedía el saldo neto de la venta
        # Para ventas de un solo medio de pago (solo efectivo): monto = total de la venta
        res_single = await db.execute(text("""
            UPDATE sale_payments sp
            SET monto = sa.total
            FROM sales sa
            WHERE sp.sale_id = sa.id
              AND sp.forma_pago = 'EFECTIVO'
              AND sp.moneda = 'PYG'
              AND sa.fecha >= '2026-08-31 00:00:00'
              AND (SELECT COUNT(*) FROM sale_payments sp2 WHERE sp2.sale_id = sa.id) = 1
              AND sp.monto > sa.total;
        """))
        print(f"Pagos únicos en efectivo corregidos: {res_single.rowcount}")

        # Para ventas mixtas (ej. Zunilda ticket #001-015-0000147 o Tomasa #001-014-0033034)
        # Ajustar el efectivo PYG para que la suma de pagos sea exactamente igual a sa.total
        # Tomasa #001-014-0033034: Total = 102.407 Gs. Pagó R$ 5 (valor 5.500 Gs). Efectivo PYG debe ser 96.907 Gs (no 100.000).
        await db.execute(text("""
            UPDATE sale_payments
            SET monto = 96907
            WHERE sale_id = (SELECT id FROM sales WHERE numero = '001-014-0033034')
              AND forma_pago = 'EFECTIVO' AND moneda = 'PYG';
        """))

        # Zunilda #001-015-0000147: Total = 385.530 Gs. Pagó R$ 52 (valor 57.200 Gs). Efectivo PYG debe ser 328.330 Gs (no 329.000).
        await db.execute(text("""
            UPDATE sale_payments
            SET monto = 328330
            WHERE sale_id = (SELECT id FROM sales WHERE numero = '001-015-0000147')
              AND forma_pago = 'EFECTIVO' AND moneda = 'PYG';
        """))

        # Zunilda #001-015-0000142: Total = 254.742 Gs. Pagó QR = 100.000 Gs. Efectivo PYG = 154.742 Gs.
        await db.execute(text("""
            UPDATE sale_payments
            SET monto = 154742
            WHERE sale_id = (SELECT id FROM sales WHERE numero = '001-015-0000142')
              AND forma_pago = 'EFECTIVO' AND moneda = 'PYG';
        """))

        await db.commit()

        # 2. Recalcular las sesiones de hoy:
        sessions = [
            ("TOMASA", "81225f58-1c20-43b6-9e28-4c5bc0ce6be1"),
            ("EVELIN", "914e7eaf-23c2-49e6-9ed0-6fa838b9d891"),
            ("ZUNILDA", "c64d4688-9c20-45a6-8d45-97a4b6fcca7e"),
        ]

        for name, sid in sessions:
            res_s = await db.execute(text("SELECT monto_apertura, monto_apertura_brl, monto_apertura_usd FROM cash_sessions WHERE id = :sid;"), {"sid": sid})
            s_row = res_s.fetchone()
            fondo_pyg = Decimal(str(s_row[0] or 0))
            fondo_brl = Decimal(str(s_row[1] or 0))

            res_ventas = await db.execute(text("""
                SELECT COALESCE(SUM(CASE WHEN sp.moneda = 'PYG' THEN sp.monto ELSE 0 END), 0) as pyg,
                       COALESCE(SUM(CASE WHEN sp.moneda = 'BRL' THEN sp.monto ELSE 0 END), 0) as brl
                FROM sale_payments sp
                JOIN sales sa ON sp.sale_id = sa.id
                WHERE sa.session_id = :sid AND sp.forma_pago = 'EFECTIVO' AND sa.estado != 'anulado';
            """), {"sid": sid})

            v_row = res_ventas.fetchone()
            v_pyg = Decimal(str(v_row[0] or 0))
            v_brl = Decimal(str(v_row[1] or 0))

            esp_pyg = fondo_pyg + v_pyg
            esp_brl = fondo_brl + v_brl

            # Actualizar monto_cierre en cash_sessions y arqueo en cash_counts
            res_cc = await db.execute(text("SELECT id, monto_efectivo, monto_efectivo_brl FROM cash_counts WHERE session_id = :sid ORDER BY created_at DESC LIMIT 1;"), {"sid": sid})
            cc = res_cc.fetchone()
            if cc:
                cc_id, contado_pyg, contado_brl = cc
                contado_pyg = Decimal(str(contado_pyg or 0))
                contado_brl = Decimal(str(contado_brl or 0))
                dif_pyg = contado_pyg - esp_pyg
                dif_brl = contado_brl - esp_brl

                await db.execute(text("""
                    UPDATE cash_counts
                    SET diferencia = :dif_pyg, diferencia_brl = :dif_brl, requiere_revision = FALSE
                    WHERE id = :cc_id;
                """), {"dif_pyg": dif_pyg, "dif_brl": dif_brl, "cc_id": cc_id})

                await db.execute(text("""
                    UPDATE cash_sessions
                    SET monto_cierre = :contado_pyg
                    WHERE id = :sid;
                """), {"contado_pyg": contado_pyg, "sid": sid})

                print(f"\n📊 {name}:")
                print(f"   • PYG: Fondo ({fondo_pyg:,.0f}) + Ventas Netas ({v_pyg:,.0f}) = Esperado: {esp_pyg:,.0f} Gs")
                print(f"          Contado en Gaveta: {contado_pyg:,.0f} Gs | Diferencia Final: {dif_pyg:,.0f} Gs")
                print(f"   • BRL: Fondo (R$ {fondo_brl:.2f}) + Ventas Netas (R$ {v_brl:.2f}) = Esperado: R$ {esp_brl:.2f}")
                print(f"          Contado en Gaveta: R$ {contado_brl:.2f} | Diferencia Final: R$ {dif_brl:.2f}")

        await db.commit()
        print("\n✅ TODAS LAS SESIONES RECALCULADAS Y NORMALIZADAS.")

asyncio.run(fix_historical_payments_and_recalculate())
