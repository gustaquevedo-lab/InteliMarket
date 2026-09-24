"""PDFs del módulo Bancos — Conciliación bancaria y Posición de Caja
Consolidada (Bancos Fase 7). Reutiliza el mismo encabezado/pie de página
de integrated_finance/pdf_reports.py (logo, RUC, paginación real, auditoría
de quién/cuándo se generó), igual que ya hace accounts_receivable."""

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
    PRIMARY_COLOR, GRAY_LIGHT, GRAY_MEDIUM, GRAY_DARK, WHITE, RED, GREEN,
    FONT_REGULAR, FONT_BOLD,
)

CELL_STYLE = ParagraphStyle("BancosCell", fontName=FONT_REGULAR, fontSize=7.5, leading=9, textColor=GRAY_DARK)
CELL_STYLE_BOLD = ParagraphStyle("BancosCellBold", fontName=FONT_BOLD, fontSize=7.5, leading=9, textColor=GRAY_DARK)
NUM_STYLE = ParagraphStyle("BancosNum", fontName=FONT_REGULAR, fontSize=7.5, leading=9, textColor=GRAY_DARK, alignment=TA_RIGHT)
NUM_STYLE_BOLD = ParagraphStyle("BancosNumBold", fontName=FONT_BOLD, fontSize=7.5, leading=9, textColor=GRAY_DARK, alignment=TA_RIGHT)
KPI_VALUE = ParagraphStyle("BancosKpiValue", fontName=FONT_BOLD, fontSize=16, textColor=PRIMARY_COLOR, leading=19)
KPI_LABEL = ParagraphStyle("BancosKpiLabel", fontName=FONT_REGULAR, fontSize=8, textColor=GRAY_MEDIUM, leading=10)


def _cell(text, bold: bool = False) -> Paragraph:
    return Paragraph(str(text) if text is not None else "—", CELL_STYLE_BOLD if bold else CELL_STYLE)


def _num(text, bold: bool = False, color=None) -> Paragraph:
    style = NUM_STYLE_BOLD if bold else NUM_STYLE
    if color:
        style = ParagraphStyle("BancosNumColor", parent=style, textColor=color)
    return Paragraph(str(text) if text is not None else "—", style)


def _periodo_str(fecha_desde: Optional[date], fecha_hasta: Optional[date]) -> str:
    if not fecha_desde and not fecha_hasta:
        return "Todos los períodos"
    d = fecha_desde.strftime("%d/%m/%Y") if fecha_desde else "Inicio"
    h = fecha_hasta.strftime("%d/%m/%Y") if fecha_hasta else "Actual"
    return f"Período: {d} — {h}"


def _table_style_cmds(align_from: int = 1) -> list:
    return [
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
    ]


def _table_style(align_from: int = 1) -> TableStyle:
    return TableStyle(_table_style_cmds(align_from))


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


# ── Conciliación bancaria por cuenta ────────────────────────────────────────

def generate_reconciliation_pdf(company: dict, account, reporte: dict, fecha_desde: Optional[date], fecha_hasta: Optional[date], generated_by: str = "") -> bytes:
    buffer = io.BytesIO()
    doc, styles = _base_doc(buffer, "Conciliación Bancaria", company, generated_by)
    subtitle = f"Conciliación Bancaria — {account.banco} N° {account.numero_cuenta} — {_periodo_str(fecha_desde, fecha_hasta)}"
    elements = _company_header(company, styles, "Conciliación Bancaria", subtitle, generated_by)

    total_pendiente = reporte["monto_pendiente"]
    kpi = _kpi_row([
        ("SALDO ACTUAL DE LA CUENTA", _fmt_gs(account.saldo_actual)),
        ("MOVIMIENTOS CONCILIADOS", str(reporte["cantidad_conciliados"])),
        ("MOVIMIENTOS PENDIENTES", str(reporte["cantidad_pendientes"])),
        ("MONTO PENDIENTE DE CONCILIAR", _fmt_gs(total_pendiente)),
    ], 45)
    elements.append(kpi)
    elements.append(Spacer(1, 12))

    header = ["Fecha", "Descripción", "Referencia", "Débito", "Crédito", "Estado"]
    data = [header]
    for m in reporte["movimientos"]:
        data.append([
            _cell(m.fecha.strftime("%d/%m/%Y")),
            _cell(m.descripcion or "—"),
            _cell(m.referencia or "—"),
            _num(_fmt_gs(m.monto) if m.tipo == "debito" else "—"),
            _num(_fmt_gs(m.monto) if m.tipo == "credito" else "—"),
            _cell("Conciliado" if m.conciliado else "Pendiente", bold=not m.conciliado),
        ])
    data.append([
        _cell("TOTAL", bold=True), _cell(""), _cell(""),
        _num(_fmt_gs(reporte["total_debitos"]), bold=True), _num(_fmt_gs(reporte["total_creditos"]), bold=True), _cell(""),
    ])

    t = Table(data, colWidths=[22 * mm, 56 * mm, 26 * mm, 26 * mm, 26 * mm, 24 * mm], repeatRows=1)
    cmds = _table_style_cmds(3)
    for i, m in enumerate(reporte["movimientos"], start=1):
        if not m.conciliado:
            cmds.append(("TEXTCOLOR", (5, i), (5, i), RED))
    t.setStyle(TableStyle(cmds))
    elements.append(t)

    if not reporte["movimientos"]:
        elements.append(Spacer(1, 10))
        elements.append(Paragraph("Sin movimientos en este período.", styles["Small"]))

    _build(doc, elements)
    return buffer.getvalue()


# ── Posición de Caja Consolidada ────────────────────────────────────────────

def generate_cash_position_pdf(company: dict, cash_position: dict, generated_by: str = "") -> bytes:
    buffer = io.BytesIO()
    doc, styles = _base_doc(buffer, "Posición de Caja Consolidada", company, generated_by)
    elements = _company_header(company, styles, "Posición de Caja Consolidada", "Posición de Caja Consolidada", generated_by)

    por_moneda_str = "  ·  ".join(f"{_fmt_gs(v) if m == 'PYG' else f'{float(v):,.2f} {m}'}" for m, v in (cash_position.get("por_moneda") or {}).items())
    kpi = _kpi_row([
        ("TOTAL CONSOLIDADO (Gs. equiv.)", _fmt_gs(cash_position.get("total_pyg_equivalente", 0))),
        ("CUENTAS ACTIVAS", str(len(cash_position.get("cuentas", [])))),
    ], 90)
    elements.append(kpi)
    if por_moneda_str:
        elements.append(Spacer(1, 4))
        elements.append(Paragraph(f"Por moneda: {por_moneda_str}", styles["Small"]))
    elements.append(Spacer(1, 12))

    header = ["Banco", "Tipo", "Moneda", "Saldo", "Equivalente Gs."]
    data = [header]
    for c in cash_position.get("cuentas", []):
        data.append([
            _cell(c["banco"]), _cell(c["tipo"]), _cell(c["moneda"]),
            _num(_fmt_gs(c["saldo_actual"]) if c["moneda"] == "PYG" else f"{float(c['saldo_actual']):,.2f}"),
            _num(_fmt_gs(c["equivalente_pyg"]) if c.get("equivalente_pyg") is not None else "—"),
        ])
    total = cash_position.get("total_pyg_equivalente", 0)
    data.append([_cell("TOTAL", bold=True), _cell(""), _cell(""), _cell(""), _num(_fmt_gs(total), bold=True)])

    from reportlab.lib.units import mm
    t = Table(data, colWidths=[50 * mm, 30 * mm, 22 * mm, 34 * mm, 34 * mm], repeatRows=1)
    t.setStyle(_table_style(3))
    elements.append(t)

    _build(doc, elements)
    return buffer.getvalue()
