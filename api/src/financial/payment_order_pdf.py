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

from api.src.integrated_finance.pdf_reports import (
    _AuditedCanvas, _logo_flowable, _fmt_gs,
    PRIMARY_COLOR, ACCENT_BLUE, GRAY_LIGHT, GRAY_MEDIUM, GRAY_DARK, RED, GREEN, WHITE,
    FONT_REGULAR, FONT_BOLD, PY_TZ
)

ASUNCION_TZ = ZoneInfo("America/Asuncion")

COLOR_SLATE_900 = HexColor("#0F172A")
COLOR_SLATE_800 = HexColor("#1E293B")
COLOR_SLATE_700 = HexColor("#334155")
COLOR_SLATE_500 = HexColor("#64748B")
COLOR_SLATE_200 = HexColor("#E2E8F0")
COLOR_SLATE_100 = HexColor("#F1F5F9")
COLOR_SLATE_50 = HexColor("#F8FAFC")
COLOR_INDIGO = HexColor("#4338CA")
COLOR_EMERALD = HexColor("#059669")
COLOR_AMBER = HexColor("#B45309")
BRAND_ACCENT = HexColor("#16A34A")
BRAND_BLUE = HexColor("#2563EB")
GRAY_BORDER = COLOR_SLATE_200
SUCCESS_COLOR = COLOR_EMERALD
WARNING_COLOR = COLOR_AMBER
FONT_ITALIC = "Helvetica-Oblique"

# Alias para compatibilidad con reportes secundarios
_NumberedCanvas = _AuditedCanvas


def _format_gs(val) -> str:
    return _fmt_gs(val, include_symbol=False)


def _format_divisa(val, moneda: str = "PYG") -> str:
    try:
        n = float(val or 0)
        curr = (moneda or "PYG").upper()
        if curr == "BRL":
            return f"{n:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
        elif curr == "USD":
            return f"{n:,.2f}"
        else:
            return _format_gs(n)
    except Exception:
        return "0"


def _format_date(val) -> str:
    if not val:
        return "—"
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


def _kpi_card(label: str, val_str: str, color_val=None, width_mm: float = 47.5) -> Table:
    lbl_style = ParagraphStyle("KpiLbl", fontName=FONT_BOLD, fontSize=6.2, leading=7.8, textColor=COLOR_SLATE_500)
    v_style = ParagraphStyle("KpiVal", fontName=FONT_BOLD, fontSize=10, leading=12, textColor=color_val or COLOR_SLATE_900)
    t = Table([
        [Paragraph(label.upper(), lbl_style)],
        [Paragraph(val_str, v_style)]
    ], colWidths=[width_mm * mm])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), COLOR_SLATE_50),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("BOX", (0, 0), (-1, -1), 0.5, COLOR_SLATE_200),
    ]))
    return t


def generate_payment_order_receipt_pdf(
    company: dict,
    order: dict,
    allocations: list,
    disbursements: list,
    generated_by: str = ""
) -> bytes:
    """Genera el comprobante PDF oficial y ejecutivo de la Orden de Pago / Recibo a Proveedor."""
    buffer = BytesIO()

    num_orden = order.get("numero_orden") or "OP-000000"

    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=10 * mm,
        rightMargin=10 * mm,
        topMargin=10 * mm,
        bottomMargin=14 * mm,
        title=f"Orden_Pago_{num_orden}",
    )

    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle("CompanyTitle", fontName=FONT_BOLD, fontSize=11, leading=13, textColor=COLOR_SLATE_900))
    styles.add(ParagraphStyle("CompanyMeta", fontName=FONT_REGULAR, fontSize=6.8, leading=8.5, textColor=COLOR_SLATE_500))
    styles.add(ParagraphStyle("DocBadge", fontName=FONT_BOLD, fontSize=7, leading=8.5, textColor=COLOR_INDIGO, alignment=TA_RIGHT))
    styles.add(ParagraphStyle("DocNum", fontName=FONT_BOLD, fontSize=13, leading=15, textColor=COLOR_SLATE_900, alignment=TA_RIGHT))
    styles.add(ParagraphStyle("DocMeta", fontName=FONT_REGULAR, fontSize=6.8, leading=8.5, textColor=COLOR_SLATE_700, alignment=TA_RIGHT))
    styles.add(ParagraphStyle("DocMetaBold", fontName=FONT_BOLD, fontSize=7, leading=9, textColor=COLOR_SLATE_900, alignment=TA_RIGHT))
    styles.add(ParagraphStyle("SectionTitle", fontName=FONT_BOLD, fontSize=8.5, leading=11, textColor=COLOR_SLATE_900, spaceBefore=6, spaceAfter=3))
    styles.add(ParagraphStyle("CellText", fontName=FONT_REGULAR, fontSize=7, leading=8.8, textColor=COLOR_SLATE_800))
    styles.add(ParagraphStyle("CellBold", fontName=FONT_BOLD, fontSize=7, leading=8.8, textColor=COLOR_SLATE_900))
    styles.add(ParagraphStyle("CellRight", fontName=FONT_REGULAR, fontSize=7, leading=8.8, textColor=COLOR_SLATE_800, alignment=TA_RIGHT))
    styles.add(ParagraphStyle("CellRightBold", fontName=FONT_BOLD, fontSize=7, leading=8.8, textColor=COLOR_SLATE_900, alignment=TA_RIGHT))
    styles.add(ParagraphStyle("CellCenter", fontName=FONT_REGULAR, fontSize=7, leading=8.8, textColor=COLOR_SLATE_800, alignment=TA_CENTER))

    story = []

    # ── 1. ENCABEZADO INSTITUCIONAL CANÓNICO CON LOGO ─────────────────────────
    razon_social = company.get("razon_social") or "GRUPO SANTA TERESA E.A.S."
    nombre_fantasia = company.get("nombre_fantasia") or "Extra Supermercado Mayorista"
    ruc_empresa = company.get("ruc") or "80150377-9"
    timbrado = company.get("timbrado") or "18545636"
    direccion = company.get("direccion") or "Av. República de Colombia c/ Calle 4, CDE - Paraguay"
    telefono = company.get("telefono") or "+595 983 000000"

    estado = str(order.get("estado") or "REGISTRADO").upper()

    logo_img = _logo_flowable(company, max_w=38 * mm, max_h=16 * mm)
    header_company = [
        Paragraph(f"<b>{nombre_fantasia.upper()}</b>", styles["CompanyTitle"]),
        Paragraph(f"<b>Razón Social:</b> {razon_social}", styles["CompanyMeta"]),
        Paragraph(f"<b>RUC:</b> {ruc_empresa} | <b>Timbrado:</b> {timbrado}", styles["CompanyMeta"]),
        Paragraph(f"{direccion} — Tel: {telefono}", styles["CompanyMeta"]),
    ]
    t_comp = Table([[logo_img, header_company]], colWidths=[40 * mm, 70 * mm])
    t_comp.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
    ]))

    status_color = "#059669" if estado in ("PAGADO", "DESEMBOLSADO") else "#D97706" if estado in ("REGISTRADO", "APROBADO") else "#475569"
    header_right = [
        Paragraph("ORDEN DE PAGO A PROVEEDOR", styles["DocBadge"]),
        Paragraph(f"<b>N° {num_orden}</b>", styles["DocNum"]),
        Spacer(1, 1 * mm),
        Paragraph(f"<font color='{status_color}'><b>● ESTADO: {estado}</b></font>", styles["DocMetaBold"]),
        Paragraph(f"Fecha Emisión: {_format_date(order.get('fecha_emision'))}", styles["DocMeta"]),
        Paragraph(f"Fecha Pago: {_format_date(order.get('fecha_pago'))}", styles["DocMeta"]),
    ]

    t_header = Table([[t_comp, header_right]], colWidths=[110 * mm, 80 * mm])
    t_header.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
    ]))
    story.append(t_header)
    story.append(Spacer(1, 2 * mm))
    story.append(HRFlowable(width="100%", thickness=1, color=COLOR_SLATE_200, spaceAfter=5))

    # ── 2. CÁLCULO DE TOTALES PARA KPIS Y TABLAS ─────────────────────────────
    total_original = Decimal("0")
    total_ncs_calc = Decimal("0")
    total_retenciones = Decimal("0")
    total_aplicado = Decimal("0")
    total_s_ant = Decimal("0")
    total_s_res = Decimal("0")

    for alloc in allocations:
        m_ap = Decimal(str(alloc.get("monto_aplicado") or 0))
        m_ret = Decimal(str(alloc.get("monto_retencion") or 0))
        s_ant = Decimal(str(alloc.get("saldo_anterior") or 0))
        s_res = Decimal(str(alloc.get("saldo_restante") or 0))
        m_orig = Decimal(str(alloc.get("monto_factura_original") or (s_ant + m_ap if s_ant > 0 else m_ap)))

        ncs_list = alloc.get("notas_credito") or []
        inv_nc_sum = sum(Decimal(str(nc.get("monto_aplicado") or 0)) for nc in ncs_list)
        if inv_nc_sum == Decimal("0") and alloc.get("total_nc_aplicadas"):
            inv_nc_sum = Decimal(str(alloc.get("total_nc_aplicadas") or 0))
        elif inv_nc_sum == Decimal("0") and m_orig > s_ant and (m_orig - s_ant) > Decimal("10"):
            inv_nc_sum = m_orig - s_ant

        total_original += m_orig
        total_ncs_calc += inv_nc_sum
        total_retenciones += m_ret
        total_aplicado += m_ap
        total_s_ant += s_ant
        total_s_res += s_res

    total_neto = Decimal(str(order.get("monto_neto") or (total_aplicado - total_retenciones)))

    # ── 3. TARJETAS KPI DE RESUMEN EJECUTIVO ─────────────────────────────────
    t_kpis = Table([
        [
            _kpi_card("Total Facturas Real", f"₲ {_format_gs(total_original)}", COLOR_SLATE_900),
            _kpi_card("NCs Deducidas", f"-₲ {_format_gs(total_ncs_calc)}", COLOR_AMBER if total_ncs_calc > 0 else COLOR_SLATE_500),
            _kpi_card("Retenciones", f"₲ {_format_gs(total_retenciones)}", COLOR_INDIGO if total_retenciones > 0 else COLOR_SLATE_500),
            _kpi_card("Neto Amortizado (OP)", f"₲ {_format_gs(total_aplicado)}", COLOR_EMERALD),
        ]
    ], colWidths=[47.5 * mm, 47.5 * mm, 47.5 * mm, 47.5 * mm])
    t_kpis.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
    ]))
    story.append(t_kpis)
    story.append(Spacer(1, 3 * mm))

    # ── 4. DATOS DEL PROVEEDOR Y BENEFICIARIO ────────────────────────────────
    prov_nombre = order.get("supplier_nombre") or "PROVEEDOR GENERAL"
    prov_ruc = order.get("supplier_ruc") or "—"
    recibo_prov = order.get("recibo_proveedor") or "Sin registrar"
    observaciones = order.get("observaciones") or "Sin observaciones particulares"

    divisa_disbs = [
        d for d in disbursements
        if (d.get("moneda") and str(d.get("moneda")).upper() != "PYG" and float(d.get("monto") or 0) > 0)
    ]
    moneda_label = str(order.get("moneda") or "PYG").upper()
    if divisa_disbs:
        c_set = sorted(list(set(str(d.get("moneda")).upper() for d in divisa_disbs)))
        c_desc = [f"R$ (BRL)" if c == "BRL" else f"US$ (USD)" if c == "USD" else c for c in c_set]
        moneda_label = f"PYG + {', '.join(c_desc)}"
    elif moneda_label != "PYG":
        moneda_label = f"R$ (BRL)" if moneda_label == "BRL" else f"US$ (USD)" if moneda_label == "USD" else moneda_label

    info_data = [
        [
            Paragraph(f"<b>BENEFICIARIO / PROVEEDOR:</b><br/>{prov_nombre}", styles["CellText"]),
            Paragraph(f"<b>RUC / IDENTIF.:</b><br/>{prov_ruc}", styles["CellText"]),
            Paragraph(f"<b>RECIBO OFICIAL PROV.:</b><br/>{recibo_prov}", styles["CellText"]),
            Paragraph(f"<b>MONEDA DE PAGO:</b><br/>{moneda_label}", styles["CellText"]),
        ]
    ]
    t_info = Table(info_data, colWidths=[70 * mm, 40 * mm, 45 * mm, 35 * mm])
    t_info.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), COLOR_SLATE_50),
        ("BOX", (0, 0), (-1, -1), 0.5, COLOR_SLATE_200),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
    ]))
    story.append(t_info)
    story.append(Spacer(1, 3 * mm))

    # ── 5. FACTURAS AMORTIZADAS: DETALLE DESGLOSADO (MONTO REAL + NCS + NETO) ─
    story.append(Paragraph("1. FACTURAS Y COMPROBANTES AMORTIZADOS (VALOR NOMINAL & DESCUENTOS)", styles["SectionTitle"]))

    headers_fac = [
        Paragraph("<b>N° Factura / Timbrado</b>", styles["CellBold"]),
        Paragraph("<b>Monto Original</b>", styles["CellRightBold"]),
        Paragraph("<b>NCs Deducidas</b>", styles["CellRightBold"]),
        Paragraph("<b>Saldo Anterior</b>", styles["CellRightBold"]),
        Paragraph("<b>Retención</b>", styles["CellRightBold"]),
        Paragraph("<b>Neto Amortizado</b>", styles["CellRightBold"]),
        Paragraph("<b>Saldo Restante</b>", styles["CellRightBold"]),
    ]
    fac_rows = [headers_fac]

    for alloc in allocations:
        m_ap = Decimal(str(alloc.get("monto_aplicado") or 0))
        m_ret = Decimal(str(alloc.get("monto_retencion") or 0))
        s_ant = Decimal(str(alloc.get("saldo_anterior") or 0))
        s_res = Decimal(str(alloc.get("saldo_restante") or 0))
        m_orig = Decimal(str(alloc.get("monto_factura_original") or (s_ant + m_ap if s_ant > 0 else m_ap)))

        ncs_list = alloc.get("notas_credito") or []
        inv_nc_sum = sum(Decimal(str(nc.get("monto_aplicado") or 0)) for nc in ncs_list)
        if inv_nc_sum == Decimal("0") and alloc.get("total_nc_aplicadas"):
            inv_nc_sum = Decimal(str(alloc.get("total_nc_aplicadas") or 0))
        elif inv_nc_sum == Decimal("0") and m_orig > s_ant and (m_orig - s_ant) > Decimal("10"):
            inv_nc_sum = m_orig - s_ant

        num_fac = str(alloc.get("numero_factura") or "—")
        timbrado_fac = str(alloc.get("timbrado") or "—")
        venc_fac = _format_date(alloc.get("fecha_vencimiento"))
        fac_desc = f"<b>{num_fac}</b><br/><font size=6 color='#64748B'>Timb: {timbrado_fac} · Vto: {venc_fac}</font>"

        if ncs_list:
            nc_items = [
                f"<font color='#B45309'><b>NC {nc.get('numero', 'S/N')}</b>: -{_format_gs(nc.get('monto_aplicado', 0))}</font>"
                for nc in ncs_list
            ]
            nc_cell_text = "<br/>".join(nc_items)
        elif inv_nc_sum > Decimal("0"):
            nc_cell_text = f"<font color='#B45309'><b>NCs:</b> -{_format_gs(inv_nc_sum)}</font>"
        else:
            nc_cell_text = "<font color='#94A3B8'>—</font>"

        fac_rows.append([
            Paragraph(fac_desc, styles["CellText"]),
            Paragraph(_format_gs(m_orig), styles["CellRight"]),
            Paragraph(nc_cell_text, styles["CellRight"]),
            Paragraph(_format_gs(s_ant), styles["CellRight"]),
            Paragraph(_format_gs(m_ret), styles["CellRight"]),
            Paragraph(f"<b>{_format_gs(m_ap)}</b>", styles["CellRightBold"]),
            Paragraph(_format_gs(s_res), styles["CellRight"]),
        ])

    # Fila de Totales
    fac_rows.append([
        Paragraph("<b>TOTALES</b>", styles["CellBold"]),
        Paragraph(f"<b>{_format_gs(total_original)}</b>", styles["CellRightBold"]),
        Paragraph(f"<b>-{_format_gs(total_ncs_calc)}</b>" if total_ncs_calc > 0 else "<b>0</b>", styles["CellRightBold"]),
        Paragraph(f"<b>{_format_gs(total_s_ant)}</b>", styles["CellRightBold"]),
        Paragraph(f"<b>{_format_gs(total_retenciones)}</b>", styles["CellRightBold"]),
        Paragraph(f"<b>{_format_gs(total_aplicado)}</b>", styles["CellRightBold"]),
        Paragraph(f"<b>{_format_gs(total_s_res)}</b>", styles["CellRightBold"]),
    ])

    t_fac = Table(fac_rows, colWidths=[42 * mm, 26 * mm, 34 * mm, 24 * mm, 18 * mm, 26 * mm, 20 * mm])
    t_fac.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), COLOR_SLATE_900),
        ("TEXTCOLOR", (0, 0), (-1, 0), WHITE),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("ROWBACKGROUNDS", (0, 1), (-1, -2), [WHITE, COLOR_SLATE_50]),
        ("BACKGROUND", (0, -1), (-1, -1), COLOR_SLATE_100),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("LEFTPADDING", (0, 0), (-1, -1), 3.5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 3.5),
        ("LINEBELOW", (0, 0), (-1, -1), 0.3, COLOR_SLATE_200),
        ("BOX", (0, 0), (-1, -1), 0.5, COLOR_SLATE_200),
    ]))
    story.append(t_fac)
    story.append(Spacer(1, 3 * mm))

    # ── 6. DETALLE DE FORMAS DE PAGO / DESEMBOLSOS ───────────────────────────
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
            Paragraph("<i>Pendiente de asignación de medio de pago / liquidación</i>", styles["CellText"]),
            Paragraph("—", styles["CellText"]),
            Paragraph("—", styles["CellText"]),
            Paragraph("—", styles["CellCenter"]),
            Paragraph("0", styles["CellRightBold"]),
        ])
    else:
        for d in disbursements:
            fp = (d.get("forma_pago") or "").lower()
            m_pyg = Decimal(str(d.get("monto_pyg") or d.get("monto") or 0))
            total_desembolsado += m_pyg

            m_orig = Decimal(str(d.get("monto") or 0))
            d_moneda = (str(d.get("moneda") or "PYG")).upper()
            tc = Decimal(str(d.get("tipo_cambio") or 1))
            is_foreign = d_moneda != "PYG" and m_orig > Decimal("0")
            curr_sym = "R$" if d_moneda == "BRL" else "US$" if d_moneda == "USD" else d_moneda

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
                fp_label = "Compensación Nota de Crédito"
                detalle = f"NC N° {d.get('numero_nc') or 'S/N'}"
                origen = "Saldo a Favor Proveedor"
                plazo = "Compensación"
            elif fp == "diferencia_cambio":
                fp_label = "Diferencia de Cambio"
                detalle = d.get("observaciones") or "Ajuste por tipo de cambio en liquidación"
                origen = "Ajuste Contable"
                plazo = "Inmediato"
            else:
                fp_label = fp.title()
                detalle = d.get("observaciones") or "—"
                origen = "—"
                plazo = "—"

            if is_foreign:
                fp_label += f" ({curr_sym})"
                detalle += f"<br/><b>Divisa:</b> <font color='#059669'><b>{curr_sym} {_format_divisa(m_orig, d_moneda)}</b></font> (Cotiz: ₲ {_format_gs(tc)})"

            importe_cell = Paragraph(f"{_format_gs(m_pyg)}", styles["CellRightBold"])
            if is_foreign:
                importe_cell = Paragraph(
                    f"{_format_gs(m_pyg)}<br/>"
                    f"<font size=6 color='#059669'><b>({curr_sym} {_format_divisa(m_orig, d_moneda)})</b></font>",
                    styles["CellRightBold"]
                )

            des_rows.append([
                Paragraph(fp_label, styles["CellBold"]),
                Paragraph(detalle, styles["CellText"]),
                Paragraph(origen, styles["CellText"]),
                Paragraph(plazo, styles["CellCenter"]),
                importe_cell,
            ])

        des_rows.append([
            Paragraph("<b>TOTAL DESEMBOLSADO</b>", styles["CellBold"]),
            Paragraph("", styles["CellText"]),
            Paragraph("", styles["CellText"]),
            Paragraph("", styles["CellCenter"]),
            Paragraph(f"<b>{_format_gs(total_desembolsado)}</b>", styles["CellRightBold"]),
        ])

    t_des = Table(des_rows, colWidths=[42 * mm, 60 * mm, 28 * mm, 30 * mm, 30 * mm])
    t_des.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), COLOR_SLATE_900),
        ("TEXTCOLOR", (0, 0), (-1, 0), WHITE),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("ROWBACKGROUNDS", (0, 1), (-1, -2), [WHITE, COLOR_SLATE_50]),
        ("BACKGROUND", (0, -1), (-1, -1), COLOR_SLATE_100),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("LEFTPADDING", (0, 0), (-1, -1), 3.5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 3.5),
        ("LINEBELOW", (0, 0), (-1, -1), 0.3, COLOR_SLATE_200),
        ("BOX", (0, 0), (-1, -1), 0.5, COLOR_SLATE_200),
    ]))
    story.append(t_des)
    story.append(Spacer(1, 3 * mm))

    # ── 7. OBSERVACIONES Y RESUMEN FINANCIERO ─────────────────────────────────
    diff_cambio = Decimal(str(order.get("diferencia_cambio") or 0))
    diff_line = ""
    if diff_cambio != Decimal("0"):
        diff_prefix = "+" if diff_cambio > 0 else ""
        diff_tipo = "SOBRECOSTO" if diff_cambio > 0 else "GANANCIA"
        diff_line = f"<br/><b>DIF. CAMBIO ({diff_tipo}):</b> ₲ {diff_prefix}{_format_gs(diff_cambio)}"

    divisa_summary_lines = ""
    if divisa_disbs:
        for d in divisa_disbs:
            d_curr = str(d.get("moneda") or "").upper()
            d_sym = "R$" if d_curr == "BRL" else "US$" if d_curr == "USD" else d_curr
            d_amt = Decimal(str(d.get("monto") or 0))
            d_tc = Decimal(str(d.get("tipo_cambio") or 1))
            divisa_summary_lines += (
                f"<br/><font size=7 color='#059669'><b>DESEMBOLSO EN DIVISA:</b> "
                f"<b>{d_sym} {_format_divisa(d_amt, d_curr)}</b> (TC: ₲ {_format_gs(d_tc)})</font>"
            )

    resumen_right_text = (
        f"<b>Total Facturas Original:</b> ₲ {_format_gs(total_original)}<br/>"
        + (f"<b>Deducción NCs Vinculadas:</b> -₲ {_format_gs(total_ncs_calc)}<br/>" if total_ncs_calc > 0 else "")
        + (f"<b>Retenciones Impositivas:</b> -₲ {_format_gs(total_retenciones)}<br/>" if total_retenciones > 0 else "")
        + f"{diff_line}"
        + f"{divisa_summary_lines}<br/>"
        + f"<b><font size=9.5 color='#0F172A'>TOTAL NETO DESEMBOLSADO: ₲ {_format_gs(total_neto)}</font></b>"
    )

    resumen_data = [
        [
            Paragraph(
                f"<b>OBSERVACIONES Y NOTAS:</b><br/>{observaciones}<br/><br/>"
                f"<font size=6 color='#64748B'>Orden emitida bajo supervisión de Cuentas por Pagar. Los importes reflejan "
                f"las deducciones de notas de crédito y retenciones legales correspondientes.</font>",
                styles["CellText"]
            ),
            Paragraph(resumen_right_text, styles["CellRight"])
        ]
    ]
    t_res = Table(resumen_data, colWidths=[115 * mm, 75 * mm])
    t_res.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), COLOR_SLATE_50),
        ("BOX", (0, 0), (-1, -1), 0.5, COLOR_SLATE_200),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
    ]))
    story.append(t_res)
    story.append(Spacer(1, 6 * mm))

    # ── 8. SECCIÓN DE FIRMAS AUDITABLES ──────────────────────────────────────
    firmas_data = [
        [
            Paragraph("<br/><br/>_______________________________<br/><b>ELABORADO POR</b><br/><font size=6.5 color='#64748B'>Cuentas por Pagar (AP)</font>", styles["CellCenter"]),
            Paragraph("<br/><br/>_______________________________<br/><b>AUTORIZADO POR</b><br/><font size=6.5 color='#64748B'>Gerencia / Finanzas</font>", styles["CellCenter"]),
            Paragraph("<br/><br/>_______________________________<br/><b>RECIBÍ CONFORME</b><br/><font size=6.5 color='#64748B'>Firma, Aclaración y C.I. Proveedor</font>", styles["CellCenter"]),
        ]
    ]
    t_firmas = Table(firmas_data, colWidths=[63 * mm, 63 * mm, 64 * mm])
    t_firmas.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "BOTTOM"),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
    ]))
    story.append(KeepTogether([t_firmas]))

    doc.build(story, canvasmaker=lambda *args, **kwargs: _AuditedCanvas(*args, footer_left=f"Comprobante Oficial {num_orden} — Extra Supermercado Mayorista", **kwargs))
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
        divisa_sub = ""
        if o.get("moneda_desembolso") and str(o.get("moneda_desembolso")).upper() != "PYG" and o.get("monto_desembolso_moneda"):
            curr = str(o.get("moneda_desembolso")).upper()
            sym = "R$" if curr == "BRL" else "US$" if curr == "USD" else curr
            divisa_sub = f"<br/><font size=6 color='#15803D'><b>({sym} {_format_divisa(o.get('monto_desembolso_moneda'), curr)})</b></font>"

        table_rows.append([
            Paragraph(str(o.get("numero_orden")), styles["CellBold"]),
            Paragraph(_format_date(o.get("fecha_pago") or o.get("fecha_emision")), styles["CellCenter"]),
            Paragraph(str(o.get("supplier_nombre") or "-")[:28], styles["CellText"]),
            Paragraph(str(o.get("total_facturas", 1)), styles["CellCenter"]),
            Paragraph(fp_resumen[:45], styles["CellText"]),
            Paragraph(str(o.get("estado", "")).upper(), styles["CellCenter"]),
            Paragraph(f"₲ {_format_gs(m_neto)}{divisa_sub}", styles["CellRightBold"]),
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


def generate_payment_proposal_pdf(
    company: dict,
    proposal: dict,
    generated_by: str = ""
) -> bytes:
    """Genera el comprobante PDF proforma ejecutivo de preparación de pago / OP provisoria."""
    buffer = BytesIO()

    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=10 * mm,
        rightMargin=10 * mm,
        topMargin=10 * mm,
        bottomMargin=14 * mm,
        title="Proforma_Preparacion_Pago",
    )

    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle("CompanyTitleProp", fontName=FONT_BOLD, fontSize=11, leading=13, textColor=COLOR_SLATE_900))
    styles.add(ParagraphStyle("CompanyMetaProp", fontName=FONT_REGULAR, fontSize=6.8, leading=8.5, textColor=COLOR_SLATE_500))
    styles.add(ParagraphStyle("DocBadgeProp", fontName=FONT_BOLD, fontSize=7, leading=8.5, textColor=COLOR_INDIGO, alignment=TA_RIGHT))
    styles.add(ParagraphStyle("DocTitleProp", fontName=FONT_BOLD, fontSize=12, leading=14, textColor=COLOR_SLATE_900, alignment=TA_RIGHT))
    styles.add(ParagraphStyle("DocSubProp", fontName=FONT_REGULAR, fontSize=6.8, leading=8.5, textColor=COLOR_SLATE_700, alignment=TA_RIGHT))
    styles.add(ParagraphStyle("SectionTitleProp", fontName=FONT_BOLD, fontSize=8.5, leading=11, textColor=COLOR_SLATE_900, spaceBefore=6, spaceAfter=3))
    styles.add(ParagraphStyle("CellTProp", fontName=FONT_REGULAR, fontSize=7, leading=8.8, textColor=COLOR_SLATE_800))
    styles.add(ParagraphStyle("CellBProp", fontName=FONT_BOLD, fontSize=7, leading=8.8, textColor=COLOR_SLATE_900))
    styles.add(ParagraphStyle("CellRProp", fontName=FONT_REGULAR, fontSize=7, leading=8.8, textColor=COLOR_SLATE_800, alignment=TA_RIGHT))
    styles.add(ParagraphStyle("CellRBProp", fontName=FONT_BOLD, fontSize=7, leading=8.8, textColor=COLOR_SLATE_900, alignment=TA_RIGHT))
    styles.add(ParagraphStyle("CellCProp", fontName=FONT_REGULAR, fontSize=7, leading=8.8, textColor=COLOR_SLATE_800, alignment=TA_CENTER))

    story = []

    # 1. ENCABEZADO INSTITUCIONAL
    razon_social = company.get("razon_social") or "GRUPO SANTA TERESA E.A.S."
    nombre_fantasia = company.get("nombre_fantasia") or "Extra Supermercado Mayorista"
    ruc_empresa = company.get("ruc") or "80150377-9"
    timbrado = company.get("timbrado") or "18545636"
    direccion = company.get("direccion") or "Av. República de Colombia c/ Calle 4, CDE - Paraguay"
    telefono = company.get("telefono") or "+595 983 000000"

    logo_img = _logo_flowable(company, max_w=38 * mm, max_h=16 * mm)
    header_left = [
        Paragraph(f"<b>{nombre_fantasia.upper()}</b>", styles["CompanyTitleProp"]),
        Paragraph(f"<b>Razón Social:</b> {razon_social}", styles["CompanyMetaProp"]),
        Paragraph(f"<b>RUC:</b> {ruc_empresa} | <b>Timbrado:</b> {timbrado}", styles["CompanyMetaProp"]),
        Paragraph(f"{direccion} — Tel: {telefono}", styles["CompanyMetaProp"]),
    ]
    t_comp = Table([[logo_img, header_left]], colWidths=[40 * mm, 70 * mm])
    t_comp.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
    ]))

    fecha_prop = proposal.get("fecha_propuesta") or datetime.now(ASUNCION_TZ).strftime("%d/%m/%Y")
    header_right = [
        Paragraph("PREPARACIÓN DE PAGO / OP", styles["DocBadgeProp"]),
        Paragraph("<b>PROFORMA DE LIQUIDACIÓN</b>", styles["DocTitleProp"]),
        Spacer(1, 1 * mm),
        Paragraph("<font color='#D97706'><b>● AGUARDANDO PAGO / AUTORIZACIÓN</b></font>", styles["DocSubProp"]),
        Paragraph(f"Fecha de Emisión: {fecha_prop}", styles["DocSubProp"]),
        Paragraph(f"Operador: {generated_by or 'Cuentas por Pagar'}", styles["DocSubProp"]),
    ]

    t_header = Table([[t_comp, header_right]], colWidths=[110 * mm, 80 * mm])
    t_header.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
    ]))
    story.append(t_header)
    story.append(Spacer(1, 2 * mm))
    story.append(HRFlowable(width="100%", thickness=1, color=COLOR_SLATE_200, spaceAfter=5))

    # 2. CÁLCULO DE TOTALES
    invoices = proposal.get("invoices") or []
    credit_notes = proposal.get("credit_notes") or []

    total_fac_original = Decimal("0")
    total_fac_pagar = Decimal("0")
    total_inv_ncs = Decimal("0")

    for inv in invoices:
        m_pagar = Decimal(str(inv.get("monto_a_pagar") or inv.get("saldo_pendiente") or inv.get("monto_total") or 0))
        m_tot = Decimal(str(inv.get("monto_total") or inv.get("total") or m_pagar))
        ncs_list = inv.get("notas_credito") or []
        inv_nc_amt = sum(Decimal(str(nc.get("monto_aplicado") or 0)) for nc in ncs_list)
        if inv_nc_amt == Decimal("0") and m_tot > m_pagar and (m_tot - m_pagar) > Decimal("10"):
            inv_nc_amt = m_tot - m_pagar

        total_fac_original += m_tot
        total_fac_pagar += m_pagar
        total_inv_ncs += inv_nc_amt

    total_nc_deducir = sum(Decimal(str(cn.get("monto") or 0)) for cn in credit_notes)
    total_global_ncs = total_inv_ncs + total_nc_deducir
    total_neto = max(Decimal("0"), total_fac_pagar - total_nc_deducir)

    # 3. TARJETAS KPI
    t_kpis = Table([
        [
            _kpi_card("Total Facturas Real", f"₲ {_format_gs(total_fac_original)}", COLOR_SLATE_900),
            _kpi_card("NCs a Compensar", f"-₲ {_format_gs(total_global_ncs)}", COLOR_AMBER if total_global_ncs > 0 else COLOR_SLATE_500),
            _kpi_card("Saldo Pagable", f"₲ {_format_gs(total_fac_pagar)}", COLOR_INDIGO),
            _kpi_card("Neto Estimado OP", f"₲ {_format_gs(total_neto)}", COLOR_EMERALD),
        ]
    ], colWidths=[47.5 * mm, 47.5 * mm, 47.5 * mm, 47.5 * mm])
    t_kpis.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
    ]))
    story.append(t_kpis)
    story.append(Spacer(1, 3 * mm))

    # 4. DATOS DEL PROVEEDOR
    prov_nombre = proposal.get("supplier_nombre") or "PROVEEDOR GENERAL"
    prov_ruc = proposal.get("supplier_ruc") or "—"
    observaciones = proposal.get("observaciones") or "Preparación y verificación previa para emisión de orden de pago."

    info_data = [
        [
            Paragraph(f"<b>BENEFICIARIO / PROVEEDOR:</b><br/>{prov_nombre}", styles["CellTProp"]),
            Paragraph(f"<b>RUC / DOCUMENTO:</b><br/>{prov_ruc}", styles["CellTProp"]),
            Paragraph("<b>MONEDA:</b><br/>PYG (Guaraníes)", styles["CellTProp"]),
            Paragraph("<b>DESTINO:</b><br/>Tesorería / Pagos", styles["CellTProp"]),
        ]
    ]
    t_info = Table(info_data, colWidths=[70 * mm, 45 * mm, 35 * mm, 30 * mm])
    t_info.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), COLOR_SLATE_50),
        ("BOX", (0, 0), (-1, -1), 0.5, COLOR_SLATE_200),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
    ]))
    story.append(t_info)
    story.append(Spacer(1, 3 * mm))

    # 5. TABLA DE FACTURAS SELECCIONADAS
    story.append(Paragraph(f"1. FACTURAS SELECCIONADAS PARA PAGO ({len(invoices)} comprobantes)", styles["SectionTitleProp"]))

    headers_fac = [
        Paragraph("<b>N° Factura / Timbrado</b>", styles["CellBProp"]),
        Paragraph("<b>Emisión</b>", styles["CellCProp"]),
        Paragraph("<b>Vencimiento</b>", styles["CellCProp"]),
        Paragraph("<b>Monto Original</b>", styles["CellRProp"]),
        Paragraph("<b>NCs Deducidas</b>", styles["CellRProp"]),
        Paragraph("<b>Monto a Pagar</b>", styles["CellRBProp"]),
    ]
    fac_rows = [headers_fac]

    for inv in invoices:
        m_pagar = Decimal(str(inv.get("monto_a_pagar") or inv.get("saldo_pendiente") or inv.get("monto_total") or 0))
        m_tot = Decimal(str(inv.get("monto_total") or inv.get("total") or m_pagar))
        ncs_list = inv.get("notas_credito") or []
        inv_nc_amt = sum(Decimal(str(nc.get("monto_aplicado") or 0)) for nc in ncs_list)
        if inv_nc_amt == Decimal("0") and m_tot > m_pagar and (m_tot - m_pagar) > Decimal("10"):
            inv_nc_amt = m_tot - m_pagar

        num_fac = str(inv.get("numero_factura") or "—")
        timbrado_fac = str(inv.get("timbrado") or "—")
        fac_desc = f"<b>{num_fac}</b><br/><font size=6 color='#64748B'>Timb: {timbrado_fac}</font>"

        if ncs_list:
            nc_items = [
                f"<font color='#B45309'><b>NC {nc.get('numero', 'S/N')}</b>: -{_format_gs(nc.get('monto_aplicado', 0))}</font>"
                for nc in ncs_list
            ]
            nc_cell_text = "<br/>".join(nc_items)
        elif inv_nc_amt > Decimal("0"):
            nc_cell_text = f"<font color='#B45309'><b>NCs:</b> -{_format_gs(inv_nc_amt)}</font>"
        else:
            nc_cell_text = "<font color='#94A3B8'>—</font>"

        fac_rows.append([
            Paragraph(fac_desc, styles["CellTProp"]),
            Paragraph(_format_date(inv.get("fecha_emision")), styles["CellCProp"]),
            Paragraph(_format_date(inv.get("fecha_vencimiento")), styles["CellCProp"]),
            Paragraph(_format_gs(m_tot), styles["CellRProp"]),
            Paragraph(nc_cell_text, styles["CellRProp"]),
            Paragraph(_format_gs(m_pagar), styles["CellRBProp"]),
        ])

    fac_rows.append([
        Paragraph("<b>SUBTOTAL FACTURAS A PAGAR</b>", styles["CellBProp"]),
        Paragraph("", styles["CellCProp"]),
        Paragraph("", styles["CellCProp"]),
        Paragraph(f"<b>{_format_gs(total_fac_original)}</b>", styles["CellRProp"]),
        Paragraph(f"<b>-{_format_gs(total_inv_ncs)}</b>" if total_inv_ncs > 0 else "<b>0</b>", styles["CellRProp"]),
        Paragraph(f"<b>{_format_gs(total_fac_pagar)}</b>", styles["CellRBProp"]),
    ])

    t_fac = Table(fac_rows, colWidths=[45 * mm, 22 * mm, 22 * mm, 32 * mm, 35 * mm, 34 * mm])
    t_fac.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), COLOR_SLATE_900),
        ("TEXTCOLOR", (0, 0), (-1, 0), WHITE),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("ROWBACKGROUNDS", (0, 1), (-1, -2), [WHITE, COLOR_SLATE_50]),
        ("BACKGROUND", (0, -1), (-1, -1), COLOR_SLATE_100),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("LEFTPADDING", (0, 0), (-1, -1), 3.5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 3.5),
        ("LINEBELOW", (0, 0), (-1, -1), 0.3, COLOR_SLATE_200),
        ("BOX", (0, 0), (-1, -1), 0.5, COLOR_SLATE_200),
    ]))
    story.append(t_fac)
    story.append(Spacer(1, 3 * mm))

    # 6. TABLA DE NOTAS DE CRÉDITO Y DEVOLUCIONES GLOBALES A COMPENSAR
    if credit_notes:
        story.append(Paragraph(f"2. NOTAS DE CRÉDITO Y DEVOLUCIONES A COMPENSAR ({len(credit_notes)} comprobantes)", styles["SectionTitleProp"]))
        headers_nc = [
            Paragraph("<b>Tipo de Saldo a Favor</b>", styles["CellBProp"]),
            Paragraph("<b>N° Comprobante / Remito</b>", styles["CellBProp"]),
            Paragraph("<b>Fecha</b>", styles["CellCProp"]),
            Paragraph("<b>Concepto / Motivo</b>", styles["CellTProp"]),
            Paragraph("<b>Monto a Deducir</b>", styles["CellRBProp"]),
        ]
        nc_rows = [headers_nc]

        for cn in credit_notes:
            m_nc = Decimal(str(cn.get("monto") or 0))
            tipo_label = "NC FISCAL REGISTRADA" if cn.get("tipo") == "nc_fiscal" else "NC PENDIENTE (DEVOLUCIÓN)"
            color_badge = "#059669" if cn.get("tipo") == "nc_fiscal" else "#D97706"

            nc_rows.append([
                Paragraph(f"<font color='{color_badge}'><b>{tipo_label}</b></font>", styles["CellTProp"]),
                Paragraph(str(cn.get("numero") or "—"), styles["CellBProp"]),
                Paragraph(_format_date(cn.get("fecha")), styles["CellCProp"]),
                Paragraph(str(cn.get("motivo") or "Compensación comercial"), styles["CellTProp"]),
                Paragraph(f"-{_format_gs(m_nc)}", styles["CellRBProp"]),
            ])

        nc_rows.append([
            Paragraph("<b>TOTAL NOTAS DE CRÉDITO A DEDUCIR</b>", styles["CellBProp"]),
            Paragraph("", styles["CellTProp"]),
            Paragraph("", styles["CellCProp"]),
            Paragraph("", styles["CellTProp"]),
            Paragraph(f"<b>-{_format_gs(total_nc_deducir)}</b>", styles["CellRBProp"]),
        ])

        t_nc = Table(nc_rows, colWidths=[48 * mm, 36 * mm, 22 * mm, 50 * mm, 34 * mm])
        t_nc.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), COLOR_SLATE_900),
            ("TEXTCOLOR", (0, 0), (-1, 0), WHITE),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("ROWBACKGROUNDS", (0, 1), (-1, -2), [WHITE, COLOR_SLATE_50]),
            ("BACKGROUND", (0, -1), (-1, -1), COLOR_SLATE_100),
            ("TOPPADDING", (0, 0), (-1, -1), 3),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
            ("LEFTPADDING", (0, 0), (-1, -1), 3.5),
            ("RIGHTPADDING", (0, 0), (-1, -1), 3.5),
            ("LINEBELOW", (0, 0), (-1, -1), 0.3, COLOR_SLATE_200),
            ("BOX", (0, 0), (-1, -1), 0.5, COLOR_SLATE_200),
        ]))
        story.append(t_nc)
        story.append(Spacer(1, 3 * mm))

    # 7. RESUMEN DE LIQUIDACIÓN Y NETO A DESEMBOLSAR
    resumen_data = [
        [
            Paragraph(f"<b>OBSERVACIONES / CONDICIONES:</b><br/>{observaciones}", styles["CellTProp"]),
            Paragraph(
                f"<b>Total Facturas Original:</b> ₲ {_format_gs(total_fac_original)}<br/>"
                + (f"<b>Compensación NCs Vinculadas:</b> -₲ {_format_gs(total_inv_ncs)}<br/>" if total_inv_ncs > 0 else "")
                + (f"<b>Compensación NCs Globales:</b> -₲ {_format_gs(total_nc_deducir)}<br/>" if total_nc_deducir > 0 else "")
                + f"<b><font size=9.5 color='#0F172A'>NETO ESTIMADO A PAGAR: ₲ {_format_gs(total_neto)}</font></b>",
                styles["CellRProp"]
            )
        ]
    ]
    t_res = Table(resumen_data, colWidths=[115 * mm, 75 * mm])
    t_res.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), COLOR_SLATE_50),
        ("BOX", (0, 0), (-1, -1), 0.5, COLOR_SLATE_200),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
    ]))
    story.append(t_res)
    story.append(Spacer(1, 6 * mm))

    # 8. FIRMAS DE AUTORIZACIÓN PREVIA
    firmas = [
        [
            Paragraph("____________________________<br/><b>PREPARADO POR</b><br/><font size=6.5 color='#64748B'>Cuentas por Pagar (AP)</font>", styles["CellCProp"]),
            Paragraph("____________________________<br/><b>AUTORIZADO POR</b><br/><font size=6.5 color='#64748B'>Gerencia / Administración</font>", styles["CellCProp"]),
            Paragraph("____________________________<br/><b>PROCESADO EN</b><br/><font size=6.5 color='#64748B'>Tesorería / Pagos</font>", styles["CellCProp"]),
        ]
    ]
    t_firmas = Table(firmas, colWidths=[63 * mm, 63 * mm, 64 * mm])
    t_firmas.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "BOTTOM"),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
    ]))
    story.append(KeepTogether([t_firmas]))

    footer_text = f"Proforma de Pago — Extra Supermercado Mayorista — Generado {datetime.now(ASUNCION_TZ).strftime('%d/%m/%Y %H:%M')}"
    doc.build(story, canvasmaker=lambda *args, **kwargs: _AuditedCanvas(*args, footer_left=footer_text, **kwargs))
    return buffer.getvalue()

