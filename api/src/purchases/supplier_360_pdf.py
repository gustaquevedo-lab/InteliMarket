"""Generador de Informe Gerencial 360° de Proveedor en PDF.
Utiliza ReportLab con diseño editorial ejecutivo (paleta corporativa InteliMarket,
NumberedCanvas, tipografías y tablas optimizadas).
"""
from __future__ import annotations

import io
import os
from datetime import date, datetime
from decimal import Decimal
from typing import Dict, Any

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

CELL_STYLE = ParagraphStyle("Sup360Cell", fontName=FONT_REGULAR, fontSize=7.2, leading=8.5, textColor=GRAY_DARK)
CELL_STYLE_BOLD = ParagraphStyle("Sup360CellBold", fontName=FONT_BOLD, fontSize=7.2, leading=8.5, textColor=GRAY_DARK)
NUM_STYLE = ParagraphStyle("Sup360Num", fontName=FONT_REGULAR, fontSize=7.2, leading=8.5, textColor=GRAY_DARK, alignment=TA_RIGHT)
NUM_STYLE_BOLD = ParagraphStyle("Sup360NumBold", fontName=FONT_BOLD, fontSize=7.2, leading=8.5, textColor=GRAY_DARK, alignment=TA_RIGHT)

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
    fontSize=7.8,
    leading=10.5,
    textColor=GRAY_DARK,
)

BODY_BOLD = ParagraphStyle(
    "Sup360BodyBold",
    fontName=FONT_BOLD,
    fontSize=7.8,
    leading=10.5,
    textColor=PRIMARY_COLOR,
)

KPI_VALUE = ParagraphStyle("SupKpiVal", fontName=FONT_BOLD, fontSize=11, textColor=PRIMARY_COLOR, leading=13)
KPI_LABEL = ParagraphStyle("SupKpiLbl", fontName=FONT_BOLD, fontSize=6.5, textColor=GRAY_MEDIUM, leading=8, textTransform="uppercase")


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


def _kpi_box(label: str, val_str: str, color_val=None) -> Table:
    v_style = KPI_VALUE
    if color_val:
        v_style = ParagraphStyle("VKpi", parent=KPI_VALUE, textColor=color_val)
    t = Table([
        [Paragraph(label, KPI_LABEL)],
        [Paragraph(val_str, v_style)]
    ], colWidths=[44 * mm])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), GRAY_LIGHT),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("BOX", (0, 0), (-1, -1), 0.5, HexColor("#E2E8F0")),
    ]))
    return t


def _th_style(cols_right: list[int] = None) -> TableStyle:
    cols_right = cols_right or []
    ts = [
        ("BACKGROUND", (0, 0), (-1, 0), PRIMARY_COLOR),
        ("TEXTCOLOR", (0, 0), (-1, 0), WHITE),
        ("FONTNAME", (0, 0), (-1, 0), FONT_BOLD),
        ("FONTSIZE", (0, 0), (-1, 0), 6.8),
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


def generate_supplier_360_pdf(company: dict, data: dict, generated_by: str = "") -> bytes:
    buffer = io.BytesIO()
    doc, styles = _base_doc(buffer, "Visión 360° del Proveedor - Informe Gerencial", company, generated_by)

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

    rz = supplier.get("razon_social", "PROVEEDOR")
    ruc = supplier.get("ruc", "S/RUC")

    elements = _company_header(
        company, styles,
        "VISIÓN 360° — INFORME GERENCIAL DE PROVEEDOR",
        f"Auditoría Integral Comercial, Financiera y Operativa: {rz} (RUC: {ruc})",
        generated_by
    )

    # ── FICHA DE IDENTIFICACIÓN DEL PROVEEDOR ──────────────────────────────
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
    elements.append(t_ficha)
    elements.append(Spacer(1, 8))

    # ── TABLERO DE KPIS HERO ────────────────────────────────────────────────
    kpi_grid_row1 = Table([[
        _kpi_box("Deuda Facturada (AP)", _fmt_gs(kpis.get("deuda_total_facturas", 0)), RED),
        _kpi_box("Cheques Dif. No Compens.", _fmt_gs(kpis.get("cheques_diferidos_pendientes_monto", 0)), HexColor("#D97706")),
        _kpi_box("Exposición Financiera Total", _fmt_gs(kpis.get("exposicion_financiera_total", 0)), PRIMARY_COLOR),
        _kpi_box("Deuda Vencida (+0d)", _fmt_gs(kpis.get("deuda_vencida", 0)), RED if kpis.get("deuda_vencida", 0) > 0 else GREEN),
    ]], colWidths=[46 * mm, 46 * mm, 46 * mm, 46 * mm])
    kpi_grid_row1.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "MIDDLE")]))
    elements.append(kpi_grid_row1)
    elements.append(Spacer(1, 4))

    kpi_grid_row2 = Table([[
        _kpi_box("Stock en Depósito (Costo)", _fmt_gs(kpis.get("stock_valorizado_costo", 0)), HexColor("#0284C7")),
        _kpi_box("Ventas Sell-Out (12M)", _fmt_gs(kpis.get("ventas_sellout_monto", 0)), HexColor("#059669")),
        _kpi_box("Margen Bruto (%)", f"{kpis.get('margen_bruto_pct', 0)}% ({_fmt_gs(kpis.get('ganancia_bruta_monto', 0))})", HexColor("#059669")),
        _kpi_box("Cumplimiento OTIF", f"{kpis.get('otif_rate', 95)}% Entrega a Tiempo", GREEN if kpis.get("otif_rate", 95) >= 90 else RED),
    ]], colWidths=[46 * mm, 46 * mm, 46 * mm, 46 * mm])
    kpi_grid_row2.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "MIDDLE")]))
    elements.append(kpi_grid_row2)
    elements.append(Spacer(1, 10))

    # ── SECCIÓN 1: INFORME GERENCIAL Y DIAGNÓSTICO AUDITADO ──────────────────
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

    # Recomendaciones estratégicas
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

    # ── PÁGINA 2: DEUDAS, AGING Y CHEQUES DIFERIDOS ─────────────────────────
    elements.append(PageBreak())
    elements.append(Paragraph("2. Cuentas por Pagar (AP), Matriz de Aging y Cheques Diferidos", TITLE_SEC))
    elements.append(Paragraph("Desglose cronológico de obligaciones pendientes y cheques emitidos aún no compensados", SUBTITLE_SEC))

    # Aging buckets resumen
    aging_row = [
        [
            Paragraph("<b>Vencido</b>", KPI_LABEL),
            Paragraph("<b>1 a 30 Días</b>", KPI_LABEL),
            Paragraph("<b>31 a 60 Días</b>", KPI_LABEL),
            Paragraph("<b>+60 Días</b>", KPI_LABEL),
            Paragraph("<b>Total Deuda Facturada</b>", KPI_LABEL),
        ],
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
        ("ALIGN", (0, 0), (-1, 0), "RIGHT"),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
    ]))
    elements.append(t_ag)
    elements.append(Spacer(1, 8))

    # Tabla Facturas Comerciales
    elements.append(Paragraph("<b>Detalle de Facturas Comerciales Abiertas:</b>", BODY_BOLD))
    fac_table_data = [["N° Factura", "Timbrado", "Emisión", "Vencimiento", "Condición", "Total Factura", "Saldo Pendiente", "Estado"]]
    pend_facs = [f for f in facturas if f.get("saldo_pendiente", 0) > 0]
    for f in (pend_facs[:18] if pend_facs else facturas[:10]):
        dias = f.get("dias_vencido", 0)
        es_v = f.get("es_vencida", False)
        v_color = RED if es_v else HexColor("#059669")
        fac_table_data.append([
            _c(f.get("numero_factura"), bold=True),
            _c(f.get("timbrado") or "—"),
            _c(f.get("fecha_emision")),
            _c(f.get("fecha_vencimiento"), color=v_color, bold=es_v),
            _c(f.get("condicion", "Crédito").capitalize()),
            _n(_fmt_gs(f.get("total"))),
            _n(_fmt_gs(f.get("saldo_pendiente")), bold=True, color=v_color),
            _c(f"Vencida (+{dias}d)" if es_v else f"Al día ({abs(dias)}d rest)", bold=True, color=v_color),
        ])
    t_facs = Table(fac_table_data, colWidths=[28 * mm, 20 * mm, 18 * mm, 18 * mm, 18 * mm, 26 * mm, 28 * mm, 28 * mm])
    t_facs.setStyle(_th_style(cols_right=[5, 6]))
    elements.append(t_facs)
    elements.append(Spacer(1, 10))

    # Tabla Cheques Diferidos Emitidos
    elements.append(Paragraph("<b>Cheques Diferidos Emitidos al Proveedor (Compromisos en Tránsito):</b>", BODY_BOLD))
    chq_table_data = [["N° Cheque", "Banco Pagador", "Emisión", "Fecha Cobro Diferido", "Días Rest.", "Monto Cheque", "Estado"]]
    for ch in cheques[:15]:
        d_rest = ch.get("dias_restantes", 0)
        est = ch.get("estado", "pendiente")
        est_color = HexColor("#D97706") if est in ("pendiente", "entregado") else GREEN if est == "compensado" else RED
        chq_table_data.append([
            _c(ch.get("numero"), bold=True),
            _c(ch.get("banco_emisor") or "Banco Itaú"),
            _c(ch.get("fecha_emision")),
            _c(ch.get("fecha_pago"), bold=True),
            _c(f"{d_rest} días" if d_rest >= 0 else f"Vencido {-d_rest}d", color=HexColor("#D97706") if d_rest <= 7 else GRAY_DARK),
            _n(_fmt_gs(ch.get("monto")), bold=True),
            _c(est.upper(), bold=True, color=est_color),
        ])
    if not cheques:
        chq_table_data.append([_c("Sin cheques diferidos emitidos registrados para este proveedor"), _c(""), _c(""), _c(""), _c(""), _n("0"), _c("—")])
    t_chqs = Table(chq_table_data, colWidths=[24 * mm, 34 * mm, 20 * mm, 28 * mm, 20 * mm, 32 * mm, 26 * mm])
    t_chqs.setStyle(_th_style(cols_right=[5]))
    elements.append(t_chqs)

    # ── PÁGINA 3: OPERACIONES, RECEPCIONES Y RECLAMOS DE NOTA DE CRÉDITO ────
    elements.append(PageBreak())
    elements.append(Paragraph("3. Operaciones de Abastecimiento, Recepciones & Reclamos de NC", TITLE_SEC))
    elements.append(Paragraph("Historial de órdenes de compra, control de entregas en depósito y regularizaciones de NC", SUBTITLE_SEC))

    # Órdenes de Compra
    elements.append(Paragraph("<b>Últimas Órdenes de Compra (OCs):</b>", BODY_BOLD))
    oc_data = [["N° Orden", "Fecha Emisión", "Entrega Pactada", "Condición", "Total Gs.", "Estado"]]
    for o in ocs[:10]:
        oc_data.append([
            _c(o.get("numero"), bold=True),
            _c(o.get("fecha")),
            _c(o.get("fecha_entrega_estimada") or "—"),
            _c(o.get("condiciones_pago") or "Crédito 30d"),
            _n(_fmt_gs(o.get("total")), bold=True),
            _c(o.get("estado", "completado").upper(), bold=True, color=GREEN if o.get("estado") in ("completado", "recibido") else PRIMARY_COLOR),
        ])
    if not ocs:
        oc_data.append([_c("Sin órdenes de compra registradas"), _c(""), _c(""), _c(""), _n("0"), _c("—")])
    t_ocs = Table(oc_data, colWidths=[32 * mm, 28 * mm, 28 * mm, 36 * mm, 34 * mm, 26 * mm])
    t_ocs.setStyle(_th_style(cols_right=[4]))
    elements.append(t_ocs)
    elements.append(Spacer(1, 10))

    # Reclamos y Solicitudes de NC
    elements.append(Paragraph("<b>Reclamos de Mercadería & Solicitudes de Nota de Crédito:</b>", BODY_BOLD))
    nc_data = [["N° Solicitud", "Factura Afectada", "Motivo Reclamo", "Monto Reclamado", "N° NC Fiscal Recibida", "Estado"]]
    for n in reclamos[:10]:
        nc_est = n.get("estado", "pendiente")
        nc_color = GREEN if nc_est == "resuelta" else HexColor("#D97706") if nc_est == "pendiente_entrega" else RED
        nc_data.append([
            _c(n.get("numero_solicitud"), bold=True),
            _c(n.get("invoice_numero") or "Factura S/N"),
            _c(n.get("tipo_motivo", "diferencia").replace("_", " ").capitalize()),
            _n(_fmt_gs(n.get("monto_reclamado")), bold=True),
            _c(n.get("nc_recibida_numero") or "Pendiente de Emisión", color=GREEN if n.get("nc_recibida_numero") else RED),
            _c(nc_est.replace("_", " ").upper(), bold=True, color=nc_color),
        ])
    if not reclamos:
        nc_data.append([_c("Sin reclamos de notas de crédito pendientes"), _c(""), _c(""), _n("0"), _c("—"), _c("AL DÍA", color=GREEN)])
    t_ncs = Table(nc_data, colWidths=[30 * mm, 34 * mm, 34 * mm, 28 * mm, 34 * mm, 24 * mm])
    t_ncs.setStyle(_th_style(cols_right=[3]))
    elements.append(t_ncs)
    elements.append(Spacer(1, 10))

    # Historial de Pagos Efectuados
    elements.append(Paragraph("<b>Historial de Pagos & Transferencias Recientes:</b>", BODY_BOLD))
    pg_data = [["Fecha Pago", "Factura Cancelada", "Medio de Pago", "Referencia / Comprobante", "Monto Pagado"]]
    for pg in pagos[:10]:
        pg_data.append([
            _c(pg.get("fecha_pago")),
            _c(pg.get("invoice_numero") or "Factura"),
            _c(pg.get("payment_method", "SIPAP").replace("_", " ").upper()),
            _c(pg.get("referencia") or "Transf. Bancaria"),
            _n(_fmt_gs(pg.get("monto")), bold=True, color=HexColor("#059669")),
        ])
    if not pagos:
        pg_data.append([_c("Sin pagos recientes"), _c(""), _c(""), _c(""), _n("0")])
    t_pgs = Table(pg_data, colWidths=[26 * mm, 40 * mm, 36 * mm, 46 * mm, 36 * mm])
    t_pgs.setStyle(_th_style(cols_right=[4]))
    elements.append(t_pgs)

    # ── PÁGINA 4: CATÁLOGO DE PRODUCTOS, STOCK Y RENTABILIDAD ───────────────
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
    t_prods = Table(prod_data, colWidths=[22 * mm, 50 * mm, 18 * mm, 22 * mm, 22 * mm, 14 * mm, 20 * mm, 20 * mm])
    t_prods.setStyle(_th_style(cols_right=[2, 3, 4, 5, 6, 7]))
    elements.append(t_prods)
    elements.append(Spacer(1, 14))

    # ── BLOQUE DE FIRMAS Y CONFORMIDAD ──────────────────────────────────────
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
        ("TOPPADDING", (0, 0), (-1, -1), 10),
    ]))
    elements.append(KeepTogether([t_sign]))

    doc.build(elements)
    pdf_bytes = buffer.getvalue()
    buffer.close()
    return pdf_bytes
