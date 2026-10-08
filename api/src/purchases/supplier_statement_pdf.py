"""Generador del Reporte Oficial en PDF:
EXTRACTO DE CUENTA CORRIENTE Y PUNTEO FÍSICO DE DEUDA POR PROVEEDOR.

Diseño editorial ejecutivo A4 Landscape (Horizontal) de alta fidelidad:
- Encabezado institucional de Extra Supermercado Mayorista con RUC y Timbrado.
- Metadatos de auditoría y zona horaria Paraguay (America/Asuncion).
- Resumen ejecutivo de pasivos y saldo deudor exigible.
- Detalle cronológico continuo (Facturas, Notas de Crédito, Pagos) con saldo progresivo acumulado.
- Columna con casilla cuadrada física '[   ]' para punteo manual con bolígrafo.
- Detalle de Cheques Diferidos en Tránsito entregados al proveedor.
- Bloque formal de firmas y conformidad de saldos entre Tesorería y el Proveedor.
"""
from __future__ import annotations

import io
import os
from datetime import date, datetime
from decimal import Decimal
from typing import Dict, Any, Optional, List
from zoneinfo import ZoneInfo

from reportlab.lib.units import mm
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_RIGHT, TA_CENTER, TA_LEFT
from reportlab.platypus import Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether, HRFlowable
from reportlab.lib.colors import HexColor

from api.src.integrated_finance.pdf_reports import (
    _base_landscape_doc, _logo_flowable, _fmt_gs,
    PRIMARY_COLOR, ACCENT_BLUE, GRAY_LIGHT, GRAY_MEDIUM, GRAY_DARK, WHITE, RED, GREEN,
    FONT_REGULAR, FONT_BOLD,
)

PY_TZ = ZoneInfo("America/Asuncion")

# Estilos tipográficos
CELL_STYLE = ParagraphStyle("StmCell", fontName=FONT_REGULAR, fontSize=6.8, leading=8.0, textColor=GRAY_DARK)
CELL_STYLE_BOLD = ParagraphStyle("StmCellBold", fontName=FONT_BOLD, fontSize=6.8, leading=8.0, textColor=GRAY_DARK)
CELL_STYLE_CENTER = ParagraphStyle("StmCellCenter", fontName=FONT_REGULAR, fontSize=6.8, leading=8.0, textColor=GRAY_DARK, alignment=TA_CENTER)
CELL_STYLE_CENTER_BOLD = ParagraphStyle("StmCellCenterBold", fontName=FONT_BOLD, fontSize=6.8, leading=8.0, textColor=GRAY_DARK, alignment=TA_CENTER)

NUM_STYLE = ParagraphStyle("StmNum", fontName=FONT_REGULAR, fontSize=6.8, leading=8.0, textColor=GRAY_DARK, alignment=TA_RIGHT)
NUM_STYLE_BOLD = ParagraphStyle("StmNumBold", fontName=FONT_BOLD, fontSize=6.8, leading=8.0, textColor=GRAY_DARK, alignment=TA_RIGHT)

TITLE_SEC = ParagraphStyle(
    "StmSecTitle",
    fontName=FONT_BOLD,
    fontSize=9.0,
    leading=11.5,
    textColor=PRIMARY_COLOR,
    spaceAfter=4,
)

KPI_VALUE = ParagraphStyle("StmKpiVal", fontName=FONT_BOLD, fontSize=9.5, textColor=PRIMARY_COLOR, leading=11.5)
KPI_LABEL = ParagraphStyle("StmKpiLbl", fontName=FONT_BOLD, fontSize=5.8, textColor=GRAY_MEDIUM, leading=7.2, textTransform="uppercase")


def _c(text, bold: bool = False, color=None, center: bool = False) -> Paragraph:
    if center:
        style = CELL_STYLE_CENTER_BOLD if bold else CELL_STYLE_CENTER
    else:
        style = CELL_STYLE_BOLD if bold else CELL_STYLE
    if color:
        style = ParagraphStyle("CColor", parent=style, textColor=color)
    return Paragraph(str(text) if text is not None and str(text) != "" else "—", style)


def _n(text, bold: bool = False, color=None) -> Paragraph:
    style = NUM_STYLE_BOLD if bold else NUM_STYLE
    if color:
        style = ParagraphStyle("NColor", parent=style, textColor=color)
    return Paragraph(str(text) if text is not None and str(text) != "" else "—", style)


def _checkbox_box() -> Table:
    """Dibuja un casillero cuadrado de 4.2mm x 4.2mm con borde visible para marcar con bolígrafo."""
    t = Table([[""]], colWidths=[4.8 * mm], rowHeights=[4.8 * mm])
    t.setStyle(TableStyle([
        ("BOX", (0, 0), (-1, -1), 0.8, HexColor("#475569")),
        ("BACKGROUND", (0, 0), (-1, -1), WHITE),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
    ]))
    return t


def _kpi_box(label: str, val_str: str, color_val=None, width_mm: float = 43) -> Table:
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
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
        ("BOX", (0, 0), (-1, -1), 0.5, HexColor("#CBD5E1")),
    ]))
    return t


def _render_firmas_bloque() -> Table:
    """Bloque formal de conformidad de saldos y firmas para el punteo físico."""
    linea_extra = Table([[""]], colWidths=[80 * mm], rowHeights=[0.5 * mm])
    linea_extra.setStyle(TableStyle([("LINEBELOW", (0, 0), (-1, -1), 0.8, HexColor("#475569"))]))

    linea_prov = Table([[""]], colWidths=[80 * mm], rowHeights=[0.5 * mm])
    linea_prov.setStyle(TableStyle([("LINEBELOW", (0, 0), (-1, -1), 0.8, HexColor("#475569"))]))

    t_firmas = Table([
        [
            Paragraph("<b>POR EXTRA SUPERMERCADO MAYORISTA</b>", ParagraphStyle("F1", fontName=FONT_BOLD, fontSize=7.2, alignment=TA_CENTER, textColor=PRIMARY_COLOR)),
            Paragraph("", CELL_STYLE),
            Paragraph("<b>POR EL PROVEEDOR (CONFORMIDAD DE SALDO)</b>", ParagraphStyle("F2", fontName=FONT_BOLD, fontSize=7.2, alignment=TA_CENTER, textColor=PRIMARY_COLOR)),
        ],
        [Spacer(1, 14 * mm), "", Spacer(1, 14 * mm)],
        [linea_extra, "", linea_prov],
        [
            Paragraph("Tesorería / Cuentas por Pagar<br/><font size=6 color='#64748B'>Firma y Sello de Auditoría Interna</font>", ParagraphStyle("SubF1", fontName=FONT_REGULAR, fontSize=6.8, leading=8.5, alignment=TA_CENTER)),
            "",
            Paragraph("Representante / Cobranzas Autorizado<br/><font size=6 color='#64748B'>Firma, Aclaración de Firma y N° de C.I.</font>", ParagraphStyle("SubF2", fontName=FONT_REGULAR, fontSize=6.8, leading=8.5, alignment=TA_CENTER)),
        ]
    ], colWidths=[110 * mm, 53 * mm, 110 * mm])
    t_firmas.setStyle(TableStyle([
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 2),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
    ]))
    return t_firmas


def generate_supplier_statement_pdf(
    company: dict,
    data: Dict[str, Any],
    generated_by: str = "Tesorería / Auditoría",
) -> bytes:
    """Genera el PDF del Extracto de Cuenta Corriente y Punteo Físico en orientación Landscape."""
    buffer = io.BytesIO()
    doc, styles = _base_landscape_doc(
        buffer,
        title="Extracto de Cuenta Corriente y Punteo Físico",
        company=company,
        generated_by=generated_by,
    )

    elements = []
    supplier = data.get("supplier", {})
    totales = data.get("totales", {})
    periodo = data.get("periodo", {})
    movimientos = data.get("movimientos", [])
    cheques = data.get("cheques_diferidos", [])
    saldo_anterior = float(data.get("saldo_anterior", 0.0))

    # Fecha/Hora local de Paraguay
    now_py = datetime.now(PY_TZ)
    now_str = now_py.strftime("%d/%m/%Y %H:%M")

    # 1. ENCABEZADO INSTITUCIONAL
    logo = _logo_flowable(company, max_w=40 * mm, max_h=16 * mm)
    title_box = [
        Paragraph("<b>EXTRA SUPERMERCADO MAYORISTA</b>", ParagraphStyle("CompTitle", fontName=FONT_BOLD, fontSize=11, leading=13, textColor=PRIMARY_COLOR)),
        Paragraph("GRUPO SANTA TERESA E.A.S. — RUC: 80150377-9 — Timbrado: 18545636", ParagraphStyle("CompSub", fontName=FONT_REGULAR, fontSize=6.8, leading=8.5, textColor=GRAY_MEDIUM)),
        Paragraph("<b>EXTRACTO DE CUENTA CORRIENTE Y PUNTEO FÍSICO DE DEUDA</b>", ParagraphStyle("DocTitle", fontName=FONT_BOLD, fontSize=9.5, leading=12, textColor=ACCENT_BLUE)),
        Paragraph("Libro Mayor Continuo de Proveedor — Conciliación de Cuentas por Pagar (AP)", ParagraphStyle("DocSub", fontName=FONT_REGULAR, fontSize=6.8, leading=8.5, textColor=GRAY_DARK)),
    ]
    meta_box = [
        Paragraph(f"<b>Emisión:</b> {now_str} (PY)", ParagraphStyle("M1", fontName=FONT_REGULAR, fontSize=6.8, leading=8.5, alignment=TA_RIGHT, textColor=GRAY_DARK)),
        Paragraph(f"<b>Auditoría:</b> {generated_by}", ParagraphStyle("M2", fontName=FONT_REGULAR, fontSize=6.8, leading=8.5, alignment=TA_RIGHT, textColor=GRAY_MEDIUM)),
        Paragraph(f"<b>Período:</b> {periodo.get('fecha_desde') or 'Histórico'} al {periodo.get('fecha_hasta') or 'Hoy'}", ParagraphStyle("M3", fontName=FONT_REGULAR, fontSize=6.8, leading=8.5, alignment=TA_RIGHT, textColor=PRIMARY_COLOR)),
        Paragraph(f"<b>Moneda:</b> Guaraníes (PYG)", ParagraphStyle("M4", fontName=FONT_BOLD, fontSize=6.8, leading=8.5, alignment=TA_RIGHT, textColor=PRIMARY_COLOR)),
    ]
    # Ancho total útil Landscape = 273mm
    header_table = Table([[logo, title_box, meta_box]], colWidths=[44 * mm, 149 * mm, 80 * mm])
    header_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    elements.append(header_table)
    elements.append(HRFlowable(width="100%", thickness=1.0, color=PRIMARY_COLOR, spaceBefore=2, spaceAfter=5))

    # 2. FICHA DEL PROVEEDOR
    rz = supplier.get("razon_social") or "PROVEEDOR S/N"
    ruc = supplier.get("ruc") or supplier.get("ci") or "—"
    tel = supplier.get("telefono") or "—"
    plazo = f"{supplier.get('plazo_pago_dias', 0)} días"
    banco = f"{supplier.get('banco') or '—'} {supplier.get('cuenta_bancaria') or ''}".strip()
    dir_p = supplier.get("direccion") or "—"

    prov_info_table = Table([
        [
            Paragraph(f"<b>PROVEEDOR:</b> <font color='#1E40AF' size=7.5><b>{rz}</b></font>", CELL_STYLE),
            Paragraph(f"<b>RUC / Doc:</b> {ruc}", CELL_STYLE),
            Paragraph(f"<b>Plazo de Crédito:</b> {plazo}", CELL_STYLE),
        ],
        [
            Paragraph(f"<b>Dirección:</b> {dir_p}", CELL_STYLE),
            Paragraph(f"<b>Teléfono / Contacto:</b> {tel}", CELL_STYLE),
            Paragraph(f"<b>Banco / Cta.:</b> {banco}", CELL_STYLE),
        ]
    ], colWidths=[110 * mm, 83 * mm, 80 * mm])
    prov_info_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), GRAY_LIGHT),
        ("BOX", (0, 0), (-1, -1), 0.5, HexColor("#CBD5E1")),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
    ]))
    elements.append(prov_info_table)
    elements.append(Spacer(1, 4 * mm))

    # 3. KPI BOXES - RESUMEN DE SALDOS
    # 6 cuadros de 44.5 mm cada uno (44.5 * 6 = 267 mm + padding = 273 mm)
    tot_fac = totales.get("total_facturas_debito", 0.0)
    tot_nc = totales.get("total_nc_credito", 0.0)
    tot_pago = totales.get("total_pagos_credito", 0.0)
    saldo_exigible = totales.get("saldo_deudor_final", 0.0)
    chq_transito = totales.get("cheques_diferidos_transito_monto", 0.0)
    saldo_neto = totales.get("saldo_neto_con_cheques", 0.0)

    kpis_table = Table([[
        _kpi_box("1. Total Facturas (Débitos)", _fmt_gs(tot_fac), PRIMARY_COLOR, 44.5),
        _kpi_box("2. Notas de Crédito (Crédito)", f"-{_fmt_gs(tot_nc)}", HexColor("#059669"), 44.5),
        _kpi_box("3. Pagos Realizados (Crédito)", f"-{_fmt_gs(tot_pago)}", HexColor("#1E40AF"), 44.5),
        _kpi_box("4. Saldo Deudor Exigible (1-2-3)", _fmt_gs(saldo_exigible), RED if saldo_exigible > 0 else HexColor("#059669"), 45.5),
        _kpi_box("5. Cheques Diferidos en Tránsito", _fmt_gs(chq_transito), HexColor("#D97706"), 44.5),
        _kpi_box("6. Saldo Neto Proyectado (4-5)", _fmt_gs(saldo_neto), HexColor("#7C3AED"), 45.5),
    ]], colWidths=[45 * mm, 45 * mm, 45 * mm, 46 * mm, 45 * mm, 47 * mm])
    kpis_table.setStyle(TableStyle([
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
    ]))
    elements.append(kpis_table)
    elements.append(Spacer(1, 4 * mm))

    # 4. TABLA PRINCIPAL DE MOVIMIENTOS CRONOLÓGICOS (PUNTEO FÍSICO)
    # Ancho total = 273 mm
    # Col widths:
    # Fecha: 17mm | Venc: 17mm | Tipo: 12mm | Comprobante: 32mm | Concepto/Imputación: 63mm | Débito (+): 28mm | Crédito (-): 28mm | Saldo Prog.: 32mm | Estado: 28mm | Punteo [ ]: 16mm
    # Suma = 17+17+12+32+63+28+28+32+28+16 = 273 mm exacto.
    col_w = [17 * mm, 17 * mm, 12 * mm, 32 * mm, 63 * mm, 28 * mm, 28 * mm, 32 * mm, 28 * mm, 16 * mm]

    table_data = [[
        Paragraph("<b>Fecha</b>", CELL_STYLE_CENTER_BOLD),
        Paragraph("<b>Venc.</b>", CELL_STYLE_CENTER_BOLD),
        Paragraph("<b>Tipo</b>", CELL_STYLE_CENTER_BOLD),
        Paragraph("<b>Comprobante</b>", CELL_STYLE_BOLD),
        Paragraph("<b>Concepto / Imputación Comercial</b>", CELL_STYLE_BOLD),
        Paragraph("<b>Débito (+) Gs.</b>", NUM_STYLE_BOLD),
        Paragraph("<b>Crédito (-) Gs.</b>", NUM_STYLE_BOLD),
        Paragraph("<b>Saldo Prog. Gs.</b>", NUM_STYLE_BOLD),
        Paragraph("<b>Estado / Vto.</b>", CELL_STYLE_CENTER_BOLD),
        Paragraph("<b>Punteo [  ]</b>", CELL_STYLE_CENTER_BOLD),
    ]]

    # Si hay saldo inicial/anterior
    if saldo_anterior != 0.0 or (periodo.get("fecha_desde")):
        table_data.append([
            _c(periodo.get("fecha_desde") or "—", center=True),
            _c("—", center=True),
            _c("SALDO", bold=True, center=True),
            _c("SALDO INICIAL", bold=True),
            _c(f"Saldo anterior al {periodo.get('fecha_desde') or 'período'}", bold=True),
            _n(_fmt_gs(saldo_anterior) if saldo_anterior > 0 else "—"),
            _n(_fmt_gs(abs(saldo_anterior)) if saldo_anterior < 0 else "—"),
            _n(_fmt_gs(saldo_anterior), bold=True, color=RED if saldo_anterior > 0 else GREEN),
            _c("Inicial", center=True),
            _checkbox_box(),
        ])

    for m in movimientos:
        t_badge = m.get("tipo_badge", "FAC")
        deb = m.get("debito", 0.0)
        cred = m.get("credito", 0.0)
        sp = m.get("saldo_progresivo", 0.0)

        # Colores por tipo de comprobante
        if t_badge == "FAC":
            col_comp = PRIMARY_COLOR
            col_badge = HexColor("#1E3A8A")
        elif t_badge == "NC":
            col_comp = HexColor("#059669")
            col_badge = HexColor("#059669")
        else:
            col_comp = HexColor("#1E40AF")
            col_badge = HexColor("#1E40AF")

        table_data.append([
            _c(m.get("fecha_str"), center=True),
            _c(m.get("fecha_vencimiento_str") or "—", center=True),
            _c(t_badge, bold=True, color=col_badge, center=True),
            _c(m.get("comprobante"), bold=True, color=col_comp),
            _c(m.get("concepto")[:65]),
            _n(_fmt_gs(deb) if deb > 0 else "—"),
            _n(f"-{_fmt_gs(cred)}" if cred > 0 else "—", color=HexColor("#059669") if cred > 0 else None),
            _n(_fmt_gs(sp), bold=True, color=RED if sp > 0 else HexColor("#059669")),
            _c(m.get("estado", "")[:18], center=True),
            _checkbox_box(),
        ])

    if not movimientos:
        table_data.append([
            _c("Sin movimientos registrados en el período seleccionado"),
            _c(""), _c(""), _c(""), _c(""), _c(""), _c(""), _c(""), _c(""), _c("")
        ])

    # Fila de Totales Finales
    table_data.append([
        _c("<b>TOTALES</b>", bold=True, center=True),
        _c("", center=True),
        _c("", center=True),
        _c(f"<b>{len(movimientos)} Movimientos</b>", bold=True),
        _c("<b>Balance Consolidado del Proveedor</b>", bold=True),
        _n(_fmt_gs(tot_fac), bold=True),
        _n(f"-{_fmt_gs(tot_nc + tot_pago)}", bold=True, color=HexColor("#059669")),
        _n(_fmt_gs(saldo_exigible), bold=True, color=RED if saldo_exigible > 0 else HexColor("#059669")),
        _c("<b>SALDO FINAL</b>", bold=True, center=True),
        _c("", center=True),
    ])

    t_movs = Table(table_data, colWidths=col_w, repeatRows=1)
    
    # Estilo de tabla de movimientos
    ts = [
        ("BACKGROUND", (0, 0), (-1, 0), PRIMARY_COLOR),
        ("TEXTCOLOR", (0, 0), (-1, 0), WHITE),
        ("FONTNAME", (0, 0), (-1, 0), FONT_BOLD),
        ("FONTSIZE", (0, 0), (-1, 0), 6.8),
        ("ALIGN", (0, 0), (2, -1), "CENTER"),
        ("ALIGN", (5, 0), (7, -1), "RIGHT"),
        ("ALIGN", (8, 0), (9, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 2.2),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2.2),
        ("LEFTPADDING", (0, 0), (-1, -1), 3),
        ("RIGHTPADDING", (0, 0), (-1, -1), 3),
        ("GRID", (0, 0), (-1, -1), 0.35, HexColor("#CBD5E1")),
    ]

    # Alternancia de colores en filas de datos
    for r_idx in range(1, len(table_data) - 1):
        bg = WHITE if r_idx % 2 != 0 else HexColor("#F8FAFC")
        ts.append(("BACKGROUND", (0, r_idx), (-1, r_idx), bg))

    # Fila de Totales (última fila)
    ts.append(("BACKGROUND", (0, -1), (-1, -1), HexColor("#F1F5F9")))
    ts.append(("LINEABOVE", (0, -1), (-1, -1), 1.2, PRIMARY_COLOR))
    ts.append(("LINEBELOW", (0, -1), (-1, -1), 1.2, PRIMARY_COLOR))

    t_movs.setStyle(TableStyle(ts))
    elements.append(t_movs)
    elements.append(Spacer(1, 5 * mm))

    # 5. SECCIÓN DE CHEQUES DIFERIDOS EN TRÁNSITO (SI HUBIERE)
    if cheques:
        elements.append(Paragraph("<b>CHEQUES DIFERIDOS EMITIDOS EN TRÁNSITO (Valores Entregados al Proveedor Pendientes de Débito Bancario)</b>", TITLE_SEC))
        chq_table_data = [[
            Paragraph("<b>N° Cheque</b>", CELL_STYLE_CENTER_BOLD),
            Paragraph("<b>Banco Emisor</b>", CELL_STYLE_BOLD),
            Paragraph("<b>Fecha Emisión</b>", CELL_STYLE_CENTER_BOLD),
            Paragraph("<b>Fecha de Cobro</b>", CELL_STYLE_CENTER_BOLD),
            Paragraph("<b>Días Restantes</b>", CELL_STYLE_CENTER_BOLD),
            Paragraph("<b>Monto Cheque Gs.</b>", NUM_STYLE_BOLD),
            Paragraph("<b>Concepto Registrado</b>", CELL_STYLE_BOLD),
            Paragraph("<b>Estado</b>", CELL_STYLE_CENTER_BOLD),
            Paragraph("<b>Punteo [  ]</b>", CELL_STYLE_CENTER_BOLD),
        ]]
        for ch in cheques:
            d_rest = ch.get("dias_restantes", 0)
            d_txt = f"{d_rest} días" if d_rest >= 0 else f"Vencido ({-d_rest}d)"
            chq_table_data.append([
                _c(ch.get("numero"), bold=True, center=True),
                _c(ch.get("banco_emisor") or "Banco"),
                _c(ch.get("fecha_emision"), center=True),
                _c(ch.get("fecha_pago"), bold=True, center=True),
                _c(d_txt, color=RED if d_rest < 0 else HexColor("#D97706") if d_rest <= 7 else GRAY_DARK, center=True),
                _n(_fmt_gs(ch.get("monto")), bold=True),
                _c(ch.get("concepto")[:45]),
                _c(ch.get("estado", "PENDIENTE"), bold=True, center=True),
                _checkbox_box(),
            ])
        # Fila Total Cheques
        chq_table_data.append([
            _c("<b>TOTAL CHEQUES</b>", bold=True, center=True),
            _c("", center=True),
            _c("", center=True),
            _c("", center=True),
            _c(f"<b>{len(cheques)} Cheques</b>", bold=True, center=True),
            _n(_fmt_gs(chq_transito), bold=True, color=HexColor("#D97706")),
            _c("<b>Valores entregados en custodia del proveedor</b>", bold=True),
            _c("", center=True),
            _c("", center=True),
        ])
        t_chq = Table(chq_table_data, colWidths=[24 * mm, 38 * mm, 22 * mm, 24 * mm, 24 * mm, 34 * mm, 65 * mm, 24 * mm, 18 * mm])
        ts_c = [
            ("BACKGROUND", (0, 0), (-1, 0), HexColor("#334155")),
            ("TEXTCOLOR", (0, 0), (-1, 0), WHITE),
            ("FONTNAME", (0, 0), (-1, 0), FONT_BOLD),
            ("FONTSIZE", (0, 0), (-1, 0), 6.8),
            ("ALIGN", (0, 0), (0, -1), "CENTER"),
            ("ALIGN", (2, 0), (4, -1), "CENTER"),
            ("ALIGN", (5, 0), (5, -1), "RIGHT"),
            ("ALIGN", (7, 0), (8, -1), "CENTER"),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("TOPPADDING", (0, 0), (-1, -1), 2.2),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 2.2),
            ("LEFTPADDING", (0, 0), (-1, -1), 3),
            ("RIGHTPADDING", (0, 0), (-1, -1), 3),
            ("GRID", (0, 0), (-1, -1), 0.35, HexColor("#CBD5E1")),
            ("BACKGROUND", (0, -1), (-1, -1), HexColor("#F1F5F9")),
            ("LINEABOVE", (0, -1), (-1, -1), 1.0, HexColor("#334155")),
        ]
        t_chq.setStyle(TableStyle(ts_c))
        elements.append(t_chq)
        elements.append(Spacer(1, 6 * mm))

    # 6. BLOQUE DE FIRMAS Y CONFORMIDAD (Mantener junto)
    elements.append(KeepTogether([
        Spacer(1, 4 * mm),
        _render_firmas_bloque(),
        Spacer(1, 2 * mm),
        Paragraph("<font size=6 color='#94A3B8'>* Este extracto constituye una herramienta de cotejo de cuentas por pagar emitida por Extra Supermercado Mayorista. Las casillas [  ] permiten el tilde manual de conciliación factura por factura y pago por pago contra los registros contables del proveedor.</font>", ParagraphStyle("PieAviso", fontName=FONT_REGULAR, fontSize=6, leading=7.5, textColor=GRAY_MEDIUM, alignment=TA_CENTER))
    ]))

    doc.build(elements, canvasmaker=doc._audited_canvasmaker)
    pdf_bytes = buffer.getvalue()
    buffer.close()
    return pdf_bytes
