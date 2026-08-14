"""Reportes financieros imprimibles — Fase 2 del overhaul de Reportes.

El Estado de Resultados NO se reimplementa acá -- se reusa tal cual
integrated_finance.pdf_reports.generate_pnl_pdf, que ya existe y ya se usa
en Contabilidad Integrada, alimentado con el motor de datos de Gerencial
(gerencial.service.get_pnl_data), que es el que ya cubre ventas + costo +
gastos reales de caja chica. Construir un tercer calculo de P&L acá
hubiera repetido exactamente el problema de motores duplicados que se
encontro y documento en Contabilidad Integrada Fase 4.

Lo que sí es nuevo acá es el Flujo de Caja detallado dia a dia, que no
tenia ninguna version imprimible -- reusa _compute_daily_cash_flow
(financial/service.py, el mismo motor real que ya alimenta el Flujo de
Caja premium de Cuentas por Pagar) y los helpers visuales compartidos de
integrated_finance.pdf_reports para mantener el mismo estilo que el resto
de los PDF del sistema.

Balance General queda deliberadamente FUERA de este overhaul: Capital
Social y Resultados Acumulados nunca recibieron un asiento de apertura
real (0 movimientos, ver auditoria de Contabilidad Integrada) -- generar
un Balance General hoy produciria un documento con aspecto oficial pero
que no cuadra (Activo != Pasivo + Patrimonio), mas enganoso que utíl.
"""

import io
from datetime import date

from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, Spacer, Table, TableStyle

from api.src.integrated_finance.pdf_reports import (
    _base_doc, _company_header, _fmt_gs, _build, _totals_table,
    RED, GRAY_LIGHT, PRIMARY_COLOR, WHITE, FONT_BOLD,
)


def generate_cash_flow_pdf(company: dict, dias_calc: list[dict], dias: int, generated_by: str = "") -> bytes:
    buffer = io.BytesIO()
    doc, styles = _base_doc(buffer, "Flujo de Caja Proyectado", company, generated_by)
    elements = _company_header(
        company, styles, "Flujo de Caja Proyectado",
        f"Proyección a {dias} días — desde {date.today().strftime('%d/%m/%Y')}",
        generated_by,
    )

    if not dias_calc:
        elements.append(Paragraph("Sin cuentas bancarias activas ni movimientos proyectables.", styles["Small"]))
        _build(doc, elements)
        return buffer.getvalue()

    saldo_inicial = dias_calc[0]["saldo_inicial"]
    saldo_final = dias_calc[-1]["saldo_final_proyectado"]
    total_ingresos = sum(d["ingresos_estimados"] for d in dias_calc)
    total_egresos = sum(d["egresos_estimados"] for d in dias_calc)

    resumen_rows = [
        ("Saldo bancario actual", _fmt_gs(saldo_inicial), False),
        ("Total ingresos proyectados (CxC)", _fmt_gs(total_ingresos), False),
        ("Total egresos proyectados (CxP)", _fmt_gs(total_egresos), False),
        (f"Saldo proyectado a {dias} días", _fmt_gs(saldo_final), True),
    ]
    elements.append(_totals_table(resumen_rows))
    elements.append(Spacer(1, 10))

    # Para no imprimir 90 filas sueltas, se muestra semana a semana salvo
    # que el rango sea corto (30 días o menos, ahi se muestra dia a dia).
    filas = dias_calc if dias <= 30 else [d for i, d in enumerate(dias_calc) if i % 7 == 0 or d is dias_calc[-1]]

    header = ["Fecha", "Saldo Inicial", "Ingresos Est.", "Egresos Est.", "Saldo Proyectado"]
    data = [header]
    for d in filas:
        data.append([
            d["fecha"].strftime("%d/%m/%Y"),
            _fmt_gs(d["saldo_inicial"]),
            _fmt_gs(d["ingresos_estimados"]),
            _fmt_gs(d["egresos_estimados"]),
            _fmt_gs(d["saldo_final_proyectado"]),
        ])

    t = Table(data, colWidths=[26 * mm, 36 * mm, 34 * mm, 34 * mm, 36 * mm], repeatRows=1)
    style_cmds = [
        ("BACKGROUND", (0, 0), (-1, 0), PRIMARY_COLOR),
        ("TEXTCOLOR", (0, 0), (-1, 0), WHITE),
        ("FONTNAME", (0, 0), (-1, 0), FONT_BOLD),
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("ALIGN", (1, 0), (4, -1), "RIGHT"),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [WHITE, GRAY_LIGHT]),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
    ]
    for i, d in enumerate(filas, start=1):
        if d["saldo_final_proyectado"] < 0:
            style_cmds.append(("TEXTCOLOR", (4, i), (4, i), RED))
    t.setStyle(TableStyle(style_cmds))
    elements.append(t)

    negativos = [d for d in dias_calc if d["saldo_final_proyectado"] < 0]
    elements.append(Spacer(1, 10))
    if negativos:
        primer_negativo = negativos[0]
        estilo_alerta = styles["Small"]
        elements.append(Paragraph(
            f"⚠ Proyección de saldo negativo a partir del {primer_negativo['fecha'].strftime('%d/%m/%Y')} "
            f"({_fmt_gs(primer_negativo['saldo_final_proyectado'])}).",
            estilo_alerta,
        ))
    elements.append(Paragraph(
        "Ingresos = cuentas por cobrar con vencimiento en la fecha. Egresos = cuentas por pagar con vencimiento "
        "en la fecha. Es una proyección sobre lo ya facturado, no incluye ventas o compras futuras aún no registradas.",
        styles["Small"],
    ))

    _build(doc, elements)
    return buffer.getvalue()
