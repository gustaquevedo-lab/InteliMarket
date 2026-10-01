"""Generador de Reporte / Acta Oficial de Devolución de Clientes (RMA) en PDF (A4 Portrait).
Diseño editorial premium corporativo para Extra Supermercado Mayorista (GRUPO SANTA TERESA E.A.S.).
Incluye membrete institucional, trazabilidad de comprobante de venta, estado de restitución de stock,
desglose impositivo (IVA 10%, 5%, Exentas) y casillas de control/firmas de auditoría.
"""
from __future__ import annotations

import html
import io
import os
from datetime import datetime
from decimal import Decimal
from typing import Any, Dict, List, Optional
from zoneinfo import ZoneInfo

from reportlab.lib.colors import HexColor
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    HRFlowable,
    KeepTogether,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

from api.src.integrated_finance.pdf_reports import (
    _AuditedCanvas,
    _fmt_gs,
    _logo_flowable,
    ACCENT_BLUE,
    FONT_BOLD,
    FONT_REGULAR,
    GRAY_DARK,
    GRAY_LIGHT,
    GRAY_MEDIUM,
    GREEN,
    PRIMARY_COLOR,
    RED,
    WHITE,
)

PY_TZ = ZoneInfo("America/Asuncion")

PAGE_W, PAGE_H = A4
MARGIN = 10 * mm
CONTENT_W = PAGE_W - 2 * MARGIN  # 190 mm

# Paleta ejecutiva Extra Supermercado
COLOR_SLATE_950 = HexColor("#020617")
COLOR_SLATE_900 = HexColor("#0F172A")
COLOR_SLATE_800 = HexColor("#1E293B")
COLOR_SLATE_700 = HexColor("#334155")
COLOR_SLATE_600 = HexColor("#475569")
COLOR_SLATE_500 = HexColor("#64748B")
COLOR_SLATE_400 = HexColor("#94A3B8")
COLOR_SLATE_200 = HexColor("#E2E8F0")
COLOR_SLATE_100 = HexColor("#F1F5F9")
COLOR_SLATE_50 = HexColor("#F8FAFC")

# Acentos temáticos RMA (Rose / Ruby corporativo)
COLOR_ROSE_900 = HexColor("#881337")
COLOR_ROSE_700 = HexColor("#BE123C")
COLOR_ROSE_600 = HexColor("#E11D48")
COLOR_ROSE_500 = HexColor("#F43F5E")
COLOR_ROSE_100 = HexColor("#FFE4E6")
COLOR_ROSE_50 = HexColor("#FFF1F2")

# Estados de devolución
COLOR_EMERALD_BG = HexColor("#ECFDF5")
COLOR_EMERALD_BORDER = HexColor("#10B981")
COLOR_EMERALD_TEXT = HexColor("#065F46")
COLOR_EMERALD_DARK = HexColor("#047857")

COLOR_BLUE_BG = HexColor("#EFF6FF")
COLOR_BLUE_BORDER = HexColor("#3B82F6")
COLOR_BLUE_TEXT = HexColor("#1E40AF")

COLOR_AMBER_BG = HexColor("#FFFBEB")
COLOR_AMBER_BORDER = HexColor("#F59E0B")
COLOR_AMBER_TEXT = HexColor("#92400E")

COLOR_RED_BG = HexColor("#FEF2F2")
COLOR_RED_BORDER = HexColor("#EF4444")
COLOR_RED_TEXT = HexColor("#991B1B")

# Tipografías y estilos
STYLE_COMPANY_TITLE = ParagraphStyle(
    "CR_CompanyTitle",
    fontName=FONT_BOLD,
    fontSize=11,
    leading=13,
    textColor=COLOR_SLATE_900,
)
STYLE_COMPANY_SUB = ParagraphStyle(
    "CR_CompanySub",
    fontName=FONT_BOLD,
    fontSize=8,
    leading=10,
    textColor=COLOR_ROSE_700,
)
STYLE_COMPANY_META = ParagraphStyle(
    "CR_CompanyMeta",
    fontName=FONT_REGULAR,
    fontSize=6.8,
    leading=8.5,
    textColor=COLOR_SLATE_500,
)

STYLE_DOC_BADGE = ParagraphStyle(
    "CR_DocBadge",
    fontName=FONT_BOLD,
    fontSize=7,
    leading=8.5,
    textColor=COLOR_ROSE_900,
    alignment=TA_RIGHT,
)
STYLE_DOC_NUM = ParagraphStyle(
    "CR_DocNum",
    fontName=FONT_BOLD,
    fontSize=13,
    leading=15,
    textColor=COLOR_ROSE_700,
    alignment=TA_RIGHT,
)
STYLE_DOC_META = ParagraphStyle(
    "CR_DocMeta",
    fontName=FONT_REGULAR,
    fontSize=6.8,
    leading=8.5,
    textColor=COLOR_SLATE_600,
    alignment=TA_RIGHT,
)

STYLE_BANNER_TITLE = ParagraphStyle(
    "CR_BannerTitle",
    fontName=FONT_BOLD,
    fontSize=8,
    leading=10,
    textColor=COLOR_SLATE_900,
)
STYLE_BANNER_SUB = ParagraphStyle(
    "CR_BannerSub",
    fontName=FONT_REGULAR,
    fontSize=6.8,
    leading=8.5,
    textColor=COLOR_SLATE_600,
)
STYLE_BANNER_TAG = ParagraphStyle(
    "CR_BannerTag",
    fontName=FONT_BOLD,
    fontSize=7.5,
    leading=9,
    alignment=TA_CENTER,
)

STYLE_PANEL_HEADER = ParagraphStyle(
    "CR_PanelHeader",
    fontName=FONT_BOLD,
    fontSize=7.2,
    leading=9,
    textColor=COLOR_SLATE_900,
)
STYLE_PANEL_BODY = ParagraphStyle(
    "CR_PanelBody",
    fontName=FONT_REGULAR,
    fontSize=6.8,
    leading=8.5,
    textColor=COLOR_SLATE_700,
)

STYLE_TH = ParagraphStyle(
    "CR_TableTH",
    fontName=FONT_BOLD,
    fontSize=6.8,
    leading=8,
    textColor=WHITE,
    alignment=TA_CENTER,
)
STYLE_TH_LEFT = ParagraphStyle(
    "CR_TableTH_L",
    fontName=FONT_BOLD,
    fontSize=6.8,
    leading=8,
    textColor=WHITE,
    alignment=TA_LEFT,
)
STYLE_TH_RIGHT = ParagraphStyle(
    "CR_TableTH_R",
    fontName=FONT_BOLD,
    fontSize=6.8,
    leading=8,
    textColor=WHITE,
    alignment=TA_RIGHT,
)

STYLE_TD_TXT = ParagraphStyle(
    "CR_TableTD_Txt",
    fontName=FONT_REGULAR,
    fontSize=6.8,
    leading=8.5,
    textColor=COLOR_SLATE_800,
)
STYLE_TD_NUM = ParagraphStyle(
    "CR_TableTD_Num",
    fontName=FONT_BOLD,
    fontSize=6.8,
    leading=8.5,
    textColor=COLOR_SLATE_900,
    alignment=TA_RIGHT,
)
STYLE_TD_CENTER = ParagraphStyle(
    "CR_TableTD_Center",
    fontName=FONT_REGULAR,
    fontSize=6.8,
    leading=8.5,
    textColor=COLOR_SLATE_700,
    alignment=TA_CENTER,
)

STYLE_SIG_BOX_HEADER = ParagraphStyle(
    "CR_SigHeader",
    fontName=FONT_BOLD,
    fontSize=6.2,
    leading=7.5,
    textColor=COLOR_SLATE_700,
    alignment=TA_CENTER,
)
STYLE_SIG_BOX_ROLE = ParagraphStyle(
    "CR_SigRole",
    fontName=FONT_BOLD,
    fontSize=6.5,
    leading=8,
    textColor=COLOR_SLATE_900,
    alignment=TA_CENTER,
)
STYLE_SIG_BOX_DESC = ParagraphStyle(
    "CR_SigDesc",
    fontName=FONT_REGULAR,
    fontSize=5.5,
    leading=7,
    textColor=COLOR_SLATE_500,
    alignment=TA_CENTER,
)

MOTIVOS_MAP = {
    "producto_defectuoso": "Producto Defectuoso / Fallado",
    "producto_equivocado": "Producto Equivocado / Despacho Incorrecto",
    "vencimiento": "Vencimiento Próximo o Cumplido",
    "dano_transporte": "Daño en Transporte / Manipulación",
    "cliente_insatisfecho": "Cliente Insatisfecho / Disconformidad",
    "error_venta": "Error de Facturación / Venta Errónea",
    "devolucion_voluntaria": "Devolución Voluntaria Comercial",
    "garantia": "Aplicación de Garantía Comercial",
    "otro": "Otro Motivo Operativo",
}

CONDICIONES_MAP = {
    "buen_estado": ("Buen Estado", "#065F46", "#ECFDF5"),
    "defectuoso": ("Defectuoso", "#92400E", "#FFFBEB"),
    "danado": ("Dañado / Roto", "#991B1B", "#FEF2F2"),
    "vencido": ("Vencido", "#991B1B", "#FEF2F2"),
    "incompleto": ("Incompleto", "#92400E", "#FFFBEB"),
}


def _esc(val: Any) -> str:
    if val is None:
        return ""
    return html.escape(str(val))


def _format_datetime_py(dt_val: Any) -> str:
    if not dt_val:
        return "—"
    try:
        if isinstance(dt_val, str):
            dt_val = datetime.fromisoformat(dt_val.replace("Z", "+00:00"))
        if hasattr(dt_val, "astimezone"):
            dt_py = dt_val.astimezone(PY_TZ)
            return dt_py.strftime("%d/%m/%Y %H:%M")
        return str(dt_val)
    except Exception:
        return str(dt_val)


def _format_date_py(d_val: Any) -> str:
    if not d_val:
        return "—"
    try:
        if isinstance(d_val, str):
            if "T" in d_val:
                dt_val = datetime.fromisoformat(d_val.replace("Z", "+00:00"))
                return dt_val.astimezone(PY_TZ).strftime("%d/%m/%Y")
            return d_val
        if hasattr(d_val, "strftime"):
            return d_val.strftime("%d/%m/%Y")
        return str(d_val)
    except Exception:
        return str(d_val)


def generate_customer_return_pdf(company: dict, data: dict, generated_by: str = "") -> bytes:
    """Genera el documento PDF A4 del Reporte y Acta Oficial de Devolución de Clientes (RMA)."""
    buffer = io.BytesIO()

    numero_doc = data.get("numero") or f"DEV-{str(data.get('id', ''))[:8].upper()}"
    doc_title = f"Reporte_Devolucion_{numero_doc}"
    footer_text = "Extra Supermercado Mayorista · GRUPO SANTA TERESA E.A.S. · RUC 80150377-9 · Acta Oficial de Devolución (RMA)"

    def _canvasmaker(*args, **kwargs):
        return _AuditedCanvas(*args, footer_left=footer_text, footer_right="", **kwargs)

    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=MARGIN,
        rightMargin=MARGIN,
        topMargin=MARGIN,
        bottomMargin=16 * mm,
        title=doc_title,
    )
    doc._audited_canvasmaker = _canvasmaker

    elements = []

    # 1. ENCABEZADO INSTITUCIONAL
    razon_social = company.get("razon_social") or "GRUPO SANTA TERESA E.A.S."
    fantasia = company.get("nombre_fantasia") or "EXTRA SUPERMERCADO MAYORISTA"
    ruc_empresa = company.get("ruc") or "80150377-9"
    timbrado_empresa = company.get("timbrado") or "18545636"
    direccion_empresa = company.get("direccion") or "Alejo García esquina Carlos Antonio López"
    ciudad_empresa = company.get("ciudad") or "Pedro Juan Caballero, Amambay, Paraguay"
    tel_empresa = company.get("telefono") or "+595 992 052200"

    fecha_emision = _format_datetime_py(data.get("fecha") or data.get("created_at") or datetime.now(PY_TZ))
    almacen_nombre = data.get("warehouse_name") or data.get("almacen_nombre") or "Depósito Principal"

    logo_flow = _logo_flowable(company, max_w=36 * mm, max_h=15 * mm)

    company_lines = [
        Paragraph(fantasia.upper(), STYLE_COMPANY_TITLE),
        Paragraph(razon_social.upper(), STYLE_COMPANY_SUB),
        Paragraph(f"<b>RUC:</b> {ruc_empresa} · <b>Timbrado:</b> {timbrado_empresa}", STYLE_COMPANY_META),
        Paragraph(f"{direccion_empresa} — {ciudad_empresa}", STYLE_COMPANY_META),
        Paragraph(f"<b>Teléfono:</b> {tel_empresa} · <b>Atención al Cliente & Cajas</b>", STYLE_COMPANY_META),
    ]

    doc_box_content = [
        Paragraph("ACTA OFICIAL DE DEVOLUCIÓN & RMA", STYLE_DOC_BADGE),
        Paragraph(f"N° {numero_doc}", STYLE_DOC_NUM),
        Paragraph(f"<b>Fecha Emisión:</b> {fecha_emision}", STYLE_DOC_META),
        Paragraph(f"<b>Depósito Receptor:</b> {_esc(almacen_nombre)}", STYLE_DOC_META),
    ]

    header_table = Table(
        [[logo_flow, company_lines, doc_box_content]],
        colWidths=[38 * mm, 94 * mm, 58 * mm],
    )
    header_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
    ]))
    elements.append(header_table)
    elements.append(Spacer(1, 2.5 * mm))
    elements.append(HRFlowable(width="100%", thickness=1.5, color=COLOR_ROSE_700, spaceAfter=2.5 * mm))

    # 2. BANNER DE ESTADO Y DISPOSICIÓN
    estado = (data.get("estado") or "pendiente").lower()
    items_list = data.get("items") or []
    total_unidades = sum(float(it.get("cantidad") or 0) for it in items_list)
    total_devuelto = float(data.get("total") or sum(float(it.get("total") or 0) for it in items_list))

    nc_num = data.get("nota_credito_numero")

    if estado in ("aprobado", "aprobada"):
        bg_col = COLOR_EMERALD_BG
        border_col = COLOR_EMERALD_BORDER
        title_text = "✓ DEVOLUCIÓN APROBADA — STOCK RESTAURADO & VALOR REGULARIZADO"
        nc_info = f" Se emitió Nota de Crédito N° {nc_num}." if nc_num else " Valor acreditado a cliente/cuenta."
        sub_text = (
            f"Se reintegraron {total_unidades:,.0f} unidades al depósito bajo movimiento Kardex "
            f"'entrada_devolucion'.{nc_info}"
        )
        tag_text = "APROBADA"
        tag_bg = COLOR_EMERALD_DARK
        tag_fg = WHITE
    elif estado in ("rechazado", "rechazada"):
        bg_col = COLOR_RED_BG
        border_col = COLOR_RED_BORDER
        obs = data.get("observaciones") or "No cumple con las políticas de garantía o plazo de devolución"
        title_text = "SOLICITUD RECHAZADA — SIN REINGRESO A INVENTARIO"
        sub_text = f"La solicitud no fue autorizada. Motivo registrado: {_esc(obs)}."
        tag_text = "RECHAZADA"
        tag_bg = COLOR_RED_TEXT
        tag_fg = WHITE
    else:
        bg_col = COLOR_AMBER_BG
        border_col = COLOR_AMBER_BORDER
        title_text = "SOLICITUD PENDIENTE DE REVISIÓN Y AUTORIZACIÓN"
        sub_text = "La mercadería se encuentra en custodia preventiva. El stock no se reintegrará al inventario hasta la firma de aprobación."
        tag_text = "PENDIENTE"
        tag_bg = COLOR_AMBER_TEXT
        tag_fg = WHITE

    banner_left = [
        Paragraph(title_text, STYLE_BANNER_TITLE),
        Paragraph(sub_text, STYLE_BANNER_SUB),
    ]

    tag_paragraph = Paragraph(
        f"<b>{tag_text}</b>",
        ParagraphStyle("CR_TagP", parent=STYLE_BANNER_TAG, textColor=tag_fg),
    )
    tag_table = Table([[tag_paragraph]], colWidths=[36 * mm])
    tag_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), tag_bg),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 2),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
        ("LEFTPADDING", (0, 0), (-1, -1), 3),
        ("RIGHTPADDING", (0, 0), (-1, -1), 3),
    ]))

    banner_right = [
        Paragraph("<font size='5.5' color='#64748B'><b>ESTADO DEL TRÁMITE:</b></font>", ParagraphStyle("RAlign", alignment=TA_RIGHT)),
        tag_table,
    ]

    banner_table = Table(
        [[banner_left, banner_right]],
        colWidths=[146 * mm, 44 * mm],
    )
    banner_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), bg_col),
        ("BOX", (0, 0), (-1, -1), 0.7, border_col),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 3.0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3.0),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
    ]))
    elements.append(banner_table)
    elements.append(Spacer(1, 2.5 * mm))

    # 3. PANELES TÉCNICOS EN 2 COLUMNAS (CLIENTE/VENTA Y AUDITORÍA/CAUSA)
    cust_name = data.get("customer_name") or (data.get("customer") or {}).get("razon_social") or "Cliente Ocasional / General"
    cust_ruc = data.get("customer_ruc") or (data.get("customer") or {}).get("ruc") or "44444401-7"
    sale_numero = data.get("sale_numero") or (data.get("sale") or {}).get("numero") or "—"
    sale_fecha = _format_datetime_py(data.get("sale_fecha") or (data.get("sale") or {}).get("fecha"))
    sale_total = float(data.get("sale_total") or (data.get("sale") or {}).get("total") or 0)

    motivo_raw = data.get("motivo") or "otro"
    motivo_desc = MOTIVOS_MAP.get(motivo_raw, motivo_raw.replace("_", " ").title())
    motivo_det = data.get("motivo_detalle") or "Sin observaciones particulares"

    usuario_emisor = data.get("usuario_nombre") or data.get("user_name") or "Caja Central"
    aprobador_nom = data.get("aprobador_nombre") or data.get("aprobado_por_nombre") or (data.get("aprobado_por") and "Supervisor Autorizado") or "—"
    fecha_aprob = _format_datetime_py(data.get("fecha_aprobacion")) if data.get("fecha_aprobacion") else "—"

    left_panel_cells = [
        Paragraph("<b>1. DATOS DEL CLIENTE Y COMPROBANTE DE VENTA</b>", STYLE_PANEL_HEADER),
        Spacer(1, 1 * mm),
        Paragraph(f"<b>Cliente / Titular:</b> {_esc(cust_name)}", STYLE_PANEL_BODY),
        Paragraph(f"<b>RUC / Documento:</b> <font face='Courier-Bold'>{_esc(cust_ruc)}</font>", STYLE_PANEL_BODY),
        Paragraph(f"<b>Factura / Ticket Venta:</b> <font face='Courier-Bold'>{_esc(sale_numero)}</font>", STYLE_PANEL_BODY),
        Paragraph(f"<b>Fecha Compra Original:</b> {_esc(sale_fecha)}", STYLE_PANEL_BODY),
        Paragraph(f"<b>Importe Factura Venta:</b> {_fmt_gs(sale_total)}" if sale_total > 0 else "<b>Importe Factura Venta:</b> —", STYLE_PANEL_BODY),
    ]

    right_panel_cells = [
        Paragraph("<b>2. CAUSA, LOGÍSTICA & AUTORIZACIÓN DE AUDITORÍA</b>", STYLE_PANEL_HEADER),
        Spacer(1, 1 * mm),
        Paragraph(f"<b>Motivo Principal:</b> <font color='#BE123C'><b>{_esc(motivo_desc)}</b></font>", STYLE_PANEL_BODY),
        Paragraph(f"<b>Causa Específica:</b> {_esc(motivo_det)}", STYLE_PANEL_BODY),
        Paragraph(f"<b>Depósito Reingreso:</b> {_esc(almacen_nombre)}", STYLE_PANEL_BODY),
        Paragraph(f"<b>Nota de Crédito Fiscal:</b> <font face='Courier-Bold'>{_esc(nc_num or 'Pendiente / Reintegro en Efectivo')}</font>", STYLE_PANEL_BODY),
        Paragraph(f"<b>Emisor RMA:</b> {_esc(usuario_emisor)} · <b>Aprobó:</b> {_esc(aprobador_nom)} ({_esc(fecha_aprob)})", STYLE_PANEL_BODY),
    ]

    panel_left_table = Table([[left_panel_cells]], colWidths=[93 * mm])
    panel_left_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), COLOR_SLATE_50),
        ("BOX", (0, 0), (-1, -1), 0.5, COLOR_SLATE_200),
        ("TOPPADDING", (0, 0), (-1, -1), 3.5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3.5),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
    ]))

    panel_right_table = Table([[right_panel_cells]], colWidths=[93 * mm])
    panel_right_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), COLOR_SLATE_50),
        ("BOX", (0, 0), (-1, -1), 0.5, COLOR_SLATE_200),
        ("TOPPADDING", (0, 0), (-1, -1), 3.5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3.5),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
    ]))

    panels_table = Table(
        [[panel_left_table, "", panel_right_table]],
        colWidths=[93 * mm, 4 * mm, 93 * mm],
    )
    panels_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
    ]))
    elements.append(panels_table)
    elements.append(Spacer(1, 3 * mm))

    # 4. TABLA DETALLADA DE PRODUCTOS DEVUELTOS
    elements.append(Paragraph("<b>3. DETALLE DE MERCADERÍAS REINTEGRADAS A CONTROL FÍSICO</b>", STYLE_PANEL_HEADER))
    elements.append(Spacer(1, 1.5 * mm))

    col_w = [8 * mm, 24 * mm, 64 * mm, 26 * mm, 18 * mm, 22 * mm, 12 * mm, 26 * mm]

    table_data = [[
        Paragraph("#", STYLE_TH),
        Paragraph("CÓDIGO / SKU", STYLE_TH_LEFT),
        Paragraph("DESCRIPCIÓN DEL PRODUCTO", STYLE_TH_LEFT),
        Paragraph("CONDICIÓN", STYLE_TH),
        Paragraph("CANTIDAD", STYLE_TH_RIGHT),
        Paragraph("P. UNITARIO", STYLE_TH_RIGHT),
        Paragraph("IVA", STYLE_TH),
        Paragraph("TOTAL (PYG)", STYLE_TH_RIGHT),
    ]]

    tot_subtotal = Decimal("0")
    tot_iva10 = Decimal(str(data.get("iva_10") or 0))
    tot_iva5 = Decimal(str(data.get("iva_5") or 0))

    calc_iva10 = Decimal("0")
    calc_iva5 = Decimal("0")
    calc_exenta = Decimal("0")

    for idx, it in enumerate(items_list, start=1):
        sku = it.get("product_sku") or it.get("codigo_barra") or it.get("sku") or "—"
        p_name = it.get("product_name") or it.get("descripcion") or "Producto General"
        cond_raw = (it.get("condicion") or "buen_estado").lower()
        cond_info = CONDICIONES_MAP.get(cond_raw, (cond_raw.title(), "#334155", "#F1F5F9"))

        cant = float(it.get("cantidad") or 1)
        p_unit = float(it.get("precio_unitario") or 0)
        tasa_iva = float(it.get("iva_tasa") or 10)
        subt = float(it.get("total") or (cant * p_unit))

        subt_dec = Decimal(str(round(subt)))
        tot_subtotal += subt_dec

        if tasa_iva == 10:
            calc_iva10 += round(subt_dec / Decimal("11"))
        elif tasa_iva == 5:
            calc_iva5 += round(subt_dec / Decimal("21"))
        else:
            calc_exenta += subt_dec

        cond_p = Paragraph(
            f"<font color='{cond_info[1]}'><b>{cond_info[0]}</b></font>",
            STYLE_TD_CENTER,
        )

        table_data.append([
            Paragraph(str(idx), STYLE_TD_CENTER),
            Paragraph(f"<font face='Courier-Bold'>{_esc(sku)}</font>", STYLE_TD_TXT),
            Paragraph(f"<b>{_esc(p_name)}</b>", STYLE_TD_TXT),
            cond_p,
            Paragraph(f"<font face='Courier-Bold'>{cant:,.2f}</font>".replace(",00", ""), STYLE_TD_NUM),
            Paragraph(f"<font face='Courier-Bold'>{_fmt_gs(p_unit)}</font>", STYLE_TD_NUM),
            Paragraph(f"{int(tasa_iva)}%", STYLE_TD_CENTER),
            Paragraph(f"<font face='Courier-Bold'>{_fmt_gs(subt)}</font>", STYLE_TD_NUM),
        ])

    items_table = Table(table_data, colWidths=col_w, repeatRows=1)
    items_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), COLOR_SLATE_900),
        ("BOX", (0, 0), (-1, -1), 0.5, COLOR_SLATE_200),
        ("INNERGRID", (0, 0), (-1, -1), 0.3, COLOR_SLATE_200),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [WHITE, COLOR_SLATE_50]),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 2.2),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2.2),
        ("LEFTPADDING", (0, 0), (-1, -1), 2.5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 2.5),
    ]))
    elements.append(items_table)
    elements.append(Spacer(1, 3 * mm))

    # 5. LIQUIDACIÓN FISCAL & TOTAL GENERAL
    obs_texto = data.get("observaciones") or ""
    left_summary = []

    if obs_texto:
        obs_box = Table([
            [Paragraph("<b>OBSERVACIONES OPERATIVAS / REGISTRO RMA:</b>", STYLE_PANEL_HEADER)],
            [Paragraph(_esc(obs_texto), STYLE_PANEL_BODY)],
        ], colWidths=[105 * mm])
        obs_box.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), COLOR_SLATE_50),
            ("BOX", (0, 0), (-1, -1), 0.4, COLOR_SLATE_200),
            ("TOPPADDING", (0, 0), (-1, -1), 2.5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 2.5),
            ("LEFTPADDING", (0, 0), (-1, -1), 4),
            ("RIGHTPADDING", (0, 0), (-1, -1), 4),
        ]))
        left_summary.append(obs_box)
        left_summary.append(Spacer(1, 2 * mm))

    # Desglose impositivo oficial
    final_iva10 = tot_iva10 if tot_iva10 > 0 else calc_iva10
    final_iva5 = tot_iva5 if tot_iva5 > 0 else calc_iva5
    total_iva_liquidado = final_iva10 + final_iva5

    tax_box = Table([
        [
            Paragraph("<b>DESGLOSE FISCAL (IVA LEY 6380/19):</b>", STYLE_PANEL_HEADER),
            Paragraph(f"<b>IVA 10%:</b> {_fmt_gs(final_iva10)} · <b>IVA 5%:</b> {_fmt_gs(final_iva5)} · <b>Exentas:</b> {_fmt_gs(calc_exenta)}", STYLE_PANEL_BODY),
        ]
    ], colWidths=[55 * mm, 50 * mm])
    tax_box.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), COLOR_ROSE_50),
        ("BOX", (0, 0), (-1, -1), 0.4, COLOR_ROSE_100),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 2.5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2.5),
        ("LEFTPADDING", (0, 0), (-1, -1), 3),
        ("RIGHTPADDING", (0, 0), (-1, -1), 3),
    ]))
    left_summary.append(tax_box)

    # Bloque de Totales de la derecha
    totales_box = Table([
        [
            Paragraph("Total Unidades Reingresadas:", ParagraphStyle("CR_TL1", fontName=FONT_BOLD, fontSize=7.2, textColor=COLOR_SLATE_700)),
            Paragraph(f"<font face='Courier-Bold'>{total_unidades:,.2f} UN</font>".replace(",00", ""), ParagraphStyle("CR_TV1", fontName=FONT_BOLD, fontSize=8, textColor=COLOR_SLATE_900, alignment=TA_RIGHT)),
        ],
        [
            Paragraph("Liquidación Total IVA:", ParagraphStyle("CR_TL2", fontName=FONT_REGULAR, fontSize=6.8, textColor=COLOR_SLATE_600)),
            Paragraph(f"<font face='Courier-Bold'>{_fmt_gs(total_iva_liquidado)}</font>", ParagraphStyle("CR_TV2", fontName=FONT_BOLD, fontSize=7.2, textColor=COLOR_SLATE_800, alignment=TA_RIGHT)),
        ],
        [
            Paragraph("TOTAL DEVOLUCIÓN (PYG):", ParagraphStyle("CR_TL3", fontName=FONT_BOLD, fontSize=8, textColor=WHITE)),
            Paragraph(f"<font face='Courier-Bold'>{_fmt_gs(total_devuelto)}</font>", ParagraphStyle("CR_TV3", fontName=FONT_BOLD, fontSize=10.5, textColor=HexColor("#FB7185"), alignment=TA_RIGHT)),
        ],
    ], colWidths=[44 * mm, 37 * mm])
    totales_box.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), COLOR_SLATE_50),
        ("BACKGROUND", (0, 1), (-1, 1), COLOR_SLATE_100),
        ("BACKGROUND", (0, 2), (-1, 2), COLOR_SLATE_950),
        ("BOX", (0, 0), (-1, -1), 0.6, COLOR_SLATE_950),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 2.5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2.5),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
    ]))

    summary_grid = Table(
        [[left_summary, "", totales_box]],
        colWidths=[105 * mm, 4 * mm, 81 * mm],
    )
    summary_grid.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
    ]))
    elements.append(summary_grid)
    elements.append(Spacer(1, 4 * mm))

    # 6. CASILLAS OFICIALES DE CONTROL Y FIRMAS
    # 4 casillas de 46 mm + 3 separadores de 2 mm = 190 mm
    def _sig_box(number_title: str, role_title: str, sub_title: str, color_head=COLOR_ROSE_700, signer_name: str = "") -> Table:
        signer_p = Paragraph(f"<font size='5.5' color='#BE123C'><b>{_esc(signer_name)}</b></font>", ParagraphStyle("SignerP", alignment=TA_CENTER)) if signer_name else Spacer(1, 1 * mm)
        t = Table([
            [Paragraph(f"<b>{number_title}</b>", ParagraphStyle("SH", parent=STYLE_SIG_BOX_HEADER, textColor=color_head))],
            [Spacer(1, 10 * mm)],  # Espacio para firma física
            [HRFlowable(width="85%", thickness=0.5, color=COLOR_SLATE_400, spaceAfter=1 * mm)],
            [Paragraph(role_title, STYLE_SIG_BOX_ROLE)],
            [signer_p],
            [Paragraph(sub_title, STYLE_SIG_BOX_DESC)],
        ], colWidths=[46 * mm])
        t.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), COLOR_SLATE_50),
            ("BOX", (0, 0), (-1, -1), 0.5, COLOR_SLATE_200),
            ("ALIGN", (0, 0), (-1, -1), "CENTER"),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("TOPPADDING", (0, 0), (-1, -1), 2.5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 2.5),
            ("LEFTPADDING", (0, 0), (-1, -1), 2),
            ("RIGHTPADDING", (0, 0), (-1, -1), 2),
        ]))
        return t

    sig1 = _sig_box("1. CLIENTE / SOLICITANTE", "Recibí Conforme Valor/Cambio", "Firma, Aclaración y C.I.", COLOR_ROSE_700, signer_name=cust_name if cust_name != "Cliente Ocasional / General" else "")
    sig2 = _sig_box("2. ATENCIÓN AL CLIENTE", "Emitió Solicitud RMA", "Firma, Aclaración y Código", COLOR_ROSE_700, signer_name=usuario_emisor)
    sig3 = _sig_box("3. CONTROL DE DEPÓSITO", "Recepción y Control Físico", "Firma, Aclaración y Sello", COLOR_ROSE_700)
    sig4 = _sig_box("4. SUPERVISIÓN / CAJAS", "Autorizó Desglose Patrimonial", "Firma, Aclaración y Timbre", COLOR_ROSE_700, signer_name=aprobador_nom if aprobador_nom != "—" else "")

    signatures_title = Paragraph(
        "<b>CONSTANCIA OFICIAL DE CONFORMIDAD Y CIRCUITOS DE CONTROL (EXTRA SUPERMERCADO MAYORISTA)</b>",
        ParagraphStyle("CR_SigMainTitle", fontName=FONT_BOLD, fontSize=6.8, leading=8, textColor=COLOR_SLATE_500, alignment=TA_CENTER),
    )

    signatures_table = Table(
        [[sig1, "", sig2, "", sig3, "", sig4]],
        colWidths=[46 * mm, 2 * mm, 46 * mm, 2 * mm, 46 * mm, 2 * mm, 46 * mm],
    )
    signatures_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
    ]))

    sig_block = KeepTogether([
        signatures_title,
        Spacer(1, 1.5 * mm),
        signatures_table,
    ])
    elements.append(sig_block)

    doc.build(elements)
    pdf_bytes = buffer.getvalue()
    buffer.close()
    return pdf_bytes
