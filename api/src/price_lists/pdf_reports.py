"""Reportes oficiales de Variaciones de Precios para Extra Supermercado (PDF y CSV).

Genera documentos corporativos con membrete formal, formato bimonetario/PYG,
respeto estricto a la zona horaria America/Asuncion y tipografía corporativa.
"""

import io
import csv
from datetime import datetime
from zoneinfo import ZoneInfo
from typing import Optional

from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, Spacer, Table, TableStyle
from reportlab.lib.enums import TA_RIGHT, TA_LEFT, TA_CENTER
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.colors import HexColor


from api.src.integrated_finance.pdf_reports import (
    _base_landscape_doc, _company_header, _fmt_gs, _build,
    RED, GREEN, GRAY_LIGHT, GRAY_MEDIUM, PRIMARY_COLOR, WHITE, FONT_BOLD, FONT_REGULAR,
)

PY_TZ = ZoneInfo("America/Asuncion")


def generate_price_variations_pdf(
    company: dict,
    items: list[dict],
    fecha_desde: Optional[str] = None,
    fecha_hasta: Optional[str] = None,
    tipo: Optional[str] = None,
    generated_by: str = "Administración",
) -> bytes:
    """Genera el PDF formal de Variaciones de Precios en A4 horizontal."""
    buffer = io.BytesIO()
    doc, styles = _base_landscape_doc(buffer, "Reporte de Variaciones de Precios", company, generated_by)

    # Subtítulo con período en hora de Paraguay
    ahora_py = datetime.now(PY_TZ).strftime("%d/%m/%Y %H:%M")
    periodo_str = f"Generado: {ahora_py}"
    if fecha_desde and fecha_hasta:
        periodo_str = f"Período: {fecha_desde} al {fecha_hasta} · {periodo_str}"
    elif fecha_desde:
        periodo_str = f"Desde: {fecha_desde} · {periodo_str}"
    elif fecha_hasta:
        periodo_str = f"Hasta: {fecha_hasta} · {periodo_str}"

    if tipo and tipo != "todos":
        tipo_label = "Precios Unitarios" if tipo == "unitario" else "Precios de Escala"
        periodo_str = f"{periodo_str} · Filtro: {tipo_label}"

    elements = _company_header(
        company,
        styles,
        "Reporte de Variaciones de Precios Regulares",
        periodo_str,
        generated_by,
    )

    if not items:
        elements.append(Paragraph("No se registraron variaciones de precios para el período y criterios seleccionados.", styles["Normal"]))
        _build(doc, elements)
        return buffer.getvalue()

    # Métricas de resumen
    total_cambios = len(items)
    subidas = sum(1 for it in items if it.get("diferencia_monto", 0) > 0)
    bajadas = sum(1 for it in items if it.get("diferencia_monto", 0) < 0)
    pcts = [it.get("diferencia_pct", 0) for it in items]
    promedio_pct = round(sum(pcts) / len(pcts), 2) if pcts else 0.0

    kpi_style_label = ParagraphStyle("KpiLabel", fontName=FONT_REGULAR, fontSize=7.5, textColor=GRAY_MEDIUM, alignment=TA_CENTER)
    kpi_style_val = ParagraphStyle("KpiVal", fontName=FONT_BOLD, fontSize=11, textColor=PRIMARY_COLOR, alignment=TA_CENTER)
    kpi_up = ParagraphStyle("KpiUp", fontName=FONT_BOLD, fontSize=11, textColor=RED, alignment=TA_CENTER)
    kpi_down = ParagraphStyle("KpiDown", fontName=FONT_BOLD, fontSize=11, textColor=GREEN, alignment=TA_CENTER)

    kpi_data = [
        [
            Paragraph("Total Modificaciones", kpi_style_label),
            Paragraph("Aumentos de Precio (🔺)", kpi_style_label),
            Paragraph("Rebajas de Precio (🔻)", kpi_style_label),
            Paragraph("Variación Promedio", kpi_style_label),
        ],
        [
            Paragraph(f"{total_cambios:,}".replace(",", "."), kpi_style_val),
            Paragraph(f"{subidas:,}".replace(",", "."), kpi_up),
            Paragraph(f"{bajadas:,}".replace(",", "."), kpi_down),
            Paragraph(f"{promedio_pct:+.2f}%", kpi_style_val),
        ],
    ]
    kpi_table = Table(kpi_data, colWidths=[68 * mm, 68 * mm, 68 * mm, 68 * mm])
    kpi_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), GRAY_LIGHT),
        ("BOX", (0, 0), (-1, -1), 0.5, HexColor("#CBD5E1")),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, HexColor("#E2E8F0")),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
    ]))
    elements.append(kpi_table)
    elements.append(Spacer(1, 4 * mm))

    # Tabla detallada de variaciones
    # Ancho disponible: 273 mm
    col_widths = [
        23 * mm,  # Fecha/Hora
        26 * mm,  # Código de Barras (reemplaza SKU a pedido)
        60 * mm,  # Producto
        25 * mm,  # P. Min. Ant.
        25 * mm,  # P. Min. Nuevo
        25 * mm,  # P. Escala Ant.
        25 * mm,  # P. Escala Nuevo
        18 * mm,  # Dif. %
        32 * mm,  # Responsable
    ]

    header_style = ParagraphStyle("TH", fontName=FONT_BOLD, fontSize=7, textColor=WHITE, alignment=TA_CENTER)
    cell_text = ParagraphStyle("TD", fontName=FONT_REGULAR, fontSize=6.5, leading=8.5)
    cell_bold = ParagraphStyle("TDBold", fontName=FONT_BOLD, fontSize=6.5, leading=8.5)
    cell_num = ParagraphStyle("TDNum", fontName=FONT_REGULAR, fontSize=6.5, leading=8.5, alignment=TA_RIGHT)
    cell_up = ParagraphStyle("TDUp", fontName=FONT_BOLD, fontSize=6.5, leading=8.5, textColor=RED, alignment=TA_RIGHT)
    cell_down = ParagraphStyle("TDDown", fontName=FONT_BOLD, fontSize=6.5, leading=8.5, textColor=GREEN, alignment=TA_RIGHT)

    table_rows = [[
        Paragraph("Fecha / Hora", header_style),
        Paragraph("Cód. Barras", header_style),
        Paragraph("Producto", header_style),
        Paragraph("P. Min. Ant.", header_style),
        Paragraph("P. Min. Nvo.", header_style),
        Paragraph("P. Esc. Ant.", header_style),
        Paragraph("P. Esc. Nvo.", header_style),
        Paragraph("Dif. (%)", header_style),
        Paragraph("Responsable", header_style),
    ]]

    for it in items:
        # Fecha en Asunción
        dt = it.get("created_at")
        if isinstance(dt, datetime):
            if dt.tzinfo is None:
                dt_str = dt.strftime("%d/%m/%Y %H:%M")
            else:
                dt_str = dt.astimezone(PY_TZ).strftime("%d/%m/%Y %H:%M")
        else:
            dt_str = str(dt or "")[:16]

        barcode = it.get("product_barcode") or it.get("product_sku") or "-"
        prod_name = it.get("product_nombre") or "Producto sin nombre"

        # Precios Minoristas
        p_min_ant = float(it.get("precio_minorista_anterior") or 0)
        p_min_new = float(it.get("precio_minorista_nuevo") or 0)
        if it.get("cambio_unitario") is False:
            p_min_ant_str = "-"
        else:
            p_min_ant_str = _fmt_gs(p_min_ant) if p_min_ant > 0 else "-"
        p_min_new_str = _fmt_gs(p_min_new) if p_min_new > 0 else "-"

        # Precios Escala (primera escala)
        p_esc_ant = float(it.get("precio_escala_anterior") or 0)
        p_esc_new = float(it.get("precio_escala_nuevo") or 0)
        mq = it.get("escala_min_qty")
        mq_suffix = f" (x{mq})" if mq and mq > 1 else ""

        if it.get("cambio_escala") is False:
            p_esc_ant_str = "-"
            p_esc_new_str = f"{_fmt_gs(p_esc_new)}{mq_suffix}" if p_esc_new > 0 else "-"
        else:
            p_esc_ant_str = f"{_fmt_gs(p_esc_ant)}{mq_suffix}" if p_esc_ant > 0 else ("0" if p_esc_ant == 0 and p_esc_new > 0 else "-")
            p_esc_new_str = f"{_fmt_gs(p_esc_new)}{mq_suffix}" if p_esc_new > 0 else "-"

        # Diferencia de la variación principal
        diff_monto = float(it.get("diferencia_monto", 0))
        diff_pct = float(it.get("diferencia_pct", 0))
        diff_pct_str = f"{'+' if diff_pct > 0 else ''}{diff_pct:.1f}%"
        pct_style = cell_up if diff_monto > 0 else (cell_down if diff_monto < 0 else cell_num)

        resp = it.get("usuario_nombre") or it.get("origen") or "Administrador"

        table_rows.append([
            Paragraph(dt_str, cell_text),
            Paragraph(barcode, cell_text),
            Paragraph(prod_name[:42], cell_bold),
            Paragraph(p_min_ant_str, cell_num),
            Paragraph(p_min_new_str, cell_num),
            Paragraph(p_esc_ant_str, cell_num),
            Paragraph(p_esc_new_str, cell_num),
            Paragraph(diff_pct_str, pct_style),
            Paragraph(resp[:22], cell_text),
        ])

    tab = Table(table_rows, colWidths=col_widths, repeatRows=1)
    tab.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), PRIMARY_COLOR),
        ("ALIGN", (0, 0), (-1, 0), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("GRID", (0, 0), (-1, -1), 0.3, HexColor("#CBD5E1")),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [WHITE, HexColor("#F8FAFC")]),
        ("TOPPADDING", (0, 0), (-1, -1), 2.5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2.5),
    ]))
    elements.append(tab)

    _build(doc, elements)
    return buffer.getvalue()


def generate_price_variations_csv(items: list[dict]) -> str:
    """Genera CSV con codificación UTF-8 BOM para apertura directa en Excel."""
    output = io.StringIO()
    # Escribir UTF-8 BOM
    output.write("\ufeff")
    writer = csv.writer(output, delimiter=";", quoting=csv.QUOTE_MINIMAL)

    # Cabeceras completas
    writer.writerow([
        "Fecha y Hora (Paraguay)",
        "Código de Barras",
        "SKU",
        "Producto",
        "Categoría",
        "P. Minorista Anterior (Gs.)",
        "P. Minorista Nuevo (Gs.)",
        "P. Escala Anterior (Gs.)",
        "P. Escala Nuevo (Gs.)",
        "Cant. Mínima Escala",
        "Diferencia (Gs.)",
        "Diferencia (%)",
        "Responsable",
        "Origen",
        "Motivo",
    ])

    for it in items:
        dt = it.get("created_at")
        if isinstance(dt, datetime):
            if dt.tzinfo is None:
                dt_str = dt.strftime("%d/%m/%Y %H:%M:%S")
            else:
                dt_str = dt.astimezone(PY_TZ).strftime("%d/%m/%Y %H:%M:%S")
        else:
            dt_str = str(dt or "")

        p_min_ant = int(round(float(it.get("precio_minorista_anterior") or (it.get("precio_anterior") if it.get("tipo") == "unitario" else 0))))
        p_min_new = int(round(float(it.get("precio_minorista_nuevo") or (it.get("precio_nuevo") if it.get("tipo") == "unitario" else 0))))
        p_esc_ant = int(round(float(it.get("precio_escala_anterior") or (it.get("precio_anterior") if it.get("tipo") == "escala" else 0))))
        p_esc_new = int(round(float(it.get("precio_escala_nuevo") or (it.get("precio_nuevo") if it.get("tipo") == "escala" else 0))))

        min_qty = it.get("escala_min_qty") or ""
        d_monto = int(round(float(it.get("diferencia_monto", 0))))
        d_pct = round(float(it.get("diferencia_pct", 0)), 2)

        writer.writerow([
            dt_str,
            it.get("product_barcode") or "",
            it.get("product_sku") or "",
            it.get("product_nombre") or "",
            it.get("categoria_nombre") or "",
            p_min_ant,
            p_min_new,
            p_esc_ant,
            p_esc_new,
            min_qty,
            d_monto,
            f"{d_pct}%",
            it.get("usuario_nombre") or "Administrador",
            it.get("origen") or "",
            it.get("motivo") or "",
        ])

    return output.getvalue()


def generate_audit_modifications_pdf(items: list[dict], company: Optional[dict] = None) -> bytes:
    """Genera el PDF formal de productos modificados en la auditoría en orden alfabético."""
    company = company or {
        "razon_social": "GRUPO SANTA TERESA E.A.S.",
        "nombre_fantasia": "Extra Supermercado Mayorista",
        "ruc": "80150377-9",
        "direccion": "Pedro Juan Caballero, Paraguay",
    }
    buffer = io.BytesIO()
    doc, styles = _base_landscape_doc(buffer, "Auditoría de Precios Modificados", company, "Administración")

    # Sort alphabetically by product name
    sorted_items = sorted(items, key=lambda x: (x.get("nombre") or "").upper())

    total_mod = len(sorted_items)
    total_subidas = sum(1 for x in sorted_items if x.get("diferencia_monto", 0) > 0)
    total_bajadas = sum(1 for x in sorted_items if x.get("diferencia_monto", 0) < 0)
    con_escalas = sum(1 for x in sorted_items if x.get("escalas") and x.get("escalas") != "-")

    ahora_py = datetime.now(PY_TZ).strftime("%d/%m/%Y %H:%M")
    periodo_str = f"Emisión: {ahora_py} · Total modificados: {total_mod} · Aumentos: {total_subidas} · Rebajas: {total_bajadas}"

    elements = _company_header(
        company,
        styles,
        "Catálogo de Precios Auditados y Modificados (Orden Alfabético)",
        periodo_str,
        "Auditoría de Rentabilidad",
    )

    kpi_style_label = ParagraphStyle("KpiL", fontName=FONT_BOLD, fontSize=7, alignment=TA_CENTER, textColor=GRAY_MEDIUM)
    kpi_style_val = ParagraphStyle("KpiV", fontName=FONT_BOLD, fontSize=10, alignment=TA_CENTER, textColor=PRIMARY_COLOR)
    kpi_up = ParagraphStyle("KpiUp", fontName=FONT_BOLD, fontSize=10, alignment=TA_CENTER, textColor=GREEN)
    kpi_down = ParagraphStyle("KpiDown", fontName=FONT_BOLD, fontSize=10, alignment=TA_CENTER, textColor=RED)

    kpi_table = Table([
        [
            Paragraph("TOTAL PRODUCTOS MODIFICADOS", kpi_style_label),
            Paragraph("AUMENTOS APROBADOS (▲)", kpi_style_label),
            Paragraph("REBAJAS / AJUSTES (▼)", kpi_style_label),
            Paragraph("PRODUCTOS CON ESCALAS", kpi_style_label),
        ],
        [
            Paragraph(f"{total_mod}", kpi_style_val),
            Paragraph(f"{total_subidas}", kpi_up),
            Paragraph(f"{total_bajadas}", kpi_down),
            Paragraph(f"{con_escalas}", kpi_style_val),
        ]
    ], colWidths=[68.2 * mm, 68.2 * mm, 68.2 * mm, 68.2 * mm])
    kpi_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), GRAY_LIGHT),
        ("BOX", (0, 0), (-1, -1), 0.5, HexColor("#CBD5E1")),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, HexColor("#E2E8F0")),
        ("TOPPADDING", (0, 0), (-1, -1), 2),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
    ]))
    elements.append(kpi_table)
    elements.append(Spacer(1, 3 * mm))

    col_widths = [8 * mm, 15 * mm, 24 * mm, 75 * mm, 24 * mm, 25 * mm, 24 * mm, 82 * mm]
    th_style = ParagraphStyle("TH", fontName=FONT_BOLD, fontSize=7.5, leading=9.5, textColor=WHITE, alignment=TA_CENTER)
    th_style_l = ParagraphStyle("THL", fontName=FONT_BOLD, fontSize=7.5, leading=9.5, textColor=WHITE, alignment=TA_LEFT)
    th_style_r = ParagraphStyle("THR", fontName=FONT_BOLD, fontSize=7.5, leading=9.5, textColor=WHITE, alignment=TA_RIGHT)

    td_idx = ParagraphStyle("TdIdx", fontName=FONT_REGULAR, fontSize=7, leading=8.5, alignment=TA_CENTER, textColor=GRAY_MEDIUM)
    td_sku = ParagraphStyle("TdSku", fontName=FONT_BOLD, fontSize=7.5, leading=9, alignment=TA_CENTER, textColor=PRIMARY_COLOR)
    td_bar = ParagraphStyle("TdBar", fontName=FONT_REGULAR, fontSize=7, leading=8.5, alignment=TA_CENTER, textColor=GRAY_MEDIUM)
    td_prod_name = ParagraphStyle("TdProdName", fontName=FONT_BOLD, fontSize=7.5, leading=9.5, textColor=PRIMARY_COLOR)
    td_prod_sub = ParagraphStyle("TdProdSub", fontName=FONT_REGULAR, fontSize=6.5, leading=8, textColor=GRAY_MEDIUM)
    td_num_ant = ParagraphStyle("TdNumAnt", fontName=FONT_REGULAR, fontSize=7.5, leading=9, alignment=TA_RIGHT, textColor=GRAY_MEDIUM)
    td_num_new = ParagraphStyle("TdNumNew", fontName=FONT_BOLD, fontSize=8, leading=9.5, alignment=TA_RIGHT, textColor=PRIMARY_COLOR)
    td_up = ParagraphStyle("TdUp", fontName=FONT_BOLD, fontSize=7.5, leading=9, alignment=TA_RIGHT, textColor=GREEN)
    td_down = ParagraphStyle("TdDown", fontName=FONT_BOLD, fontSize=7.5, leading=9, alignment=TA_RIGHT, textColor=RED)
    td_num = ParagraphStyle("TdNum", fontName=FONT_REGULAR, fontSize=7.5, leading=9, alignment=TA_RIGHT, textColor=GRAY_MEDIUM)
    td_tiers = ParagraphStyle("TdTiers", fontName=FONT_REGULAR, fontSize=7, leading=8.5, textColor=HexColor("#1E293B"))

    table_data = [[
        Paragraph("#", th_style),
        Paragraph("SKU", th_style),
        Paragraph("Cód. Barras", th_style),
        Paragraph("Producto & Clasificación", th_style_l),
        Paragraph("Precio Anterior", th_style_r),
        Paragraph("Precio Nuevo", th_style_r),
        Paragraph("Diferencia", th_style_r),
        Paragraph("Escalas Mayoristas Nuevas (Cantidad : Precio)", th_style_l),
    ]]

    for i, it in enumerate(sorted_items, 1):
        diff = float(it.get("diferencia_monto", 0))
        diff_pct = float(it.get("diferencia_pct", 0))
        diff_str = f"{'+' if diff > 0 else ''}{_fmt_gs(diff)} ({'+' if diff_pct > 0 else ''}{diff_pct:.1f}%)"
        diff_style = td_up if diff > 0 else (td_down if diff < 0 else td_num)

        prod_cell = [
            Paragraph(str(it.get("nombre") or ""), td_prod_name),
            Paragraph(f"{it.get('categoria', '')} · Proveedor: {it.get('proveedor', '')}", td_prod_sub)
        ]

        table_data.append([
            Paragraph(str(i), td_idx),
            Paragraph(str(it.get("sku", "")), td_sku),
            Paragraph(str(it.get("codigo_barra") or "-"), td_bar),
            prod_cell,
            Paragraph(_fmt_gs(it.get("precio_anterior", 0)), td_num_ant),
            Paragraph(_fmt_gs(it.get("precio_nuevo", 0)), td_num_new),
            Paragraph(diff_str, diff_style),
            Paragraph(str(it.get("escalas") or "-"), td_tiers),
        ])

    main_table = Table(table_data, colWidths=col_widths, repeatRows=1)
    main_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), PRIMARY_COLOR),
        ("ALIGN", (0, 0), (-1, 0), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("GRID", (0, 0), (-1, -1), 0.3, HexColor("#CBD5E1")),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [WHITE, GRAY_LIGHT]),
        ("TOPPADDING", (0, 0), (-1, -1), 2),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
        ("LEFTPADDING", (0, 0), (-1, -1), 2),
        ("RIGHTPADDING", (0, 0), (-1, -1), 2),
    ]))

    elements.append(main_table)
    _build(doc, elements)
    return buffer.getvalue()
