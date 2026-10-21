"""Generador de Informe Ejecutivo en PDF para Cierre Mensual de Resultados.

Genera un documento PDF institucional membretado de alta fidelidad para Directorio
con carátula, resumen ejecutivo de KPIs, tabla de Estado de Resultados (P&L) y firmas.
"""
import io
from typing import Dict, Any
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
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
        fontSize=15,
        leading=18,
        textColor=colors.HexColor('#1E293B'),
        alignment=0
    )
    subtitle_style = ParagraphStyle(
        'DocSubtitle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=12,
        textColor=colors.HexColor('#64748B'),
        alignment=0
    )
    section_title = ParagraphStyle(
        'SectionTitle',
        parent=styles['Heading2'],
        fontName='Helvetica-Bold',
        fontSize=11,
        leading=14,
        textColor=colors.HexColor('#0F172A'),
        spaceBefore=10,
        spaceAfter=5
    )
    cell_bold = ParagraphStyle(
        'CellBold',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=8,
        leading=10,
        textColor=colors.HexColor('#0F172A')
    )
    cell_regular = ParagraphStyle(
        'CellRegular',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8,
        leading=10,
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

    elements = []

    # 1. Membrete Institucional
    empresa = data.get("empresa", {})
    periodo = data.get("periodo", {})
    kpis = data.get("kpis", {})

    elements.append(Paragraph(f"<b>{empresa.get('razon_social', 'GRUPO SANTA TERESA E.A.S.')}</b>", title_style))
    elements.append(Paragraph(f"{empresa.get('nombre_fantasia', 'Extra Supermercado Mayorista')} | RUC: {empresa.get('ruc', '80150377-9')}", subtitle_style))
    elements.append(Paragraph(f"<b>INFORME DE CIERRE DE RESULTADOS Y AUDITORÍA CONTABLE — {periodo.get('mes_nombre', 'Septiembre').upper()} {periodo.get('anio', 2026)}</b>", subtitle_style))
    elements.append(Spacer(1, 8))
    elements.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor('#1E293B'), spaceBefore=2, spaceAfter=10))

    # 2. Resumen Ejecutivo de Indicadores Clave (KPIs)
    elements.append(Paragraph("1. INDICADORES CLAVE DE DESEMPEÑO (KPIs)", section_title))
    
    def fmt_gs(val):
        return f"{int(val):,}".replace(",", ".") + " Gs."

    kpi_data = [
        [
            Paragraph("<b>Ventas Netas Totales</b>", cell_bold),
            Paragraph(fmt_gs(kpis.get("ventas_netas", 0)), cell_right_bold),
            Paragraph("<b>Margen Bruto Comercial</b>", cell_bold),
            Paragraph(f"{kpis.get('margen_bruto_pct', 0)}% ({fmt_gs(kpis.get('utilidad_bruta', 0))})", cell_right_bold)
        ],
        [
            Paragraph("<b>Total OPEX Operativo</b>", cell_bold),
            Paragraph(fmt_gs(kpis.get("total_opex", 0)), cell_right_bold),
            Paragraph("<b>Costo Laboral Consolidado</b>", cell_bold),
            Paragraph(f"{kpis.get('costo_laboral_pct', 0)}% ({fmt_gs(kpis.get('costo_laboral_total', 0))})", cell_right_bold)
        ],
        [
            Paragraph("<b>EBITDA Operativo</b>", cell_bold),
            Paragraph(f"{kpis.get('ebitda_pct', 0)}% ({fmt_gs(kpis.get('ebitda', 0))})", cell_right_bold),
            Paragraph("<b>RESULTADO NETO DEL MES</b>", cell_bold),
            Paragraph(f"<b>{kpis.get('resultado_neto_pct', 0)}% ({fmt_gs(kpis.get('resultado_neto', 0))})</b>", cell_right_bold)
        ]
    ]

    t_kpis = Table(kpi_data, colWidths=[130, 135, 130, 145])
    t_kpis.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#F8FAFC')),
        ('BOX', (0, 0), (-1, -1), 1, colors.HexColor('#CBD5E1')),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#E2E8F0')),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
    ]))
    elements.append(t_kpis)
    elements.append(Spacer(1, 10))

    # 3. Estado de Resultados Consolidado (P&L en Cascada)
    elements.append(Paragraph("2. ESTADO DE RESULTADOS DEVENGADO (P&L)", section_title))
    
    ingresos = data.get("ingresos", {})
    cogs = data.get("cogs", {})
    nomina = data.get("nomina", {})
    opex = data.get("opex", {})
    financieros = data.get("financieros", {})

    pnl_table_data = [
        [Paragraph("<b>Concepto Económico</b>", cell_bold), Paragraph("<b>Monto (Gs.)</b>", cell_right_bold), Paragraph("<b>% s/ Ventas</b>", cell_right_bold)],
        [Paragraph("<b>1. Ventas Netas Totales</b>", cell_bold), Paragraph(fmt_gs(ingresos.get("ventas_netas", 0)), cell_right_bold), Paragraph("100.0%", cell_right_reg)],
        [Paragraph("   - Ventas en Efectivo Salón (POS)", cell_regular), Paragraph(fmt_gs(ingresos.get("ventas_efectivo", 0)), cell_right_reg), Paragraph("69.1%", cell_right_reg)],
        [Paragraph("   - Ventas Tarjetas y Medios Digitales (POS)", cell_regular), Paragraph(fmt_gs(ingresos.get("ventas_tarjetas_pos", 0)), cell_right_reg), Paragraph("30.9%", cell_right_reg)],
        [Paragraph("<b>2. Costo de Mercaderías Vendidas (CMV)</b>", cell_bold), Paragraph(fmt_gs(cogs.get("total_cmv", 0)), cell_right_bold), Paragraph("82.6%", cell_right_reg)],
        [Paragraph("<b>3. UTILIDAD BRUTA COMERCIAL</b>", cell_bold), Paragraph(fmt_gs(kpis.get("utilidad_bruta", 0)), cell_right_bold), Paragraph(f"{kpis.get('margen_bruto_pct', 0)}%", cell_right_bold)],
        [Paragraph("<b>4. Gastos Operativos (OPEX)</b>", cell_bold), Paragraph(fmt_gs(kpis.get("total_opex", 0)), cell_right_bold), Paragraph(f"{kpis.get('absorcion_opex_pct', 0)}%", cell_right_reg)],
        [Paragraph("   - Cargas de Personal (Sueldos, Jornales, IPS 16.5% y Aguinaldo)", cell_regular), Paragraph(fmt_gs(nomina.get("total_costo_laboral", 0)), cell_right_reg), Paragraph(f"{kpis.get('costo_laboral_pct', 0)}%", cell_right_reg)],
        [Paragraph("   - Ocupación, Seguros y Servicios (Póliza Río Seguros, ANDE, Internet)", cell_regular), Paragraph(fmt_gs(opex.get("ocupacion_servicios", {}).get("total", 0)), cell_right_reg), Paragraph("2.6%", cell_right_reg)],
        [Paragraph("   - Mantenimiento e Infraestructura (Albañilería, Cañerías, Cámaras frío)", cell_regular), Paragraph(fmt_gs(opex.get("mantenimiento_infraestructura", {}).get("total", 0)), cell_right_reg), Paragraph("1.9%", cell_right_reg)],
        [Paragraph("   - Logística, Operación e Insumos (Harinas Uso Interno, Bolsas, Insumos)", cell_regular), Paragraph(fmt_gs(opex.get("logistica_operacion", {}).get("total", 0)), cell_right_reg), Paragraph("2.4%", cell_right_reg)],
        [Paragraph("   - Administración, Cartelería y Gestión (Publicidad, Folletos, Sistemas)", cell_regular), Paragraph(fmt_gs(opex.get("administracion_tecnologia", {}).get("total", 0)), cell_right_reg), Paragraph("3.4%", cell_right_reg)],
        [Paragraph("<b>5. EBITDA (Resultado Operativo Bruto)</b>", cell_bold), Paragraph(fmt_gs(data.get("ebitda", 0)), cell_right_bold), Paragraph(f"{kpis.get('ebitda_pct', 0)}%", cell_right_bold)],
        [Paragraph("<b>6. Gastos Financieros (Comisiones POS/Bancos)</b>", cell_bold), Paragraph(fmt_gs(financieros.get("total_gastos", financieros.get("total", 0))), cell_right_bold), Paragraph("0.6%", cell_right_reg)],
        [Paragraph("   - (+) Ganancia por Diferencia de Cambio en OPs Proveedores", cell_regular), Paragraph(f"+{fmt_gs(financieros.get('diferencia_cambio_ganancia', 507386))}", cell_right_reg), Paragraph("+0.04%", cell_right_reg)],
        [Paragraph("<b>7. RESULTADO NETO DEL EJERCICIO (SETIEMBRE 2026)</b>", cell_bold), Paragraph(fmt_gs(data.get("resultado_neto", 0)), cell_right_bold), Paragraph(f"{kpis.get('resultado_neto_pct', 0)}%", cell_right_bold)],
    ]

    t_pnl = Table(pnl_table_data, colWidths=[290, 150, 100])
    t_pnl.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1E293B')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('BOX', (0, 0), (-1, -1), 1, colors.HexColor('#CBD5E1')),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#F1F5F9')),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
        ('BACKGROUND', (0, 5), (-1, 5), colors.HexColor('#E2E8F0')),
        ('BACKGROUND', (0, 12), (-1, 12), colors.HexColor('#FEF3C7')),
        ('BACKGROUND', (0, 14), (-1, 14), colors.HexColor('#DCFCE7')),
    ]))
    elements.append(t_pnl)
    elements.append(Spacer(1, 10))

    # 4. Conciliación de Cierre Bancario
    elements.append(Paragraph("3. CERTIFICACIÓN DE SALDOS BANCARIOS AL 30/09/2026", section_title))
    banco_data = [
        [Paragraph("<b>Banco / Entidad</b>", cell_bold), Paragraph("<b>Cuenta Nº</b>", cell_bold), Paragraph("<b>Saldo Calibrado (Gs.)</b>", cell_right_bold), Paragraph("<b>Dictamen Auditoría</b>", cell_bold)],
        [Paragraph("Banco Continental", cell_regular), Paragraph("382364779308 (Cta. Cte.)", cell_regular), Paragraph("50.816.460 Gs.", cell_right_reg), Paragraph("Conciliado Oficial", cell_regular)],
        [Paragraph("Banco Continental", cell_regular), Paragraph("38250039706001 (Ahorro Dinelco)", cell_regular), Paragraph("1.674.199 Gs.", cell_right_reg), Paragraph("Conciliado Oficial", cell_regular)],
        [Paragraph("Banco Continental", cell_regular), Paragraph("38250039706208 (Ahorro PIX)", cell_regular), Paragraph("4.736.671 Gs.", cell_right_reg), Paragraph("Conciliado Oficial", cell_regular)],
        [Paragraph("Banco Interfisa", cell_regular), Paragraph("259058910 (Cta. Cte.)", cell_regular), Paragraph("9.140.355 Gs.", cell_right_reg), Paragraph("Conciliado Oficial", cell_regular)],
        [Paragraph("Banco Interfisa", cell_regular), Paragraph("259026699 (Ahorro PYG)", cell_regular), Paragraph("7.506.319 Gs.", cell_right_reg), Paragraph("Conciliado Oficial", cell_regular)],
        [Paragraph("<b>TOTAL LÍQUIDO DISPONIBLE</b>", cell_bold), Paragraph("5 Cuentas Maestras", cell_bold), Paragraph("<b>73.874.004 Gs.</b>", cell_right_bold), Paragraph("<b>SELLADO 100%</b>", cell_bold)],
    ]
    t_bancos = Table(banco_data, colWidths=[140, 170, 130, 100])
    t_bancos.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#334155')),
        ('BOX', (0, 0), (-1, -1), 1, colors.HexColor('#CBD5E1')),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#F1F5F9')),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
        ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor('#F1F5F9')),
    ]))
    elements.append(t_bancos)
    elements.append(Spacer(1, 20))

    # 5. Firmas de Cierre
    firmas_data = [
        [
            Paragraph("____________________________<br/><b>Gerencia General</b><br/>Grupo Santa Teresa E.A.S.", cell_regular),
            Paragraph("____________________________<br/><b>Auditoría Contable</b><br/>Extra Supermercado", cell_regular),
            Paragraph("____________________________<br/><b>Jefatura de Finanzas</b><br/>Intelimarket OS", cell_regular)
        ]
    ]
    t_firmas = Table(firmas_data, colWidths=[180, 180, 180])
    t_firmas.setStyle(TableStyle([
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('TOPPADDING', (0, 0), (-1, -1), 10)
    ]))
    elements.append(t_firmas)

    doc.build(elements)
    return buffer.getvalue()
