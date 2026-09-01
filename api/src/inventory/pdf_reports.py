"""Reporte PDF del Kardex de Inventario -- reusa los helpers visuales
compartidos de integrated_finance.pdf_reports (mismo estilo que Bancos,
Caja, AP y AR) en vez de reimplementar estilos de tabla."""
import io
from datetime import date

from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, Spacer, Table, TableStyle

from api.src.integrated_finance.pdf_reports import (
    _base_doc, _company_header, _fmt_gs, _build, _totals_table,
    RED, GREEN, GRAY_LIGHT, PRIMARY_COLOR, WHITE, FONT_BOLD,
)


def generate_kardex_pdf(company: dict, movements: list[dict], fecha_desde: date | None, fecha_hasta: date | None, generated_by: str = "") -> bytes:
    buffer = io.BytesIO()
    doc, styles = _base_doc(buffer, "Libro Kardex", company, generated_by)
    periodo = (
        f"Del {fecha_desde.strftime('%d/%m/%Y')} al {fecha_hasta.strftime('%d/%m/%Y')}"
        if fecha_desde and fecha_hasta else "Últimos movimientos registrados"
    )
    elements = _company_header(company, styles, "Libro Kardex & Trazabilidad de Inventario", periodo, generated_by)

    if not movements:
        elements.append(Paragraph("Sin movimientos registrados en el período seleccionado.", styles["Small"]))
        _build(doc, elements)
        return buffer.getvalue()

    total_entradas = sum(float(m.get("cantidad") or 0) for m in movements if float(m.get("cantidad") or 0) > 0)
    total_salidas = sum(float(m.get("cantidad") or 0) for m in movements if float(m.get("cantidad") or 0) < 0)
    productos_distintos = len({m.get("product_id") for m in movements})

    resumen_rows = [
        ("Movimientos en el período", str(len(movements)), False),
        ("Productos con movimiento", str(productos_distintos), False),
        ("Total entradas", f"+{total_entradas:,.0f}".replace(",", "."), False),
        ("Total salidas", f"{total_salidas:,.0f}".replace(",", "."), True),
        ("Neto del período", f"{(total_entradas + total_salidas):,.0f}".replace(",", "."), False),
    ]
    elements.append(_totals_table(resumen_rows))
    elements.append(Spacer(1, 10))

    header = ["Fecha", "Tipo", "Producto", "Depósito", "Cant.", "Saldo", "Usuario", "Motivo"]
    data = [header]
    for m in movements:
        cantidad = float(m.get("cantidad") or 0)
        data.append([
            m["created_at"].strftime("%d/%m %H:%M") if hasattr(m.get("created_at"), "strftime") else str(m.get("created_at") or ""),
            (m.get("tipo") or "").replace("_", " ").upper()[:16],
            (m.get("product_nombre") or "Producto")[:28],
            (m.get("warehouse_nombre") or "Depósito Central")[:16],
            f"{'+' if cantidad >= 0 else ''}{cantidad:,.0f}".replace(",", "."),
            f"{float(m.get('saldo_acumulado') or 0):,.0f}".replace(",", "."),
            (m.get("user_nombre") or "—")[:16],
            (m.get("motivo") or "Movimiento operativo")[:24],
        ])

    t = Table(data, colWidths=[18 * mm, 22 * mm, 34 * mm, 20 * mm, 14 * mm, 16 * mm, 20 * mm, 30 * mm], repeatRows=1)
    style_cmds = [
        ("BACKGROUND", (0, 0), (-1, 0), PRIMARY_COLOR),
        ("TEXTCOLOR", (0, 0), (-1, 0), WHITE),
        ("FONTNAME", (0, 0), (-1, 0), FONT_BOLD),
        ("FONTSIZE", (0, 0), (-1, -1), 6.5),
        ("ALIGN", (4, 0), (5, -1), "RIGHT"),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [WHITE, GRAY_LIGHT]),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
    ]
    for i, m in enumerate(movements, start=1):
        cantidad = float(m.get("cantidad") or 0)
        style_cmds.append(("TEXTCOLOR", (4, i), (4, i), GREEN if cantidad >= 0 else RED))
    t.setStyle(TableStyle(style_cmds))
    elements.append(t)

    _build(doc, elements)
    return buffer.getvalue()
