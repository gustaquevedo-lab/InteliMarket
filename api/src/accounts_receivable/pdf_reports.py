"""PDFs de Cuentas por Cobrar — Aging y Cobranzas del período. Reutiliza el
mismo encabezado/pie de pagina ya establecido en integrated_finance/pdf_reports.py
(logo, RUC, paginacion real, auditoria de quien/cuando se genero) en vez de
inventar un segundo estilo de reporte."""

import io
from datetime import date
from decimal import Decimal
from typing import Optional

from reportlab.lib.units import mm
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_RIGHT
from reportlab.platypus import Paragraph, Spacer, Table, TableStyle, HRFlowable

from api.src.integrated_finance.pdf_reports import (
    _base_doc, _company_header, _build, _fmt_gs,
    PRIMARY_COLOR, GRAY_LIGHT, GRAY_MEDIUM, GRAY_DARK, WHITE, RED, GREEN,
    FONT_REGULAR, FONT_BOLD,
)

# Todas las celdas de datos se envuelven en Paragraph (nunca strings sueltos):
# un string suelto en una Table de reportlab no hace wrap si es mas ancho que
# su columna -- se dibuja igual y se solapa con la celda vecina. Un Paragraph
# SIEMPRE ajusta el texto dentro del ancho asignado, pasando a una segunda
# linea si hace falta -- por eso es la unica forma robusta de garantizar que
# un monto grande nunca invada la columna de al lado.
CELL_STYLE = ParagraphStyle("Cell", fontName=FONT_REGULAR, fontSize=7.5, leading=9, textColor=GRAY_DARK)
CELL_STYLE_BOLD = ParagraphStyle("CellBold", fontName=FONT_BOLD, fontSize=7.5, leading=9, textColor=GRAY_DARK)
NUM_STYLE = ParagraphStyle("Num", fontName=FONT_REGULAR, fontSize=7.5, leading=9, textColor=GRAY_DARK, alignment=TA_RIGHT)
NUM_STYLE_BOLD = ParagraphStyle("NumBold", fontName=FONT_BOLD, fontSize=7.5, leading=9, textColor=GRAY_DARK, alignment=TA_RIGHT)


def _cell(text, bold: bool = False) -> Paragraph:
    return Paragraph(str(text) if text is not None else "—", CELL_STYLE_BOLD if bold else CELL_STYLE)


def _num(text, bold: bool = False, color=None) -> Paragraph:
    style = NUM_STYLE_BOLD if bold else NUM_STYLE
    if color:
        style = ParagraphStyle("NumColor", parent=style, textColor=color)
    return Paragraph(str(text) if text is not None else "—", style)


def _periodo_str(fecha_desde: Optional[date], fecha_hasta: Optional[date]) -> str:
    if not fecha_desde and not fecha_hasta:
        return "Todos los períodos"
    d = fecha_desde.strftime("%d/%m/%Y") if fecha_desde else "Inicio"
    h = fecha_hasta.strftime("%d/%m/%Y") if fecha_hasta else "Actual"
    return f"Período: {d} — {h}"


def _table_style(n_cols: int, align_from: int = 1) -> TableStyle:
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


def generate_aging_report_pdf(company: dict, aging: dict, fecha_desde: Optional[date], fecha_hasta: Optional[date], generated_by: str = "") -> bytes:
    buffer = io.BytesIO()
    doc, styles = _base_doc(buffer, "Antigüedad de Saldos", company, generated_by)
    elements = _company_header(company, styles, "Antigüedad de Saldos (Aging)", f"Antigüedad de Saldos — {_periodo_str(fecha_desde, fecha_hasta)}", generated_by)

    kpi_style = ParagraphStyle("KpiValue", fontName=FONT_BOLD, fontSize=16, textColor=PRIMARY_COLOR, leading=19)
    kpi_label = ParagraphStyle("KpiLabel", fontName=FONT_REGULAR, fontSize=8, textColor=GRAY_MEDIUM, leading=10)
    kpi_table = Table(
        [[
            [Paragraph("SALDO TOTAL PENDIENTE", kpi_label), Paragraph(_fmt_gs(aging.get("total_pendiente", 0)), kpi_style)],
            [Paragraph("DOCUMENTOS", kpi_label), Paragraph(str(aging.get("cantidad_documentos", 0)), kpi_style)],
            [Paragraph("CLIENTES CON SALDO", kpi_label), Paragraph(str(len(aging.get("por_clientes", []))), kpi_style)],
        ]],
        colWidths=[60 * mm, 60 * mm, 60 * mm],
    )
    kpi_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), GRAY_LIGHT),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("LEFTPADDING", (0, 0), (0, 0), 10),
        ("LINEAFTER", (0, 0), (-2, 0), 0.5, WHITE),
    ]))
    elements.append(kpi_table)
    elements.append(Spacer(1, 12))

    bucket_header = ["Al día", "1-30 días", "31-60 días", "61-90 días", "+90 días"]
    bucket_row = [
        _fmt_gs(aging.get("current", 0)), _fmt_gs(aging.get("days_1_30", 0)), _fmt_gs(aging.get("days_31_60", 0)),
        _fmt_gs(aging.get("days_61_90", 0)), _fmt_gs(aging.get("days_91_plus", 0)),
    ]
    bt = Table([bucket_header, bucket_row], colWidths=[36 * mm] * 5)
    bt.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), PRIMARY_COLOR),
        ("TEXTCOLOR", (0, 0), (-1, 0), WHITE),
        ("FONTNAME", (0, 0), (-1, 0), FONT_BOLD),
        ("FONTNAME", (0, 1), (-1, 1), FONT_BOLD),
        ("TEXTCOLOR", (4, 1), (4, 1), RED if float(aging.get("days_91_plus", 0)) > 0 else GRAY_DARK),
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("LINEBELOW", (0, 0), (-1, 0), 0.5, WHITE),
        ("ROWBACKGROUNDS", (0, 1), (-1, 1), [GRAY_LIGHT]),
    ]))
    elements.append(bt)
    elements.append(Spacer(1, 14))

    elements.append(Paragraph("Desglose por cliente", styles["SectionTitle"]))
    elements.append(Spacer(1, 2))
    header = ["Cliente", "Docs", "Al día", "1-30", "31-60", "61-90", "+90", "Saldo Total"]
    data = [header]
    for c in aging.get("por_clientes", []):
        data.append([
            _cell(c["customer_name"]), _num(c["total_documentos"]),
            _num(_fmt_gs(c["current"])), _num(_fmt_gs(c["days_1_30"])), _num(_fmt_gs(c["days_31_60"])),
            _num(_fmt_gs(c["days_61_90"])), _num(_fmt_gs(c["days_91_plus"])), _num(_fmt_gs(c["saldo_total"]), bold=True),
        ])
    data.append([
        _cell("TOTAL", bold=True), _num(aging.get("cantidad_documentos", 0), bold=True), _num(_fmt_gs(aging.get("current", 0)), bold=True),
        _num(_fmt_gs(aging.get("days_1_30", 0)), bold=True), _num(_fmt_gs(aging.get("days_31_60", 0)), bold=True), _num(_fmt_gs(aging.get("days_61_90", 0)), bold=True),
        _num(_fmt_gs(aging.get("days_91_plus", 0)), bold=True), _num(_fmt_gs(aging.get("total_pendiente", 0)), bold=True),
    ])

    t = Table(data, colWidths=[44 * mm, 10 * mm, 20 * mm, 20 * mm, 20 * mm, 20 * mm, 20 * mm, 26 * mm], repeatRows=1)
    t.setStyle(_table_style(8))
    elements.append(t)

    _build(doc, elements)
    return buffer.getvalue()


def generate_cobranzas_report_pdf(company: dict, payments: list[dict], fecha_desde: Optional[date], fecha_hasta: Optional[date], generated_by: str = "") -> bytes:
    buffer = io.BytesIO()
    doc, styles = _base_doc(buffer, "Cobranzas del período", company, generated_by)
    elements = _company_header(company, styles, "Cobranzas del Período", f"Cobranzas — {_periodo_str(fecha_desde, fecha_hasta)}", generated_by)

    total = sum((Decimal(str(p["monto_total"])) for p in payments), Decimal("0"))
    kpi_style = ParagraphStyle("KpiValue", fontName=FONT_BOLD, fontSize=16, textColor=PRIMARY_COLOR, leading=19)
    kpi_label = ParagraphStyle("KpiLabel", fontName=FONT_REGULAR, fontSize=8, textColor=GRAY_MEDIUM, leading=10)
    kpi_table = Table(
        [[
            [Paragraph("TOTAL COBRADO", kpi_label), Paragraph(_fmt_gs(total), kpi_style)],
            [Paragraph("PAGOS REGISTRADOS", kpi_label), Paragraph(str(len(payments)), kpi_style)],
        ]],
        colWidths=[90 * mm, 90 * mm],
    )
    kpi_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), GRAY_LIGHT),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("LEFTPADDING", (0, 0), (0, 0), 10),
        ("LINEAFTER", (0, 0), (-2, 0), 0.5, WHITE),
    ]))
    elements.append(kpi_table)
    elements.append(Spacer(1, 12))

    header = ["Fecha", "Cliente", "Forma de pago", "Referencia", "Facturas cubiertas", "Monto"]
    data = [header]
    for p in payments:
        fecha = p["fecha"].strftime("%d/%m/%Y") if hasattr(p["fecha"], "strftime") else str(p["fecha"])
        docs = ", ".join((a.get("numero_documento") or "") for a in p.get("allocations", []))
        data.append([
            _cell(fecha), _cell(p.get("customer_name") or "—"), _cell(p.get("forma_pago") or "—"),
            _cell(p.get("referencia") or "—"), _cell(docs or "—"), _num(_fmt_gs(p["monto_total"]), bold=True),
        ])
    data.append([_cell(""), _cell("TOTAL", bold=True), _cell(""), _cell(""), _cell(""), _num(_fmt_gs(total), bold=True)])

    t = Table(data, colWidths=[20 * mm, 34 * mm, 24 * mm, 28 * mm, 44 * mm, 30 * mm], repeatRows=1)
    t.setStyle(_table_style(5))
    elements.append(t)

    if not payments:
        elements.append(Spacer(1, 10))
        elements.append(Paragraph("Sin cobros registrados en este período.", styles["Small"]))

    _build(doc, elements)
    return buffer.getvalue()
