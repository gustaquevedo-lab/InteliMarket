"""Reportes PDF de Caja/Bóveda — Fase 4 del overhaul. Reusa los helpers
visuales compartidos de integrated_finance.pdf_reports (mismo estilo que
Bancos, AP y AR) en vez de reimplementar estilos de tabla."""
import io
from datetime import date

from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, Spacer, Table, TableStyle

from api.src.integrated_finance.pdf_reports import (
    _base_doc, _company_header, _fmt_gs, _build, _totals_table,
    RED, GRAY_LIGHT, PRIMARY_COLOR, WHITE, FONT_BOLD,
)


def generate_arqueo_diario_pdf(company: dict, sessiones: list[dict], fecha_desde: date, fecha_hasta: date, generated_by: str = "") -> bytes:
    buffer = io.BytesIO()
    doc, styles = _base_doc(buffer, "Arqueo de Caja", company, generated_by)
    elements = _company_header(
        company, styles, "Arqueo de Caja",
        f"Del {fecha_desde.strftime('%d/%m/%Y')} al {fecha_hasta.strftime('%d/%m/%Y')}",
        generated_by,
    )

    if not sessiones:
        elements.append(Paragraph("Sin cierres de caja en el período seleccionado.", styles["Small"]))
        _build(doc, elements)
        return buffer.getvalue()

    total_esperado = sum(s.get("monto_cierre_esperado") or 0 for s in sessiones)
    total_contado = sum(s.get("monto_cierre") or 0 for s in sessiones)
    total_diferencia = sum(s.get("diferencia") or 0 for s in sessiones)
    con_revision = sum(1 for s in sessiones if s.get("requiere_revision"))

    resumen_rows = [
        ("Cierres en el período", str(len(sessiones)), False),
        ("Total esperado", _fmt_gs(total_esperado), False),
        ("Total contado", _fmt_gs(total_contado), False),
        ("Diferencia acumulada", _fmt_gs(total_diferencia), True),
        ("Cierres que requieren revisión", str(con_revision), False),
    ]
    elements.append(_totals_table(resumen_rows))
    elements.append(Spacer(1, 10))

    header = ["Cajero", "Caja", "Cierre", "Esperado", "Contado", "Diferencia"]
    data = [header]
    for s in sessiones:
        diferencia = s.get("diferencia")
        data.append([
            s.get("cajero_nombre") or "—",
            s.get("register_nombre") or "—",
            s["fecha_cierre"].strftime("%d/%m/%Y %H:%M") if s.get("fecha_cierre") else "—",
            _fmt_gs(s.get("monto_cierre_esperado") or 0),
            _fmt_gs(s.get("monto_cierre") or 0),
            _fmt_gs(diferencia) if diferencia is not None else "s/d",
        ])

    t = Table(data, colWidths=[32 * mm, 22 * mm, 30 * mm, 28 * mm, 28 * mm, 28 * mm], repeatRows=1)
    style_cmds = [
        ("BACKGROUND", (0, 0), (-1, 0), PRIMARY_COLOR),
        ("TEXTCOLOR", (0, 0), (-1, 0), WHITE),
        ("FONTNAME", (0, 0), (-1, 0), FONT_BOLD),
        ("FONTSIZE", (0, 0), (-1, -1), 7.5),
        ("ALIGN", (3, 0), (5, -1), "RIGHT"),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [WHITE, GRAY_LIGHT]),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
    ]
    for i, s in enumerate(sessiones, start=1):
        if s.get("requiere_revision"):
            style_cmds.append(("TEXTCOLOR", (5, i), (5, i), RED))
    t.setStyle(TableStyle(style_cmds))
    elements.append(t)

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
        data.append([
            e["origen"].replace("_", " ").title(),
            e["created_at"].strftime("%d/%m/%Y %H:%M"),
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
    apertura_str = apertura_dt.strftime("%d/%m/%Y %H:%M:%S") if apertura_dt else "—"
    cierre_str = cierre_dt.strftime("%d/%m/%Y %H:%M:%S") if cierre_dt else "—"
    
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
    if contado_usd > 0 or s.get("efectivo_usd_esperado") or diferencia_usd != 0:
        dif_usd_str = f"{'+' if diferencia_usd >= 0 else ''}{diferencia_usd:.2f}"
        arqueo_rows.append([
            "USD (US$)",
            "0.00",
            f"{s.get('efectivo_usd_esperado', 0):.2f}",
            f"{s.get('efectivo_usd_esperado', 0):.2f}",
            f"{contado_usd:.2f}",
            dif_usd_str,
            "EXACTO" if diferencia_usd == 0 else "DESCUADRE",
        ])

    # BRL (si hubo movimiento o conteo)
    if contado_brl > 0 or s.get("efectivo_brl_esperado") or diferencia_brl != 0:
        dif_brl_str = f"{'+' if diferencia_brl >= 0 else ''}{diferencia_brl:.2f}"
        arqueo_rows.append([
            "BRL (R$)",
            "0.00",
            f"{s.get('efectivo_brl_esperado', 0):.2f}",
            f"{s.get('efectivo_brl_esperado', 0):.2f}",
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
                dt_fmt = dt_str.strftime("%H:%M:%S")
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

