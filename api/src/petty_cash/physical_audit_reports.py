"""Generador de Hoja de Punteo y Verificación Física de Comprobantes.

Genera reportes en PDF institucional (Landscape) y Excel (.xlsx) con casillas de cotejo físico
agrupados por Sector / Centro de Costo y Categoría para que Auditoría y Custodios
puedan auditar físicamente cada comprobante en papel en mano.
"""
import io
import os
from datetime import date, datetime
from typing import Dict, Any, List
from zoneinfo import ZoneInfo
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.units import mm
from reportlab.lib.colors import HexColor
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import Paragraph, Spacer, Table, TableStyle, KeepTogether

from api.src.integrated_finance.pdf_reports import (
    _base_landscape_doc, _company_landscape_header, _build,
    PRIMARY_COLOR, WHITE, FONT_BOLD, FONT_REGULAR, GRAY_DARK, GRAY_MEDIUM, GRAY_LIGHT
)

TZ_ASUNCION = ZoneInfo("America/Asuncion")


def _fmt_pyg(val) -> str:
    """Formato canónico PYG según Regla 10: entero sin decimales y sin prefijo Gs."""
    if val is None:
        return "0"
    try:
        return f"{int(round(float(val))):,}".replace(",", ".")
    except (ValueError, TypeError):
        return str(val)


def generate_hoja_punteo_fisico_pdf(
    company: dict,
    data: dict,
    fecha_desde: date,
    fecha_hasta: date,
    generated_by: str = ""
) -> bytes:
    """Genera la Hoja de Punteo Físico en PDF apaisado con casillas [  ] y líneas de firma."""
    buffer = io.BytesIO()
    doc, styles = _base_landscape_doc(buffer, "Hoja de Punteo y Verificación Física", company, generated_by)
    USABLE_W = 273 * mm

    subtitulo = (
        f"Auditoría y Cotejo Físico de Comprobantes / Período: {fecha_desde.strftime('%d/%m/%Y')} al {fecha_hasta.strftime('%d/%m/%Y')} — "
        f"Impreso el {datetime.now(TZ_ASUNCION).strftime('%d/%m/%Y %H:%M')}"
    )
    elements = _company_landscape_header(
        company, styles, "HOJA DE PUNTEO Y VERIFICACIÓN FÍSICA DE COMPROBANTES Y GASTOS",
        subtitulo,
        generated_by,
    )

    gastos = data.get("gastos", [])
    total_periodo = data.get("total_periodo", sum(g.get("monto", 0) for g in gastos))

    # KPI Banner
    kpi_data = [
        [
            Paragraph("<font size=6 color='#64748B'><b>TOTAL A PUNTEAR</b></font><br/>"
                      f"<font size=10 color='#0F172A'><b>{_fmt_pyg(total_periodo)}</b></font><br/>"
                      f"<font size=5.8 color='#94A3B8'>{len(gastos)} comprobantes</font>", styles["Normal"]),
            Paragraph("<font size=6 color='#64748B'><b>OBJETIVO DE AUDITORÍA</b></font><br/>"
                      "<font size=9 color='#0F766E'><b>Verificación 100% Física</b></font><br/>"
                      "<font size=5.8 color='#94A3B8'>Cotejo papel vs sistema</font>", styles["Normal"]),
            Paragraph("<font size=6 color='#64748B'><b>METODOLOGÍA</b></font><br/>"
                      "<font size=9 color='#1E40AF'><b>Agrupado por Sector</b></font><br/>"
                      "<font size=5.8 color='#94A3B8'>Validación con custodio</font>", styles["Normal"]),
            Paragraph("<font size=6 color='#64748B'><b>ESTADO FINAL</b></font><br/>"
                      "<font size=9 color='#B45309'><b>Pendiente de Firma</b></font><br/>"
                      "<font size=5.8 color='#94A3B8'>Rendición a Tesorería</font>", styles["Normal"]),
        ]
    ]
    t_kpis = Table(kpi_data, colWidths=[68.25 * mm] * 4)
    t_kpis.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), HexColor("#F8FAFC")),
        ("BOX", (0, 0), (-1, -1), 0.5, HexColor("#CBD5E1")),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, HexColor("#E2E8F0")),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    elements.append(t_kpis)
    elements.append(Spacer(1, 8))

    # Agrupar gastos por Sector / Centro de Costo
    by_sector: Dict[str, List[dict]] = {}
    for g in gastos:
        sec = g.get("sector_nombre") or "GASTOS GENERALES SIN SECTOR"
        if sec not in by_sector:
            by_sector[sec] = []
        by_sector[sec].append(g)

    # Definir estilos de celda compactos
    style_th = ParagraphStyle('TH', fontName=FONT_BOLD, fontSize=7, leading=8.5, textColor=WHITE, alignment=1)
    style_td = ParagraphStyle('TD', fontName=FONT_REGULAR, fontSize=6.5, leading=8, textColor=GRAY_DARK)
    style_td_right = ParagraphStyle('TDR', fontName=FONT_BOLD, fontSize=6.5, leading=8, textColor=GRAY_DARK, alignment=2)
    style_td_center = ParagraphStyle('TDC', fontName=FONT_REGULAR, fontSize=6.5, leading=8, textColor=GRAY_DARK, alignment=1)
    style_check = ParagraphStyle('TDCk', fontName=FONT_BOLD, fontSize=8, leading=9, textColor=HexColor("#1E293B"), alignment=1)

    # Anchos de columna (Total = 273mm)
    col_w = [16 * mm, 24 * mm, 42 * mm, 70 * mm, 26 * mm, 24 * mm, 22 * mm, 49 * mm]

    table_rows = [
        [
            Paragraph("<b>FECHA</b>", style_th),
            Paragraph("<b>COMPROBANTE</b>", style_th),
            Paragraph("<b>PROVEEDOR</b>", style_th),
            Paragraph("<b>CONCEPTO / DETALLE</b>", style_th),
            Paragraph("<b>MEDIO / FONDO</b>", style_th),
            Paragraph("<b>MONTO</b>", style_th),
            Paragraph("<b>[ ✓ PUNTEO ]</b>", style_th),
            Paragraph("<b>OBSERVACIONES / FIRMA</b>", style_th),
        ]
    ]

    t_style_cmds = [
        ("BACKGROUND", (0, 0), (-1, 0), PRIMARY_COLOR),
        ("ALIGN", (0, 0), (-1, 0), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 2),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
        ("GRID", (0, 0), (-1, -1), 0.4, HexColor("#CBD5E1")),
    ]

    curr_row_idx = 1
    for sec_nombre, sec_gastos in by_sector.items():
        sec_subtotal = sum(float(x.get("monto", 0)) for x in sec_gastos)
        # Fila separadora de sector
        sec_label = f"<b>SECTOR: {sec_nombre.upper()} ({len(sec_gastos)} comprobantes — Subtotal: {_fmt_pyg(sec_subtotal)})</b>"
        table_rows.append([
            Paragraph(sec_label, ParagraphStyle('SecH', fontName=FONT_BOLD, fontSize=7, leading=8.5, textColor=HexColor("#0F172A"))),
            "", "", "", "", "", "", ""
        ])
        t_style_cmds.extend([
            ("SPAN", (0, curr_row_idx), (-1, curr_row_idx)),
            ("BACKGROUND", (0, curr_row_idx), (-1, curr_row_idx), HexColor("#E2E8F0")),
            ("TOPPADDING", (0, curr_row_idx), (-1, curr_row_idx), 3),
            ("BOTTOMPADDING", (0, curr_row_idx), (-1, curr_row_idx), 3),
        ])
        curr_row_idx += 1

        for g in sec_gastos:
            f_gasto = g.get("fecha_gasto")
            f_str = f_gasto.strftime("%d/%m") if isinstance(f_gasto, (date, datetime)) else str(f_gasto)[5:10]
            comp_str = (g.get("numero_factura") or "S/N")[:16]
            prov_str = (g.get("proveedor") or "PROVEEDOR")[:24]
            desc_str = (g.get("descripcion") or "")[:55]
            fondo_str = (g.get("fund_nombre") or g.get("tipo_pago") or "Efectivo")[:15]
            monto_val = g.get("monto", 0)

            table_rows.append([
                Paragraph(f_str, style_td_center),
                Paragraph(comp_str, style_td),
                Paragraph(prov_str, style_td),
                Paragraph(desc_str, style_td),
                Paragraph(fondo_str, style_td),
                Paragraph(_fmt_pyg(monto_val), style_td_right),
                Paragraph("<font size=9 color='#64748B'>[ &nbsp; &nbsp; ]</font>", style_check),
                Paragraph("<font size=5.5 color='#CBD5E1'>___________________________</font>", style_td_center),
            ])
            curr_row_idx += 1

    # Fila totalizadora
    table_rows.append([
        Paragraph("<b>TOTAL GENERAL AUDITADO</b>", ParagraphStyle('TotH', fontName=FONT_BOLD, fontSize=7.5, leading=9, textColor=HexColor("#1E3A8A"))),
        "", "", "", "",
        Paragraph(f"<b>{_fmt_pyg(total_periodo)}</b>", ParagraphStyle('TotM', fontName=FONT_BOLD, fontSize=7.5, leading=9, textColor=HexColor("#1E3A8A"), alignment=2)),
        Paragraph("<font size=7 color='#1E3A8A'><b>100% PUNTEADO</b></font>", style_check),
        Paragraph("<font size=6 color='#64748B'><b>CONFORME</b></font>", style_td_center),
    ])
    t_style_cmds.extend([
        ("SPAN", (0, curr_row_idx), (4, curr_row_idx)),
        ("BACKGROUND", (0, curr_row_idx), (-1, curr_row_idx), HexColor("#DCFCE7")),
        ("TOPPADDING", (0, curr_row_idx), (-1, curr_row_idx), 4),
        ("BOTTOMPADDING", (0, curr_row_idx), (-1, curr_row_idx), 4),
        ("LINEABOVE", (0, curr_row_idx), (-1, curr_row_idx), 1, HexColor("#1E3A8A")),
    ])

    t_punteo = Table(table_rows, colWidths=col_w, repeatRows=1)
    t_punteo.setStyle(TableStyle(t_style_cmds))
    elements.append(t_punteo)
    elements.append(Spacer(1, 12))

    # Cláusula y Firmas
    clausula = (
        "<b>CERTIFICACIÓN DE VERIFICACIÓN FÍSICA:</b> El auditor y el custodio certifican que cada uno de los comprobantes "
        "arriba listados ha sido verificado físicamente contra su respaldo en papel (factura legal / ticket / recibo), corroborando RUC, "
        "timbrado vigente, validez fiscal, correlación de fecha y monto exacto abonado por el sector."
    )
    elements.append(Paragraph(f"<font size=6.5 color='#475569'>{clausula}</font>", styles["Normal"]))
    elements.append(Spacer(1, 10))

    firmas = [
        ["", "", ""],
        [
            Paragraph("<font size=7.5 color='#0F172A'><b>CUSTODIO / RESPONSABLE DE SECTOR</b></font>", styles["Normal"]),
            Paragraph("<font size=7.5 color='#0F172A'><b>AUDITOR DE CONTROL INTERNO</b></font>", styles["Normal"]),
            Paragraph("<font size=7.5 color='#0F172A'><b>JEFATURA DE TESORERÍA</b></font>", styles["Normal"]),
        ],
        [
            Paragraph("<font size=6.2 color='#64748B'>Punteo y Comprobantes Entregados<br/>Firma: ___________________________<br/>Fecha: ____/____/________</font>", styles["Normal"]),
            Paragraph("<font size=6.2 color='#64748B'>Verificación y Cotejo Físico 100%<br/>Firma: ___________________________<br/>Fecha: ____/____/________</font>", styles["Normal"]),
            Paragraph("<font size=6.2 color='#64748B'>Aprobación y Rendición Aceptada<br/>Firma: ___________________________<br/>Fecha: ____/____/________</font>", styles["Normal"]),
        ],
    ]
    t_firmas = Table(
        firmas,
        colWidths=[85 * mm, 85 * mm, 85 * mm],
        rowHeights=[14 * mm, None, None],
    )
    t_firmas.setStyle(TableStyle([
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LINEABOVE", (0, 1), (0, 1), 0.75, HexColor("#94A3B8")),
        ("LINEABOVE", (1, 1), (1, 1), 0.75, HexColor("#94A3B8")),
        ("LINEABOVE", (2, 1), (2, 1), 0.75, HexColor("#94A3B8")),
    ]))
    elements.append(KeepTogether(t_firmas))

    _build(doc, elements)
    return buffer.getvalue()


def generate_hoja_punteo_fisico_excel(
    company: dict,
    data: dict,
    fecha_desde: date,
    fecha_hasta: date,
    generated_by: str = ""
) -> bytes:
    """Genera el libro Excel de Hoja de Punteo Físico con filtros, columnas de cotejo y fórmulas."""
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Hoja de Punteo Físico"
    ws.views.sheetView[0].showGridLines = True

    # Estilos
    NAVY_FILL = PatternFill(start_color="1E293B", end_color="1E293B", fill_type="solid")
    SUBNAVY_FILL = PatternFill(start_color="334155", end_color="334155", fill_type="solid")
    SEC_FILL = PatternFill(start_color="E2E8F0", end_color="E2E8F0", fill_type="solid")
    TOTAL_FILL = PatternFill(start_color="DCFCE7", end_color="DCFCE7", fill_type="solid")

    WHITE_BOLD = Font(name="Calibri", size=10, bold=True, color="FFFFFF")
    TITLE_FONT = Font(name="Calibri", size=13, bold=True, color="1E293B")
    SUBTITLE_FONT = Font(name="Calibri", size=9, italic=True, color="64748B")
    SEC_FONT = Font(name="Calibri", size=10, bold=True, color="0F172A")
    REGULAR_FONT = Font(name="Calibri", size=9, color="1E293B")
    BOLD_FONT = Font(name="Calibri", size=9, bold=True, color="0F172A")
    TOTAL_FONT = Font(name="Calibri", size=10, bold=True, color="1E3A8A")

    THIN_BORDER = Border(
        left=Side(style="thin", color="CBD5E1"),
        right=Side(style="thin", color="CBD5E1"),
        top=Side(style="thin", color="CBD5E1"),
        bottom=Side(style="thin", color="CBD5E1")
    )
    DOUBLE_BOTTOM_BORDER = Border(
        left=Side(style="thin", color="CBD5E1"),
        right=Side(style="thin", color="CBD5E1"),
        top=Side(style="thin", color="CBD5E1"),
        bottom=Side(style="double", color="1E293B")
    )

    CURRENCY_FORMAT = '#,##0'

    # Encabezado institucional
    ws.merge_cells("A1:K1")
    ws["A1"] = f"{company.get('name', 'GRUPO SANTA TERESA E.A.S.')} — Extra Supermercado Mayorista"
    ws["A1"].font = TITLE_FONT

    ws.merge_cells("A2:K2")
    ws["A2"] = (
        f"RUC: {company.get('ruc', '80150377-9')} | HOJA DE PUNTEO Y VERIFICACIÓN FÍSICA DE COMPROBANTES — "
        f"Del {fecha_desde.strftime('%d/%m/%Y')} al {fecha_hasta.strftime('%d/%m/%Y')}"
    )
    ws["A2"].font = SUBTITLE_FONT

    headers = [
        ("FECHA", 12),
        ("SECTOR / CENTRO DE COSTO", 25),
        ("COMPROBANTE", 18),
        ("PROVEEDOR", 32),
        ("RUC", 15),
        ("CONCEPTO / DETALLE", 40),
        ("CATEGORÍA CONTABLE", 22),
        ("MEDIO / FONDO", 18),
        ("MONTO", 18),
        ("PUNTEO FÍSICO [✓]", 16),
        ("OBSERVACIONES / FIRMA", 30),
    ]

    for col_idx, (h, w) in enumerate(headers, start=1):
        cell = ws.cell(row=4, column=col_idx, value=h)
        cell.font = WHITE_BOLD
        cell.fill = NAVY_FILL
        cell.alignment = Alignment(horizontal="center", vertical="center")
        cell.border = THIN_BORDER
        ws.column_dimensions[get_column_letter(col_idx)].width = w

    ws.row_dimensions[4].height = 24

    gastos = data.get("gastos", [])
    row_idx = 5

    for g in gastos:
        f_gasto = g.get("fecha_gasto")
        f_str = f_gasto.strftime("%d/%m/%Y") if isinstance(f_gasto, (date, datetime)) else str(f_gasto)

        row_vals = [
            f_str,
            g.get("sector_nombre") or "General",
            g.get("numero_factura") or "S/N",
            g.get("proveedor") or "PROVEEDOR",
            g.get("ruc") or "",
            g.get("descripcion") or "",
            g.get("categoria_nombre") or "Gasto Operativo",
            g.get("fund_nombre") or g.get("tipo_pago") or "Fondo Fijo",
            float(g.get("monto", 0)),
            "[   ]",
            ""
        ]

        for col_idx, val in enumerate(row_vals, start=1):
            cell = ws.cell(row=row_idx, column=col_idx, value=val)
            cell.font = REGULAR_FONT
            cell.border = THIN_BORDER

            if col_idx == 9:
                cell.number_format = CURRENCY_FORMAT
                cell.alignment = Alignment(horizontal="right")
            elif col_idx in [1, 5, 8, 10]:
                cell.alignment = Alignment(horizontal="center")
            else:
                cell.alignment = Alignment(horizontal="left")

        row_idx += 1

    # Fila totalizadora
    ws.merge_cells(f"A{row_idx}:H{row_idx}")
    ws.cell(row=row_idx, column=1, value="TOTAL GENERAL COMPROBANTES AUDITADOS").font = TOTAL_FONT
    tot_cell = ws.cell(row=row_idx, column=9, value=f"=SUM(I5:I{row_idx-1})")
    tot_cell.number_format = CURRENCY_FORMAT
    tot_cell.font = TOTAL_FONT
    tot_cell.alignment = Alignment(horizontal="right")
    ws.cell(row=row_idx, column=10, value="100% COTEJADO").font = TOTAL_FONT
    ws.cell(row=row_idx, column=10).alignment = Alignment(horizontal="center")
    ws.cell(row=row_idx, column=11, value="").font = TOTAL_FONT

    for col_idx in range(1, 12):
        c = ws.cell(row=row_idx, column=col_idx)
        c.fill = TOTAL_FILL
        c.border = DOUBLE_BOTTOM_BORDER

    ws.row_dimensions[row_idx].height = 22

    # Auto-filter
    ws.auto_filter.ref = f"A4:K{row_idx}"

    out = io.BytesIO()
    wb.save(out)
    return out.getvalue()
