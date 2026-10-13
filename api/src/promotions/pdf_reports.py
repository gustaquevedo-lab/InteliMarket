"""Generador de Informe Técnico Oficial de Promociones para Encargados y Trade Marketing.
Diseñado para impresión y archivo corporativo en Extra Supermercado Mayorista (GRUPO SANTA TERESA E.A.S. - RUC 80150377-9).
"""
import io
import os
from datetime import datetime, date
from decimal import Decimal
from zoneinfo import ZoneInfo
from typing import Optional, Dict, Any, List

from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.units import mm
from reportlab.lib.colors import HexColor
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_RIGHT, TA_LEFT
from reportlab.platypus import (
    Paragraph, Spacer, Table, TableStyle, KeepTogether, PageBreak, HRFlowable
)

from api.src.integrated_finance.pdf_reports import (
    _base_doc, _base_landscape_doc,
    _company_header, _company_landscape_header,
    _fmt_gs, _build,
    PRIMARY_COLOR, GRAY_LIGHT, GRAY_MEDIUM, GRAY_DARK, RED, GREEN, WHITE,
    FONT_BOLD, FONT_REGULAR
)


PY_TZ = ZoneInfo("America/Asuncion")


def _fmt_pyg(v) -> str:
    if v is None:
        return "0 Gs."
    try:
        val = int(round(float(v)))
        return f"{val:,} Gs.".replace(",", ".")
    except Exception:
        return str(v)


def generate_promotion_official_report_pdf(
    company: dict,
    promotion: dict,
    products_details: List[dict],
    generated_by: str = ""
) -> bytes:
    """Genera el Informe Oficial en PDF de la promoción para entrega a Encargados de Salón y Cajas."""
    buffer = io.BytesIO()
    doc, styles = _base_doc(buffer, f"Informe Promocion - {promotion.get('nombre', 'Campaña')}", company, generated_by)

    USABLE_W = 186 * mm
    subtitulo = f"Ficha Operativa, Directivas de Caja y Pautas de Exhibición · Emisión: {datetime.now(PY_TZ).strftime('%d/%m/%Y %H:%M')}"
    
    elements = _company_header(
        company, styles,
        "INFORME TÉCNICO DE CAMPAÑA PROMOCIONAL & DIRECTIVAS DE SALÓN",
        subtitulo,
        generated_by
    )

    # Estilos de texto locales
    style_label = ParagraphStyle(
        "PromoLabel",
        fontName=FONT_BOLD,
        fontSize=8,
        leading=10,
        textColor=GRAY_MEDIUM
    )
    style_val = ParagraphStyle(
        "PromoVal",
        fontName=FONT_BOLD,
        fontSize=9,
        leading=11,
        textColor=PRIMARY_COLOR
    )
    style_section = ParagraphStyle(
        "PromoSection",
        fontName=FONT_BOLD,
        fontSize=10,
        leading=12,
        textColor=PRIMARY_COLOR
    )
    style_p = ParagraphStyle(
        "PromoBody",
        fontName=FONT_REGULAR,
        fontSize=8,
        leading=10.5,
        textColor=GRAY_DARK
    )
    style_th = ParagraphStyle(
        "PromoTH",
        fontName=FONT_BOLD,
        fontSize=7.5,
        leading=9.5,
        textColor=WHITE
    )
    style_td = ParagraphStyle(
        "PromoTD",
        fontName=FONT_REGULAR,
        fontSize=7.5,
        leading=9.5,
        textColor=GRAY_DARK
    )
    style_td_num = ParagraphStyle(
        "PromoTDNum",
        fontName=FONT_BOLD,
        fontSize=7.5,
        leading=9.5,
        textColor=GRAY_DARK,
        alignment=2
    )

    elements.append(Spacer(1, 3 * mm))

    # ── 1. FICHA TÉCNICA DE LA CAMPAÑA ─────────────────────────────────────────
    elements.append(Paragraph("1. PARÁMETROS GENERALES DE LA CAMPAÑA", style_section))
    elements.append(Spacer(1, 1.5 * mm))

    valido_desde = promotion.get("valido_desde")
    if isinstance(valido_desde, (date, datetime)):
        valido_desde_str = valido_desde.strftime("%d/%m/%Y")
    else:
        valido_desde_str = str(valido_desde or "—")

    valido_hasta = promotion.get("valido_hasta")
    if isinstance(valido_hasta, (date, datetime)):
        valido_hasta_str = valido_hasta.strftime("%d/%m/%Y")
    else:
        valido_hasta_str = str(valido_hasta or "—")

    tipo_str = str(promotion.get("tipo", "—")).replace("_", " ").upper()
    origen_str = str(promotion.get("origen", "iniciativa_propia")).replace("_", " ").title()
    financiamiento_str = str(promotion.get("financiamiento", "propio_supermercado")).replace("_", " ").title()
    proveedor_str = promotion.get("supplier_nombre") or "Extra Supermercado (Tienda Propia)"
    proveedor_ruc = promotion.get("supplier_ruc") or "—"

    estado_str = "VIGENTE / ACTIVA" if promotion.get("activo") else "PAUSADA"

    terminacion = promotion.get("terminacion_psicologica")
    terminacion_str = f"Terminación .{terminacion}" if terminacion is not None else "Sin ajuste psicológico"

    datos_campana = [
        [
            Paragraph("Nombre de Campaña:", style_label),
            Paragraph(f"<b>{promotion.get('nombre', '—')}</b>", style_val),
            Paragraph("Estado:", style_label),
            Paragraph(f"<b>{estado_str}</b>", style_val),
        ],
        [
            Paragraph("Vigencia:", style_label),
            Paragraph(f"Del <b>{valido_desde_str}</b> al <b>{valido_hasta_str}</b>", style_val),
            Paragraph("Mecánica Promocional:", style_label),
            Paragraph(f"<b>{tipo_str}</b> ({terminacion_str})", style_val),
        ],
        [
            Paragraph("Proveedor / Marca:", style_label),
            Paragraph(f"<b>{proveedor_str}</b> (RUC: {proveedor_ruc})", style_val),
            Paragraph("Modelo Financiero:", style_label),
            Paragraph(f"<b>{financiamiento_str}</b> ({origen_str})", style_val),
        ],
    ]

    t_campana = Table(datos_campana, colWidths=[32 * mm, 61 * mm, 35 * mm, 58 * mm])
    t_campana.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), HexColor("#F8FAFC")),
        ("BOX", (0, 0), (-1, -1), 0.5, HexColor("#CBD5E1")),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, HexColor("#E2E8F0")),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
    ]))
    elements.append(t_campana)
    elements.append(Spacer(1, 3.5 * mm))

    # ── 2. PAUTAS OPERATIVAS PARA ENCARGADOS DE SALÓN Y CAJAS ─────────────────
    elements.append(Paragraph("2. DIRECTIVAS OPERATIVAS PARA SALÓN Y LÍNEA DE CAJAS", style_section))
    elements.append(Spacer(1, 1.5 * mm))

    limite_compra = promotion.get("limite_por_compra")
    limite_str = f"Máximo {limite_compra} unidades por ticket/cliente." if limite_compra else "Sin límite de unidades por ticket."
    combinable_str = "SÍ acumulable con otros descuentos." if promotion.get("combinable") else "NO acumulable con otras ofertas o cupones."
    min_compra = promotion.get("monto_minimo_compra")
    min_compra_str = f"Monto mínimo de ticket para activar: {_fmt_pyg(min_compra)}" if min_compra else "Sin monto mínimo de ticket."

    dias_semana = promotion.get("dias_semana")
    if dias_semana and len(dias_semana) < 7:
        dias_nombres = {0: "Dom", 1: "Lun", 2: "Mar", 3: "Mié", 4: "Jue", 5: "Vie", 6: "Sáb"}
        dias_str = ", ".join(dias_nombres.get(d, str(d)) for d in dias_semana)
        dias_info = f"Días específicos habilitados en caja: <b>{dias_str}</b>."
    else:
        dias_info = "Habilitado todos los días de la semana durante el período de vigencia."

    horario_info = ""
    if promotion.get("horario_desde") and promotion.get("horario_hasta"):
        horario_info = f" · Horario Happy Hour: <b>{promotion['horario_desde']} a {promotion['horario_hasta']}</b>."

    pautas = [
        Paragraph(f"• <b>Línea de Cajas:</b> La bonificación se aplica de forma automática en el punto de venta (POS) al escanear los productos asociados. {limite_str} {combinable_str}", style_p),
        Paragraph(f"• <b>Condiciones del Ticket:</b> {min_compra_str} {dias_info}{horario_info}", style_p),
        Paragraph("• <b>Salón y Reposición:</b> Los productos participantes deben mantenerse con stock disponible en góndola principal y debidamente señalizados con cenefa / cartelera de oferta destacada con el precio final.", style_p),
        Paragraph("• <b>Auditoría y Despacho:</b> Queda prohibido el fraccionamiento de tickets para eludir límites por compra. Cualquier excepción de tolerancia horaria requiere aprobación por PIN de Supervisor.", style_p),
    ]

    t_pautas = Table([[p] for p in pautas], colWidths=[USABLE_W])
    t_pautas.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), HexColor("#F1F5F9")),
        ("BOX", (0, 0), (-1, -1), 0.5, HexColor("#94A3B8")),
        ("TOPPADDING", (0, 0), (-1, -1), 2.5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2.5),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
    ]))
    elements.append(t_pautas)
    elements.append(Spacer(1, 3.5 * mm))

    # ── 3. DETALLE DE PRODUCTOS PARTICIPANTES ──────────────────────────────────
    elements.append(Paragraph(f"3. LISTADO DE PRODUCTOS PARTICIPANTES ({len(products_details)} ítems)", style_section))
    elements.append(Spacer(1, 1.5 * mm))

    table_data = [
        [
            Paragraph("Cód. Barra / SKU", style_th),
            Paragraph("Descripción del Producto", style_th),
            Paragraph("Costo Unit.", style_th),
            Paragraph("PVP Regular", style_th),
            Paragraph("PVP Promo", style_th),
            Paragraph("Ahorro", style_th),
            Paragraph("Margen", style_th),
        ]
    ]

    for p in products_details:
        costo = float(p.get("costo_promedio", 0) or 0)
        regular = float(p.get("precio_regular", 0) or 0)
        promo = float(p.get("precio_promocional", 0) or 0)
        ahorro_pct = round(((regular - promo) / regular * 100)) if regular > 0 and regular > promo else 0
        margen_pct = round(((promo - costo) / promo * 100), 1) if promo > 0 else 0
        es_bajo_costo = promo < costo

        margen_text = f"{margen_pct}%"
        if es_bajo_costo:
            margen_text += " (!)"

        table_data.append([
            Paragraph(str(p.get("codigo_barra") or p.get("sku") or "S/N"), style_td),
            Paragraph(str(p.get("nombre", "—")), style_td),
            Paragraph(_fmt_pyg(costo), style_td_num),
            Paragraph(_fmt_pyg(regular), style_td_num),
            Paragraph(f"<b>{_fmt_pyg(promo)}</b>", style_td_num),
            Paragraph(f"-{ahorro_pct}%", style_td_num),
            Paragraph(f"<b>{margen_text}</b>", style_td_num),
        ])

    t_prods = Table(
        table_data,
        colWidths=[26 * mm, 66 * mm, 22 * mm, 24 * mm, 24 * mm, 12 * mm, 12 * mm]
    )
    t_prods.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), PRIMARY_COLOR),
        ("ALIGN", (0, 0), (-1, 0), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("GRID", (0, 0), (-1, -1), 0.5, HexColor("#CBD5E1")),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [WHITE, HexColor("#F8FAFC")]),
        ("TOPPADDING", (0, 0), (-1, -1), 2.5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2.5),
        ("LEFTPADDING", (0, 0), (-1, -1), 3),
        ("RIGHTPADDING", (0, 0), (-1, -1), 3),
    ]))
    elements.append(t_prods)
    elements.append(Spacer(1, 3.5 * mm))

    # ── 4. ACUERDO DE TRADE MARKETING Y LIQUIDACIÓN ───────────────────────────
    if promotion.get("financiamiento") in ["proveedor_sell_out", "co_financiado", "corto_vencimiento"] or promotion.get("monto_total_nc_comprometido"):
        elements.append(Paragraph("4. ACUERDO DE COMPROMISO CON EL PROVEEDOR (SCAN-BACK)", style_section))
        elements.append(Spacer(1, 1.5 * mm))

        p_prov = promotion.get("porcentaje_aporte_proveedor", 0)
        p_tienda = promotion.get("porcentaje_aporte_tienda", 0)
        monto_nc = float(promotion.get("monto_total_nc_comprometido") or promotion.get("nc_monto_total") or 0)
        nc_num = promotion.get("nc_numero_proveedor") or "Pendiente de Emisión"
        nc_timb = promotion.get("nc_timbrado_proveedor") or "18545636"

        acuerdo_texto = (
            f"La presente campaña cuenta con acuerdo comercial de Trade Marketing. "
            f"El descuento al consumidor es absorbido en un <b>{p_prov}%</b> por el proveedor <b>{proveedor_str}</b> "
            f"y un <b>{p_tienda}%</b> por Extra Supermercado. "
            f"Monto de Nota de Crédito comprometida: <b>{_fmt_pyg(monto_nc)}</b> (NC Nº: <b>{nc_num}</b> / Timbrado: <b>{nc_timb}</b>). "
            f"Las unidades vendidas en caja serán liquidadas contra el reporte oficial de ventas (Sell-Out)."
        )

        t_acuerdo = Table([[Paragraph(acuerdo_texto, style_p)]], colWidths=[USABLE_W])
        t_acuerdo.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), HexColor("#EFF6FF")),
            ("BOX", (0, 0), (-1, -1), 0.5, HexColor("#3B82F6")),
            ("TOPPADDING", (0, 0), (-1, -1), 3),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
            ("LEFTPADDING", (0, 0), (-1, -1), 5),
            ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ]))
        elements.append(t_acuerdo)
        elements.append(Spacer(1, 4 * mm))

    # ── 5. FIRMAS DE CONFORMIDAD Y AUDITORÍA ──────────────────────────────────
    elements.append(Spacer(1, 5 * mm))
    firmas_data = [
        [
            Paragraph("________________________________________<br/><b>Encargado de Salón / Cajas</b><br/>Recepción de Directivas y Exhibición", ParagraphStyle("F1", fontName=FONT_REGULAR, fontSize=7, leading=9, alignment=1)),
            Paragraph("________________________________________<br/><b>Gerencia Comercial / Compras</b><br/>Autorización de Política de Precio", ParagraphStyle("F2", fontName=FONT_REGULAR, fontSize=7, leading=9, alignment=1)),
            Paragraph("________________________________________<br/><b>Proveedor / Representante</b><br/>Conformidad Trade Marketing", ParagraphStyle("F3", fontName=FONT_REGULAR, fontSize=7, leading=9, alignment=1)),
        ]
    ]
    t_firmas = Table(firmas_data, colWidths=[USABLE_W / 3, USABLE_W / 3, USABLE_W / 3])
    t_firmas.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
    ]))
    elements.append(KeepTogether([t_firmas]))

    _build(doc, elements)
    return buffer.getvalue()


# ─────────────────────────────────────────────────────────────────────────────
# PDF PREMIUM A4 HORIZONTAL — LISTADO COMPLETO DE PRODUCTOS EN PROMOCIÓN
# ─────────────────────────────────────────────────────────────────────────────

def _color_for_margin(pct: float) -> HexColor:
    """Retorna color de fondo según rentabilidad del margen."""
    if pct < 0:
        return HexColor("#FEE2E2")   # rojo suave — bajo costo
    if pct < 10:
        return HexColor("#FEF3C7")   # amarillo — margen bajo
    if pct < 25:
        return HexColor("#ECFDF5")   # verde pálido — aceptable
    return HexColor("#D1FAE5")       # verde — buen margen


def _badge_text(pct: float, es_bajo_costo: bool) -> str:
    if es_bajo_costo:
        return "⚠ BAJO COSTO"
    if pct < 0:
        return "PÉRDIDA"
    if pct < 10:
        return f"{pct:.1f}% ↓"
    return f"{pct:.1f}%"


def generate_promotion_products_pdf(
    company: dict,
    promotion: dict,
    products_details: List[dict],
    generated_by: str = ""
) -> bytes:
    """
    Genera un PDF premium A4 horizontal con el listado completo de
    productos participantes en la promoción, incluyendo precios,
    costos, márgenes, ahorro y KPIs de resumen ejecutivo.
    Diseñado para impresión y distribución interna en Extra Supermercado.
    """
    buffer = io.BytesIO()
    titulo_doc = f"Lista Productos Promo - {promotion.get('nombre', 'Campaña')}"
    doc, styles = _base_landscape_doc(buffer, titulo_doc, company, generated_by)

    # Ancho útil landscape A4 con márgenes de 12mm: 273mm
    W = 273 * mm

    # ── Estilos locales ──────────────────────────────────────────────────────
    s_section = ParagraphStyle(
        "LS_Section", fontName=FONT_BOLD, fontSize=9.5, leading=12,
        textColor=PRIMARY_COLOR, spaceBefore=6, spaceAfter=3
    )
    s_label = ParagraphStyle(
        "LS_Label", fontName=FONT_BOLD, fontSize=7.5, leading=9.5,
        textColor=GRAY_MEDIUM
    )
    s_val = ParagraphStyle(
        "LS_Val", fontName=FONT_BOLD, fontSize=8.5, leading=10.5,
        textColor=HexColor("#0F172A")
    )
    s_val_accent = ParagraphStyle(
        "LS_ValAccent", fontName=FONT_BOLD, fontSize=9, leading=11,
        textColor=PRIMARY_COLOR
    )
    s_th = ParagraphStyle(
        "LS_TH", fontName=FONT_BOLD, fontSize=7, leading=9,
        textColor=WHITE, alignment=TA_CENTER
    )
    s_th_r = ParagraphStyle(
        "LS_THR", fontName=FONT_BOLD, fontSize=7, leading=9,
        textColor=WHITE, alignment=TA_RIGHT
    )
    s_td = ParagraphStyle(
        "LS_TD", fontName=FONT_REGULAR, fontSize=7, leading=9,
        textColor=HexColor("#1E293B")
    )
    s_td_bold = ParagraphStyle(
        "LS_TDBold", fontName=FONT_BOLD, fontSize=7, leading=9,
        textColor=HexColor("#0F172A")
    )
    s_td_r = ParagraphStyle(
        "LS_TDR", fontName=FONT_REGULAR, fontSize=7, leading=9,
        textColor=HexColor("#1E293B"), alignment=TA_RIGHT
    )
    s_td_r_bold = ParagraphStyle(
        "LS_TDRBold", fontName=FONT_BOLD, fontSize=7.5, leading=9.5,
        textColor=PRIMARY_COLOR, alignment=TA_RIGHT
    )
    s_td_ctr = ParagraphStyle(
        "LS_TDCenter", fontName=FONT_REGULAR, fontSize=7, leading=9,
        textColor=HexColor("#1E293B"), alignment=TA_CENTER
    )
    s_td_warn = ParagraphStyle(
        "LS_TDWarn", fontName=FONT_BOLD, fontSize=6.5, leading=8.5,
        textColor=HexColor("#B91C1C"), alignment=TA_CENTER
    )
    s_td_ok = ParagraphStyle(
        "LS_TDOK", fontName=FONT_BOLD, fontSize=6.5, leading=8.5,
        textColor=HexColor("#15803D"), alignment=TA_CENTER
    )
    s_note = ParagraphStyle(
        "LS_Note", fontName=FONT_REGULAR, fontSize=6.5, leading=8.5,
        textColor=GRAY_MEDIUM
    )

    # ── Fechas ────────────────────────────────────────────────────────────────
    def _fmt_date(v):
        if isinstance(v, (date, datetime)):
            return v.strftime("%d/%m/%Y")
        return str(v or "—")

    valido_desde = _fmt_date(promotion.get("valido_desde"))
    valido_hasta = _fmt_date(promotion.get("valido_hasta"))
    tipo_str = str(promotion.get("tipo", "—")).replace("_", " ").upper()
    estado_str = str(promotion.get("estado", "—")).replace("_", " ").upper()
    proveedor_str = promotion.get("supplier_nombre") or "Extra Supermercado (Tienda Propia)"
    valor_promo = promotion.get("valor", 0) or 0

    # ── Encabezado corporativo ───────────────────────────────────────────────
    subtitle = (
        f"LISTA DE PRODUCTOS EN PROMOCIÓN  ·  "
        f"Campaña: {promotion.get('nombre', '—').upper()}  ·  "
        f"Vigencia: {valido_desde} al {valido_hasta}"
    )
    elements = _company_landscape_header(
        company, styles,
        "FICHA DE PRODUCTOS PROMOCIONALES",
        subtitle,
        generated_by
    )
    elements.append(Spacer(1, 3 * mm))

    # ── 1. FICHA RESUMEN DE LA CAMPAÑA ───────────────────────────────────────
    elements.append(Paragraph("PARÁMETROS DE LA CAMPAÑA", s_section))

    ficha_data = [
        [
            Paragraph("Nombre:", s_label),
            Paragraph(f"<b>{promotion.get('nombre', '—')}</b>", s_val),
            Paragraph("Mecánica:", s_label),
            Paragraph(f"<b>{tipo_str}</b>", s_val),
            Paragraph("Descuento / Valor:", s_label),
            Paragraph(f"<b>{valor_promo}{'%' if 'pct' in str(promotion.get('tipo','')).lower() or 'desc' in str(promotion.get('tipo','')).lower() else ' Gs.'}</b>", s_val_accent),
        ],
        [
            Paragraph("Vigencia:", s_label),
            Paragraph(f"<b>{valido_desde}</b> al <b>{valido_hasta}</b>", s_val),
            Paragraph("Estado:", s_label),
            Paragraph(f"<b>{estado_str}</b>", s_val),
            Paragraph("Proveedor / Marca:", s_label),
            Paragraph(f"<b>{proveedor_str}</b>", s_val),
        ],
    ]

    col_w = [22 * mm, 55 * mm, 22 * mm, 36 * mm, 30 * mm, 108 * mm]
    t_ficha = Table(ficha_data, colWidths=col_w)
    t_ficha.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), HexColor("#F8FAFC")),
        ("BOX",        (0, 0), (-1, -1), 0.5, HexColor("#CBD5E1")),
        ("INNERGRID",  (0, 0), (-1, -1), 0.3, HexColor("#E2E8F0")),
        ("TOPPADDING",    (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("LEFTPADDING",   (0, 0), (-1, -1), 4),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 4),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]))
    elements.append(t_ficha)
    elements.append(Spacer(1, 4 * mm))

    # ── 2. TABLA DE PRODUCTOS ────────────────────────────────────────────────
    n_prods = len(products_details)
    elements.append(Paragraph(
        f"LISTADO DE PRODUCTOS PARTICIPANTES  ({n_prods} ítem{'s' if n_prods != 1 else ''})",
        s_section
    ))
    elements.append(Spacer(1, 1 * mm))

    # Cabecera
    header_row = [
        Paragraph("#", s_th),
        Paragraph("Código de Barras", s_th),
        Paragraph("Descripción del Producto", s_th),
        Paragraph("UM", s_th),
        Paragraph("Costo Unit.\n(Gs.)", s_th_r),
        Paragraph("PVP Regular\n(Gs.)", s_th_r),
        Paragraph("PVP Promo\n(Gs.)", s_th_r),
        Paragraph("Ahorro\nUnit. (Gs.)", s_th_r),
        Paragraph("Dscto.\n(%)", s_th_r),
        Paragraph("Margen\nBruto (%)", s_th_r),
        Paragraph("Estado\nMárgenes", s_th),
    ]

    # Anchos de columna: total debe ser 273mm
    col_widths = [
        7 * mm,    # #
        30 * mm,   # código barras
        70 * mm,   # descripción
        9 * mm,    # UM
        26 * mm,   # costo
        26 * mm,   # pvp regular
        26 * mm,   # pvp promo
        26 * mm,   # ahorro unit
        17 * mm,   # dscto %
        17 * mm,   # margen %
        19 * mm,   # estado
    ]

    table_data = [header_row]

    # Acumuladores para KPIs de resumen
    total_costo = 0.0
    total_regular = 0.0
    total_promo = 0.0
    total_ahorro = 0.0
    prods_bajo_costo = 0
    prods_buen_margen = 0

    row_colors = []  # para aplicar ROWBACKGROUNDS dinámicos por margen

    for i, p in enumerate(products_details, start=1):
        costo   = float(p.get("costo_unitario") or p.get("costo_promedio", 0) or 0)
        regular = float(p.get("precio_regular", 0) or 0)
        promo   = float(p.get("precio_promocional", 0) or 0)
        ahorro_u = max(0.0, regular - promo)
        dscto_pct = round((ahorro_u / regular * 100), 1) if regular > 0 else 0.0
        margen_g  = promo - costo
        margen_pct = round((margen_g / promo * 100), 1) if promo > 0 else 0.0
        es_bajo_costo = p.get("es_bajo_costo", False) or (costo > 0 and promo < costo)

        total_costo   += costo
        total_regular += regular
        total_promo   += promo
        total_ahorro  += ahorro_u
        if es_bajo_costo:
            prods_bajo_costo += 1
        if margen_pct >= 20:
            prods_buen_margen += 1

        badge = _badge_text(margen_pct, es_bajo_costo)
        s_badge = s_td_warn if (es_bajo_costo or margen_pct < 10) else s_td_ok
        row_colors.append(_color_for_margin(margen_pct if not es_bajo_costo else -1))

        table_data.append([
            Paragraph(str(i), s_td_ctr),
            Paragraph(str(p.get("codigo_barra") or p.get("sku") or "S/N"), s_td),
            Paragraph(str(p.get("nombre", "—")), s_td_bold),
            Paragraph(str(p.get("unidad_medida") or "UN"), s_td_ctr),
            Paragraph(_fmt_pyg(costo).replace(" Gs.", ""), s_td_r),
            Paragraph(_fmt_pyg(regular).replace(" Gs.", ""), s_td_r),
            Paragraph(f"<b>{_fmt_pyg(promo).replace(' Gs.', '')}</b>", s_td_r_bold),
            Paragraph(_fmt_pyg(ahorro_u).replace(" Gs.", ""), s_td_r),
            Paragraph(f"{dscto_pct:.1f}%", s_td_r),
            Paragraph(f"<b>{margen_pct:.1f}%</b>", s_td_r),
            Paragraph(badge, s_badge),
        ])

    # Fila TOTALES
    avg_margen = round(
        sum(
            (float(p.get("precio_promocional", 0) or 0) - float(p.get("costo_unitario") or p.get("costo_promedio", 0) or 0)) /
            float(p.get("precio_promocional", 0) or 1) * 100
            for p in products_details
            if float(p.get("precio_promocional", 0) or 0) > 0
        ) / max(n_prods, 1), 1
    )
    avg_dscto = round((total_ahorro / total_regular * 100), 1) if total_regular > 0 else 0.0

    s_total = ParagraphStyle("LSTotal", fontName=FONT_BOLD, fontSize=7, leading=9,
                             textColor=HexColor("#0F172A"), alignment=TA_RIGHT)
    s_total_lbl = ParagraphStyle("LSTotalLbl", fontName=FONT_BOLD, fontSize=7, leading=9,
                                 textColor=HexColor("#0F172A"), alignment=TA_CENTER)

    table_data.append([
        Paragraph("TOTAL", s_total_lbl),
        Paragraph("", s_td),
        Paragraph(f"{n_prods} productos", s_td_bold),
        Paragraph("", s_td),
        Paragraph(_fmt_pyg(total_costo).replace(" Gs.", ""), s_total),
        Paragraph(_fmt_pyg(total_regular).replace(" Gs.", ""), s_total),
        Paragraph(_fmt_pyg(total_promo).replace(" Gs.", ""), s_total),
        Paragraph(_fmt_pyg(total_ahorro).replace(" Gs.", ""), s_total),
        Paragraph(f"{avg_dscto:.1f}%", s_total),
        Paragraph(f"{avg_margen:.1f}%", s_total),
        Paragraph("", s_td),
    ])

    t_prods = Table(table_data, colWidths=col_widths, repeatRows=1)

    # Estilos base
    prod_style = [
        ("BACKGROUND",    (0, 0), (-1, 0), PRIMARY_COLOR),
        ("TEXTCOLOR",     (0, 0), (-1, 0), WHITE),
        ("ALIGN",         (0, 0), (-1, 0), "CENTER"),
        ("VALIGN",        (0, 0), (-1, -1), "MIDDLE"),
        ("GRID",          (0, 0), (-1, -1), 0.4, HexColor("#CBD5E1")),
        ("TOPPADDING",    (0, 0), (-1, -1), 2.5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2.5),
        ("LEFTPADDING",   (0, 0), (-1, -1), 2.5),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 2.5),
        # Fila totales
        ("BACKGROUND",    (0, -1), (-1, -1), HexColor("#E2E8F0")),
        ("LINEABOVE",     (0, -1), (-1, -1), 1.0, HexColor("#64748B")),
        ("SPAN",          (0, -1), (1, -1)),
    ]

    # Colores de margen por fila (dinámicos)
    for idx, color in enumerate(row_colors):
        row_idx = idx + 1  # +1 por la cabecera
        prod_style.append(("BACKGROUND", (10, row_idx), (10, row_idx), color))
        # Filas alternas suaves para cuerpo
        if idx % 2 == 0:
            prod_style.append(("BACKGROUND", (0, row_idx), (9, row_idx), WHITE))
        else:
            prod_style.append(("BACKGROUND", (0, row_idx), (9, row_idx), HexColor("#F8FAFC")))

    t_prods.setStyle(TableStyle(prod_style))
    elements.append(t_prods)
    elements.append(Spacer(1, 4 * mm))

    # ── 3. PANEL DE KPIs DE RESUMEN EJECUTIVO ────────────────────────────────
    elements.append(HRFlowable(width=W, thickness=0.5, color=HexColor("#CBD5E1"), spaceAfter=3))
    elements.append(Paragraph("RESUMEN EJECUTIVO DE LA CAMPAÑA", s_section))
    elements.append(Spacer(1, 1 * mm))

    s_kpi_val = ParagraphStyle(
        "KPIVal", fontName=FONT_BOLD, fontSize=14, leading=16,
        textColor=PRIMARY_COLOR, alignment=TA_CENTER
    )
    s_kpi_lbl = ParagraphStyle(
        "KPILbl", fontName=FONT_REGULAR, fontSize=7, leading=9,
        textColor=GRAY_MEDIUM, alignment=TA_CENTER
    )

    kpi_data = [[
        Paragraph(f"<b>{n_prods}</b>", s_kpi_val),
        Paragraph(f"<b>{avg_dscto:.1f}%</b>", s_kpi_val),
        Paragraph(f"<b>{avg_margen:.1f}%</b>", s_kpi_val),
        Paragraph(f"<b>{_fmt_pyg(total_ahorro)}</b>", s_kpi_val),
        Paragraph(f"<b>{prods_bajo_costo}</b>", s_kpi_val),
        Paragraph(f"<b>{prods_buen_margen}</b>", s_kpi_val),
    ], [
        Paragraph("Productos Participantes", s_kpi_lbl),
        Paragraph("Descuento Promedio", s_kpi_lbl),
        Paragraph("Margen Bruto Prom.", s_kpi_lbl),
        Paragraph("Ahorro Total Unitario", s_kpi_lbl),
        Paragraph("⚠ Productos Bajo Costo", s_kpi_lbl),
        Paragraph("✓ Margen ≥ 20%", s_kpi_lbl),
    ]]

    kpi_col_w = [W / 6] * 6
    t_kpi = Table(kpi_data, colWidths=kpi_col_w)
    t_kpi.setStyle(TableStyle([
        ("BACKGROUND",    (0, 0), (-1, -1), HexColor("#F8FAFC")),
        ("BOX",           (0, 0), (-1, -1), 0.5, HexColor("#CBD5E1")),
        ("INNERGRID",     (0, 0), (-1, -1), 0.3, HexColor("#E2E8F0")),
        ("TOPPADDING",    (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("VALIGN",        (0, 0), (-1, -1), "MIDDLE"),
        # Resaltar advertencia si hay bajo costo
        ("TEXTCOLOR",     (4, 0), (4, 0),
         HexColor("#B91C1C") if prods_bajo_costo > 0 else HexColor("#15803D")),
        ("BACKGROUND",    (4, 0), (4, -1),
         HexColor("#FEE2E2") if prods_bajo_costo > 0 else HexColor("#D1FAE5")),
        # Resaltar buen margen
        ("BACKGROUND",    (5, 0), (5, -1), HexColor("#D1FAE5")),
    ]))
    elements.append(t_kpi)
    elements.append(Spacer(1, 3 * mm))

    # ── Nota al pie ──────────────────────────────────────────────────────────
    note_text = (
        f"⚠ Los precios expresados en Guaraníes (PYG) son valores unitarios calculados al momento de la emisión. "
        f"Los márgenes se calculan sobre el costo promedio ponderado de inventario. "
        f"Productos marcados como «BAJO COSTO» requieren revisión antes de activar la promoción en caja. "
        f"Documento generado por Intelimarket ERP · Extra Supermercado Mayorista · "
        f"RUC: {company.get('ruc', '80150377-9')} · "
        f"{datetime.now(PY_TZ).strftime('%d/%m/%Y %H:%M')} (PYT)"
    )
    elements.append(Paragraph(note_text, s_note))

    _build(doc, elements)
    return buffer.getvalue()
