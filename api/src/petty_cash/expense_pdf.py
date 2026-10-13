"""Generador de PDF para Recibos Oficiales de Gastos y Reportes Analíticos de Tesorería.
Diseño institucional de alta calidad (ReportLab) con membrete corporativo:
GRUPO SANTA TERESA E.A.S. / Extra Supermercado Mayorista / RUC 80150377-9.
Zona horaria estricta: America/Asuncion.
"""

from io import BytesIO
from datetime import datetime, date
from decimal import Decimal
from zoneinfo import ZoneInfo

from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.colors import HexColor
from reportlab.lib.units import mm
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_RIGHT, TA_CENTER
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Table, TableStyle, Spacer, KeepTogether, HRFlowable
)
from reportlab.pdfgen import canvas as pdfcanvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
import os

ASUNCION_TZ = ZoneInfo("America/Asuncion")

PRIMARY_COLOR = HexColor("#0F172A")    # Slate 900
BRAND_ACCENT = HexColor("#16A34A")     # Emerald 600
BRAND_BLUE = HexColor("#2563EB")       # Blue 600
GRAY_DARK = HexColor("#1E293B")
GRAY_MEDIUM = HexColor("#64748B")
GRAY_LIGHT = HexColor("#F8FAFC")
GRAY_BORDER = HexColor("#E2E8F0")
WHITE = HexColor("#FFFFFF")
SUCCESS_COLOR = HexColor("#15803D")
WARNING_COLOR = HexColor("#B45309")
RED_ALERT = HexColor("#DC2626")

FONT_REGULAR = "Helvetica"
FONT_BOLD = "Helvetica-Bold"
FONT_ITALIC = "Helvetica-Oblique"

# Intentar registrar fuentes personalizadas si existen
try:
    _dir = os.path.dirname(__file__)
    reg_ttf = os.path.abspath(os.path.join(_dir, "..", "..", "assets", "fonts", "Lato-Regular.ttf"))
    bold_ttf = os.path.abspath(os.path.join(_dir, "..", "..", "assets", "fonts", "Lato-Bold.ttf"))
    if os.path.exists(reg_ttf) and os.path.exists(bold_ttf):
        pdfmetrics.registerFont(TTFont("Lato", reg_ttf))
        pdfmetrics.registerFont(TTFont("Lato-Bold", bold_ttf))
        FONT_REGULAR = "Lato"
        FONT_BOLD = "Lato-Bold"
except Exception:
    pass


class _NumberedCanvas(pdfcanvas.Canvas):
    """Canvas de dos pasadas para numeración dinámica de páginas y pie corporativo."""
    def __init__(self, *args, footer_left="", **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_states = []
        self._footer_left = footer_left or "InteliMarket ERP — Grupo Santa Teresa E.A.S."

    def showPage(self):
        self._saved_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        total_pages = len(self._saved_states)
        for state in self._saved_states:
            self.__dict__.update(state)
            self._draw_footer(total_pages)
            super().showPage()
        super().save()

    def _draw_footer(self, total_pages):
        page_w, _ = self._pagesize
        self.setStrokeColor(HexColor("#CBD5E1"))
        self.setLineWidth(0.5)
        self.line(15 * mm, 12 * mm, page_w - 15 * mm, 12 * mm)
        self.setFont(FONT_REGULAR, 7.5)
        self.setFillColor(GRAY_MEDIUM)
        self.drawString(15 * mm, 7.5 * mm, self._footer_left)
        self.drawRightString(page_w - 15 * mm, 7.5 * mm, f"Página {self._pageNumber} de {total_pages}")


def _format_gs(val) -> str:
    try:
        n = int(round(float(val or 0)))
        return f"{n:,.0f}".replace(",", ".")
    except Exception:
        return "0"


def _format_date(val) -> str:
    if not val:
        return "-"
    if isinstance(val, str):
        try:
            val = datetime.fromisoformat(val.replace("Z", "+00:00"))
        except Exception:
            return val
    if isinstance(val, datetime):
        if val.tzinfo is not None:
            val = val.astimezone(ASUNCION_TZ)
        return val.strftime("%d/%m/%Y %H:%M")
    if isinstance(val, date):
        return val.strftime("%d/%m/%Y")
    return str(val)


def _get_styles():
    ss = getSampleStyleSheet()
    styles = {
        "title": ParagraphStyle("T_Title", parent=ss["Normal"], fontName=FONT_BOLD, fontSize=15, leading=18, textColor=PRIMARY_COLOR),
        "subtitle": ParagraphStyle("T_Sub", parent=ss["Normal"], fontName=FONT_REGULAR, fontSize=9, leading=12, textColor=GRAY_MEDIUM),
        "header_right": ParagraphStyle("T_HR", parent=ss["Normal"], fontName=FONT_BOLD, fontSize=11, leading=14, textColor=PRIMARY_COLOR, alignment=TA_RIGHT),
        "section_h1": ParagraphStyle("T_Sec1", parent=ss["Normal"], fontName=FONT_BOLD, fontSize=10, leading=13, textColor=PRIMARY_COLOR),
        "body": ParagraphStyle("T_Body", parent=ss["Normal"], fontName=FONT_REGULAR, fontSize=8.5, leading=11, textColor=GRAY_DARK),
        "body_bold": ParagraphStyle("T_BodyB", parent=ss["Normal"], fontName=FONT_BOLD, fontSize=8.5, leading=11, textColor=GRAY_DARK),
        "body_right": ParagraphStyle("T_BodyR", parent=ss["Normal"], fontName=FONT_REGULAR, fontSize=8.5, leading=11, textColor=GRAY_DARK, alignment=TA_RIGHT),
        "body_right_bold": ParagraphStyle("T_BodyRB", parent=ss["Normal"], fontName=FONT_BOLD, fontSize=8.5, leading=11, textColor=PRIMARY_COLOR, alignment=TA_RIGHT),
        "table_header": ParagraphStyle("T_TH", parent=ss["Normal"], fontName=FONT_BOLD, fontSize=8, leading=10, textColor=WHITE),
        "table_header_right": ParagraphStyle("T_THR", parent=ss["Normal"], fontName=FONT_BOLD, fontSize=8, leading=10, textColor=WHITE, alignment=TA_RIGHT),
        "table_header_center": ParagraphStyle("T_THC", parent=ss["Normal"], fontName=FONT_BOLD, fontSize=8, leading=10, textColor=WHITE, alignment=TA_CENTER),
        "badge_pagado": ParagraphStyle("T_BPag", parent=ss["Normal"], fontName=FONT_BOLD, fontSize=8, leading=10, textColor=SUCCESS_COLOR, alignment=TA_CENTER),
        "badge_pendiente": ParagraphStyle("T_BPen", parent=ss["Normal"], fontName=FONT_BOLD, fontSize=8, leading=10, textColor=WARNING_COLOR, alignment=TA_CENTER),
        "badge_aprobado": ParagraphStyle("T_BApr", parent=ss["Normal"], fontName=FONT_BOLD, fontSize=8, leading=10, textColor=BRAND_BLUE, alignment=TA_CENTER),
        "footer_text": ParagraphStyle("T_Foot", parent=ss["Normal"], fontName=FONT_REGULAR, fontSize=7, leading=9, textColor=GRAY_MEDIUM, alignment=TA_CENTER),
    }
    return styles


def _build_corporate_header(company: dict, doc_title: str, doc_code: str, styles: dict) -> list:
    """Construye el encabezado corporativo con datos de Grupo Santa Teresa E.A.S."""
    razon_social = company.get("razon_social") or "GRUPO SANTA TERESA E.A.S."
    fantasia = company.get("nombre_fantasia") or "Extra Supermercado Mayorista"
    ruc = company.get("ruc") or "80150377-9"
    timbrado = company.get("timbrado") or "18545636"
    direccion = company.get("direccion") or "Avda. San Blas e/ Avda. Perú - Ciudad del Este, Paraguay"

    left_flow = [
        Paragraph(fantasia.upper(), styles["title"]),
        Paragraph(f"<b>Razón Social:</b> {razon_social}", styles["subtitle"]),
        Paragraph(f"<b>RUC:</b> {ruc} &nbsp;|&nbsp; <b>Timbrado Oficial:</b> {timbrado}", styles["subtitle"]),
        Paragraph(f"<b>Dirección:</b> {direccion}", styles["subtitle"]),
    ]

    now_asuncion = datetime.now(ASUNCION_TZ).strftime("%d/%m/%Y %H:%M")
    right_flow = [
        Paragraph(doc_title, styles["header_right"]),
        Spacer(1, 2 * mm),
        Paragraph(f"<font color='#16A34A' size=13><b>{doc_code}</b></font>", styles["header_right"]),
        Spacer(1, 1.5 * mm),
        Paragraph(f"<font size=8 color='#64748B'>Emisión: {now_asuncion}</font>", styles["header_right"]),
        Paragraph(f"<font size=8 color='#64748B'>Sistema: InteliMarket Tesorería</font>", styles["header_right"]),
    ]

    header_table = Table([[left_flow, right_flow]], colWidths=[110 * mm, 70 * mm])
    header_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
    ]))
    return [header_table, Spacer(1, 4 * mm), HRFlowable(width="100%", thickness=1.5, color=PRIMARY_COLOR, spaceBefore=0, spaceAfter=4 * mm)]


def generate_expense_receipt_pdf(
    company: dict,
    expense: dict,
    disbursements: list[dict],
    generated_by: str = "Tesorería"
) -> bytes:
    """Genera el Recibo Oficial / Orden de Pago de Gasto Individual con detalle fiscal, cuentas y firmas."""
    buf = BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        leftMargin=15 * mm,
        rightMargin=15 * mm,
        topMargin=15 * mm,
        bottomMargin=18 * mm
    )

    styles = _get_styles()
    story = []

    exp_id = str(expense.get("id") or "")[:8].upper()
    doc_code = f"REC-GAS-{exp_id}"
    story.extend(_build_corporate_header(company, "RECIBO OFICIAL DE GASTO", doc_code, styles))

    # ── 1. Resumen y Datos del Comprobante Fiscal ─────────────────────────────
    monto_total = float(expense.get("monto") or 0)
    estado = str(expense.get("estado") or "pendiente").upper()
    estado_badge = (
        f"<font color='#15803D'><b>PAGADO</b></font>" if estado == "PAGADO"
        else (f"<font color='#2563EB'><b>APROBADO</b></font>" if estado == "APROBADO"
              else f"<font color='#B45309'><b>PENDIENTE</b></font>")
    )

    factura_num = expense.get("numero_factura") or "S/F"
    timbrado_val = expense.get("timbrado") or "S/T"
    proveedor_val = expense.get("proveedor") or "PROVEEDOR VARIOS / CAJA CHICA"
    ruc_val = expense.get("ruc") or "SIN RUC"
    tipo_comp = expense.get("tipo_comprobante") or "FACTURA_CONTADO"
    fecha_gasto = _format_date(expense.get("fecha_gasto"))
    fecha_pago = _format_date(expense.get("fecha_pago")) if expense.get("fecha_pago") else "Pendiente de Liquidación"
    cost_center = expense.get("cost_center_nombre") or "Administración General"
    descripcion = expense.get("descripcion") or "Sin concepto descriptivo"
    forma_pago_resumen = expense.get("forma_pago_resumen") or "A Definir en Liquidación"

    info_data = [
        [
            Paragraph(f"<b>Proveedor / Beneficiario:</b><br/>{proveedor_val}", styles["body"]),
            Paragraph(f"<b>R.U.C. Proveedor:</b><br/>{ruc_val}", styles["body"]),
            Paragraph(f"<b>Comprobante Fiscal:</b><br/>{tipo_comp.replace('_', ' ')} N° {factura_num}", styles["body"]),
            Paragraph(f"<b>Timbrado N°:</b><br/>{timbrado_val}", styles["body"]),
        ],
        [
            Paragraph(f"<b>Centro de Costo / Sector:</b><br/>{cost_center}", styles["body"]),
            Paragraph(f"<b>Fecha de Gasto:</b><br/>{fecha_gasto}", styles["body"]),
            Paragraph(f"<b>Fecha de Pago:</b><br/>{fecha_pago}", styles["body"]),
            Paragraph(f"<b>Estado del Gasto:</b><br/>{estado_badge}", styles["body"]),
        ],
        [
            Paragraph(f"<b>Concepto / Justificación del Gasto:</b><br/>{descripcion}", styles["body"]),
            "",
            Paragraph(f"<b>Forma de Pago Resumen:</b><br/>{forma_pago_resumen}", styles["body"]),
            Paragraph(f"<b>Monto Total Gs.:</b><br/><font size=11 color='#0F172A'><b>₲ {_format_gs(monto_total)}</b></font>", styles["body_right_bold"]),
        ]
    ]

    t_info = Table(info_data, colWidths=[55 * mm, 38 * mm, 47 * mm, 40 * mm])
    t_info.setStyle(TableStyle([
        ("SPAN", (0, 2), (1, 2)),
        ("BACKGROUND", (0, 0), (-1, -1), GRAY_LIGHT),
        ("BOX", (0, 0), (-1, -1), 0.75, GRAY_BORDER),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, GRAY_BORDER),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ]))
    story.append(t_info)
    story.append(Spacer(1, 4 * mm))

    # ── 2. Desglose Fiscal DNIT / SET (Paraguay) ──────────────────────────────
    grav10 = float(expense.get("gravado_10") or 0)
    iva10 = float(expense.get("iva_10") or 0)
    grav5 = float(expense.get("gravado_5") or 0)
    iva5 = float(expense.get("iva_5") or 0)
    exen = float(expense.get("exentas") or 0)

    story.append(Paragraph("<b>1. DESGLOSE IMPOSITIVO Y FISCAL (DNIT - PARAGUAY)</b>", styles["section_h1"]))
    story.append(Spacer(1, 1.5 * mm))

    fiscal_data = [
        [
            Paragraph("Gravado IVA 10%", styles["table_header"]),
            Paragraph("Liquidación IVA 10%", styles["table_header_right"]),
            Paragraph("Gravado IVA 5%", styles["table_header_right"]),
            Paragraph("Liquidación IVA 5%", styles["table_header_right"]),
            Paragraph("Exentas", styles["table_header_right"]),
            Paragraph("Total Comprobante", styles["table_header_right"]),
        ],
        [
            Paragraph(f"₲ {_format_gs(grav10)}", styles["body"]),
            Paragraph(f"₲ {_format_gs(iva10)}", styles["body_right"]),
            Paragraph(f"₲ {_format_gs(grav5)}", styles["body_right"]),
            Paragraph(f"₲ {_format_gs(iva5)}", styles["body_right"]),
            Paragraph(f"₲ {_format_gs(exen)}", styles["body_right"]),
            Paragraph(f"<b>₲ {_format_gs(monto_total)}</b>", styles["body_right_bold"]),
        ]
    ]

    t_fiscal = Table(fiscal_data, colWidths=[33 * mm, 29 * mm, 29 * mm, 29 * mm, 28 * mm, 32 * mm])
    t_fiscal.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), PRIMARY_COLOR),
        ("BACKGROUND", (0, 1), (-1, 1), WHITE),
        ("BOX", (0, 0), (-1, -1), 0.75, GRAY_BORDER),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, GRAY_BORDER),
        ("TOPPADDING", (0, 0), (-1, -1), 3.5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3.5),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
    ]))
    story.append(t_fiscal)
    story.append(Spacer(1, 4 * mm))

    # ── 3. Medios de Pago & Cuentas Vinculadas ────────────────────────────────
    story.append(Paragraph("<b>2. LIQUIDACIÓN Y CUENTAS VINCULADAS (FORMAS DE DESEMBOLSO)</b>", styles["section_h1"]))
    story.append(Spacer(1, 1.5 * mm))

    disb_headers = [
        Paragraph("Medio / Canal", styles["table_header"]),
        Paragraph("Cuenta Origen / Fondo / Banco", styles["table_header"]),
        Paragraph("Referencia / N° Comprobante / Cheque", styles["table_header"]),
        Paragraph("Fecha Valor", styles["table_header_center"]),
        Paragraph("Monto Liquidado Gs.", styles["table_header_right"]),
    ]
    disb_rows = [disb_headers]

    if disbursements:
        for d in disbursements:
            fp = (d.get("medio_pago") or "").upper()
            detalles = d.get("detalles") or {}
            
            canal_label = fp
            cuenta_label = "-"
            ref_label = d.get("numero_comprobante") or "-"

            if fp in ("BOVEDA", "EFECTIVO_BOVEDA"):
                canal_label = "BÓVEDA CENTRAL"
                cuenta_label = "Efectivo Tesorería Central (PYG)"
                ref_label = ref_label if ref_label != "-" else "Retiro Físico Bóveda"
            elif fp in ("FONDO_FIJO", "CAJA_CHICA"):
                canal_label = "FONDO FIJO / CAJA CHICA"
                cuenta_label = "Fondo de Gastos Menores Operativos"
                ref_label = ref_label if ref_label != "-" else "Comprobante de Caja Chica"
            elif fp in ("TRANSFERENCIA", "BANCO_TRANSFERENCIA", "SIPAP"):
                canal_label = "TRANSFERENCIA BANCARIA"
                cuenta_label = "Cuenta Bancaria Empresa (SIPAP)"
                ref_label = f"Ref. SIPAP: {ref_label}"
            elif fp == "CHEQUE":
                canal_label = "CHEQUE PROPIO EMITIDO"
                banco_chk = detalles.get("banco_cheque") or "Banco Emisor"
                cuenta_label = f"{banco_chk}"
                es_dif = detalles.get("es_diferido")
                venc = detalles.get("fecha_vencimiento") or ""
                dif_text = f" (Diferido Vto: {venc})" if es_dif and venc else " (Al Día)"
                ref_label = f"Cheque N° {d.get('numero_comprobante') or detalles.get('numero_cheque') or ''}{dif_text}"

            monto_linea = float(d.get("monto") or 0)
            fecha_linea = _format_date(d.get("fecha_efectiva"))

            disb_rows.append([
                Paragraph(f"<b>{canal_label}</b>", styles["body"]),
                Paragraph(cuenta_label, styles["body"]),
                Paragraph(ref_label, styles["body"]),
                Paragraph(fecha_linea, styles["body"]),
                Paragraph(f"₲ {_format_gs(monto_linea)}", styles["body_right_bold"]),
            ])
    else:
        disb_rows.append([
            Paragraph("<i>Sin desembolsos asentados</i>", styles["body"]),
            Paragraph("-", styles["body"]),
            Paragraph("-", styles["body"]),
            Paragraph("-", styles["body"]),
            Paragraph(f"₲ {_format_gs(monto_total)}", styles["body_right"]),
        ])

    t_disb = Table(disb_rows, colWidths=[45 * mm, 48 * mm, 45 * mm, 20 * mm, 22 * mm])
    t_disb.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), PRIMARY_COLOR),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [WHITE, GRAY_LIGHT]),
        ("BOX", (0, 0), (-1, -1), 0.75, GRAY_BORDER),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, GRAY_BORDER),
        ("TOPPADDING", (0, 0), (-1, -1), 3.5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3.5),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
    ]))
    story.append(t_disb)
    story.append(Spacer(1, 8 * mm))

    # ── 4. Cuadro de 4 Firmas de Auditoría y Control Interno ──────────────────
    story.append(KeepTogether([
        Paragraph("<b>3. CONSTANCIA DE AUDITORÍA, CONFORMIDAD Y FIRMAS OFICIALES</b>", styles["section_h1"]),
        Spacer(1, 2 * mm),
        Paragraph(
            "<font size=7 color='#64748B'>El presente documento certifica la erogación de fondos corporativos para el concepto descripto, "
            "bajo estricto control de legalidad, asignación de cuentas y comprobante fiscal conforme a normativas de la DNIT y políticas de Tesorería.</font>",
            styles["body"]
        ),
        Spacer(1, 8 * mm),
        Table([
            [
                Paragraph("<b>SOLICITADO POR</b><br/><font size=7 color='#64748B'>Responsable de Gasto</font>", styles["footer_text"]),
                Paragraph("<b>APROBADO POR</b><br/><font size=7 color='#64748B'>Gerencia / Control Interno</font>", styles["footer_text"]),
                Paragraph("<b>PAGADO POR</b><br/><font size=7 color='#64748B'>Tesorería / Finanzas</font>", styles["footer_text"]),
                Paragraph("<b>RECIBÍ CONFORME</b><br/><font size=7 color='#64748B'>Proveedor / Beneficiario</font>", styles["footer_text"]),
            ],
            [
                Paragraph("<br/><br/>___________________________<br/>Firma y Aclaración", styles["footer_text"]),
                Paragraph("<br/><br/>___________________________<br/>Firma y Aclaración", styles["footer_text"]),
                Paragraph("<br/><br/>___________________________<br/>Firma y Aclaración", styles["footer_text"]),
                Paragraph("<br/><br/>___________________________<br/>Firma, C.I. y Fecha", styles["footer_text"]),
            ]
        ], colWidths=[45 * mm, 45 * mm, 45 * mm, 45 * mm], style=[
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("TOPPADDING", (0, 0), (-1, -1), 2),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
            ("LEFTPADDING", (0, 0), (-1, -1), 2),
            ("RIGHTPADDING", (0, 0), (-1, -1), 2),
        ])
    ]))

    doc.build(
        story,
        canvasmaker=lambda *args, **kwargs: _NumberedCanvas(*args, footer_left=f"Comprobante Oficial de Gasto {doc_code} — InteliMarket Tesorería", **kwargs)
    )
    return buf.getvalue()


def generate_expenses_analytical_report_pdf(
    company: dict,
    expenses: list[dict],
    filters: dict,
    generated_by: str = "Tesorería"
) -> bytes:
    """Genera el Reporte Analítico Consolidado de Gastos en PDF con filtros, KPIs y grilla detallada."""
    buf = BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        leftMargin=12 * mm,
        rightMargin=12 * mm,
        topMargin=14 * mm,
        bottomMargin=16 * mm
    )

    styles = _get_styles()
    story = []

    f_desde = _format_date(filters.get("desde")) if filters.get("desde") else "Inicio"
    f_hasta = _format_date(filters.get("hasta")) if filters.get("hasta") else "Hoy"
    doc_code = f"REP-GAS-{datetime.now(ASUNCION_TZ).strftime('%Y%m%d')}"

    story.extend(_build_corporate_header(company, "REPORTE ANALÍTICO CONSOLIDADO DE GASTOS", doc_code, styles))

    # ── Parámetros de Filtro ──────────────────────────────────────────────────
    f_estado = (filters.get("estado") or "Todos").upper()
    f_sector = filters.get("cost_center_nombre") or "Todos los sectores"
    f_cat = filters.get("category_nombre") or "Todas las categorías"

    filtros_data = [
        [
            Paragraph(f"<b>Período Analizado:</b> {f_desde} al {f_hasta}", styles["body"]),
            Paragraph(f"<b>Estado Comprobantes:</b> {f_estado}", styles["body"]),
            Paragraph(f"<b>Sector / Centro de Costo:</b> {f_sector}", styles["body"]),
            Paragraph(f"<b>Categoría:</b> {f_cat}", styles["body"]),
        ]
    ]
    t_filtros = Table(filtros_data, colWidths=[50 * mm, 40 * mm, 50 * mm, 46 * mm])
    t_filtros.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), GRAY_LIGHT),
        ("BOX", (0, 0), (-1, -1), 0.5, GRAY_BORDER),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
    ]))
    story.append(t_filtros)
    story.append(Spacer(1, 3 * mm))

    # ── KPIs Ejecutivos ───────────────────────────────────────────────────────
    total_monto = 0.0
    total_pagado = 0.0
    total_pendiente = 0.0
    total_iva10 = 0.0
    count_total = len(expenses)

    for e in expenses:
        m = float(e.get("monto") or 0)
        total_monto += m
        st = str(e.get("estado") or "").lower()
        if st == "pagado":
            total_pagado += m
        else:
            total_pendiente += m
        total_iva10 += float(e.get("iva_10") or 0)

    kpi_data = [
        [
            Paragraph("Total Comprobantes", styles["subtitle"]),
            Paragraph("Total General Gastos", styles["subtitle"]),
            Paragraph("Total Pagado / Liquidado", styles["subtitle"]),
            Paragraph("Pendiente de Pago", styles["subtitle"]),
            Paragraph("Crédito Fiscal IVA 10%", styles["subtitle"]),
        ],
        [
            Paragraph(f"<b>{count_total}</b>", styles["title"]),
            Paragraph(f"<b>₲ {_format_gs(total_monto)}</b>", styles["title"]),
            Paragraph(f"<font color='#15803D'><b>₲ {_format_gs(total_pagado)}</b></font>", styles["title"]),
            Paragraph(f"<font color='#B45309'><b>₲ {_format_gs(total_pendiente)}</b></font>", styles["title"]),
            Paragraph(f"<font color='#2563EB'><b>₲ {_format_gs(total_iva10)}</b></font>", styles["title"]),
        ]
    ]
    t_kpi = Table(kpi_data, colWidths=[34 * mm, 40 * mm, 40 * mm, 38 * mm, 34 * mm])
    t_kpi.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), WHITE),
        ("BOX", (0, 0), (-1, -1), 0.75, PRIMARY_COLOR),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, GRAY_BORDER),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
    ]))
    story.append(t_kpi)
    story.append(Spacer(1, 4 * mm))

    # ── Grilla Detallada de Gastos ─────────────────────────────────────────────
    story.append(Paragraph("<b>DETALLE ANALÍTICO DE COMPROBANTES REGISTRADOS</b>", styles["section_h1"]))
    story.append(Spacer(1, 1.5 * mm))

    headers = [
        Paragraph("Fecha", styles["table_header"]),
        Paragraph("Comprobante / N°", styles["table_header"]),
        Paragraph("Proveedor / RUC", styles["table_header"]),
        Paragraph("Sector / C. Costo", styles["table_header"]),
        Paragraph("Forma de Pago", styles["table_header"]),
        Paragraph("Estado", styles["table_header_center"]),
        Paragraph("Monto Gs.", styles["table_header_right"]),
    ]
    rows = [headers]

    for e in expenses:
        f_gasto = _format_date(e.get("fecha_gasto"))
        fac = f"{e.get('tipo_comprobante', 'FAC')[:4]} {e.get('numero_factura') or 'S/N'}"
        prov = f"{e.get('proveedor') or 'S/P'}<br/><font size=6.5 color='#64748B'>{e.get('ruc') or ''}</font>"
        sector = e.get("cost_center_nombre") or "-"
        forma = e.get("forma_pago_resumen") or (e.get("tipo_pago") or "-").upper()
        est = str(e.get("estado") or "pendiente").upper()
        badge_style = styles["badge_pagado"] if est == "PAGADO" else (styles["badge_aprobado"] if est == "APROBADO" else styles["badge_pendiente"])
        monto_gs = float(e.get("monto") or 0)

        rows.append([
            Paragraph(f_gasto, styles["body"]),
            Paragraph(fac, styles["body"]),
            Paragraph(prov, styles["body"]),
            Paragraph(sector, styles["body"]),
            Paragraph(forma[:25], styles["body"]),
            Paragraph(est, badge_style),
            Paragraph(f"₲ {_format_gs(monto_gs)}", styles["body_right_bold"]),
        ])

    # Fila de Totales
    rows.append([
        Paragraph("<b>TOTALES</b>", styles["body_bold"]),
        Paragraph(f"{count_total} registros", styles["body_bold"]),
        "",
        "",
        "",
        "",
        Paragraph(f"<b>₲ {_format_gs(total_monto)}</b>", styles["body_right_bold"]),
    ])

    t_rows = Table(rows, colWidths=[18 * mm, 30 * mm, 45 * mm, 30 * mm, 28 * mm, 15 * mm, 20 * mm])
    t_rows.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), PRIMARY_COLOR),
        ("ROWBACKGROUNDS", (0, 1), (-1, -2), [WHITE, GRAY_LIGHT]),
        ("BACKGROUND", (0, -1), (-1, -1), HexColor("#F1F5F9")),
        ("LINEABOVE", (0, -1), (-1, -1), 1, PRIMARY_COLOR),
        ("BOX", (0, 0), (-1, -1), 0.75, GRAY_BORDER),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, GRAY_BORDER),
        ("TOPPADDING", (0, 0), (-1, -1), 2.5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2.5),
        ("LEFTPADDING", (0, 0), (-1, -1), 3),
        ("RIGHTPADDING", (0, 0), (-1, -1), 3),
        ("SPAN", (1, -1), (5, -1)),
    ]))
    story.append(t_rows)

    doc.build(
        story,
        canvasmaker=lambda *args, **kwargs: _NumberedCanvas(*args, footer_left=f"Reporte Consolidado de Gastos {doc_code} — Extra Supermercado", **kwargs)
    )
    return buf.getvalue()
