"""PDFs de Compras — Gasto por proveedor (con KPIs) y Varianza de precios.
Reutiliza el mismo encabezado/pie de pagina de integrated_finance/pdf_reports.py,
igual que ya hacen accounts_receivable, Bancos y Cuentas por Pagar."""

import io
from datetime import date
from decimal import Decimal
from typing import Optional

from reportlab.lib.units import mm
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_RIGHT
from reportlab.platypus import Paragraph, Spacer, Table, TableStyle

from api.src.integrated_finance.pdf_reports import (
    _base_doc, _company_header, _build, _fmt_gs,
    PRIMARY_COLOR, GRAY_LIGHT, GRAY_MEDIUM, GRAY_DARK, WHITE, RED,
    FONT_REGULAR, FONT_BOLD,
)

CELL_STYLE = ParagraphStyle("PurCell", fontName=FONT_REGULAR, fontSize=7.5, leading=9, textColor=GRAY_DARK)
CELL_STYLE_BOLD = ParagraphStyle("PurCellBold", fontName=FONT_BOLD, fontSize=7.5, leading=9, textColor=GRAY_DARK)
NUM_STYLE = ParagraphStyle("PurNum", fontName=FONT_REGULAR, fontSize=7.5, leading=9, textColor=GRAY_DARK, alignment=TA_RIGHT)
NUM_STYLE_BOLD = ParagraphStyle("PurNumBold", fontName=FONT_BOLD, fontSize=7.5, leading=9, textColor=GRAY_DARK, alignment=TA_RIGHT)
KPI_VALUE = ParagraphStyle("PurKpiValue", fontName=FONT_BOLD, fontSize=16, textColor=PRIMARY_COLOR, leading=19)
KPI_LABEL = ParagraphStyle("PurKpiLabel", fontName=FONT_REGULAR, fontSize=8, textColor=GRAY_MEDIUM, leading=10)


def _cell(text, bold: bool = False) -> Paragraph:
    return Paragraph(str(text) if text is not None else "—", CELL_STYLE_BOLD if bold else CELL_STYLE)


def _num(text, bold: bool = False, color=None) -> Paragraph:
    style = NUM_STYLE_BOLD if bold else NUM_STYLE
    if color:
        style = ParagraphStyle("PurNumColor", parent=style, textColor=color)
    return Paragraph(str(text) if text is not None else "—", style)


def _kpi_row(items: list[tuple[str, str]], col_width_mm: float) -> Table:
    cells = [[Paragraph(label, KPI_LABEL), Paragraph(value, KPI_VALUE)] for label, value in items]
    t = Table([cells], colWidths=[col_width_mm * mm] * len(items))
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), GRAY_LIGHT),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("LEFTPADDING", (0, 0), (0, 0), 10),
        ("LINEAFTER", (0, 0), (-2, 0), 0.5, WHITE),
    ]))
    return t


def _table_style(align_from: int = 1) -> TableStyle:
    return TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), PRIMARY_COLOR),
        ("TEXTCOLOR", (0, 0), (-1, 0), WHITE),
        ("FONTNAME", (0, 0), (-1, 0), FONT_BOLD),
        ("FONTSIZE", (0, 0), (-1, -1), 7.5),
        ("FONTNAME", (0, -1), (-1, -1), FONT_BOLD),
        ("LINEABOVE", (0, -1), (-1, -1), 0.75, GRAY_DARK),
        ("ALIGN", (align_from, 0), (-1, -1), "RIGHT"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("ROWBACKGROUNDS", (0, 1), (-1, -2), [WHITE, GRAY_LIGHT]),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("LINEBELOW", (0, 0), (-1, 0), 0.5, PRIMARY_COLOR),
    ])


# ── Gasto por Proveedor (con KPIs generales) ────────────────────────────────

def generate_spend_by_supplier_pdf(company: dict, kpis: dict, spend_rows: list[dict], generated_by: str = "") -> bytes:
    buffer = io.BytesIO()
    doc, styles = _base_doc(buffer, "Gasto por Proveedor - Compras", company, generated_by)
    elements = _company_header(company, styles, "Gasto por Proveedor", "Compras — Gasto por proveedor y KPIs generales", generated_by)

    kpi = _kpi_row([
        ("GASTO TOTAL", _fmt_gs(kpis.get("total_gastado", 0))),
        ("ORDENES DE COMPRA", str(kpis.get("total_pos", 0))),
        ("PROMEDIO POR ORDEN", _fmt_gs(kpis.get("prom_pedido", 0))),
        ("PROVEEDORES ACTIVOS", str(kpis.get("proveedores_activos", 0))),
    ], 45)
    elements.append(kpi)
    elements.append(Spacer(1, 4))
    elements.append(Paragraph(
        "KPIs calculados sobre ordenes de compra confirmadas, enviadas, parciales o completadas — no incluye borradores ni canceladas.",
        styles["Small"],
    ))
    elements.append(Spacer(1, 12))

    total_general = sum((r["total_gastado"] for r in spend_rows), Decimal("0"))
    header = ["Proveedor", "N° Ordenes", "Total Gastado", "% del total"]
    data = [header]
    for r in spend_rows:
        pct = (r["total_gastado"] / total_general * 100) if total_general > 0 else Decimal("0")
        data.append([
            _cell(r["razon_social"]),
            _num(r["cantidad_ordenes"]),
            _num(_fmt_gs(r["total_gastado"]), bold=True),
            _num(f"{pct:.1f}%"),
        ])
    data.append([
        _cell("TOTAL", bold=True), _cell(""),
        _num(_fmt_gs(total_general), bold=True), _num("100.0%", bold=True),
    ])

    t = Table(data, colWidths=[80 * mm, 28 * mm, 40 * mm, 28 * mm], repeatRows=1)
    t.setStyle(_table_style(1))
    elements.append(t)

    if not spend_rows:
        elements.append(Spacer(1, 10))
        elements.append(Paragraph("Sin ordenes de compra registradas.", styles["Small"]))

    _build(doc, elements)
    return buffer.getvalue()


# ── Varianza de Precios ──────────────────────────────────────────────────────

def generate_price_variance_pdf(company: dict, variance_rows: list[dict], generated_by: str = "") -> bytes:
    buffer = io.BytesIO()
    doc, styles = _base_doc(buffer, "Varianza de Precios - Compras", company, generated_by)
    elements = _company_header(company, styles, "Varianza de Precios", "Compras — Productos con mayor variacion de precio entre compras", generated_by)

    alto_riesgo = sum(1 for r in variance_rows if r["variance_pct"] >= 20)
    kpi = _kpi_row([
        ("PRODUCTOS ANALIZADOS", str(len(variance_rows))),
        ("VARIACION >= 20%", str(alto_riesgo)),
    ], 90)
    elements.append(kpi)
    elements.append(Spacer(1, 4))
    elements.append(Paragraph(
        "Solo incluye productos comprados mas de una vez. Una variacion alta puede indicar falta de negociacion "
        "consistente de precio con los proveedores, o un cambio real de mercado.",
        styles["Small"],
    ))
    elements.append(Spacer(1, 12))

    header = ["Producto", "Precio Prom.", "Precio Min.", "Precio Max.", "Var. %", "Ult. Proveedor"]
    data = [header]
    for r in variance_rows[:80]:
        var_pct = r["variance_pct"]
        data.append([
            _cell(r["nombre"]),
            _num(_fmt_gs(r["average_price"])),
            _num(_fmt_gs(r["min_price"])),
            _num(_fmt_gs(r["max_price"])),
            _num(f"{var_pct:.1f}%", bold=var_pct >= 20, color=RED if var_pct >= 20 else None),
            _cell(r.get("last_supplier") or "—"),
        ])

    t = Table(data, colWidths=[55 * mm, 26 * mm, 26 * mm, 26 * mm, 18 * mm, 39 * mm], repeatRows=1)
    t.setStyle(_table_style(1))
    elements.append(t)

    if not variance_rows:
        elements.append(Spacer(1, 10))
        elements.append(Paragraph("Sin datos suficientes (se necesita mas de una compra por producto).", styles["Small"]))
    elif len(variance_rows) > 80:
        elements.append(Spacer(1, 8))
        elements.append(Paragraph(f"Mostrando los primeros 80 de {len(variance_rows)} productos, ordenados por mayor variacion.", styles["Small"]))

    _build(doc, elements)
    return buffer.getvalue()


# ── Reporte Premium de Orden de Compra (OC) ──────────────────────────────────

def generate_purchase_order_pdf(company: dict, order: dict, items: list[dict], generated_by: str = "") -> bytes:
    buffer = io.BytesIO()
    doc, styles = _base_doc(buffer, f"Orden de Compra {order.get('numero', '')}", company, generated_by)
    if "SmallBold" not in styles:
        styles.add(ParagraphStyle("SmallBold", fontName=FONT_BOLD, fontSize=8, leading=11, textColor=GRAY_DARK))

    # Si no viene razón social definida en company, usar los datos oficiales de Extra Supermercado
    company_data = {
        "razon_social": company.get("razon_social") or "GRUPO SANTA TERESA E.A.S.",
        "nombre_fantasia": "EXTRA SUPERMERCADO MAYORISTA",
        "ruc": company.get("ruc") or "80150377-9",
        "timbrado": "18545636",
        "direccion": "Av. Santa Teresa c/ Av. Mcal. López - Fernando de la Mora",
        "telefono": "(021) 680-000",
        "logo_url": company.get("logo_url"),
    }

    elements = _company_header(
        company_data, styles,
        f"ORDEN DE COMPRA N° {order.get('numero', 'S/N')}",
        "Documento Comercial Oficial de Adquisición de Mercaderías",
        generated_by,
    )

    supplier = order.get("supplier") or {}
    fecha_emision = order.get("fecha") or order.get("created_at")
    if hasattr(fecha_emision, "strftime"):
        fecha_emision_str = fecha_emision.strftime("%d/%m/%Y")
    elif fecha_emision:
        fecha_emision_str = str(fecha_emision)[:10]
    else:
        fecha_emision_str = "—"

    fecha_entrega = order.get("fecha_entrega_estimada")
    if hasattr(fecha_entrega, "strftime"):
        fecha_entrega_str = fecha_entrega.strftime("%d/%m/%Y")
    elif fecha_entrega:
        fecha_entrega_str = str(fecha_entrega)[:10]
    else:
        fecha_entrega_str = "Inmediata / A convenir"

    # Ficha de Proveedor y Ficha de Orden en dos columnas
    col_izq = [
        Paragraph("<b>DATOS DEL PROVEEDOR</b>", styles["SmallBold"]),
        Paragraph(f"<b>Razón Social:</b> {supplier.get('razon_social') or order.get('supplier_name') or '—'}", styles["Small"]),
        Paragraph(f"<b>RUC:</b> {supplier.get('ruc') or '—'}", styles["Small"]),
        Paragraph(f"<b>Teléfono:</b> {supplier.get('telefono') or '—'}", styles["Small"]),
        Paragraph(f"<b>Contacto / Email:</b> {supplier.get('email') or supplier.get('contacto_nombre') or '—'}", styles["Small"]),
        Paragraph(f"<b>Dirección:</b> {supplier.get('direccion') or '—'}", styles["Small"]),
    ]

    col_der = [
        Paragraph("<b>DATOS DE LA ORDEN</b>", styles["SmallBold"]),
        Paragraph(f"<b>N° de Orden:</b> {order.get('numero', '—')}", styles["Small"]),
        Paragraph(f"<b>Fecha de Emisión:</b> {fecha_emision_str}", styles["Small"]),
        Paragraph(f"<b>Fecha Entrega Requerida:</b> {fecha_entrega_str}", styles["Small"]),
        Paragraph(f"<b>Condición de Pago:</b> {order.get('condiciones_pago') or '30 Días'}", styles["Small"]),
        Paragraph(f"<b>Moneda:</b> {order.get('moneda') or 'PYG'}", styles["Small"]),
        Paragraph(f"<b>Comprador:</b> {order.get('created_by_name') or generated_by or 'Departamento de Compras'}", styles["Small"]),
    ]

    info_table = Table([[col_izq, col_der]], colWidths=[90 * mm, 90 * mm])
    info_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), GRAY_LIGHT),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LINEBEFORE", (1, 0), (1, 0), 0.5, WHITE),
    ]))
    elements.append(info_table)
    elements.append(Spacer(1, 10))

    # Tabla itemizada con Código Interno y Código de Barra separados, Precios IVA Incluido
    header = ["#", "Cód. Interno", "Cód. Barra", "Descripción del Producto", "Cant.", "Precio Unit. (IVA Inc.)", "IVA", "Subtotal (IVA Inc.)"]
    data = [header]

    subtotal_10 = Decimal("0")
    subtotal_5 = Decimal("0")
    subtotal_exenta = Decimal("0")
    iva_10 = Decimal("0")
    iva_5 = Decimal("0")
    total_gral = Decimal("0")

    for idx, it in enumerate(items, 1):
        cant = Decimal(str(it.get("cantidad") or 0))
        precio = Decimal(str(it.get("precio_unitario") or 0))
        tasa = int(it.get("iva_tasa") or 10)
        sub = cant * precio
        total_gral += sub

        if tasa == 10:
            subtotal_10 += sub
            iva_10 += (sub / Decimal("11")).quantize(Decimal("1"), rounding="ROUND_HALF_UP")
        elif tasa == 5:
            subtotal_5 += sub
            iva_5 += (sub / Decimal("21")).quantize(Decimal("1"), rounding="ROUND_HALF_UP")
        else:
            subtotal_exenta += sub

        prod_desc = it.get("descripcion") or it.get("nombre") or (it.get("producto") or {}).get("nombre") or "Ítem"
        sku_code = it.get("sku") or (it.get("producto") or {}).get("sku") or "—"
        barcode = it.get("codigo_barra") or (it.get("producto") or {}).get("codigo_barra") or "—"

        data.append([
            _cell(str(idx)),
            _cell(sku_code),
            _cell(barcode),
            _cell(prod_desc, bold=True),
            _num(f"{cant:,.0f}".replace(",", ".")),
            _num(_fmt_gs(precio)),
            _cell(f"{tasa}%"),
            _num(_fmt_gs(sub), bold=True),
        ])

    items_table = Table(data, colWidths=[7 * mm, 23 * mm, 27 * mm, 52 * mm, 14 * mm, 27 * mm, 10 * mm, 27 * mm], repeatRows=1)
    items_table.setStyle(_table_style(3))
    elements.append(items_table)
    elements.append(Spacer(1, 8))

    # Cuadro de liquidación impositiva y total general (IVA Incluido)
    total_final = Decimal(str(order.get("total") or total_gral))
    gravada_10 = subtotal_10 - iva_10
    gravada_5 = subtotal_5 - iva_5

    summary_data = [
        [
            Paragraph("<b>LIQUIDACIÓN IVA (INCLUIDO EN TOTAL):</b>", styles["SmallBold"]),
            Paragraph(f"Gravadas 10%: {_fmt_gs(gravada_10)} | IVA 10%: {_fmt_gs(iva_10)}", styles["Small"]),
            Paragraph(f"Gravadas 5%: {_fmt_gs(gravada_5)} | IVA 5%: {_fmt_gs(iva_5)}", styles["Small"]),
            Paragraph(f"Exentas: {_fmt_gs(subtotal_exenta)}", styles["Small"]),
        ],
        [
            Paragraph("<b>TOTAL ORDEN (IVA INCLUIDO):</b>", styles["SmallBold"]),
            Paragraph(f"<font size=11 color='#1E40AF'><b>{_fmt_gs(total_final)}</b></font>", styles["Normal"]),
            Paragraph(f"Condición: <b>{order.get('condiciones_pago') or '30 Días'}</b>", styles["Small"]),
            Paragraph(f"Moneda: <b>{order.get('moneda') or 'PYG'}</b>", styles["Small"]),
        ]
    ]
    summary_table = Table(summary_data, colWidths=[110 * mm, 70 * mm])
    summary_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), GRAY_LIGHT),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("LINEBEFORE", (1, 0), (1, -1), 0.5, WHITE),
    ]))
    elements.append(summary_table)

    obs = order.get("observaciones")
    if obs:
        elements.append(Spacer(1, 6))
        elements.append(Paragraph(f"<b>Instrucciones / Observaciones:</b> {obs}", styles["Small"]))

    # Firmas y autorizaciones
    elements.append(Spacer(1, 20))
    signatures_data = [
        [
            Paragraph("____________________________<br/><b>Elaborado por</b><br/>Comprador", styles["Small"]),
            Paragraph("____________________________<br/><b>Autorizado por</b><br/>Gerencia de Compras", styles["Small"]),
            Paragraph("____________________________<br/><b>Recibido Conforme</b><br/>Firma y Sello Proveedor", styles["Small"]),
        ]
    ]
    signatures_table = Table(signatures_data, colWidths=[60 * mm, 60 * mm, 60 * mm])
    signatures_table.setStyle(TableStyle([
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]))
    elements.append(signatures_table)

    _build(doc, elements)
    return buffer.getvalue()

