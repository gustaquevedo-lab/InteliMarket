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
