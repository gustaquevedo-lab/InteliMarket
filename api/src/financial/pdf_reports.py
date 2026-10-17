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

# ── Conciliación bancaria por cuenta (Modalidad Dual: Landscape y Portrait) ────────

def generate_reconciliation_pdf(
    company: dict,
    account,
    reporte: dict,
    fecha_desde: Optional[date],
    fecha_hasta: Optional[date],
    generated_by: str = "",
    formato: str = "landscape",
) -> bytes:
    if formato == "portrait":
        return _generate_reconciliation_portrait_pdf(company, account, reporte, fecha_desde, fecha_hasta, generated_by)
    return _generate_reconciliation_landscape_pdf(company, account, reporte, fecha_desde, fecha_hasta, generated_by)


def _cuadro_conciliacion_table(account, reporte: dict, col_width_mm: float) -> Table:
    """Cuadro formal de conciliación bancaria contable:
    Saldo según extracto bancario
    + Depósitos en tránsito
    - Cheques diferidos emitidos en tránsito
    = Saldo según libros contables"""
    saldo_banco = reporte.get("saldo_final_banco", account.saldo_actual) or Decimal("0")
    depositos_transito = reporte.get("total_depositos_transito", Decimal("0"))
    cheques_transito = reporte.get("total_cheques_transito", Decimal("0"))
    saldo_libros = reporte.get("saldo_libros", saldo_banco + depositos_transito - cheques_transito)

    rows = [
        [_cell("Saldo Final según Extracto Bancario", bold=True), _num(_fmt_gs(saldo_banco), bold=True)],
        [_cell("(+) Depósitos en Tránsito (no acreditados)"), _num(_fmt_gs(depositos_transito))],
        [_cell("(-) Cheques Emitidos en Tránsito (diferidos pendientes de cobro)"), _num(_fmt_gs(cheques_transito), color=RED)],
        [_cell("(=) SALDO SEGÚN LIBROS CONTABLES", bold=True), _num(_fmt_gs(saldo_libros), bold=True, color=GREEN if saldo_libros >= 0 else RED)],
    ]
    t = Table(rows, colWidths=[col_width_mm * 0.68 * mm, col_width_mm * 0.32 * mm])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), GRAY_LIGHT),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("LINEBELOW", (0, 0), (-1, 0), 0.5, HexColor("#CBD5E1")),
        ("LINEBELOW", (0, 1), (-1, 1), 0.5, HexColor("#CBD5E1")),
        ("LINEBELOW", (0, 2), (-1, 2), 0.5, HexColor("#CBD5E1")),
        ("BACKGROUND", (0, 3), (-1, 3), HexColor("#E2E8F0")),
    ]))
    return t


def _generate_reconciliation_landscape_pdf(
    company: dict, account, reporte: dict, fecha_desde: Optional[date], fecha_hasta: Optional[date], generated_by: str = ""
) -> bytes:
    from api.src.integrated_finance.pdf_reports import _base_landscape_doc
    buffer = io.BytesIO()
    doc, styles = _base_landscape_doc(buffer, "Conciliación Bancaria Detallada", company, generated_by)
    subtitle = f"Extracto Detallado de Movimientos — {account.banco} N° {account.numero_cuenta} ({account.moneda}) — {_periodo_str(fecha_desde, fecha_hasta)}"
    elements = _company_header(company, styles, "Conciliación Bancaria (Detallada)", subtitle, generated_by)

    # 1. KPIs Superiores
    total_pendiente = reporte.get("monto_pendiente", Decimal("0"))
    kpi = _kpi_row([
        ("SALDO EXTRACTO BANCO", _fmt_gs(reporte.get("saldo_final_banco", account.saldo_actual))),
        ("MOVIMIENTOS CONCILIADOS", str(reporte["cantidad_conciliados"])),
        ("MOVIMIENTOS PENDIENTES", str(reporte["cantidad_pendientes"])),
        ("MONTO PENDIENTE CONCILIAR", _fmt_gs(total_pendiente)),
        ("SALDO SEGÚN LIBROS", _fmt_gs(reporte.get("saldo_libros", account.saldo_actual))),
    ], 54)
    elements.append(kpi)
    elements.append(Spacer(1, 8))

    # 2. Cuadro formal de conciliación contable (ancho 130mm a la izquierda)
    elements.append(Paragraph("<b>Cuadro de Cuadre Bancario</b>", styles["Small"]))
    elements.append(Spacer(1, 2))
    elements.append(_cuadro_conciliacion_table(account, reporte, 130))
    elements.append(Spacer(1, 10))

    # 3. Grilla Completa de Movimientos (Ancho útil Landscape: 273mm)
    # Columnas: Fecha (20mm), Concepto/Descripción (75mm), Ref/Cheque (32mm), Débito (28mm), Crédito (28mm), Saldo Progresivo (30mm), Estado (24mm), F. Concil (22mm) = 259mm
    header = ["Fecha", "Concepto / Descripción", "Ref / Cheque", "Débito", "Crédito", "Saldo Prog.", "Estado", "F. Concil."]
    data = [header]

    movimientos = reporte.get("movimientos", [])
    for m in movimientos:
        fecha_str = m["fecha"].strftime("%d/%m/%Y") if hasattr(m["fecha"], "strftime") else str(m["fecha"])
        f_concil_str = m["fecha_conciliacion"].strftime("%d/%m/%Y") if m.get("fecha_conciliacion") and hasattr(m["fecha_conciliacion"], "strftime") else "—"
        ref_text = m.get("referencia") or "—"
        if m.get("cheque_id"):
            ref_text = f"Chq #{ref_text}" if not ref_text.startswith("Chq") else ref_text

        m_monto = m.get("monto", Decimal("0"))
        debito_str = _num(_fmt_gs(m_monto) if m.get("tipo") == "debito" else "—")
        credito_str = _num(_fmt_gs(m_monto) if m.get("tipo") == "credito" else "—")
        saldo_prog_str = _num(_fmt_gs(m.get("saldo_progresivo", Decimal("0"))), bold=True)

        data.append([
            _cell(fecha_str),
            _cell(m.get("descripcion") or "—"),
            _cell(ref_text),
            debito_str,
            credito_str,
            saldo_prog_str,
            _cell("Conciliado" if m.get("conciliado") else "Pendiente", bold=not m.get("conciliado")),
            _cell(f_concil_str),
        ])

    data.append([
        _cell("TOTALES", bold=True),
        _cell(""),
        _cell(""),
        _num(_fmt_gs(reporte["total_debitos"]), bold=True),
        _num(_fmt_gs(reporte["total_creditos"]), bold=True),
        _num(_fmt_gs(reporte.get("saldo_final_banco", account.saldo_actual)), bold=True),
        _cell(""),
        _cell(""),
    ])

    col_widths = [20 * mm, 78 * mm, 34 * mm, 28 * mm, 28 * mm, 32 * mm, 24 * mm, 24 * mm]
    t = Table(data, colWidths=col_widths, repeatRows=1)
    cmds = _table_style_cmds(3)
    for i, m in enumerate(movimientos, start=1):
        if not m.get("conciliado"):
            cmds.append(("TEXTCOLOR", (6, i), (6, i), RED))
    t.setStyle(TableStyle(cmds))
    elements.append(t)

    # 4. Anexo de Cheques Diferidos en Tránsito (si existen)
    cheques_transito = reporte.get("cheques_en_transito", [])
    if cheques_transito:
        elements.append(Spacer(1, 12))
        elements.append(Paragraph("<b>Cheques Emitidos en Tránsito (Pendientes de Cobro por Proveedor)</b>", styles["Small"]))
        elements.append(Spacer(1, 3))
        chq_header = ["N° Cheque", "Beneficiario / Proveedor", "F. Emisión", "F. Vencimiento / Pago", "Monto", "Estado"]
        chq_data = [chq_header]
        for c in cheques_transito:
            fem = c.fecha_emision.strftime("%d/%m/%Y") if c.fecha_emision else "—"
            fpag = c.fecha_pago.strftime("%d/%m/%Y") if c.fecha_pago else "—"
            chq_data.append([
                _cell(c.numero, bold=True),
                _cell(c.beneficiario or "—"),
                _cell(fem),
                _cell(fpag),
                _num(_fmt_gs(c.monto), bold=True),
                _cell(c.estado.capitalize()),
            ])
        chq_data.append([
            _cell("TOTAL CHEQUES EN TRÁNSITO", bold=True),
            _cell(""),
            _cell(""),
            _cell(""),
            _num(_fmt_gs(reporte.get("total_cheques_transito", 0)), bold=True, color=RED),
            _cell(""),
        ])
        chq_table = Table(chq_data, colWidths=[28 * mm, 95 * mm, 28 * mm, 32 * mm, 35 * mm, 25 * mm], repeatRows=1)
        chq_table.setStyle(_table_style(4))
        elements.append(chq_table)

    _build(doc, elements)
    return buffer.getvalue()


def _generate_reconciliation_portrait_pdf(
    company: dict, account, reporte: dict, fecha_desde: Optional[date], fecha_hasta: Optional[date], generated_by: str = ""
) -> bytes:
    """Modalidad Resumida Ejecutiva (A4 Portrait — Vertical):
    Diseñada para gerencia/directorio en 1 página limpia: Cuadro de conciliación formal,
    KPIs consolidados y detalle EXCLUSIVO de partidas pendientes de conciliar."""
    buffer = io.BytesIO()
    doc, styles = _base_doc(buffer, "Conciliación Bancaria Resumida", company, generated_by)
    subtitle = f"Resumen Ejecutivo de Conciliación — {account.banco} N° {account.numero_cuenta} — {_periodo_str(fecha_desde, fecha_hasta)}"
    elements = _company_header(company, styles, "Conciliación Bancaria (Resumen)", subtitle, generated_by)

    # 1. KPIs Clave (Ancho Portrait: 186mm)
    kpi = _kpi_row([
        ("SALDO BANCO", _fmt_gs(reporte.get("saldo_final_banco", account.saldo_actual))),
        ("PARTIDAS PENDIENTES", str(reporte["cantidad_pendientes"])),
        ("CHEQUES EN TRÁNSITO", _fmt_gs(reporte.get("total_cheques_transito", Decimal("0")))),
        ("SALDO EN LIBROS", _fmt_gs(reporte.get("saldo_libros", account.saldo_actual))),
    ], 46.5)
    elements.append(kpi)
    elements.append(Spacer(1, 10))

    # 2. Cuadro formal de conciliación bancaria contable
    elements.append(Paragraph("<b>Cuadro Formal de Cuadre Contable</b>", styles["Small"]))
    elements.append(Spacer(1, 3))
    elements.append(_cuadro_conciliacion_table(account, reporte, 186))
    elements.append(Spacer(1, 14))

    # 3. Solo Partidas Pendientes de Conciliar en Banco (Extracto)
    movimientos_pendientes = [m for m in reporte.get("movimientos", []) if not m.get("conciliado")]
    elements.append(Paragraph(f"<b>Movimientos del Extracto Pendientes de Conciliar ({len(movimientos_pendientes)})</b>", styles["Small"]))
    elements.append(Spacer(1, 3))

    if movimientos_pendientes:
        header = ["Fecha", "Concepto / Descripción", "Referencia", "Tipo", "Monto Gs."]
        data = [header]
        for m in movimientos_pendientes:
            fecha_str = m["fecha"].strftime("%d/%m/%Y") if hasattr(m["fecha"], "strftime") else str(m["fecha"])
            data.append([
                _cell(fecha_str),
                _cell(m.get("descripcion") or "—"),
                _cell(m.get("referencia") or "—"),
                _cell("Débito" if m.get("tipo") == "debito" else "Crédito"),
                _num(_fmt_gs(m.get("monto", 0)), bold=True, color=RED if m.get("tipo") == "debito" else GREEN),
            ])
        data.append([
            _cell("TOTAL PENDIENTE BANCO", bold=True),
            _cell(""),
            _cell(""),
            _cell(""),
            _num(_fmt_gs(reporte.get("monto_pendiente", 0)), bold=True),
        ])
        t_pend = Table(data, colWidths=[24 * mm, 74 * mm, 34 * mm, 20 * mm, 34 * mm], repeatRows=1)
        t_pend.setStyle(_table_style(4))
        elements.append(t_pend)
    else:
        elements.append(Paragraph("✓ Todas las transacciones bancarias del período se encuentran 100% conciliadas.", styles["Small"]))

    # 4. Cheques en Tránsito pendientes
    cheques_transito = reporte.get("cheques_en_transito", [])
    elements.append(Spacer(1, 14))
    elements.append(Paragraph(f"<b>Cheques Diferidos en Tránsito ({len(cheques_transito)})</b>", styles["Small"]))
    elements.append(Spacer(1, 3))

    if cheques_transito:
        chq_header = ["N° Cheque", "Beneficiario", "Vencimiento", "Monto Gs.", "Estado"]
        chq_data = [chq_header]
        for c in cheques_transito[:15]:  # Mostrar los primeros 15 para mantener en 1-2 páginas
            fpag = c.fecha_pago.strftime("%d/%m/%Y") if c.fecha_pago else "—"
            chq_data.append([
                _cell(c.numero, bold=True),
                _cell(c.beneficiario or "—"),
                _cell(fpag),
                _num(_fmt_gs(c.monto), bold=True),
                _cell(c.estado.capitalize()),
            ])
        chq_data.append([
            _cell("TOTAL CHEQUES EN TRÁNSITO", bold=True),
            _cell(""),
            _cell(""),
            _num(_fmt_gs(reporte.get("total_cheques_transito", 0)), bold=True, color=RED),
            _cell(""),
        ])
        chq_table = Table(chq_data, colWidths=[26 * mm, 78 * mm, 26 * mm, 34 * mm, 22 * mm], repeatRows=1)
        chq_table.setStyle(_table_style(3))
        elements.append(chq_table)
    else:
        elements.append(Paragraph("✓ No existen cheques diferidos pendientes de cobro para esta cuenta.", styles["Small"]))

    # 5. Firmas de Cierre
    elements.append(Spacer(1, 24))
    firmas = [
        [_cell("____________________________", bold=True), _cell("____________________________", bold=True)],
        [_cell("Firma Responsable Tesorería"), _cell("Firma Auditoría / Contabilidad")],
    ]
    t_firmas = Table(firmas, colWidths=[93 * mm, 93 * mm])
    t_firmas.setStyle(TableStyle([
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]))
    elements.append(t_firmas)

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
