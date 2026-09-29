"""Generador de Remito Oficial de Devolución a Proveedor en PDF (A4 Portrait).
Diseño editorial premium corporativo para Extra Supermercado Mayorista (GRUPO SANTA TERESA E.A.S.).
Cumple con normativas de amparo logístico de mercaderías en tránsito, trazabilidad Kardex,
desglose de Notas de Crédito y casillas de control y firmas (Depósito, Compras, Seguridad, Transportista).
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

# Colores de estado corporativos
COLOR_SLATE_900 = HexColor("#0F172A")
COLOR_SLATE_800 = HexColor("#1E293B")
COLOR_SLATE_700 = HexColor("#334155")
COLOR_SLATE_500 = HexColor("#64748B")
COLOR_SLATE_200 = HexColor("#E2E8F0")
COLOR_SLATE_100 = HexColor("#F1F5F9")
COLOR_SLATE_50 = HexColor("#F8FAFC")

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

COLOR_ROSE_BG = HexColor("#FEF2F2")
COLOR_ROSE_BORDER = HexColor("#EF4444")
COLOR_ROSE_TEXT = HexColor("#991B1B")

# Tipografías y estilos
STYLE_COMPANY_TITLE = ParagraphStyle(
    "SR_CompanyTitle",
    fontName=FONT_BOLD,
    fontSize=11,
    leading=13,
    textColor=COLOR_SLATE_900,
)
STYLE_COMPANY_SUB = ParagraphStyle(
    "SR_CompanySub",
    fontName=FONT_BOLD,
    fontSize=8,
    leading=10,
    textColor=HexColor("#4F46E5"),
)
STYLE_COMPANY_META = ParagraphStyle(
    "SR_CompanyMeta",
    fontName=FONT_REGULAR,
    fontSize=6.8,
    leading=8.5,
    textColor=COLOR_SLATE_500,
)

STYLE_DOC_BADGE = ParagraphStyle(
    "SR_DocBadge",
    fontName=FONT_BOLD,
    fontSize=7,
    leading=8.5,
    textColor=HexColor("#312E81"),
    alignment=TA_RIGHT,
)
STYLE_DOC_NUM = ParagraphStyle(
    "SR_DocNum",
    fontName=FONT_BOLD,
    fontSize=13,
    leading=15,
    textColor=HexColor("#4338CA"),
    alignment=TA_RIGHT,
)
STYLE_DOC_META = ParagraphStyle(
    "SR_DocMeta",
    fontName=FONT_REGULAR,
    fontSize=7,
    leading=9,
    textColor=COLOR_SLATE_700,
    alignment=TA_RIGHT,
)

STYLE_BANNER_TITLE = ParagraphStyle(
    "SR_BannerTitle",
    fontName=FONT_BOLD,
    fontSize=8,
    leading=10,
    textColor=COLOR_SLATE_900,
)
STYLE_BANNER_SUB = ParagraphStyle(
    "SR_BannerSub",
    fontName=FONT_REGULAR,
    fontSize=6.8,
    leading=8.5,
    textColor=COLOR_SLATE_700,
)
STYLE_BANNER_TAG = ParagraphStyle(
    "SR_BannerTag",
    fontName=FONT_BOLD,
    fontSize=7.5,
    leading=9,
    alignment=TA_CENTER,
)

STYLE_PANEL_HEADER = ParagraphStyle(
    "SR_PanelHeader",
    fontName=FONT_BOLD,
    fontSize=7.5,
    leading=9.5,
    textColor=HexColor("#4338CA"),
)
STYLE_PANEL_BODY = ParagraphStyle(
    "SR_PanelBody",
    fontName=FONT_REGULAR,
    fontSize=7,
    leading=9.5,
    textColor=COLOR_SLATE_700,
)

STYLE_TH = ParagraphStyle(
    "SR_TH",
    fontName=FONT_BOLD,
    fontSize=6.6,
    leading=8,
    textColor=WHITE,
)
STYLE_TH_RIGHT = ParagraphStyle(
    "SR_TH_R",
    parent=STYLE_TH,
    alignment=TA_RIGHT,
)
STYLE_TH_CENTER = ParagraphStyle(
    "SR_TH_C",
    parent=STYLE_TH,
    alignment=TA_CENTER,
)

STYLE_TD = ParagraphStyle(
    "SR_TD",
    fontName=FONT_REGULAR,
    fontSize=6.7,
    leading=8.3,
    textColor=COLOR_SLATE_800,
)
STYLE_TD_BOLD = ParagraphStyle(
    "SR_TDBold",
    fontName=FONT_BOLD,
    fontSize=6.7,
    leading=8.3,
    textColor=COLOR_SLATE_900,
)
STYLE_TD_RIGHT = ParagraphStyle(
    "SR_TDR",
    parent=STYLE_TD,
    alignment=TA_RIGHT,
)
STYLE_TD_RIGHT_BOLD = ParagraphStyle(
    "SR_TDRBold",
    parent=STYLE_TD_BOLD,
    alignment=TA_RIGHT,
)
STYLE_TD_CENTER = ParagraphStyle(
    "SR_TDC",
    parent=STYLE_TD,
    alignment=TA_CENTER,
)
STYLE_TD_MUTED = ParagraphStyle(
    "SR_TDMuted",
    parent=STYLE_TD,
    fontSize=6,
    leading=7.5,
    textColor=COLOR_SLATE_500,
)

STYLE_SECTION_TITLE = ParagraphStyle(
    "SR_SecTitle",
    fontName=FONT_BOLD,
    fontSize=8,
    leading=10,
    textColor=COLOR_SLATE_900,
)

STYLE_SIG_BOX_HEADER = ParagraphStyle(
    "SR_SigHead",
    fontName=FONT_BOLD,
    fontSize=6.8,
    leading=8,
    textColor=HexColor("#4338CA"),
    alignment=TA_CENTER,
)
STYLE_SIG_BOX_ROLE = ParagraphStyle(
    "SR_SigRole",
    fontName=FONT_BOLD,
    fontSize=7.2,
    leading=9,
    textColor=COLOR_SLATE_900,
    alignment=TA_CENTER,
)
STYLE_SIG_BOX_DESC = ParagraphStyle(
    "SR_SigDesc",
    fontName=FONT_REGULAR,
    fontSize=6,
    leading=7.5,
    textColor=COLOR_SLATE_500,
    alignment=TA_CENTER,
)


def _esc(val: Any) -> str:
    """Escapa de forma segura cadenas de texto para el parser XML de ReportLab."""
    if val is None:
        return "—"
    return html.escape(str(val))


def _format_datetime_py(dt_val: Any) -> str:
    if not dt_val:
        return "—"
    try:
        if isinstance(dt_val, str):
            dt = datetime.fromisoformat(dt_val.replace("Z", "+00:00"))
        elif isinstance(dt_val, datetime):
            dt = dt_val
        else:
            return str(dt_val)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=PY_TZ)
        else:
            dt = dt.astimezone(PY_TZ)
        return dt.strftime("%d/%m/%Y %H:%M")
    except Exception:
        return str(dt_val)[:16]


def _format_date_py(d_val: Any) -> str:
    if not d_val:
        return "—"
    try:
        if isinstance(d_val, str):
            if "T" in d_val or " " in d_val:
                return _format_datetime_py(d_val)[:10]
            parts = d_val.split("-")
            if len(parts) == 3:
                return f"{parts[2]}/{parts[1]}/{parts[0]}"
            return d_val
        if hasattr(d_val, "strftime"):
            return d_val.strftime("%d/%m/%Y")
        return str(d_val)
    except Exception:
        return str(d_val)


def generate_supplier_return_pdf(company: dict, data: dict, generated_by: str = "") -> bytes:
    """Genera el buffer de bytes del PDF del Remito Oficial de Devolución a Proveedor."""
    buffer = io.BytesIO()

    # Título y canvas numerado con pie institucional
    doc_title = f"Remito_{data.get('codigo', 'DEV')}"
    footer_text = "Extra Supermercado Mayorista · GRUPO SANTA TERESA E.A.S. · RUC 80150377-9 · Remito Oficial de Devolución"

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

    codigo = data.get("codigo") or f"DEV-{str(data.get('id', ''))[:8].upper()}"
    fecha_emision = _format_datetime_py(data.get("fecha_creacion") or datetime.now(PY_TZ))
    almacen_origen = data.get("almacen_nombre") or "Depósito Central"

    logo_flow = _logo_flowable(company, max_w=36 * mm, max_h=15 * mm)

    company_lines = [
        Paragraph(fantasia.upper(), STYLE_COMPANY_TITLE),
        Paragraph(razon_social.upper(), STYLE_COMPANY_SUB),
        Paragraph(f"<b>RUC:</b> {ruc_empresa} · <b>Timbrado:</b> {timbrado_empresa}", STYLE_COMPANY_META),
        Paragraph(f"{direccion_empresa} — {ciudad_empresa}", STYLE_COMPANY_META),
        Paragraph(f"<b>Teléfono:</b> {tel_empresa} · <b>Email:</b> compras@superextra.com.py", STYLE_COMPANY_META),
    ]

    doc_box_content = [
        Paragraph("REMITO OFICIAL DE DEVOLUCIÓN", STYLE_DOC_BADGE),
        Paragraph(f"N° {codigo}", STYLE_DOC_NUM),
        Paragraph(f"<b>Fecha Emisión:</b> {fecha_emision}", STYLE_DOC_META),
        Paragraph(f"<b>Depósito Origen:</b> {_esc(almacen_origen)}", STYLE_DOC_META),
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
    elements.append(HRFlowable(width="100%", thickness=1.5, color=HexColor("#4F46E5"), spaceAfter=3 * mm))

    # 2. BANNER DE TRAZABILIDAD Y ESTADO KARDEX
    estado = (data.get("estado") or "pendiente").lower()
    ya_impacto_stock = estado == "completado"

    items_list = data.get("items") or []
    total_bultos = sum(float(it.get("cantidad") or 0) for it in items_list)
    total_calculado = sum(float(it.get("valor_total") or (float(it.get("cantidad") or 0) * float(it.get("valor_unitario") or 0))) for it in items_list)
    total_devuelto = total_calculado if total_calculado > 0 else float(data.get("valor_total_estimado") or 0)

    if ya_impacto_stock:
        bg_col = COLOR_EMERALD_BG
        border_col = COLOR_EMERALD_BORDER
        title_text = "✓ STOCK EGRESADO DEL INVENTARIO — SALIDA FÍSICA CONFIRMADA"
        sub_text = (
            f"Se descontaron {total_bultos:,.0f} unidades del depósito bajo movimiento Kardex "
            "'devolucion_proveedor'. Saldo de compras y crédito mercantil regularizados."
        )
        tag_text = "SÍ (DESCONTADO)"
        tag_bg = COLOR_EMERALD_DARK
        tag_fg = WHITE
    elif estado == "autorizado":
        bg_col = COLOR_BLUE_BG
        border_col = COLOR_BLUE_BORDER
        title_text = "SALIDA AUTORIZADA — PENDIENTE DE RETIRO EN DEPÓSITO"
        sub_text = "Devolución aprobada comercialmente. Mercadería separada en zona de despacho para entrega física a transportista."
        tag_text = "PENDIENTE (NO)"
        tag_bg = COLOR_BLUE_TEXT
        tag_fg = WHITE
    elif estado == "rechazado":
        bg_col = COLOR_ROSE_BG
        border_col = COLOR_ROSE_BORDER
        motivo = data.get("motivo_rechazo") or "No cumple condiciones comerciales acordadas"
        title_text = "SOLICITUD RECHAZADA — SIN IMPACTO EN STOCK"
        sub_text = f"Motivo de rechazo: {_esc(motivo)}."
        tag_text = "RECHAZADO"
        tag_bg = COLOR_ROSE_TEXT
        tag_fg = WHITE
    else:
        bg_col = COLOR_AMBER_BG
        border_col = COLOR_AMBER_BORDER
        title_text = "SOLICITUD EN TRÁMITE — SIN EGRESO DE INVENTARIO"
        sub_text = "Solicitud registrada en revisión. No descuenta stock físico ni contable hasta su autorización y entrega."
        tag_text = "PENDIENTE (NO)"
        tag_bg = COLOR_AMBER_TEXT
        tag_fg = WHITE

    banner_left = [
        Paragraph(title_text, STYLE_BANNER_TITLE),
        Paragraph(sub_text, STYLE_BANNER_SUB),
    ]

    tag_paragraph = Paragraph(
        f"<b>{tag_text}</b>",
        ParagraphStyle("SR_TagP", parent=STYLE_BANNER_TAG, textColor=tag_fg),
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
        Paragraph("<font size='5.5' color='#64748B'><b>IMPACTO EN STOCK:</b></font>", ParagraphStyle("RAlign", alignment=TA_RIGHT)),
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
        ("TOPPADDING", (0, 0), (-1, -1), 3.5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3.5),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
    ]))
    elements.append(banner_table)
    elements.append(Spacer(1, 2.5 * mm))

    # 3. PANELES EN 2 COLUMNAS (PROVEEDOR Y CONDICIONES)
    prov_nombre = data.get("proveedor_nombre") or "Proveedor Sin Asignar"
    prov_ruc = data.get("proveedor_ruc") or "—"
    prov_tel = data.get("proveedor_telefono") or "—"
    prov_dir = data.get("proveedor_direccion") or "—"

    first_factura = next((it.get("factura_numero") for it in items_list if it.get("factura_numero")), None) or "Ajuste Directo / Sin Factura"
    fecha_retiro = _format_date_py(data.get("fecha_estimada_retiro")) if data.get("fecha_estimada_retiro") else "Coordinación inmediata"

    left_panel_cells = [
        Paragraph("<b>DATOS DEL PROVEEDOR DESTINATARIO</b>", STYLE_PANEL_HEADER),
        Spacer(1, 1 * mm),
        Paragraph(f"<b>Razón Social:</b> {_esc(prov_nombre)}", STYLE_PANEL_BODY),
        Paragraph(f"<b>RUC:</b> <font face='Courier-Bold'>{_esc(prov_ruc)}</font>", STYLE_PANEL_BODY),
        Paragraph(f"<b>Teléfono:</b> {_esc(prov_tel)}", STYLE_PANEL_BODY),
        Paragraph(f"<b>Dirección:</b> {_esc(prov_dir)}", STYLE_PANEL_BODY),
    ]

    right_panel_cells = [
        Paragraph("<b>CONDICIONES DE IMPUTACIÓN Y TRASLADO</b>", STYLE_PANEL_HEADER),
        Spacer(1, 1 * mm),
        Paragraph(f"<b>Factura(s) Afectada(s):</b> <font face='Courier-Bold'>{_esc(first_factura)}</font>", STYLE_PANEL_BODY),
        Paragraph("<b>Moneda de Operación:</b> Guaraníes (PYG)", STYLE_PANEL_BODY),
        Paragraph(f"<b>Depósito de Despacho:</b> {_esc(almacen_origen)}", STYLE_PANEL_BODY),
        Paragraph(f"<b>Fecha Estimada Retiro:</b> {_esc(fecha_retiro)}", STYLE_PANEL_BODY),
    ]

    panel_left_table = Table([[left_panel_cells]], colWidths=[93 * mm])
    panel_left_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), COLOR_SLATE_50),
        ("BOX", (0, 0), (-1, -1), 0.5, COLOR_SLATE_200),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
    ]))

    panel_right_table = Table([[right_panel_cells]], colWidths=[93 * mm])
    panel_right_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), COLOR_SLATE_50),
        ("BOX", (0, 0), (-1, -1), 0.5, COLOR_SLATE_200),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
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

    # 4. TABLA DE MERCADERÍA DEVUELTA (ANCHO EXACTO 190 MM)
    # Anchos: # (7), SKU (20), Cód. Barra (24), Descripción (53), Lote/Vto (20), Motivo (18), Cant (12), Unitario (17), Subtotal (19) = 190 mm
    table_headers = [
        Paragraph("#", STYLE_TH_CENTER),
        Paragraph("Cód. / SKU", STYLE_TH),
        Paragraph("Cód. Barra", STYLE_TH),
        Paragraph("Descripción del Producto", STYLE_TH),
        Paragraph("Lote / Vto.", STYLE_TH),
        Paragraph("Motivo", STYLE_TH),
        Paragraph("Cant.", STYLE_TH_RIGHT),
        Paragraph("Unitario Gs.", STYLE_TH_RIGHT),
        Paragraph("Subtotal Gs.", STYLE_TH_RIGHT),
    ]

    col_widths = [
        7 * mm,
        20 * mm,
        24 * mm,
        53 * mm,
        20 * mm,
        18 * mm,
        12 * mm,
        17 * mm,
        19 * mm,
    ]

    table_data = [table_headers]

    if not items_list:
        no_items_row = [
            Paragraph("—", STYLE_TD_CENTER),
            Paragraph("Sin ítems registrados en esta devolución", STYLE_TD),
            "", "", "", "", "", "", ""
        ]
        table_data.append(no_items_row)
    else:
        for idx, it in enumerate(items_list, 1):
            sku_val = it.get("sku") or it.get("codigo_interno") or "—"
            bar_val = it.get("codigo_barra") or it.get("codigo_barras") or "—"
            desc_val = _esc(it.get("producto_nombre") or "Producto")
            detalle_val = it.get("detalle")
            if detalle_val:
                desc_val += f"<br/><font size='5.5' color='#64748B'><i>Nota: {_esc(detalle_val)}</i></font>"

            lote_val = it.get("lote")
            vto_val = _format_date_py(it.get("fecha_vencimiento")) if it.get("fecha_vencimiento") else None
            lote_str = ""
            if lote_val and vto_val:
                lote_str = f"L: {_esc(lote_val)}<br/>V: {_esc(vto_val)}"
            elif lote_val:
                lote_str = f"L: {_esc(lote_val)}"
            elif vto_val:
                lote_str = f"V: {_esc(vto_val)}"
            else:
                lote_str = "—"

            motivo_val = _esc(it.get("motivo") or "Devolución")
            cant_num = float(it.get("cantidad") or 0)
            unit_num = float(it.get("valor_unitario") or 0)
            sub_num = float(it.get("valor_total") or (cant_num * unit_num))

            row = [
                Paragraph(str(idx), STYLE_TD_CENTER),
                Paragraph(f"<font face='Courier-Bold'>{_esc(sku_val)}</font>", STYLE_TD),
                Paragraph(f"<font face='Courier'>{_esc(bar_val)}</font>", STYLE_TD),
                Paragraph(desc_val, STYLE_TD_BOLD),
                Paragraph(lote_str, STYLE_TD_MUTED),
                Paragraph(motivo_val, STYLE_TD),
                Paragraph(f"<b>{cant_num:,.0f}</b>", STYLE_TD_RIGHT_BOLD),
                Paragraph(_fmt_gs(unit_num), STYLE_TD_RIGHT),
                Paragraph(f"<b>{_fmt_gs(sub_num)}</b>", STYLE_TD_RIGHT_BOLD),
            ]
            table_data.append(row)

    items_table = Table(table_data, colWidths=col_widths, repeatRows=1)
    t_style = [
        ("BACKGROUND", (0, 0), (-1, 0), COLOR_SLATE_900),
        ("TEXTCOLOR", (0, 0), (-1, 0), WHITE),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 2.8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2.8),
        ("LEFTPADDING", (0, 0), (-1, -1), 2.5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 2.5),
        ("GRID", (0, 0), (-1, -1), 0.4, COLOR_SLATE_200),
    ]
    # Colores alternados para filas
    for r_idx in range(1, len(table_data)):
        bg = WHITE if r_idx % 2 != 0 else COLOR_SLATE_50
        t_style.append(("BACKGROUND", (0, r_idx), (-1, r_idx), bg))

    items_table.setStyle(TableStyle(t_style))
    elements.append(items_table)
    elements.append(Spacer(1, 3 * mm))

    # 5. TOTALES, RESUMEN Y NOTAS DE CRÉDITO
    left_summary_elements = []

    # Observaciones
    obs = data.get("observaciones")
    if obs:
        obs_table = Table([
            [Paragraph("<b>OBSERVACIONES GENERALES:</b>", ParagraphStyle("SR_ObsH", fontName=FONT_BOLD, fontSize=6.5, textColor=COLOR_SLATE_500))],
            [Paragraph(f"<i>&ldquo;{_esc(obs)}&rdquo;</i>", ParagraphStyle("SR_ObsB", fontName=FONT_REGULAR, fontSize=6.8, leading=8.5, textColor=COLOR_SLATE_800))],
        ], colWidths=[105 * mm])
        obs_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), COLOR_SLATE_50),
            ("BOX", (0, 0), (-1, -1), 0.5, COLOR_SLATE_200),
            ("TOPPADDING", (0, 0), (-1, -1), 2.5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 2.5),
            ("LEFTPADDING", (0, 0), (-1, -1), 4),
            ("RIGHTPADDING", (0, 0), (-1, -1), 4),
        ]))
        left_summary_elements.append(obs_table)
        left_summary_elements.append(Spacer(1, 1.5 * mm))

    # Notas de Crédito
    ncs = data.get("notas_credito") or []
    single_nc_num = data.get("nota_credito_numero")
    single_nc_monto = data.get("nota_credito_monto")

    if ncs or single_nc_num:
        nc_rows = []
        nc_header_title = f"NOTAS DE CRÉDITO VINCULADAS ({len(ncs)})" if len(ncs) > 1 else "NOTA DE CRÉDITO VINCULADA"
        nc_rows.append([
            Paragraph(f"<b>{nc_header_title}</b>", ParagraphStyle("SR_NCH", fontName=FONT_BOLD, fontSize=6.8, textColor=COLOR_EMERALD_TEXT)),
            Paragraph(f"<b>{_fmt_gs(single_nc_monto or sum(float(x.get('monto') or 0) for x in ncs))}</b>" if (single_nc_monto or ncs) else "", ParagraphStyle("SR_NCT", fontName=FONT_BOLD, fontSize=6.8, textColor=COLOR_EMERALD_TEXT, alignment=TA_RIGHT)),
        ])

        if ncs:
            for nc in ncs:
                nc_num = nc.get("numero") or "S/N"
                timb = f" (Timb: {nc.get('timbrado')})" if nc.get("timbrado") else ""
                fact = f" → Fact: {nc.get('factura_numero')}" if nc.get("factura_numero") else ""
                monto = float(nc.get("monto") or 0)
                nc_rows.append([
                    Paragraph(f"<font face='Courier-Bold'>{_esc(nc_num)}</font>{timb}{fact}", ParagraphStyle("SR_NCD", fontName=FONT_REGULAR, fontSize=6.3, leading=7.5, textColor=COLOR_SLATE_800)),
                    Paragraph(f"<font face='Courier-Bold'>{_fmt_gs(monto)}</font>", ParagraphStyle("SR_NCM", fontName=FONT_BOLD, fontSize=6.3, leading=7.5, textColor=COLOR_EMERALD_TEXT, alignment=TA_RIGHT)),
                ])
        elif single_nc_num:
            nc_rows.append([
                Paragraph(f"<font face='Courier-Bold'>{_esc(single_nc_num)}</font>", ParagraphStyle("SR_NCD", fontName=FONT_REGULAR, fontSize=6.3, leading=7.5, textColor=COLOR_SLATE_800)),
                Paragraph(f"<font face='Courier-Bold'>{_fmt_gs(single_nc_monto or 0)}</font>", ParagraphStyle("SR_NCM", fontName=FONT_BOLD, fontSize=6.3, leading=7.5, textColor=COLOR_EMERALD_TEXT, alignment=TA_RIGHT)),
            ])

        nc_table = Table(nc_rows, colWidths=[75 * mm, 30 * mm])
        nc_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), COLOR_EMERALD_BG),
            ("BOX", (0, 0), (-1, -1), 0.5, COLOR_EMERALD_BORDER),
            ("LINEBELOW", (0, 0), (-1, 0), 0.4, COLOR_EMERALD_BORDER),
            ("TOPPADDING", (0, 0), (-1, -1), 2),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
            ("LEFTPADDING", (0, 0), (-1, -1), 4),
            ("RIGHTPADDING", (0, 0), (-1, -1), 4),
        ]))
        left_summary_elements.append(nc_table)

    if not left_summary_elements:
        left_summary_elements.append(Paragraph("<font size='6.5' color='#94A3B8'><i>Sin observaciones comerciales adicionales. Documento oficial emitido conforme.</i></font>", ParagraphStyle("SR_Void")))

    # Panel de Totales de la derecha (81 mm de ancho)
    totales_box = Table([
        [
            Paragraph("Total Unidades Egresadas:", ParagraphStyle("SR_TotLbl1", fontName=FONT_BOLD, fontSize=7.2, textColor=COLOR_SLATE_700)),
            Paragraph(f"<font face='Courier-Bold'>{total_bultos:,.0f} UN</font>", ParagraphStyle("SR_TotVal1", fontName=FONT_BOLD, fontSize=8, textColor=COLOR_SLATE_900, alignment=TA_RIGHT)),
        ],
        [
            Paragraph("TOTAL DEVOLUCIÓN (PYG):", ParagraphStyle("SR_TotLbl2", fontName=FONT_BOLD, fontSize=7.8, textColor=WHITE)),
            Paragraph(f"<font face='Courier-Bold'>{_fmt_gs(total_devuelto)}</font>", ParagraphStyle("SR_TotVal2", fontName=FONT_BOLD, fontSize=10, textColor=HexColor("#34D399"), alignment=TA_RIGHT)),
        ],
    ], colWidths=[45 * mm, 36 * mm])
    totales_box.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), COLOR_SLATE_50),
        ("BACKGROUND", (0, 1), (-1, 1), COLOR_SLATE_900),
        ("BOX", (0, 0), (-1, -1), 0.6, COLOR_SLATE_900),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 3.5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3.5),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
    ]))

    summary_grid = Table(
        [[left_summary_elements, "", totales_box]],
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

    # 6. CASILLAS OFICIALES DE CONTROL Y FIRMAS (4 FIRMAS OBLIGATORIAS)
    # Total ancho: 190 mm -> 4 casillas de 46 mm + 3 separadores de 2 mm = 190 mm
    autorizado_nom = data.get("autorizado_por_nombre") or ""
    completado_nom = data.get("completado_por_nombre") or ""

    def _sig_box(number_title: str, role_title: str, sub_title: str, color_head=HexColor("#4338CA"), signer_name: str = "") -> Table:
        signer_p = Paragraph(f"<font size='5.5' color='#4338CA'><b>{_esc(signer_name)}</b></font>", ParagraphStyle("SignerP", alignment=TA_CENTER)) if signer_name else Spacer(1, 1 * mm)
        t = Table([
            [Paragraph(f"<b>{number_title}</b>", ParagraphStyle("SH", parent=STYLE_SIG_BOX_HEADER, textColor=color_head))],
            [Spacer(1, 10 * mm)],  # Espacio para firma física
            [HRFlowable(width="85%", thickness=0.5, color=COLOR_SLATE_500, spaceAfter=1 * mm)],
            [Paragraph(role_title, STYLE_SIG_BOX_ROLE)],
            [signer_p],
            [Paragraph(sub_title, STYLE_SIG_BOX_DESC)],
        ], colWidths=[46 * mm])
        t.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), COLOR_SLATE_50),
            ("BOX", (0, 0), (-1, -1), 0.5, COLOR_SLATE_200),
            ("ALIGN", (0, 0), (-1, -1), "CENTER"),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("TOPPADDING", (0, 0), (-1, -1), 3),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
            ("LEFTPADDING", (0, 0), (-1, -1), 2),
            ("RIGHTPADDING", (0, 0), (-1, -1), 2),
        ]))
        return t

    sig1 = _sig_box("1. DEPÓSITO / MERMAS", "Entregó Mercadería", "Firma, Aclaración y C.I.", HexColor("#4338CA"), signer_name=completado_nom)
    sig2 = _sig_box("2. COMPRAS / ADMIN.", "Autorizó Devolución", "Firma, Aclaración y C.I.", HexColor("#4338CA"), signer_name=autorizado_nom)
    sig3 = _sig_box("3. PORTERÍA / SEGURIDAD", "Control de Bultos", "Firma, C.I. y Hora Salida", HexColor("#4338CA"))
    sig4 = _sig_box("4. TRANSPORTISTA", "Recibí Conforme", "Aclaración, C.I. y Chapa", HexColor("#B91C1C"))

    signatures_title = Paragraph(
        "<b>CONSTANCIA DE CONFORMIDAD Y CIRCUITOS DE AUTORIZACIÓN (EXTRA SUPERMERCADO MAYORISTA)</b>",
        ParagraphStyle("SR_SigMainTitle", fontName=FONT_BOLD, fontSize=7, leading=8.5, textColor=COLOR_SLATE_500, alignment=TA_CENTER),
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

    signatures_block = KeepTogether([
        signatures_title,
        Spacer(1, 1.5 * mm),
        signatures_table,
        Spacer(1, 2 * mm),
        Paragraph(
            "<font size='5.5' color='#94A3B8'>Extra Supermercado Mayorista · GRUPO SANTA TERESA E.A.S. · RUC 80150377-9 · Pedro Juan Caballero, Paraguay · Documento válido para amparo logístico de mercadería en tránsito</font>",
            ParagraphStyle("SR_Legal", fontName=FONT_REGULAR, fontSize=5.5, leading=7, textColor=COLOR_SLATE_500, alignment=TA_CENTER),
        ),
    ])
    elements.append(signatures_block)

    # Construir documento
    doc.build(elements, canvasmaker=doc._audited_canvasmaker)
    return buffer.getvalue()
