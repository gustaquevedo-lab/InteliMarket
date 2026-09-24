import asyncio
import base64
from decimal import Decimal
from sqlalchemy import text
from api.src.db import async_session_factory

SALE_ID = "43ca4fa0-f8ca-4b4f-a175-341ad97f13f9"
SESSION_ID = "c64d4688-9c20-45a6-8d45-97a4b6fcca7e"

def format_gs(val):
    return f"{int(val):,}".replace(",", ".")

def pad_two_col(left, right, width=42):
    left = str(left)
    right = str(right)
    spaces = max(1, width - len(left) - len(right))
    return left + (" " * spaces) + right

def dashes(width=42):
    return "-" * width

async def set_jorge_sale_to_extraclub():
    async with async_session_factory() as db:
        print("=== ACTUALIZANDO FACTURA 146 A EXTRA CLUB (CREDITO) ===")

        # 1. Actualizar venta
        await db.execute(text("""
            UPDATE sales
            SET condicion = 'CREDITO',
                updated_at = NOW()
            WHERE id = :sid;
        """), {"sid": SALE_ID})

        # 2. Actualizar forma de pago a EXTRA_CLUB
        await db.execute(text("""
            UPDATE sale_payments
            SET forma_pago = 'EXTRA_CLUB',
                monto = 346641.00,
                moneda = 'PYG'
            WHERE sale_id = :sid;
        """), {"sid": SALE_ID})

        # 3. Regenerar ticket con condicion CREDITO y forma de pago EXTRA_CLUB
        res_s = await db.execute(text("""
            SELECT s.numero, s.numero_interno, s.fecha, s.total, s.descuento_total,
                   c.razon_social, c.ruc, c.ci, c.empresa_vinculada_nombre
            FROM sales s
            LEFT JOIN customers c ON s.customer_id = c.id
            WHERE s.id = :sid;
        """), {"sid": SALE_ID})
        sale = res_s.fetchone()

        res_items = await db.execute(text("""
            SELECT si.cantidad, si.precio_unitario, si.total, p.nombre, p.codigo_barra, p.sku
            FROM sale_items si
            JOIN products p ON si.product_id = p.id
            WHERE si.sale_id = :sid
            ORDER BY si.id ASC;
        """), {"sid": SALE_ID})
        items = res_items.fetchall()

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
        lines.append(f"FACTURA CREDITO No: {sale[0]}")
        lines.append(f"No Venta: {sale[1]}")
        lines.append(f"Fecha/Hora: {sale[2].strftime('%d/%m/%Y %H:%M') if sale[2] else '31/08/2026'}")
        lines.append("Condicion: CREDITO")
        lines.append("Cajero: ZUNILDA RODRIGUEZ (001-015)")
        lines.append(f"Cliente: {sale[5]}")
        lines.append(f"RUC/CI: {sale[6] or sale[7]}")
        if sale[8]:
            lines.append(f"Empresa: {sale[8].strip()}")
        lines.append(dashes(W))
        lines.append(pad_two_col("DESCRIPCION / DETALLE", "TOTAL (GS)", W))
        lines.append(dashes(W))

        for it in items:
            cant, pu, tot, nom, bc, sku = it
            cant_str = f"{cant:.3f} KG" if "." in str(cant) and cant % 1 != 0 else f"{int(cant)} UN"
            lines.append(nom[:W])
            lines.append(pad_two_col(f"  {cant_str} x {format_gs(pu)} [{bc or sku}]", format_gs(tot), W))

        lines.append(dashes(W))
        lines.append(pad_two_col("TOTAL A PAGAR:", f"GS. {format_gs(sale[3])}", W))
        if sale[4] and sale[4] > 0:
            lines.append(pad_two_col("AHORRO TOTAL PROMOS:", f"-GS. {format_gs(sale[4])}", W))
        lines.append(dashes(W))
        lines.append("Medios de Pago Utilizados:")
        lines.append(pad_two_col("EXTRA CLUB:", f"GS. {format_gs(sale[3])}", W))
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
        print("Factura 146 actualizada a EXTRA CLUB exitosamente.")

asyncio.run(set_jorge_sale_to_extraclub())
