import asyncio
import uuid
from decimal import Decimal
from datetime import datetime, date, timezone, timedelta
from sqlalchemy import text
from api.src.db import async_session_factory

COMPANY_ID = '00000000-0000-0000-0000-000000000010'
REMISSION_ID = '8558668c-1576-4e84-8f8c-a6c0c46320a8'
tz_py = timezone(timedelta(hours=-3))

# 1. Datos Ticket 1 - Aníbal Barboza
SALE1_ID = str(uuid.uuid4())
CUSTOMER1_ID = '747c2333-2f4a-4ecb-b451-ae676b9e6472'
USER1_ID = 'f8dda96f-fd3e-4445-9e63-e7d9bdca482e' # Evelin Herrero
SESSION1_ID = '0a0bd00b-ab9e-4f0f-8767-496c056a595b'
NUM1 = '001-014-0880999'
FECHA1 = datetime(2026, 9, 22, 19, 31, 47, tzinfo=tz_py)
VENC1 = date(2026, 10, 22)
TOTAL1 = 197082
DESC1 = 2080
SUBTOTAL1 = 199162

ITEMS1 = [
    ('7840058008992', 2, 3900, 7800, 10),
    ('7891060833041', 1, 9400, 9400, 10),
    ('2000756', 0.048, 142500, 6840, 10),
    ('7840117012229', 2, 4200, 8400, 10),
    ('2000752', 0.038, 142500, 5415, 10),
    ('7898965490096', 1, 9177, 9177, 5),
    ('2000179', 0.105, 21477, 2255, 5),
    ('2000578', 0.300, 9777, 2933, 10),
    ('2000080', 0.300, 11977, 3593, 5),
    ('2000071', 0.148, 66777, 9883, 10),
    ('2000108', 0.158, 31100, 4914, 10),
    ('7840127020214', 1, 6700, 6700, 5),
    ('7896304000012', 1, 16900, 16900, 10),
    ('7891030003016', 2, 2000, 4000, 10),
    ('2000078', 0.550, 6677, 3673, 5),
    ('7840235003017', 1, 2500, 2500, 10),
    ('7790580140434', 1, 5600, 5600, 10),
    ('7896058259957', 2, 2800, 5600, 10),
    ('7896058259971', 2, 2800, 5600, 10),
    ('7896050200278', 1, 20000, 20000, 10),
    ('7802800535569', 1, 7500, 7500, 10),
    ('7840009650898', 1, 13100, 13100, 10),
    ('7840185785230', 1, 11900, 11900, 10),
    ('7896422001304', 1, 3900, 3900, 10),
    ('7790580716806', 1, 7200, 7200, 10),
    ('2000549', 1, 12300, 12300, 10)
]

# 2. Datos Ticket 2 - Alfredo Fabián Fernández
SALE2_ID = str(uuid.uuid4())
CUSTOMER2_ID = '1a906df5-4f45-41de-84cc-90589718500a'
USER2_ID = '7e5684e7-3cb9-4eb9-81bb-54c9ec5c0004' # Tomasa
SESSION2_ID = '66918f76-9363-4ccd-b342-75fe6c963fff'
NUM2 = '001-014-0225268'
FECHA2 = datetime(2026, 9, 19, 13, 22, 59, tzinfo=tz_py)
VENC2 = date(2026, 10, 19)
TOTAL2 = 227356
DESC2 = 14513
SUBTOTAL2 = 241869

ITEMS2 = [
    ('2000265', 1, 500, 500, 10),
    ('2000077', 0.715, 11700, 8366, 5),
    ('2000125', 1.435, 9677, 13886, 5),
    ('7840042002098', 1, 8200, 8200, 10),
    ('77917812', 2, 2500, 5000, 10),
    ('77917805', 2, 2500, 5000, 10),
    ('7802575212283', 1, 9400, 9400, 10),
    ('7898965490553', 1, 9777, 9777, 5),
    ('2000165', 0.695, 12177, 8463, 5),
    ('7840508012562', 1, 18600, 18600, 10),
    ('7840970000173', 1, 7900, 7900, 10),
    ('7840042000117', 1, 7800, 7800, 5),
    ('7840016410010', 1, 4500, 4500, 5),
    ('7898295300300', 1, 7500, 7500, 10),
    ('2000571', 0.872, 45777, 39918, 10),
    ('2000007', 2.032, 27977, 56849, 5),
    ('2000096', 0.980, 8977, 8797, 10),
    ('7840127000773', 1, 6900, 6900, 5)
]

REMITIDO_AT = datetime(2026, 10, 12, 14, 4, 26, tzinfo=tz_py)

async def register():
    async with async_session_factory() as db:
        print("=== PROCESANDO RECUPERACION DE VENTAS EXTRA CLUB ===")
        
        # Mapear productos por barcode
        res_p = await db.execute(text("SELECT codigo_barra, id, iva_tasa FROM products;"))
        p_map = {r[0]: (str(r[1]), float(r[2])) for r in res_p.fetchall()}

        # Calcular IVA de venta 1
        grav10_1, grav5_1, exenta_1 = 0, 0, 0
        for bc, cant, pu, tot, iva in ITEMS1:
            if iva == 10: grav10_1 += tot
            elif iva == 5: grav5_1 += tot
            else: exenta_1 += tot
        iva10_1 = round(grav10_1 / 11)
        iva5_1 = round(grav5_1 / 21)

        # Calcular IVA de venta 2
        grav10_2, grav5_2, exenta_2 = 0, 0, 0
        for bc, cant, pu, tot, iva in ITEMS2:
            if iva == 10: grav10_2 += tot
            elif iva == 5: grav5_2 += tot
            else: exenta_2 += tot
        iva10_2 = round(grav10_2 / 11)
        iva5_2 = round(grav5_2 / 21)

        print(f"Venta 1: Subtotal={SUBTOTAL1}, Total={TOTAL1}, Grav10={grav10_1}, IVA10={iva10_1}")
        print(f"Venta 2: Subtotal={SUBTOTAL2}, Total={TOTAL2}, Grav10={grav10_2}, IVA10={iva10_2}")

        # Insertar Sale 1
        await db.execute(text("""
            INSERT INTO sales (
                id, company_id, customer_id, user_id, session_id,
                numero, fecha, tipo_comprobante, condicion, moneda,
                subtotal, descuento_total, total, total_pagado, saldo,
                base_gravada_10, base_gravada_5, base_exenta, iva_10, iva_5,
                estado, created_at, updated_at
            ) VALUES (
                :id, :comp, :cust, :usr, :sess,
                :num, :fec, 'factura', 'credito', 'PYG',
                :sub, :desc, :tot, :tot, 0,
                :g10, :g5, :ex, :i10, :i5,
                'completada', :fec, NOW()
            );
        """), {
            "id": SALE1_ID, "comp": COMPANY_ID, "cust": CUSTOMER1_ID, "usr": USER1_ID, "sess": SESSION1_ID,
            "num": NUM1, "fec": FECHA1, "sub": SUBTOTAL1, "desc": DESC1, "tot": TOTAL1,
            "g10": grav10_1, "g5": grav5_1, "ex": exenta_1, "i10": iva10_1, "i5": iva5_1
        })

        for bc, cant, pu, tot, iva in ITEMS1:
            pid = p_map.get(bc)[0]
            await db.execute(text("""
                INSERT INTO sale_items (
                    id, sale_id, product_id, cantidad, precio_unitario, descuento_monto, total, iva_tasa, iva_monto, created_at
                ) VALUES (
                    gen_random_uuid(), :sid, :pid, :cant, :pu, 0, :tot, :iva, :im, :fec
                );
            """), {
                "sid": SALE1_ID, "pid": pid, "cant": cant, "pu": pu, "tot": tot, "iva": iva,
                "im": round(tot / 11) if iva == 10 else (round(tot / 21) if iva == 5 else 0), "fec": FECHA1
            })

        await db.execute(text("""
            INSERT INTO sale_payments (
                id, company_id, sale_id, forma_pago, monto, fecha, moneda, created_at
            ) VALUES (
                gen_random_uuid(), :comp, :sid, 'EXTRA_CLUB', :tot, :fec, 'PYG', :fec
            );
        """), {"comp": COMPANY_ID, "sid": SALE1_ID, "tot": TOTAL1, "fec": FECHA1})

        # Insertar Sale 2
        await db.execute(text("""
            INSERT INTO sales (
                id, company_id, customer_id, user_id, session_id,
                numero, fecha, tipo_comprobante, condicion, moneda,
                subtotal, descuento_total, total, total_pagado, saldo,
                base_gravada_10, base_gravada_5, base_exenta, iva_10, iva_5,
                estado, created_at, updated_at
            ) VALUES (
                :id, :comp, :cust, :usr, :sess,
                :num, :fec, 'factura', 'credito', 'PYG',
                :sub, :desc, :tot, :tot, 0,
                :g10, :g5, :ex, :i10, :i5,
                'completada', :fec, NOW()
            );
        """), {
            "id": SALE2_ID, "comp": COMPANY_ID, "cust": CUSTOMER2_ID, "usr": USER2_ID, "sess": SESSION2_ID,
            "num": NUM2, "fec": FECHA2, "sub": SUBTOTAL2, "desc": DESC2, "tot": TOTAL2,
            "g10": grav10_2, "g5": grav5_2, "ex": exenta_2, "i10": iva10_2, "i5": iva5_2
        })

        for bc, cant, pu, tot, iva in ITEMS2:
            pid = p_map.get(bc)[0]
            await db.execute(text("""
                INSERT INTO sale_items (
                    id, sale_id, product_id, cantidad, precio_unitario, descuento_monto, total, iva_tasa, iva_monto, created_at
                ) VALUES (
                    gen_random_uuid(), :sid, :pid, :cant, :pu, 0, :tot, :iva, :im, :fec
                );
            """), {
                "sid": SALE2_ID, "pid": pid, "cant": cant, "pu": pu, "tot": tot, "iva": iva,
                "im": round(tot / 11) if iva == 10 else (round(tot / 21) if iva == 5 else 0), "fec": FECHA2
            })

        await db.execute(text("""
            INSERT INTO sale_payments (
                id, company_id, sale_id, forma_pago, monto, fecha, moneda, created_at
            ) VALUES (
                gen_random_uuid(), :comp, :sid, 'EXTRA_CLUB', :tot, :fec, 'PYG', :fec
            );
        """), {"comp": COMPANY_ID, "sid": SALE2_ID, "tot": TOTAL2, "fec": FECHA2})

        # Insertar Accounts Receivable (Cuentas por Cobrar) vinculadas a la Remisión Corporativa de Papa Ivar
        await db.execute(text("""
            INSERT INTO accounts_receivable (
                id, company_id, customer_id, sale_id, numero_documento,
                fecha_emision, fecha_vencimiento, moneda, monto_original, saldo_pendiente,
                tipo, estado, corporate_remission_id, remitido_empresa_at, created_at, updated_at
            ) VALUES (
                gen_random_uuid(), :comp, :cust1, :sid1, :num1,
                :fec1, :venc1, 'PYG', :tot1, :tot1,
                'factura', 'REMITIDO_EMPRESA', :rem_id, :rem_at, NOW(), NOW()
            ), (
                gen_random_uuid(), :comp, :cust2, :sid2, :num2,
                :fec2, :venc2, 'PYG', :tot2, :tot2,
                'factura', 'REMITIDO_EMPRESA', :rem_id, :rem_at, NOW(), NOW()
            );
        """), {
            "comp": COMPANY_ID,
            "cust1": CUSTOMER1_ID, "sid1": SALE1_ID, "num1": NUM1, "fec1": FECHA1, "venc1": VENC1, "tot1": TOTAL1,
            "cust2": CUSTOMER2_ID, "sid2": SALE2_ID, "num2": NUM2, "fec2": FECHA2, "venc2": VENC2, "tot2": TOTAL2,
            "rem_id": REMISSION_ID, "rem_at": REMITIDO_AT
        })

        # Actualizar Remisión Corporativa REM-202609-021
        delta_monto = TOTAL1 + TOTAL2
        await db.execute(text("""
            UPDATE ar_corporate_remissions
            SET monto_total = monto_total + :delta,
                saldo_pendiente = saldo_pendiente + :delta,
                cantidad_documentos = cantidad_documentos + 2,
                updated_at = NOW()
            WHERE id = :rem_id;
        """), {"delta": delta_monto, "rem_id": REMISSION_ID})

        await db.commit()
        print(f"EXITO: Ambas ventas asentadas correctamente. Remision incrementada en Gs. {delta_monto:,}")

if __name__ == '__main__':
    asyncio.run(register())
