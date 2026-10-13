import asyncio
from decimal import Decimal
from sqlalchemy import text
from api.src.db import async_session_factory

async def explain_exact_differences():
    async with async_session_factory() as db:
        print("=================================================================")
        print("EXPLICACION MATEMATICA DE ARQUEOS Y GAVETAS")
        print("=================================================================")

        sessions = [
            ("TOMASA", "81225f58-1c20-43b6-9e28-4c5bc0ce6be1"),
            ("EVELIN", "914e7eaf-23c2-49e6-9ed0-6fa838b9d891"),
            ("ZUNILDA", "c64d4688-9c20-45a6-8d45-97a4b6fcca7e"),
        ]

        for name, sid in sessions:
            print("\n" + "="*70)
            print(f"📊 CAJERA: {name} (Sesión {sid})")
            print("="*70)

            # 1. Fondos de Apertura
            res_s = await db.execute(text("SELECT monto_apertura, monto_apertura_brl, monto_apertura_usd FROM cash_sessions WHERE id = :sid;"), {"sid": sid})
            s_row = res_s.fetchone()
            fondo_pyg = Decimal(str(s_row[0] or 0))
            fondo_brl = Decimal(str(s_row[1] or 0))
            fondo_usd = Decimal(str(s_row[2] or 0))

            # 2. Conteo Físico que ingresó la cajera
            res_cc = await db.execute(text("SELECT monto_efectivo, monto_efectivo_brl, monto_efectivo_usd FROM cash_counts WHERE session_id = :sid ORDER BY created_at DESC LIMIT 1;"), {"sid": sid})
            cc_row = res_cc.fetchone()
            contado_pyg = Decimal(str(cc_row[0] or 0)) if cc_row else Decimal("0")
            contado_brl = Decimal(str(cc_row[1] or 0)) if cc_row else Decimal("0")
            contado_usd = Decimal(str(cc_row[2] or 0)) if cc_row else Decimal("0")

            # 3. Ventas por forma de pago
            res_pays = await db.execute(text("""
                SELECT sp.forma_pago, sp.moneda, sp.monto, sa.numero, sa.total
                FROM sale_payments sp
                JOIN sales sa ON sp.sale_id = sa.id
                WHERE sa.session_id = :sid AND sa.estado != 'anulado'
                ORDER BY sa.created_at ASC;
            """), {"sid": sid})
            pays = res_pays.fetchall()

            ventas_efectivo_pyg = Decimal("0")
            ventas_efectivo_brl = Decimal("0")
            ventas_efectivo_usd = Decimal("0")
            ventas_tarjetas_pyg = Decimal("0")
            ventas_qr_pyg = Decimal("0")
            ventas_extraclub_pyg = Decimal("0")

            print("   Lista de Cobros Registrados:")
            for p in pays:
                fp, mon, mnt, num, tot = p
                mnt = Decimal(str(mnt))
                fp_u = fp.upper()
                if fp_u == "EFECTIVO":
                    if mon == "PYG":
                        ventas_efectivo_pyg += mnt
                        print(f"      - Fac #{num}: EFECTIVO {mnt:,.0f} Gs")
                    elif mon == "BRL":
                        ventas_efectivo_brl += mnt
                        print(f"      - Fac #{num}: EFECTIVO R$ {mnt:.2f} (Total Ticket: {tot:,.0f} Gs)")
                    elif mon == "USD":
                        ventas_efectivo_usd += mnt
                        print(f"      - Fac #{num}: EFECTIVO US$ {mnt:.2f} (Total Ticket: {tot:,.0f} Gs)")
                elif "DINELCO" in fp_u or "BANCARD" in fp_u or "TARJETA" in fp_u:
                    ventas_tarjetas_pyg += mnt
                    print(f"      - Fac #{num}: {fp} {mnt:,.0f} Gs (VOUCHER POS)")
                elif "QR" in fp_u:
                    ventas_qr_pyg += mnt
                    print(f"      - Fac #{num}: QR {mnt:,.0f} Gs (DIGITAL)")
                elif "EXTRA_CLUB" in fp_u or "CLUB" in fp_u:
                    ventas_extraclub_pyg += mnt
                    print(f"      - Fac #{num}: EXTRA CLUB {mnt:,.0f} Gs (CREDITO/VALE)")
                else:
                    print(f"      - Fac #{num}: {fp} {mnt:,.0f} Gs")

            esp_pyg = fondo_pyg + ventas_efectivo_pyg
            esp_brl = fondo_brl + ventas_efectivo_brl
            esp_usd = fondo_usd + ventas_efectivo_usd

            dif_pyg = contado_pyg - esp_pyg
            dif_brl = contado_brl - esp_brl
            dif_usd = contado_usd - esp_usd

            print("\n   📈 BALANCE DE CAJA:")
            print(f"      • PYG: Fondo Apertura ({fondo_pyg:,.0f}) + Ventas Efectivo ({ventas_efectivo_pyg:,.0f}) = Esperado {esp_pyg:,.0f} Gs")
            print(f"             Contado Físico: {contado_pyg:,.0f} Gs | Diferencia: {dif_pyg:,.0f} Gs")
            print(f"      • BRL: Fondo Apertura (R$ {fondo_brl:.2f}) + Ventas Reales (R$ {ventas_efectivo_brl:.2f}) = Esperado R$ {esp_brl:.2f}")
            print(f"             Contado Físico: R$ {contado_brl:.2f} | Diferencia: R$ {dif_brl:.2f}")
            print(f"      • Comprobantes Electrónicos / No Efectivo:")
            print(f"             Tarjetas POS: {ventas_tarjetas_pyg:,.0f} Gs")
            print(f"             QR Bancard:   {ventas_qr_pyg:,.0f} Gs")
            print(f"             Extra Club:   {ventas_extraclub_pyg:,.0f} Gs")

asyncio.run(explain_exact_differences())
