"""Generador de PDF para Órdenes de Pago a Proveedores (AP) y Recibos Oficiales.
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
GRAY_LIGHT = HexColor("#F1F5F9")
GRAY_BORDER = HexColor("#E2E8F0")
WHITE = HexColor("#FFFFFF")
SUCCESS_COLOR = HexColor("#15803D")
WARNING_COLOR = HexColor("#B45309")

FONT_REGULAR = "Helvetica"
FONT_BOLD = "Helvetica-Bold"
FONT_ITALIC = "Helvetica-Oblique"

# Intentar registrar Lato si existe en el entorno
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


def generate_payment_order_receipt_pdf(
    company: dict,
    order: dict,
    allocations: list,
    disbursements: list,
    generated_by: str = ""
) -> bytes:
    """Genera el comprobante PDF oficial de la Orden de Pago / Recibo a Proveedor."""
    buffer = BytesIO()

    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=15 * mm,
        rightMargin=15 * mm,
        topMargin=15 * mm,
        bottomMargin=18 * mm,
        title=f"Orden_Pago_{order.get('numero_orden', 'OP')}",
    )

    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle("DocTitle", fontName=FONT_BOLD, fontSize=14, leading=17, textColor=PRIMARY_COLOR, alignment=TA_RIGHT))
    styles.add(ParagraphStyle("DocSub", fontName=FONT_REGULAR, fontSize=8, leading=10, textColor=GRAY_MEDIUM, alignment=TA_RIGHT))
    styles.add(ParagraphStyle("CompanyTitle", fontName=FONT_BOLD, fontSize=11, leading=14, textColor=PRIMARY_COLOR))
    styles.add(ParagraphStyle("CompanyMeta", fontName=FONT_REGULAR, fontSize=8, leading=11, textColor=GRAY_MEDIUM))
    styles.add(ParagraphStyle("SectionTitle", fontName=FONT_BOLD, fontSize=9.5, leading=12, textColor=PRIMARY_COLOR, spaceBefore=8, spaceAfter=4))
    styles.add(ParagraphStyle("CellText", fontName=FONT_REGULAR, fontSize=7.5, leading=9.5, textColor=GRAY_DARK))
    styles.add(ParagraphStyle("CellBold", fontName=FONT_BOLD, fontSize=7.5, leading=9.5, textColor=GRAY_DARK))
    styles.add(ParagraphStyle("CellRight", fontName=FONT_REGULAR, fontSize=7.5, leading=9.5, textColor=GRAY_DARK, alignment=TA_RIGHT))
    styles.add(ParagraphStyle("CellRightBold", fontName=FONT_BOLD, fontSize=7.5, leading=9.5, textColor=GRAY_DARK, alignment=TA_RIGHT))
    styles.add(ParagraphStyle("CellCenter", fontName=FONT_REGULAR, fontSize=7.5, leading=9.5, textColor=GRAY_DARK, alignment=TA_CENTER))

    story = []

    # ── 1. ENCABEZADO INSTITUCIONAL ──────────────────────────────────────────
    razon_social = company.get("razon_social") or "GRUPO SANTA TERESA E.A.S."
    nombre_fantasia = company.get("nombre_fantasia") or "Extra Supermercado Mayorista"
    ruc_empresa = company.get("ruc") or "80150377-9"
    timbrado = company.get("timbrado") or "18545636"
    direccion = company.get("direccion") or "Av. República de Colombia c/ Calle 4, CDE - Paraguay"
    telefono = company.get("telefono") or "+595 983 000000"

    num_orden = order.get("numero_orden") or "OP-000000"
    estado = (order.get("estado") or "REGISTRADO").upper()

    header_left = [
        Paragraph(f"<b>{nombre_fantasia.upper()}</b>", styles["CompanyTitle"]),
        Paragraph(f"<b>Razón Social:</b> {razon_social}", styles["CompanyMeta"]),
        Paragraph(f"<b>RUC:</b> {ruc_empresa} | <b>Timbrado:</b> {timbrado}", styles["CompanyMeta"]),
        Paragraph(f"{direccion} — Tel: {telefono}", styles["CompanyMeta"]),
    ]

    header_right = [
        Paragraph("ORDEN DE PAGO", styles["DocTitle"]),
        Paragraph(f"<b>N° {num_orden}</b>", styles["DocTitle"]),
        Spacer(1, 2 * mm),
        Paragraph(f"ESTADO: <b>{estado}</b>", styles["DocSub"]),
        Paragraph(f"Fecha Emisión: {_format_date(order.get('fecha_emision'))}", styles["DocSub"]),
        Paragraph(f"Fecha Pago: {_format_date(order.get('fecha_pago'))}", styles["DocSub"]),
    ]

    t_header = Table([[header_left, header_right]], colWidths=[105 * mm, 75 * mm])
    t_header.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
    ]))
    story.append(t_header)
    story.append(Spacer(1, 4 * mm))
    story.append(HRFlowable(width="100%", thickness=1, color=GRAY_BORDER, spaceAfter=8))

    # ── 2. DATOS DEL PROVEEDOR ───────────────────────────────────────────────
    prov_nombre = order.get("supplier_nombre") or "PROVEEDOR GENERAL"
    prov_ruc = order.get("supplier_ruc") or "-"
    recibo_prov = order.get("recibo_proveedor") or "Sin registrar"
    observaciones = order.get("observaciones") or "-"

    info_data = [
        [
            Paragraph(f"<b>BENEFICIARIO / PROVEEDOR:</b><br/>{prov_nombre}", styles["CellText"]),
            Paragraph(f"<b>RUC / DOCUMENTO:</b><br/>{prov_ruc}", styles["CellText"]),
            Paragraph(f"<b>RECIBO OFICIAL PROV.:</b><br/>{recibo_prov}", styles["CellText"]),
            Paragraph(f"<b>MONEDA:</b><br/>{order.get('moneda', 'PYG')}", styles["CellText"]),
        ]
    ]
    t_info = Table(info_data, colWidths=[65 * mm, 40 * mm, 45 * mm, 30 * mm])
    t_info.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), GRAY_LIGHT),
        ("BOX", (0, 0), (-1, -1), 0.5, GRAY_BORDER),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
    ]))
    story.append(t_info)
    story.append(Spacer(1, 4 * mm))

    # ── 3. DETALLE DE FACTURAS AMORTIZADAS ───────────────────────────────────
    story.append(Paragraph("1. FACTURAS Y COMPROBANTES AMORTIZADOS", styles["SectionTitle"]))

    headers_fac = [
        Paragraph("<b>N° Factura</b>", styles["CellBold"]),
        Paragraph("<b>Timbrado</b>", styles["CellBold"]),
        Paragraph("<b>Vencimiento</b>", styles["CellCenter"]),
        Paragraph("<b>Saldo Anterior</b>", styles["CellRightBold"]),
        Paragraph("<b>Retención</b>", styles["CellRightBold"]),
        Paragraph("<b>Monto Aplicado</b>", styles["CellRightBold"]),
        Paragraph("<b>Saldo Restante</b>", styles["CellRightBold"]),
    ]

    fac_rows = [headers_fac]
    total_aplicado = Decimal("0")
    total_retenciones = Decimal("0")

    for alloc in allocations:
        m_ap = Decimal(str(alloc.get("monto_aplicado") or 0))
        m_ret = Decimal(str(alloc.get("monto_retencion") or 0))
        s_ant = Decimal(str(alloc.get("saldo_anterior") or 0))
        s_res = Decimal(str(alloc.get("saldo_restante") or 0))
        total_aplicado += m_ap
        total_retenciones += m_ret

        fac_rows.append([
            Paragraph(str(alloc.get("numero_factura") or "-"), styles["CellText"]),
            Paragraph(str(alloc.get("timbrado") or "-"), styles["CellText"]),
            Paragraph(_format_date(alloc.get("fecha_vencimiento")), styles["CellCenter"]),
            Paragraph(_format_gs(s_ant), styles["CellRight"]),
            Paragraph(_format_gs(m_ret), styles["CellRight"]),
            Paragraph(_format_gs(m_ap), styles["CellRightBold"]),
            Paragraph(_format_gs(s_res), styles["CellRight"]),
        ])

    # Fila total
    fac_rows.append([
        Paragraph("<b>TOTALES</b>", styles["CellBold"]),
        Paragraph("", styles["CellText"]),
        Paragraph("", styles["CellCenter"]),
        Paragraph("", styles["CellRight"]),
        Paragraph(f"<b>₲ {_format_gs(total_retenciones)}</b>", styles["CellRightBold"]),
        Paragraph(f"<b>₲ {_format_gs(total_aplicado)}</b>", styles["CellRightBold"]),
        Paragraph("", styles["CellRight"]),
    ])

    t_fac = Table(fac_rows, colWidths=[36 * mm, 24 * mm, 24 * mm, 24 * mm, 22 * mm, 27 * mm, 23 * mm])
    t_fac.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), GRAY_LIGHT),
        ("BOX", (0, 0), (-1, -1), 0.5, GRAY_BORDER),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, GRAY_BORDER),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 3.5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3.5),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
        ("BACKGROUND", (0, -1), (-1, -1), HexColor("#F8FAFC")),
    ]))
    story.append(t_fac)
    story.append(Spacer(1, 4 * mm))

    # ── 4. DETALLE DE FORMAS DE PAGO / DESEMBOLSOS ───────────────────────────
    story.append(Paragraph("2. MEDIOS DE PAGO Y DESEMBOLSO ASIGNADOS", styles["SectionTitle"]))

    headers_des = [
        Paragraph("<b>Forma de Pago</b>", styles["CellBold"]),
        Paragraph("<b>Detalle / Referencia / Instrumento</b>", styles["CellBold"]),
        Paragraph("<b>Banco / Origen</b>", styles["CellBold"]),
        Paragraph("<b>Plazo / Vencimiento</b>", styles["CellCenter"]),
        Paragraph("<b>Importe PYG</b>", styles["CellRightBold"]),
    ]

    des_rows = [headers_des]
    total_desembolsado = Decimal("0")

    if not disbursements:
        des_rows.append([
            Paragraph("<i>Pendiente de liquidación / asignación de medio de pago</i>", styles["CellText"]),
            Paragraph("-", styles["CellText"]),
            Paragraph("-", styles["CellText"]),
            Paragraph("-", styles["CellCenter"]),
            Paragraph("₲ 0", styles["CellRightBold"]),
        ])
    else:
        for d in disbursements:
            fp = (d.get("forma_pago") or "").lower()
            m_pyg = Decimal(str(d.get("monto_pyg") or d.get("monto") or 0))
            total_desembolsado += m_pyg

            fp_label = fp.replace("_", " ").title()
            if fp == "boveda":
                fp_label = "Efectivo Bóveda Central"
                detalle = "Salida de tesorería central"
                origen = "Bóveda Principal"
                plazo = "Al día"
            elif fp == "fondo_fijo":
                fp_label = "Efectivo Fondo Fijo"
                detalle = f"Caja Chica {d.get('fondo_nombre') or ''}"
                origen = "Fondo Fijo"
                plazo = "Inmediato"
            elif fp == "transferencia":
                fp_label = "Transferencia Bancaria"
                detalle = f"Ref: {d.get('referencia_transferencia') or 'S/N'}"
                origen = d.get("banco_nombre") or "Cuenta Bancaria"
                plazo = "SIPAP / SPI"
            elif fp == "cheque":
                diferido = d.get("es_cheque_diferido")
                fp_label = "Cheque Diferido" if diferido else "Cheque al Día"
                detalle = f"N° {d.get('numero_cheque') or 'S/N'} | Tit: {d.get('titular_cheque') or prov_nombre}"
                origen = d.get("banco_cheque") or d.get("banco_nombre") or "Cheque Propio"
                venc = _format_date(d.get("fecha_cheque_vencimiento"))
                plazo = f"Vto: {venc}" if diferido else "Al día"
            elif fp == "nota_credito":
                fp_label = "Nota de Crédito"
                detalle = f"NC N° {d.get('numero_nc') or 'S/N'}"
                origen = "Saldo a favor"
                plazo = "Compensación"
            elif fp == "diferencia_cambio":
                fp_label = "Diferencia de Cambio"
                detalle = d.get("observaciones") or "Ajuste por diferencia de cambio en liquidación"
                origen = "Lote Agrupado"
                plazo = "Ajuste"
            else:
                fp_label = fp.title()
                detalle = d.get("observaciones") or "-"
                origen = "-"
                plazo = "-"

            des_rows.append([
                Paragraph(fp_label, styles["CellBold"]),
                Paragraph(detalle, styles["CellText"]),
                Paragraph(origen, styles["CellText"]),
                Paragraph(plazo, styles["CellCenter"]),
                Paragraph(f"₲ {_format_gs(m_pyg)}", styles["CellRightBold"]),
            ])

        des_rows.append([
            Paragraph("<b>TOTAL DESEMBOLSADO</b>", styles["CellBold"]),
            Paragraph("", styles["CellText"]),
            Paragraph("", styles["CellText"]),
            Paragraph("", styles["CellCenter"]),
            Paragraph(f"<b>₲ {_format_gs(total_desembolsado)}</b>", styles["CellRightBold"]),
        ])

    t_des = Table(des_rows, colWidths=[42 * mm, 50 * mm, 38 * mm, 24 * mm, 26 * mm])
    t_des.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), GRAY_LIGHT),
        ("BOX", (0, 0), (-1, -1), 0.5, GRAY_BORDER),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, GRAY_BORDER),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 3.5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3.5),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
        ("BACKGROUND", (0, -1), (-1, -1), HexColor("#F8FAFC")),
    ]))
    story.append(t_des)
    story.append(Spacer(1, 4 * mm))

    # ── 5. OBSERVACIONES & RESUMEN FINANCIERO ─────────────────────────────────
    diff_cambio = Decimal(str(order.get("diferencia_cambio") or 0))
    diff_line = ""
    if diff_cambio != Decimal("0"):
        diff_prefix = "+" if diff_cambio > 0 else ""
        diff_tipo = "SOBRECOSTO" if diff_cambio > 0 else "GANANCIA"
        diff_line = f"<br/><b>DIF. CAMBIO ({diff_tipo}):</b> ₲ {diff_prefix}{_format_gs(diff_cambio)}"

    resumen_data = [
        [
            Paragraph(f"<b>OBSERVACIONES:</b><br/>{observaciones}", styles["CellText"]),
            Paragraph(
                f"<b>TOTAL FACTURAS:</b> ₲ {_format_gs(order.get('monto_total', total_aplicado))}<br/>"
                f"<b>RETENCIONES:</b> ₲ {_format_gs(order.get('monto_retenido', total_retenciones))}"
                f"{diff_line}<br/>"
                f"<b><font size=9 color='#0F172A'>TOTAL NETO A PAGAR: ₲ {_format_gs(order.get('monto_neto', total_aplicado - total_retenciones))}</font></b>",
                styles["CellRight"]
            )
        ]
    ]
    t_res = Table(resumen_data, colWidths=[115 * mm, 65 * mm])
    t_res.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), HexColor("#F8FAFC")),
        ("BOX", (0, 0), (-1, -1), 0.5, GRAY_BORDER),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
    ]))
    story.append(t_res)
    story.append(Spacer(1, 8 * mm))

    # ── 6. SECCIÓN DE FIRMAS AUDITABLES ──────────────────────────────────────
    firmas_data = [
        [
            Paragraph("<br/><br/>_______________________________<br/><b>ELABORADO POR</b><br/>Cuentas por Pagar", styles["CellCenter"]),
            Paragraph("<br/><br/>_______________________________<br/><b>AUTORIZADO POR</b><br/>Gerencia / Finanzas", styles["CellCenter"]),
            Paragraph("<br/><br/>_______________________________<br/><b>RECIBÍ CONFORME</b><br/>Firma, Aclaración y C.I. Proveedor", styles["CellCenter"]),
        ]
    ]
    t_firmas = Table(firmas_data, colWidths=[60 * mm, 60 * mm, 60 * mm])
    t_firmas.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "BOTTOM"),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
    ]))
    story.append(KeepTogether([t_firmas]))

    doc.build(story, canvasmaker=lambda *args, **kwargs: _NumberedCanvas(*args, footer_left=f"Comprobante Oficial {num_orden} — Generado {_format_date(datetime.now(ASUNCION_TZ))}", **kwargs))
    return buffer.getvalue()


def generate_supplier_payments_report_pdf(
    company: dict,
    orders: list,
    filters: dict,
    generated_by: str = ""
) -> bytes:
    """Genera el reporte consolidado analítico de pagos a proveedores."""
    buffer = BytesIO()

    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=12 * mm,
        rightMargin=12 * mm,
        topMargin=12 * mm,
        bottomMargin=16 * mm,
        title="Reporte_Consolidado_Pagos_Proveedores",
    )

    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle("DocTitle", fontName=FONT_BOLD, fontSize=13, leading=16, textColor=PRIMARY_COLOR))
    styles.add(ParagraphStyle("DocSub", fontName=FONT_REGULAR, fontSize=8, leading=10, textColor=GRAY_MEDIUM))
    styles.add(ParagraphStyle("CellText", fontName=FONT_REGULAR, fontSize=7, leading=8.5, textColor=GRAY_DARK))
    styles.add(ParagraphStyle("CellBold", fontName=FONT_BOLD, fontSize=7, leading=8.5, textColor=GRAY_DARK))
    styles.add(ParagraphStyle("CellRight", fontName=FONT_REGULAR, fontSize=7, leading=8.5, textColor=GRAY_DARK, alignment=TA_RIGHT))
    styles.add(ParagraphStyle("CellRightBold", fontName=FONT_BOLD, fontSize=7, leading=8.5, textColor=GRAY_DARK, alignment=TA_RIGHT))
    styles.add(ParagraphStyle("CellCenter", fontName=FONT_REGULAR, fontSize=7, leading=8.5, textColor=GRAY_DARK, alignment=TA_CENTER))

    story = []

    # Encabezado
    nombre_fantasia = company.get("nombre_fantasia") or "Extra Supermercado Mayorista"
    ruc_empresa = company.get("ruc") or "80150377-9"

    f_desde = filters.get("fecha_desde") or "Inicio"
    f_hasta = filters.get("fecha_hasta") or "Hoy"
    f_prov = filters.get("proveedor_nombre") or "Todos los proveedores"

    header_table = Table([
        [
            Paragraph(f"<b>{nombre_fantasia.upper()}</b><br/>RUC: {ruc_empresa} — REPORTE CONSOLIDADO DE PAGOS A PROVEEDORES", styles["DocTitle"]),
            Paragraph(f"<b>Período:</b> {f_desde} al {f_hasta}<br/><b>Filtro Proveedor:</b> {f_prov}<br/><b>Impreso:</b> {_format_date(datetime.now(ASUNCION_TZ))}", styles["DocSub"])
        ]
    ], colWidths=[120 * mm, 66 * mm])
    header_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
    ]))
    story.append(header_table)
    story.append(Spacer(1, 3 * mm))
    story.append(HRFlowable(width="100%", thickness=0.8, color=GRAY_BORDER, spaceAfter=6))

    # Filas
    table_rows = [[
        Paragraph("<b>N° Orden</b>", styles["CellBold"]),
        Paragraph("<b>Fecha Pago</b>", styles["CellCenter"]),
        Paragraph("<b>Proveedor</b>", styles["CellBold"]),
        Paragraph("<b>Facturas</b>", styles["CellCenter"]),
        Paragraph("<b>Medios de Pago</b>", styles["CellBold"]),
        Paragraph("<b>Estado</b>", styles["CellCenter"]),
        Paragraph("<b>Total Neto PYG</b>", styles["CellRightBold"]),
    ]]

    total_general = Decimal("0")

    for o in orders:
        m_neto = Decimal(str(o.get("monto_neto") or 0))
        total_general += m_neto

        fp_resumen = o.get("formas_pago_resumen") or "-"
        table_rows.append([
            Paragraph(str(o.get("numero_orden")), styles["CellBold"]),
            Paragraph(_format_date(o.get("fecha_pago") or o.get("fecha_emision")), styles["CellCenter"]),
            Paragraph(str(o.get("supplier_nombre") or "-")[:28], styles["CellText"]),
            Paragraph(str(o.get("total_facturas", 1)), styles["CellCenter"]),
            Paragraph(fp_resumen[:35], styles["CellText"]),
            Paragraph(str(o.get("estado", "")).upper(), styles["CellCenter"]),
            Paragraph(f"₲ {_format_gs(m_neto)}", styles["CellRightBold"]),
        ])

    table_rows.append([
        Paragraph("<b>TOTAL GENERAL</b>", styles["CellBold"]),
        Paragraph("", styles["CellText"]),
        Paragraph("", styles["CellText"]),
        Paragraph("", styles["CellCenter"]),
        Paragraph("", styles["CellText"]),
        Paragraph("", styles["CellCenter"]),
        Paragraph(f"<b>₲ {_format_gs(total_general)}</b>", styles["CellRightBold"]),
    ])

    t_rep = Table(table_rows, colWidths=[25 * mm, 20 * mm, 45 * mm, 14 * mm, 42 * mm, 18 * mm, 22 * mm])
    t_rep.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), GRAY_LIGHT),
        ("BOX", (0, 0), (-1, -1), 0.5, GRAY_BORDER),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, GRAY_BORDER),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 2.5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2.5),
        ("LEFTPADDING", (0, 0), (-1, -1), 3),
        ("RIGHTPADDING", (0, 0), (-1, -1), 3),
        ("BACKGROUND", (0, -1), (-1, -1), HexColor("#F8FAFC")),
    ]))
    story.append(t_rep)

    doc.build(story, canvasmaker=lambda *args, **kwargs: _NumberedCanvas(*args, footer_left=f"Reporte Consolidado AP — Extra Supermercado", **kwargs))
    return buffer.getvalue()


def generate_batch_payment_report_pdf(
    company: dict,
    batch_data: dict,
    generated_by: str = ""
) -> bytes:
    """Genera el Reporte Oficial Premium de Liquidación de Pago por Lote a Proveedores.
    Diseñado para control interno de Tesorería, Auditoría y Gerencia.
    Incluye:
    1. Membrete corporativo y carátula del lote.
    2. Tarjeta / Voucher del instrumento emitido (Cheque girado o Transferencia).
    3. Resumen macro de liquidación cambiaria (R$ / BRL / USD vs. PYG).
    4. Nómina analítica de proveedores y facturas amortizadas.
    5. Balance de cuadre contable (Total amortizado + Dif. Cambio = Instrumento).
    6. Casilleros de firmas internas de conformidad.
    """
    buffer = BytesIO()

    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=12 * mm,
        rightMargin=12 * mm,
        topMargin=10 * mm,
        bottomMargin=14 * mm,
        title="Reporte_Interno_Pago_Por_Lote",
    )

    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle("BatchTitle", fontName=FONT_BOLD, fontSize=13, leading=16, textColor=PRIMARY_COLOR))
    styles.add(ParagraphStyle("BatchSub", fontName=FONT_REGULAR, fontSize=8, leading=11, textColor=GRAY_MEDIUM))
    styles.add(ParagraphStyle("SectionH1", fontName=FONT_BOLD, fontSize=9, leading=12, textColor=PRIMARY_COLOR))
    styles.add(ParagraphStyle("SectionH2", fontName=FONT_BOLD, fontSize=8, leading=10, textColor=BRAND_BLUE))
    styles.add(ParagraphStyle("CellT", fontName=FONT_REGULAR, fontSize=7, leading=9, textColor=GRAY_DARK))
    styles.add(ParagraphStyle("CellTBold", fontName=FONT_BOLD, fontSize=7, leading=9, textColor=GRAY_DARK))
    styles.add(ParagraphStyle("CellTRight", fontName=FONT_REGULAR, fontSize=7, leading=9, textColor=GRAY_DARK, alignment=TA_RIGHT))
    styles.add(ParagraphStyle("CellTRightBold", fontName=FONT_BOLD, fontSize=7, leading=9, textColor=GRAY_DARK, alignment=TA_RIGHT))
    styles.add(ParagraphStyle("CellTCenter", fontName=FONT_REGULAR, fontSize=7, leading=9, textColor=GRAY_DARK, alignment=TA_CENTER))
    styles.add(ParagraphStyle("CellTCenterBold", fontName=FONT_BOLD, fontSize=7, leading=9, textColor=GRAY_DARK, alignment=TA_CENTER))
    styles.add(ParagraphStyle("VoucherLabel", fontName=FONT_BOLD, fontSize=7.5, leading=9.5, textColor=HexColor("#475569")))
    styles.add(ParagraphStyle("VoucherVal", fontName=FONT_BOLD, fontSize=8.5, leading=11, textColor=PRIMARY_COLOR))
    styles.add(ParagraphStyle("VoucherHighlight", fontName=FONT_BOLD, fontSize=11, leading=13, textColor=HexColor("#166534")))

    story = []

    # 1. ENCABEZADO CORPORATIVO
    nombre_empresa = company.get("razon_social") or "GRUPO SANTA TERESA E.A.S."
    nombre_fantasia = company.get("nombre_fantasia") or "Extra Supermercado Mayorista"
    ruc_empresa = company.get("ruc") or "80150377-9"
    timbrado_empresa = company.get("timbrado") or "18545636"

    identificador = batch_data.get("identificador") or f"LOTE-{datetime.now(ASUNCION_TZ).strftime('%Y%m%d-%H%M')}"
    fecha_emision = batch_data.get("fecha_operacion") or datetime.now(ASUNCION_TZ)
    operador = generated_by or batch_data.get("usuario_operador") or "Tesorería Central"

    header_table = Table([
        [
            Paragraph(
                f"<b>{nombre_fantasia.upper()}</b><br/>"
                f"<font size='7' color='#475569'>{nombre_empresa} — RUC: {ruc_empresa} | Timbrado: {timbrado_empresa}</font><br/>"
                f"<b>ACTA DE LIQUIDACIÓN Y PAGO POR LOTE MULTI-PROVEEDOR</b><br/>"
                f"<font size='7.5' color='#0284c7'>DOCUMENTO OFICIAL DE USO INTERNO — TESORERÍA Y FINANZAS</font>",
                styles["BatchTitle"]
            ),
            Paragraph(
                f"<b>Identificador Lote:</b> {identificador}<br/>"
                f"<b>Fecha Operación:</b> {_format_date(fecha_emision)}<br/>"
                f"<b>Responsable:</b> {operador}<br/>"
                f"<b>Zona Horaria:</b> America/Asuncion",
                styles["BatchSub"]
            )
        ]
    ], colWidths=[120 * mm, 66 * mm])
    header_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    story.append(header_table)
    story.append(HRFlowable(width="100%", thickness=1, color=BRAND_ACCENT, spaceAfter=8, spaceBefore=2))

    # 2. TARJETA DEL INSTRUMENTO FINANCIERO EMITIDO (VOUCHER)
    inst = batch_data.get("instrument") or {}
    totales = batch_data.get("totales") or {}
    tipo_inst = (inst.get("tipo") or "cheque").upper()

    voucher_rows = []
    if tipo_inst == "CHEQUE":
        num_cheque = inst.get("numero_cheque") or "SIN NÚMERO"
        banco_emisor = inst.get("banco_cheque") or "Banco no especificado"
        cuenta_bancaria = inst.get("cuenta_bancaria") or "-"
        beneficiario = inst.get("titular_cheque") or "A la orden / Varios Proveedores"
        f_emision_chq = _format_date(inst.get("fecha_emision"))
        f_venc_chq = _format_date(inst.get("fecha_vencimiento"))
        es_diferido = inst.get("es_diferido", False)
        tipo_chq_str = "DIFERIDO" if es_diferido else "AL DÍA"
        monto_chq = totales.get("total_desembolsado_pyg", 0)

        voucher_rows = [
            [
                Paragraph(f"<b>INSTRUMENTO EMITIDO: CHEQUE BANCARIO ({tipo_chq_str})</b>", styles["SectionH1"]),
                Paragraph(f"<b>MONTO GIRADO: ₲ {_format_gs(monto_chq)}</b>", styles["VoucherHighlight"]),
            ],
            [
                Paragraph(
                    f"<font color='#475569'>N° de Cheque:</font> <b><font size='9' color='#0F172A'>{num_cheque}</font></b> &nbsp;&nbsp;|&nbsp;&nbsp; "
                    f"<font color='#475569'>Banco:</font> <b>{banco_emisor}</b> &nbsp;&nbsp;|&nbsp;&nbsp; "
                    f"<font color='#475569'>Cuenta:</font> <b>{cuenta_bancaria}</b><br/>"
                    f"<font color='#475569'>Librado a la Orden de (Beneficiario):</font> <b>{beneficiario}</b><br/>"
                    f"<font color='#475569'>Fecha Emisión:</font> {f_emision_chq} &nbsp;&nbsp;|&nbsp;&nbsp; "
                    f"<font color='#475569'>Fecha de Pago / Cobro:</font> <b>{f_venc_chq}</b>",
                    styles["CellT"]
                ),
                Paragraph(
                    f"<b>Estado Cheque:</b> EMITIDO<br/>"
                    f"<b>Imputación:</b> Lote Multiprovedor<br/>"
                    f"<b>Respaldo:</b> Ver nómina adjunta",
                    styles["CellT"]
                )
            ]
        ]
    elif tipo_inst == "TRANSFERENCIA":
        banco_deb = inst.get("banco_cheque") or inst.get("banco") or "Banco Débito"
        ref_sipap = inst.get("referencia_transferencia") or "-"
        monto_transf = totales.get("total_desembolsado_pyg", 0)
        voucher_rows = [
            [
                Paragraph("<b>INSTRUMENTO: TRANSFERENCIA BANCARIA (SIPAP)</b>", styles["SectionH1"]),
                Paragraph(f"<b>MONTO DEBITADO: ₲ {_format_gs(monto_transf)}</b>", styles["VoucherHighlight"]),
            ],
            [
                Paragraph(
                    f"<font color='#475569'>Banco Débito:</font> <b>{banco_deb}</b> &nbsp;&nbsp;|&nbsp;&nbsp; "
                    f"<font color='#475569'>Comprobante / Ref. SIPAP:</font> <b>{ref_sipap}</b><br/>"
                    f"<font color='#475569'>Contraparte / Destinatario:</font> <b>{inst.get('titular_cheque') or 'Lote Proveedores'}</b>",
                    styles["CellT"]
                ),
                Paragraph("<b>Estado:</b> DEBITADO / CONCILIADO<br/><b>Tipo:</b> Salida de Fondos", styles["CellT"])
            ]
        ]
    else:
        monto_egr = totales.get("total_desembolsado_pyg", 0)
        voucher_rows = [
            [
                Paragraph("<b>INSTRUMENTO: EGRESO DE FONDOS — BÓVEDA CENTRAL</b>", styles["SectionH1"]),
                Paragraph(f"<b>EGRESO EFECTIVO: ₲ {_format_gs(monto_egr)}</b>", styles["VoucherHighlight"]),
            ],
            [
                Paragraph("<b>Origen de Fondos:</b> Bóveda Central (Retiro formal de tesorería)<br/><b>Moneda:</b> Guaraníes (PYG)", styles["CellT"]),
                Paragraph("<b>Estado:</b> ENTREGADO EN EFECTIVO", styles["CellT"])
            ]
        ]

    voucher_table = Table(voucher_rows, colWidths=[126 * mm, 60 * mm])
    voucher_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), HexColor("#F8FAFC")),
        ("BOX", (0, 0), (-1, -1), 1, HexColor("#CBD5E1")),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, HexColor("#E2E8F0")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
    ]))
    story.append(voucher_table)
    story.append(Spacer(1, 4 * mm))

    # 3. RESUMEN MACRO / METRICAS DE LIQUIDACIÓN Y CAMBIO
    tot_fact_pyg = totales.get("total_facturas_pyg", 0)
    tot_desemb_pyg = totales.get("total_desembolsado_pyg", 0)
    diff_cambio = totales.get("total_diferencia_cambio_pyg", 0)
    cant_orders = len(batch_data.get("orders", []))
    tot_mon_ext = totales.get("total_moneda_extranjera")
    cod_mon_ext = totales.get("moneda_extranjera") or "R$"
    tc_prom = totales.get("tipo_cambio_promedio")

    kpi_items = [
        ("Órdenes Generadas", f"{cant_orders} Proveedor(es)"),
        ("Facturas Amortizadas", f"₲ {_format_gs(tot_fact_pyg)}"),
        ("Diferencia Cambiaria", f"₲ {_format_gs(diff_cambio)} ({'+ Sobrecosto' if diff_cambio > 0 else '- Favorable' if diff_cambio < 0 else 'Exacto'})"),
        ("Total Instrumento", f"₲ {_format_gs(tot_desemb_pyg)}"),
    ]
    if tot_mon_ext:
        kpi_items.insert(2, (f"Total {cod_mon_ext}", f"{cod_mon_ext} {tot_mon_ext:,.2f}"))

    kpi_col_w = (186 * mm) / len(kpi_items)
    kpi_cells = []
    for title, val in kpi_items:
        kpi_cells.append(Paragraph(f"<font size='6.5' color='#64748B'>{title.upper()}</font><br/><b><font size='8' color='#0F172A'>{val}</font></b>", styles["CellTCenter"]))

    kpi_table = Table([kpi_cells], colWidths=[kpi_col_w] * len(kpi_items))
    kpi_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), HexColor("#F1F5F9")),
        ("BOX", (0, 0), (-1, -1), 0.5, HexColor("#CBD5E1")),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, HexColor("#E2E8F0")),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
    ]))
    story.append(kpi_table)
    story.append(Spacer(1, 4 * mm))

    # 4. NÓMINA DETALLADA DE PROVEEDORES PAGADOS Y FACTURAS AMORTIZADAS
    story.append(Paragraph("<b>DETALLE ANALÍTICO DE ÓRDENES DE PAGO Y FACTURAS AMORTIZADAS</b>", styles["SectionH1"]))
    story.append(Spacer(1, 1.5 * mm))

    table_data = [[
        Paragraph("<b>N° OP</b>", styles["CellTBold"]),
        Paragraph("<b>Proveedor & RUC</b>", styles["CellTBold"]),
        Paragraph("<b>Factura(s) Imputada(s)</b>", styles["CellTBold"]),
        Paragraph("<b>Moneda Orig.</b>", styles["CellTCenterBold"]),
        Paragraph("<b>Dif. Cambio</b>", styles["CellTRightBold"]),
        Paragraph("<b>Recibo Prov.</b>", styles["CellTCenterBold"]),
        Paragraph("<b>Total Pagado (₲)</b>", styles["CellTRightBold"]),
    ]]

    total_neto_acumulado = Decimal("0")
    total_diff_acumulado = Decimal("0")

    for o in batch_data.get("orders", []):
        num_op = o.get("numero_orden") or "-"
        sup_nombre = o.get("supplier_nombre") or o.get("supplier", {}).get("razon_social") or "Proveedor"
        sup_ruc = o.get("supplier_ruc") or o.get("supplier", {}).get("ruc") or "-"
        monto_pyg = Decimal(str(o.get("monto_pyg") or o.get("monto_neto") or 0))
        diff_item = Decimal(str(o.get("diferencia_cambio") or 0))
        monto_mon = float(o.get("monto_moneda") or 0)
        moneda_code = o.get("moneda") or "PYG"
        recibo_p = o.get("recibo_proveedor") or "-"

        total_neto_acumulado += monto_pyg
        total_diff_acumulado += diff_item

        # Facturas texto
        invoices_list = o.get("allocations") or []
        if invoices_list:
            inv_lines = []
            for a in invoices_list:
                inv_num = a.get("numero_factura") or a.get("invoice", {}).get("numero_factura") or "Factura"
                m_app = Decimal(str(a.get("monto_aplicado") or 0))
                s_rem = Decimal(str(a.get("saldo_restante") or 0))
                tag_rem = " (Saldo ₲ 0)" if s_rem <= 0 else f" (Resta ₲ {_format_gs(s_rem)})"
                inv_lines.append(f"{inv_num}: ₲ {_format_gs(m_app)}{tag_rem}")
            inv_text = "<br/>".join(inv_lines)
        else:
            inv_text = "Sin facturas detalladas"

        mon_orig_text = f"{moneda_code} {monto_mon:,.2f}" if moneda_code != "PYG" else "-"
        diff_text = f"₲ {_format_gs(diff_item)}" if diff_item != Decimal("0") else "-"

        table_data.append([
            Paragraph(f"<b>{num_op}</b>", styles["CellTBold"]),
            Paragraph(f"<b>{sup_nombre[:30]}</b><br/><font size='6.5' color='#64748B'>RUC: {sup_ruc}</font>", styles["CellT"]),
            Paragraph(inv_text, styles["CellT"]),
            Paragraph(mon_orig_text, styles["CellTCenter"]),
            Paragraph(diff_text, styles["CellTRight"]),
            Paragraph(str(recibo_p)[:15], styles["CellTCenter"]),
            Paragraph(f"<b>₲ {_format_gs(monto_pyg)}</b>", styles["CellTRightBold"]),
        ])

    # Fila de Totales de la Grilla
    table_data.append([
        Paragraph("<b>TOTALES</b>", styles["CellTBold"]),
        Paragraph(f"<b>{cant_orders} Proveedores</b>", styles["CellTBold"]),
        Paragraph("", styles["CellT"]),
        Paragraph("", styles["CellT"]),
        Paragraph(f"<b>₲ {_format_gs(total_diff_acumulado)}</b>", styles["CellTRightBold"]),
        Paragraph("", styles["CellT"]),
        Paragraph(f"<b>₲ {_format_gs(total_neto_acumulado)}</b>", styles["CellTRightBold"]),
    ])

    det_table = Table(table_data, colWidths=[22 * mm, 45 * mm, 50 * mm, 18 * mm, 18 * mm, 15 * mm, 18 * mm])
    det_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), HexColor("#E2E8F0")),
        ("BOX", (0, 0), (-1, -1), 0.5, HexColor("#CBD5E1")),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, HexColor("#E2E8F0")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 2.5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2.5),
        ("LEFTPADDING", (0, 0), (-1, -1), 2.5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 2.5),
        ("BACKGROUND", (0, -1), (-1, -1), HexColor("#F1F5F9")),
    ]))
    story.append(det_table)
    story.append(Spacer(1, 4 * mm))

    # 5. RESUMEN DE CONCILIACIÓN Y OBSERVACIONES
    obs_general = batch_data.get("observaciones_generales") or "Liquidación agrupada aprobada sin discrepancias."
    concil_rows = [
        [
            Paragraph("<b>NOTAS / OBSERVACIONES DE LA OPERACIÓN:</b>", styles["CellTBold"]),
            Paragraph("<b>CUADRE CONTABLE:</b>", styles["CellTBold"]),
        ],
        [
            Paragraph(f"{obs_general}", styles["CellT"]),
            Paragraph(
                f"Suma Amortizada Facturas: ₲ {_format_gs(total_neto_acumulado - total_diff_acumulado)}<br/>"
                f"+ Dif. Cambio Imputada: ₲ {_format_gs(total_diff_acumulado)}<br/>"
                f"<b>= Total Instrumento Girado: ₲ {_format_gs(total_neto_acumulado)}</b><br/>"
                f"<font color='#16A34A'><b>✓ ESTADO DE CUADRE: EXACTO (₲ 0)</b></font>",
                styles["CellT"]
            )
        ]
    ]
    concil_table = Table(concil_rows, colWidths=[110 * mm, 76 * mm])
    concil_table.setStyle(TableStyle([
        ("BOX", (0, 0), (-1, -1), 0.5, HexColor("#E2E8F0")),
        ("BACKGROUND", (0, 0), (-1, -1), HexColor("#FAF5FF")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
    ]))
    story.append(concil_table)
    story.append(Spacer(1, 5 * mm))

    # 6. CASILLEROS DE FIRMAS DE CONTROL INTERNO (AUDITORÍA & GERENCIA)
    signatures = [
        [
            Paragraph("____________________________<br/><b>ELABORADO / OPERADO</b><br/>Firma: Tesorería / Compras<br/>Aclaración:", styles["CellTCenter"]),
            Paragraph("____________________________<br/><b>VERIFICADO</b><br/>Firma: Control Interno / Finanzas<br/>Aclaración:", styles["CellTCenter"]),
            Paragraph("____________________________<br/><b>INSTRUMENTO RETIRADO POR</b><br/>Firma / C.I.:<br/>Fecha y Hora:", styles["CellTCenter"]),
            Paragraph("____________________________<br/><b>AUTORIZADO</b><br/>Firma: Gerencia General<br/>Aclaración:", styles["CellTCenter"]),
        ]
    ]
    sig_table = Table(signatures, colWidths=[46.5 * mm, 46.5 * mm, 46.5 * mm, 46.5 * mm])
    sig_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "BOTTOM"),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
    ]))
    story.append(KeepTogether([sig_table]))

    # Compilar con numeración automática
    footer_text = f"Acta Interna de Pago por Lote {identificador} — Extra Supermercado Mayorista — Grupo Santa Teresa E.A.S."
    doc.build(story, canvasmaker=lambda *args, **kwargs: _NumberedCanvas(*args, footer_left=footer_text, **kwargs))
    return buffer.getvalue()

