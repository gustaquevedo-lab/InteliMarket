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


def generate_sales_executive_pdf(company: dict, data: dict, fecha_desde: date | None = None, fecha_hasta: date | None = None, generated_by: str = "") -> bytes:
    """Genera el PDF institucional de 'Ventas con Utilidad' (7 líneas ejecutivas),
    desglose por medios de pago y desempeño por cajera."""
    from reportlab.lib.colors import HexColor
    from reportlab.lib.styles import ParagraphStyle
    from api.src.integrated_finance.pdf_reports import (
        _accent_bar, _fmt_gs, ACCENT_BLUE, GRAY_DARK, GRAY_LIGHT, GRAY_MEDIUM,
        GREEN, PRIMARY_COLOR, RED, WHITE, FONT_BOLD, FONT_REGULAR
    )

    buffer = io.BytesIO()
    doc, styles = _base_doc(buffer, "Informe Ejecutivo de Ventas y Rentabilidad", company, generated_by)

    # Subtítulo con período
    if fecha_desde and fecha_hasta:
        sub_text = f"Período auditado: {fecha_desde.strftime('%d/%m/%Y')} al {fecha_hasta.strftime('%d/%m/%Y')}"
    elif fecha_desde:
        sub_text = f"Desde {fecha_desde.strftime('%d/%m/%Y')} a la fecha"
    elif fecha_hasta:
        sub_text = f"Hasta {fecha_hasta.strftime('%d/%m/%Y')}"
    else:
        sub_text = "Ventas históricas consolidadas"

    elements = _company_header(company, styles, "Informe Ejecutivo de Ventas y Rentabilidad", sub_text, generated_by)
    elements.append(Spacer(1, 4 * mm))

    # 1. Franja ESTRUCTURA DE VENTAS Y UTILIDAD
    elements.append(_accent_bar("1. Estructura de Ventas y Rentabilidad Comercial (7 Líneas)"))
    elements.append(Spacer(1, 2 * mm))

    res = data.get("resumen", {})
    tot_vendido = res.get("total_vendido", 0)
    cmv = res.get("cmv", 0)
    utilidad_bruta = res.get("utilidad_bruta", 0)
    margen_pct = res.get("margen_bruto_pct", 0)
    descuentos = res.get("descuentos_pos", 0)
    devoluciones = res.get("devoluciones_nc", 0)
    neto = res.get("resultado_neto", 0)

    t1_data = [
        ["#", "Concepto Económico / Operativo", "Monto (Gs. / %)", "Naturaleza / Impacto"],
        ["1", "Facturación Bruta (Total Vendido)", _fmt_gs(tot_vendido), "Ventas brutas acumuladas en POS"],
        ["2", "Costo Mercadería Vendida (CMV)", _fmt_gs(cmv), "Costo promedio de reposición"],
        ["3", "Margen / Utilidad Comercial Bruta", _fmt_gs(utilidad_bruta), "Margen comercial bruto (L1 - L2)"],
        ["4", "% Margen Comercial Bruto", f"{margen_pct:.2f}%", "Rentabilidad bruta sobre ventas"],
        ["5", "Descuentos Otorgados en Cajas", _fmt_gs(descuentos), "Promociones y descuentos en POS"],
        ["6", "Devoluciones & Notas de Crédito", _fmt_gs(devoluciones), "Mercadería devuelta por clientes"],
        ["7", "RESULTADO COMERCIAL NETO", _fmt_gs(neto), "Utilidad neta comercial final (L3 - L6)"],
    ]

    t1 = Table(t1_data, colWidths=[10 * mm, 75 * mm, 45 * mm, 56 * mm])
    t1_style = [
        ("BACKGROUND", (0, 0), (-1, 0), PRIMARY_COLOR),
        ("TEXTCOLOR", (0, 0), (-1, 0), WHITE),
        ("FONTNAME", (0, 0), (-1, 0), FONT_BOLD),
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("ALIGN", (2, 0), (2, -1), "RIGHT"),
        ("ALIGN", (0, 0), (0, -1), "CENTER"),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [WHITE, GRAY_LIGHT]),
        ("TOPPADDING", (0, 0), (-1, -1), 3.5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3.5),
        ("BOX", (0, 0), (-1, -1), 0.5, HexColor("#CBD5E1")),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, HexColor("#E2E8F0")),
        # Fila 3: Margen Bruto
        ("FONTNAME", (0, 3), (-1, 3), FONT_BOLD),
        ("TEXTCOLOR", (2, 3), (2, 3), HexColor("#047857")),
        # Fila 7: Resultado Neto
        ("BACKGROUND", (0, 7), (-1, 7), HexColor("#DCFCE7")),
        ("FONTNAME", (0, 7), (-1, 7), FONT_BOLD),
        ("TEXTCOLOR", (0, 7), (-1, 7), HexColor("#14532D")),
        ("TEXTCOLOR", (2, 7), (2, 7), HexColor("#15803D")),
    ]
    if neto < 0:
        t1_style.append(("TEXTCOLOR", (2, 7), (2, 7), RED))
    t1.setStyle(TableStyle(t1_style))
    elements.append(t1)
    elements.append(Spacer(1, 5 * mm))

    # 2. Franja DESGLOSE POR MEDIOS DE PAGO
    elements.append(_accent_bar("2. Desglose por Medios de Pago y Cobranzas en Gaveta"))
    elements.append(Spacer(1, 2 * mm))

    medios = data.get("medios_pago", [])
    t2_data = [["Medio de Pago / Canal", "Moneda", "Operaciones", "Total Recaudado (Gs.)", "% Part."]]
    tot_ops = 0
    tot_monto_medios = 0.0

    for m in medios:
        tot_ops += m.get("cantidad", 0)
        tot_monto_medios += m.get("monto", 0.0)
        t2_data.append([
            m.get("etiqueta", m.get("forma_pago_raw", "")),
            m.get("moneda", "PYG"),
            str(m.get("cantidad", 0)),
            _fmt_gs(m.get("monto", 0)),
            f"{m.get('porcentaje', 0):.1f}%",
        ])

    t2_data.append([
        "TOTAL RECAUDADO",
        "—",
        str(tot_ops),
        _fmt_gs(tot_monto_medios),
        "100.0%",
    ])

    t2 = Table(t2_data, colWidths=[75 * mm, 20 * mm, 25 * mm, 45 * mm, 21 * mm])
    t2_style = [
        ("BACKGROUND", (0, 0), (-1, 0), PRIMARY_COLOR),
        ("TEXTCOLOR", (0, 0), (-1, 0), WHITE),
        ("FONTNAME", (0, 0), (-1, 0), FONT_BOLD),
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("ALIGN", (2, 0), (4, -1), "RIGHT"),
        ("ALIGN", (1, 0), (1, -1), "CENTER"),
        ("ROWBACKGROUNDS", (0, 1), (-1, -2), [WHITE, GRAY_LIGHT]),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("BOX", (0, 0), (-1, -1), 0.5, HexColor("#CBD5E1")),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, HexColor("#E2E8F0")),
        # Fila Total
        ("BACKGROUND", (0, -1), (-1, -1), HexColor("#F1F5F9")),
        ("FONTNAME", (0, -1), (-1, -1), FONT_BOLD),
    ]
    t2.setStyle(TableStyle(t2_style))
    elements.append(t2)
    elements.append(Spacer(1, 5 * mm))

    # 3. Franja DESEMPEÑO POR CAJERA / TURNO
    elements.append(_accent_bar("3. Rendimiento y Productividad por Cajera / Turno"))
    elements.append(Spacer(1, 2 * mm))

    cajeras = data.get("cajeras", [])
    t3_data = [["Cajera / Operador", "Turnos", "Tickets", "Total Ventas (Gs.)", "Descuentos", "Ticket Medio"]]
    tot_tix = 0
    tot_caj_sales = 0.0
    tot_desc = 0.0

    for c in cajeras:
        tot_tix += c.get("tickets", 0)
        tot_caj_sales += c.get("total_ventas", 0.0)
        tot_desc += c.get("descuentos", 0.0)
        t3_data.append([
            c.get("cajera", "Cajera"),
            str(c.get("turnos", 1)),
            str(c.get("tickets", 0)),
            _fmt_gs(c.get("total_ventas", 0)),
            _fmt_gs(c.get("descuentos", 0)),
            _fmt_gs(c.get("ticket_promedio", 0)),
        ])

    ticket_promedio_gen = round(tot_caj_sales / max(tot_tix, 1), 0)
    t3_data.append([
        "TOTAL LINEA DE CAJAS",
        "—",
        str(tot_tix),
        _fmt_gs(tot_caj_sales),
        _fmt_gs(tot_desc),
        _fmt_gs(ticket_promedio_gen),
    ])

    t3 = Table(t3_data, colWidths=[60 * mm, 18 * mm, 20 * mm, 38 * mm, 25 * mm, 25 * mm])
    t3_style = [
        ("BACKGROUND", (0, 0), (-1, 0), PRIMARY_COLOR),
        ("TEXTCOLOR", (0, 0), (-1, 0), WHITE),
        ("FONTNAME", (0, 0), (-1, 0), FONT_BOLD),
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("ALIGN", (1, 0), (-1, -1), "RIGHT"),
        ("ROWBACKGROUNDS", (0, 1), (-1, -2), [WHITE, GRAY_LIGHT]),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("BOX", (0, 0), (-1, -1), 0.5, HexColor("#CBD5E1")),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, HexColor("#E2E8F0")),
        # Fila Total
        ("BACKGROUND", (0, -1), (-1, -1), HexColor("#F1F5F9")),
        ("FONTNAME", (0, -1), (-1, -1), FONT_BOLD),
    ]
    t3.setStyle(TableStyle(t3_style))
    elements.append(t3)
    elements.append(Spacer(1, 4 * mm))

    # Nota legal institucional
    elements.append(Paragraph(
        "<b>Nota de Auditoría:</b> Informe generado para GRUPO SANTA TERESA E.A.S. (Extra Supermercado Mayorista - RUC 80150377-9). "
        "Las ventas operan 100% en Guaraníes (PYG). Los valores registrados en monedas extranjeras (Reales R$ y Dólares US$) corresponden "
        "estrictamente a divisas recibidas como medio de cobro en gaveta conforme a la política fiscal vigente.",
        styles["Small"],
    ))

    _build(doc, elements)
    return buffer.getvalue()


def generate_inventory_valuation_pdf(company: dict, data: dict, fecha_corte: date | None = None, generated_by: str = "") -> bytes:
    """Genera el PDF institucional de Inventario Valorizado con desglose por
    proveedor, depósito y detalle de artículos a fecha de corte."""
    from reportlab.lib.colors import HexColor
    from api.src.integrated_finance.pdf_reports import (
        _accent_bar, _fmt_gs, ACCENT_BLUE, GRAY_DARK, GRAY_LIGHT, GRAY_MEDIUM,
        GREEN, PRIMARY_COLOR, RED, WHITE, FONT_BOLD, FONT_REGULAR
    )

    buffer = io.BytesIO()
    doc, styles = _base_doc(buffer, "Informe de Inventario Valorizado", company, generated_by)

    if fecha_corte:
        sub_text = f"Fecha de Corte: {fecha_corte.strftime('%d/%m/%Y')} — Reconstrucción histórica por Kardex"
    else:
        sub_text = f"Inventario Físico al Día — {date.today().strftime('%d/%m/%Y')}"

    elements = _company_header(company, styles, "Informe de Inventario Valorizado", sub_text, generated_by)
    elements.append(Spacer(1, 4 * mm))

    # 1. Resumen de Capital Inmovilizado
    elements.append(_accent_bar("1. Resumen Ejecutivo de Capital Inmovilizado en Stock"))
    elements.append(Spacer(1, 2 * mm))

    tot_val = data.get("total_value", 0)
    tot_skus = data.get("total_products", 0)
    tot_units = data.get("total_units", 0)

    t1_data = [
        ["Capital Total en Inventario", "Total SKUs Activos", "Total Unidades Físicas"],
        [_fmt_gs(tot_val), f"{tot_skus:,}".replace(",", "."), f"{int(tot_units):,}".replace(",", ".")],
    ]
    t1 = Table(t1_data, colWidths=[70 * mm, 58 * mm, 58 * mm])
    t1.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), PRIMARY_COLOR),
        ("TEXTCOLOR", (0, 0), (-1, 0), WHITE),
        ("FONTNAME", (0, 0), (-1, 0), FONT_BOLD),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [HexColor("#F8FAFC")]),
        ("FONTNAME", (0, 1), (-1, 1), FONT_BOLD),
        ("TEXTCOLOR", (0, 1), (0, 1), HexColor("#047857")),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("BOX", (0, 0), (-1, -1), 0.5, HexColor("#CBD5E1")),
    ]))
    elements.append(t1)
    elements.append(Spacer(1, 5 * mm))

    # 2. Concentración por Proveedor
    elements.append(_accent_bar("2. Distribución de Capital Inmovilizado por Proveedor"))
    elements.append(Spacer(1, 2 * mm))

    suppliers = data.get("by_supplier", [])[:15]  # Top 15 proveedores
    t2_data = [["Proveedor", "SKUs", "Unidades", "Capital Valorizado (Gs.)", "% Stock"]]
    for s in suppliers:
        t2_data.append([
            s.get("supplier_name", "Sin Proveedor")[:35],
            str(s.get("total_products", 0)),
            f"{int(s.get('total_units', 0)):,}".replace(",", "."),
            _fmt_gs(s.get("total_value", 0)),
            f"{s.get('percentage', 0):.1f}%",
        ])

    t2 = Table(t2_data, colWidths=[75 * mm, 20 * mm, 25 * mm, 45 * mm, 21 * mm])
    t2.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), PRIMARY_COLOR),
        ("TEXTCOLOR", (0, 0), (-1, 0), WHITE),
        ("FONTNAME", (0, 0), (-1, 0), FONT_BOLD),
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("ALIGN", (1, 0), (4, -1), "RIGHT"),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [WHITE, GRAY_LIGHT]),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("BOX", (0, 0), (-1, -1), 0.5, HexColor("#CBD5E1")),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, HexColor("#E2E8F0")),
    ]))
    elements.append(t2)
    elements.append(Spacer(1, 5 * mm))

    # 3. Muestra Detallada de Artículos
    elements.append(_accent_bar("3. Detalle de Artículos en Inventario (Top Valuados)"))
    elements.append(Spacer(1, 2 * mm))

    items = data.get("items", [])[:50]
    t3_data = [["SKU", "Descripción Producto", "Depósito", "Stock", "Costo Unit.", "Valor Total (Gs.)"]]
    for it in items:
        t3_data.append([
            it.get("sku", "")[:12],
            it.get("producto", "")[:35],
            it.get("warehouse_name", "")[:15],
            f"{it.get('stock', 0):g} {it.get('unidad_medida', 'UN')}",
            _fmt_gs(it.get("costo_unitario", 0)),
            _fmt_gs(it.get("valor_total", 0)),
        ])

    t3 = Table(t3_data, colWidths=[22 * mm, 62 * mm, 30 * mm, 24 * mm, 24 * mm, 24 * mm])
    t3.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), PRIMARY_COLOR),
        ("TEXTCOLOR", (0, 0), (-1, 0), WHITE),
        ("FONTNAME", (0, 0), (-1, 0), FONT_BOLD),
        ("FONTSIZE", (0, 0), (-1, -1), 7.5),
        ("ALIGN", (3, 0), (5, -1), "RIGHT"),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [WHITE, GRAY_LIGHT]),
        ("TOPPADDING", (0, 0), (-1, -1), 2.5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2.5),
        ("BOX", (0, 0), (-1, -1), 0.5, HexColor("#CBD5E1")),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, HexColor("#E2E8F0")),
    ]))
    elements.append(t3)
    elements.append(Spacer(1, 4 * mm))

    elements.append(Paragraph(
        "<b>Nota Fiscal:</b> Inventario valorizado a costo promedio ponderado de adquisición, conforme a la Ley 6380/19 "
        "y reglamentaciones de la DNIT para el ejercicio fiscal de Extra Supermercado Mayorista.",
        styles["Small"],
    ))

    _build(doc, elements)
    return buffer.getvalue()


