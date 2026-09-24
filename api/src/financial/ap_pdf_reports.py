"""PDFs de Cuentas por Pagar — Antigüedad de Saldos (Aging) y Top Proveedores
por Gasto + DPO (Fase 7). Reutiliza el mismo encabezado/pie de página de
integrated_finance/pdf_reports.py, igual que ya hacen accounts_receivable y
el módulo Bancos."""

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

CELL_STYLE = ParagraphStyle("ApCell", fontName=FONT_REGULAR, fontSize=7.5, leading=9, textColor=GRAY_DARK)
CELL_STYLE_BOLD = ParagraphStyle("ApCellBold", fontName=FONT_BOLD, fontSize=7.5, leading=9, textColor=GRAY_DARK)
NUM_STYLE = ParagraphStyle("ApNum", fontName=FONT_REGULAR, fontSize=7.5, leading=9, textColor=GRAY_DARK, alignment=TA_RIGHT)
NUM_STYLE_BOLD = ParagraphStyle("ApNumBold", fontName=FONT_BOLD, fontSize=7.5, leading=9, textColor=GRAY_DARK, alignment=TA_RIGHT)
KPI_VALUE = ParagraphStyle("ApKpiValue", fontName=FONT_BOLD, fontSize=16, textColor=PRIMARY_COLOR, leading=19)
KPI_LABEL = ParagraphStyle("ApKpiLabel", fontName=FONT_REGULAR, fontSize=8, textColor=GRAY_MEDIUM, leading=10)


def _cell(text, bold: bool = False) -> Paragraph:
    return Paragraph(str(text) if text is not None else "—", CELL_STYLE_BOLD if bold else CELL_STYLE)


def _num(text, bold: bool = False, color=None) -> Paragraph:
    style = NUM_STYLE_BOLD if bold else NUM_STYLE
    if color:
        style = ParagraphStyle("ApNumColor", parent=style, textColor=color)
    return Paragraph(str(text) if text is not None else "—", style)


def _periodo_str(fecha_desde: Optional[date], fecha_hasta: Optional[date]) -> str:
    if not fecha_desde and not fecha_hasta:
        return "Todos los períodos"
    d = fecha_desde.strftime("%d/%m/%Y") if fecha_desde else "Inicio"
    h = fecha_hasta.strftime("%d/%m/%Y") if fecha_hasta else "Actual"
    return f"Período: {d} — {h}"


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


# ── Antigüedad de Saldos (AP Aging) ─────────────────────────────────────────

def generate_ap_aging_pdf(company: dict, aging: dict, generated_by: str = "") -> bytes:
    buffer = io.BytesIO()
    doc, styles = _base_doc(buffer, "Antigüedad de Saldos - Cuentas por Pagar", company, generated_by)
    elements = _company_header(company, styles, "Antigüedad de Saldos (Aging AP)", "Antigüedad de Saldos — Cuentas por Pagar (corte a hoy)", generated_by)

    kpi = _kpi_row([
        ("SALDO TOTAL PENDIENTE", _fmt_gs(aging.get("total_pendiente", 0))),
        ("VENCIDO", _fmt_gs(aging.get("total_vencido", 0))),
        ("POR VENCER", _fmt_gs(aging.get("total_por_vencer", 0))),
        ("PROVEEDORES CON SALDO", str(len(aging.get("por_supplier", [])))),
    ], 45)
    elements.append(kpi)
    elements.append(Spacer(1, 12))

    bucket_header = ["1-30 días", "31-60 días", "61-90 días", "+90 días"]
    buckets = aging.get("aging_buckets", [])
    bucket_row = [_fmt_gs(b.get("monto", 0)) for b in buckets]
    bt = Table([bucket_header, bucket_row], colWidths=[45 * mm] * 4)
    bt.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), PRIMARY_COLOR),
        ("TEXTCOLOR", (0, 0), (-1, 0), WHITE),
        ("FONTNAME", (0, 0), (-1, 0), FONT_BOLD),
        ("FONTNAME", (0, 1), (-1, 1), FONT_BOLD),
        ("TEXTCOLOR", (3, 1), (3, 1), RED if buckets and float(buckets[-1].get("monto", 0)) > 0 else GRAY_DARK),
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("LINEBELOW", (0, 0), (-1, 0), 0.5, WHITE),
        ("ROWBACKGROUNDS", (0, 1), (-1, 1), [GRAY_LIGHT]),
    ]))
    elements.append(bt)
    elements.append(Spacer(1, 14))

    elements.append(Paragraph("Desglose por proveedor", styles["SectionTitle"]))
    elements.append(Spacer(1, 2))
    header = ["Proveedor", "Vencido", "Por vencer", "Saldo total"]
    data = [header]
    for s in aging.get("por_supplier", []):
        data.append([
            _cell(s["razon_social"]),
            _num(_fmt_gs(s["vencido"]), color=RED if float(s["vencido"]) > 0 else None),
            _num(_fmt_gs(s["por_vencer"])),
            _num(_fmt_gs(s["total_pendiente"]), bold=True),
        ])
    data.append([
        _cell("TOTAL", bold=True),
        _num(_fmt_gs(aging.get("total_vencido", 0)), bold=True),
        _num(_fmt_gs(aging.get("total_por_vencer", 0)), bold=True),
        _num(_fmt_gs(aging.get("total_pendiente", 0)), bold=True),
    ])

    t = Table(data, colWidths=[80 * mm, 35 * mm, 35 * mm, 30 * mm], repeatRows=1)
    t.setStyle(_table_style(1))
    elements.append(t)

    if not aging.get("por_supplier"):
        elements.append(Spacer(1, 10))
        elements.append(Paragraph("Sin facturas pendientes.", styles["Small"]))

    _build(doc, elements)
    return buffer.getvalue()


# ── Top Proveedores por Gasto + DPO ──────────────────────────────────────────

def generate_top_suppliers_pdf(company: dict, report: dict, fecha_desde: Optional[date], fecha_hasta: Optional[date], generated_by: str = "") -> bytes:
    buffer = io.BytesIO()
    doc, styles = _base_doc(buffer, "Top Proveedores por Gasto", company, generated_by)
    subtitle = f"Top Proveedores por Gasto — {_periodo_str(fecha_desde, fecha_hasta)}"
    elements = _company_header(company, styles, "Top Proveedores por Gasto y DPO", subtitle, generated_by)

    dpo_general = report.get("dpo_general_dias")
    kpi = _kpi_row([
        ("GASTO TOTAL (TOP PROVEEDORES)", _fmt_gs(report.get("total_gasto_periodo", 0))),
        ("PROVEEDORES LISTADOS", str(len(report.get("proveedores", [])))),
        ("DPO PROMEDIO GENERAL", f"{dpo_general:.1f} días" if dpo_general is not None else "—"),
    ], 60)
    elements.append(kpi)
    elements.append(Spacer(1, 4))
    elements.append(Paragraph(
        "DPO (Days Payable Outstanding): promedio real de días entre la emisión de la factura y su pago efectivo, "
        "calculado a partir de los pagos registrados — no una fórmula agregada.",
        styles["Small"],
    ))
    elements.append(Spacer(1, 12))

    header = ["Proveedor", "Facturas", "Gasto Total", "Pagos", "Total Pagado", "DPO (días)"]
    data = [header]
    for p in report.get("proveedores", []):
        dpo = p.get("dpo_dias")
        data.append([
            _cell(p["razon_social"]),
            _num(p["cantidad_facturas"]),
            _num(_fmt_gs(p["total_gasto"]), bold=True),
            _num(p["cantidad_pagos"]),
            _num(_fmt_gs(p["total_pagado"])),
            _num(f"{dpo:.1f}" if dpo is not None else "—"),
        ])

    t = Table(data, colWidths=[60 * mm, 18 * mm, 34 * mm, 16 * mm, 32 * mm, 20 * mm], repeatRows=1)
    t.setStyle(_table_style(1))
    elements.append(t)

    if not report.get("proveedores"):
        elements.append(Spacer(1, 10))
        elements.append(Paragraph("Sin facturas de proveedores en este período.", styles["Small"]))

    _build(doc, elements)
    return buffer.getvalue()


# ── Cheques Emitidos ─────────────────────────────────────────────────────────

def generate_cheques_pdf(company: dict, cheques: list[dict], fecha_desde: Optional[date], fecha_hasta: Optional[date], generated_by: str = "") -> bytes:
    buffer = io.BytesIO()
    doc, styles = _base_doc(buffer, "Cheques Emitidos", company, generated_by)
    subtitle = f"Cheques Emitidos — {_periodo_str(fecha_desde, fecha_hasta)}"
    elements = _company_header(company, styles, "Cheques Emitidos", subtitle, generated_by)

    total = sum((Decimal(str(c.get("monto") or 0)) for c in cheques), Decimal("0"))
    kpi = _kpi_row([
        ("MONTO TOTAL", _fmt_gs(total)),
        ("CANTIDAD DE CHEQUES", str(len(cheques))),
    ], 90)
    elements.append(kpi)
    elements.append(Spacer(1, 12))

    header = ["N° Cheque", "Banco", "Beneficiario", "Emisión", "Vencimiento", "Estado", "Monto"]
    data = [header]
    for c in cheques:
        fecha_pago = c.get("fecha_pago")
        data.append([
            _cell(c.get("numero") or "—"),
            _cell(c.get("banco_emisor") or "—"),
            _cell(c.get("supplier_nombre") or c.get("beneficiario") or "—"),
            _cell(c["fecha_emision"].strftime("%d/%m/%Y") if c.get("fecha_emision") else "—"),
            _cell(fecha_pago.strftime("%d/%m/%Y") if fecha_pago else "—"),
            _cell(c.get("estado") or "—"),
            _num(_fmt_gs(c.get("monto") or 0), bold=True),
        ])
    data.append([
        _cell("TOTAL", bold=True), _cell(""), _cell(""), _cell(""), _cell(""), _cell(""),
        _num(_fmt_gs(total), bold=True),
    ])

    t = Table(data, colWidths=[26 * mm, 30 * mm, 44 * mm, 22 * mm, 22 * mm, 22 * mm, 24 * mm], repeatRows=1)
    t.setStyle(_table_style(6))
    elements.append(t)

    if not cheques:
        elements.append(Spacer(1, 10))
        elements.append(Paragraph("Sin cheques en este período.", styles["Small"]))

    _build(doc, elements)
    return buffer.getvalue()
