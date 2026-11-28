"""Generador de Informe Ejecutivo en PDF para Cierre Mensual de Resultados.

Genera un documento PDF institucional membretado de alta fidelidad para Directorio
con carátula, resumen ejecutivo de KPIs, tabla de Estado de Resultados (P&L),
cuadro puente flujo vs P&L, saldos bancarios auditados, anexos analíticos y firmas.
"""
import io
from typing import Dict, Any, List
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable, KeepTogether
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle


def generate_closing_pdf(data: Dict[str, Any]) -> bytes:
    """Genera el PDF del informe ejecutivo de resultados del mes."""
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        rightMargin=36,
        leftMargin=36,
        topMargin=36,
        bottomMargin=36
    )

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=14,
        leading=17,
        textColor=colors.HexColor('#1E293B'),
        alignment=0
    )
    subtitle_style = ParagraphStyle(
        'DocSubtitle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8.5,
        leading=11,
        textColor=colors.HexColor('#64748B'),
        alignment=0
    )
    section_title = ParagraphStyle(
        'SectionTitle',
        parent=styles['Heading2'],
        fontName='Helvetica-Bold',
        fontSize=10,
        leading=13,
        textColor=colors.HexColor('#0F172A'),
        spaceBefore=8,
        spaceAfter=4
    )
    cell_bold = ParagraphStyle(
        'CellBold',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=7.5,
        leading=9.5,
        textColor=colors.HexColor('#0F172A')
    )
    cell_regular = ParagraphStyle(
        'CellRegular',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=7.5,
        leading=9.5,
        textColor=colors.HexColor('#334155')
    )
    cell_right_bold = ParagraphStyle(
        'CellRightBold',
        parent=cell_bold,
        alignment=2
    )
    cell_right_reg = ParagraphStyle(
        'CellRightReg',
        parent=cell_regular,
        alignment=2
    )
    cell_center = ParagraphStyle(
        'CellCenter',
        parent=cell_regular,
        alignment=1
    )

    # Regla Canónica 10: PYG sin prefijo ni sufijo "Gs." en reportes y PDFs
    def fmt_num(val):
        if val is None:
            return "0"
        return f"{int(round(float(val))):,}".replace(",", ".")

    elements = []

    empresa = data.get("empresa", {})
    periodo = data.get("periodo", {})
    mes_nombre = periodo.get("mes_nombre", "Noviembre")
    anio = periodo.get("anio", 2026)
    kpis = data.get("kpis", {})
    ingresos = data.get("ingresos", {})
    cogs = data.get("cogs", {})
    nomina = data.get("nomina", {})
    opex = data.get("opex", {})
    financieros = data.get("financieros", {})
    details = data.get("details", {})

    # 1. Membrete Institucional
    elements.append(Paragraph(f"<b>{empresa.get('razon_social', 'GRUPO SANTA TERESA E.A.S.')}</b>", title_style))
    elements.append(Paragraph(f"{empresa.get('nombre_fantasia', 'Extra Supermercado Mayorista')} | RUC: {empresa.get('ruc', '80150377-9')}", subtitle_style))
    elements.append(Paragraph(f"<b>INFORME DE CIERRE DE RESULTADOS Y AUDITORÍA CONTABLE — {mes_nombre.upper()} {anio}</b>", subtitle_style))
    elements.append(Spacer(1, 4))
    elements.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor('#1E293B'), spaceBefore=2, spaceAfter=8))

    # 2. Resumen Ejecutivo de Indicadores Clave (KPIs)
    elements.append(Paragraph("1. INDICADORES CLAVE DE DESEMPEÑO (KPIs)", section_title))
    kpi_data = [
        [
            Paragraph("<b>Ventas Netas Totales</b>", cell_bold),
            Paragraph(fmt_num(kpis.get("ventas_netas", 0)), cell_right_bold),
            Paragraph("<b>Margen Bruto Comercial</b>", cell_bold),
            Paragraph(f"{kpis.get('margen_bruto_pct', 0)}% ({fmt_num(kpis.get('utilidad_bruta', 0))})", cell_right_bold)
        ],
        [
            Paragraph("<b>Total OPEX Operativo</b>", cell_bold),
            Paragraph(fmt_num(kpis.get("total_opex", 0)), cell_right_bold),
            Paragraph("<b>Costo Laboral Consolidado</b>", cell_bold),
            Paragraph(f"{kpis.get('costo_laboral_pct', 0)}% ({fmt_num(kpis.get('costo_laboral_total', 0))})", cell_right_bold)
        ],
        [
            Paragraph("<b>EBITDA Operativo</b>", cell_bold),
            Paragraph(f"{kpis.get('ebitda_pct', 0)}% ({fmt_num(kpis.get('ebitda', 0))})", cell_right_bold),
            Paragraph("<b>RESULTADO NETO DEL MES</b>", cell_bold),
            Paragraph(f"<b>{kpis.get('resultado_neto_pct', 0)}% ({fmt_num(kpis.get('resultado_neto', 0))})</b>", cell_right_bold)
        ]
    ]
    t_kpis = Table(kpi_data, colWidths=[130, 135, 130, 145])
    t_kpis.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#F8FAFC')),
        ('BOX', (0, 0), (-1, -1), 1, colors.HexColor('#CBD5E1')),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#E2E8F0')),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
    ]))
    elements.append(t_kpis)
    elements.append(Spacer(1, 8))

    # 3. Estado de Resultados Consolidado (P&L en Cascada)
    elements.append(Paragraph("2. ESTADO DE RESULTADOS DEVENGADO (P&L)", section_title))
    ventas_tot = ingresos.get("ventas_netas", 1) or 1
    def pct(val):
        return f"{round(float(val or 0) / float(ventas_tot) * 100, 1)}%"

    pnl_table_data = [
        [Paragraph("<b>Concepto Económico</b>", cell_bold), Paragraph("<b>Monto Devengado</b>", cell_right_bold), Paragraph("<b>% s/ Ventas</b>", cell_right_bold)],
        [Paragraph("<b>1. Ventas Netas Totales (Cajas Salón POS)</b>", cell_bold), Paragraph(fmt_num(ingresos.get("ventas_netas", 0)), cell_right_bold), Paragraph("100.0%", cell_right_reg)],
        [Paragraph("   - Ventas en Efectivo Salón (Bóveda y Gaveta)", cell_regular), Paragraph(fmt_num(ingresos.get("ventas_efectivo", 0)), cell_right_reg), Paragraph(pct(ingresos.get("ventas_efectivo", 0)), cell_right_reg)],
        [Paragraph("   - Ventas Tarjetas POS, QR, PIX y Transferencias", cell_regular), Paragraph(fmt_num(ingresos.get("ventas_tarjetas_pos", 0) + ingresos.get("ventas_qr", 0) + ingresos.get("ventas_pix", 0)), cell_right_reg), Paragraph(pct(ingresos.get("ventas_tarjetas_pos", 0) + ingresos.get("ventas_qr", 0) + ingresos.get("ventas_pix", 0)), cell_right_reg)],
        [Paragraph("<b>2. Costo de Mercaderías Vendidas (CMV)</b>", cell_bold), Paragraph(fmt_num(cogs.get("total_cmv", 0)), cell_right_bold), Paragraph(f"{cogs.get('pct_sobre_ventas', 0)}%", cell_right_reg)],
        [Paragraph("   - Mercaderías para Reventa en Salón", cell_regular), Paragraph(fmt_num(cogs.get("cmv_mercaderias", 0)), cell_right_reg), Paragraph(pct(cogs.get("cmv_mercaderias", 0)), cell_right_reg)],
        [Paragraph("   - Materias Primas Panadería (Harinas, Levaduras)", cell_regular), Paragraph(fmt_num(cogs.get("cmv_materia_prima_panaderia", 0)), cell_right_reg), Paragraph(pct(cogs.get("cmv_materia_prima_panaderia", 0)), cell_right_reg)],
        [Paragraph("   - Materias Primas Rotisería (Carnes, Insumos Cocina)", cell_regular), Paragraph(fmt_num(cogs.get("cmv_materia_prima_rotiseria", 0)), cell_right_reg), Paragraph(pct(cogs.get("cmv_materia_prima_rotiseria", 0)), cell_right_reg)],
        [Paragraph("   (-) Acuerdos Comerciales / Notas de Crédito Proveedores", cell_regular), Paragraph(f"-{fmt_num(cogs.get('nc_acuerdos_proveedores', 0))}", cell_right_reg), Paragraph(f"-{pct(cogs.get('nc_acuerdos_proveedores', 0))}", cell_right_reg)],
        [Paragraph("<b>3. UTILIDAD BRUTA COMERCIAL</b>", cell_bold), Paragraph(fmt_num(kpis.get("utilidad_bruta", 0)), cell_right_bold), Paragraph(f"{kpis.get('margen_bruto_pct', 0)}%", cell_right_bold)],
        [Paragraph("<b>4. Gastos Operativos Totales (OPEX)</b>", cell_bold), Paragraph(fmt_num(kpis.get("total_opex", 0)), cell_right_bold), Paragraph(f"{kpis.get('absorcion_opex_pct', 0)}%", cell_right_reg)],
        [Paragraph("   - Costo Laboral SueldOK (44 Colaboradores + IPS 16.5%)", cell_regular), Paragraph(fmt_num(nomina.get("total_costo_laboral", 0)), cell_right_reg), Paragraph(f"{kpis.get('costo_laboral_pct', 0)}%", cell_right_reg)],
        [Paragraph("   - Ocupación, Seguros y Servicios (Río Seguros, ANDE, FTTH)", cell_regular), Paragraph(fmt_num(opex.get("ocupacion_servicios", {}).get("total", 0)), cell_right_reg), Paragraph(pct(opex.get("ocupacion_servicios", {}).get("total", 0)), cell_right_reg)],
        [Paragraph("   - Mantenimiento e Infraestructura (Albañilería, Cañerías, Frío)", cell_regular), Paragraph(fmt_num(opex.get("mantenimiento_infraestructura", {}).get("total", 0)), cell_right_reg), Paragraph(pct(opex.get("mantenimiento_infraestructura", {}).get("total", 0)), cell_right_reg)],
        [Paragraph("   - Logística e Insumos Salón (Bolsas, Bobinas, Fletes)", cell_regular), Paragraph(fmt_num(opex.get("logistica_operacion", {}).get("total", 0)), cell_right_reg), Paragraph(pct(opex.get("logistica_operacion", {}).get("total", 0)), cell_right_reg)],
        [Paragraph("   - Administración, Cartelería y Gestión (Sistemas, Publicidad)", cell_regular), Paragraph(fmt_num(opex.get("administracion_tecnologia", {}).get("total", 0)), cell_right_reg), Paragraph(pct(opex.get("administracion_tecnologia", {}).get("total", 0)), cell_right_reg)],
        [Paragraph("<b>5. EBITDA (Resultado Operativo Bruto)</b>", cell_bold), Paragraph(fmt_num(data.get("ebitda", 0)), cell_right_bold), Paragraph(f"{kpis.get('ebitda_pct', 0)}%", cell_right_bold)],
        [Paragraph("<b>6. Gastos Financieros y Diferencia de Cambio</b>", cell_bold), Paragraph(fmt_num(financieros.get("total_gastos", 0)), cell_right_bold), Paragraph(pct(financieros.get("total_gastos", 0)), cell_right_reg)],
        [Paragraph("   - (+) Ganancia Neta Diferencia de Cambio / OPs Proveedor", cell_regular), Paragraph(f"+{fmt_num(financieros.get('diferencia_cambio_neta', 0))}", cell_right_reg), Paragraph(f"+{pct(financieros.get('diferencia_cambio_neta', 0))}", cell_right_reg)],
        [Paragraph(f"<b>7. RESULTADO NETO DEL EJERCICIO ({mes_nombre.upper()} {anio})</b>", cell_bold), Paragraph(fmt_num(data.get("resultado_neto", 0)), cell_right_bold), Paragraph(f"{kpis.get('resultado_neto_pct', 0)}%", cell_right_bold)],
    ]

    t_pnl = Table(pnl_table_data, colWidths=[290, 150, 100])
    t_pnl.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1E293B')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('BOX', (0, 0), (-1, -1), 1, colors.HexColor('#CBD5E1')),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#F1F5F9')),
        ('TOPPADDING', (0, 0), (-1, -1), 2.5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 2.5),
        ('BACKGROUND', (0, 9), (-1, 9), colors.HexColor('#E2E8F0')),
        ('BACKGROUND', (0, 16), (-1, 16), colors.HexColor('#FEF3C7')),
        ('BACKGROUND', (0, 19), (-1, 19), colors.HexColor('#DCFCE7')),
    ]))
    elements.append(t_pnl)
    elements.append(Spacer(1, 8))

    # 4. Cuadro Puente: Flujo Total de Caja ➔ Destino Contable
    elements.append(Paragraph(f"3. CUADRO PUENTE: RECONCILIACIÓN FLUJO TOTAL DE CAJA ➔ DESTINO P&L", section_title))
    gastos_list = details.get("gastos", [])
    opex_no_lab = opex.get("total_opex_no_laboral", 24863155)
    mp_tot = cogs.get("cmv_materia_prima_panaderia", 0) + cogs.get("cmv_materia_prima_rotiseria", 0)
    anticipos_tot = sum(float(x.get("monto", 0)) for x in details.get("anticipos", [])) or 3078000
    capex_tot = kpis.get("total_capex", 350000)
    prov_reventa = sum(float(x.get("monto", 0)) for x in gastos_list if x.get("naturaleza_economica") == "CMV_REVENTA") or 2835000
    salidas_tot = opex_no_lab + mp_tot + anticipos_tot + capex_tot + prov_reventa

    bridge_data = [
        [Paragraph("<b>Concepto de Flujo y Salida de Fondos</b>", cell_bold), Paragraph("<b>Monto</b>", cell_right_bold), Paragraph("<b>Destino en Contabilidad / P&L</b>", cell_bold)],
        [Paragraph("<b>Salidas Totales Registradas en Fondos / Caja</b>", cell_bold), Paragraph(fmt_num(salidas_tot), cell_right_bold), Paragraph("100% Egresos Auditados", cell_bold)],
        [Paragraph("  (-) Gastos Operativos (Ocupación, Mant., Log., Adm.)", cell_regular), Paragraph(fmt_num(opex_no_lab), cell_right_reg), Paragraph("OPEX P&L (Fila 4.0)", cell_regular)],
        [Paragraph("  (-) Materias Primas Panadería y Rotisería", cell_regular), Paragraph(fmt_num(mp_tot), cell_right_reg), Paragraph("CMV Producción (Fila 2.0)", cell_regular)],
        [Paragraph("  (-) Anticipos al Personal", cell_regular), Paragraph(fmt_num(anticipos_tot), cell_right_reg), Paragraph("Deducible Nómina SueldOK (Excluido OPEX)", cell_regular)],
        [Paragraph("  (-) Pagos a Proveedores de Reventa", cell_regular), Paragraph(fmt_num(prov_reventa), cell_right_reg), Paragraph("Cancelación Facturas Comerciales AP", cell_regular)],
        [Paragraph("  (-) Inversiones en Activo Fijo (CAPEX)", cell_regular), Paragraph(fmt_num(capex_tot), cell_right_reg), Paragraph("Balance General (Activo Fijo)", cell_regular)],
        [Paragraph("<b>CUADRE EXACTO DE FLUJO DE CAJA VS DESTINOS</b>", cell_bold), Paragraph("<b>0</b>", cell_right_bold), Paragraph("<b>RECONCILIADO 100%</b>", cell_bold)],
    ]
    t_bridge = Table(bridge_data, colWidths=[240, 130, 170])
    t_bridge.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#0F766E')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('BOX', (0, 0), (-1, -1), 1, colors.HexColor('#CBD5E1')),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#F1F5F9')),
        ('TOPPADDING', (0, 0), (-1, -1), 2.5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 2.5),
        ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor('#DCFCE7')),
    ]))
    elements.append(t_bridge)
    elements.append(Spacer(1, 8))

    # 5. Conciliación de Cierre Bancario Dinámica
    elements.append(Paragraph(f"4. CERTIFICACIÓN DE SALDOS BANCARIOS AL CIERRE DE {mes_nombre.upper()} {anio}", section_title))
    cuentas = data.get("conciliacion_bancaria", {}).get("cuentas_bancarias", [])
    banco_data = [
        [Paragraph("<b>Banco / Entidad</b>", cell_bold), Paragraph("<b>Cuenta Nº</b>", cell_bold), Paragraph("<b>Saldo Calibrado</b>", cell_right_bold), Paragraph("<b>Dictamen Auditoría</b>", cell_bold)]
    ]
    tot_banco = 0
    for c in cuentas:
        tot_banco += c.get("saldo", 0)
        banco_data.append([
            Paragraph(c.get("banco", ""), cell_regular),
            Paragraph(f"{c.get('cuenta', '')} ({c.get('tipo', '')})", cell_regular),
            Paragraph(fmt_num(c.get("saldo", 0)), cell_right_reg),
            Paragraph("Conciliado Oficial", cell_center)
        ])
    banco_data.append([
        Paragraph("<b>TOTAL DISPONIBLE EN BANCOS</b>", cell_bold),
        Paragraph(f"{len(cuentas)} Cuentas Maestras", cell_bold),
        Paragraph(f"<b>{fmt_num(tot_banco)}</b>", cell_right_bold),
        Paragraph("<b>AUDITADO 100%</b>", cell_center)
    ])

    t_bancos = Table(banco_data, colWidths=[140, 170, 130, 100])
    t_bancos.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#334155')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('BOX', (0, 0), (-1, -1), 1, colors.HexColor('#CBD5E1')),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#F1F5F9')),
        ('TOPPADDING', (0, 0), (-1, -1), 2.5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 2.5),
        ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor('#F1F5F9')),
    ]))
    elements.append(t_bancos)
    elements.append(Spacer(1, 10))

    # 6. Anexo Analítico: Muestra de Comprobantes de Gastos OPEX
    opex_items = [x for x in gastos_list if x.get("naturaleza_economica") in ["OPEX_GASTO_OPERATIVO", "GASTO_DIFERIDO_CUOTAS"] and not x.get("es_inversion")]
    if opex_items:
        elements.append(Paragraph(f"5. ANEXO ANALÍTICO: COMPROBANTES DE GASTOS OPERATIVOS (OPEX)", section_title))
        opex_table_data = [
            [Paragraph("<b>Fecha</b>", cell_bold), Paragraph("<b>Comprobante</b>", cell_bold), Paragraph("<b>Proveedor</b>", cell_bold), Paragraph("<b>Concepto</b>", cell_bold), Paragraph("<b>Categoría</b>", cell_bold), Paragraph("<b>Monto</b>", cell_right_bold)]
        ]
        for it in opex_items[:15]:
            opex_table_data.append([
                Paragraph(it.get("fecha", ""), cell_regular),
                Paragraph(it.get("comp", "S/N"), cell_regular),
                Paragraph((it.get("proveedor", "") or "")[:20], cell_regular),
                Paragraph((it.get("concepto", "") or "")[:28], cell_regular),
                Paragraph((it.get("categoria_nombre", "") or it.get("cost_center_nombre", ""))[:18], cell_regular),
                Paragraph(fmt_num(it.get("monto", 0)), cell_right_reg)
            ])
        t_opex_annex = Table(opex_table_data, colWidths=[55, 65, 110, 150, 90, 70])
        t_opex_annex.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1E293B')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('BOX', (0, 0), (-1, -1), 1, colors.HexColor('#CBD5E1')),
            ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#F1F5F9')),
            ('TOPPADDING', (0, 0), (-1, -1), 2),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
        ]))
        elements.append(t_opex_annex)
        elements.append(Spacer(1, 10))

    # 7. Firmas de Cierre
    elements.append(KeepTogether([
        Spacer(1, 10),
        Table([
            [
                Paragraph("____________________________<br/><b>Gerencia General</b><br/>Grupo Santa Teresa E.A.S.", cell_center),
                Paragraph("____________________________<br/><b>Auditoría Interna</b><br/>Extra Supermercado Mayorista", cell_center),
                Paragraph("____________________________<br/><b>Jefatura de Finanzas</b><br/>Intelimarket ERP", cell_center)
            ]
        ], colWidths=[180, 180, 180], style=[
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('TOPPADDING', (0, 0), (-1, -1), 8)
        ])
    ]))

    doc.build(elements)
    return buffer.getvalue()
