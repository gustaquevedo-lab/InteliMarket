"""PDFs de Cuentas por Cobrar — Aging y Cobranzas del período. Reutiliza el
mismo encabezado/pie de pagina ya establecido en integrated_finance/pdf_reports.py
(logo, RUC, paginacion real, auditoria de quien/cuando se genero) en vez de
inventar un segundo estilo de reporte."""

import io
from datetime import date, datetime
from decimal import Decimal
from typing import Optional
from zoneinfo import ZoneInfo

from reportlab.lib.units import mm
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.enums import TA_RIGHT, TA_CENTER
from reportlab.platypus import Paragraph, Spacer, Table, TableStyle, HRFlowable, SimpleDocTemplate
from reportlab.lib.colors import HexColor
from reportlab.graphics.barcode import qr
from reportlab.graphics.shapes import Drawing

from api.src.integrated_finance.pdf_reports import (
    _base_doc, _company_header, _logo_flowable, _build, _fmt_gs, _accent_bar,
    PRIMARY_COLOR, GRAY_LIGHT, GRAY_MEDIUM, GRAY_DARK, WHITE, RED, GREEN,
    FONT_REGULAR, FONT_BOLD, PY_TZ,
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


# ── Conversor de números a letras para Guaraníes ───────────────────────

def _numero_a_letras(n: int) -> str:
    """Convierte un entero a su representación literal en castellano,
    adecuado para cheques y recibos oficiales de dinero en Guaraníes."""
    if n <= 0:
        return "CERO"

    unidades = ["", "UN", "DOS", "TRES", "CUATRO", "CINCO", "SEIS", "SIETE", "OCHO", "NUEVE"]
    dieces = ["DIEZ", "ONCE", "DOCE", "TRECE", "CATORCE", "QUINCE", "DIECISÉIS", "DIECISIETE", "DIECIOCHO", "DIECINUEVE"]
    decenas = ["", "DIEZ", "VEINTE", "TREINTA", "CUARENTA", "CINCUENTA", "SESENTA", "SETENTA", "OCHENTA", "NOVENTA"]
    centenas = ["", "CIENTO", "DOSCIENTOS", "TRESCIENTOS", "CUATROCIENTOS", "QUINIENTOS", "SEISCIENTOS", "SETECIENTOS", "OCHOCIENTOS", "NOVECIENTOS"]

    def _seccion(num):
        if num == 100:
            return "CIEN"
        c = num // 100
        d = (num % 100) // 10
        u = num % 10
        res = []
        if c > 0:
            res.append(centenas[c])
        if d == 1:
            res.append(dieces[u])
        elif d == 2 and u > 0:
            res.append(f"VEINTI{unidades[u]}")
        elif d > 0:
            res.append(decenas[d])
            if u > 0:
                res.append(f"Y {unidades[u]}")
        elif u > 0:
            res.append(unidades[u])
        return " ".join(res)

    partes = []
    millones = n // 1000000
    resto = n % 1000000
    if millones == 1:
        partes.append("UN MILLÓN")
    elif millones > 1:
        partes.append(f"{_seccion(millones)} MILLONES")

    miles = resto // 1000
    resto = resto % 1000
    if miles == 1:
        partes.append("MIL")
    elif miles > 1:
        partes.append(f"{_seccion(miles)} MIL")

    if resto > 0:
        partes.append(_seccion(resto))

    return " ".join(partes).strip()


# ── Reporte Detallado de Deuda por Cliente en PDF ──────────────────────

def generate_deuda_detallada_pdf(
    company: dict,
    data: dict,
    filtro_empresa: Optional[str] = None,
    filtro_cliente: Optional[str] = None,
    generated_by: str = "",
) -> bytes:
    """Informe detallado de cuentas por cobrar en formato A4 con estética
    corporativa ejecutiva (idéntica a Arqueo/Bancos), con desglose por cliente,
    factura por factura, días de mora, empresa vinculada y subtotales."""
    buffer = io.BytesIO()
    doc, styles = _base_doc(buffer, "Reporte Detallado de Deuda por Cliente", company, generated_by)

    subtitulo = "Deuda Detallada de Cuentas por Cobrar — Extra Supermercado Mayorista"
    elements = _company_header(
        company, styles, "INFORME DETALLADO DE CUENTAS POR COBRAR", subtitulo, generated_by
    )
    elements.append(Spacer(1, 4))

    # Filtros aplicados
    filtro_emp_str = filtro_empresa if filtro_empresa else "Todas las Empresas Vinculadas"
    filtro_cli_str = filtro_cliente if filtro_cliente else "Todos los Clientes con Deuda"
    f_corte_str = (
        data.get("fecha_corte").strftime("%d/%m/%Y")
        if data.get("fecha_corte")
        else date.today().strftime("%d/%m/%Y")
    )

    filters_tbl = Table(
        [[
            Paragraph(f"<font size=6.5 color='#64748B'><b>EMPRESA VINCULADA:</b></font> <font size=7 color='#0F172A'><b>{filtro_emp_str}</b></font>", styles["Normal"]),
            Paragraph(f"<font size=6.5 color='#64748B'><b>CLIENTE:</b></font> <font size=7 color='#0F172A'><b>{filtro_cli_str}</b></font>", styles["Normal"]),
            Paragraph(f"<font size=6.5 color='#64748B'><b>FECHA CORTE:</b></font> <font size=7 color='#0F172A'><b>{f_corte_str}</b></font>", styles["Normal"]),
        ]],
        colWidths=[65 * mm, 75 * mm, 46 * mm],
    )
    filters_tbl.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), HexColor("#F8FAFC")),
        ("BOX", (0, 0), (-1, -1), 0.5, HexColor("#CBD5E1")),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]))
    elements.append(filters_tbl)
    elements.append(Spacer(1, 6))

    # KPI Cards panorámicas (4 cards, 46.5mm c/u = 186mm)
    total_saldo = data.get("total_saldo_general") or Decimal("0")
    total_vencido = data.get("total_vencido") or Decimal("0")
    total_clientes = data.get("total_clientes") or 0
    total_facturas = data.get("total_facturas") or 0
    porc_vencido = (float(total_vencido) / float(total_saldo) * 100) if float(total_saldo) > 0 else 0

    kpis_data = [
        [
            Paragraph("<font size=6 color='#64748B'><b>TOTAL SALDO PENDIENTE</b></font><br/>"
                      f"<font size=10 color='#0F172A'><b>{_fmt_gs(total_saldo)}</b></font><br/>"
                      "<font size=5.5 color='#94A3B8'>Cartera activa por cobrar</font>", styles["Normal"]),
            Paragraph("<font size=6 color='#64748B'><b>TOTAL EN MORA VENCIDA</b></font><br/>"
                      f"<font size=10 color='{'#DC2626' if total_vencido > 0 else '#059669'}'><b>{_fmt_gs(total_vencido)}</b></font><br/>"
                      f"<font size=5.5 color='{'#DC2626' if total_vencido > 0 else '#059669'}'><b>{porc_vencido:.1f}% de la cartera vencida</b></font>", styles["Normal"]),
            Paragraph("<font size=6 color='#64748B'><b>CLIENTES CON SALDO</b></font><br/>"
                      f"<font size=10 color='#1E40AF'><b>{total_clientes} Clientes</b></font><br/>"
                      "<font size=5.5 color='#94A3B8'>Con cuentas pendientes</font>", styles["Normal"]),
            Paragraph("<font size=6 color='#64748B'><b>TOTAL FACTURAS</b></font><br/>"
                      f"<font size=10 color='#0F172A'><b>{total_facturas} Facturas</b></font><br/>"
                      "<font size=5.5 color='#94A3B8'>Créditos pendientes</font>", styles["Normal"]),
        ]
    ]
    t_kpis = Table(kpis_data, colWidths=[46.5 * mm, 46.5 * mm, 46.5 * mm, 46.5 * mm])
    t_kpis.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), HexColor("#F8FAFC")),
        ("BOX", (0, 0), (0, 0), 0.5, HexColor("#CBD5E1")),
        ("BOX", (1, 0), (1, 0), 0.5, HexColor("#CBD5E1")),
        ("BOX", (2, 0), (2, 0), 0.5, HexColor("#CBD5E1")),
        ("BOX", (3, 0), (3, 0), 0.5, HexColor("#CBD5E1")),
        ("TOPPADDING", (0, 0), (-1, -1), 3.5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3.5),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]))
    elements.append(t_kpis)
    elements.append(Spacer(1, 6))

    # Buckets Bar (37.2 mm c/u = 186 mm)
    b = data.get("buckets", {})
    bucket_header = ["Al día", "1-30 días", "31-60 días", "61-90 días", "+90 días"]
    bucket_row = [
        _fmt_gs(b.get("al_dia", 0)), _fmt_gs(b.get("dias_1_30", 0)),
        _fmt_gs(b.get("dias_31_60", 0)), _fmt_gs(b.get("dias_61_90", 0)),
        _fmt_gs(b.get("dias_91_plus", 0)),
    ]
    bt = Table(
        [
            [Paragraph(f"<b>{h}</b>", styles["Normal"]) for h in bucket_header],
            [Paragraph(v, styles["Normal"]) for v in bucket_row],
        ],
        colWidths=[37.2 * mm] * 5,
    )
    bt.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), PRIMARY_COLOR),
        ("TEXTCOLOR", (0, 0), (-1, 0), WHITE),
        ("FONTNAME", (0, 0), (-1, 0), FONT_BOLD),
        ("FONTNAME", (0, 1), (-1, 1), FONT_BOLD),
        ("TEXTCOLOR", (4, 1), (4, 1), RED if float(b.get("dias_91_plus", 0)) > 0 else GRAY_DARK),
        ("FONTSIZE", (0, 0), (-1, -1), 7.5),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3.5),
        ("TOPPADDING", (0, 0), (-1, -1), 3.5),
        ("LINEBELOW", (0, 0), (-1, 0), 0.5, WHITE),
        ("ROWBACKGROUNDS", (0, 1), (-1, 1), [GRAY_LIGHT]),
    ]))
    elements.append(bt)
    elements.append(Spacer(1, 8))

    # Detalle por Cliente
    clientes = data.get("clientes", [])
    if not clientes:
        elements.append(Paragraph("Sin cuentas ni facturas pendientes para el criterio de búsqueda seleccionado.", styles["Small"]))
        _build(doc, elements)
        return buffer.getvalue()

    for c in clientes:
        c_name = c.get("customer_name") or "Cliente"
        c_ruc = c.get("customer_ruc") or "—"
        c_tel = c.get("customer_telefono") or "—"
        c_emp = c.get("empresa_vinculada_nombre")
        emp_txt = f" &nbsp;·&nbsp; <font color='#1E40AF'><b>Empresa Vinc.:</b> {c_emp}</font>" if c_emp else ""
        c_limite = c.get("limite_credito") or 0
        c_saldo = c.get("saldo_total") or 0

        c_header_data = [
            [
                Paragraph(f"<font size=7.8 color='#0F172A'><b>{c_name}</b></font> &nbsp; <font size=6.8 color='#64748B'>RUC: <b>{c_ruc}</b> · Tel: {c_tel}{emp_txt}</font>", styles["Normal"]),
                Paragraph(f"<font size=6.8 color='#64748B'>Límite: <b>{_fmt_gs(c_limite)}</b></font> &nbsp;·&nbsp; <font size=7.8 color='#0F172A'><b>Saldo: {_fmt_gs(c_saldo)}</b></font>", ParagraphStyle("RightH", parent=styles["Normal"], alignment=TA_RIGHT)),
            ]
        ]
        t_cheader = Table(c_header_data, colWidths=[126 * mm, 60 * mm])
        t_cheader.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), HexColor("#E2E8F0")),
            ("BOX", (0, 0), (-1, -1), 0.5, HexColor("#94A3B8")),
            ("TOPPADDING", (0, 0), (-1, -1), 2.5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 2.5),
            ("LEFTPADDING", (0, 0), (-1, -1), 5),
            ("RIGHTPADDING", (0, 0), (-1, -1), 5),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ]))
        elements.append(t_cheader)

        inv_head = ["N° Documento", "Emisión", "Vencimiento", "Mora", "Monto Original", "Saldo Pendiente"]
        inv_rows = [inv_head]
        for f in c.get("facturas", []):
            emision = f["fecha_emision"].strftime("%d/%m/%Y") if hasattr(f["fecha_emision"], "strftime") else str(f["fecha_emision"] or "—")
            vto = f["fecha_vencimiento"].strftime("%d/%m/%Y") if hasattr(f["fecha_vencimiento"], "strftime") else str(f["fecha_vencimiento"] or "—")
            dias = f["dias_mora"] or 0
            if dias <= 0:
                mora_p = Paragraph("<font color='#059669'><b>Al día</b></font>", NUM_STYLE)
            elif dias <= 30:
                mora_p = Paragraph(f"<font color='#D97706'><b>{dias}d mora</b></font>", NUM_STYLE)
            else:
                mora_p = Paragraph(f"<font color='#DC2626'><b>{dias}d mora</b></font>", NUM_STYLE)

            inv_rows.append([
                _cell(f["numero_documento"], bold=True),
                _cell(emision),
                _cell(vto),
                mora_p,
                _num(_fmt_gs(f["monto_original"])),
                _num(_fmt_gs(f["saldo_pendiente"]), bold=True),
            ])

        # Fila de subtotal por cliente
        inv_rows.append([
            _cell(f"Subtotal {c_name[:28]} ({len(c.get('facturas', []))} docs)", bold=True),
            _cell(""), _cell(""), _cell(""),
            _num(_fmt_gs(c.get("monto_original_total", 0)), bold=True),
            _num(_fmt_gs(c_saldo), bold=True),
        ])

        t_inv = Table(inv_rows, colWidths=[36 * mm, 22 * mm, 22 * mm, 22 * mm, 40 * mm, 44 * mm], repeatRows=1)
        t_inv.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), HexColor("#F1F5F9")),
            ("TEXTCOLOR", (0, 0), (-1, 0), HexColor("#334155")),
            ("FONTNAME", (0, 0), (-1, 0), FONT_BOLD),
            ("FONTSIZE", (0, 0), (-1, -1), 7),
            ("ALIGN", (3, 0), (-1, -1), "RIGHT"),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("ROWBACKGROUNDS", (0, 1), (-1, -2), [WHITE, HexColor("#F8FAFC")]),
            ("LINEBELOW", (0, 0), (-1, 0), 0.5, HexColor("#CBD5E1")),
            ("LINEABOVE", (0, -1), (-1, -1), 0.75, HexColor("#0F172A")),
            ("BACKGROUND", (0, -1), (-1, -1), HexColor("#F1F5F9")),
            ("TOPPADDING", (0, 0), (-1, -1), 2.5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 2.5),
            ("LEFTPADDING", (0, 0), (-1, -1), 4),
            ("RIGHTPADDING", (0, 0), (-1, -1), 4),
        ]))
        elements.append(t_inv)
        elements.append(Spacer(1, 6))

    # Total General Banner
    tot_banner_data = [
        [
            Paragraph(f"<font size=8 color='#FFFFFF'><b>TOTAL GENERAL CONSOLIDADO CUENTAS POR COBRAR</b></font><br/>"
                      f"<font size=6.5 color='#94A3B8'>{total_facturas} facturas pendientes · {total_clientes} clientes con saldo</font>", styles["Normal"]),
            Paragraph(f"<font size=10.5 color='#FFFFFF'><b>{_fmt_gs(total_saldo)}</b></font>", ParagraphStyle("RightW", parent=styles["Normal"], alignment=TA_RIGHT)),
        ]
    ]
    t_tot = Table(tot_banner_data, colWidths=[130 * mm, 56 * mm])
    t_tot.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), PRIMARY_COLOR),
        ("BOX", (0, 0), (-1, -1), 0.5, PRIMARY_COLOR),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]))
    elements.append(Spacer(1, 4))
    elements.append(t_tot)

    _build(doc, elements)
    return buffer.getvalue()


# ── Recibo de Cobranza en A6 Horizontal con QR ─────────────────────────

def generate_recibo_a6_pdf(
    company: dict,
    receipt_data: dict,
    verification_base_url: str = "https://intelimarket.superextra.com.py",
) -> bytes:
    """Genera el Recibo de Cobranza Oficial en formato A6 HORIZONTAL (148mm x 105mm).
    Diseñado para encajar en 1 sola página exacta con logo institucional, datos fiscales,
    número de recibo, cliente, imputación de facturas, monto en letras y números,
    firmas y código QR para verificación pública en línea."""
    buffer = io.BytesIO()
    PAGE_WIDTH = 148 * mm
    PAGE_HEIGHT = 105 * mm
    MARGIN_A6 = 5 * mm

    doc = SimpleDocTemplate(
        buffer, pagesize=(PAGE_WIDTH, PAGE_HEIGHT),
        leftMargin=MARGIN_A6, rightMargin=MARGIN_A6,
        topMargin=MARGIN_A6, bottomMargin=MARGIN_A6,
        title=f"Recibo de Cobranza {receipt_data.get('numero_recibo', 'REC')}",
    )
    styles = getSampleStyleSheet()

    elements = []

    # Fecha / Hora convertida a America/Asuncion
    created_at = receipt_data.get("created_at")
    if created_at and hasattr(created_at, "astimezone"):
        if created_at.tzinfo is None:
            created_at = created_at.replace(tzinfo=ZoneInfo("UTC"))
        fecha_hora_py = created_at.astimezone(PY_TZ).strftime("%d/%m/%Y %H:%M")
    else:
        f = receipt_data.get("fecha")
        fecha_hora_py = f.strftime("%d/%m/%Y") if hasattr(f, "strftime") else str(f or date.today().strftime("%d/%m/%Y"))

    # 1. HEADER (Logo + Datos Fiscales + Caja N° Recibo)
    logo_flow = _logo_flowable(company, max_w=28 * mm, max_h=12 * mm)

    fiscal_lines = (
        "<font size=7.5 color='#0F172A'><b>GRUPO SANTA TERESA E.A.S.</b></font><br/>"
        "<font size=6 color='#475569'><b>RUC:</b> 80150377-9 · Extra Supermercado Mayorista<br/>"
        "Timbrado: 18545636 · Cnel. Oviedo, Paraguay</font>"
    )

    recibo_num = receipt_data.get("numero_recibo", f"REC-{str(receipt_data.get('id', ''))[:8].upper()}")
    recibo_box = (
        "<font size=6 color='#64748B'><b>RECIBO DE COBRANZA</b></font><br/>"
        f"<font size=9 color='#1E40AF'><b>{recibo_num}</b></font><br/>"
        f"<font size=5.8 color='#64748B'>{fecha_hora_py}</font>"
    )

    header_table = Table(
        [[
            logo_flow,
            Paragraph(fiscal_lines, styles["Normal"]),
            Paragraph(recibo_box, ParagraphStyle("ReciboRight", parent=styles["Normal"], alignment=TA_RIGHT)),
        ]],
        colWidths=[28 * mm, 66 * mm, 44 * mm],
    )
    header_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 1),
        ("RIGHTPADDING", (0, 0), (-1, -1), 2),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 1),
    ]))
    elements.append(header_table)
    elements.append(Spacer(1, 2))

    # 2. DATOS DEL CLIENTE Y COBRO
    c_name = receipt_data.get("customer_name") or receipt_data.get("nombre_fantasia") or "Cliente"
    c_ruc = receipt_data.get("customer_ruc") or "—"
    c_tel = receipt_data.get("customer_telefono") or "—"
    c_emp = receipt_data.get("empresa_vinculada_nombre")
    forma = (receipt_data.get("forma_pago") or "Efectivo").replace("_", " ").upper()
    ref = receipt_data.get("referencia") or "—"

    cli_col1 = (
        f"<font size=6 color='#64748B'>CLIENTE:</font> <font size=6.8 color='#0F172A'><b>{c_name}</b></font><br/>"
        f"<font size=6 color='#64748B'>RUC / C.I.:</font> <font size=6.5 color='#0F172A'><b>{c_ruc}</b></font> &nbsp; "
        f"<font size=6 color='#64748B'>TEL:</font> <font size=6.5 color='#0F172A'>{c_tel}</font>"
    )
    cli_col2 = (
        f"<font size=6 color='#64748B'>EMPRESA VINC.:</font> <font size=6.5 color='#1E40AF'><b>{c_emp or '—'}</b></font><br/>"
        f"<font size=6 color='#64748B'>MEDIO DE PAGO:</font> <font size=6.5 color='#0F172A'><b>{forma}</b></font> &nbsp; "
        f"<font size=6 color='#64748B'>REF:</font> <font size=6.5 color='#0F172A'>{ref}</font>"
    )

    cli_table = Table(
        [[Paragraph(cli_col1, styles["Normal"]), Paragraph(cli_col2, styles["Normal"])]],
        colWidths=[74 * mm, 64 * mm],
    )
    cli_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), HexColor("#F8FAFC")),
        ("BOX", (0, 0), (-1, -1), 0.5, HexColor("#CBD5E1")),
        ("TOPPADDING", (0, 0), (-1, -1), 2),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]))
    elements.append(cli_table)
    elements.append(Spacer(1, 2))

    # 3. TABLA DE FACTURAS IMPUTADAS
    allocations = receipt_data.get("allocations", [])
    monto_total = Decimal(str(receipt_data.get("monto_total") or 0))

    t_alloc_head = [
        Paragraph("<font size=6 color='#FFFFFF'><b>Doc. / Factura</b></font>", styles["Normal"]),
        Paragraph("<font size=6 color='#FFFFFF'><b>Vencimiento</b></font>", styles["Normal"]),
        Paragraph("<font size=6 color='#FFFFFF'><b>Monto Orig.</b></font>", ParagraphStyle("TH1", parent=styles["Normal"], alignment=TA_RIGHT)),
        Paragraph("<font size=6 color='#FFFFFF'><b>Monto Cobrado</b></font>", ParagraphStyle("TH2", parent=styles["Normal"], alignment=TA_RIGHT)),
        Paragraph("<font size=6 color='#FFFFFF'><b>Saldo Restante</b></font>", ParagraphStyle("TH3", parent=styles["Normal"], alignment=TA_RIGHT)),
    ]
    t_alloc_data = [t_alloc_head]

    max_filas = 4
    mostradas = allocations[:max_filas]
    for a in mostradas:
        doc_num = a.get("numero_documento") or "S/N"
        vto = a.get("fecha_vencimiento")
        vto_str = vto.strftime("%d/%m/%Y") if hasattr(vto, "strftime") else str(vto or "—")
        m_orig = a.get("monto_original") or 0
        m_imp = a.get("monto") if a.get("monto") is not None else a.get("monto_aplicado", 0)
        s_rest = a.get("saldo_pendiente") if a.get("saldo_pendiente") is not None else a.get("nuevo_saldo", 0)

        t_alloc_data.append([
            Paragraph(f"<font size=6 color='#0F172A'><b>{doc_num}</b></font>", styles["Normal"]),
            Paragraph(f"<font size=5.8 color='#475569'>{vto_str}</font>", styles["Normal"]),
            Paragraph(f"<font size=6 color='#475569'>{_fmt_gs(m_orig)}</font>", ParagraphStyle("TD1", parent=styles["Normal"], alignment=TA_RIGHT)),
            Paragraph(f"<font size=6 color='#059669'><b>{_fmt_gs(m_imp)}</b></font>", ParagraphStyle("TD2", parent=styles["Normal"], alignment=TA_RIGHT)),
            Paragraph(f"<font size=6 color='#0F172A'>{_fmt_gs(s_rest)}</font>", ParagraphStyle("TD3", parent=styles["Normal"], alignment=TA_RIGHT)),
        ])

    if len(allocations) > max_filas:
        restantes = len(allocations) - max_filas
        monto_otros = sum(Decimal(str(a.get("monto") or a.get("monto_aplicado", 0))) for a in allocations[max_filas:])
        t_alloc_data.append([
            Paragraph(f"<font size=5.5 color='#64748B'><i>(+ {restantes} facturas adicionales imputadas)</i></font>", styles["Normal"]),
            Paragraph("", styles["Normal"]), Paragraph("", styles["Normal"]),
            Paragraph(f"<font size=6 color='#059669'><b>{_fmt_gs(monto_otros)}</b></font>", ParagraphStyle("TDO", parent=styles["Normal"], alignment=TA_RIGHT)),
            Paragraph("—", ParagraphStyle("TDS", parent=styles["Normal"], alignment=TA_RIGHT)),
        ])

    t_alloc = Table(t_alloc_data, colWidths=[36 * mm, 24 * mm, 26 * mm, 26 * mm, 26 * mm])
    t_alloc.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), PRIMARY_COLOR),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 1.5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 1.5),
        ("LEFTPADDING", (0, 0), (-1, -1), 3),
        ("RIGHTPADDING", (0, 0), (-1, -1), 3),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [WHITE, HexColor("#F8FAFC")]),
        ("LINEBELOW", (0, 0), (-1, -1), 0.5, HexColor("#E2E8F0")),
    ]))
    elements.append(t_alloc)
    elements.append(Spacer(1, 2))

    # 4. TOTAL COBRADO Y MONTO EN LETRAS
    monto_letras = _numero_a_letras(int(monto_total))
    tot_data = [
        [
            Paragraph(f"<font size=5.5 color='#64748B'><b>SON GUARANÍES:</b></font><br/>"
                      f"<font size=6.5 color='#0F172A'><b>{monto_letras} GUARANÍES</b></font>", styles["Normal"]),
            Paragraph(f"<font size=6 color='#64748B'><b>TOTAL COBRADO:</b></font><br/>"
                      f"<font size=10 color='#059669'><b>{_fmt_gs(monto_total)}</b></font>", ParagraphStyle("TotCob", parent=styles["Normal"], alignment=TA_RIGHT)),
        ]
    ]
    t_total = Table(tot_data, colWidths=[92 * mm, 46 * mm])
    t_total.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), HexColor("#F1F5F9")),
        ("BOX", (0, 0), (-1, -1), 0.5, HexColor("#CBD5E1")),
        ("TOPPADDING", (0, 0), (-1, -1), 2),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]))
    elements.append(t_total)
    elements.append(Spacer(1, 2))

    # 5. FOOTER CON QR Y FIRMAS
    qr_url = f"{verification_base_url.rstrip('/')}/verificar-recibo/{receipt_data.get('id')}"
    q = qr.QrCodeWidget(qr_url)
    b = q.getBounds()
    qw, qh = b[2] - b[0], b[3] - b[1]
    qr_size = 18 * mm
    d_qr = Drawing(qr_size, qr_size, transform=[qr_size / qw, 0, 0, qr_size / qh, 0, 0])
    d_qr.add(q)

    qr_expl = (
        "<font size=5 color='#64748B'>Escaneá con tu celular para verificar la validez oficial en línea de este recibo.</font>"
    )

    firma_caja = (
        "<br/><br/>___________________________<br/>"
        "<font size=5.5 color='#64748B'><b>Caja / Recaudador</b><br/>Firma y Aclaración</font>"
    )
    firma_cliente = (
        "<br/><br/>___________________________<br/>"
        "<font size=5.5 color='#64748B'><b>Cliente / Deudor</b><br/>Conformidad de Pago</font>"
    )

    footer_table = Table(
        [[
            d_qr,
            Paragraph(qr_expl, styles["Normal"]),
            Paragraph(firma_caja, ParagraphStyle("FCaja", parent=styles["Normal"], alignment=TA_CENTER)),
            Paragraph(firma_cliente, ParagraphStyle("FCli", parent=styles["Normal"], alignment=TA_CENTER)),
        ]],
        colWidths=[20 * mm, 34 * mm, 42 * mm, 42 * mm],
    )
    footer_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 1),
        ("RIGHTPADDING", (0, 0), (-1, -1), 1),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
    ]))
    elements.append(footer_table)

    doc.build(elements)
    return buffer.getvalue()

