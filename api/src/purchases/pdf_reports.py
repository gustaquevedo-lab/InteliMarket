"""PDFs de Compras — Gasto por proveedor (con KPIs) y Varianza de precios.
Reutiliza el mismo encabezado/pie de pagina de integrated_finance/pdf_reports.py,
igual que ya hacen accounts_receivable, Bancos y Cuentas por Pagar."""

import io
from datetime import date
from decimal import Decimal
from typing import Optional

from reportlab.lib.units import mm
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_RIGHT
from reportlab.platypus import Paragraph, Spacer, Table, TableStyle

from api.src.integrated_finance.pdf_reports import (
    _base_doc, _company_header, _build, _fmt_gs,
    PRIMARY_COLOR, GRAY_LIGHT, GRAY_MEDIUM, GRAY_DARK, WHITE, RED,
    FONT_REGULAR, FONT_BOLD,
)

CELL_STYLE = ParagraphStyle("PurCell", fontName=FONT_REGULAR, fontSize=7.5, leading=9, textColor=GRAY_DARK)
CELL_STYLE_BOLD = ParagraphStyle("PurCellBold", fontName=FONT_BOLD, fontSize=7.5, leading=9, textColor=GRAY_DARK)
NUM_STYLE = ParagraphStyle("PurNum", fontName=FONT_REGULAR, fontSize=7.5, leading=9, textColor=GRAY_DARK, alignment=TA_RIGHT)
NUM_STYLE_BOLD = ParagraphStyle("PurNumBold", fontName=FONT_BOLD, fontSize=7.5, leading=9, textColor=GRAY_DARK, alignment=TA_RIGHT)
KPI_VALUE = ParagraphStyle("PurKpiValue", fontName=FONT_BOLD, fontSize=16, textColor=PRIMARY_COLOR, leading=19)
KPI_LABEL = ParagraphStyle("PurKpiLabel", fontName=FONT_REGULAR, fontSize=8, textColor=GRAY_MEDIUM, leading=10)


def _cell(text, bold: bool = False) -> Paragraph:
    return Paragraph(str(text) if text is not None else "—", CELL_STYLE_BOLD if bold else CELL_STYLE)


def _num(text, bold: bool = False, color=None) -> Paragraph:
    style = NUM_STYLE_BOLD if bold else NUM_STYLE
    if color:
        style = ParagraphStyle("PurNumColor", parent=style, textColor=color)
    return Paragraph(str(text) if text is not None else "—", style)


def _kpi_row(items: list[tuple[str, str]], col_width_mm: float) -> Table:
    cells = [[Paragraph(label, KPI_LABEL), Paragraph(value, KPI_VALUE)] for label, value in items]
    t = Table([cells], colWidths=[col_width_mm * mm] * len(items))
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), GRAY_LIGHT),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("LEFTPADDING", (0, 0), (0, 0), 10),
        ("LINEAFTER", (0, 0), (-2, 0), 0.5, WHITE),
    ]))
    return t


def _table_style(align_from: int = 1) -> TableStyle:
    return TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), PRIMARY_COLOR),
        ("TEXTCOLOR", (0, 0), (-1, 0), WHITE),
        ("FONTNAME", (0, 0), (-1, 0), FONT_BOLD),
        ("FONTSIZE", (0, 0), (-1, -1), 7.5),
        ("FONTNAME", (0, -1), (-1, -1), FONT_BOLD),
        ("LINEABOVE", (0, -1), (-1, -1), 0.75, GRAY_DARK),
        ("ALIGN", (align_from, 0), (-1, -1), "RIGHT"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("ROWBACKGROUNDS", (0, 1), (-1, -2), [WHITE, GRAY_LIGHT]),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("LINEBELOW", (0, 0), (-1, 0), 0.5, PRIMARY_COLOR),
    ])


# ── Gasto por Proveedor (con KPIs generales) ────────────────────────────────

def generate_spend_by_supplier_pdf(company: dict, kpis: dict, spend_rows: list[dict], generated_by: str = "") -> bytes:
    buffer = io.BytesIO()
    doc, styles = _base_doc(buffer, "Gasto por Proveedor - Compras", company, generated_by)
    elements = _company_header(company, styles, "Gasto por Proveedor", "Compras — Gasto por proveedor y KPIs generales", generated_by)

    kpi = _kpi_row([
        ("GASTO TOTAL", _fmt_gs(kpis.get("total_gastado", 0))),
        ("ORDENES DE COMPRA", str(kpis.get("total_pos", 0))),
        ("PROMEDIO POR ORDEN", _fmt_gs(kpis.get("prom_pedido", 0))),
        ("PROVEEDORES ACTIVOS", str(kpis.get("proveedores_activos", 0))),
    ], 45)
    elements.append(kpi)
    elements.append(Spacer(1, 4))
    elements.append(Paragraph(
        "KPIs calculados sobre ordenes de compra confirmadas, enviadas, parciales o completadas — no incluye borradores ni canceladas.",
        styles["Small"],
    ))
    elements.append(Spacer(1, 12))

    total_general = sum((r["total_gastado"] for r in spend_rows), Decimal("0"))
    header = ["Proveedor", "N° Ordenes", "Total Gastado", "% del total"]
    data = [header]
    for r in spend_rows:
        pct = (r["total_gastado"] / total_general * 100) if total_general > 0 else Decimal("0")
        data.append([
            _cell(r["razon_social"]),
            _num(r["cantidad_ordenes"]),
            _num(_fmt_gs(r["total_gastado"]), bold=True),
            _num(f"{pct:.1f}%"),
        ])
    data.append([
        _cell("TOTAL", bold=True), _cell(""),
        _num(_fmt_gs(total_general), bold=True), _num("100.0%", bold=True),
    ])

    t = Table(data, colWidths=[80 * mm, 28 * mm, 40 * mm, 28 * mm], repeatRows=1)
    t.setStyle(_table_style(1))
    elements.append(t)

    if not spend_rows:
        elements.append(Spacer(1, 10))
        elements.append(Paragraph("Sin ordenes de compra registradas.", styles["Small"]))

    _build(doc, elements)
    return buffer.getvalue()


# ── Varianza de Precios ──────────────────────────────────────────────────────

def generate_price_variance_pdf(company: dict, variance_rows: list[dict], generated_by: str = "") -> bytes:
    buffer = io.BytesIO()
    doc, styles = _base_doc(buffer, "Varianza de Precios - Compras", company, generated_by)
    elements = _company_header(company, styles, "Varianza de Precios", "Compras — Productos con mayor variacion de precio entre compras", generated_by)

    alto_riesgo = sum(1 for r in variance_rows if r["variance_pct"] >= 20)
    kpi = _kpi_row([
        ("PRODUCTOS ANALIZADOS", str(len(variance_rows))),
        ("VARIACION >= 20%", str(alto_riesgo)),
    ], 90)
    elements.append(kpi)
    elements.append(Spacer(1, 4))
    elements.append(Paragraph(
        "Solo incluye productos comprados mas de una vez. Una variacion alta puede indicar falta de negociacion "
        "consistente de precio con los proveedores, o un cambio real de mercado.",
        styles["Small"],
    ))
    elements.append(Spacer(1, 12))

    header = ["Producto", "Precio Prom.", "Precio Min.", "Precio Max.", "Var. %", "Ult. Proveedor"]
    data = [header]
    for r in variance_rows[:80]:
        var_pct = r["variance_pct"]
        data.append([
            _cell(r["nombre"]),
            _num(_fmt_gs(r["average_price"])),
            _num(_fmt_gs(r["min_price"])),
            _num(_fmt_gs(r["max_price"])),
            _num(f"{var_pct:.1f}%", bold=var_pct >= 20, color=RED if var_pct >= 20 else None),
            _cell(r.get("last_supplier") or "—"),
        ])

    t = Table(data, colWidths=[55 * mm, 26 * mm, 26 * mm, 26 * mm, 18 * mm, 39 * mm], repeatRows=1)
    t.setStyle(_table_style(1))
    elements.append(t)

    if not variance_rows:
        elements.append(Spacer(1, 10))
        elements.append(Paragraph("Sin datos suficientes (se necesita mas de una compra por producto).", styles["Small"]))
    elif len(variance_rows) > 80:
        elements.append(Spacer(1, 8))
        elements.append(Paragraph(f"Mostrando los primeros 80 de {len(variance_rows)} productos, ordenados por mayor variacion.", styles["Small"]))

    _build(doc, elements)
    return buffer.getvalue()
