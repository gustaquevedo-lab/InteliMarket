import asyncio
import base64
from decimal import Decimal
from sqlalchemy import text
from api.src.db import async_session_factory

SALE_ID = "603e16c0-be07-4b97-90fc-52ededc39d43"
INVOICE_NO = "001-013-0033644"

def format_gs(val):
    return f"{int(val):,}".replace(",", ".")

def pad_two_col(left, right, width=42):
    left = str(left)
    right = str(right)
    spaces = max(1, width - len(left) - len(right))
    return left + (" " * spaces) + right

def dashes(width=42):
    return "-" * width

async def fix_sale_33644():
    async with async_session_factory() as db:
        print(f"=== CORRIGIENDO FACTURA {INVOICE_NO} ===")

        # 1. Actualizar los 3 items con precio de escala y promo
        # - TODDY ACHOC POLVO PT 200G (24): pu = 7777, tot = 46662
        # - COCA COLA PET 250ML (6): pu = 2817, tot = 16902
        # - COCA COLA ZERO PET 250ML (6): pu = 2750, tot = 16500

        res_items = await db.execute(text("""
            SELECT si.id, p.codigo_barra, p.sku, p.nombre, si.cantidad, si.precio_unitario, si.total
            FROM sale_items si
            JOIN products p ON si.product_id = p.id
            WHERE si.sale_id = :sid;
        """), {"sid": SALE_ID})
        items = res_items.fetchall()

        total_corregido = Decimal("0")
        subtotal_base = Decimal("0")

        for it in items:
            iid, bc, sku, nom, cant, pu, tot = it
            pu_corr = pu

            if bc == '7894321711171' or 'TODDY' in nom:
                pu_corr = Decimal('7777.00')
            elif bc == '7840058001887' or ('COCA COLA' in nom and 'ZERO' not in nom):
                pu_corr = Decimal('2817.00')
            elif bc == '7840058002556' or ('COCA COLA ZERO' in nom):
                pu_corr = Decimal('2750.00')

            tot_corr = (pu_corr * cant).quantize(Decimal('1'))
            subtotal_base += (pu * cant).quantize(Decimal('1'))
            total_corregido += tot_corr

            if pu_corr != pu:
                await db.execute(text("""
                    UPDATE sale_items 
                    SET precio_unitario = :pu, total = :tot
                    WHERE id = :iid;
                """), {"pu": pu_corr, "tot": tot_corr, "iid": iid})
                print(f"Item corregido: {nom} -> PU: {pu_corr} | Tot: {tot_corr}")

        descuento_total = subtotal_base - total_corregido

        # 2. Actualizar cabecera en sales
        await db.execute(text("""
            UPDATE sales 
            SET subtotal = :sub,
                descuento_total = :desc,
                total = :tot,
                total_pagado = :tot,
                observaciones = COALESCE(observaciones, '') || ' [Corregido con precios de escala mayorista/promo para cuadre de cierre de caja]',
                updated_at = NOW()
            WHERE id = :sid;
        """), {
            "sub": subtotal_base,
            "desc": descuento_total,
            "tot": total_corregido,
            "sid": SALE_ID
        })

        # 3. Actualizar monto en sale_payments
        await db.execute(text("""
            UPDATE sale_payments 
            SET monto = :tot
            WHERE sale_id = :sid;
        """), {"tot": total_corregido, "sid": SALE_ID})

        # 4. Regenerar ticket ESC/POS
        W = 42
        lines = []
        lines.append("EXTRA SUPERMERCADO MAYORISTA")
        lines.append("GRUPO SANTA TERESA E.A.S.")
        lines.append("RUC: 80150377-9")
        lines.append("Avda. San Blas e/ Avda. Monseñor Rodriguez")
        lines.append("Ciudad del Este - Paraguay")
        lines.append("Tel: 0983 500 000")
        lines.append("Timbrado No: 18545636 - Valido hasta: 31/12/2026")
        lines.append(dashes(W))
        lines.append(f"FACTURA CONTADO No: {INVOICE_NO}")
        lines.append("No Venta: 36")
        lines.append("Fecha/Hora: 31/08/2026 23:15")
        lines.append("Condicion: CONTADO")
        lines.append("Cajero: EVELIN HERRERO (001-013)")
        lines.append("Cliente: CONSUMIDOR FINAL")
        lines.append("RUC/CI: 44444401-7")
        lines.append(dashes(W))
        lines.append(pad_two_col("DESCRIPCION / DETALLE", "TOTAL (GS)", W))
        lines.append(dashes(W))

        # Re-consultar items actualizados para el ticket
        res_items_updated = await db.execute(text("""
            SELECT si.cantidad, si.precio_unitario, si.total, p.nombre, p.codigo_barra, p.sku
            FROM sale_items si
            JOIN products p ON si.product_id = p.id
            WHERE si.sale_id = :sid
            ORDER BY si.id ASC;
        """), {"sid": SALE_ID})
        for it in res_items_updated.fetchall():
            cant, pu, tot, nom, bc, sku = it
            cant_str = f"{cant:.3f} KG" if "." in str(cant) and cant % 1 != 0 else f"{int(cant)} UN"
            lines.append(nom[:W])
            lines.append(pad_two_col(f"  {cant_str} x {format_gs(pu)} [{bc or sku}]", format_gs(tot), W))

        lines.append(dashes(W))
        lines.append(pad_two_col("TOTAL A PAGAR:", f"GS. {format_gs(total_corregido)}", W))
        if descuento_total > 0:
            lines.append(pad_two_col("AHORRO TOTAL ESCALAS:", f"-GS. {format_gs(descuento_total)}", W))
        lines.append(dashes(W))
        lines.append("Medios de Pago Utilizados:")
        lines.append(pad_two_col("EFECTIVO:", f"GS. {format_gs(total_corregido)}", W))
        lines.append(dashes(W))
        lines.append("       GRACIAS POR SU PREFERENCIA       ")
        lines.append("       EXTRA SUPERMERCADO MAYORISTA      ")
        lines.append("\n\n\n\n")

        raw_text = "\n".join(lines)
        b64_ticket = base64.b64encode(raw_text.encode("utf-8")).decode("utf-8")

        await db.execute(text("""
            UPDATE sales 
            SET recibo_escpos_b64 = :b64,
                recibo_html = :raw,
                updated_at = NOW()
            WHERE id = :sid;
        """), {"b64": b64_ticket, "raw": raw_text, "sid": SALE_ID})

        await db.commit()
        print("\n=== CORRECCION Y REGENERACION COMPLETADA ===")
        print(f"- Total Anterior: 503.684 Gs")
        print(f"- Total Corregido: {total_corregido:,.0f} Gs")
        print(f"- Descuento de Escala / Promo: {descuento_total:,.0f} Gs")
        print(f"- Pago en Efectivo Ajustado a: {total_corregido:,.0f} Gs")

asyncio.run(fix_sale_33644())
