"""Reportes PDF de Caja/Bóveda — Fase 4 del overhaul. Reusa los helpers
visuales compartidos de integrated_finance.pdf_reports (mismo estilo que
Bancos, AP y AR) en vez de reimplementar estilos de tabla."""
from __future__ import annotations
import io
from decimal import Decimal
from datetime import date, datetime, timezone
from zoneinfo import ZoneInfo

TZ_ASUNCION = ZoneInfo("America/Asuncion")

def _to_asuncion_tz(dt: datetime | str | None) -> datetime | None:
    if not dt:
        return None
    if isinstance(dt, str):
        try:
            dt = datetime.fromisoformat(dt.replace("Z", "+00:00"))
        except Exception:
            return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(TZ_ASUNCION)

from reportlab.lib.units import mm
from reportlab.lib.colors import HexColor
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import Paragraph, Spacer, Table, TableStyle, KeepTogether

from api.src.integrated_finance.pdf_reports import (
    _base_doc, _base_landscape_doc, _company_header, _company_landscape_header,
    _fmt_gs, _build, _totals_table,
    RED, GRAY_LIGHT, PRIMARY_COLOR, WHITE, FONT_BOLD,
    GRAY_DARK, GRAY_MEDIUM,
)


def _fmt_val(v, is_divisa=False) -> str:
    """Formatea valores monetarios tabulares sin símbolos repetitivos de moneda."""
    if v is None or float(v or 0) == 0:
        return "0,00" if is_divisa else "0"
    if is_divisa:
        return f"{float(v):,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    return f"{int(round(float(v))):,}".replace(",", ".")


def _fmt_dif(v) -> str:
    """Formatea diferencias con signo explícito y sin símbolos de moneda."""
    if v is None or round(float(v or 0)) == 0:
        return "0"
    n = int(round(float(v)))
    sign = "+" if n > 0 else ""
    return f"{sign}{n:,}".replace(",", ".")


def generate_arqueo_diario_pdf(company: dict, sessiones: list[dict], fecha_desde: date, fecha_hasta: date, generated_by: str = "") -> bytes:
    """Acta de Arqueo y Conciliación Consolidada de Cajas en formato HORIZONTAL (A4 Landscape, ancho útil 273mm).
    Diseñado específicamente para impresión profesional (ahorro de tóner, fondo claro, sin bloques negros pesados).
    Detalla por terminal y cajero todas las formas de pago desglosadas por canal operativo de tesorería:
    Fondo, Efectivo PYG, BRL, USD, Bancard POS, Dinelco POS, QR, PIX, Transferencias, Extra Club y Cheques,
    con horas de cierre simplificadas (HH:MM), números tabulares limpios y triple firma institucional."""
    buffer = io.BytesIO()
    doc, styles = _base_landscape_doc(buffer, "Acta de Arqueo Consolidado de Cajas", company, generated_by)
    
    USABLE_W = 273 * mm
    subtitulo = f"Período Auditado: Del {fecha_desde.strftime('%d/%m/%Y')} al {fecha_hasta.strftime('%d/%m/%Y')}"
    elements = _company_landscape_header(
        company, styles, "ACTA DE ARQUEO Y CONCILIACIÓN CONSOLIDADA DE CAJAS",
        subtitulo,
        generated_by,
    )

    if not sessiones:
        elements.append(Paragraph("Sin cierres de caja registrados en el período seleccionado.", styles["Small"]))
        _build(doc, elements)
        return buffer.getvalue()

    # Totales acumulados
    total_esperado = sum(s.get("monto_cierre_esperado") or 0 for s in sessiones)
    total_contado = sum((s.get("monto_total") if s.get("monto_total") is not None else s.get("monto_cierre")) or 0 for s in sessiones)
    total_diferencia = sum(s.get("diferencia") or 0 for s in sessiones)
    con_revision = sum(1 for s in sessiones if s.get("requiere_revision") or (s.get("diferencia") or 0) != 0)

    # Acumulados por moneda y canal operativo de tesorería acordado
    sum_fondo = sum(s.get("monto_apertura") or 0 for s in sessiones)
    sum_efectivo_pyg = sum(s.get("monto_efectivo") or 0 for s in sessiones)
    sum_efectivo_brl = sum(s.get("monto_efectivo_brl") or 0 for s in sessiones)
    sum_efectivo_usd = sum(s.get("monto_efectivo_usd") or 0 for s in sessiones)
    sum_bancard = sum(s.get("monto_bancard") or 0 for s in sessiones)
    sum_dinelco = sum(s.get("monto_dinelco") or 0 for s in sessiones)
    sum_qr = sum(s.get("monto_qr") or 0 for s in sessiones)
    sum_pix = sum(s.get("monto_pix") or 0 for s in sessiones)
    sum_transferencia = sum(s.get("monto_transferencia") or 0 for s in sessiones)
    sum_extra_club = sum(s.get("monto_extra_club") or 0 for s in sessiones)
    sum_cheque = sum(s.get("monto_cheque") or 0 for s in sessiones)
    sum_otro = sum(s.get("monto_otro") or 0 for s in sessiones)
    sum_electronico_total = sum_bancard + sum_dinelco + sum_qr + sum_pix + sum_transferencia + sum_extra_club + sum_cheque + sum_otro

    # ─────────────────────────────────────────────────────────────────────────
    # 1. KPI CARDS PANORÁMICAS (Fondo claro para impresión, 54.6mm c/u = 273mm)
    # ─────────────────────────────────────────────────────────────────────────
    dif_color = "#059669" if total_diferencia == 0 else ("#DC2626" if total_diferencia < 0 else "#D97706")
    dif_signo = "+" if total_diferencia > 0 else ""
    card_dif_text = f"{dif_signo}{_fmt_gs(total_diferencia)}"
    dictamen_global = "CONFORME (SIN DIFERENCIA)" if total_diferencia == 0 else ("FALTANTE CONSOLIDADO" if total_diferencia < 0 else "SOBRANTE CONSOLIDADO")

    kpi_data = [
        [
            Paragraph("<font size=6 color='#64748B'><b>TOTAL DECLARADO (RENDIDO)</b></font><br/>"
                      f"<font size=10.5 color='#0F172A'><b>{_fmt_gs(total_contado)}</b></font><br/>"
                      "<font size=5.8 color='#94A3B8'>Efectivo físico + Medios electr.</font>", styles["Normal"]),
            Paragraph("<font size=6 color='#64748B'><b>TOTAL ESPERADO SISTEMA</b></font><br/>"
                      f"<font size=10.5 color='#0F172A'><b>{_fmt_gs(total_esperado)}</b></font><br/>"
                      "<font size=5.8 color='#94A3B8'>Ventas registradas + Fondo fijo</font>", styles["Normal"]),
            Paragraph("<font size=6 color='#64748B'><b>DIFERENCIA NETA CONSOLIDADA</b></font><br/>"
                      f"<font size=10.5 color='{dif_color}'><b>{card_dif_text}</b></font><br/>"
                      f"<font size=5.8 color='{dif_color}'><b>{dictamen_global}</b></font>", styles["Normal"]),
            Paragraph("<font size=6 color='#64748B'><b>VENTAS NO EFECTIVO (POS/QR)</b></font><br/>"
                      f"<font size=10.5 color='#1E40AF'><b>{_fmt_gs(sum_electronico_total)}</b></font><br/>"
                      "<font size=5.8 color='#94A3B8'>Bancard + Dinelco + QR + PIX + Club</font>", styles["Normal"]),
            Paragraph("<font size=6 color='#64748B'><b>AUDITORÍA DE TERMINALES</b></font><br/>"
                      f"<font size=10.5 color='#0F172A'><b>{len(sessiones)} Turnos</b></font><br/>"
                      f"<font size=5.8 color='{'#DC2626' if con_revision > 0 else '#059669'}'><b>{con_revision} con descuadre / {len(sessiones) - con_revision} conformes</b></font>", styles["Normal"]),
        ]
    ]
    t_kpis = Table(kpi_data, colWidths=[54.6 * mm, 54.6 * mm, 54.6 * mm, 54.6 * mm, 54.6 * mm])
    t_kpis.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), HexColor("#F8FAFC")),
        ("BOX", (0, 0), (0, 0), 0.5, HexColor("#CBD5E1")),
        ("BOX", (1, 0), (1, 0), 0.5, HexColor("#CBD5E1")),
        ("BOX", (2, 0), (2, 0), 0.5, HexColor("#CBD5E1")),
        ("BOX", (3, 0), (3, 0), 0.5, HexColor("#CBD5E1")),
        ("BOX", (4, 0), (4, 0), 0.5, HexColor("#CBD5E1")),
        ("TOPPADDING", (0, 0), (-1, -1), 3.5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3.5),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]))
    elements.append(t_kpis)
    elements.append(Spacer(1, 4))

    # ─────────────────────────────────────────────────────────────────────────
    # 2. PANEL RESUMEN DE RECAUDACIÓN POR CANAL OPERATIVO DE TESORERÍA (273mm)
    # ─────────────────────────────────────────────────────────────────────────
    res_medios_data = [
        [
            Paragraph("<font size=5.8 color='#64748B'>Efec. PYG:</font> "
                      f"<font size=6.5 color='#0F172A'><b>{_fmt_gs(sum_efectivo_pyg) if sum_efectivo_pyg > 0 else '—'}</b></font>", styles["Normal"]),
            Paragraph("<font size=5.8 color='#64748B'>Efec. BRL:</font> "
                      f"<font size=6.5 color='#0F172A'><b>{f'R$ {sum_efectivo_brl:,.2f}' if sum_efectivo_brl > 0 else '—'}</b></font>", styles["Normal"]),
            Paragraph("<font size=5.8 color='#64748B'>Bancard POS:</font> "
                      f"<font size=6.5 color='#1E40AF'><b>{_fmt_gs(sum_bancard) if sum_bancard > 0 else '—'}</b></font>", styles["Normal"]),
            Paragraph("<font size=5.8 color='#64748B'>Dinelco POS:</font> "
                      f"<font size=6.5 color='#1E40AF'><b>{_fmt_gs(sum_dinelco) if sum_dinelco > 0 else '—'}</b></font>", styles["Normal"]),
            Paragraph("<font size=5.8 color='#64748B'>Cobro QR:</font> "
                      f"<font size=6.5 color='#1E40AF'><b>{_fmt_gs(sum_qr) if sum_qr > 0 else '—'}</b></font>", styles["Normal"]),
            Paragraph("<font size=5.8 color='#64748B'>PIX Plug:</font> "
                      f"<font size=6.5 color='#1E40AF'><b>{_fmt_gs(sum_pix) if sum_pix > 0 else '—'}</b></font>", styles["Normal"]),
            Paragraph("<font size=5.8 color='#64748B'>Extra Club:</font> "
                      f"<font size=6.5 color='#1E40AF'><b>{_fmt_gs(sum_extra_club) if sum_extra_club > 0 else '—'}</b></font>", styles["Normal"]),
        ]
    ]
    t_res_medios = Table(res_medios_data, colWidths=[39 * mm, 39 * mm, 39 * mm, 39 * mm, 39 * mm, 39 * mm, 39 * mm])
    t_res_medios.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), HexColor("#F1F5F9")),
        ("BOX", (0, 0), (-1, -1), 0.5, HexColor("#CBD5E1")),
        ("INNERGRID", (0, 0), (-1, -1), 0.25, HexColor("#E2E8F0")),
        ("TOPPADDING", (0, 0), (-1, -1), 2),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
        ("LEFTPADDING", (0, 0), (-1, -1), 3),
        ("RIGHTPADDING", (0, 0), (-1, -1), 3),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]))
    elements.append(t_res_medios)
    elements.append(Spacer(1, 4))

    # ─────────────────────────────────────────────────────────────────────────
    # 3. GRILLA MATRICIAL PANORÁMICA COMPLETA (18 COLUMNAS = 273mm)
    # ─────────────────────────────────────────────────────────────────────────
    head_left = styles.get("CellHead", styles["Normal"])
    head_right = styles.get("CellHeadRight", styles["MetaRight"])
    head_center = styles.get("CellHeadCenter", styles["Normal"])
    cell_text = styles.get("CellText", styles["Normal"])
    cell_bold = styles.get("CellTextBold", styles["Normal"])
    cell_num = styles.get("CellNum", styles["MetaRight"])
    cell_num_bold = styles.get("CellNumBold", styles["MetaRight"])

    header_row = [
        Paragraph("<b>Caja</b>", head_left),
        Paragraph("<b>Cajero/a Responsable</b>", head_left),
        Paragraph("<b>Hora</b>", head_center),
        Paragraph("<b>Fondo (Gs.)</b>", head_right),
        Paragraph("<b>Efec. PYG</b>", head_right),
        Paragraph("<b>Reales (R$)</b>", head_right),
        Paragraph("<b>Dólares ($)</b>", head_right),
        Paragraph("<b>Bancard POS</b>", head_right),
        Paragraph("<b>Dinelco POS</b>", head_right),
        Paragraph("<b>Cobro QR</b>", head_right),
        Paragraph("<b>PIX Plug</b>", head_right),
        Paragraph("<b>Transf. SIPAP</b>", head_right),
        Paragraph("<b>Extra Club</b>", head_right),
        Paragraph("<b>Cheques</b>", head_right),
        Paragraph("<b>Total Rend.</b>", head_right),
        Paragraph("<b>Esperado</b>", head_right),
        Paragraph("<b>Diferencia</b>", head_right),
        Paragraph("<b>Dictamen</b>", head_center),
    ]
    table_rows = [header_row]

    # Anchos milimétricos exactos: 11+30+9+14+16+12+10+17+15+15+13+13+18+13+18+18+16+15 = 273mm
    col_widths = [
        11 * mm, 30 * mm, 9 * mm, 14 * mm, 16 * mm, 12 * mm, 10 * mm,
        17 * mm, 15 * mm, 15 * mm, 13 * mm, 13 * mm, 18 * mm, 13 * mm,
        18 * mm, 18 * mm, 16 * mm, 15 * mm,
    ]

    style_cmds = [
        ("BACKGROUND", (0, 0), (-1, 0), HexColor("#F1F5F9")),
        ("BOX", (0, 0), (-1, 0), 0.5, HexColor("#CBD5E1")),
        ("LINEBELOW", (0, 0), (-1, 0), 1.0, HexColor("#94A3B8")),
        ("BOTTOMPADDING", (0, 0), (-1, 0), 3),
        ("TOPPADDING", (0, 0), (-1, 0), 3),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 1.5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 1.5),
    ]

    for idx, s in enumerate(sessiones, start=1):
        fc_loc = _to_asuncion_tz(s.get("fecha_cierre"))
        fc_str = fc_loc.strftime("%H:%M") if fc_loc else "—"

        fondo = s.get("monto_apertura") or 0
        m_ef_pyg = s.get("monto_efectivo") or 0
        m_ef_brl = s.get("monto_efectivo_brl") or 0
        m_ef_usd = s.get("monto_efectivo_usd") or 0
        m_bancard = s.get("monto_bancard") or 0
        m_dinelco = s.get("monto_dinelco") or 0
        m_qr = s.get("monto_qr") or 0
        m_pix = s.get("monto_pix") or 0
        m_transf = s.get("monto_transferencia") or 0
        m_extra_club = s.get("monto_extra_club") or 0
        m_cheque = s.get("monto_cheque") or 0

        esp = s.get("monto_cierre_esperado") or 0
        cont = (s.get("monto_total") if s.get("monto_total") is not None else s.get("monto_cierre")) or 0
        dif = s.get("diferencia") if s.get("diferencia") is not None else (cont - esp)
        req_rev = bool(s.get("requiere_revision") or dif != 0)

        dif_txt = _fmt_dif(dif)
        estado_badge = "REVISIÓN" if req_rev else "CONFORME"
        badge_color = "#DC2626" if req_rev else "#059669"

        caja_cell = Paragraph(f"<b>{s.get('register_nombre') or 'Caja'}</b>", cell_bold)
        cajero_cell = Paragraph(f"{s.get('cajero_nombre') or '—'}", cell_text)
        hora_cell = Paragraph(f"<font color='#475569'>{fc_str}</font>", styles.get("CellHeadCenter", styles["Normal"]))
        fondo_cell = Paragraph(_fmt_val(fondo), cell_num)
        ef_pyg_cell = Paragraph(_fmt_val(m_ef_pyg), cell_num)
        ef_brl_cell = Paragraph(_fmt_val(m_ef_brl, is_divisa=True), cell_num)
        ef_usd_cell = Paragraph(_fmt_val(m_ef_usd, is_divisa=True), cell_num)
        bancard_cell = Paragraph(_fmt_val(m_bancard), cell_num)
        dinelco_cell = Paragraph(_fmt_val(m_dinelco), cell_num)
        qr_cell = Paragraph(_fmt_val(m_qr), cell_num)
        pix_cell = Paragraph(_fmt_val(m_pix, is_divisa=(m_pix > 0 and s.get("pix_moneda") == "BRL")), cell_num)
        transf_cell = Paragraph(_fmt_val(m_transf), cell_num)
        club_cell = Paragraph(_fmt_val(m_extra_club), cell_num)
        cheque_cell = Paragraph(_fmt_val(m_cheque), cell_num)
        cont_cell = Paragraph(f"<b>{_fmt_val(cont)}</b>", cell_num_bold)
        esp_cell = Paragraph(_fmt_val(esp), cell_num)
        dif_cell = Paragraph(f"<font color='{badge_color}'><b>{dif_txt}</b></font>", cell_num)
        dict_cell = Paragraph(f"<font size=6 color='{badge_color}'><b>{estado_badge}</b></font>", styles.get("CellHeadCenter", styles["Normal"]))

        table_rows.append([
            caja_cell, cajero_cell, hora_cell, fondo_cell,
            ef_pyg_cell, ef_brl_cell, ef_usd_cell,
            bancard_cell, dinelco_cell, qr_cell,
            pix_cell, transf_cell, club_cell, cheque_cell,
            cont_cell, esp_cell, dif_cell, dict_cell,
        ])

        bg_color = WHITE if idx % 2 != 0 else HexColor("#F8FAFC")
        style_cmds.extend([
            ("BACKGROUND", (0, idx), (-1, idx), bg_color),
            ("TOPPADDING", (0, idx), (-1, idx), 2.2),
            ("BOTTOMPADDING", (0, idx), (-1, idx), 2.2),
            ("LINEBELOW", (0, idx), (-1, idx), 0.25, HexColor("#E2E8F0")),
        ])

    # Fila de Totales Generales Finales con fondo claro de impresión
    tot_dif_txt = _fmt_dif(total_diferencia)

    tot_label = Paragraph("<b>TOTALES GENERALES CONSOLIDADOS</b>", head_left)
    tot_fondo = Paragraph(f"<b>{_fmt_val(sum_fondo)}</b>", head_right)
    tot_ef_pyg = Paragraph(f"<b>{_fmt_val(sum_efectivo_pyg)}</b>", head_right)
    tot_ef_brl = Paragraph(f"<b>{_fmt_val(sum_efectivo_brl, is_divisa=True)}</b>", head_right)
    tot_ef_usd = Paragraph(f"<b>{_fmt_val(sum_efectivo_usd, is_divisa=True)}</b>", head_right)
    tot_bancard = Paragraph(f"<b>{_fmt_val(sum_bancard)}</b>", head_right)
    tot_dinelco = Paragraph(f"<b>{_fmt_val(sum_dinelco)}</b>", head_right)
    tot_qr = Paragraph(f"<b>{_fmt_val(sum_qr)}</b>", head_right)
    tot_pix = Paragraph(f"<b>{_fmt_val(sum_pix, is_divisa=True)}</b>", head_right)
    tot_transf = Paragraph(f"<b>{_fmt_val(sum_transferencia)}</b>", head_right)
    tot_club = Paragraph(f"<b>{_fmt_val(sum_extra_club)}</b>", head_right)
    tot_cheque = Paragraph(f"<b>{_fmt_val(sum_cheque)}</b>", head_right)
    tot_cont = Paragraph(f"<b>{_fmt_val(total_contado)}</b>", head_right)
    tot_esp = Paragraph(f"<b>{_fmt_val(total_esperado)}</b>", head_right)
    tot_dif = Paragraph(f"<b>{tot_dif_txt}</b>", head_right)
    tot_dict = Paragraph("<font size=6><b>TOTAL</b></font>", head_center)

    tot_row_idx = len(table_rows)
    table_rows.append([
        tot_label, "", "", tot_fondo,
        tot_ef_pyg, tot_ef_brl, tot_ef_usd,
        tot_bancard, tot_dinelco, tot_qr,
        tot_pix, tot_transf, tot_club, tot_cheque,
        tot_cont, tot_esp, tot_dif, tot_dict,
    ])

    style_cmds.extend([
        ("SPAN", (0, tot_row_idx), (2, tot_row_idx)),
        ("BACKGROUND", (0, tot_row_idx), (-1, tot_row_idx), HexColor("#F1F5F9")),
        ("LINEABOVE", (0, tot_row_idx), (-1, tot_row_idx), 1.0, HexColor("#0F172A")),
        ("LINEBELOW", (0, tot_row_idx), (-1, tot_row_idx), 1.5, HexColor("#0F172A")),
        ("TOPPADDING", (0, tot_row_idx), (-1, tot_row_idx), 3.5),
        ("BOTTOMPADDING", (0, tot_row_idx), (-1, tot_row_idx), 3.5),
        ("VALIGN", (0, tot_row_idx), (-1, tot_row_idx), "MIDDLE"),
    ])

    t_main = Table(table_rows, colWidths=col_widths, repeatRows=1)
    t_main.setStyle(TableStyle(style_cmds))
    elements.append(t_main)
    elements.append(Spacer(1, 6))

    # ─────────────────────────────────────────────────────────────────────────
    # 4. DECLARACIÓN LEGAL Y TRIPLES FIRMAS INSTITUCIONALES (SIN CAJERA)
    # ─────────────────────────────────────────────────────────────────────────
    aviso_leg = Paragraph(
        "<font size=6.5 color='#64748B'><i>El presente documento constituye el acta oficial de arqueo consolidado "
        "y auditoría general de valores físicos y electrónicos de la sucursal. Los importes reflejan fielmente las "
        "recaudaciones de caja y las diferencias determinadas quedan asentadas para su registro contable y control interno.</i></font>",
        styles["Normal"],
    )

    # 3 firmas institucionales en 273mm con separadores y líneas vectoriales continuas
    firmas_cells = [
        ["", "", ""],
        [
            Paragraph("<font size=7.5 color='#0F172A'><b>SUPERVISIÓN GENERAL DE CAJAS</b></font>", styles["Normal"]),
            Paragraph("<font size=7.5 color='#0F172A'><b>TESORERÍA / CUSTODIA DE FONDOS</b></font>", styles["Normal"]),
            Paragraph("<font size=7.5 color='#0F172A'><b>GERENCIA GENERAL / AUDITORÍA</b></font>", styles["Normal"]),
        ],
        [
            Paragraph("<font size=6.5 color='#64748B'>Verificación y Arqueo Físico de Cajas<br/>Fecha: ____/____/________   Hora: ____:____</font>", styles["Normal"]),
            Paragraph("<font size=6.5 color='#64748B'>Recepción y Certificación de Valores<br/>Fecha: ____/____/________   Hora: ____:____</font>", styles["Normal"]),
            Paragraph("<font size=6.5 color='#64748B'>Aprobación y Cierre Contable de Operaciones<br/>Fecha: ____/____/________   Hora: ____:____</font>", styles["Normal"]),
        ],
    ]
    # 3 bloques de 82mm con márgenes intermedios: 82 + 13.5 + 82 + 13.5 + 82 = 273mm
    t_firmas = Table(
        [
            [firmas_cells[0][0], "", firmas_cells[0][1], "", firmas_cells[0][2]],
            [firmas_cells[1][0], "", firmas_cells[1][1], "", firmas_cells[1][2]],
            [firmas_cells[2][0], "", firmas_cells[2][1], "", firmas_cells[2][2]],
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
        ("TOPPADDING", (0, 1), (-1, 1), 3),
        ("BOTTOMPADDING", (0, 1), (-1, 1), 1),
        ("TOPPADDING", (0, 2), (-1, 2), 1),
        ("LEFTPADDING", (0, 0), (-1, -1), 2),
        ("RIGHTPADDING", (0, 0), (-1, -1), 2),
    ]))

    # KeepTogether asegura que las firmas institucionales no se dividan jamás
    elements.append(KeepTogether([
        aviso_leg,
        Spacer(1, 6),
        t_firmas,
    ]))

    _build(doc, elements)
    return buffer.getvalue()


def generate_boveda_movimientos_pdf(company: dict, entries: list[dict], fecha_desde: date, fecha_hasta: date, generated_by: str = "") -> bytes:
    buffer = io.BytesIO()
    doc, styles = _base_doc(buffer, "Movimientos de Bóveda", company, generated_by)
    elements = _company_header(
        company, styles, "Movimientos de Bóveda",
        f"Del {fecha_desde.strftime('%d/%m/%Y')} al {fecha_hasta.strftime('%d/%m/%Y')}",
        generated_by,
    )

    if not entries:
        elements.append(Paragraph("Sin movimientos de bóveda en el período seleccionado.", styles["Small"]))
        _build(doc, elements)
        return buffer.getvalue()

    en_boveda = [e for e in entries if e["estado"] == "en_boveda"]
    depositado = [e for e in entries if e["estado"] == "depositado"]
    resumen_rows = [
        ("Entradas en el período", str(len(entries)), False),
        ("Aún en bóveda", f"{len(en_boveda)} — {_fmt_gs(sum(e['monto_pyg'] for e in en_boveda))}", False),
        ("Ya depositadas", f"{len(depositado)} — {_fmt_gs(sum(e['monto_pyg'] for e in depositado))}", True),
    ]
    elements.append(_totals_table(resumen_rows))
    elements.append(Spacer(1, 10))

    header = ["Origen", "Fecha", "Monto PYG", "Estado", "Fecha depósito"]
    data = [header]
    for e in entries:
        e_created = _to_asuncion_tz(e.get("created_at"))
        data.append([
            e["origen"].replace("_", " ").title(),
            e_created.strftime("%d/%m/%Y %H:%M") if e_created else "—",
            _fmt_gs(e["monto_pyg"]),
            "En bóveda" if e["estado"] == "en_boveda" else "Depositado",
            e["fecha_deposito"].strftime("%d/%m/%Y") if e.get("fecha_deposito") else "—",
        ])

    t = Table(data, colWidths=[40 * mm, 36 * mm, 36 * mm, 34 * mm, 40 * mm], repeatRows=1)
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), PRIMARY_COLOR),
        ("TEXTCOLOR", (0, 0), (-1, 0), WHITE),
        ("FONTNAME", (0, 0), (-1, 0), FONT_BOLD),
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("ALIGN", (2, 0), (2, -1), "RIGHT"),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [WHITE, GRAY_LIGHT]),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
    ]))
    elements.append(t)

    _build(doc, elements)
    return buffer.getvalue()


def generate_cierre_sesion_individual_pdf(
    company: dict,
    session_data: dict,
    payments_breakdown: dict,
    cash_drops: list[dict],
    generated_by: str = "",
) -> bytes:
    buffer = io.BytesIO()
    doc, styles = _base_doc(buffer, "Informe de Cierre de Caja", company, generated_by)
    s = session_data
    apertura_dt = s.get("fecha_apertura")
    cierre_dt = s.get("fecha_cierre")
    subtitulo = f"Caja: {s.get('register_nombre') or '—'}  |  Turno: {s.get('id', '')[:8].upper()}"
    
    elements = _company_header(
        company, styles, "Informe de Cierre de Caja / Arqueo Individual",
        subtitulo,
        generated_by,
    )

    # 1. METADATOS DE LA SESIÓN
    ap_local = _to_asuncion_tz(apertura_dt)
    ci_local = _to_asuncion_tz(cierre_dt)
    apertura_str = ap_local.strftime("%d/%m/%Y %H:%M:%S") if ap_local else "—"
    cierre_str = ci_local.strftime("%d/%m/%Y %H:%M:%S") if ci_local else "—"
    
    recon = s.get("recon")
    tot_facturado_gs = recon.get("total_cobrado_gs", 0) if recon else (s.get("efectivo_cobrado_pyg", 0) or 0)
    cant_tickets = recon.get("total_ventas_count", 0) if recon else 0

    meta_data = [
        ["Cajero/a:", Paragraph(f"<b>{s.get('cajero_nombre') or '—'}</b>", styles["Normal"]), "Caja / Terminal:", Paragraph(f"<b>{s.get('register_nombre') or '—'}</b>", styles["Normal"])],
        ["Fecha Apertura:", apertura_str, "Fecha Cierre:", cierre_str],
        ["Estado Sesión:", s.get("estado", "cerrada").upper(), "ID Sesión:", str(s.get("id", "—"))[:8].upper()],
        ["TOTAL FACTURADO:", Paragraph(f"<font color='#047857' size=8.5><b>{_fmt_gs(tot_facturado_gs)}</b></font> <font color='#475569'>({cant_tickets} tickets)</font>", styles["Normal"]), "Régimen Fiscal:", Paragraph("<b>Extra Supermercado (PYG)</b>", styles["Normal"])],
    ]
    t_meta = Table(meta_data, colWidths=[28 * mm, 64 * mm, 30 * mm, 64 * mm])
    t_meta.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (0, -1), FONT_BOLD),
        ("FONTNAME", (2, 0), (2, -1), FONT_BOLD),
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
        ("TOPPADDING", (0, 0), (-1, -1), 2),
    ]))
    elements.append(t_meta)
    elements.append(Spacer(1, 8))

    # 2. RESUMEN FINANCIERO Y ARQUEO DE EFECTIVO
    elements.append(Paragraph("<b>1. ARQUEO Y CONCILIACIÓN DE EFECTIVO</b>", styles["Normal"]))
    elements.append(Spacer(1, 4))

    if recon:
        f_pyg = recon.get("fondo_pyg", 0)
        f_brl = recon.get("fondo_brl", 0)
        f_usd = recon.get("fondo_usd", 0)
        tot_facturado = recon.get("total_cobrado_gs", 0)
        tot_no_ef = recon.get("total_no_efectivo_gs", 0)
        ventas_ef_total = recon.get("ventas_ef_total_gs", max(0, tot_facturado - tot_no_ef))
        drops_pyg = recon.get("drops_pyg", 0)
        drops_total = recon.get("total_drops_gs", drops_pyg)
        esp_total = recon.get("esperado_total_gs", max(0, ventas_ef_total - drops_total))

        c_pyg = recon.get("contado_pyg", 0)
        c_brl = recon.get("contado_brl", 0)
        c_usd = recon.get("contado_usd", 0)
        tasa_brl = recon.get("tasa_brl", 1130)
        tasa_usd = recon.get("tasa_usd", 5840.1)
        c_brl_gs = recon.get("contado_brl_gs", c_brl * tasa_brl)
        c_usd_gs = recon.get("contado_usd_gs", c_usd * tasa_usd)
        c_total = recon.get("contado_total_gs", c_pyg + c_brl_gs + c_usd_gs)

        dif_consolidada = recon.get("diferencia_consolidada_gs", c_total - esp_total)
        estado_cuadre = "CUADRADO" if abs(dif_consolidada) < 5000 else ("SOBRANTE" if dif_consolidada > 0 else "FALTANTE")
        signo_cons = "+" if dif_consolidada >= 0 else ""
        dif_color_hex = "#059669" if dif_consolidada >= 0 else "#DC2626"

        style_th = ParagraphStyle("TH", parent=styles["Normal"], fontName=FONT_BOLD, fontSize=7.5, leading=9, textColor=HexColor("#0F172A"))
        style_tl = ParagraphStyle("TL", parent=styles["Normal"], fontSize=7, leading=8.5, textColor=HexColor("#334155"))
        style_tr = ParagraphStyle("TR", parent=styles["Normal"], fontSize=7, leading=8.5, alignment=TA_RIGHT, fontName=FONT_BOLD, textColor=HexColor("#0F172A"))
        style_tr_num = ParagraphStyle("TRN", parent=styles["Normal"], fontSize=7, leading=8.5, alignment=TA_RIGHT, textColor=HexColor("#0F172A"))

        # Tabla Izquierda: Conciliación Efectivo Esperado (100% en Guaraníes)
        cant_tickets = recon.get("total_ventas_count", 0)
        drops_p_str = f"-{_fmt_gs(drops_total)}" if drops_total > 0 else "0 Gs."
        esp_rows = [
            [Paragraph("<b>1.A CONCILIACIÓN EFECTIVO ESPERADO (₲)</b>", style_th), ""],
            [Paragraph(f"Total Ventas Facturadas ({cant_tickets} tickets):", style_tl), Paragraph(f"{_fmt_gs(tot_facturado)}", style_tr_num)],
            [Paragraph("(-) Medios No Efectivo (Tarjetas, QR, PIX):", style_tl), Paragraph(f"-{_fmt_gs(tot_no_ef)}", style_tr_num)],
            [Paragraph("(=) Efectivo Total por Ventas:", style_tl), Paragraph(f"{_fmt_gs(ventas_ef_total)}", style_tr_num)],
            [Paragraph("(-) Retiros / Cash Drops Confirmados:", style_tl), Paragraph(drops_p_str, style_tr_num)],
            [Paragraph("<b>(=) TOTAL ESPERADO A RENDIR:</b>", style_th), Paragraph(f"<b>{_fmt_gs(esp_total)}</b>", style_tr)],
        ]
        t_esp = Table(esp_rows, colWidths=[58 * mm, 33 * mm])
        t_esp.setStyle(TableStyle([
            ("SPAN", (0, 0), (1, 0)),
            ("BACKGROUND", (0, 0), (1, 0), HexColor("#F1F5F9")),
            ("BOX", (0, 0), (-1, -1), 0.5, HexColor("#CBD5E1")),
            ("LINEBELOW", (0, 0), (-1, 0), 1.0, HexColor("#94A3B8")),
            ("LINEABOVE", (0, -1), (-1, -1), 0.75, HexColor("#94A3B8")),
            ("BACKGROUND", (0, -1), (-1, -1), HexColor("#F8FAFC")),
            ("TOPPADDING", (0, 0), (-1, -1), 2.5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 2.5),
            ("LEFTPADDING", (0, 0), (-1, -1), 3.5),
            ("RIGHTPADDING", (0, 0), (-1, -1), 3.5),
        ]))

        # Tabla Derecha: Desglose Efectivo Físico Rendido a Tesorería
        brl_entregado_str = f"R$ {_fmt_val(c_brl, is_divisa=True)}"
        usd_entregado_str = f"US$ {_fmt_val(c_usd, is_divisa=True)}"
        ren_rows = [
            [Paragraph("<b>1.B DESGLOSE EFECTIVO RENDIDO A TESORERÍA</b>", style_th), ""],
            [Paragraph("Efectivo Físico Guaraníes (PYG):", style_tl), Paragraph(f"{_fmt_gs(c_pyg)}", style_tr_num)],
            [Paragraph(f"Efectivo Reales ({brl_entregado_str} x {_fmt_gs(tasa_brl)}):", style_tl), Paragraph(f"{_fmt_gs(c_brl_gs)}", style_tr_num)],
            [Paragraph(f"Efectivo Dólares ({usd_entregado_str} x {_fmt_gs(tasa_usd)}):", style_tl), Paragraph(f"{_fmt_gs(c_usd_gs)}", style_tr_num)],
            [Paragraph("<b>TOTAL RENDIDO A TESORERÍA:</b>", style_th), Paragraph(f"<b>{_fmt_gs(c_total)}</b>", style_tr)],
            [Paragraph("<b>DIFERENCIA (Rendido - Esperado):</b>", style_th), Paragraph(f"<font color='{dif_color_hex}'><b>{signo_cons}{_fmt_gs(dif_consolidada)} ({estado_cuadre})</b></font>", style_tr)],
        ]
        t_ren = Table(ren_rows, colWidths=[61 * mm, 33 * mm])
        t_ren.setStyle(TableStyle([
            ("SPAN", (0, 0), (1, 0)),
            ("BACKGROUND", (0, 0), (1, 0), HexColor("#F1F5F9")),
            ("BOX", (0, 0), (-1, -1), 0.5, HexColor("#CBD5E1")),
            ("LINEBELOW", (0, 0), (-1, 0), 1.0, HexColor("#94A3B8")),
            ("LINEABOVE", (0, -2), (-1, -2), 0.75, HexColor("#94A3B8")),
            ("BACKGROUND", (0, -2), (-1, -1), HexColor("#F8FAFC")),
            ("TOPPADDING", (0, 0), (-1, -1), 2.5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 2.5),
            ("LEFTPADDING", (0, 0), (-1, -1), 3.5),
            ("RIGHTPADDING", (0, 0), (-1, -1), 3.5),
        ]))

        t_master = Table([[t_esp, t_ren]], colWidths=[92 * mm, 94 * mm])
        t_master.setStyle(TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("LEFTPADDING", (0, 0), (-1, -1), 0),
            ("RIGHTPADDING", (0, 0), (-1, -1), 0),
            ("TOPPADDING", (0, 0), (-1, -1), 0),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
        ]))
        elements.append(t_master)
        elements.append(Spacer(1, 4))

        # Certificación de Fondo de Apertura en Gaveta (Custodia Permanente)
        f_cert_p = _fmt_gs(f_pyg)
        f_cert_b = f"R$ {_fmt_val(f_brl, is_divisa=True)}"
        f_cert_u = f"US$ {_fmt_val(f_usd, is_divisa=True)}"
        style_cert = ParagraphStyle("CertBox", parent=styles["Normal"], fontSize=7, leading=9.5, textColor=HexColor("#1E293B"))
        cert_content = [
            [
                Paragraph(
                    "<b>🛡️ CERTIFICACIÓN DE FONDO DE APERTURA EN GAVETA (CUSTODIA PERMANENTE)</b><br/>"
                    f"<b>Fondo Certificado:</b> {f_cert_p} &nbsp;|&nbsp; {f_cert_b} &nbsp;|&nbsp; {f_cert_u}<br/>"
                    "<font color='#475569'><i>Verificado físicamente por Supervisora en gaveta. Este fondo NO ingresa a Tesorería; permanece bajo custodia permanente de la cajera para el inicio de la siguiente sesión.</i></font>",
                    style_cert,
                )
            ]
        ]
        t_cert = Table(cert_content, colWidths=[186 * mm])
        t_cert.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), HexColor("#F1F5F9")),
            ("BOX", (0, 0), (-1, -1), 0.75, HexColor("#94A3B8")),
            ("TOPPADDING", (0, 0), (-1, -1), 3),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
            ("LEFTPADDING", (0, 0), (-1, -1), 6),
            ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ]))
        elements.append(t_cert)
        elements.append(Spacer(1, 5))

        # Banner de Conciliación Consolidada
        bg_color = HexColor("#ECFDF5") if estado_cuadre == "CUADRADO" else (HexColor("#FEF3C7") if estado_cuadre == "SOBRANTE" else HexColor("#FEE2E2"))
        txt_color = HexColor("#065F46") if estado_cuadre == "CUADRADO" else (HexColor("#92400E") if estado_cuadre == "SOBRANTE" else HexColor("#991B1B"))
        txt_color_hex = "#065F46" if estado_cuadre == "CUADRADO" else ("#92400E" if estado_cuadre == "SOBRANTE" else "#991B1B")

        style_box_cell = ParagraphStyle("BoxCell", parent=styles["Normal"], alignment=TA_CENTER, leading=10)
        resumen_box = [
            [
                Paragraph(f"<font size=5.5 color='{txt_color_hex}'><b>TOTAL FACTURADO</b></font><br/><font size=8.5 color='{txt_color_hex}'><b>{_fmt_gs(tot_facturado)}</b></font>", style_box_cell),
                Paragraph(f"<font size=5.5 color='{txt_color_hex}'><b>TOTAL ESPERADO A RENDIR</b></font><br/><font size=8.5 color='{txt_color_hex}'><b>{_fmt_gs(esp_total)}</b></font>", style_box_cell),
                Paragraph(f"<font size=5.5 color='{txt_color_hex}'><b>TOTAL RENDIDO A TESORERÍA</b></font><br/><font size=8.5 color='{txt_color_hex}'><b>{_fmt_gs(c_total)}</b></font>", style_box_cell),
                Paragraph(f"<font size=5.5 color='{txt_color_hex}'><b>DIFERENCIA RENDICIÓN</b></font><br/><font size=8.5 color='{txt_color_hex}'><b>{signo_cons}{_fmt_gs(dif_consolidada)}</b></font>", style_box_cell),
                Paragraph(f"<font size=5.5 color='{txt_color_hex}'><b>DICTAMEN DE ARQUEO</b></font><br/><font size=8.5 color='{txt_color_hex}'><b>{estado_cuadre}</b></font>", style_box_cell),
            ]
        ]
        t_box = Table(resumen_box, colWidths=[37.2 * mm, 37.2 * mm, 37.2 * mm, 37.2 * mm, 37.2 * mm])
        t_box.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), bg_color),
            ("BOX", (0, 0), (-1, -1), 1.0, txt_color),
            ("TOPPADDING", (0, 0), (-1, -1), 3.5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 3.5),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ]))
        elements.append(t_box)
        elements.append(Spacer(1, 8))
    else:
        monto_apertura = s.get("monto_apertura") or 0
        monto_cierre_esperado = s.get("monto_cierre_esperado") or 0
        monto_cierre = s.get("monto_cierre") or 0
        diferencia = s.get("diferencia") or 0
        diferencia_usd = s.get("diferencia_usd") or 0
        diferencia_brl = s.get("diferencia_brl") or 0
        contado_usd = s.get("monto_efectivo_usd") or 0
        contado_brl = s.get("monto_efectivo_brl") or 0

        arqueo_header = ["Moneda", "Ventas Efectivo", "(-) Retiros / Drops", "(=) Esperado a Rendir", "Contado Rendido", "Diferencia", "Auditoría"]
        arqueo_rows = [arqueo_header]

        dif_pyg_str = f"{'+' if diferencia >= 0 else ''}{_fmt_gs(diferencia)}"
        auditoria_pyg = "REVISIÓN" if s.get("requiere_revision") else "EXACTO" if diferencia == 0 else "DESCUADRE"
        ventas_pyg_est = s.get("efectivo_cobrado_pyg") or monto_cierre_esperado
        arqueo_rows.append([
            "PYG (Gs.)",
            _fmt_gs(ventas_pyg_est),
            "0 Gs.",
            _fmt_gs(monto_cierre_esperado),
            _fmt_gs(monto_cierre),
            dif_pyg_str,
            auditoria_pyg,
        ])

        monto_apertura_usd = s.get("monto_apertura_usd") or 0
        monto_apertura_brl = s.get("monto_apertura_brl") or 0
        monto_cierre_esperado_usd = s.get("monto_cierre_esperado_usd") or 0
        monto_cierre_esperado_brl = s.get("monto_cierre_esperado_brl") or 0

        if contado_usd > 0 or s.get("efectivo_usd_esperado") or diferencia_usd != 0:
            dif_usd_str = f"{'+' if diferencia_usd >= 0 else ''}{diferencia_usd:.2f}"
            arqueo_rows.append([
                "USD (US$)",
                f"{s.get('efectivo_usd_esperado', 0):.2f}",
                "0.00",
                f"{monto_cierre_esperado_usd:.2f}",
                f"{contado_usd:.2f}",
                dif_usd_str,
                "EXACTO" if diferencia_usd == 0 else "DESCUADRE",
            ])

        if contado_brl > 0 or s.get("efectivo_brl_esperado") or diferencia_brl != 0:
            dif_brl_str = f"{'+' if diferencia_brl >= 0 else ''}{diferencia_brl:.2f}"
            arqueo_rows.append([
                "BRL (R$)",
                f"{s.get('efectivo_brl_esperado', 0):.2f}",
                "0.00",
                f"{monto_cierre_esperado_brl:.2f}",
                f"{contado_brl:.2f}",
                dif_brl_str,
                "EXACTO" if diferencia_brl == 0 else "DESCUADRE",
            ])

        t_arq = Table(arqueo_rows, colWidths=[26 * mm, 28 * mm, 28 * mm, 28 * mm, 26 * mm, 26 * mm, 24 * mm])
        style_arq = [
            ("BACKGROUND", (0, 0), (-1, 0), HexColor("#F1F5F9")),
            ("TEXTCOLOR", (0, 0), (-1, 0), HexColor("#0F172A")),
            ("FONTNAME", (0, 0), (-1, 0), FONT_BOLD),
            ("FONTSIZE", (0, 0), (-1, -1), 7.5),
            ("ALIGN", (1, 0), (5, -1), "RIGHT"),
            ("ALIGN", (6, 0), (6, -1), "CENTER"),
            ("BOX", (0, 0), (-1, -1), 0.5, HexColor("#CBD5E1")),
            ("LINEBELOW", (0, 0), (-1, 0), 1.0, HexColor("#94A3B8")),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [WHITE, HexColor("#F8FAFC")]),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
            ("TOPPADDING", (0, 0), (-1, -1), 3),
        ]
        if s.get("requiere_revision") or diferencia != 0:
            style_arq.append(("TEXTCOLOR", (5, 1), (6, 1), RED))
        t_arq.setStyle(TableStyle(style_arq))
        elements.append(t_arq)
        elements.append(Spacer(1, 10))

    # 3. DESGLOSE DE VENTAS POR MEDIO DE PAGO
    elements.append(Paragraph("<b>2. DESGLOSE DE VENTAS POR MEDIOS DE PAGO DEL TURNO (100% EN GUARANÍES)</b>", styles["Normal"]))
    elements.append(Spacer(1, 4))

    if recon and recon.get("medios_pago_detallados"):
        tot_cobrado = float(recon.get("total_cobrado_gs") or 0)
        pay_data = [["Medio de Pago / Canal", "Moneda", "Detalle Moneda Original", "Total Recaudado (₲)", "% Participación"]]
        for m in recon["medios_pago_detallados"]:
            m_gs = float(m.get("monto_gs") or 0)
            pct = (m_gs / tot_cobrado * 100) if tot_cobrado > 0 else 0
            mon_txt = "BRL" if "BRL" in m.get("clave", "") else ("USD" if "USD" in m.get("clave", "") else "PYG")
            cant = m.get("cantidad", 0)
            cant_str = f" ({cant})" if cant > 0 else ""
            canal_label = f"{m.get('label', '—')}{cant_str}"
            pay_data.append([
                Paragraph(canal_label, styles["Small"]),
                mon_txt,
                m.get("monto_formateado", "—"),
                _fmt_gs(m_gs),
                f"{pct:.1f}%",
            ])
        pay_data.append([
            "TOTAL FACTURADO EN TICKETS (PYG)",
            "PYG",
            f"{recon.get('total_ventas_count', 0)} tickets emitidos",
            _fmt_gs(tot_cobrado),
            "100.0%",
        ])
        t_pay = Table(pay_data, colWidths=[58 * mm, 18 * mm, 45 * mm, 38 * mm, 27 * mm])
    else:
        pyg_payments = payments_breakdown.get("pyg", [])
        otras_payments = payments_breakdown.get("otras_monedas", [])

        pay_data = [["Medio de Pago", "Moneda", "Cant. Operaciones", "Total Recaudado", "% Participación"]]
        total_recaudado_pyg = sum(p.get("monto", 0) for p in pyg_payments)
        total_ops = sum(p.get("cantidad", 0) for p in pyg_payments)

        for p in pyg_payments:
            pay_data.append([
                p.get("forma_pago", "—"),
                "PYG",
                str(p.get("cantidad", 0)),
                _fmt_gs(p.get("monto", 0)),
                f"{p.get('porcentaje', 0):.1f}%",
            ])

        for p in otras_payments:
            pay_data.append([
                p.get("forma_pago", "—"),
                p.get("moneda", "—"),
                str(p.get("cantidad", 0)),
                f"{p.get('monto', 0):.2f}",
                "—",
            ])

        # Fila de Totales
        pay_data.append([
            "TOTAL VENTAS TURNO (PYG)",
            "PYG",
            str(total_ops),
            _fmt_gs(total_recaudado_pyg),
            "100.0%",
        ])
        t_pay = Table(pay_data, colWidths=[60 * mm, 20 * mm, 30 * mm, 46 * mm, 30 * mm])

    t_pay.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), HexColor("#F1F5F9")),
        ("TEXTCOLOR", (0, 0), (-1, 0), HexColor("#0F172A")),
        ("FONTNAME", (0, 0), (-1, 0), FONT_BOLD),
        ("FONTSIZE", (0, 0), (-1, -1), 7.5),
        ("ALIGN", (2, 0), (4, -1), "RIGHT"),
        ("BOX", (0, 0), (-1, -1), 0.5, HexColor("#CBD5E1")),
        ("LINEBELOW", (0, 0), (-1, 0), 1.0, HexColor("#94A3B8")),
        ("ROWBACKGROUNDS", (0, 1), (-1, -2), [WHITE, HexColor("#F8FAFC")]),
        ("FONTNAME", (0, -1), (-1, -1), FONT_BOLD),
        ("BACKGROUND", (0, -1), (-1, -1), HexColor("#F1F5F9")),
        ("LINEABOVE", (0, -1), (-1, -1), 1.0, HexColor("#0F172A")),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
    ]))
    elements.append(t_pay)
    elements.append(Spacer(1, 10))

    # 4. HISTORIAL DE RETIROS PARCIALES (CASH DROPS)
    elements.append(Paragraph("<b>3. REGISTRO DE RETIROS PARCIALES (CASH DROPS / SANGRÍAS)</b>", styles["Normal"]))
    elements.append(Spacer(1, 4))

    if not cash_drops:
        elements.append(Paragraph("No se registraron retiros parciales de efectivo durante este turno.", styles["Small"]))
    else:
        cd_data = [["Hora Solicitud", "Solicitado Por", "Monto Retirado", "Confirmado Por", "Estado Bóveda"]]
        for cd in cash_drops:
            dt_str = cd.get("created_at")
            if hasattr(dt_str, "strftime"):
                dt_loc = _to_asuncion_tz(dt_str)
                dt_fmt = dt_loc.strftime("%H:%M:%S") if dt_loc else "—"
            else:
                dt_fmt = str(dt_str)[11:19] if dt_str else "—"
            
            m_str = _fmt_gs(cd.get("monto_confirmado_pyg") or cd.get("monto_pyg") or 0)
            if cd.get("monto_usd"):
                m_str += f" + US${cd['monto_usd']:.2f}"
            if cd.get("monto_brl"):
                m_str += f" + R${cd['monto_brl']:.2f}"

            cd_data.append([
                dt_fmt,
                cd.get("solicitado_por_nombre") or "Cajero",
                m_str,
                cd.get("confirmado_por_nombre") or "—",
                (cd.get("estado") or "pendiente").upper(),
            ])
        t_cd = Table(cd_data, colWidths=[26 * mm, 45 * mm, 45 * mm, 45 * mm, 25 * mm])
        t_cd.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), HexColor("#F1F5F9")),
            ("TEXTCOLOR", (0, 0), (-1, 0), HexColor("#0F172A")),
            ("FONTNAME", (0, 0), (-1, 0), FONT_BOLD),
            ("FONTSIZE", (0, 0), (-1, -1), 7.5),
            ("ALIGN", (2, 0), (2, -1), "RIGHT"),
            ("ALIGN", (4, 0), (4, -1), "CENTER"),
            ("BOX", (0, 0), (-1, -1), 0.5, HexColor("#CBD5E1")),
            ("LINEBELOW", (0, 0), (-1, 0), 1.0, HexColor("#94A3B8")),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [WHITE, HexColor("#F8FAFC")]),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
            ("TOPPADDING", (0, 0), (-1, -1), 3),
        ]))
        elements.append(t_cd)

    elements.append(Spacer(1, 14))

    # 5. OBSERVACIONES Y DOBLE FIRMA DE CUSTODIA
    if s.get("observaciones"):
        elements.append(Paragraph(f"<b>Observaciones:</b> {s['observaciones']}", styles["Small"]))
        elements.append(Spacer(1, 12))

    firmas_data = [
        ["_________________________________________", "_________________________________________"],
        ["FIRMA Y ACLARACIÓN DEL CAJERO/A", "FIRMA Y ACLARACIÓN DE LA SUPERVISORA"],
        [f"Cajero/a: {s.get('cajero_nombre') or '—'}", "Recepción y Verificación en Bóveda"],
        ["Fecha: ____/____/________   Hora: ____:____", "Fecha: ____/____/________   Hora: ____:____"],
    ]
    t_firmas = Table(firmas_data, colWidths=[93 * mm, 93 * mm])
    t_firmas.setStyle(TableStyle([
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("FONTSIZE", (0, 0), (-1, -1), 7.5),
        ("FONTNAME", (0, 1), (-1, 1), FONT_BOLD),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
        ("TOPPADDING", (0, 0), (-1, -1), 2),
    ]))
    elements.append(t_firmas)

    _build(doc, elements)
    return buffer.getvalue()


def generate_treasury_remittance_pdf(
    company: dict,
    remittance: dict,
    items: list[dict],
    generated_by: str = "",
) -> bytes:
    """Genera el remito oficial de entrega de valores de Supervisión a Tesorería."""
    buffer = io.BytesIO()
    doc, styles = _base_doc(buffer, f"Remito de Valores #{remittance.get('numero', '')}", company, generated_by)
    
    fecha_envio_str = ""
    if remittance.get("fecha_envio"):
        fe = remittance["fecha_envio"]
        fe_loc = _to_asuncion_tz(fe) if hasattr(fe, "strftime") else None
        fecha_envio_str = fe_loc.strftime("%d/%m/%Y %H:%M") if fe_loc else str(fe)[:16]

    elements = _company_header(
        company,
        styles,
        f"REMITO DE ENTREGA DE VALORES #{remittance.get('numero', '')}",
        f"Fecha y Hora de Envío: {fecha_envio_str} | Estado: {(remittance.get('estado') or '').upper()}",
        generated_by,
    )

    # 1. METADATOS DEL REMITO
    info_data = [
        [
            Paragraph(f"<b>Supervisora Responsable:</b> {remittance.get('supervisor_nombre') or '—'}", styles["Small"]),
            Paragraph(f"<b>Receptor Tesorería:</b> {remittance.get('tesorero_nombre') or 'Pendiente de Recepción'}", styles["Small"]),
        ],
        [
            Paragraph(f"<b>Total Sobres Rendidos:</b> {remittance.get('total_sobres') or len(items)} sobres", styles["Small"]),
            Paragraph(f"<b>Estado Actual:</b> {(remittance.get('estado') or 'en_transito').upper()}", styles["Small"]),
        ],
    ]
    t_info = Table(info_data, colWidths=[93 * mm, 93 * mm])
    t_info.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), GRAY_LIGHT),
        ("PADDING", (0, 0), (-1, -1), 4),
    ]))
    elements.append(t_info)
    elements.append(Spacer(1, 8))

    # 2. TOTALES RESUMEN
    resumen_rows = [
        ("Total Sobres Declarados", str(len(items)), False),
        ("Total Efectivo Guaraníes (PYG)", _fmt_gs(remittance.get("total_pyg") or 0), True),
    ]
    if remittance.get("total_usd") and float(remittance["total_usd"]) > 0:
        resumen_rows.append(("Total Efectivo Dólares (USD)", f"US$ {float(remittance['total_usd']):.2f}", False))
    if remittance.get("total_brl") and float(remittance["total_brl"]) > 0:
        resumen_rows.append(("Total Efectivo Reales (BRL)", f"R$ {float(remittance['total_brl']):.2f}", False))
    
    elements.append(_totals_table(resumen_rows))
    elements.append(Spacer(1, 10))

    # 3. DETALLE SOBRE POR SOBRE (CAJAS RENDIDAS)
    elements.append(Paragraph("<b>DETALLE DE SOBRES Y CAJAS RENDIDAS</b>", styles["Normal"]))
    elements.append(Spacer(1, 4))

    table_data = [["Nº", "Caja", "Cajero/a Emisor/a", "Tipo Sobre", "Guaraníes (PYG)", "USD / BRL", "Revisión Tesorería"]]
    for i, it in enumerate(items, start=1):
        tipo_lbl = "SANGRÍA (DROP)" if it.get("tipo_sobre") == "sangria" else "CIERRE DE TURNO"
        m_pyg = _fmt_gs(it.get("monto_pyg") or 0)
        
        divisas = []
        if it.get("monto_usd") and float(it["monto_usd"]) > 0:
            divisas.append(f"US$ {float(it['monto_usd']):.2f}")
        if it.get("monto_brl") and float(it["monto_brl"]) > 0:
            divisas.append(f"R$ {float(it['monto_brl']):.2f}")
        divisas_str = " + ".join(divisas) if divisas else "—"

        verif_str = "[ CONFORME ]" if it.get("verificado_tesoreria") else "[ PENDIENTE ]"

        table_data.append([
            str(i),
            it.get("caja_nombre") or it.get("caja_codigo") or "Caja",
            it.get("cajero_nombre") or "—",
            tipo_lbl,
            m_pyg,
            divisas_str,
            verif_str,
        ])

    t_items = Table(table_data, colWidths=[8 * mm, 34 * mm, 42 * mm, 30 * mm, 28 * mm, 24 * mm, 20 * mm], repeatRows=1)
    t_items.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), PRIMARY_COLOR),
        ("TEXTCOLOR", (0, 0), (-1, 0), WHITE),
        ("FONTNAME", (0, 0), (-1, 0), FONT_BOLD),
        ("FONTSIZE", (0, 0), (-1, -1), 7),
        ("ALIGN", (0, 0), (0, -1), "CENTER"),
        ("ALIGN", (4, 0), (5, -1), "RIGHT"),
        ("ALIGN", (6, 0), (6, -1), "CENTER"),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [WHITE, GRAY_LIGHT]),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
    ]))
    elements.append(t_items)
    elements.append(Spacer(1, 14))

    # 4. OBSERVACIONES
    if remittance.get("observaciones"):
        elements.append(Paragraph(f"<b>Observaciones:</b> {remittance['observaciones']}", styles["Small"]))
        elements.append(Spacer(1, 12))

    # 5. DOBLE FIRMA DE CUSTODIA Y RECEPCIÓN
    firmas_data = [
        ["_________________________________________", "_________________________________________"],
        ["ENTREGADO POR (SUPERVISIÓN)", "RECIBIDO Y CONSOLIDADO EN BÓVEDA"],
        [f"Supervisora: {remittance.get('supervisor_nombre') or '—'}", f"Tesorería: {remittance.get('tesorero_nombre') or '____________________'}"],
        ["Fecha: ____/____/________   Hora: ____:____", "Fecha: ____/____/________   Hora: ____:____"],
    ]
    t_firmas = Table(firmas_data, colWidths=[93 * mm, 93 * mm])
    t_firmas.setStyle(TableStyle([
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("FONTSIZE", (0, 0), (-1, -1), 7.5),
        ("FONTNAME", (0, 1), (-1, 1), FONT_BOLD),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
        ("TOPPADDING", (0, 0), (-1, -1), 2),
    ]))
    elements.append(t_firmas)

    _build(doc, elements)
    return buffer.getvalue()


# ── Reporte PDF: Ventas por Cajero ─────────────────────────────────────

def generate_ventas_por_cajero_pdf(
    company: dict,
    report_data: dict,
    fecha_desde: date | str,
    fecha_hasta: date | str,
    generated_by: str = "",
) -> bytes:
    """Genera el reporte institucional en PDF (A4 Portrait) de ventas agrupadas por cajero/usuario."""
    from decimal import Decimal
    buffer = io.BytesIO()
    doc, styles = _base_doc(buffer, "Reporte de Ventas por Cajero", company, generated_by)

    f_desde_str = fecha_desde.strftime("%d/%m/%Y") if isinstance(fecha_desde, (date, datetime)) else str(fecha_desde)
    f_hasta_str = fecha_hasta.strftime("%d/%m/%Y") if isinstance(fecha_hasta, (date, datetime)) else str(fecha_hasta)
    subtitulo = f"Período Auditado: Del {f_desde_str} al {f_hasta_str}"
    if report_data.get("cajero_filtro"):
        subtitulo += f" | Cajero Filtrado: {report_data['cajero_filtro']}"

    elements = _company_header(
        company, styles, "REPORTE CONSOLIDADO DE VENTAS POR CAJERO",
        subtitulo, generated_by,
    )

    totales = report_data.get("totales", {})
    cajeros = report_data.get("cajeros", [])

    # 1. KPI CARDS
    tot_ventas = Decimal(str(totales.get("total_ventas") or 0))
    tot_tickets = totales.get("total_tickets") or 0
    tix_prom = Decimal(str(totales.get("ticket_promedio_general") or 0))
    cajeros_activos = totales.get("total_cajeros_activos") or len(cajeros)

    kpi_style_val = ParagraphStyle("KVal", fontName=FONT_BOLD, fontSize=11, textColor=PRIMARY_COLOR, alignment=1)
    kpi_style_sub = ParagraphStyle("KSub", fontName="Helvetica", fontSize=7, textColor=GRAY_MEDIUM, alignment=1)

    kpi_data = [
        [
            [Paragraph("TOTAL VENTAS BRUTAS", kpi_style_sub), Paragraph(_fmt_gs(tot_ventas), kpi_style_val)],
            [Paragraph("CANTIDAD DE TICKETS", kpi_style_sub), Paragraph(f"{tot_tickets:,}".replace(",", "."), kpi_style_val)],
            [Paragraph("TICKET PROMEDIO", kpi_style_sub), Paragraph(_fmt_gs(tix_prom), kpi_style_val)],
            [Paragraph("CAJEROS ACTIVOS", kpi_style_sub), Paragraph(str(cajeros_activos), kpi_style_val)],
        ]
    ]
    t_kpi = Table(kpi_data, colWidths=[46.5 * mm, 46.5 * mm, 46.5 * mm, 46.5 * mm])
    t_kpi.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), HexColor("#F1F5F9")),
        ("BOX", (0, 0), (-1, -1), 0.5, HexColor("#CBD5E1")),
        ("LINEAFTER", (0, 0), (-2, 0), 0.5, HexColor("#CBD5E1")),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]))
    elements.append(t_kpi)
    elements.append(Spacer(1, 12))

    # 2. TABLA DE CAJEROS
    table_data = [[
        Paragraph("<font size=7.5 color='white'><b>#</b></font>", styles["Normal"]),
        Paragraph("<font size=7.5 color='white'><b>NOMBRE DEL CAJERO / USUARIO</b></font>", styles["Normal"]),
        Paragraph("<font size=7.5 color='white'><b>TURNOS</b></font>", ParagraphStyle("ThC", parent=styles["Normal"], alignment=1)),
        Paragraph("<font size=7.5 color='white'><b>TICKETS</b></font>", ParagraphStyle("ThR", parent=styles["Normal"], alignment=2)),
        Paragraph("<font size=7.5 color='white'><b>TICKET PROM. (₲)</b></font>", ParagraphStyle("ThR2", parent=styles["Normal"], alignment=2)),
        Paragraph("<font size=7.5 color='white'><b>TOTAL FACTURADO (₲)</b></font>", ParagraphStyle("ThR3", parent=styles["Normal"], alignment=2)),
        Paragraph("<font size=7.5 color='white'><b>% PART.</b></font>", ParagraphStyle("ThR4", parent=styles["Normal"], alignment=2)),
    ]]

    for i, c in enumerate(cajeros, start=1):
        c_monto = Decimal(str(c.get("total_ventas") or 0))
        pct = (c_monto / tot_ventas * 100) if tot_ventas > 0 else Decimal("0")
        table_data.append([
            str(i),
            c.get("cajero_nombre") or "Cajero",
            str(c.get("cantidad_turnos") or 1),
            f"{c.get('cantidad_tickets', 0):,}".replace(",", "."),
            _fmt_val(c.get("ticket_promedio")),
            _fmt_val(c_monto),
            f"{float(pct):.1f}%",
        ])

    # Fila de Totales
    table_data.append([
        "",
        "TOTALES GENERALES",
        "",
        f"{tot_tickets:,}".replace(",", "."),
        _fmt_val(tix_prom),
        _fmt_val(tot_ventas),
        "100.0%",
    ])

    t_cajeros = Table(table_data, colWidths=[8 * mm, 60 * mm, 16 * mm, 22 * mm, 30 * mm, 34 * mm, 16 * mm], repeatRows=1)
    t_cajeros.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), PRIMARY_COLOR),
        ("FONTNAME", (0, 0), (-1, 0), FONT_BOLD),
        ("FONTSIZE", (0, 0), (-1, -1), 7.5),
        ("ALIGN", (0, 0), (0, -1), "CENTER"),
        ("ALIGN", (2, 0), (2, -1), "CENTER"),
        ("ALIGN", (3, 0), (-1, -1), "RIGHT"),
        ("ROWBACKGROUNDS", (0, 1), (-1, -2), [WHITE, GRAY_LIGHT]),
        ("BACKGROUND", (0, -1), (-1, -1), HexColor("#E2E8F0")),
        ("FONTNAME", (0, -1), (-1, -1), FONT_BOLD),
        ("LINEABOVE", (0, -1), (-1, -1), 1, PRIMARY_COLOR),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
    ]))
    elements.append(t_cajeros)
    elements.append(Spacer(1, 16))

    # 3. FIRMAS
    firmas = [
        ["_________________________________________", "_________________________________________"],
        ["RESPONSABLE DE AUDITORÍA / CAJAS", "GERENCIA DE ADMINISTRACIÓN Y FINANZAS"],
        ["Extra Supermercado Mayorista", "GRUPO SANTA TERESA E.A.S."],
    ]
    t_firmas = Table(firmas, colWidths=[93 * mm, 93 * mm])
    t_firmas.setStyle(TableStyle([
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("FONTSIZE", (0, 0), (-1, -1), 7.5),
        ("FONTNAME", (0, 1), (-1, 1), FONT_BOLD),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
    ]))
    elements.append(KeepTogether([t_firmas]))

    _build(doc, elements)
    return buffer.getvalue()


# ── Reporte PDF: Ventas por Medio de Pago ─────────────────────────────

def generate_ventas_por_medio_pago_pdf(
    company: dict,
    report_data: dict,
    fecha_desde: date | str,
    fecha_hasta: date | str,
    generated_by: str = "",
) -> bytes:
    """Genera el reporte institucional en PDF (A4 Portrait) de recaudación agrupada por medios de pago."""
    from decimal import Decimal
    buffer = io.BytesIO()
    doc, styles = _base_doc(buffer, "Reporte de Recaudación por Medios de Pago", company, generated_by)

    f_desde_str = fecha_desde.strftime("%d/%m/%Y") if isinstance(fecha_desde, (date, datetime)) else str(fecha_desde)
    f_hasta_str = fecha_hasta.strftime("%d/%m/%Y") if isinstance(fecha_hasta, (date, datetime)) else str(fecha_hasta)
    subtitulo = f"Período Auditado: Del {f_desde_str} al {f_hasta_str}"

    elements = _company_header(
        company, styles, "REPORTE DE RECAUDACIÓN POR MEDIOS DE PAGO",
        subtitulo, generated_by,
    )

    tot_recaudado = Decimal(str(report_data.get("total_recaudado_pyg") or 0))
    tot_ops = report_data.get("total_operaciones") or 0
    brl_monto = Decimal(str(report_data.get("efectivo_brl_recaudado") or 0))
    usd_monto = Decimal(str(report_data.get("efectivo_usd_recaudado") or 0))
    medios = report_data.get("medios_pago", [])

    kpi_style_val = ParagraphStyle("KValMP", fontName=FONT_BOLD, fontSize=11, textColor=PRIMARY_COLOR, alignment=1)
    kpi_style_sub = ParagraphStyle("KSubMP", fontName="Helvetica", fontSize=7, textColor=GRAY_MEDIUM, alignment=1)

    kpi_data = [
        [
            [Paragraph("TOTAL RECAUDADO (PYG)", kpi_style_sub), Paragraph(_fmt_gs(tot_recaudado), kpi_style_val)],
            [Paragraph("TOTAL OPERACIONES", kpi_style_sub), Paragraph(f"{tot_ops:,}".replace(",", "."), kpi_style_val)],
            [Paragraph("REALES EN GAVETA (R$)", kpi_style_sub), Paragraph(f"R$ {_fmt_val(brl_monto, is_divisa=True)}", kpi_style_val)],
            [Paragraph("DÓLARES EN GAVETA (US$)", kpi_style_sub), Paragraph(f"US$ {_fmt_val(usd_monto, is_divisa=True)}", kpi_style_val)],
        ]
    ]
    t_kpi = Table(kpi_data, colWidths=[46.5 * mm, 46.5 * mm, 46.5 * mm, 46.5 * mm])
    t_kpi.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), HexColor("#F1F5F9")),
        ("BOX", (0, 0), (-1, -1), 0.5, HexColor("#CBD5E1")),
        ("LINEAFTER", (0, 0), (-2, 0), 0.5, HexColor("#CBD5E1")),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]))
    elements.append(t_kpi)
    elements.append(Spacer(1, 12))

    table_data = [[
        Paragraph("<font size=7.5 color='white'><b>#</b></font>", styles["Normal"]),
        Paragraph("<font size=7.5 color='white'><b>CANAL / MEDIO DE COBRO</b></font>", styles["Normal"]),
        Paragraph("<font size=7.5 color='white'><b>MONEDA</b></font>", ParagraphStyle("ThCM", parent=styles["Normal"], alignment=1)),
        Paragraph("<font size=7.5 color='white'><b>TRANSACCIONES</b></font>", ParagraphStyle("ThRM", parent=styles["Normal"], alignment=2)),
        Paragraph("<font size=7.5 color='white'><b>MONTO TOTAL RECAUDADO</b></font>", ParagraphStyle("ThRM2", parent=styles["Normal"], alignment=2)),
        Paragraph("<font size=7.5 color='white'><b>% DEL TOTAL (PYG)</b></font>", ParagraphStyle("ThRM3", parent=styles["Normal"], alignment=2)),
    ]]

    for i, m in enumerate(medios, start=1):
        mon = m.get("moneda", "PYG")
        m_val = m.get("monto", 0)
        if mon == "BRL":
            m_str = f"R$ {_fmt_val(m_val, is_divisa=True)}"
            pct_str = "Divisa"
        elif mon == "USD":
            m_str = f"US$ {_fmt_val(m_val, is_divisa=True)}"
            pct_str = "Divisa"
        else:
            m_str = f"₲ {_fmt_val(m_val)}"
            pct_str = f"{m.get('porcentaje', 0):.1f}%"

        table_data.append([
            str(i),
            Paragraph(m.get("label", "Medio de Pago"), styles["Small"]),
            mon,
            f"{m.get('operaciones', 0):,}".replace(",", "."),
            m_str,
            pct_str,
        ])

    # Fila de Totales
    table_data.append([
        "",
        Paragraph("<b>TOTAL COBRADO EN GUARANÍES</b>", styles["Small"]),
        "PYG",
        f"{tot_ops:,}".replace(",", "."),
        f"₲ {_fmt_val(tot_recaudado)}",
        "100.0%",
    ])

    t_medios = Table(table_data, colWidths=[8 * mm, 68 * mm, 18 * mm, 28 * mm, 38 * mm, 26 * mm], repeatRows=1)
    t_medios.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), PRIMARY_COLOR),
        ("FONTNAME", (0, 0), (-1, 0), FONT_BOLD),
        ("FONTSIZE", (0, 0), (-1, -1), 7.5),
        ("ALIGN", (0, 0), (0, -1), "CENTER"),
        ("ALIGN", (2, 0), (2, -1), "CENTER"),
        ("ALIGN", (3, 0), (-1, -1), "RIGHT"),
        ("ROWBACKGROUNDS", (0, 1), (-1, -2), [WHITE, GRAY_LIGHT]),
        ("BACKGROUND", (0, -1), (-1, -1), HexColor("#E2E8F0")),
        ("FONTNAME", (0, -1), (-1, -1), FONT_BOLD),
        ("LINEABOVE", (0, -1), (-1, -1), 1, PRIMARY_COLOR),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
    ]))
    elements.append(t_medios)
    elements.append(Spacer(1, 16))

    firmas = [
        ["_________________________________________", "_________________________________________"],
        ["RESPONSABLE DE TESORERÍA / BÓVEDA", "GERENCIA DE ADMINISTRACIÓN Y FINANZAS"],
        ["Extra Supermercado Mayorista", "GRUPO SANTA TERESA E.A.S."],
    ]
    t_firmas = Table(firmas, colWidths=[93 * mm, 93 * mm])
    t_firmas.setStyle(TableStyle([
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("FONTSIZE", (0, 0), (-1, -1), 7.5),
        ("FONTNAME", (0, 1), (-1, 1), FONT_BOLD),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
    ]))
    elements.append(KeepTogether([t_firmas]))

    _build(doc, elements)
    return buffer.getvalue()


def generate_punteo_vouchers_pdf(
    company: dict,
    session_data: dict,
    summary_by_method: dict,
    vouchers: list[dict],
    generated_by: str = "",
) -> bytes:
    """Planilla Oficial de Punteo de Arqueo y Control Cruzado de Comprobantes.
    Permite cotejo físico individual con casillas [ ] de verificación,
    desglose bimonetario inmutable y triple firma de responsabilidad."""
    buffer = io.BytesIO()
    doc, styles = _base_doc(buffer, "Planilla de Punteo de Arqueo", company, generated_by)
    s = session_data
    apertura_dt = s.get("fecha_apertura")
    cierre_dt = s.get("fecha_cierre")
    subtitulo = f"Caja: {s.get('register_nombre') or '—'}  |  Cajero/a: {s.get('cajero_nombre') or '—'}"

    elements = _company_header(
        company, styles, "Planilla Oficial de Punteo de Arqueo y Control de Vouchers",
        subtitulo,
        generated_by,
    )

    # 1. Metadatos de la sesión
    ap_local = _to_asuncion_tz(apertura_dt)
    ci_local = _to_asuncion_tz(cierre_dt)
    apertura_str = ap_local.strftime("%d/%m/%Y %H:%M:%S") if ap_local else "—"
    cierre_str = ci_local.strftime("%d/%m/%Y %H:%M:%S") if ci_local else "En curso"

    meta_data = [
        ["Cajero/a:", Paragraph(f"<b>{s.get('cajero_nombre') or '—'}</b>", styles["Normal"]), "Terminal / Caja:", Paragraph(f"<b>{s.get('register_nombre') or '—'}</b>", styles["Normal"])],
        ["Fecha Apertura:", apertura_str, "Fecha Cierre:", cierre_str],
        ["ID Sesión:", str(s.get("id", "—"))[:8].upper(), "Estado:", str(s.get("estado", "cerrada")).upper()],
    ]
    t_meta = Table(meta_data, colWidths=[28 * mm, 65 * mm, 28 * mm, 65 * mm])
    t_meta.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (0, -1), FONT_BOLD),
        ("FONTNAME", (2, 0), (2, -1), FONT_BOLD),
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
        ("TOPPADDING", (0, 0), (-1, -1), 2),
    ]))
    elements.append(t_meta)
    elements.append(Spacer(1, 8))

    # 2. Resumen por instrumento
    elements.append(Paragraph("<b>1. RESUMEN DE COMPROBANTES ESPERADOS POR INSTRUMENTO</b>", styles["Normal"]))
    elements.append(Spacer(1, 3))

    res_headers = ["Instrumento de Pago", "Cant. Comprobantes", "Monto Esperado (Gs.)"]
    res_rows = [res_headers]
    total_cant = 0
    total_monto_no_ef = Decimal("0")

    for k, v in summary_by_method.items():
        cant = v.get("cantidad", 0)
        monto = Decimal(str(v.get("monto_gs", 0)))
        if cant > 0 or monto > 0:
            total_cant += cant
            total_monto_no_ef += monto
            res_rows.append([Paragraph(v.get("label", k), styles["Small"]), str(cant), _fmt_gs(monto)])

    res_rows.append([Paragraph("<b>TOTAL MEDIOS NO EFECTIVO</b>", styles["Small"]), str(total_cant), _fmt_gs(total_monto_no_ef)])

    t_res = Table(res_rows, colWidths=[96 * mm, 35 * mm, 55 * mm])
    t_res.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), PRIMARY_COLOR),
        ("TEXTCOLOR", (0, 0), (-1, 0), WHITE),
        ("FONTNAME", (0, 0), (-1, 0), FONT_BOLD),
        ("FONTSIZE", (0, 0), (-1, -1), 7.5),
        ("ALIGN", (1, 0), (1, -1), "CENTER"),
        ("ALIGN", (2, 0), (2, -1), "RIGHT"),
        ("ROWBACKGROUNDS", (0, 1), (-1, -2), [WHITE, GRAY_LIGHT]),
        ("BACKGROUND", (0, -1), (-1, -1), HexColor("#E2E8F0")),
        ("FONTNAME", (0, -1), (-1, -1), FONT_BOLD),
        ("LINEABOVE", (0, -1), (-1, -1), 1, PRIMARY_COLOR),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2.5),
        ("TOPPADDING", (0, 0), (-1, -1), 2.5),
    ]))
    elements.append(t_res)
    elements.append(Spacer(1, 8))

    # 3. Lista detallada voucher por voucher para punteo físico
    elements.append(Paragraph("<b>2. LISTA DETALLADA DE TRANSACCIONES / VOUCHERS PARA PUNTEO FÍSICO Y PERTINENCIA</b>", styles["Normal"]))
    elements.append(Paragraph("<font color='#64748B' size=6.5>Coteje cada comprobante físico contra el reporte: verifique número de ticket, código de autorización del POS y monto exacto.</font>", styles["Small"]))
    elements.append(Spacer(1, 4))

    style_v_cell = ParagraphStyle("VCell", parent=styles["Normal"], fontSize=6, leading=7.5)
    style_v_center = ParagraphStyle("VCellC", parent=style_v_cell, alignment=TA_CENTER)
    style_v_right = ParagraphStyle("VCellR", parent=style_v_cell, alignment=TA_RIGHT)

    v_headers = ["[  ]", "Hora", "Ticket / Factura", "Medio / Tarjeta", "Boleta / Aut. / NSU", "Moneda", "Monto Orig.", "Monto Gs.", "Dictamen"]
    v_rows = [v_headers]

    for v in vouchers:
        dt = v.get("fecha")
        local_dt = _to_asuncion_tz(dt) if dt else None
        hora_str = local_dt.strftime("%H:%M:%S") if local_dt else "—"
        
        tarjeta_info = str(v.get("medio_pago") or v.get("forma_pago") or "—")
        if v.get("tarjeta_marca") and v.get("tarjeta_marca") != "—":
            tarjeta_info += f" ({v['tarjeta_marca']})"

        aut_parts = []
        if v.get("nro_boleta") and v.get("nro_boleta") != "—":
            aut_parts.append(f"Bol: {v['nro_boleta']}")
        if v.get("codigo_autorizacion") and v.get("codigo_autorizacion") != "—":
            aut_parts.append(f"Aut: {v['codigo_autorizacion']}")
        if v.get("nsu") and v.get("nsu") != "—":
            aut_parts.append(f"NSU: {v['nsu']}")
        aut_info = "<br/>".join(aut_parts) if aut_parts else "—"

        v_rows.append([
            "[   ]",
            hora_str,
            Paragraph(str(v.get("numero_ticket") or v.get("numero_venta") or "—"), style_v_center),
            Paragraph(tarjeta_info, style_v_cell),
            Paragraph(aut_info, style_v_center),
            str(v.get("moneda") or "PYG"),
            _fmt_val(v.get("monto_original", v.get("monto", 0)), is_divisa=v.get("moneda") != "PYG"),
            _fmt_gs(v.get("monto_gs", v.get("monto", 0))),
            Paragraph("<font size=5 color='#334155'><b>CONF [ ]<br/>FALT [ ]</b></font>", style_v_center),
        ])

    if len(vouchers) == 0:
        v_rows.append(["—", "—", "Sin comprobantes registrados", "—", "—", "—", "—", "—", "—"])

    # Anchos milimétricos exactos: 8+14+24+34+36+12+18+20+20 = 186mm
    t_v = Table(v_rows, colWidths=[8 * mm, 14 * mm, 24 * mm, 34 * mm, 36 * mm, 12 * mm, 18 * mm, 20 * mm, 20 * mm], repeatRows=1)
    t_v.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), HexColor("#334155")),
        ("TEXTCOLOR", (0, 0), (-1, 0), WHITE),
        ("FONTNAME", (0, 0), (-1, 0), FONT_BOLD),
        ("FONTSIZE", (0, 0), (-1, -1), 6.5),
        ("ALIGN", (0, 0), (0, -1), "CENTER"),
        ("ALIGN", (1, 0), (1, -1), "CENTER"),
        ("ALIGN", (5, 0), (5, -1), "CENTER"),
        ("ALIGN", (6, 0), (7, -1), "RIGHT"),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [WHITE, GRAY_LIGHT]),
        ("GRID", (0, 0), (-1, -1), 0.5, HexColor("#CBD5E1")),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
        ("TOPPADDING", (0, 0), (-1, -1), 2),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]))
    elements.append(t_v)
    elements.append(Spacer(1, 10))

    # 4. Cuadro de Arqueo y Control de Diferencias de Comprobantes
    tot_vouchers_count = len(vouchers)
    tot_vouchers_gs = sum(v.get("monto_gs", v.get("monto", 0)) for v in vouchers)
    resumen_control = [
        ["CONTROL DE COMPROBANTES FÍSICOS", "TOTAL EN SISTEMA", "TOTAL RENDIDO EN SOBRE", "DIFERENCIA (FALTANTE / SOBRANTE)"],
        [
            f"Vouchers y Comprobantes Auditados ({tot_vouchers_count} operaciones)",
            _fmt_gs(tot_vouchers_gs),
            "Gs. ________________________",
            "Gs. ________________________ [  ] CONFORME   [  ] DESCUADRE",
        ]
    ]
    t_ctrl = Table(resumen_control, colWidths=[60 * mm, 34 * mm, 44 * mm, 48 * mm])
    t_ctrl.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), HexColor("#F1F5F9")),
        ("FONTNAME", (0, 0), (-1, 0), FONT_BOLD),
        ("FONTSIZE", (0, 0), (-1, -1), 7),
        ("BOX", (0, 0), (-1, -1), 0.5, HexColor("#94A3B8")),
        ("GRID", (0, 0), (-1, -1), 0.5, HexColor("#CBD5E1")),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
    ]))
    elements.append(KeepTogether([
        Paragraph("<b>3. DICTAMEN DE ARQUEO Y CONTROL DE DIFERENCIAS</b>", styles["Normal"]),
        Spacer(1, 3),
        t_ctrl,
        Spacer(1, 10),
    ]))

    # 5. Firmas institucionales
    firmas = [
        ["_________________________________________", "_________________________________________", "_________________________________________"],
        ["FIRMA CAJERO/A", "FIRMA SUPERVISOR DE CAJA", "FIRMA AUDITORÍA / TESORERÍA"],
        [s.get("cajero_nombre") or "Cajero/a", "Supervisor de Turno", "GRUPO SANTA TERESA E.A.S."],
    ]
    t_firmas = Table(firmas, colWidths=[62 * mm, 62 * mm, 62 * mm])
    t_firmas.setStyle(TableStyle([
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("FONTSIZE", (0, 0), (-1, -1), 7.5),
        ("FONTNAME", (0, 1), (-1, 1), FONT_BOLD),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
    ]))
    elements.append(KeepTogether([t_firmas]))

    _build(doc, elements)
    return buffer.getvalue()


def generate_session_sales_pdf(
    company: dict,
    sales_detail: dict,
    generated_by: str = "",
) -> bytes:
    """Informe Detallado de Ventas de la Sesión en formato A4 Portrait.
    Incluye membrete fiscal institucional de Extra Supermercado, métricas
    clave, desglose consolidado por medios de pago y el listado comprobante
    por comprobante con hora paraguaya, cliente, RUC y montos."""
    buffer = io.BytesIO()
    doc, styles = _base_doc(buffer, "Informe Detallado de Ventas", company, generated_by)

    sess = sales_detail.get("session", {})
    tot = sales_detail.get("totales", {})
    desglose = sales_detail.get("desglose_medios", [])
    sales = sales_detail.get("sales", [])

    subtitulo = f"Caja: {sess.get('register_nombre') or 'Caja'}  |  Cajero/a: {sess.get('cajero_nombre') or '—'}"
    elements = _company_header(
        company, styles, "INFORME DETALLADO DE VENTAS DE CAJA",
        subtitulo,
        generated_by,
    )

    # 1. Metadatos de la sesión
    meta_data = [
        ["Caja / Terminal:", Paragraph(f"<b>{sess.get('register_nombre') or '—'}</b>", styles["Normal"]), "Cajero/a:", Paragraph(f"<b>{sess.get('cajero_nombre') or '—'}</b>", styles["Normal"])],
        ["Fecha Apertura:", sess.get("fecha_apertura_local") or "—", "Fecha Cierre:", sess.get("fecha_cierre_local") or "—"],
        ["Estado Sesión:", (sess.get("estado") or "cerrada").upper(), "ID Turno:", str(sess.get("id", "—"))[:8].upper()],
    ]
    t_meta = Table(meta_data, colWidths=[30 * mm, 63 * mm, 30 * mm, 63 * mm])
    t_meta.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (0, -1), FONT_BOLD),
        ("FONTNAME", (2, 0), (2, -1), FONT_BOLD),
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
        ("TOPPADDING", (0, 0), (-1, -1), 2),
    ]))
    elements.append(t_meta)
    elements.append(Spacer(1, 8))

    # 2. Resumen Financiero (KPIs)
    elements.append(Paragraph("<b>1. RESUMEN FINANCIERO Y RENDIMIENTO DEL TURNO</b>", styles["Normal"]))
    elements.append(Spacer(1, 4))

    style_kpi_cell = ParagraphStyle(
        "KpiSalesCell",
        parent=styles["Normal"],
        alignment=TA_CENTER,
        leading=11,
    )
    kpis_table = [
        [
            Paragraph(f"<font size=5.8 color='#64748B'><b>TOTAL FACTURADO</b></font><br/><font size=9.5 color='#0F172A'><b>{_fmt_gs(tot.get('total_ventas_gs', 0))}</b></font>", style_kpi_cell),
            Paragraph(f"<font size=5.8 color='#64748B'><b>TICKETS EMITIDOS</b></font><br/><font size=9.5 color='#0F172A'><b>{tot.get('cantidad_ventas', 0)}</b></font>", style_kpi_cell),
            Paragraph(f"<font size=5.8 color='#64748B'><b>TICKET PROMEDIO</b></font><br/><font size=9.5 color='#0F172A'><b>{_fmt_gs(tot.get('ticket_promedio_gs', 0))}</b></font>", style_kpi_cell),
            Paragraph(f"<font size=5.8 color='#64748B'><b>VENTAS EFECTIVO</b></font><br/><font size=9.5 color='#059669'><b>{_fmt_gs(tot.get('ventas_efectivo_gs', 0))}</b></font>", style_kpi_cell),
            Paragraph(f"<font size=5.8 color='#64748B'><b>VENTAS NO EFECTIVO</b></font><br/><font size=9.5 color='#1E40AF'><b>{_fmt_gs(tot.get('ventas_no_efectivo_gs', 0))}</b></font>", style_kpi_cell),
        ]
    ]
    t_kpis = Table(kpis_table, colWidths=[37.2 * mm, 37.2 * mm, 37.2 * mm, 37.2 * mm, 37.2 * mm])
    t_kpis.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), HexColor("#F8FAFC")),
        ("BOX", (0, 0), (-1, -1), 0.5, HexColor("#CBD5E1")),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]))
    elements.append(t_kpis)
    elements.append(Spacer(1, 8))

    # 3. Desglose Consolidado por Medios de Pago
    if desglose:
        elements.append(Paragraph("<b>2. DESGLOSE CONSOLIDADO POR MEDIOS DE PAGO (100% EN GUARANÍES)</b>", styles["Normal"]))
        elements.append(Spacer(1, 4))

        tot_v = float(tot.get("total_ventas_gs") or 1)
        medios_rows = [["Medio de Pago", "Detalle Moneda Original", "Total Recaudado (₲)", "% Facturación"]]
        for m in desglose:
            m_gs = float(m.get("monto_gs") or 0)
            pct = (m_gs / tot_v * 100) if tot_v > 0 else 0
            cant = m.get("cantidad")
            cant_str = f" ({cant})" if cant else ""
            label_text = f"{m.get('label', '—')}{cant_str}"
            medios_rows.append([
                Paragraph(label_text, styles["Small"]),
                m.get("monto_formateado", "—"),
                _fmt_gs(m_gs),
                f"{pct:.1f}%",
            ])
        medios_rows.append([
            Paragraph("<b>TOTAL FACTURADO EN TICKETS</b>", styles["Small"]),
            "—",
            _fmt_gs(tot.get("total_ventas_gs", 0)),
            "100.0%",
        ])
        t_med = Table(medios_rows, colWidths=[62 * mm, 48 * mm, 46 * mm, 30 * mm])
        t_med.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), HexColor("#F1F5F9")),
            ("TEXTCOLOR", (0, 0), (-1, 0), HexColor("#0F172A")),
            ("FONTNAME", (0, 0), (-1, 0), FONT_BOLD),
            ("FONTSIZE", (0, 0), (-1, -1), 7.5),
            ("ALIGN", (2, 0), (3, -1), "RIGHT"),
            ("BOX", (0, 0), (-1, -1), 0.5, HexColor("#CBD5E1")),
            ("LINEBELOW", (0, 0), (-1, 0), 1.0, HexColor("#94A3B8")),
            ("ROWBACKGROUNDS", (0, 1), (-1, -2), [WHITE, HexColor("#F8FAFC")]),
            ("FONTNAME", (0, -1), (-1, -1), FONT_BOLD),
            ("BACKGROUND", (0, -1), (-1, -1), HexColor("#F1F5F9")),
            ("LINEABOVE", (0, -1), (-1, -1), 1.0, HexColor("#0F172A")),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
            ("TOPPADDING", (0, 0), (-1, -1), 3),
        ]))
        elements.append(t_med)
        elements.append(Spacer(1, 10))

    # 4. Listado Detallado de Ventas / Tickets
    elements.append(Paragraph(f"<b>3. COMPROBANTES Y TICKETS EMITIDOS ({len(sales)} OPERACIONES)</b>", styles["Normal"]))
    elements.append(Spacer(1, 4))

    sales_header = ["N° Comprobante", "Hora", "Cliente / Razón Social", "RUC / C.I.", "Forma de Pago", "Total (₲)"]
    sales_rows = [sales_header]

    for s_item in sales:
        sales_rows.append([
            s_item.get("numero_interno") or s_item.get("numero") or "—",
            s_item.get("hora_local") or "—",
            (s_item.get("cliente_nombre") or "Consumidor Final")[:28],
            s_item.get("cliente_ruc") or "X",
            (s_item.get("forma_pago_resumen") or "Efectivo")[:20],
            _fmt_gs(s_item.get("total", 0)),
        ])

    # Fila de Total
    sales_rows.append([
        "TOTAL GENERAL COMPROBANTES",
        "",
        "",
        "",
        f"{len(sales)} tickets",
        _fmt_gs(tot.get("total_ventas_gs", 0)),
    ])

    t_sales = Table(sales_rows, colWidths=[30 * mm, 16 * mm, 54 * mm, 24 * mm, 38 * mm, 24 * mm])
    t_sales.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), HexColor("#F1F5F9")),
        ("TEXTCOLOR", (0, 0), (-1, 0), HexColor("#0F172A")),
        ("FONTNAME", (0, 0), (-1, 0), FONT_BOLD),
        ("FONTSIZE", (0, 0), (-1, -1), 7),
        ("ALIGN", (1, 0), (1, -1), "CENTER"),
        ("ALIGN", (5, 0), (5, -1), "RIGHT"),
        ("BOX", (0, 0), (-1, -1), 0.5, HexColor("#CBD5E1")),
        ("LINEBELOW", (0, 0), (-1, 0), 1.0, HexColor("#94A3B8")),
        ("ROWBACKGROUNDS", (0, 1), (-1, -2), [WHITE, HexColor("#F8FAFC")]),
        ("FONTNAME", (0, -1), (-1, -1), FONT_BOLD),
        ("BACKGROUND", (0, -1), (-1, -1), HexColor("#F1F5F9")),
        ("LINEABOVE", (0, -1), (-1, -1), 1.0, HexColor("#0F172A")),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2.5),
        ("TOPPADDING", (0, 0), (-1, -1), 2.5),
    ]))
    elements.append(t_sales)
    elements.append(Spacer(1, 14))

    # 5. Firmas de Cierre
    firmas_data = [
        ["_________________________________________", "_________________________________________"],
        ["FIRMA DEL CAJERO/A", "SUPERVISIÓN / AUDITORÍA DE CAJA"],
        [f"Cajero/a: {sess.get('cajero_nombre') or '—'}", "Revisión y Control de Comprobantes"],
        ["Fecha: ____/____/________", "Fecha: ____/____/________"],
    ]
    t_firmas = Table(firmas_data, colWidths=[93 * mm, 93 * mm])
    t_firmas.setStyle(TableStyle([
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("FONTNAME", (0, 1), (-1, 1), FONT_BOLD),
        ("FONTSIZE", (0, 0), (-1, -1), 7.5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
        ("TOPPADDING", (0, 0), (-1, -1), 2),
    ]))
    elements.append(KeepTogether([t_firmas]))

    _build(doc, elements)
    return buffer.getvalue()



