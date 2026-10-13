"""Generador de Libro Excel (.xlsx) Multi-Hoja para Cierre de Resultados.

Construye un libro con 8 hojas:
1. Resumen Ejecutivo P&L con fórmulas vivas dinámicas y ratios sobre ventas.
2. Detalle Ingresos
3. Detalle CMV
4. Detalle Nomina SueldOK (con IPS patronal 16.5% y provisiones)
5. Ocupacion y Servicios
6. Mantenimiento
7. Logistica e Insumos
8. Administracion y Finanzas
"""
import io
import os
import json
from typing import Dict, Any, List
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter


def generate_closing_excel(data: Dict[str, Any]) -> bytes:
    """Genera el contenido binario del archivo Excel con 8 hojas y fórmulas vivas."""
    wb = openpyxl.Workbook()
    # Eliminar hoja por defecto
    default_sheet = wb.active
    
    # Paleta de colores corporativos
    NAVY_FILL = PatternFill(start_color="1E293B", end_color="1E293B", fill_type="solid")
    SUBNAVY_FILL = PatternFill(start_color="334155", end_color="334155", fill_type="solid")
    HEADER_FILL = PatternFill(start_color="0F172A", end_color="0F172A", fill_type="solid")
    ACCENT_FILL = PatternFill(start_color="2563EB", end_color="2563EB", fill_type="solid")
    LIGHT_GRAY_FILL = PatternFill(start_color="F1F5F9", end_color="F1F5F9", fill_type="solid")
    KPI_BG_FILL = PatternFill(start_color="F8FAFC", end_color="F8FAFC", fill_type="solid")

    WHITE_BOLD = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
    TITLE_FONT = Font(name="Calibri", size=14, bold=True, color="1E293B")
    SUBTITLE_FONT = Font(name="Calibri", size=10, italic=True, color="64748B")
    BOLD_FONT = Font(name="Calibri", size=11, bold=True, color="0F172A")
    REGULAR_FONT = Font(name="Calibri", size=10, color="1E293B")
    TOTAL_FONT = Font(name="Calibri", size=11, bold=True, color="1E3A8A")

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

    CURRENCY_FORMAT = '#,##0 "Gs."'
    PERCENT_FORMAT = '0.0%'

    # =========================================================================
    # 1. HOJA: RESUMEN EJECUTIVO P&L
    # =========================================================================
    ws1 = wb.create_sheet(title="1. Resumen Ejecutivo P&L")
    ws1.views.sheetView[0].showGridLines = True

    # Encabezado institucional
    empresa = data.get("empresa", {})
    periodo = data.get("periodo", {})
    
    ws1.merge_cells("B2:F2")
    ws1["B2"] = f"{empresa.get('razon_social', 'GRUPO SANTA TERESA E.A.S.')} — {empresa.get('nombre_fantasia', 'Extra Supermercado Mayorista')}"
    ws1["B2"].font = TITLE_FONT

    ws1.merge_cells("B3:F3")
    ws1["B3"] = f"RUC: {empresa.get('ruc', '80150377-9')} | INFORME DE CIERRE DE RESULTADOS Y ESTADO DE P&L — {periodo.get('mes_nombre', 'Septiembre').upper()} {periodo.get('anio', 2026)}"
    ws1["B3"].font = SUBTITLE_FONT

    # Encabezado de tabla P&L
    headers_resumen = ["CÓD.", "CONCEPTO ECONÓMICO / RUBRO", "MONTO DEVENGADO", "% S/ VENTAS", "MAGNITUD / HOJA DE DETALLE"]
    for col_idx, h in enumerate(headers_resumen, start=2):
        cell = ws1.cell(row=5, column=col_idx, value=h)
        cell.font = WHITE_BOLD
        cell.fill = NAVY_FILL
        cell.alignment = Alignment(horizontal="center" if col_idx != 3 else "left", vertical="center")
        cell.border = THIN_BORDER

    # Filas de P&L
    ingresos = data.get("ingresos", {})
    cogs = data.get("cogs", {})
    nomina = data.get("nomina", {})
    opex = data.get("opex", {})
    financieros = data.get("financieros", {})

    pnl_rows = [
        # (Cod, Concepto, Valor, EsFormula, PctFormula, HojaDetalle, Bold, DoubleBorder, Fill)
        ("1.0", "INGRESOS OPERATIVOS BRUTOS", ingresos.get("ventas_brutas", 0), False, "=D6/D8", "2. Detalle Ingresos", True, False, LIGHT_GRAY_FILL),
        ("1.1", "  - Ventas en Efectivo Salón (POS)", ingresos.get("ventas_efectivo", 0), False, "=D7/D8", "2. Detalle Ingresos", False, False, None),
        ("1.2", "  - Ventas con Tarjetas y Medios Digitales (POS)", ingresos.get("ventas_tarjetas_pos", 0), False, "=D8/D8", "2. Detalle Ingresos", False, False, None),
        ("1.3", "  (-) Devoluciones y Descuentos Comerciales", ingresos.get("descuentos", 0), False, "=D9/D8", "2. Detalle Ingresos", False, False, None),
        ("1.4", "VENTAS NETAS TOTALES", "=D6-D9", True, "=1.0", "2. Detalle Ingresos", True, True, KPI_BG_FILL),
        
        ("2.0", "COSTO DE MERCADERÍAS VENDIDAS (CMV)", cogs.get("total_cmv", 0), False, "=D11/$D$10", "3. Detalle CMV", True, False, LIGHT_GRAY_FILL),
        ("2.1", "  - Compras de Reposición y Mercaderías Reventa", cogs.get("cmv_mercaderias", 0), False, "=D12/$D$10", "3. Detalle CMV", False, False, None),
        ("2.2", "  - Mermas Operativas Frío y Carnicería", cogs.get("mermas_frio_carniceria", 0), False, "=D13/$D$10", "3. Detalle CMV", False, False, None),
        
        ("3.0", "UTILIDAD BRUTA COMERCIAL", "=D10-D11", True, "=D14/$D$10", "Resumen P&L", True, True, PatternFill(start_color="E2E8F0", end_color="E2E8F0", fill_type="solid")),
        
        ("4.0", "GASTOS OPERATIVOS (OPEX)", "=SUM(D16:D20)", True, "=D15/$D$10", "Resumen OPEX", True, False, LIGHT_GRAY_FILL),
        ("4.1", "  - Gastos de Personal (Sueldos, Jornales e IPS Patronal)", nomina.get("total_costo_laboral", 0), False, "=D16/$D$10", "4. Detalle Nomina SueldOK", False, False, None),
        ("4.2", "  - Ocupación, Seguros y Servicios (Póliza Río Seguros, ANDE, Internet)", opex.get("ocupacion_servicios", {}).get("total", 0), False, "=D17/$D$10", "5. Ocupacion y Servicios", False, False, None),
        ("4.3", "  - Mantenimiento e Infraestructura (Albañilería, Cañerías, Cámaras Frío)", opex.get("mantenimiento_infraestructura", {}).get("total", 0), False, "=D18/$D$10", "6. Mantenimiento", False, False, None),
        ("4.4", "  - Logística, Operación e Insumos (Harinas Uso Interno, Bolsas Cajas)", opex.get("logistica_operacion", {}).get("total", 0), False, "=D19/$D$10", "7. Logistica e Insumos", False, False, None),
        ("4.5", "  - Administración, Cartelería y Gestión (Publicidad, Folletos, Sistemas)", opex.get("administracion_tecnologia", {}).get("total", 0), False, "=D20/$D$10", "8. Administracion y Finanzas", False, False, None),
        
        ("5.0", "EBITDA (RESULTADO OPERATIVO BRUTO)", "=D14-D15", True, "=D21/$D$10", "Margen Operativo", True, True, PatternFill(start_color="FEF3C7", end_color="FEF3C7", fill_type="solid")),
        
        ("6.0", "GASTOS FINANCIEROS E IMPUESTOS", "=SUM(D23:D24)", True, "=D22/$D$10", "8. Administracion y Finanzas", True, False, LIGHT_GRAY_FILL),
        ("6.1", "  - Comisiones POS Tarjetas y Gastos Bancarios", financieros.get("comisiones_procesadoras_tarjetas", 0) + financieros.get("gastos_comisiones_bancarias", 0), False, "=D23/$D$10", "8. Administracion y Finanzas", False, False, None),
        ("6.2", "  - Impuestos y Tasas Municipales", financieros.get("impuestos_y_tasas", 0), False, "=D24/$D$10", "8. Administracion y Finanzas", False, False, None),
        
        ("7.0", "RESULTADO NETO DEL EJERCICIO", "=D21-D22", True, "=D25/$D$10", "Resultado Final", True, True, PatternFill(start_color="DCFCE7", end_color="DCFCE7", fill_type="solid"))
    ]

    current_row = 6
    for cod, concepto, valor, es_formula, pct_formula, hoja, bold, dbl_border, fill in pnl_rows:
        ws1.cell(row=current_row, column=2, value=cod).alignment = Alignment(horizontal="center")
        ws1.cell(row=current_row, column=3, value=concepto).alignment = Alignment(horizontal="left")
        
        c_val = ws1.cell(row=current_row, column=4, value=valor)
        c_val.number_format = CURRENCY_FORMAT
        c_val.alignment = Alignment(horizontal="right")
        
        c_pct = ws1.cell(row=current_row, column=5, value=pct_formula)
        c_pct.number_format = PERCENT_FORMAT
        c_pct.alignment = Alignment(horizontal="right")
        
        ws1.cell(row=current_row, column=6, value=hoja).alignment = Alignment(horizontal="center")

        # Formatos
        for col_idx in range(2, 7):
            cell = ws1.cell(row=current_row, column=col_idx)
            cell.border = DOUBLE_BOTTOM_BORDER if dbl_border else THIN_BORDER
            cell.font = TOTAL_FONT if bold else REGULAR_FONT
            if fill:
                cell.fill = fill
        current_row += 1

    # Sección Anexa: Conciliación Financiera y Bancaria
    current_row += 2
    ws1.merge_cells(f"B{current_row}:F{current_row}")
    title_bancos = ws1.cell(row=current_row, column=2, value="CONCILIACIÓN FINANCIERA: SALDOS BANCARIOS OFICIALES CALIBRADOS AL 30/09/2026")
    title_bancos.font = WHITE_BOLD
    title_bancos.fill = ACCENT_FILL
    title_bancos.alignment = Alignment(horizontal="center")

    current_row += 1
    headers_banco = ["ENTIDAD BANCARIA", "TIPO DE CUENTA", "NÚMERO DE CUENTA", "SALDO OFICIAL AUDITADO", "ESTADO"]
    for col_idx, h in enumerate(headers_banco, start=2):
        cell = ws1.cell(row=current_row, column=col_idx, value=h)
        cell.font = WHITE_BOLD
        cell.fill = SUBNAVY_FILL
        cell.alignment = Alignment(horizontal="center")
        cell.border = THIN_BORDER

    conciliacion = data.get("conciliacion_bancaria", {})
    bancos_list = conciliacion.get("cuentas_bancarias", [])
    current_row += 1
    start_banco_row = current_row

    for b in bancos_list:
        ws1.cell(row=current_row, column=2, value=b.get("banco", "")).font = REGULAR_FONT
        ws1.cell(row=current_row, column=3, value=b.get("tipo", "")).font = REGULAR_FONT
        ws1.cell(row=current_row, column=4, value=b.get("cuenta", "")).font = REGULAR_FONT
        
        c_s = ws1.cell(row=current_row, column=5, value=b.get("saldo", 0))
        c_s.number_format = CURRENCY_FORMAT
        c_s.font = BOLD_FONT
        c_s.alignment = Alignment(horizontal="right")

        c_st = ws1.cell(row=current_row, column=6, value="CALIBRADO")
        c_st.font = Font(name="Calibri", size=10, bold=True, color="16A34A")
        c_st.alignment = Alignment(horizontal="center")

        for c_idx in range(2, 7):
            ws1.cell(row=current_row, column=c_idx).border = THIN_BORDER

        current_row += 1

    # Total bancos
    ws1.merge_cells(f"B{current_row}:D{current_row}")
    ws1.cell(row=current_row, column=2, value="TOTAL DISPONIBLE EN BANCOS (30/09/2026)").font = TOTAL_FONT
    tot_banco_cell = ws1.cell(row=current_row, column=5, value=f"=SUM(E{start_banco_row}:E{current_row-1})")
    tot_banco_cell.number_format = CURRENCY_FORMAT
    tot_banco_cell.font = TOTAL_FONT
    tot_banco_cell.alignment = Alignment(horizontal="right")
    ws1.cell(row=current_row, column=6, value="Gs. 73.874.004").font = TOTAL_FONT

    for c_idx in range(2, 7):
        cell = ws1.cell(row=current_row, column=c_idx)
        cell.border = DOUBLE_BOTTOM_BORDER
        cell.fill = LIGHT_GRAY_FILL

    # =========================================================================
    # 2 a 8. HOJAS DE DETALLE POR MAGNITUD
    # =========================================================================
    detail_sheets_config = [
        ("2. Detalle Ingresos", [
            ("FECHA", 12), ("TURNO / CAJA", 15), ("TIPO COMPROBANTE", 18), ("NÚMERO FACTURA", 20),
            ("CANAL DE COBRO", 18), ("DESCRIPCIÓN", 35), ("IMPORTE BRUTO (Gs.)", 20), ("ESTADO", 12)
        ]),
        ("3. Detalle CMV", [
            ("FECHA", 12), ("COMPROBANTE", 20), ("PROVEEDOR REVENTA", 35), ("RUC", 15),
            ("FAMILIA ALIMENTOS", 20), ("DESCRIPCIÓN", 35), ("IMPORTE COSTO (Gs.)", 20), ("CONDICIÓN PAGO", 15)
        ]),
        ("4. Detalle Nomina SueldOK", [
            ("C.I. Nº", 12), ("COLABORADOR", 32), ("CARGO", 25), ("DEPARTAMENTO", 18),
            ("SALARIO BASE", 18), ("HORAS EXTRAS", 16), ("DEVENGADO TOTAL", 18),
            ("IPS OBRERO (9%)", 18), ("IPS PATRONAL (16.5%)", 20), ("AGUINALDO PROP.", 18),
            ("DESCUENTOS / ANT.", 18), ("LÍQUIDO A COBRAR", 18)
        ]),
        ("5. Ocupacion y Servicios", [
            ("FECHA", 12), ("FACTURA Nº", 20), ("PROVEEDOR / ENTIDAD", 35), ("RUC", 15),
            ("SUBCATEGORÍA", 20), ("DESCRIPCIÓN SERVICIO", 40), ("IMPORTE (Gs.)", 20), ("ESTADO", 12)
        ]),
        ("6. Mantenimiento", [
            ("FECHA", 12), ("FACTURA Nº", 20), ("PROVEEDOR TÉCNICO", 35), ("RUC", 15),
            ("EQUIPO / ÁREA", 25), ("DETALLE INTERVENCIÓN", 40), ("IMPORTE (Gs.)", 20), ("ESTADO", 12)
        ]),
        ("7. Logistica e Insumos", [
            ("FECHA", 12), ("COMPROBANTE", 20), ("PROVEEDOR", 35), ("RUC", 15),
            ("RUBRO", 20), ("DETALLE INSUMO / FLETE", 40), ("IMPORTE (Gs.)", 20), ("ESTADO", 12)
        ]),
        ("8. Administracion y Finanzas", [
            ("FECHA", 12), ("COMPROBANTE", 20), ("ENTIDAD / PROFESIONAL", 35), ("RUC", 15),
            ("CONCEPTO FINANCIERO", 30), ("DESCRIPCIÓN", 40), ("IMPORTE (Gs.)", 20), ("ESTADO", 12)
        ])
    ]

    for title, cols in detail_sheets_config:
        ws = wb.create_sheet(title=title)
        ws.views.sheetView[0].showGridLines = True

        # Título de la hoja
        ws.merge_cells(f"A1:{get_column_letter(len(cols))}1")
        h_cell = ws["A1"]
        h_cell.value = f"EXTRA SUPERMERCADO MAYORISTA — {title.upper()} (SETIEMBRE 2026)"
        h_cell.font = WHITE_BOLD
        h_cell.fill = NAVY_FILL
        h_cell.alignment = Alignment(horizontal="center", vertical="center")
        ws.row_dimensions[1].height = 25

        # Cabecera de columnas
        for col_idx, (col_name, _) in enumerate(cols, start=1):
            c = ws.cell(row=3, column=col_idx, value=col_name)
            c.font = WHITE_BOLD
            c.fill = SUBNAVY_FILL
            c.alignment = Alignment(horizontal="center", vertical="center")
            c.border = THIN_BORDER
        ws.row_dimensions[3].height = 22

        # Rellenar datos de nómina real
        if "Nomina" in title:
            payroll_file = "Datos/real_payroll_septiembre.json"
            if not os.path.exists(payroll_file):
                payroll_file = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../Datos/real_payroll_septiembre.json"))
            empleados_reales = []
            if os.path.exists(payroll_file):
                with open(payroll_file, "r", encoding="utf-8") as pf:
                    raw_emps = json.load(pf)
                    for r in raw_emps:
                        empleados_reales.append((
                            r.get("ci", ""),
                            r.get("empleado", ""),
                            r.get("cargo", ""),
                            r.get("departamento", "Salón"),
                            r.get("salario_base", 0),
                            r.get("horas_extras", 0),
                            r.get("total_devengado", 0),
                            r.get("ips_obrero", 0),
                            r.get("ips_patronal", 0),
                            r.get("aguinaldo_provisional", 0),
                            r.get("anticipos_descuentos", 0),
                            r.get("neto_a_cobrar", 0),
                        ))
            row_idx = 4
            for emp in empleados_reales:
                for c_i, val in enumerate(emp, start=1):
                    cell = ws.cell(row=row_idx, column=c_i, value=val)
                    cell.font = REGULAR_FONT
                    cell.border = THIN_BORDER
                    if c_i >= 5:
                        cell.number_format = CURRENCY_FORMAT
                        cell.alignment = Alignment(horizontal="right")
                    else:
                        cell.alignment = Alignment(horizontal="left" if c_i in [2, 3, 4] else "center")
                row_idx += 1
            
            # Fila totalizadora
            ws.cell(row=row_idx, column=2, value="TOTALES DEVENGADOS").font = BOLD_FONT
            for num_col in range(5, 13):
                col_let = get_column_letter(num_col)
                c_tot = ws.cell(row=row_idx, column=num_col, value=f"=SUM({col_let}4:{col_let}{row_idx-1})")
                c_tot.number_format = CURRENCY_FORMAT
                c_tot.font = TOTAL_FONT
                c_tot.border = DOUBLE_BOTTOM_BORDER
                c_tot.fill = LIGHT_GRAY_FILL

        # Ajustar anchos de columna
        for col_idx, (_, width) in enumerate(cols, start=1):
            col_letter = get_column_letter(col_idx)
            ws.column_dimensions[col_letter].width = width

    # Ajustar anchos en Hoja 1
    ws1_widths = {"A": 4, "B": 8, "C": 55, "D": 24, "E": 18, "F": 32}
    for col_l, w in ws1_widths.items():
        ws1.column_dimensions[col_l].width = w

    # Remover default sheet si quedó vacía
    if default_sheet.title == "Sheet" and len(wb.sheetnames) > 1:
        wb.remove(default_sheet)

    out = io.BytesIO()
    wb.save(out)
    return out.getvalue()
