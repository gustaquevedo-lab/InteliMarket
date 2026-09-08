"""Reportes PDF de Caja/Bóveda — Fase 4 del overhaul. Reusa los helpers
visuales compartidos de integrated_finance.pdf_reports (mismo estilo que
Bancos, AP y AR) en vez de reimplementar estilos de tabla."""
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
from reportlab.platypus import Paragraph, Spacer, Table, TableStyle, KeepTogether

from api.src.integrated_finance.pdf_reports import (
    _base_doc, _company_header, _fmt_gs, _build, _totals_table,
    RED, GRAY_LIGHT, PRIMARY_COLOR, WHITE, FONT_BOLD,
    GRAY_DARK, GRAY_MEDIUM,
)


def generate_arqueo_diario_pdf(company: dict, sessiones: list[dict], fecha_desde: date, fecha_hasta: date, generated_by: str = "") -> bytes:
    """Acta de Arqueo y Conciliación Consolidada de Cajas en formato vertical A4.
    Detalla por cajera/cajero, todas las formas de pago (PYG, BRL, USD, Tarjetas,
    Transferencias, Cheques, Otros) y las diferencias con dictamen de auditoría."""
    buffer = io.BytesIO()
    doc, styles = _base_doc(buffer, "Acta de Arqueo Consolidado de Cajas", company, generated_by)
    
    # Ancho útil A4 vertical con márgenes de 12mm: 210mm - 24mm = 186mm
    USABLE_W = 186 * mm

    subtitulo = f"Período auditado: Del {fecha_desde.strftime('%d/%m/%Y')} al {fecha_hasta.strftime('%d/%m/%Y')}"
    elements = _company_header(
        company, styles, "ACTA DE ARQUEO CONSOLIDADO DE CAJAS",
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

    # Acumulados por forma de pago
    sum_efectivo_pyg = sum(s.get("monto_efectivo") or 0 for s in sessiones)
    sum_efectivo_brl = sum(s.get("monto_efectivo_brl") or 0 for s in sessiones)
    sum_efectivo_usd = sum(s.get("monto_efectivo_usd") or 0 for s in sessiones)
    sum_tarjeta = sum(s.get("monto_tarjeta") or 0 for s in sessiones)
    sum_transferencia = sum(s.get("monto_transferencia") or 0 for s in sessiones)
    sum_cheque = sum(s.get("monto_cheque") or 0 for s in sessiones)
    sum_otro = sum(s.get("monto_otro") or 0 for s in sessiones)

    # ─────────────────────────────────────────────────────────────────────────
    # 1. KPI CARDS RESUMEN (4 tarjetas horizontales = 186 mm / 4 = 46.5 mm c/u)
    # ─────────────────────────────────────────────────────────────────────────
    dif_color = "#059669" if total_diferencia == 0 else ("#DC2626" if total_diferencia < 0 else "#D97706")
    dif_signo = "+" if total_diferencia > 0 else ""
    card_dif_text = f"{dif_signo}{_fmt_gs(total_diferencia)}"

    kpi_data = [
        [
            Paragraph("<font size=6.5 color='#64748B'><b>TOTAL DECLARADO</b></font><br/>"
                      f"<font size=10 color='#0F172A'><b>{_fmt_gs(total_contado)}</b></font><br/>"
                      "<font size=6 color='#94A3B8'>Efectivo + Medios elect.</font>", styles["Normal"]),
            Paragraph("<font size=6.5 color='#64748B'><b>TOTAL ESPERADO</b></font><br/>"
                      f"<font size=10 color='#0F172A'><b>{_fmt_gs(total_esperado)}</b></font><br/>"
                      "<font size=6 color='#94A3B8'>Ventas sistema + Fondo</font>", styles["Normal"]),
            Paragraph("<font size=6.5 color='#64748B'><b>DIFERENCIA NETA</b></font><br/>"
                      f"<font size=10 color='{dif_color}'><b>{card_dif_text}</b></font><br/>"
                      f"<font size=6 color='{dif_color}'><b>{'CONFORME' if total_diferencia == 0 else ('FALTANTE' if total_diferencia < 0 else 'SOBRANTE')}</b></font>", styles["Normal"]),
            Paragraph("<font size=6.5 color='#64748B'><b>SESIONES AUDITADAS</b></font><br/>"
                      f"<font size=10 color='#0F172A'><b>{len(sessiones)} Turnos</b></font><br/>"
                      f"<font size=6 color='{'#DC2626' if con_revision > 0 else '#059669'}'><b>{con_revision} con descuadre</b></font>", styles["Normal"]),
        ]
    ]
    t_kpis = Table(kpi_data, colWidths=[46.5 * mm, 46.5 * mm, 46.5 * mm, 46.5 * mm])
    t_kpis.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), HexColor("#F8FAFC")),
        ("BOX", (0, 0), (0, 0), 0.5, HexColor("#E2E8F0")),
        ("BOX", (1, 0), (1, 0), 0.5, HexColor("#E2E8F0")),
        ("BOX", (2, 0), (2, 0), 0.5, HexColor("#E2E8F0")),
        ("BOX", (3, 0), (3, 0), 0.5, HexColor("#E2E8F0")),
        ("PADDING", (0, 0), (-1, -1), 5),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]))
    elements.append(t_kpis)
    elements.append(Spacer(1, 6))

    # ─────────────────────────────────────────────────────────────────────────
    # 2. CONSOLIDADO GENERAL POR MEDIOS DE PAGO Y MONEDAS
    # ─────────────────────────────────────────────────────────────────────────
    resumen_mp_data = [
        [
            Paragraph("<font size=7.5><b>Efectivo Guaraníes (PYG):</b></font>", styles["Normal"]),
            Paragraph(f"<font size=7.5><b>{_fmt_gs(sum_efectivo_pyg)}</b></font>", styles["Normal"]),
            Paragraph("<font size=7.5><b>Tarjetas (Débito/Crédito):</b></font>", styles["Normal"]),
            Paragraph(f"<font size=7.5><b>{_fmt_gs(sum_tarjeta)}</b></font>", styles["Normal"]),
        ],
        [
            Paragraph("<font size=7.5><b>Efectivo Reales (R$):</b></font>", styles["Normal"]),
            Paragraph(f"<font size=7.5><b>R$ {sum_efectivo_brl:,.2f}</b></font>", styles["Normal"]),
            Paragraph("<font size=7.5><b>Transferencias / QR / PIX:</b></font>", styles["Normal"]),
            Paragraph(f"<font size=7.5><b>{_fmt_gs(sum_transferencia)}</b></font>", styles["Normal"]),
        ],
        [
            Paragraph("<font size=7.5><b>Efectivo Dólares (US$):</b></font>", styles["Normal"]),
            Paragraph(f"<font size=7.5><b>US$ {sum_efectivo_usd:,.2f}</b></font>", styles["Normal"]),
            Paragraph("<font size=7.5><b>Cheques / Vales / Otros:</b></font>", styles["Normal"]),
            Paragraph(f"<font size=7.5><b>{_fmt_gs(sum_cheque + sum_otro)}</b></font>", styles["Normal"]),
        ],
    ]
    t_resumen_mp = Table(resumen_mp_data, colWidths=[46 * mm, 47 * mm, 46 * mm, 47 * mm])
    t_resumen_mp.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), HexColor("#F1F5F9")),
        ("BOX", (0, 0), (-1, -1), 0.5, HexColor("#CBD5E1")),
        ("INNERGRID", (0, 0), (-1, -1), 0.25, HexColor("#E2E8F0")),
        ("PADDING", (0, 0), (-1, -1), 3),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("ALIGN", (1, 0), (1, -1), "RIGHT"),
        ("ALIGN", (3, 0), (3, -1), "RIGHT"),
    ]))
    elements.append(t_resumen_mp)
    elements.append(Spacer(1, 8))

    # ─────────────────────────────────────────────────────────────────────────
    # 3. DETALLE INDIVIDUAL POR CAJERA Y TERMINAL (GRILLA VERTICAL A4)
    # ─────────────────────────────────────────────────────────────────────────
    elements.append(Paragraph("<font size=8.5 color='#1E293B'><b>DETALLE CONSOLIDADO POR CAJERA/O Y TERMINAL</b></font>", styles["Normal"]))
    elements.append(Spacer(1, 3))

    # Columnas principales: 50 + 26 + 20 + 30 + 30 + 30 = 186 mm
    header_row = [
        Paragraph("<font size=7.5 color='#FFFFFF'><b>Cajero/a</b></font>", styles["Normal"]),
        Paragraph("<font size=7.5 color='#FFFFFF'><b>Caja / Terminal</b></font>", styles["Normal"]),
        Paragraph("<font size=7.5 color='#FFFFFF'><b>Cierre</b></font>", styles["Normal"]),
        Paragraph("<font size=7.5 color='#FFFFFF'><b>Esperado</b></font>", styles["MetaRight"]),
        Paragraph("<font size=7.5 color='#FFFFFF'><b>Declarado</b></font>", styles["MetaRight"]),
        Paragraph("<font size=7.5 color='#FFFFFF'><b>Diferencia</b></font>", styles["MetaRight"]),
    ]
    table_rows = [header_row]

    style_cmds = [
        ("BACKGROUND", (0, 0), (-1, 0), PRIMARY_COLOR),
        ("BOTTOMPADDING", (0, 0), (-1, 0), 3.5),
        ("TOPPADDING", (0, 0), (-1, 0), 3.5),
        ("VALIGN", (0, 0), (-1, 0), "MIDDLE"),
    ]

    row_idx = 1
    for s in sessiones:
        fc_loc = _to_asuncion_tz(s.get("fecha_cierre"))
        fc_str = fc_loc.strftime("%d/%m %H:%M") if fc_loc else "—"
        
        ap_loc = _to_asuncion_tz(s.get("fecha_apertura"))
        ap_str = ap_loc.strftime("%H:%M") if ap_loc else ""

        esp = s.get("monto_cierre_esperado") or 0
        cont = (s.get("monto_total") if s.get("monto_total") is not None else s.get("monto_cierre")) or 0
        dif = s.get("diferencia") if s.get("diferencia") is not None else (cont - esp)
        req_rev = bool(s.get("requiere_revision") or dif != 0)

        dif_txt = _fmt_gs(dif) if dif is not None else "s/d"
        if dif and dif > 0:
            dif_txt = f"+{dif_txt}"

        estado_badge = "REVISIÓN" if req_rev else "EXACTO"
        badge_color = "#DC2626" if req_rev else "#059669"

        ap_badge = f" <font size=6 color='#64748B'>(Ap: {ap_str})</font>" if ap_str else ""
        cajero_cell = Paragraph(
            f"<b>{s.get('cajero_nombre') or '—'}</b>{ap_badge}",
            styles["Small"],
        )
        caja_cell = Paragraph(f"<font size=7.5>{s.get('register_nombre') or 'Caja'}</font>", styles["Normal"])
        cierre_cell = Paragraph(f"<font size=7.5>{fc_str}</font>", styles["Normal"])
        esp_cell = Paragraph(f"<font size=7.5>{_fmt_gs(esp)}</font>", styles["MetaRight"])
        cont_cell = Paragraph(f"<font size=7.5><b>{_fmt_gs(cont)}</b></font>", styles["MetaRight"])
        dif_cell = Paragraph(
            f"<font size=7.5 color='{badge_color}'><b>{dif_txt}</b></font> "
            f"<font size=6 color='{badge_color}'>[{estado_badge}]</font>",
            styles["MetaRight"],
        )

        table_rows.append([cajero_cell, caja_cell, cierre_cell, esp_cell, cont_cell, dif_cell])

        # Fila B: Desglose exhaustivo de formas de pago declaradas
        m_ef_pyg = s.get("monto_efectivo") or 0
        m_ef_brl = s.get("monto_efectivo_brl") or 0
        m_ef_usd = s.get("monto_efectivo_usd") or 0
        m_tarj = s.get("monto_tarjeta") or 0
        m_transf = s.get("monto_transferencia") or 0
        m_cheq = s.get("monto_cheque") or 0
        m_otro = s.get("monto_otro") or 0
        obs = (s.get("observaciones") or "").strip()

        breakdown_text = (
            f"<b>Desglose Medios:</b> "
            f"Efec. Gs: <b>{_fmt_gs(m_ef_pyg)}</b> · "
            f"Reales: <b>R$ {m_ef_brl:,.2f}</b> · "
            f"Dólares: <b>US$ {m_ef_usd:,.2f}</b> · "
            f"Tarjetas: <b>{_fmt_gs(m_tarj)}</b> · "
            f"Transf/QR: <b>{_fmt_gs(m_transf)}</b>"
        )
        if m_cheq > 0:
            breakdown_text += f" · Cheques: <b>{_fmt_gs(m_cheq)}</b>"
        if m_otro > 0:
            breakdown_text += f" · Otros: <b>{_fmt_gs(m_otro)}</b>"
        if obs:
            breakdown_text += f"<br/><font color='#475569'><i>Obs: {obs}</i></font>"

        breakdown_cell = Paragraph(f"<font size=6.5 color='#334155'>{breakdown_text}</font>", styles["Normal"])
        table_rows.append([breakdown_cell, "", "", "", "", ""])

        # Estilos para este par de filas
        bg_main = WHITE if (row_idx // 2) % 2 == 0 else HexColor("#F8FAFC")
        bg_sub = HexColor("#F1F5F9") if (row_idx // 2) % 2 == 0 else HexColor("#E2E8F0")

        # Fila A styles
        style_cmds.extend([
            ("BACKGROUND", (0, row_idx), (-1, row_idx), bg_main),
            ("TOPPADDING", (0, row_idx), (-1, row_idx), 2.5),
            ("BOTTOMPADDING", (0, row_idx), (-1, row_idx), 1),
            ("VALIGN", (0, row_idx), (-1, row_idx), "MIDDLE"),
        ])
        # Fila B styles (colspan total de 0 a 5)
        style_cmds.extend([
            ("SPAN", (0, row_idx + 1), (5, row_idx + 1)),
            ("BACKGROUND", (0, row_idx + 1), (-1, row_idx + 1), bg_sub),
            ("TOPPADDING", (0, row_idx + 1), (-1, row_idx + 1), 1),
            ("BOTTOMPADDING", (0, row_idx + 1), (-1, row_idx + 1), 2.5),
            ("LINEBELOW", (0, row_idx + 1), (-1, row_idx + 1), 0.5, HexColor("#CBD5E1")),
        ])

        row_idx += 2

    # Fila de Totales Finales
    tot_dif_txt = _fmt_gs(total_diferencia)
    if total_diferencia > 0:
        tot_dif_txt = f"+{tot_dif_txt}"

    totales_label = Paragraph("<font size=7.5 color='#FFFFFF'><b>TOTALES GENERALES CONSOLIDADOS</b></font>", styles["Normal"])
    tot_esp_cell = Paragraph(f"<font size=7.5 color='#FFFFFF'><b>{_fmt_gs(total_esperado)}</b></font>", styles["MetaRight"])
    tot_cont_cell = Paragraph(f"<font size=7.5 color='#FFFFFF'><b>{_fmt_gs(total_contado)}</b></font>", styles["MetaRight"])
    tot_dif_cell = Paragraph(f"<font size=7.5 color='#FFFFFF'><b>{tot_dif_txt}</b></font>", styles["MetaRight"])

    table_rows.append([totales_label, "", "", tot_esp_cell, tot_cont_cell, tot_dif_cell])
    style_cmds.extend([
        ("SPAN", (0, row_idx), (2, row_idx)),
        ("BACKGROUND", (0, row_idx), (-1, row_idx), PRIMARY_COLOR),
        ("TOPPADDING", (0, row_idx), (-1, row_idx), 3.5),
        ("BOTTOMPADDING", (0, row_idx), (-1, row_idx), 3.5),
        ("VALIGN", (0, row_idx), (-1, row_idx), "MIDDLE"),
    ])

    t_main = Table(table_rows, colWidths=[50 * mm, 26 * mm, 20 * mm, 30 * mm, 30 * mm, 30 * mm], repeatRows=1)
    t_main.setStyle(TableStyle(style_cmds))
    elements.append(t_main)
    elements.append(Spacer(1, 8))

    # ─────────────────────────────────────────────────────────────────────────
    # 4. DECLARACIÓN DE CONFORMIDAD Y TRIPLE FIRMA DE AUDITORÍA
    # ─────────────────────────────────────────────────────────────────────────
    aviso_leg = Paragraph(
        "<font size=6.5 color='#64748B'><i>El presente documento constituye el acta oficial de arqueo consolidado "
        "y conciliación de valores físicos y electrónicos procesados en el período. Las diferencias registradas "
        "fueron informadas y quedan sujetas a las normas internas de auditoría y control de caja.</i></font>",
        styles["Normal"],
    )

    firmas_cells = [
        [
            Paragraph(
                "<font size=7 color='#64748B'>____________________________________</font><br/>"
                "<font size=7.5 color='#0F172A'><b>FIRMA Y ACLARACIÓN CAJERO/A</b></font><br/>"
                "<font size=6.5 color='#64748B'>Responsable de Turno<br/>Fecha: ____/____/________</font>",
                styles["Normal"],
            ),
            Paragraph(
                "<font size=7 color='#64748B'>____________________________________</font><br/>"
                "<font size=7.5 color='#0F172A'><b>SUPERVISOR/A DE CAJAS</b></font><br/>"
                "<font size=6.5 color='#64748B'>Verificación y Cuadre Físico<br/>Fecha: ____/____/________</font>",
                styles["Normal"],
            ),
            Paragraph(
                "<font size=7 color='#64748B'>____________________________________</font><br/>"
                "<font size=7.5 color='#0F172A'><b>TESORERÍA / GERENCIA</b></font><br/>"
                "<font size=6.5 color='#64748B'>Recepción y Custodia de Fondos<br/>Fecha: ____/____/________</font>",
                styles["Normal"],
            ),
        ]
    ]
    t_firmas = Table(firmas_cells, colWidths=[62 * mm, 62 * mm, 62 * mm])
    t_firmas.setStyle(TableStyle([
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 2),
        ("RIGHTPADDING", (0, 0), (-1, -1), 2),
        ("TOPPADDING", (0, 0), (-1, -1), 2),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
    ]))

    # KeepTogether garantiza que el aviso y las 3 firmas nunca se dividan entre páginas
    elements.append(KeepTogether([
        aviso_leg,
        Spacer(1, 8),
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

    t = Table(data, colWidths=[32 * mm, 32 * mm, 32 * mm, 28 * mm, 30 * mm], repeatRows=1)
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
    
    meta_data = [
        ["Cajero/a:", s.get("cajero_nombre") or "—", "Caja / Terminal:", s.get("register_nombre") or "—"],
        ["Fecha Apertura:", apertura_str, "Fecha Cierre:", cierre_str],
        ["Estado Sesión:", s.get("estado", "cerrada").upper(), "ID Sesión:", str(s.get("id", "—"))],
    ]
    t_meta = Table(meta_data, colWidths=[30 * mm, 55 * mm, 30 * mm, 65 * mm])
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

    monto_apertura = s.get("monto_apertura") or 0
    monto_cierre_esperado = s.get("monto_cierre_esperado") or 0
    monto_cierre = s.get("monto_cierre") or 0
    diferencia = s.get("diferencia") or 0
    diferencia_usd = s.get("diferencia_usd") or 0
    diferencia_brl = s.get("diferencia_brl") or 0
    contado_usd = s.get("monto_efectivo_usd") or 0
    contado_brl = s.get("monto_efectivo_brl") or 0

    arqueo_header = ["Moneda", "Fondo Apertura", "Cobrado Efectivo", "Total Esperado", "Total Contado", "Diferencia", "Auditoría"]
    arqueo_rows = [arqueo_header]

    # PYG
    dif_pyg_str = f"{'+' if diferencia >= 0 else ''}{_fmt_gs(diferencia)}"
    auditoria_pyg = "REVISIÓN" if s.get("requiere_revision") else "EXACTO" if diferencia == 0 else "DESCUADRE"
    arqueo_rows.append([
        "PYG (Gs.)",
        _fmt_gs(monto_apertura),
        _fmt_gs(s.get("efectivo_cobrado_pyg") or (monto_cierre_esperado - monto_apertura)),
        _fmt_gs(monto_cierre_esperado),
        _fmt_gs(monto_cierre),
        dif_pyg_str,
        auditoria_pyg,
    ])

    # USD (si hubo movimiento o conteo)
    monto_apertura_usd = s.get("monto_apertura_usd") or 0
    monto_apertura_brl = s.get("monto_apertura_brl") or 0
    monto_cierre_esperado_usd = s.get("monto_cierre_esperado_usd") or 0
    monto_cierre_esperado_brl = s.get("monto_cierre_esperado_brl") or 0

    if contado_usd > 0 or s.get("efectivo_usd_esperado") or monto_apertura_usd > 0 or diferencia_usd != 0:
        dif_usd_str = f"{'+' if diferencia_usd >= 0 else ''}{diferencia_usd:.2f}"
        arqueo_rows.append([
            "USD (US$)",
            f"{monto_apertura_usd:.2f}",
            f"{s.get('efectivo_usd_esperado', 0):.2f}",
            f"{monto_cierre_esperado_usd:.2f}",
            f"{contado_usd:.2f}",
            dif_usd_str,
            "EXACTO" if diferencia_usd == 0 else "DESCUADRE",
        ])

    # BRL (si hubo movimiento o conteo)
    if contado_brl > 0 or s.get("efectivo_brl_esperado") or monto_apertura_brl > 0 or diferencia_brl != 0:
        dif_brl_str = f"{'+' if diferencia_brl >= 0 else ''}{diferencia_brl:.2f}"
        arqueo_rows.append([
            "BRL (R$)",
            f"{monto_apertura_brl:.2f}",
            f"{s.get('efectivo_brl_esperado', 0):.2f}",
            f"{monto_cierre_esperado_brl:.2f}",
            f"{contado_brl:.2f}",
            dif_brl_str,
            "EXACTO" if diferencia_brl == 0 else "DESCUADRE",
        ])

    t_arq = Table(arqueo_rows, colWidths=[24 * mm, 26 * mm, 26 * mm, 26 * mm, 26 * mm, 26 * mm, 26 * mm])
    style_arq = [
        ("BACKGROUND", (0, 0), (-1, 0), PRIMARY_COLOR),
        ("TEXTCOLOR", (0, 0), (-1, 0), WHITE),
        ("FONTNAME", (0, 0), (-1, 0), FONT_BOLD),
        ("FONTSIZE", (0, 0), (-1, -1), 7.5),
        ("ALIGN", (1, 0), (5, -1), "RIGHT"),
        ("ALIGN", (6, 0), (6, -1), "CENTER"),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [WHITE, GRAY_LIGHT]),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
    ]
    if s.get("requiere_revision") or diferencia != 0:
        style_arq.append(("TEXTCOLOR", (5, 1), (6, 1), RED))
    t_arq.setStyle(TableStyle(style_arq))
    elements.append(t_arq)
    elements.append(Spacer(1, 10))

    # 3. DESGLOSE DE VENTAS POR MEDIO DE PAGO
    elements.append(Paragraph("<b>2. DESGLOSE DE VENTAS POR MEDIOS DE PAGO DEL TURNO</b>", styles["Normal"]))
    elements.append(Spacer(1, 4))

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

    t_pay = Table(pay_data, colWidths=[55 * mm, 25 * mm, 30 * mm, 40 * mm, 30 * mm])
    t_pay.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), PRIMARY_COLOR),
        ("TEXTCOLOR", (0, 0), (-1, 0), WHITE),
        ("FONTNAME", (0, 0), (-1, 0), FONT_BOLD),
        ("FONTSIZE", (0, 0), (-1, -1), 7.5),
        ("ALIGN", (2, 0), (4, -1), "RIGHT"),
        ("ROWBACKGROUNDS", (0, 1), (-1, -2), [WHITE, GRAY_LIGHT]),
        ("FONTNAME", (0, -1), (-1, -1), FONT_BOLD),
        ("BACKGROUND", (0, -1), (-1, -1), GRAY_LIGHT),
        ("LINEABOVE", (0, -1), (-1, -1), 1, PRIMARY_COLOR),
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
        t_cd = Table(cd_data, colWidths=[30 * mm, 40 * mm, 45 * mm, 40 * mm, 25 * mm])
        t_cd.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), PRIMARY_COLOR),
            ("TEXTCOLOR", (0, 0), (-1, 0), WHITE),
            ("FONTNAME", (0, 0), (-1, 0), FONT_BOLD),
            ("FONTSIZE", (0, 0), (-1, -1), 7.5),
            ("ALIGN", (2, 0), (2, -1), "RIGHT"),
            ("ALIGN", (4, 0), (4, -1), "CENTER"),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [WHITE, GRAY_LIGHT]),
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
    t_firmas = Table(firmas_data, colWidths=[90 * mm, 90 * mm])
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
    t_info = Table(info_data, colWidths=[90 * mm, 90 * mm])
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

    t_items = Table(table_data, colWidths=[8 * mm, 32 * mm, 40 * mm, 30 * mm, 28 * mm, 22 * mm, 20 * mm], repeatRows=1)
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
    t_firmas = Table(firmas_data, colWidths=[90 * mm, 90 * mm])
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


