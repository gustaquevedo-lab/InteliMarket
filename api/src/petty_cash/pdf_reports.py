"""Reportes PDF de Fondos Fijos (Cajas Chicas) y Gastos por Sector — Extra Supermercado.
Implementa el formato ejecutivo institucional para:
1. Informe Consolidado de Gastos por Sector y Centro de Costos.
2. Estado Consolidado y Monitoreo de Fondos Fijos por Sector (Liquidez, Custodias y Arqueos).
3. Libro Fiscal de Compras Menores y Comprobantes (IVA 10%, 5%, Exentas DNIT/SET).
4. Acta Oficial de Rendición de Gastos y Solicitud de Reposición con doble firma vinculante.
"""
from __future__ import annotations
import io
from datetime import date, datetime, timezone
from zoneinfo import ZoneInfo

TZ_ASUNCION = ZoneInfo("America/Asuncion")

def _to_asuncion_tz(dt: datetime | None) -> datetime | None:
    if not dt:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(TZ_ASUNCION)

from reportlab.lib.units import mm
from reportlab.lib.colors import HexColor
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import Paragraph, Spacer, Table, TableStyle, KeepTogether

from api.src.integrated_finance.pdf_reports import (
    _base_doc, _base_landscape_doc, _company_header, _company_landscape_header,
    _fmt_gs, _build,
    RED, GRAY_LIGHT, PRIMARY_COLOR, WHITE, FONT_BOLD, FONT_REGULAR,
    GRAY_DARK, GRAY_MEDIUM,
)


def _fmt_val(v) -> str:
    if v is None or float(v or 0) == 0:
        return "—"
    return f"{int(round(float(v))):,}".replace(",", ".")


# ─────────────────────────────────────────────────────────────────────────────
# 1. INFORME DE GASTOS POR SECTOR Y CENTRO DE COSTOS (Portrait)
# ─────────────────────────────────────────────────────────────────────────────
def generate_gastos_por_sector_pdf(
    company: dict,
    data: dict,
    fecha_desde: date,
    fecha_hasta: date,
    generated_by: str = "",
) -> bytes:
    buffer = io.BytesIO()
    doc, styles = _base_doc(buffer, "Gastos por Sector", company, generated_by)
    USABLE_W = 186 * mm

    subtitulo = f"Período: Del {fecha_desde.strftime('%d/%m/%Y')} al {fecha_hasta.strftime('%d/%m/%Y')}"
    elements = _company_header(
        company, styles, "CONSOLIDADO DE GASTOS POR SECTOR Y CENTRO DE COSTO",
        subtitulo,
        generated_by,
    )

    sectores = data.get("por_sector", [])
    total_periodo = data.get("total_periodo", 0)
    total_directo = sum(s.get("directo", 0) for s in sectores)
    total_prorrateado = sum(s.get("prorrateado", 0) for s in sectores)
    sin_asignar = data.get("sin_asignar", 0)
    total_gastos = data.get("total_gastos_count", sum(len(s.get("gastos", [])) for s in sectores))

    # KPI Cards (4 columnas en 186mm = 46.5mm c/u)
    kpi_data = [
        [
            Paragraph("<font size=6 color='#64748B'><b>TOTAL GASTOS PERÍODO</b></font><br/>"
                      f"<font size=10 color='#0F172A'><b>{_fmt_gs(total_periodo)}</b></font><br/>"
                      f"<font size=5.8 color='#94A3B8'>{total_gastos} comprobantes</font>", styles["Normal"]),
            Paragraph("<font size=6 color='#64748B'><b>IMPUTACIÓN DIRECTA</b></font><br/>"
                      f"<font size=10 color='#1E40AF'><b>{_fmt_gs(total_directo)}</b></font><br/>"
                      "<font size=5.8 color='#94A3B8'>Directo por sector</font>", styles["Normal"]),
            Paragraph("<font size=6 color='#64748B'><b>PRORRATEO GLOBAL</b></font><br/>"
                      f"<font size=10 color='#059669'><b>{_fmt_gs(total_prorrateado)}</b></font><br/>"
                      "<font size=5.8 color='#94A3B8'>Gastos transversales</font>", styles["Normal"]),
            Paragraph("<font size=6 color='#64748B'><b>SIN ASIGNAR / REVISIÓN</b></font><br/>"
                      f"<font size=10 color='{'#DC2626' if sin_asignar > 0 else '#64748B'}'><b>{_fmt_gs(sin_asignar)}</b></font><br/>"
                      f"<font size=5.8 color='{'#DC2626' if sin_asignar > 0 else '#94A3B8'}'>{'Atención requerida' if sin_asignar > 0 else '100% imputado'}</font>", styles["Normal"]),
        ]
    ]
    t_kpis = Table(kpi_data, colWidths=[46.5 * mm] * 4)
    t_kpis.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), HexColor("#F8FAFC")),
        ("BOX", (0, 0), (-1, -1), 0.5, HexColor("#E2E8F0")),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, HexColor("#E2E8F0")),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    elements.append(t_kpis)
    elements.append(Spacer(1, 10))

    # Resumen Consolidado por Sector
    elements.append(Paragraph("<b>1. RESUMEN DE GASTOS POR SECTOR / ÁREA OPERATIVA</b>", styles["Normal"]))
    elements.append(Spacer(1, 4))

    table_data = [
        ["Sector / Centro de Costo", "Gasto Directo (Gs.)", "Prorrateo Global", "Total Consolidado", "Part. %"]
    ]
    for s in sectores:
        tot = s.get("total", 0)
        pct = (tot / total_periodo * 100) if total_periodo > 0 else 0
        table_data.append([
            s.get("nombre", "Sin sector"),
            _fmt_val(s.get("directo", 0)),
            _fmt_val(s.get("prorrateado", 0)),
            _fmt_val(tot),
            f"{pct:.1f}%",
        ])

    if sin_asignar > 0:
        pct_sin = (sin_asignar / total_periodo * 100) if total_periodo > 0 else 0
        table_data.append([
            "Sin Sector Asignado (A regularizar)",
            _fmt_val(sin_asignar),
            "—",
            _fmt_val(sin_asignar),
            f"{pct_sin:.1f}%",
        ])

    table_data.append([
        "TOTAL CONSOLIDADO GENERAL",
        _fmt_val(total_directo + (sin_asignar if sin_asignar > 0 else 0)),
        _fmt_val(total_prorrateado),
        _fmt_val(total_periodo),
        "100.0%",
    ])

    t_resumen = Table(table_data, colWidths=[66 * mm, 30 * mm, 30 * mm, 38 * mm, 22 * mm])
    t_resumen.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), PRIMARY_COLOR),
        ("TEXTCOLOR", (0, 0), (-1, 0), WHITE),
        ("FONTNAME", (0, 0), (-1, 0), FONT_BOLD),
        ("FONTSIZE", (0, 0), (-1, -1), 7.5),
        ("ALIGN", (0, 0), (0, -1), "LEFT"),
        ("ALIGN", (1, 0), (-1, -1), "RIGHT"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("LINEBELOW", (0, 0), (-1, -1), 0.5, HexColor("#E2E8F0")),
        ("BACKGROUND", (0, -1), (-1, -1), HexColor("#F1F5F9")),
        ("FONTNAME", (0, -1), (-1, -1), FONT_BOLD),
        ("LINEABOVE", (0, -1), (-1, -1), 1.0, PRIMARY_COLOR),
    ]))
    elements.append(t_resumen)
    elements.append(Spacer(1, 10))

    # Detalle de Comprobantes Recientes / Principales
    gastos_detalle = data.get("detalle_gastos", [])
    if gastos_detalle:
        elements.append(Paragraph("<b>2. DETALLE DE COMPROBANTES REGISTRADOS POR SECTOR</b>", styles["Normal"]))
        elements.append(Spacer(1, 4))

        det_data = [
            ["Fecha", "Sector", "Concepto / Descripción", "Proveedor", "Fondo Fijo", "Importe (Gs.)"]
        ]
        for g in gastos_detalle[:80]:  # Limit top items for clean printable paging
            fg = g.get("fecha_gasto")
            f_str = fg.strftime("%d/%m/%Y") if isinstance(fg, date) else str(fg or "—")
            det_data.append([
                f_str,
                (g.get("sector_nombre") or "Sin sector")[:18],
                Paragraph(f"<font size=6.5>{(g.get('descripcion') or '')[:55]}</font>", styles["Normal"]),
                (g.get("proveedor") or "Varios")[:20],
                (g.get("fund_nombre") or "Caja Chica")[:18],
                _fmt_val(g.get("monto", 0)),
            ])

        t_det = Table(det_data, colWidths=[20 * mm, 32 * mm, 56 * mm, 32 * mm, 24 * mm, 22 * mm])
        t_det.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), HexColor("#334155")),
            ("TEXTCOLOR", (0, 0), (-1, 0), WHITE),
            ("FONTNAME", (0, 0), (-1, 0), FONT_BOLD),
            ("FONTSIZE", (0, 0), (-1, -1), 6.5),
            ("ALIGN", (0, 0), (1, -1), "LEFT"),
            ("ALIGN", (5, 0), (5, -1), "RIGHT"),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("TOPPADDING", (0, 0), (-1, -1), 2.5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 2.5),
            ("LINEBELOW", (0, 0), (-1, -1), 0.5, HexColor("#E2E8F0")),
        ]))
        elements.append(t_det)
        elements.append(Spacer(1, 14))

    # Triple Firma Institucional
    firmas = [
        ["", "", ""],
        [
            Paragraph("<font size=7 color='#0F172A'><b>CUSTODIO / RESPONSABLE SECTOR</b></font>", styles["Normal"]),
            Paragraph("<font size=7 color='#0F172A'><b>CONTABILIDAD Y COSTOS</b></font>", styles["Normal"]),
            Paragraph("<font size=7 color='#0F172A'><b>GERENCIA GENERAL / TESORERÍA</b></font>", styles["Normal"]),
        ],
        [
            Paragraph("<font size=6 color='#64748B'>Rendición y Justificación de Gastos<br/>Firma y Sello</font>", styles["Normal"]),
            Paragraph("<font size=6 color='#64748B'>Imputación Contable e Impuestos<br/>Firma y Sello</font>", styles["Normal"]),
            Paragraph("<font size=6 color='#64748B'>Visto Bueno y Aprobación de Fondos<br/>Firma y Sello</font>", styles["Normal"]),
        ],
    ]
    t_firmas = Table(
        [
            [firmas[0][0], "", firmas[0][1], "", firmas[0][2]],
            [firmas[1][0], "", firmas[1][1], "", firmas[1][2]],
            [firmas[2][0], "", firmas[2][1], "", firmas[2][2]],
        ],
        colWidths=[55 * mm, 10.5 * mm, 55 * mm, 10.5 * mm, 55 * mm],
        rowHeights=[14 * mm, None, None],
    )
    t_firmas.setStyle(TableStyle([
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LINEABOVE", (0, 1), (0, 1), 0.75, HexColor("#94A3B8")),
        ("LINEABOVE", (2, 1), (2, 1), 0.75, HexColor("#94A3B8")),
        ("LINEABOVE", (4, 1), (4, 1), 0.75, HexColor("#94A3B8")),
    ]))
    elements.append(KeepTogether(t_firmas))

    _build(doc, elements)
    return buffer.getvalue()


# ─────────────────────────────────────────────────────────────────────────────
# 2. ESTADO Y MONITOREO DE FONDOS FIJOS POR SECTOR (Landscape)
# ─────────────────────────────────────────────────────────────────────────────
def generate_libro_fondos_fijos_pdf(
    company: dict,
    funds: list[dict],
    generated_by: str = "",
) -> bytes:
    buffer = io.BytesIO()
    doc, styles = _base_landscape_doc(buffer, "Libro de Fondos Fijos", company, generated_by)
    USABLE_W = 273 * mm

    subtitulo = f"Corte de Control y Arqueo al {datetime.now(TZ_ASUNCION).strftime('%d/%m/%Y %H:%M:%S')}"
    elements = _company_landscape_header(
        company, styles, "ESTADO CONSOLIDADO Y MONITOREO DE FONDOS FIJOS POR SECTOR",
        subtitulo,
        generated_by,
    )

    total_aut = sum(f.get("monto_autorizado", 0) for f in funds)
    total_saldo = sum(f.get("saldo_actual", 0) for f in funds)
    total_gastado = total_aut - total_saldo
    pct_disp_global = (total_saldo / total_aut * 100) if total_aut > 0 else 0
    fondos_criticos = sum(1 for f in funds if (f.get("saldo_actual", 0) / f.get("monto_autorizado", 1) * 100) < 20)

    # 4 KPI cards (68.25mm c/u = 273mm)
    kpi_data = [
        [
            Paragraph("<font size=6 color='#64748B'><b>TOTAL FONDOS AUTORIZADOS</b></font><br/>"
                      f"<font size=10.5 color='#0F172A'><b>{_fmt_gs(total_aut)}</b></font><br/>"
                      f"<font size=5.8 color='#94A3B8'>{len(funds)} fondos operativos</font>", styles["Normal"]),
            Paragraph("<font size=6 color='#64748B'><b>EFECTIVO DISPONIBLE EN GAVETA</b></font><br/>"
                      f"<font size=10.5 color='#059669'><b>{_fmt_gs(total_saldo)}</b></font><br/>"
                      f"<font size=5.8 color='#059669'><b>{pct_disp_global:.1f}% liquidez total</b></font>", styles["Normal"]),
            Paragraph("<font size=6 color='#64748B'><b>GASTADO / POR RENDIR</b></font><br/>"
                      f"<font size=10.5 color='#1E40AF'><b>{_fmt_gs(total_gastado)}</b></font><br/>"
                      "<font size=5.8 color='#94A3B8'>Comprobantes en custodia</font>", styles["Normal"]),
            Paragraph("<font size=6 color='#64748B'><b>ALERTAS DE REPOSICIÓN</b></font><br/>"
                      f"<font size=10.5 color='{'#DC2626' if fondos_criticos > 0 else '#059669'}'><b>{fondos_criticos} Crítico(s)</b></font><br/>"
                      f"<font size=5.8 color='{'#DC2626' if fondos_criticos > 0 else '#94A3B8'}'>{'Saldo menor al 20%' if fondos_criticos > 0 else 'Todos con saldo óptimo'}</font>", styles["Normal"]),
        ]
    ]
    t_kpis = Table(kpi_data, colWidths=[68.25 * mm] * 4)
    t_kpis.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), HexColor("#F8FAFC")),
        ("BOX", (0, 0), (-1, -1), 0.5, HexColor("#E2E8F0")),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, HexColor("#E2E8F0")),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    elements.append(t_kpis)
    elements.append(Spacer(1, 10))

    # Tabla Panorámica
    headers = [
        "Fondo Fijo / Denominación",
        "Custodio Responsable",
        "Sucursal / Ubicación",
        "Monto Autorizado",
        "Saldo en Gaveta",
        "Gastado / A Reponer",
        "Liquidez %",
        "Estado Operativo",
    ]
    table_rows = [headers]

    for f in funds:
        aut = f.get("monto_autorizado", 0)
        sal = f.get("saldo_actual", 0)
        gast = aut - sal
        pct = (sal / aut * 100) if aut > 0 else 0
        
        if not f.get("activo", True):
            estado_desc = "INACTIVO"
        elif pct < 20:
            estado_desc = "CRÍTICO (REPONER)"
        elif pct < 40:
            estado_desc = "PREVENTIVO"
        else:
            estado_desc = "NORMAL (ÓPTIMO)"

        table_rows.append([
            f.get("nombre", "Sin nombre"),
            f.get("custodio_nombre") or "Sin asignar",
            f.get("branch_nombre") or "Casa Central",
            _fmt_val(aut),
            _fmt_val(sal),
            _fmt_val(gast),
            f"{pct:.1f}%",
            estado_desc,
        ])

    table_rows.append([
        "TOTAL CONSOLIDADO",
        "",
        "",
        _fmt_val(total_aut),
        _fmt_val(total_saldo),
        _fmt_val(total_gastado),
        f"{pct_disp_global:.1f}%",
        f"{len(funds)} Fondos",
    ])

    col_widths = [55 * mm, 45 * mm, 38 * mm, 30 * mm, 30 * mm, 30 * mm, 20 * mm, 25 * mm]
    t_table = Table(table_rows, colWidths=col_widths)
    t_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), PRIMARY_COLOR),
        ("TEXTCOLOR", (0, 0), (-1, 0), WHITE),
        ("FONTNAME", (0, 0), (-1, 0), FONT_BOLD),
        ("FONTSIZE", (0, 0), (-1, -1), 7),
        ("ALIGN", (0, 0), (2, -1), "LEFT"),
        ("ALIGN", (3, 0), (6, -1), "RIGHT"),
        ("ALIGN", (7, 0), (7, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("LINEBELOW", (0, 0), (-1, -1), 0.5, HexColor("#E2E8F0")),
        ("BACKGROUND", (0, -1), (-1, -1), HexColor("#F1F5F9")),
        ("FONTNAME", (0, -1), (-1, -1), FONT_BOLD),
        ("LINEABOVE", (0, -1), (-1, -1), 1.0, PRIMARY_COLOR),
    ]))
    elements.append(t_table)
    elements.append(Spacer(1, 14))

    # Firmas en Landscape (3 bloques de 82mm en 273mm)
    firmas = [
        ["", "", ""],
        [
            Paragraph("<font size=7.5 color='#0F172A'><b>CUSTODIO GENERAL DE FONDOS</b></font>", styles["Normal"]),
            Paragraph("<font size=7.5 color='#0F172A'><b>TESORERÍA Y CONTROL DE CAJAS</b></font>", styles["Normal"]),
            Paragraph("<font size=7.5 color='#0F172A'><b>AUDITORÍA INTERNA / GERENCIA</b></font>", styles["Normal"]),
        ],
        [
            Paragraph("<font size=6.5 color='#64748B'>Arqueo y Verificación de Gavetas Físicas<br/>Fecha: ____/____/________</font>", styles["Normal"]),
            Paragraph("<font size=6.5 color='#64748B'>Certificación de Saldos y Reposiciones<br/>Fecha: ____/____/________</font>", styles["Normal"]),
            Paragraph("<font size=6.5 color='#64748B'>Conformidad de Arqueo Sorpresivo<br/>Fecha: ____/____/________</font>", styles["Normal"]),
        ],
    ]
    t_firmas = Table(
        [
            [firmas[0][0], "", firmas[0][1], "", firmas[0][2]],
            [firmas[1][0], "", firmas[1][1], "", firmas[1][2]],
            [firmas[2][0], "", firmas[2][1], "", firmas[2][2]],
        ],
        colWidths=[82 * mm, 13.5 * mm, 82 * mm, 13.5 * mm, 82 * mm],
        rowHeights=[14 * mm, None, None],
    )
    t_firmas.setStyle(TableStyle([
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LINEABOVE", (0, 1), (0, 1), 0.75, HexColor("#94A3B8")),
        ("LINEABOVE", (2, 1), (2, 1), 0.75, HexColor("#94A3B8")),
        ("LINEABOVE", (4, 1), (4, 1), 0.75, HexColor("#94A3B8")),
    ]))
    elements.append(KeepTogether(t_firmas))

    _build(doc, elements)
    return buffer.getvalue()


# ─────────────────────────────────────────────────────────────────────────────
# 3. LIBRO FISCAL DE COMPRAS MENORES Y COMPROBANTES IVA (Landscape)
# ─────────────────────────────────────────────────────────────────────────────
def generate_libro_compras_fiscal_pdf(
    company: dict,
    data: dict,
    fecha_desde: date,
    fecha_hasta: date,
    generated_by: str = "",
) -> bytes:
    buffer = io.BytesIO()
    doc, styles = _base_landscape_doc(buffer, "Libro de Compras Fiscales", company, generated_by)
    USABLE_W = 273 * mm

    subtitulo = f"Régimen Fondo Fijo / Período: {fecha_desde.strftime('%d/%m/%Y')} al {fecha_hasta.strftime('%d/%m/%Y')} — DNIT / SET"
    elements = _company_landscape_header(
        company, styles, "LIBRO FISCAL DE COMPRAS MENORES Y CRÉDITO FISCAL IVA",
        subtitulo,
        generated_by,
    )

    items = data.get("items", [])
    tot_general = data.get("total_general", sum(it.get("total", 0) for it in items))
    tot_iva10 = data.get("total_iva_10", sum(it.get("iva_10", 0) for it in items))
    tot_grav10 = data.get("total_gravada_10", sum(it.get("gravada_10", 0) for it in items))
    tot_iva5 = data.get("total_iva_5", sum(it.get("iva_5", 0) for it in items))
    tot_exentas = data.get("total_exentas", sum(it.get("exentas", 0) for it in items))

    # 4 KPI cards (68.25mm c/u = 273mm)
    kpi_data = [
        [
            Paragraph("<font size=6 color='#64748B'><b>TOTAL COMPRAS Y GASTOS</b></font><br/>"
                      f"<font size=10.5 color='#0F172A'><b>{_fmt_gs(tot_general)}</b></font><br/>"
                      f"<font size=5.8 color='#94A3B8'>{len(items)} comprobantes auditados</font>", styles["Normal"]),
            Paragraph("<font size=6 color='#64748B'><b>CRÉDITO FISCAL IVA 10%</b></font><br/>"
                      f"<font size=10.5 color='#059669'><b>{_fmt_gs(tot_iva10)}</b></font><br/>"
                      f"<font size=5.8 color='#94A3B8'>Base gravada: {_fmt_gs(tot_grav10)}</font>", styles["Normal"]),
            Paragraph("<font size=6 color='#64748B'><b>CRÉDITO FISCAL IVA 5%</b></font><br/>"
                      f"<font size=10.5 color='#1E40AF'><b>{_fmt_gs(tot_iva5)}</b></font><br/>"
                      "<font size=5.8 color='#94A3B8'>Canasta básica / agro</font>", styles["Normal"]),
            Paragraph("<font size=6 color='#64748B'><b>EXENTAS / NO GRAVADAS</b></font><br/>"
                      f"<font size=10.5 color='#64748B'><b>{_fmt_gs(tot_exentas)}</b></font><br/>"
                      "<font size=5.8 color='#94A3B8'>Tasas, combustible, etc.</font>", styles["Normal"]),
        ]
    ]
    t_kpis = Table(kpi_data, colWidths=[68.25 * mm] * 4)
    t_kpis.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), HexColor("#F8FAFC")),
        ("BOX", (0, 0), (-1, -1), 0.5, HexColor("#E2E8F0")),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, HexColor("#E2E8F0")),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    elements.append(t_kpis)
    elements.append(Spacer(1, 10))

    headers = [
        "Fecha",
        "RUC Proveedor",
        "Razón Social / Proveedor",
        "N° Factura / Doc",
        "Timbrado",
        "Sector Imputado",
        "Grav. 10%",
        "IVA 10%",
        "Exentas",
        "Total (Gs.)",
    ]
    table_rows = [headers]

    for it in items:
        f_val = it.get("fecha")
        f_str = f_val.strftime("%d/%m/%Y") if isinstance(f_val, date) else str(f_val or "—")
        table_rows.append([
            f_str,
            it.get("ruc") or "—",
            (it.get("proveedor") or "Varios")[:24],
            it.get("numero_factura") or it.get("comprobante_nro") or "S/N",
            it.get("timbrado") or "—",
            (it.get("sector") or "General")[:16],
            _fmt_val(it.get("gravada_10", 0)),
            _fmt_val(it.get("iva_10", 0)),
            _fmt_val(it.get("exentas", 0)),
            _fmt_val(it.get("total", 0)),
        ])

    table_rows.append([
        "TOTALES",
        "",
        "",
        "",
        "",
        "",
        _fmt_val(tot_grav10),
        _fmt_val(tot_iva10),
        _fmt_val(tot_exentas),
        _fmt_val(tot_general),
    ])

    col_widths = [18 * mm, 24 * mm, 48 * mm, 32 * mm, 22 * mm, 35 * mm, 24 * mm, 22 * mm, 22 * mm, 26 * mm]
    t_table = Table(table_rows, colWidths=col_widths)
    t_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), PRIMARY_COLOR),
        ("TEXTCOLOR", (0, 0), (-1, 0), WHITE),
        ("FONTNAME", (0, 0), (-1, 0), FONT_BOLD),
        ("FONTSIZE", (0, 0), (-1, -1), 6.5),
        ("ALIGN", (0, 0), (5, -1), "LEFT"),
        ("ALIGN", (6, 0), (-1, -1), "RIGHT"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 2.5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2.5),
        ("LINEBELOW", (0, 0), (-1, -1), 0.5, HexColor("#E2E8F0")),
        ("BACKGROUND", (0, -1), (-1, -1), HexColor("#F1F5F9")),
        ("FONTNAME", (0, -1), (-1, -1), FONT_BOLD),
        ("LINEABOVE", (0, -1), (-1, -1), 1.0, PRIMARY_COLOR),
    ]))
    elements.append(t_table)
    elements.append(Spacer(1, 14))

    # Triple Firma Institucional
    firmas = [
        ["", "", ""],
        [
            Paragraph("<font size=7.5 color='#0F172A'><b>RESPONSABLE DE RENDICIÓN</b></font>", styles["Normal"]),
            Paragraph("<font size=7.5 color='#0F172A'><b>CONTABILIDAD / ASESORÍA FISCAL</b></font>", styles["Normal"]),
            Paragraph("<font size=7.5 color='#0F172A'><b>TESORERÍA GENERAL</b></font>", styles["Normal"]),
        ],
        [
            Paragraph("<font size=6.5 color='#64748B'>Custodio / Portador de Comprobantes<br/>Firma y Aclaración</font>", styles["Normal"]),
            Paragraph("<font size=6.5 color='#64748B'>Validación de Timbrado y RUC en DNIT<br/>Firma y Sello</font>", styles["Normal"]),
            Paragraph("<font size=6.5 color='#64748B'>Ingreso a Libro Compras e Imputación<br/>Firma y Sello</font>", styles["Normal"]),
        ],
    ]
    t_firmas = Table(
        [
            [firmas[0][0], "", firmas[0][1], "", firmas[0][2]],
            [firmas[1][0], "", firmas[1][1], "", firmas[1][2]],
            [firmas[2][0], "", firmas[2][1], "", firmas[2][2]],
        ],
        colWidths=[82 * mm, 13.5 * mm, 82 * mm, 13.5 * mm, 82 * mm],
        rowHeights=[14 * mm, None, None],
    )
    t_firmas.setStyle(TableStyle([
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LINEABOVE", (0, 1), (0, 1), 0.75, HexColor("#94A3B8")),
        ("LINEABOVE", (2, 1), (2, 1), 0.75, HexColor("#94A3B8")),
        ("LINEABOVE", (4, 1), (4, 1), 0.75, HexColor("#94A3B8")),
    ]))
    elements.append(KeepTogether(t_firmas))

    _build(doc, elements)
    return buffer.getvalue()


# ─────────────────────────────────────────────────────────────────────────────
# 4. ACTA DE RENDICIÓN DE GASTOS Y SOLICITUD DE REPOSICIÓN (Portrait)
# ─────────────────────────────────────────────────────────────────────────────
def generate_rendicion_fondo_fijo_pdf(
    company: dict,
    fund: dict,
    expenses: list[dict],
    generated_by: str = "",
) -> bytes:
    buffer = io.BytesIO()
    doc, styles = _base_doc(buffer, "Rendición de Fondo Fijo", company, generated_by)
    USABLE_W = 186 * mm

    now_local = datetime.now(TZ_ASUNCION)
    subtitulo = f"Fondo: {fund.get('nombre', 'Fondo Fijo')} — Custodio: {fund.get('custodio_nombre', 'Sin asignar')} — Fecha: {now_local.strftime('%d/%m/%Y %H:%M')}"
    elements = _company_header(
        company, styles, "ACTA DE RENDICIÓN DE GASTOS Y SOLICITUD DE REPOSICIÓN",
        subtitulo,
        generated_by,
    )

    monto_autorizado = fund.get("monto_autorizado", 0)
    saldo_actual = fund.get("saldo_actual", 0)
    total_gastos = sum(e.get("monto", 0) for e in expenses)
    monto_a_reponer = total_gastos

    # Recuadro Superior de Conciliación
    resumen_box = [
        [
            Paragraph("<font size=6 color='#64748B'><b>FONDO AUTORIZADO</b></font><br/>"
                      f"<font size=10 color='#0F172A'><b>{_fmt_gs(monto_autorizado)}</b></font>", styles["Normal"]),
            Paragraph("<font size=6 color='#64748B'><b>EFECTIVO EN GAVETA</b></font><br/>"
                      f"<font size=10 color='#059669'><b>{_fmt_gs(saldo_actual)}</b></font>", styles["Normal"]),
            Paragraph("<font size=6 color='#64748B'><b>TOTAL COMPROBANTES</b></font><br/>"
                      f"<font size=10 color='#1E40AF'><b>{_fmt_gs(total_gastos)}</b></font>", styles["Normal"]),
            Paragraph("<font size=6 color='#64748B'><b>MONTO A REPONER</b></font><br/>"
                      f"<font size=10 color='#DC2626'><b>{_fmt_gs(monto_a_reponer)}</b></font>", styles["Normal"]),
        ]
    ]
    t_box = Table(resumen_box, colWidths=[46.5 * mm] * 4)
    t_box.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), HexColor("#F8FAFC")),
        ("BOX", (0, 0), (-1, -1), 0.5, HexColor("#CBD5E1")),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, HexColor("#E2E8F0")),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    elements.append(t_box)
    elements.append(Spacer(1, 10))

    elements.append(Paragraph("<b>RELACIÓN DE COMPROBANTES PRESENTADOS</b>", styles["Normal"]))
    elements.append(Spacer(1, 4))

    table_data = [
        ["N°", "Fecha", "Concepto / Descripción", "Proveedor", "Sector Imputado", "Importe (Gs.)"]
    ]
    for idx, e in enumerate(expenses, 1):
        f_val = e.get("fecha_gasto")
        f_str = f_val.strftime("%d/%m/%Y") if isinstance(f_val, date) else str(f_val or "—")
        table_data.append([
            str(idx),
            f_str,
            Paragraph(f"<font size=6.5>{(e.get('descripcion') or '')[:50]}</font>", styles["Normal"]),
            (e.get("proveedor") or "Varios")[:22],
            (e.get("sector_nombre") or "General")[:18],
            _fmt_val(e.get("monto", 0)),
        ])

    table_data.append([
        "TOTAL A REPONER",
        "",
        f"{len(expenses)} Comprobantes adjuntos",
        "",
        "",
        _fmt_val(total_gastos),
    ])

    t_gastos = Table(table_data, colWidths=[10 * mm, 20 * mm, 62 * mm, 36 * mm, 30 * mm, 28 * mm])
    t_gastos.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), PRIMARY_COLOR),
        ("TEXTCOLOR", (0, 0), (-1, 0), WHITE),
        ("FONTNAME", (0, 0), (-1, 0), FONT_BOLD),
        ("FONTSIZE", (0, 0), (-1, -1), 7),
        ("ALIGN", (0, 0), (1, -1), "CENTER"),
        ("ALIGN", (2, 0), (4, -1), "LEFT"),
        ("ALIGN", (5, 0), (5, -1), "RIGHT"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("LINEBELOW", (0, 0), (-1, -1), 0.5, HexColor("#E2E8F0")),
        ("BACKGROUND", (0, -1), (-1, -1), HexColor("#F1F5F9")),
        ("FONTNAME", (0, -1), (-1, -1), FONT_BOLD),
        ("LINEABOVE", (0, -1), (-1, -1), 1.0, PRIMARY_COLOR),
    ]))
    elements.append(t_gastos)
    elements.append(Spacer(1, 14))

    # Cláusula de Conformidad y Doble Firma Vinculante
    clausula = (
        "<b>CERTIFICACIÓN:</b> El custodio declara bajo fe de juramento que los comprobantes detallados "
        "corresponden fielmente a erogaciones legítimas del sector y que han sido verificados físicamente. "
        "Tesorería certifica la recepción de los comprobantes y autoriza la reposición del efectivo desde "
        "Bóveda / Cuenta Bancaria para restablecer el fondo a su nivel autorizado."
    )
    elements.append(Paragraph(f"<font size=6.5 color='#475569'>{clausula}</font>", styles["Normal"]))
    elements.append(Spacer(1, 14))

    firmas = [
        ["", ""],
        [
            Paragraph("<font size=7.5 color='#0F172A'><b>CUSTODIO DEL FONDO FIJO</b></font>", styles["Normal"]),
            Paragraph("<font size=7.5 color='#0F172A'><b>TESORERÍA / ADMINISTRACIÓN GENERAL</b></font>", styles["Normal"]),
        ],
        [
            Paragraph(f"<font size=6.5 color='#64748B'>Entrega Comprobantes Conforme<br/><b>{fund.get('custodio_nombre') or 'Custodio Asignado'}</b><br/>Fecha: ____/____/________</font>", styles["Normal"]),
            Paragraph("<font size=6.5 color='#64748B'>Recibe Comprobantes y Desembolsa Reposición<br/><b>Tesorería Extra Supermercado</b><br/>Fecha: ____/____/________</font>", styles["Normal"]),
        ],
    ]
    t_firmas = Table(
        [
            [firmas[0][0], "", firmas[0][1]],
            [firmas[1][0], "", firmas[1][1]],
            [firmas[2][0], "", firmas[2][1]],
        ],
        colWidths=[85 * mm, 16 * mm, 85 * mm],
        rowHeights=[16 * mm, None, None],
    )
    t_firmas.setStyle(TableStyle([
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LINEABOVE", (0, 1), (0, 1), 0.75, HexColor("#94A3B8")),
        ("LINEABOVE", (2, 1), (2, 1), 0.75, HexColor("#94A3B8")),
    ]))
    elements.append(KeepTogether(t_firmas))

    _build(doc, elements)
    return buffer.getvalue()
