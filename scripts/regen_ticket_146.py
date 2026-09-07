import asyncio
import base64
from decimal import Decimal
from sqlalchemy import text
from api.src.db import async_session_factory

SALE_ID = "43ca4fa0-f8ca-4b4f-a175-341ad97f13f9"

def format_gs(val):
    return f"{int(val):,}".replace(",", ".")

def pad_two_col(left, right, width=42):
    left = str(left)
    right = str(right)
    spaces = max(1, width - len(left) - len(right))
    return left + (" " * spaces) + right

def dashes(width=42):
    return "-" * width

async def generate_and_attach_escpos_ticket():
    async with async_session_factory() as db:
        # Cargar venta y cliente
        res_s = await db.execute(text("""
            SELECT s.id, s.numero, s.numero_interno, s.fecha, s.total, s.subtotal, s.descuento_total, s.condicion,
                   c.razon_social, c.ruc, c.ci, c.empresa_vinculada_nombre
            FROM sales s
            LEFT JOIN customers c ON s.customer_id = c.id
            WHERE s.id = :sid;
        """), {"sid": SALE_ID})
        sale = res_s.fetchone()
        
        # Cargar items
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
        
        # Header
        lines.append("EXTRA SUPERMERCADO MAYORISTA")
        lines.append("GRUPO SANTA TERESA E.A.S.")
        lines.append("RUC: 80150377-9")
        lines.append("Avda. San Blas e/ Avda. Monseñor Rodriguez")
        lines.append("Ciudad del Este - Paraguay")
        lines.append("Tel: 0983 500 000")
        lines.append("Timbrado No: 18545636 - Valido hasta: 31/12/2026")
        lines.append(dashes(W))
        lines.append(f"FACTURA CONTADO No: {sale[1]}")
        lines.append(f"No Venta: {sale[2]}")
        lines.append(f"Fecha/Hora: {sale[3].strftime('%d/%m/%Y %H:%M') if sale[3] else '31/08/2026'}")
        lines.append(f"Condicion: {sale[7].upper()}")
        lines.append("Cajero: ZUNILDA RODRIGUEZ (001-015)")
        lines.append(f"Cliente: {sale[8]}")
        lines.append(f"RUC/CI: {sale[9] or sale[10]}")
        if sale[11]:
            lines.append(f"Empresa: {sale[11].strip()}")
        lines.append(dashes(W))
        lines.append(pad_two_col("DESCRIPCION / DETALLE", "TOTAL (GS)", W))
        lines.append(dashes(W))

        # Items
        for it in items:
            cant, pu, tot, nom, bc, sku = it
            cant_str = f"{cant:.3f} KG" if "." in str(cant) and cant % 1 != 0 else f"{int(cant)} UN"
            lines.append(nom[:W])
            lines.append(pad_two_col(f"  {cant_str} x {format_gs(pu)} [{bc or sku}]", format_gs(tot), W))

        lines.append(dashes(W))
        lines.append(pad_two_col("TOTAL A PAGAR:", f"GS. {format_gs(sale[4])}", W))
        if sale[6] and sale[6] > 0:
            lines.append(pad_two_col("AHORRO TOTAL PROMOS:", f"-GS. {format_gs(sale[6])}", W))
        lines.append(dashes(W))
        lines.append("Medios de Pago Utilizados:")
        lines.append(pad_two_col("EFECTIVO:", f"GS. {format_gs(sale[4])}", W))
        lines.append(dashes(W))
        lines.append("       GRACIAS POR SU PREFERENCIA       ")
        lines.append("       EXTRA SUPERMERCADO MAYORISTA      ")
        lines.append("\n\n\n\n")

        raw_text = "\n".join(lines)
        b64_ticket = base64.b64encode(raw_text.encode("utf-8")).decode("utf-8")

        # Guardar en sales
        await db.execute(text("""
            UPDATE sales 
            SET recibo_escpos_b64 = :b64,
                recibo_html = :raw,
                updated_at = NOW()
            WHERE id = :sid;
        """), {"b64": b64_ticket, "raw": raw_text, "sid": SALE_ID})
        await db.commit()

        print("=== TICKET REGENERADO Y GUARDADO EN LA BASE DE DATOS ===")
        print(raw_text)

asyncio.run(generate_and_attach_escpos_ticket())
