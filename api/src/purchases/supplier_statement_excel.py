"""Generador de Exportación Excel (XLSX) para el Extracto de Cuenta Corriente y Punteo de Proveedores.

Diseño profesional corporativo para Extra Supermercado:
- Encabezado con datos fiscales y del proveedor.
- KPIs ejecutivos de saldos y compromisos.
- Tabla detallada con casillas de verificación para punteo manual.
- Formato numérico en Guaraníes (#,##0).
- Anchos de columna automáticos.
"""
from __future__ import annotations

import io
from typing import Dict, Any, Optional

from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter


FONT_FAMILY = "Calibri"

TITLE_FONT = Font(name=FONT_FAMILY, bold=True, size=14, color="0F172A")
SUBTITLE_FONT = Font(name=FONT_FAMILY, bold=True, size=11, color="1E3A8A")
META_FONT = Font(name=FONT_FAMILY, size=9, color="475569")
META_BOLD = Font(name=FONT_FAMILY, bold=True, size=9, color="0F172A")

KPI_LABEL_FONT = Font(name=FONT_FAMILY, size=8, color="64748B", bold=True)
KPI_VAL_FONT = Font(name=FONT_FAMILY, size=11, bold=True, color="0F172A")
KPI_FILL = PatternFill(start_color="F1F5F9", end_color="F1F5F9", fill_type="solid")

HEADER_FONT = Font(name=FONT_FAMILY, bold=True, size=9, color="FFFFFF")
HEADER_FILL = PatternFill(start_color="0F172A", end_color="0F172A", fill_type="solid")

DATA_FONT = Font(name=FONT_FAMILY, size=9)
DATA_FONT_BOLD = Font(name=FONT_FAMILY, bold=True, size=9)
DATA_FONT_RED = Font(name=FONT_FAMILY, bold=True, size=9, color="DC2626")
DATA_FONT_GREEN = Font(name=FONT_FAMILY, bold=True, size=9, color="16A34A")

TOTAL_FONT = Font(name=FONT_FAMILY, bold=True, size=10, color="0F172A")
TOTAL_FILL = PatternFill(start_color="E2E8F0", end_color="E2E8F0", fill_type="solid")

THIN_BORDER = Border(
    left=Side(style="thin", color="E2E8F0"),
    right=Side(style="thin", color="E2E8F0"),
    top=Side(style="thin", color="E2E8F0"),
    bottom=Side(style="thin", color="E2E8F0"),
)

HEADER_BORDER = Border(
    left=Side(style="thin", color="334155"),
    right=Side(style="thin", color="334155"),
    top=Side(style="thin", color="334155"),
    bottom=Side(style="thin", color="334155"),
)

CURRENCY_FMT = "#,##0"


def generate_supplier_statement_excel(data: Dict[str, Any]) -> bytes:
    wb = Workbook()
    ws = wb.active
    ws.title = "Extracto de Deuda"
    ws.views.sheetView[0].showGridLines = True

    sup = data.get("supplier", {})
    per = data.get("periodo", {})
    tot = data.get("totales", {})
    movimientos = data.get("movimientos", [])
    cheques = data.get("cheques_transito", [])

    # 1. ENCABEZADO
    ws.cell(row=1, column=1, value="EXTRA SUPERMERCADO MAYORISTA — GRUPO SANTA TERESA E.A.S.").font = TITLE_FONT
    ws.cell(row=2, column=1, value="EXTRACTO DE CUENTA CORRIENTE Y PUNTEO FÍSICO DE DEUDA").font = SUBTITLE_FONT

    rz = sup.get("razon_social") or "Proveedor"
    ruc = sup.get("ruc") or "S/RUC"
    f_desde = per.get("fecha_desde") or "Inicio"
    f_hasta = per.get("fecha_hasta") or "Actual"
    modo_str = "Solo Comprobantes Pendientes con Saldo" if per.get("solo_pendientes") else "Extracto Completo (Libro Mayor)"
    orden_str = "Por N° de Factura" if per.get("ordenar_por") == "numero_factura" else "Cronológico por Fecha"
    f_emision = per.get("fecha_emision_reporte") or ""

    ws.cell(row=3, column=1, value=f"Proveedor: {rz}  |  RUC: {ruc}  |  Tel: {sup.get('telefono', '—')}").font = META_BOLD
    ws.cell(row=4, column=1, value=f"Período: {f_desde} — {f_hasta}  |  Modo: {modo_str}  |  Orden: {orden_str}  |  Emisión: {f_emision}").font = META_FONT

    # 2. BLOQUE DE RESUMEN EJECUTIVO (KPIS)
    kpis = [
        ("1. FACTURAS (DÉBITO)", tot.get("total_facturas_debito", 0.0)),
        ("2. NOTAS CRÉDITO", -tot.get("total_nc_credito", 0.0)),
        ("3. PAGOS REALIZADOS", -tot.get("total_pagos_credito", 0.0)),
        ("4. SALDO EXIGIBLE", tot.get("saldo_deudor_final", 0.0)),
        ("5. CHQ. TRANSITO", tot.get("cheques_diferidos_transito_monto", 0.0)),
        ("6. COMPROMISO TOTAL", tot.get("compromiso_total_con_cheques", 0.0)),
    ]

    row_kpi_lbl = 6
    row_kpi_val = 7
    for col_idx, (lbl, val) in enumerate(kpis, 1):
        cell_lbl = ws.cell(row=row_kpi_lbl, column=col_idx, value=lbl)
        cell_lbl.font = KPI_LABEL_FONT
        cell_lbl.fill = KPI_FILL
        cell_lbl.alignment = Alignment(horizontal="center", vertical="center")
        cell_lbl.border = THIN_BORDER

        cell_val = ws.cell(row=row_kpi_val, column=col_idx, value=val)
        cell_val.font = KPI_VAL_FONT
        cell_val.fill = KPI_FILL
        cell_val.alignment = Alignment(horizontal="right", vertical="center")
        cell_val.border = THIN_BORDER
        cell_val.number_format = CURRENCY_FMT

    # 3. TABLA PRINCIPAL DE MOVIMIENTOS
    headers = [
        "Punteo [  ]",
        "Fecha",
        "Vencimiento",
        "Tipo",
        "N° Comprobante",
        "Concepto / Imputación Comercial",
        "Débito (+) Gs.",
        "Crédito (-) Gs.",
        "Saldo Prog. Gs.",
        "Estado / Vencimiento",
    ]

    header_row = 9
    for col_idx, h in enumerate(headers, 1):
        c = ws.cell(row=header_row, column=col_idx, value=h)
        c.font = HEADER_FONT
        c.fill = HEADER_FILL
        c.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        c.border = HEADER_BORDER

    current_row = header_row + 1

    # Saldo anterior si corresponde
    saldo_anterior = data.get("saldo_anterior", 0.0)
    if saldo_anterior != 0.0 or per.get("fecha_desde"):
        ws.cell(row=current_row, column=1, value="[   ]").alignment = Alignment(horizontal="center")
        ws.cell(row=current_row, column=2, value=per.get("fecha_desde") or "—").alignment = Alignment(horizontal="center")
        ws.cell(row=current_row, column=3, value="—").alignment = Alignment(horizontal="center")
        ws.cell(row=current_row, column=4, value="SALDO").alignment = Alignment(horizontal="center")
        ws.cell(row=current_row, column=5, value="SALDO INICIAL").font = DATA_FONT_BOLD
        ws.cell(row=current_row, column=6, value=f"Saldo anterior al {per.get('fecha_desde') or 'período'}").font = DATA_FONT_BOLD

        c_deb = ws.cell(row=current_row, column=7, value=saldo_anterior if saldo_anterior > 0 else None)
        if saldo_anterior > 0:
            c_deb.number_format = CURRENCY_FMT
        c_cred = ws.cell(row=current_row, column=8, value=abs(saldo_anterior) if saldo_anterior < 0 else None)
        if saldo_anterior < 0:
            c_cred.number_format = CURRENCY_FMT

        c_sp = ws.cell(row=current_row, column=9, value=saldo_anterior)
        c_sp.font = DATA_FONT_RED if saldo_anterior > 0 else DATA_FONT_GREEN
        c_sp.number_format = CURRENCY_FMT

        ws.cell(row=current_row, column=10, value="Inicial").alignment = Alignment(horizontal="center")

        for col_i in range(1, len(headers) + 1):
            ws.cell(row=current_row, column=col_i).border = THIN_BORDER
        current_row += 1

    for m in movimientos:
        t_badge = m.get("tipo_badge", "FAC")
        deb = m.get("debito", 0.0)
        cred = m.get("credito", 0.0)
        sp = m.get("saldo_progresivo", 0.0)

        ws.cell(row=current_row, column=1, value="[   ]").alignment = Alignment(horizontal="center")
        ws.cell(row=current_row, column=2, value=m.get("fecha_str", "")).alignment = Alignment(horizontal="center")
        ws.cell(row=current_row, column=3, value=m.get("fecha_vencimiento_str", "") or "—").alignment = Alignment(horizontal="center")

        c_tipo = ws.cell(row=current_row, column=4, value=t_badge)
        c_tipo.alignment = Alignment(horizontal="center")
        c_tipo.font = DATA_FONT_BOLD

        c_comp = ws.cell(row=current_row, column=5, value=m.get("comprobante", ""))
        c_comp.font = DATA_FONT_BOLD

        ws.cell(row=current_row, column=6, value=m.get("concepto", "")).font = DATA_FONT

        c_deb = ws.cell(row=current_row, column=7, value=deb if deb > 0 else None)
        if deb > 0:
            c_deb.number_format = CURRENCY_FMT
            c_deb.alignment = Alignment(horizontal="right")

        c_cred = ws.cell(row=current_row, column=8, value=-cred if cred > 0 else None)
        if cred > 0:
            c_cred.number_format = CURRENCY_FMT
            c_cred.font = DATA_FONT_GREEN
            c_cred.alignment = Alignment(horizontal="right")

        c_sp = ws.cell(row=current_row, column=9, value=sp)
        c_sp.font = DATA_FONT_RED if sp > 0 else DATA_FONT_GREEN
        c_sp.number_format = CURRENCY_FMT
        c_sp.alignment = Alignment(horizontal="right")

        c_est = ws.cell(row=current_row, column=10, value=m.get("estado", ""))
        c_est.alignment = Alignment(horizontal="center")
        c_est.font = DATA_FONT

        for col_i in range(1, len(headers) + 1):
            cell = ws.cell(row=current_row, column=col_i)
            cell.border = THIN_BORDER

        current_row += 1

    # Fila de Totales
    ws.cell(row=current_row, column=1, value="").fill = TOTAL_FILL
    ws.cell(row=current_row, column=2, value="").fill = TOTAL_FILL
    ws.cell(row=current_row, column=3, value="").fill = TOTAL_FILL
    ws.cell(row=current_row, column=4, value="TOTAL").font = TOTAL_FONT
    ws.cell(row=current_row, column=4).fill = TOTAL_FILL
    ws.cell(row=current_row, column=4).alignment = Alignment(horizontal="center")

    c_cnt = ws.cell(row=current_row, column=5, value=f"{len(movimientos)} Movimientos")
    c_cnt.font = TOTAL_FONT
    c_cnt.fill = TOTAL_FILL

    ws.cell(row=current_row, column=6, value="Balance Consolidado del Proveedor").font = TOTAL_FONT
    ws.cell(row=current_row, column=6).fill = TOTAL_FILL

    c_tot_deb = ws.cell(row=current_row, column=7, value=tot.get("total_facturas_debito", 0.0))
    c_tot_deb.font = TOTAL_FONT
    c_tot_deb.fill = TOTAL_FILL
    c_tot_deb.number_format = CURRENCY_FMT
    c_tot_deb.alignment = Alignment(horizontal="right")

    tot_cred_val = (tot.get("total_nc_credito", 0.0) + tot.get("total_pagos_credito", 0.0))
    c_tot_cred = ws.cell(row=current_row, column=8, value=-tot_cred_val if tot_cred_val > 0 else 0)
    c_tot_cred.font = DATA_FONT_GREEN
    c_tot_cred.fill = TOTAL_FILL
    c_tot_cred.number_format = CURRENCY_FMT
    c_tot_cred.alignment = Alignment(horizontal="right")

    c_tot_sp = ws.cell(row=current_row, column=9, value=tot.get("saldo_deudor_final", 0.0))
    c_tot_sp.font = DATA_FONT_RED if tot.get("saldo_deudor_final", 0.0) > 0 else DATA_FONT_GREEN
    c_tot_sp.fill = TOTAL_FILL
    c_tot_sp.number_format = CURRENCY_FMT
    c_tot_sp.alignment = Alignment(horizontal="right")

    ws.cell(row=current_row, column=10, value="SALDO FINAL").font = TOTAL_FONT
    ws.cell(row=current_row, column=10).fill = TOTAL_FILL
    ws.cell(row=current_row, column=10).alignment = Alignment(horizontal="center")

    for col_i in range(1, len(headers) + 1):
        ws.cell(row=current_row, column=col_i).border = THIN_BORDER

    current_row += 3

    # 4. TABLA DE CHEQUES DIFERIDOS EN TRÁNSITO (SI EXISTEN)
    if cheques:
        ws.cell(row=current_row, column=1, value="CHEQUES DIFERIDOS ENTREGADOS EN TRÁNSITO (NO COMPENSADOS)").font = SUBTITLE_FONT
        current_row += 1

        chq_headers = ["N° Cheque", "Banco Emisor / Cuenta", "Fecha Emisión", "Fecha Pago (Venc.)", "Días Restantes", "Monto Gs.", "Estado"]
        for col_idx, h in enumerate(chq_headers, 1):
            c = ws.cell(row=current_row, column=col_idx, value=h)
            c.font = HEADER_FONT
            c.fill = HEADER_FILL
            c.alignment = Alignment(horizontal="center", vertical="center")
            c.border = HEADER_BORDER

        current_row += 1
        for ch in cheques:
            ws.cell(row=current_row, column=1, value=ch.get("numero", "S/N")).alignment = Alignment(horizontal="center")
            ws.cell(row=current_row, column=2, value=ch.get("banco_emisor", "")).font = DATA_FONT
            ws.cell(row=current_row, column=3, value=ch.get("fecha_emision", "")).alignment = Alignment(horizontal="center")
            ws.cell(row=current_row, column=4, value=ch.get("fecha_pago", "")).alignment = Alignment(horizontal="center")
            ws.cell(row=current_row, column=5, value=ch.get("dias_restantes", 0)).alignment = Alignment(horizontal="center")

            c_monto = ws.cell(row=current_row, column=6, value=ch.get("monto", 0.0))
            c_monto.font = DATA_FONT_BOLD
            c_monto.number_format = CURRENCY_FMT
            c_monto.alignment = Alignment(horizontal="right")

            ws.cell(row=current_row, column=7, value=ch.get("estado", "")).alignment = Alignment(horizontal="center")

            for col_i in range(1, len(chq_headers) + 1):
                ws.cell(row=current_row, column=col_i).border = THIN_BORDER
            current_row += 1

    # Autoajuste de anchos de columna
    for col in ws.columns:
        col_letter = get_column_letter(col[0].column)
        max_len = 0
        for cell in col:
            if cell.row < 5:
                continue
            val_str = str(cell.value or "")
            if len(val_str) > max_len:
                max_len = len(val_str)
        ws.column_dimensions[col_letter].width = max(max_len + 3, 11)

    # Fijar anchos clave
    ws.column_dimensions["A"].width = 11
    ws.column_dimensions["B"].width = 13
    ws.column_dimensions["C"].width = 13
    ws.column_dimensions["D"].width = 9
    ws.column_dimensions["E"].width = 22
    ws.column_dimensions["F"].width = 38
    ws.column_dimensions["G"].width = 16
    ws.column_dimensions["H"].width = 16
    ws.column_dimensions["I"].width = 17
    ws.column_dimensions["J"].width = 16

    buffer = io.BytesIO()
    wb.save(buffer)
    return buffer.getvalue()
