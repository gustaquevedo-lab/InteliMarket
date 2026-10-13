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
        25 * mm,  # Fecha/Hora
        22 * mm,  # SKU / Barras
        74 * mm,  # Producto
        26 * mm,  # Tipo / Escala
        27 * mm,  # Precio Anterior
        27 * mm,  # Precio Nuevo
        24 * mm,  # Dif. Gs.
        18 * mm,  # Dif. %
        30 * mm,  # Usuario / Origen
    ]

    header_style = ParagraphStyle("TH", fontName=FONT_BOLD, fontSize=7, textColor=WHITE, alignment=TA_CENTER)
    cell_text = ParagraphStyle("TD", fontName=FONT_REGULAR, fontSize=6.5, leading=8.5)
    cell_bold = ParagraphStyle("TDBold", fontName=FONT_BOLD, fontSize=6.5, leading=8.5)
    cell_num = ParagraphStyle("TDNum", fontName=FONT_REGULAR, fontSize=6.5, leading=8.5, alignment=TA_RIGHT)
    cell_up = ParagraphStyle("TDUp", fontName=FONT_BOLD, fontSize=6.5, leading=8.5, textColor=RED, alignment=TA_RIGHT)
    cell_down = ParagraphStyle("TDDown", fontName=FONT_BOLD, fontSize=6.5, leading=8.5, textColor=GREEN, alignment=TA_RIGHT)

    table_rows = [[
        Paragraph("Fecha / Hora", header_style),
        Paragraph("SKU / Código", header_style),
        Paragraph("Producto", header_style),
        Paragraph("Tipo / Escala", header_style),
        Paragraph("Precio Ant. (Gs.)", header_style),
        Paragraph("Precio Nuevo (Gs.)", header_style),
        Paragraph("Dif. (Gs.)", header_style),
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

        sku_or_code = it.get("product_sku") or it.get("product_barcode") or "-"
        prod_name = it.get("product_nombre") or "Producto sin nombre"

        tipo_val = it.get("tipo", "unitario")
        if tipo_val == "escala":
            mq = it.get("escala_min_qty") or 2
            tipo_label = f"Escala (≥{mq} un.)"
        else:
            tipo_label = "Unitario Regular"

        p_ant = _fmt_gs(it.get("precio_anterior", 0))
        p_new = _fmt_gs(it.get("precio_nuevo", 0))

        diff_monto = float(it.get("diferencia_monto", 0))
        diff_pct = float(it.get("diferencia_pct", 0))
        diff_gs_str = f"{'+' if diff_monto > 0 else ''}{_fmt_gs(diff_monto)}"
        diff_pct_str = f"{'+' if diff_pct > 0 else ''}{diff_pct:.1f}%"

        pct_style = cell_up if diff_monto > 0 else (cell_down if diff_monto < 0 else cell_num)

        resp = it.get("usuario_nombre") or it.get("origen") or "Sistema"

        table_rows.append([
            Paragraph(dt_str, cell_text),
            Paragraph(sku_or_code, cell_text),
            Paragraph(prod_name[:45], cell_bold),
            Paragraph(tipo_label, cell_text),
            Paragraph(p_ant, cell_num),
            Paragraph(p_new, cell_num),
            Paragraph(diff_gs_str, pct_style),
            Paragraph(diff_pct_str, pct_style),
            Paragraph(resp[:20], cell_text),
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

    # Cabeceras
    writer.writerow([
        "Fecha y Hora (Paraguay)",
        "SKU",
        "Código de Barras",
        "Producto",
        "Categoría",
        "Tipo de Precio",
        "Cant. Mínima Escala",
        "Precio Anterior (Gs.)",
        "Precio Nuevo (Gs.)",
        "Diferencia (Gs.)",
        "Diferencia (%)",
        "Origen",
        "Responsable",
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

        tipo_val = "Escala Mayorista" if it.get("tipo") == "escala" else "Unitario Regular"
        min_qty = it.get("escala_min_qty") if it.get("tipo") == "escala" else ""

        p_ant = int(round(float(it.get("precio_anterior", 0))))
        p_new = int(round(float(it.get("precio_nuevo", 0))))
        d_monto = int(round(float(it.get("diferencia_monto", 0))))
        d_pct = round(float(it.get("diferencia_pct", 0)), 2)

        writer.writerow([
            dt_str,
            it.get("product_sku") or "",
            it.get("product_barcode") or "",
            it.get("product_nombre") or "",
            it.get("categoria_nombre") or "",
            tipo_val,
            min_qty,
            p_ant,
            p_new,
            d_monto,
            f"{d_pct}%",
            it.get("origen") or "",
            it.get("usuario_nombre") or "",
            it.get("motivo") or "",
        ])

    return output.getvalue()
