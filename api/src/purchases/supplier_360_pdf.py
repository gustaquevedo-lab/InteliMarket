"""Generador de Informe Gerencial 360° de Proveedor en PDF.
Utiliza ReportLab con diseño editorial ejecutivo (paleta corporativa InteliMarket,
NumberedCanvas, tipografías y tablas optimizadas).
Permite exportar tanto el Informe Integral Multidimensional como informes
específicos de cada pestaña (deudas, nc_reclamos, cheques, pagos, compras, stock, informe).
"""
from __future__ import annotations

import io
import os
from datetime import date, datetime
from decimal import Decimal
from typing import Dict, Any, Optional, List

from reportlab.lib.units import mm
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_RIGHT, TA_CENTER, TA_LEFT
from reportlab.platypus import Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether
from reportlab.lib.colors import HexColor

from api.src.integrated_finance.pdf_reports import (
    _base_doc, _company_header, _fmt_gs,
    PRIMARY_COLOR, ACCENT_BLUE, GRAY_LIGHT, GRAY_MEDIUM, GRAY_DARK, WHITE, RED, GREEN,
    FONT_REGULAR, FONT_BOLD,
)

CELL_STYLE = ParagraphStyle("Sup360Cell", fontName=FONT_REGULAR, fontSize=7.0, leading=8.3, textColor=GRAY_DARK)
CELL_STYLE_BOLD = ParagraphStyle("Sup360CellBold", fontName=FONT_BOLD, fontSize=7.0, leading=8.3, textColor=GRAY_DARK)
NUM_STYLE = ParagraphStyle("Sup360Num", fontName=FONT_REGULAR, fontSize=7.0, leading=8.3, textColor=GRAY_DARK, alignment=TA_RIGHT)
NUM_STYLE_BOLD = ParagraphStyle("Sup360NumBold", fontName=FONT_BOLD, fontSize=7.0, leading=8.3, textColor=GRAY_DARK, alignment=TA_RIGHT)

TITLE_SEC = ParagraphStyle(
    "Sup360SecTitle",
    fontName=FONT_BOLD,
    fontSize=9.5,
    leading=12,
    textColor=PRIMARY_COLOR,
    spaceAfter=4,
)

SUBTITLE_SEC = ParagraphStyle(
    "Sup360SecSub",
    fontName=FONT_REGULAR,
    fontSize=7.5,
    leading=9.5,
    textColor=GRAY_MEDIUM,
    spaceAfter=6,
)

BODY_TEXT = ParagraphStyle(
    "Sup360Body",
    fontName=FONT_REGULAR,
    fontSize=7.6,
    leading=10.2,
    textColor=GRAY_DARK,
)

BODY_BOLD = ParagraphStyle(
    "Sup360BodyBold",
    fontName=FONT_BOLD,
    fontSize=7.6,
    leading=10.2,
    textColor=PRIMARY_COLOR,
)

KPI_VALUE = ParagraphStyle("SupKpiVal", fontName=FONT_BOLD, fontSize=10.5, textColor=PRIMARY_COLOR, leading=12.5)
KPI_LABEL = ParagraphStyle("SupKpiLbl", fontName=FONT_BOLD, fontSize=6.2, textColor=GRAY_MEDIUM, leading=7.8, textTransform="uppercase")


def _c(text, bold: bool = False, color=None) -> Paragraph:
    style = CELL_STYLE_BOLD if bold else CELL_STYLE
    if color:
        style = ParagraphStyle("CColor", parent=style, textColor=color)
    return Paragraph(str(text) if text is not None else "—", style)


def _n(text, bold: bool = False, color=None) -> Paragraph:
    style = NUM_STYLE_BOLD if bold else NUM_STYLE
    if color:
        style = ParagraphStyle("NColor", parent=style, textColor=color)
    return Paragraph(str(text) if text is not None else "—", style)


def _kpi_box(label: str, val_str: str, color_val=None, width_mm: float = 44) -> Table:
    v_style = KPI_VALUE
    if color_val:
        v_style = ParagraphStyle("VKpi", parent=KPI_VALUE, textColor=color_val)
    t = Table([
        [Paragraph(label, KPI_LABEL)],
        [Paragraph(val_str, v_style)]
    ], colWidths=[width_mm * mm])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), GRAY_LIGHT),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ("BOX", (0, 0), (-1, -1), 0.5, HexColor("#E2E8F0")),
    ]))
    return t


def _th_style(cols_right: list[int] = None) -> TableStyle:
    cols_right = cols_right or []
    ts = [
        ("BACKGROUND", (0, 0), (-1, 0), PRIMARY_COLOR),
        ("TEXTCOLOR", (0, 0), (-1, 0), WHITE),
        ("FONTNAME", (0, 0), (-1, 0), FONT_BOLD),
        ("FONTSIZE", (0, 0), (-1, 0), 6.6),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [WHITE, GRAY_LIGHT]),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
        ("LINEBELOW", (0, 0), (-1, -1), 0.3, HexColor("#CBD5E1")),
    ]
    for c_idx in cols_right:
        ts.append(("ALIGN", (c_idx, 0), (c_idx, -1), "RIGHT"))
    return TableStyle(ts)


def _render_ficha_proveedor(supplier: dict) -> Table:
    rz = supplier.get("razon_social", "PROVEEDOR")
    ruc = supplier.get("ruc", "S/RUC")
    ficha_data = [
        [
            Paragraph(f"<b>Razón Social:</b> {rz}", BODY_TEXT),
            Paragraph(f"<b>RUC / Identif.:</b> {ruc}", BODY_TEXT),
            Paragraph(f"<b>Condición IVA:</b> {supplier.get('condicion_iva', '10%')}", BODY_TEXT),
        ],
        [
            Paragraph(f"<b>Contacto:</b> {supplier.get('contacto_nombre') or '—'} ({supplier.get('contacto_telefono') or supplier.get('telefono') or '—'})", BODY_TEXT),
            Paragraph(f"<b>Email:</b> {supplier.get('contacto_email') or supplier.get('email') or '—'}", BODY_TEXT),
            Paragraph(f"<b>Plazo Pactado:</b> {supplier.get('plazo_pago_dias', 0)} días crédito", BODY_TEXT),
        ],
        [
            Paragraph(f"<b>Banco / Cuenta:</b> {supplier.get('banco') or '—'} · {supplier.get('cuenta_bancaria') or '—'}", BODY_TEXT),
            Paragraph(f"<b>Dirección:</b> {supplier.get('direccion') or '—'} - {supplier.get('ciudad') or '—'}", BODY_TEXT),
            Paragraph(f"<b>Calificación:</b> {'★' * int(supplier.get('rating') or 5)} ({supplier.get('rating', 5.0)}/5.0)", BODY_TEXT),
        ],
    ]
    t_ficha = Table(ficha_data, colWidths=[70 * mm, 60 * mm, 54 * mm])
    t_ficha.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), HexColor("#F8FAFC")),
        ("BOX", (0, 0), (-1, -1), 0.75, HexColor("#CBD5E1")),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("LINEBELOW", (0, 0), (-1, -2), 0.3, HexColor("#E2E8F0")),
    ]))
    return t_ficha


def _render_firmas_bloque() -> Table:
    sign_data = [
        [
            Paragraph("_______________________________<br/><b>GERENCIA FINANCIERA & TESORERÍA</b><br/>Auditoría de Pasivos y Cheques", ParagraphStyle("S1", parent=BODY_TEXT, alignment=TA_CENTER)),
            Paragraph("_______________________________<br/><b>DIRECCIÓN DE COMPRAS & ABASTECIMIENTO</b><br/>Acuerdos Comerciales y Margen", ParagraphStyle("S2", parent=BODY_TEXT, alignment=TA_CENTER)),
            Paragraph("_______________________________<br/><b>AUDITORÍA INTERNA / CFO</b><br/>Dictamen de Control y Cumplimiento", ParagraphStyle("S3", parent=BODY_TEXT, alignment=TA_CENTER)),
        ]
    ]
    t_sign = Table(sign_data, colWidths=[61 * mm, 61 * mm, 61 * mm])
    t_sign.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
    ]))
    return t_sign


def generate_supplier_360_pdf(company: dict, data: dict, generated_by: str = "", tab: Optional[str] = None) -> bytes:
    """Genera el PDF editorial 360° del proveedor, soportando exportación total o por pestaña específica."""
    buffer = io.BytesIO()

    supplier = data.get("supplier", {})
    kpis = data.get("kpis", {})
    aging = data.get("aging_buckets", {})
    informe = data.get("informe_gerencial", {})
    facturas = data.get("facturas", [])
    cheques = data.get("cheques", [])
    pagos = data.get("pagos_historial", [])
    ocs = data.get("ordenes_compra", [])
    recepciones = data.get("recepciones", [])
    reclamos = data.get("reclamos_nc", [])
    productos = data.get("productos", [])
    monedero = data.get("monedero_nc", {})

    rz = supplier.get("razon_social", "PROVEEDOR")
    ruc = supplier.get("ruc", "S/RUC")

    tab_clean = (tab or "").lower().strip()

    # Títulos según tab
    tab_titles = {
        "deudas": ("AUDITORÍA DE CUENTAS POR PAGAR (AP) Y FASES DE PAGO", "Facturas comerciales, notas de crédito vinculadas, saldo neto y vencimientos"),
        "nc_reclamos": ("MONEDERO DE NC, RECLAMOS & DEVOLUCIONES", "Crédito a favor, trazabilidad por origen (Depósito/Promos) y etapas de regularización"),
        "cheques": ("AUDITORÍA DE CHEQUES DIFERIDOS EMITIDOS", "Valores en tránsito emitidos pendientes de compensación bancaria"),
        "pagos": ("HISTORIAL DE PAGOS & DESEMBOLSOS", "Cancelaciones de facturas, órdenes de pago y transferencias SIPAP"),
        "compras": ("HISTORIAL DE COMPRAS & RECEPCIONES", "Órdenes de compra emitidas y remitos de mercadería en muelle/depósito"),
        "stock": ("CATÁLOGO DE ARTÍCULOS, EXISTENCIAS & RENTABILIDAD", "Valorización de inventario inmovilizado, margen bruto y rotación sell-out"),
        "informe": ("DICTAMEN GERENCIAL EXTENSO & DIAGNÓSTICO", "Evaluación cuantitativa y cualitativa de pasivos, rentabilidad y logística"),
    }

    main_title, sub_title = tab_titles.get(
        tab_clean,
        ("VISIÓN 360° — INFORME GERENCIAL INTEGRAL", f"Auditoría Integral Comercial, Financiera y Operativa: {rz} (RUC: {ruc})")
    )

    doc, styles = _base_doc(buffer, f"360° - {rz}", company, generated_by)
    elements = _company_header(company, styles, main_title, sub_title, generated_by)
    elements.append(_render_ficha_proveedor(supplier))
    elements.append(Spacer(1, 8))

    # ═════════════════════════════════════════════════════════════════════════
    # CASO 1: PESTAÑA ESPECÍFICA "nc_reclamos" (MONEDERO & DEVOLUCIONES)
    # ═════════════════════════════════════════════════════════════════════════
    if tab_clean == "nc_reclamos":
        # Hero KPIs del Monedero
        kpi_m1 = Table([[
            _kpi_box("Saldo Disponible Monedero", _fmt_gs(monedero.get("saldo_disponible", 0)), GREEN, 46),
            _kpi_box("Total NCs Emitidas", _fmt_gs(monedero.get("total_emitido", 0)), HexColor("#0284C7"), 46),
            _kpi_box("Etapa 1: Reclam. Pendientes", _fmt_gs(monedero.get("obligaciones_pendientes_emision", 0)), HexColor("#D97706"), 46),
            _kpi_box("Crédito Potencial Total", _fmt_gs(monedero.get("credito_total_potencial", 0)), PRIMARY_COLOR, 46),
        ]], colWidths=[46 * mm, 46 * mm, 46 * mm, 46 * mm])
        elements.append(kpi_m1)
        elements.append(Spacer(1, 4))

        kpi_m2 = Table([[
            _kpi_box("Deuda Facturada Bruta", _fmt_gs(kpis.get("deuda_total_facturas", 0)), RED, 46),
            _kpi_box("Compensado a Facturas", _fmt_gs(monedero.get("total_aplicado", 0)), HexColor("#059669"), 46),
            _kpi_box("Deuda Neta Real Supermercado", _fmt_gs(kpis.get("deuda_neta_efectiva", 0)), HexColor("#7C3AED"), 46),
            _kpi_box("NCs Vigentes con Saldo", f"{monedero.get('cantidad_con_saldo', 0)} de {monedero.get('cantidad_ncs', 0)} NCs", PRIMARY_COLOR, 46),
        ]], colWidths=[46 * mm, 46 * mm, 46 * mm, 46 * mm])
        elements.append(kpi_m2)
        elements.append(Spacer(1, 10))

        # Tabla 1: Monedero de NCs Vigentes
        elements.append(Paragraph("1. Monedero de Notas de Crédito Disponibles (Etapa 2: NC Emitidas)", TITLE_SEC))
        nc_items = monedero.get("items", [])
        nc_table_data = [["N° NC", "Timbrado", "Fecha", "Origen / Causa", "Factura Origen", "Monto Orig.", "Aplicado", "Saldo Disp.", "Estado"]]
        for item in (nc_items[:25] if nc_items else []):
            sd = item.get("saldo_disponible", 0)
            col_sd = GREEN if sd > 0 else GRAY_DARK
            nc_table_data.append([
                _c(item.get("numero"), bold=True),
                _c(item.get("timbrado") or "—"),
                _c(item.get("fecha")),
                _c(item.get("origen_label", "")[:28]),
                _c(item.get("numero_factura_origen") or "S/Fact"),
                _n(_fmt_gs(item.get("monto_original"))),
                _n(_fmt_gs(item.get("monto_aplicado"))),
                _n(_fmt_gs(sd), bold=True, color=col_sd),
                _c("CON SALDO" if sd > 0 else "CONSUMIDA", bold=True, color=col_sd),
            ])
        if not nc_items:
            nc_table_data.append([_c("Sin notas de crédito registradas en monedero"), _c(""), _c(""), _c(""), _c(""), _n("0"), _n("0"), _n("0"), _c("—")])
        t_mn = Table(nc_table_data, colWidths=[24 * mm, 18 * mm, 16 * mm, 36 * mm, 22 * mm, 22 * mm, 22 * mm, 24 * mm, 18 * mm])
        t_mn.setStyle(_th_style(cols_right=[5, 6, 7]))
        elements.append(t_mn)
        elements.append(Spacer(1, 10))

        # Tabla 2: Etapa 1 - Requerimientos pendientes de emisión
        elements.append(Paragraph("2. Etapa 1: Requerimientos y Obligaciones Pendientes de Emisión por Proveedor", TITLE_SEC))
        reclamos_enriq = monedero.get("reclamos", [])
        rec_table_data = [["N° Reclamo", "Fecha", "Origen / Motivo", "Factura Afectada", "Monto Reclamado", "NC Fiscal Asoc.", "Estado"]]
        for r in (reclamos_enriq[:20] if reclamos_enriq else []):
            is_pend = r.get("etapa_codigo") == "1_requerimiento"
            rec_table_data.append([
                _c(r.get("numero_solicitud"), bold=True),
                _c(r.get("created_at")),
                _c(r.get("origen_label", "")[:30]),
                _c(r.get("invoice_numero") or "Factura S/N"),
                _n(_fmt_gs(r.get("monto_reclamado")), bold=True, color=RED if is_pend else GREEN),
                _c(r.get("nc_recibida_numero") or "Pendiente Emisión", color=GREEN if r.get("nc_recibida_numero") else HexColor("#D97706")),
                _c("OBLIGACIÓN PENDIENTE" if is_pend else "NC EMITIDA", bold=True, color=HexColor("#D97706") if is_pend else GREEN),
            ])
        if not reclamos_enriq:
            rec_table_data.append([_c("Sin reclamos u obligaciones pendientes"), _c(""), _c(""), _c(""), _n("0"), _c("—"), _c("AL DÍA", color=GREEN)])
        t_rc = Table(rec_table_data, colWidths=[26 * mm, 18 * mm, 38 * mm, 26 * mm, 26 * mm, 26 * mm, 24 * mm])
        t_rc.setStyle(_th_style(cols_right=[4]))
        elements.append(t_rc)
        elements.append(Spacer(1, 10))

        # Tabla 3: Devoluciones físicas en depósito
        devs_fis = monedero.get("devoluciones_fisicas", [])
        if devs_fis:
            elements.append(Paragraph("3. Devoluciones Físicas de Mercadería en Depósito / Muelle", TITLE_SEC))
            dev_table_data = [["N° Devolución", "Fecha", "Tipo", "Valor Estimado Gs.", "NC Asociada", "Etapa Operativa", "Estado"]]
            for d in devs_fis[:15]:
                tiene_nc = d.get("tiene_nc", False)
                dev_table_data.append([
                    _c(d.get("codigo"), bold=True),
                    _c(d.get("fecha")),
                    _c(d.get("tipo", "devolucion").capitalize()),
                    _n(_fmt_gs(d.get("valor_estimado")), bold=True),
                    _c(d.get("nota_credito_numero") or "Pendiente de NC", color=GREEN if tiene_nc else HexColor("#D97706")),
                    _c("Etapa 2: NC Emitida" if tiene_nc else "Etapa 1: Obligación Pendiente", bold=True, color=GREEN if tiene_nc else HexColor("#D97706")),
                    _c(d.get("estado", "completado").upper()),
                ])
            t_dev = Table(dev_table_data, colWidths=[28 * mm, 18 * mm, 22 * mm, 28 * mm, 30 * mm, 36 * mm, 22 * mm])
            t_dev.setStyle(_th_style(cols_right=[3]))
            elements.append(t_dev)
            elements.append(Spacer(1, 10))

        # Tabla 4: Historial de aplicaciones / compensaciones
        apps_hist = monedero.get("aplicaciones_historial", [])
        if apps_hist:
            elements.append(Paragraph("4. Historial de Compensaciones & Aplicaciones a Facturas (Etapa 3)", TITLE_SEC))
            app_table_data = [["Fecha", "N° NC Aplicada", "Monto Compensado", "Concepto / Observaciones"]]
            for a in apps_hist[:15]:
                app_table_data.append([
                    _c(a.get("fecha")),
                    _c(a.get("numero_nc"), bold=True),
                    _n(_fmt_gs(a.get("monto_aplicado")), bold=True, color=GREEN),
                    _c(a.get("observaciones") or a.get("motivo_nc") or "Compensación directa"),
                ])
            t_app = Table(app_table_data, colWidths=[24 * mm, 36 * mm, 34 * mm, 90 * mm])
            t_app.setStyle(_th_style(cols_right=[2]))
            elements.append(t_app)
            elements.append(Spacer(1, 10))

        elements.append(_render_firmas_bloque())

    # ═════════════════════════════════════════════════════════════════════════
    # CASO 2: PESTAÑA ESPECÍFICA "deudas" (AP, AGING, FACTURAS CON NC)
    # ═════════════════════════════════════════════════════════════════════════
    elif tab_clean == "deudas":
        kpi_row = Table([[
            _kpi_box("Deuda Facturada Bruta", _fmt_gs(kpis.get("deuda_total_facturas", 0)), RED, 46),
            _kpi_box("Monedero NC Disponible", _fmt_gs(monedero.get("saldo_disponible", 0)), GREEN, 46),
            _kpi_box("Deuda Neta Real", _fmt_gs(kpis.get("deuda_neta_efectiva", 0)), HexColor("#7C3AED"), 46),
            _kpi_box("Deuda Vencida (+0d)", _fmt_gs(kpis.get("deuda_vencida", 0)), RED if kpis.get("deuda_vencida", 0) > 0 else GREEN, 46),
        ]], colWidths=[46 * mm, 46 * mm, 46 * mm, 46 * mm])
        elements.append(kpi_row)
        elements.append(Spacer(1, 6))

        # Aging Matrix
        elements.append(Paragraph("Matriz de Aging de Pasivos (Vencimiento Cronológico):", BODY_BOLD))
        aging_row = [
            [Paragraph("<b>Vencido</b>", KPI_LABEL), Paragraph("<b>1 a 30 Días</b>", KPI_LABEL), Paragraph("<b>31 a 60 Días</b>", KPI_LABEL), Paragraph("<b>+60 Días</b>", KPI_LABEL), Paragraph("<b>Total Deuda Bruta</b>", KPI_LABEL)],
            [
                Paragraph(_fmt_gs(aging.get("vencido", 0)), ParagraphStyle("AgV", parent=NUM_STYLE_BOLD, textColor=RED)),
                Paragraph(_fmt_gs(aging.get("dias_1_30", 0)), ParagraphStyle("Ag1", parent=NUM_STYLE_BOLD, textColor=HexColor("#D97706"))),
                Paragraph(_fmt_gs(aging.get("dias_31_60", 0)), ParagraphStyle("Ag2", parent=NUM_STYLE_BOLD, textColor=PRIMARY_COLOR)),
                Paragraph(_fmt_gs(aging.get("dias_mas_60", 0)), ParagraphStyle("Ag3", parent=NUM_STYLE_BOLD, textColor=GRAY_MEDIUM)),
                Paragraph(_fmt_gs(kpis.get("deuda_total_facturas", 0)), ParagraphStyle("AgT", parent=NUM_STYLE_BOLD, textColor=PRIMARY_COLOR)),
            ]
        ]
        t_ag = Table(aging_row, colWidths=[36 * mm, 36 * mm, 36 * mm, 36 * mm, 40 * mm])
        t_ag.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), GRAY_LIGHT),
            ("BOX", (0, 0), (-1, -1), 0.75, HexColor("#CBD5E1")),
            ("ALIGN", (0, 0), (-1, -1), "RIGHT"),
            ("TOPPADDING", (0, 0), (-1, -1), 3),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
            ("LEFTPADDING", (0, 0), (-1, -1), 5),
            ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ]))
        elements.append(t_ag)
        elements.append(Spacer(1, 8))

        # Facturas con NC Vinculadas y Fases de Pago
        elements.append(Paragraph("Detalle de Facturas Comerciales, Deducciones de NC y Fases de Pago:", TITLE_SEC))
        fac_table_data = [["N° Factura", "Timbrado", "Emisión", "Vencimiento", "Total Gs.", "NCs Vinculadas", "Saldo Neto", "Fase de Pago"]]
        pend_facs = [f for f in facturas if f.get("saldo_pendiente", 0) > 0]
        for f in (pend_facs[:30] if pend_facs else facturas[:20]):
            es_v = f.get("es_vencida", False)
            v_color = RED if es_v else HexColor("#059669")
            m_nc = f.get("monto_nc_aplicado", 0)
            nc_txt = f"-{_fmt_gs(m_nc)}" if m_nc > 0 else "Retenida NC" if f.get("requiere_nc") else "Sin NC"
            nc_col = GREEN if m_nc > 0 else RED if f.get("requiere_nc") else GRAY_DARK
            fase = f.get("fase_pago_label", f.get("fase_pago", "al_dia")).replace("Fase ", "F")

            fac_table_data.append([
                _c(f.get("numero_factura"), bold=True),
                _c(f.get("timbrado") or "—"),
                _c(f.get("fecha_emision")),
                _c(f.get("fecha_vencimiento"), color=v_color, bold=es_v),
                _n(_fmt_gs(f.get("total"))),
                _c(nc_txt, bold=(m_nc > 0 or f.get("requiere_nc")), color=nc_col),
                _n(_fmt_gs(f.get("saldo_neto_real", f.get("saldo_pendiente"))), bold=True, color=v_color),
                _c(fase[:25], bold=True),
            ])
        t_facs = Table(fac_table_data, colWidths=[26 * mm, 18 * mm, 16 * mm, 16 * mm, 26 * mm, 26 * mm, 26 * mm, 30 * mm])
        t_facs.setStyle(_th_style(cols_right=[4, 6]))
        elements.append(t_facs)
        elements.append(Spacer(1, 10))

        # Cheques diferidos resumen
        if cheques:
            elements.append(Paragraph("Cheques Diferidos Emitidos al Proveedor (Valores en Tránsito):", BODY_BOLD))
            chq_table_data = [["N° Cheque", "Banco", "Emisión", "Cobro Diferido", "Días Rest.", "Monto Gs.", "Estado"]]
            for ch in cheques[:15]:
                d_rest = ch.get("dias_restantes", 0)
                chq_table_data.append([
                    _c(ch.get("numero"), bold=True),
                    _c(ch.get("banco_emisor") or "Banco"),
                    _c(ch.get("fecha_emision")),
                    _c(ch.get("fecha_pago"), bold=True),
                    _c(f"{d_rest} días" if d_rest >= 0 else f"Venc. {-d_rest}d", color=HexColor("#D97706") if d_rest <= 7 else GRAY_DARK),
                    _n(_fmt_gs(ch.get("monto")), bold=True),
                    _c(ch.get("estado", "").upper(), bold=True),
                ])
            t_chq = Table(chq_table_data, colWidths=[24 * mm, 34 * mm, 20 * mm, 28 * mm, 20 * mm, 32 * mm, 26 * mm])
            t_chq.setStyle(_th_style(cols_right=[5]))
            elements.append(t_chq)
            elements.append(Spacer(1, 10))

        elements.append(_render_firmas_bloque())

    # ═════════════════════════════════════════════════════════════════════════
    # CASO 3: PESTAÑA ESPECÍFICA "cheques"
    # ═════════════════════════════════════════════════════════════════════════
    elif tab_clean == "cheques":
        kpi_row = Table([[
            _kpi_box("Cheques Diferidos No Comp.", _fmt_gs(kpis.get("cheques_diferidos_pendientes_monto", 0)), HexColor("#D97706"), 46),
            _kpi_box("Cantidad de Cheques", str(kpis.get("cheques_diferidos_pendientes_count", 0)), PRIMARY_COLOR, 46),
            _kpi_box("Cheques Compensados Hist.", _fmt_gs(kpis.get("cheques_compensados_monto", 0)), GREEN, 46),
            _kpi_box("Exposición Financiera Total", _fmt_gs(kpis.get("exposicion_financiera_total", 0)), RED, 46),
        ]], colWidths=[46 * mm, 46 * mm, 46 * mm, 46 * mm])
        elements.append(kpi_row)
        elements.append(Spacer(1, 10))

        elements.append(Paragraph("Detalle de Cheques Diferidos y Valores Emitidos:", TITLE_SEC))
        chq_table_data = [["N° Cheque", "Banco Emisor", "Beneficiario", "Fecha Emisión", "Fecha Cobro Diferido", "Días Rest.", "Monto Cheque", "Estado"]]
        for ch in cheques:
            d_rest = ch.get("dias_restantes", 0)
            est = ch.get("estado", "pendiente")
            est_col = HexColor("#D97706") if est in ("pendiente", "entregado") else GREEN if est == "compensado" else RED
            chq_table_data.append([
                _c(ch.get("numero"), bold=True),
                _c(ch.get("banco_emisor") or "Banco"),
                _c(ch.get("beneficiario") or rz[:20]),
                _c(ch.get("fecha_emision")),
                _c(ch.get("fecha_pago"), bold=True),
                _c(f"{d_rest} días" if d_rest >= 0 else f"Vencido {-d_rest}d", color=HexColor("#D97706") if d_rest <= 7 else GRAY_DARK),
                _n(_fmt_gs(ch.get("monto")), bold=True),
                _c(est.upper(), bold=True, color=est_col),
            ])
        if not cheques:
            chq_table_data.append([_c("Sin cheques diferidos registrados"), _c(""), _c(""), _c(""), _c(""), _c(""), _n("0"), _c("—")])
        t_chq = Table(chq_table_data, colWidths=[20 * mm, 28 * mm, 30 * mm, 18 * mm, 24 * mm, 18 * mm, 26 * mm, 20 * mm])
        t_chq.setStyle(_th_style(cols_right=[6]))
        elements.append(t_chq)
        elements.append(Spacer(1, 14))
        elements.append(_render_firmas_bloque())

    # ═════════════════════════════════════════════════════════════════════════
    # CASO 4: PESTAÑA ESPECÍFICA "pagos"
    # ═════════════════════════════════════════════════════════════════════════
    elif tab_clean == "pagos":
        kpi_row = Table([[
            _kpi_box("Total Pagos Históricos", _fmt_gs(kpis.get("total_compras_historico", 0)), GREEN, 61),
            _kpi_box("DPO Promedio de Pago", f"{kpis.get('dpo_promedio_dias', 0)} días", PRIMARY_COLOR, 61),
            _kpi_box("Total Facturas Canceladas", str(len(pagos)), HexColor("#0284C7"), 62),
        ]], colWidths=[61 * mm, 61 * mm, 62 * mm])
        elements.append(kpi_row)
        elements.append(Spacer(1, 10))

        elements.append(Paragraph("Registro Cronológico de Desembolsos y Transferencias:", TITLE_SEC))
        pg_data = [["Fecha Pago", "Factura Cancelada", "Método de Pago", "Referencia / Comprobante", "Monto Pagado"]]
        for p in pagos:
            pg_data.append([
                _c(p.get("fecha_pago")),
                _c(p.get("invoice_numero") or "Factura"),
                _c(p.get("payment_method", "SIPAP").replace("_", " ").upper()),
                _c(p.get("referencia") or "Transf. Bancaria"),
                _n(_fmt_gs(p.get("monto")), bold=True, color=HexColor("#059669")),
            ])
        if not pagos:
            pg_data.append([_c("Sin pagos registrados"), _c(""), _c(""), _c(""), _n("0")])
        t_pgs = Table(pg_data, colWidths=[26 * mm, 40 * mm, 36 * mm, 46 * mm, 36 * mm])
        t_pgs.setStyle(_th_style(cols_right=[4]))
        elements.append(t_pgs)
        elements.append(Spacer(1, 14))
        elements.append(_render_firmas_bloque())

    # ═════════════════════════════════════════════════════════════════════════
    # CASO 5: PESTAÑA ESPECÍFICA "compras"
    # ═════════════════════════════════════════════════════════════════════════
    elif tab_clean == "compras":
        kpi_row = Table([[
            _kpi_box("Total OCs Emitidas", str(kpis.get("total_ordenes_compra", 0)), PRIMARY_COLOR, 46),
            _kpi_box("Cumplimiento OTIF", f"{kpis.get('otif_rate', 95)}%", GREEN, 46),
            _kpi_box("Plazo Entrega Pactado", f"{supplier.get('plazo_pago_dias', 0)} días", HexColor("#0284C7"), 46),
            _kpi_box("Total Recepciones Muelle", str(len(recepciones)), HexColor("#7C3AED"), 46),
        ]], colWidths=[46 * mm, 46 * mm, 46 * mm, 46 * mm])
        elements.append(kpi_row)
        elements.append(Spacer(1, 10))

        elements.append(Paragraph("1. Órdenes de Compra (OCs):", TITLE_SEC))
        oc_data = [["N° Orden", "Fecha Emisión", "Entrega Pactada", "Condición", "Total Gs.", "Estado"]]
        for o in ocs:
            oc_data.append([
                _c(o.get("numero"), bold=True),
                _c(o.get("fecha")),
                _c(o.get("fecha_entrega_estimada") or "—"),
                _c(o.get("condiciones_pago") or "Crédito"),
                _n(_fmt_gs(o.get("total")), bold=True),
                _c(o.get("estado", "completado").upper(), bold=True),
            ])
        if not ocs:
            oc_data.append([_c("Sin órdenes registradas"), _c(""), _c(""), _c(""), _n("0"), _c("—")])
        t_ocs = Table(oc_data, colWidths=[32 * mm, 28 * mm, 28 * mm, 36 * mm, 34 * mm, 26 * mm])
        t_ocs.setStyle(_th_style(cols_right=[4]))
        elements.append(t_ocs)
        elements.append(Spacer(1, 10))

        if recepciones:
            elements.append(Paragraph("2. Recepciones y Remitos en Depósito / Muelle:", TITLE_SEC))
            rec_data = [["N° Recepción", "Fecha", "Remito / Factura Ref.", "Total Gs.", "Revisión Faltantes", "Estado"]]
            for r in recepciones:
                rec_data.append([
                    _c(r.get("numero"), bold=True),
                    _c(r.get("fecha")),
                    _c(r.get("proveedor_ref") or "S/Ref"),
                    _n(_fmt_gs(r.get("total")), bold=True),
                    _c("Requiere NC/Ajuste" if r.get("requiere_revision") else "Conforme", color=RED if r.get("requiere_revision") else GREEN),
                    _c(r.get("estado", "recibido").upper()),
                ])
            t_rec = Table(rec_data, colWidths=[30 * mm, 24 * mm, 40 * mm, 32 * mm, 34 * mm, 24 * mm])
            t_rec.setStyle(_th_style(cols_right=[3]))
            elements.append(t_rec)
            elements.append(Spacer(1, 10))

        elements.append(_render_firmas_bloque())

    # ═════════════════════════════════════════════════════════════════════════
    # CASO 6: PESTAÑA ESPECÍFICA "stock"
    # ═════════════════════════════════════════════════════════════════════════
    elif tab_clean == "stock":
        kpi_row = Table([[
            _kpi_box("Stock en Depósito (Costo)", _fmt_gs(kpis.get("stock_valorizado_costo", 0)), HexColor("#0284C7"), 46),
            _kpi_box("Ventas Sell-Out (12M)", _fmt_gs(kpis.get("ventas_sellout_monto", 0)), HexColor("#059669"), 46),
            _kpi_box("Margen Bruto Promedio", f"{kpis.get('margen_bruto_pct', 0)}%", GREEN, 46),
            _kpi_box("Artículos en Catálogo", str(len(productos)), PRIMARY_COLOR, 46),
        ]], colWidths=[46 * mm, 46 * mm, 46 * mm, 46 * mm])
        elements.append(kpi_row)
        elements.append(Spacer(1, 10))

        elements.append(Paragraph("Catálogo de Artículos Suministrados, Existencias y Rentabilidad:", TITLE_SEC))
        prod_data = [["SKU", "Descripción del Artículo", "Stock", "PPP (Costo)", "PVP (Venta)", "Margen", "Ventas 12M", "Ganancia Gs."]]
        for p in productos[:45]:
            stk_color = RED if p.get("estado_stock") == "quiebre" else HexColor("#D97706") if p.get("estado_stock") == "bajo" else GRAY_DARK
            prod_data.append([
                _c(p.get("sku") or p.get("codigo_barra") or "—"),
                _c(p.get("nombre", "")[:32], bold=True),
                _n(f"{p.get('stock_actual', 0):.0f} un", bold=True, color=stk_color),
                _n(_fmt_gs(p.get("costo_promedio"))),
                _n(_fmt_gs(p.get("precio_venta"))),
                _n(f"{p.get('margen_unitario_pct', 0):.1f}%", bold=True, color=GREEN if p.get("margen_unitario_pct", 0) >= 20 else HexColor("#D97706")),
                _n(_fmt_gs(p.get("ventas_gs", 0))),
                _n(_fmt_gs(p.get("ganancia_bruta_gs", 0)), bold=True, color=HexColor("#059669")),
            ])
        if not productos:
            prod_data.append([_c("Sin productos en catálogo"), _c(""), _n("0"), _n("0"), _n("0"), _n("0%"), _n("0"), _n("0")])
        t_prods = Table(prod_data, colWidths=[22 * mm, 50 * mm, 18 * mm, 22 * mm, 22 * mm, 14 * mm, 20 * mm, 20 * mm])
        t_prods.setStyle(_th_style(cols_right=[2, 3, 4, 5, 6, 7]))
        elements.append(t_prods)
        elements.append(Spacer(1, 14))
        elements.append(_render_firmas_bloque())

    # ═════════════════════════════════════════════════════════════════════════
    # CASO 7: PESTAÑA ESPECÍFICA "informe"
    # ═════════════════════════════════════════════════════════════════════════
    elif tab_clean == "informe":
        elements.append(Paragraph("Dictamen Gerencial Extenso & Diagnóstico Estratégico", TITLE_SEC))
        elements.append(Paragraph("Auditoría analítica generada automáticamente en base a movimientos contables, bancarios y sell-out", SUBTITLE_SEC))

        diag_box_content = [
            [Paragraph(f"<b>Resumen Ejecutivo:</b> {informe.get('resumen_ejecutivo', '')}", BODY_TEXT)],
            [Paragraph(f"<b>Salud de Pasivos & Cheques Diferidos ({informe.get('salud_deuda', '')}):</b> {informe.get('diagnostico_deuda', '')}", BODY_TEXT)],
            [Paragraph(f"<b>Desempeño Logístico & Suministro ({informe.get('evaluacion_operativa', '')}):</b> {informe.get('diagnostico_operativo', '')}", BODY_TEXT)],
            [Paragraph(f"<b>Rentabilidad del Proveedor ({informe.get('evaluacion_rentabilidad', '')}):</b> {informe.get('diagnostico_rentabilidad', '')}", BODY_TEXT)],
        ]
        t_diag = Table(diag_box_content, colWidths=[184 * mm])
        t_diag.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), HexColor("#F1F5F9")),
            ("BOX", (0, 0), (-1, -1), 0.75, HexColor("#CBD5E1")),
            ("TOPPADDING", (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ("LEFTPADDING", (0, 0), (-1, -1), 6),
            ("RIGHTPADDING", (0, 0), (-1, -1), 6),
            ("LINEBELOW", (0, 0), (-1, -2), 0.4, HexColor("#E2E8F0")),
        ]))
        elements.append(t_diag)
        elements.append(Spacer(1, 10))

        recomms = informe.get("recomendaciones", [])
        if recomms:
            elements.append(Paragraph("Recomendaciones Estratégicas del Comité Financiero:", BODY_BOLD))
            rec_rows = [[Paragraph(f"• <b>Recomendación {idx + 1}:</b> {r}", BODY_TEXT)] for idx, r in enumerate(recomms)]
            t_rec = Table(rec_rows, colWidths=[184 * mm])
            t_rec.setStyle(TableStyle([
                ("BACKGROUND", (0, 0), (-1, -1), HexColor("#EFF6FF")),
                ("BOX", (0, 0), (-1, -1), 0.75, HexColor("#BFDBFE")),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
            ]))
            elements.append(t_rec)
            elements.append(Spacer(1, 14))

        elements.append(_render_firmas_bloque())

    # ═════════════════════════════════════════════════════════════════════════
    # CASO DEFAULT: INFORME MULTIPÁGINA 360° COMPLETO (ALL TABS)
    # ═════════════════════════════════════════════════════════════════════════
    else:
        # PÁGINA 1: HERO KPIS + MONEDERO + DICTAMEN GERENCIAL
        kpi_grid_row1 = Table([[
            _kpi_box("Deuda Facturada (AP)", _fmt_gs(kpis.get("deuda_total_facturas", 0)), RED, 46),
            _kpi_box("Saldo Monedero NC", _fmt_gs(monedero.get("saldo_disponible", 0)), GREEN, 46),
            _kpi_box("Deuda Neta Efectiva", _fmt_gs(kpis.get("deuda_neta_efectiva", 0)), HexColor("#7C3AED"), 46),
            _kpi_box("Cheques Dif. No Comp.", _fmt_gs(kpis.get("cheques_diferidos_pendientes_monto", 0)), HexColor("#D97706"), 46),
        ]], colWidths=[46 * mm, 46 * mm, 46 * mm, 46 * mm])
        elements.append(kpi_grid_row1)
        elements.append(Spacer(1, 4))

        kpi_grid_row2 = Table([[
            _kpi_box("Stock Depósito (Costo)", _fmt_gs(kpis.get("stock_valorizado_costo", 0)), HexColor("#0284C7"), 46),
            _kpi_box("Ventas Sell-Out (12M)", _fmt_gs(kpis.get("ventas_sellout_monto", 0)), HexColor("#059669"), 46),
            _kpi_box("Margen Bruto (%)", f"{kpis.get('margen_bruto_pct', 0)}% ({_fmt_gs(kpis.get('ganancia_bruta_monto', 0))})", HexColor("#059669"), 46),
            _kpi_box("Cumplimiento OTIF", f"{kpis.get('otif_rate', 95)}% A Tiempo", GREEN if kpis.get("otif_rate", 95) >= 90 else RED, 46),
        ]], colWidths=[46 * mm, 46 * mm, 46 * mm, 46 * mm])
        elements.append(kpi_grid_row2)
        elements.append(Spacer(1, 10))

        # Sección 1: Dictamen Gerencial
        elements.append(Paragraph("1. Dictamen Gerencial Extenso & Diagnóstico Comercial", TITLE_SEC))
        elements.append(Paragraph("Evaluación analítica generada automáticamente en base a saldos contables, movimientos bancarios y sell-out", SUBTITLE_SEC))

        diag_box_content = [
            [Paragraph(f"<b>Resumen Ejecutivo:</b> {informe.get('resumen_ejecutivo', '')}", BODY_TEXT)],
            [Paragraph(f"<b>Salud de Pasivos & Cheques Diferidos ({informe.get('salud_deuda', '')}):</b> {informe.get('diagnostico_deuda', '')}", BODY_TEXT)],
            [Paragraph(f"<b>Desempeño Logístico & Suministro ({informe.get('evaluacion_operativa', '')}):</b> {informe.get('diagnostico_operativo', '')}", BODY_TEXT)],
            [Paragraph(f"<b>Rentabilidad del Proveedor ({informe.get('evaluacion_rentabilidad', '')}):</b> {informe.get('diagnostico_rentabilidad', '')}", BODY_TEXT)],
        ]
        t_diag = Table(diag_box_content, colWidths=[184 * mm])
        t_diag.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), HexColor("#F1F5F9")),
            ("BOX", (0, 0), (-1, -1), 0.75, HexColor("#CBD5E1")),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ("LEFTPADDING", (0, 0), (-1, -1), 6),
            ("RIGHTPADDING", (0, 0), (-1, -1), 6),
            ("LINEBELOW", (0, 0), (-1, -2), 0.4, HexColor("#E2E8F0")),
        ]))
        elements.append(t_diag)
        elements.append(Spacer(1, 6))

        recomms = informe.get("recomendaciones", [])
        if recomms:
            rec_rows = [[Paragraph(f"• <b>Recomendación {idx + 1}:</b> {r}", BODY_TEXT)] for idx, r in enumerate(recomms)]
            t_rec = Table(rec_rows, colWidths=[184 * mm])
            t_rec.setStyle(TableStyle([
                ("BACKGROUND", (0, 0), (-1, -1), HexColor("#EFF6FF")),
                ("BOX", (0, 0), (-1, -1), 0.75, HexColor("#BFDBFE")),
                ("TOPPADDING", (0, 0), (-1, -1), 3),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
            ]))
            elements.append(t_rec)

        # PÁGINA 2: CUENTAS POR PAGAR (AP), AGING, FACTURAS CON NC Y CHEQUES
        elements.append(PageBreak())
        elements.append(Paragraph("2. Cuentas por Pagar (AP), Matriz de Aging y Cheques Diferidos", TITLE_SEC))
        elements.append(Paragraph("Desglose cronológico de obligaciones pendientes, vinculación de notas de crédito y cheques emitidos", SUBTITLE_SEC))

        aging_row = [
            [Paragraph("<b>Vencido</b>", KPI_LABEL), Paragraph("<b>1 a 30 Días</b>", KPI_LABEL), Paragraph("<b>31 a 60 Días</b>", KPI_LABEL), Paragraph("<b>+60 Días</b>", KPI_LABEL), Paragraph("<b>Total Deuda Facturada</b>", KPI_LABEL)],
            [
                Paragraph(_fmt_gs(aging.get("vencido", 0)), ParagraphStyle("AgV", parent=NUM_STYLE_BOLD, textColor=RED)),
                Paragraph(_fmt_gs(aging.get("dias_1_30", 0)), ParagraphStyle("Ag1", parent=NUM_STYLE_BOLD, textColor=HexColor("#D97706"))),
                Paragraph(_fmt_gs(aging.get("dias_31_60", 0)), ParagraphStyle("Ag2", parent=NUM_STYLE_BOLD, textColor=PRIMARY_COLOR)),
                Paragraph(_fmt_gs(aging.get("dias_mas_60", 0)), ParagraphStyle("Ag3", parent=NUM_STYLE_BOLD, textColor=GRAY_MEDIUM)),
                Paragraph(_fmt_gs(kpis.get("deuda_total_facturas", 0)), ParagraphStyle("AgT", parent=NUM_STYLE_BOLD, textColor=PRIMARY_COLOR)),
            ]
        ]
        t_ag = Table(aging_row, colWidths=[36 * mm, 36 * mm, 36 * mm, 36 * mm, 40 * mm])
        t_ag.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), GRAY_LIGHT),
            ("BOX", (0, 0), (-1, -1), 0.75, HexColor("#CBD5E1")),
            ("ALIGN", (0, 0), (-1, -1), "RIGHT"),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ("LEFTPADDING", (0, 0), (-1, -1), 6),
            ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ]))
        elements.append(t_ag)
        elements.append(Spacer(1, 8))

        elements.append(Paragraph("<b>Detalle de Facturas Comerciales y Deducción de NC:</b>", BODY_BOLD))
        fac_table_data = [["N° Factura", "Timbrado", "Emisión", "Vencimiento", "Total Gs.", "NCs Vinculadas", "Saldo Neto", "Fase de Pago"]]
        pend_facs = [f for f in facturas if f.get("saldo_pendiente", 0) > 0]
        for f in (pend_facs[:18] if pend_facs else facturas[:10]):
            es_v = f.get("es_vencida", False)
            v_color = RED if es_v else HexColor("#059669")
            m_nc = f.get("monto_nc_aplicado", 0)
            nc_txt = f"-{_fmt_gs(m_nc)}" if m_nc > 0 else "Retenida NC" if f.get("requiere_nc") else "Sin NC"
            nc_col = GREEN if m_nc > 0 else RED if f.get("requiere_nc") else GRAY_DARK
            fase = f.get("fase_pago_label", f.get("fase_pago", "al_dia")).replace("Fase ", "F")

            fac_table_data.append([
                _c(f.get("numero_factura"), bold=True),
                _c(f.get("timbrado") or "—"),
                _c(f.get("fecha_emision")),
                _c(f.get("fecha_vencimiento"), color=v_color, bold=es_v),
                _n(_fmt_gs(f.get("total"))),
                _c(nc_txt, bold=(m_nc > 0 or f.get("requiere_nc")), color=nc_col),
                _n(_fmt_gs(f.get("saldo_neto_real", f.get("saldo_pendiente"))), bold=True, color=v_color),
                _c(fase[:24], bold=True),
            ])
        t_facs = Table(fac_table_data, colWidths=[26 * mm, 18 * mm, 16 * mm, 16 * mm, 26 * mm, 26 * mm, 26 * mm, 30 * mm])
        t_facs.setStyle(_th_style(cols_right=[4, 6]))
        elements.append(t_facs)
        elements.append(Spacer(1, 10))

        # Cheques
        elements.append(Paragraph("<b>Cheques Diferidos Emitidos al Proveedor (Valores en Tránsito):</b>", BODY_BOLD))
        chq_table_data = [["N° Cheque", "Banco Pagador", "Emisión", "Fecha Cobro Diferido", "Días Rest.", "Monto Cheque", "Estado"]]
        for ch in cheques[:12]:
            d_rest = ch.get("dias_restantes", 0)
            est = ch.get("estado", "pendiente")
            est_color = HexColor("#D97706") if est in ("pendiente", "entregado") else GREEN if est == "compensado" else RED
            chq_table_data.append([
                _c(ch.get("numero"), bold=True),
                _c(ch.get("banco_emisor") or "Banco"),
                _c(ch.get("fecha_emision")),
                _c(ch.get("fecha_pago"), bold=True),
                _c(f"{d_rest} días" if d_rest >= 0 else f"Vencido {-d_rest}d", color=HexColor("#D97706") if d_rest <= 7 else GRAY_DARK),
                _n(_fmt_gs(ch.get("monto")), bold=True),
                _c(est.upper(), bold=True, color=est_color),
            ])
        if not cheques:
            chq_table_data.append([_c("Sin cheques diferidos registrados"), _c(""), _c(""), _c(""), _c(""), _n("0"), _c("—")])
        t_chqs = Table(chq_table_data, colWidths=[24 * mm, 34 * mm, 20 * mm, 28 * mm, 20 * mm, 32 * mm, 26 * mm])
        t_chqs.setStyle(_th_style(cols_right=[5]))
        elements.append(t_chqs)

        # PÁGINA 3: MONEDERO NC, ETAPAS DE RECLAMO Y DEVOLUCIONES
        elements.append(PageBreak())
        elements.append(Paragraph("3. Monedero de NC, Etapas de Regularización & Abastecimiento", TITLE_SEC))
        elements.append(Paragraph("Monedero de crédito activo, reclamos en etapa de requerimiento y control de devoluciones físicas", SUBTITLE_SEC))

        # Monedero items
        elements.append(Paragraph("<b>Monedero de Notas de Crédito Disponibles (Etapa 2):</b>", BODY_BOLD))
        nc_items = monedero.get("items", [])
        nc_table_data = [["N° NC", "Timbrado", "Fecha", "Origen / Causa", "Factura Origen", "Monto Orig.", "Saldo Monedero", "Estado"]]
        for item in (nc_items[:10] if nc_items else []):
            sd = item.get("saldo_disponible", 0)
            nc_table_data.append([
                _c(item.get("numero"), bold=True),
                _c(item.get("timbrado") or "—"),
                _c(item.get("fecha")),
                _c(item.get("origen_label", "")[:28]),
                _c(item.get("numero_factura_origen") or "S/Fact"),
                _n(_fmt_gs(item.get("monto_original"))),
                _n(_fmt_gs(sd), bold=True, color=GREEN if sd > 0 else GRAY_DARK),
                _c("CON SALDO" if sd > 0 else "CONSUMIDA", bold=True, color=GREEN if sd > 0 else GRAY_DARK),
            ])
        if not nc_items:
            nc_table_data.append([_c("Sin notas de crédito registradas en monedero"), _c(""), _c(""), _c(""), _c(""), _n("0"), _n("0"), _c("—")])
        t_mn = Table(nc_table_data, colWidths=[26 * mm, 20 * mm, 18 * mm, 38 * mm, 26 * mm, 28 * mm, 28 * mm, 20 * mm])
        t_mn.setStyle(_th_style(cols_right=[5, 6]))
        elements.append(t_mn)
        elements.append(Spacer(1, 10))

        # Reclamos en Etapa 1
        elements.append(Paragraph("<b>Reclamos y Devoluciones en Etapa 1 (Obligación Pendiente del Proveedor):</b>", BODY_BOLD))
        reclamos_enriq = monedero.get("reclamos", [])
        rec_table_data = [["N° Solicitud", "Fecha", "Origen / Motivo", "Factura Afectada", "Monto Reclamado", "NC Fiscal", "Etapa"]]
        for r in (reclamos_enriq[:10] if reclamos_enriq else []):
            is_pend = r.get("etapa_codigo") == "1_requerimiento"
            rec_table_data.append([
                _c(r.get("numero_solicitud"), bold=True),
                _c(r.get("created_at")),
                _c(r.get("origen_label", "")[:28]),
                _c(r.get("invoice_numero") or "Factura S/N"),
                _n(_fmt_gs(r.get("monto_reclamado")), bold=True, color=RED if is_pend else GREEN),
                _c(r.get("nc_recibida_numero") or "Pendiente", color=GREEN if r.get("nc_recibida_numero") else HexColor("#D97706")),
                _c("1: Requerimiento" if is_pend else "2: NC Emitida", bold=True, color=HexColor("#D97706") if is_pend else GREEN),
            ])
        if not reclamos_enriq:
            rec_table_data.append([_c("Sin reclamos u obligaciones pendientes"), _c(""), _c(""), _c(""), _n("0"), _c("—"), _c("AL DÍA", color=GREEN)])
        t_rc = Table(rec_table_data, colWidths=[28 * mm, 18 * mm, 38 * mm, 28 * mm, 28 * mm, 26 * mm, 28 * mm])
        t_rc.setStyle(_th_style(cols_right=[4]))
        elements.append(t_rc)
        elements.append(Spacer(1, 10))

        # Órdenes de Compra
        elements.append(Paragraph("<b>Últimas Órdenes de Compra (OCs):</b>", BODY_BOLD))
        oc_data = [["N° Orden", "Fecha Emisión", "Entrega Pactada", "Condición", "Total Gs.", "Estado"]]
        for o in ocs[:8]:
            oc_data.append([
                _c(o.get("numero"), bold=True),
                _c(o.get("fecha")),
                _c(o.get("fecha_entrega_estimada") or "—"),
                _c(o.get("condiciones_pago") or "Crédito 30d"),
                _n(_fmt_gs(o.get("total")), bold=True),
                _c(o.get("estado", "completado").upper(), bold=True),
            ])
        if not ocs:
            oc_data.append([_c("Sin órdenes registradas"), _c(""), _c(""), _c(""), _n("0"), _c("—")])
        t_ocs = Table(oc_data, colWidths=[32 * mm, 28 * mm, 28 * mm, 36 * mm, 34 * mm, 26 * mm])
        t_ocs.setStyle(_th_style(cols_right=[4]))
        elements.append(t_ocs)

        # PÁGINA 4: CATÁLOGO DE PRODUCTOS, EXISTENCIAS Y FIRMAS
        elements.append(PageBreak())
        elements.append(Paragraph("4. Catálogo de Artículos, Existencias de Stock & Rentabilidad", TITLE_SEC))
        elements.append(Paragraph("Rotación en salón de venta, valorización de inventario inmovilizado y margen comercial", SUBTITLE_SEC))

        prod_data = [["SKU", "Descripción del Artículo", "Stock", "PPP (Costo)", "PVP (Venta)", "Margen", "Ventas 12M", "Ganancia Gs."]]
        for p in productos[:24]:
            stk_color = RED if p.get("estado_stock") == "quiebre" else HexColor("#D97706") if p.get("estado_stock") == "bajo" else GRAY_DARK
            prod_data.append([
                _c(p.get("sku") or p.get("codigo_barra") or "—"),
                _c(p.get("nombre", "")[:32], bold=True),
                _n(f"{p.get('stock_actual', 0):.0f} un", bold=True, color=stk_color),
                _n(_fmt_gs(p.get("costo_promedio"))),
                _n(_fmt_gs(p.get("precio_venta"))),
                _n(f"{p.get('margen_unitario_pct', 0):.1f}%", bold=True, color=GREEN if p.get("margen_unitario_pct", 0) >= 20 else HexColor("#D97706")),
                _n(_fmt_gs(p.get("ventas_gs", 0))),
                _n(_fmt_gs(p.get("ganancia_bruta_gs", 0)), bold=True, color=HexColor("#059669")),
            ])
        if not productos:
            prod_data.append([_c("Sin productos en catálogo"), _c(""), _n("0"), _n("0"), _n("0"), _n("0%"), _n("0"), _n("0")])
        t_prods = Table(prod_data, colWidths=[22 * mm, 50 * mm, 18 * mm, 22 * mm, 22 * mm, 14 * mm, 20 * mm, 20 * mm])
        t_prods.setStyle(_th_style(cols_right=[2, 3, 4, 5, 6, 7]))
        elements.append(t_prods)
        elements.append(Spacer(1, 14))

        elements.append(_render_firmas_bloque())

    doc.build(elements)
    pdf_bytes = buffer.getvalue()
    buffer.close()
    return pdf_bytes
