"""PDFs de Compras — Gasto por proveedor (con KPIs) y Varianza de precios.
Reutiliza el mismo encabezado/pie de pagina de integrated_finance/pdf_reports.py,
igual que ya hacen accounts_receivable, Bancos y Cuentas por Pagar."""

import io
from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from reportlab.lib.units import mm
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_RIGHT, TA_CENTER, TA_LEFT
from reportlab.platypus import Paragraph, Spacer, Table, TableStyle
from reportlab.lib.colors import HexColor

from api.src.integrated_finance.pdf_reports import (
    _base_doc, _base_landscape_doc, _company_header, _company_landscape_header, _build, _fmt_gs,
    PRIMARY_COLOR, ACCENT_BLUE, GRAY_LIGHT, GRAY_MEDIUM, GRAY_DARK, WHITE, RED, GREEN,
    FONT_REGULAR, FONT_BOLD, PY_TZ
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
        "direccion": company.get("direccion") or "Alejo Garcia esquina Carlos Antonio López, Pedro Juan Caballero, Amambay",
        "telefono": company.get("telefono") or "+595992052200",
        "logo_url": company.get("logo_url"),
    }

    po_num = order.get("numero") or "S/N"
    elements = _company_header(
        company_data, styles,
        f"ORDEN DE COMPRA N° {po_num}",
        f"ORDEN DE COMPRA N° {po_num} — Documento Comercial Oficial de Adquisición",
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
        Paragraph(f"<b>N° de Orden:</b> {po_num}", styles["SmallBold"]),
        Paragraph(f"<b>Fecha de Emisión:</b> {fecha_emision_str}", styles["Small"]),
        Paragraph(f"<b>Fecha Entrega Requerida:</b> {fecha_entrega_str}", styles["Small"]),
        Paragraph(f"<b>Condición de Pago:</b> {order.get('condiciones_pago') or '30 Días'}", styles["Small"]),
        Paragraph(f"<b>Moneda:</b> {order.get('moneda') or 'PYG'}", styles["Small"]),
        Paragraph(f"<b>Comprador:</b> {order.get('created_by_name') or generated_by or 'Departamento de Compras'}", styles["Small"]),
    ]
    recs_list = order.get("recepciones") or []
    if recs_list:
        rec_texts = [f"{r.get('numero')} (Comp: <b>{r.get('comprobante')}</b>)" for r in recs_list]
        col_der.append(Paragraph(f"<b>Recepción / AUTO-REC:</b> {', '.join(rec_texts)}", styles["SmallBold"]))

    info_table = Table([[col_izq, col_der]], colWidths=[93 * mm, 93 * mm])
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

        um = str(it.get("unidad_medida") or (it.get("producto") or {}).get("unidad_medida") or "").strip().upper()
        if cant % 1 == 0:
            cant_str = f"{int(cant):,}".replace(",", ".")
        else:
            cant_str = f"{cant:.3f}".rstrip("0").rstrip(".").replace(".", ",")
        if um and um != "UN":
            cant_str = f"{cant_str} {um}"

        data.append([
            _cell(str(idx)),
            _cell(sku_code),
            _cell(barcode),
            _cell(prod_desc, bold=True),
            _num(cant_str),
            _num(_fmt_gs(precio)),
            _cell(f"{tasa}%"),
            _num(_fmt_gs(sub), bold=True),
        ])

    items_table = Table(data, colWidths=[9 * mm, 21 * mm, 26 * mm, 51 * mm, 16 * mm, 26 * mm, 11 * mm, 26 * mm], repeatRows=1)
    items_table.setStyle(_table_style(3))
    elements.append(items_table)
    elements.append(Spacer(1, 8))

    # Cuadro de liquidación impositiva y total general (IVA Incluido)
    total_final = Decimal(str(order.get("total") or total_gral))
    gravada_10 = subtotal_10 - iva_10
    gravada_5 = subtotal_5 - iva_5

    summary_data = [
        [
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
    ]
    summary_table = Table(summary_data, colWidths=[110 * mm, 76 * mm])
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
    signatures_table = Table(signatures_data, colWidths=[62 * mm, 62 * mm, 62 * mm])
    signatures_table.setStyle(TableStyle([
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]))
    elements.append(signatures_table)

    _build(doc, elements)
    return buffer.getvalue()


# ── Comprobante Oficial: Acta de Recepción, Cotejo 3-Way & Cierre de Compras ──

def generate_purchase_3way_receipt_pdf(company: dict, data: dict, generated_by: str = "") -> bytes:
    """Genera el Comprobante Oficial de Auditoría Interna:
    'Acta de Recepción y Cierre de Compras — Cotejo 3-Way Match & Fijación Comercial'.
    Formato horizontal A4 (Landscape, 273mm de ancho útil).
    Incluye datos de OC, Muelle, Factura, semáforo 3-way, y la tabla completa de fijación
    comercial con Costo Promedio (PPP), PVP Salón, PVP Mayorista y sus márgenes respectivos.
    """
    buffer = io.BytesIO()
    order = data.get("order") or {}
    receipt = data.get("receipt") or {}
    invoice = data.get("invoice") or {}
    supplier = data.get("supplier") or order.get("supplier") or {}
    matching = data.get("matching") or {}
    items = data.get("items") or []

    po_num = order.get("numero") or "S/N"
    rec_num = receipt.get("numero") or "S/N"
    title = f"Acta de Recepción y Cierre de Compras - {po_num}"

    doc, styles = _base_landscape_doc(buffer, title, company, generated_by)

    # Estilos auxiliares para la grilla
    c_text = styles["CellText"]
    c_text_bold = styles["CellTextBold"]
    c_num = styles["CellNum"]
    c_num_bold = styles["CellNumBold"]
    c_head = styles["CellHead"]
    c_head_right = styles["CellHeadRight"]
    c_head_center = styles["CellHeadCenter"]

    # Razón Social oficial de la empresa
    company_data = {
        "razon_social": company.get("razon_social") or "GRUPO SANTA TERESA E.A.S.",
        "nombre_fantasia": "EXTRA SUPERMERCADO MAYORISTA",
        "ruc": company.get("ruc") or "80150377-9",
        "timbrado": "18545636",
        "direccion": company.get("direccion") or "Alejo Garcia esq. Carlos Antonio López, Pedro Juan Caballero, Amambay",
        "telefono": company.get("telefono") or "+595992052200",
        "logo_url": company.get("logo_url"),
    }

    elements = _company_landscape_header(
        company_data, styles,
        "ACTA DE RECEPCIÓN Y CIERRE DE COMPRAS",
        f"COTEJO 3-WAY MATCH & FIJACIÓN COMERCIAL — OC: {po_num} · REC: {rec_num}",
        generated_by,
    )

    # Formateo de fechas a zona horaria paraguaya
    def _format_datetime(val) -> str:
        if not val:
            return "—"
        if isinstance(val, (datetime, date)):
            if isinstance(val, datetime) and hasattr(val, "astimezone"):
                val = val.astimezone(PY_TZ)
            return val.strftime("%d/%m/%Y %H:%M") if isinstance(val, datetime) else val.strftime("%d/%m/%Y")
        val_str = str(val).strip()
        if "T" in val_str:
            try:
                dt = datetime.fromisoformat(val_str.replace("Z", "+00:00"))
                dt = dt.astimezone(PY_TZ)
                return dt.strftime("%d/%m/%Y %H:%M")
            except Exception:
                return val_str[:16].replace("T", " ")
        return val_str[:10]

    po_fecha_str = _format_datetime(order.get("fecha") or order.get("created_at"))
    rec_fecha_str = _format_datetime(receipt.get("fecha") or receipt.get("created_at"))
    inv_fecha_str = _format_datetime(invoice.get("fecha_emision"))

    po_comprador = order.get("created_by_name") or "Juan Gabriel Ruiz"
    rec_usuario = receipt.get("user_name") or receipt.get("receptor_nombre") or "Juan Gabriel Ruiz (Muelle)"
    rec_ref = receipt.get("proveedor_ref") or "—"
    rec_deposito = receipt.get("warehouse_nombre") or "Depósito Central / Muelle"

    inv_num = invoice.get("numero_factura") or receipt.get("proveedor_ref") or "Pendiente de Asignación"
    inv_timbrado = invoice.get("timbrado") or "—"
    inv_condicion = (invoice.get("condicion") or order.get("condiciones_pago") or "Crédito 30 Días").capitalize()
    prov_razon = supplier.get("razon_social") or order.get("supplier_name") or "—"
    prov_ruc = supplier.get("ruc") or "—"

    # 1. FICHA TRIPARTITA: ORDEN DE COMPRA / RECEPCIÓN MUELLE / FACTURA PROVEEDOR (273 mm total)
    col_oc = [
        Paragraph("<b>1. ORDEN DE COMPRA PACTADA (OC)</b>", c_head),
        Paragraph(f"<b>N° de Orden:</b> {po_num}", c_text),
        Paragraph(f"<b>Fecha Emisión:</b> {po_fecha_str}", c_text),
        Paragraph(f"<b>Comprador:</b> {po_comprador}", c_text),
        Paragraph(f"<b>Condición:</b> {order.get('condiciones_pago') or '30 Días'}", c_text),
        Paragraph(f"<b>Moneda:</b> {order.get('moneda') or 'PYG'}", c_text),
    ]

    col_rec = [
        Paragraph("<b>2. RECEPCIÓN FÍSICA EN MUELLE</b>", c_head),
        Paragraph(f"<b>N° Recepción:</b> {rec_num}", c_text),
        Paragraph(f"<b>Ref. Comprobante:</b> {rec_ref}", c_text),
        Paragraph(f"<b>Fecha Descarga:</b> {rec_fecha_str}", c_text),
        Paragraph(f"<b>Depósito Receptor:</b> {rec_deposito}", c_text),
        Paragraph(f"<b>Receptor Físico:</b> {rec_usuario}", c_text),
    ]

    inv_total_impreso = invoice.get("total_factura_impreso") or invoice.get("total") or receipt.get("total") or 0
    col_inv = [
        Paragraph("<b>3. FACTURA FISCAL & PROVEEDOR</b>", c_head),
        Paragraph(f"<b>Proveedor:</b> {prov_razon}", c_text),
        Paragraph(f"<b>RUC:</b> {prov_ruc}", c_text),
        Paragraph(f"<b>N° Factura:</b> {inv_num}", c_text),
        Paragraph(f"<b>Timbrado:</b> {inv_timbrado} · {inv_fecha_str}", c_text),
        Paragraph(f"<b>Monto Impreso:</b> {_fmt_gs(inv_total_impreso)}", c_text_bold),
    ]

    info_table = Table([[col_oc, col_rec, col_inv]], colWidths=[91 * mm, 91 * mm, 91 * mm])
    info_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), GRAY_LIGHT),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LINEBEFORE", (1, 0), (1, -1), 0.5, WHITE),
        ("LINEBEFORE", (2, 0), (2, -1), 0.5, WHITE),
    ]))
    elements.append(info_table)
    elements.append(Spacer(1, 4))

    # 2. SEMÁFORO 3-WAY MATCH & AJUSTE DE REDONDEO (273 mm)
    tot_oc_val = Decimal(str(order.get("total") or 0))
    tot_rec_val = Decimal(str(receipt.get("total") or matching.get("total_recibido") or 0))
    tot_inv_val = Decimal(str(invoice.get("total") or matching.get("total_factura") or tot_rec_val))
    diff_redondeo = Decimal(str(matching.get("diferencia_redondeo") or (tot_inv_val - tot_rec_val) if abs(tot_inv_val - tot_rec_val) <= Decimal("5000") else 0))

    is_bloqueada = bool(matching.get("bloqueada_para_pago") or invoice.get("bloqueada_para_pago"))
    snc_num = matching.get("snc_numero") or (matching.get("nc_request_generada", {}).get("numero_solicitud") if isinstance(matching.get("nc_request_generada"), dict) else None)

    if not is_bloqueada:
        match_badge_text = "<b>MATCH CONFORME 100%</b><br/><font size=6 color='#059669'>Habilitada a Pago en Tesorería</font>"
        match_bg = HexColor("#ECFDF5")
        match_line = HexColor("#10B981")
    else:
        snc_label = f" (SNC {snc_num})" if snc_num else ""
        match_badge_text = f"<b>DISCREPANCIA DETECTADA</b><br/><font size=6 color='#DC2626'>Bloqueada para Pago{snc_label}</font>"
        match_bg = HexColor("#FEF2F2")
        match_line = HexColor("#EF4444")

    kpi_p = lambda label, val, color=None: [
        Paragraph(label, ParagraphStyle("KpiH", fontName=FONT_BOLD, fontSize=6, leading=7.5, textColor=GRAY_MEDIUM)),
        Paragraph(f"<b>{val}</b>", ParagraphStyle("KpiV", fontName=FONT_BOLD, fontSize=9, leading=11, textColor=color or PRIMARY_COLOR)),
    ]

    redondeo_label = "0"
    if diff_redondeo != 0:
        redondeo_label = f"{diff_redondeo:+,}".replace(",", ".")

    kpi_cells = [
        kpi_p("TOTAL PACTADO OC", _fmt_gs(tot_oc_val)),
        kpi_p("TOTAL RECIBIDO MUELLE", _fmt_gs(tot_rec_val)),
        kpi_p("TOTAL FACTURA PROVEEDOR", _fmt_gs(tot_inv_val)),
        kpi_p("AJUSTE POR REDONDEO", redondeo_label, color=HexColor("#4338CA") if diff_redondeo != 0 else None),
        [Paragraph(match_badge_text, ParagraphStyle("MatchStatus", fontName=FONT_BOLD, fontSize=7, leading=9, alignment=TA_CENTER))],
    ]

    kpi_table = Table([kpi_cells], colWidths=[54 * mm, 54 * mm, 54 * mm, 51 * mm, 60 * mm])
    kpi_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (3, -1), GRAY_LIGHT),
        ("BACKGROUND", (4, 0), (4, -1), match_bg),
        ("BOX", (4, 0), (4, -1), 0.75, match_line),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ("LINEAFTER", (0, 0), (2, -1), 0.5, WHITE),
    ]))
    elements.append(kpi_table)
    elements.append(Spacer(1, 5))

    # 3. TABLA MAESTRA DE RENGLONES Y FIJACIÓN COMERCIAL (273 mm)
    # Anchos exactos para 11 columnas sumando 273 mm:
    # 8 + 15 + 26 + 60 + 17 + 25 + 25 + 24 + 24 + 25 + 24 = 273 mm
    col_widths = [8 * mm, 15 * mm, 26 * mm, 60 * mm, 17 * mm, 25 * mm, 25 * mm, 24 * mm, 24 * mm, 25 * mm, 24 * mm]

    head_row = [
        Paragraph("#", c_head_center),
        Paragraph("Cód.", c_head),
        Paragraph("Cód. Barra", c_head),
        Paragraph("Descripción del Producto", c_head),
        Paragraph("Cant. Rec.", c_head_right),
        Paragraph("Costo Fact.", c_head_right),
        Paragraph("Costo PPP", c_head_right),
        Paragraph("PVP Salón", c_head_right),
        Paragraph("Margen %", c_head_right),
        Paragraph("PVP Mayor.", c_head_right),
        Paragraph("Marg. May.%", c_head_right),
    ]

    data_rows = [head_row]

    total_unidades = Decimal("0")
    total_costo_factura = Decimal("0")
    subtotal_10 = Decimal("0")
    subtotal_5 = Decimal("0")
    subtotal_exenta = Decimal("0")
    iva_10 = Decimal("0")
    iva_5 = Decimal("0")

    for idx, it in enumerate(items, 1):
        cant = Decimal(str(it.get("cantidad_recibida") or it.get("cantidad") or 0))
        costo_fact = Decimal(str(it.get("costo_factura") or it.get("costo_unitario") or it.get("precio_unitario") or 0))
        costo_ppp = Decimal(str(it.get("costo_promedio") or costo_fact))
        if costo_ppp <= Decimal("0"):
            costo_ppp = costo_fact

        pvp_salon = Decimal(str(it.get("precio_venta") or 0))
        pvp_mayorista = Decimal(str(it.get("precio_mayorista") or 0))

        sub = cant * costo_fact
        total_unidades += cant
        total_costo_factura += sub

        tasa = int(it.get("iva_tasa") or 10)
        if tasa == 10:
            subtotal_10 += sub
            iva_10 += (sub / Decimal("11")).quantize(Decimal("1"), rounding="ROUND_HALF_UP")
        elif tasa == 5:
            subtotal_5 += sub
            iva_5 += (sub / Decimal("21")).quantize(Decimal("1"), rounding="ROUND_HALF_UP")
        else:
            subtotal_exenta += sub

        # Cálculo de márgenes sobre Costo Promedio Ponderado (PPP)
        # Margen = ((PVP - PPP) / PVP) * 100
        if pvp_salon > Decimal("0") and costo_ppp > Decimal("0"):
            margen_salon = ((pvp_salon - costo_ppp) / pvp_salon) * Decimal("100")
            margen_salon_str = f"{margen_salon:.1f}%"
            # Alerta: Si margen < 15% destacar en rojo
            if margen_salon < Decimal("15.0"):
                margen_salon_cell = Paragraph(f"<font color='#DC2626'><b>{margen_salon_str}</b></font>", c_num_bold)
            elif margen_salon >= Decimal("25.0"):
                margen_salon_cell = Paragraph(f"<font color='#059669'><b>{margen_salon_str}</b></font>", c_num_bold)
            else:
                margen_salon_cell = Paragraph(f"<b>{margen_salon_str}</b>", c_num)
        else:
            margen_salon_cell = Paragraph("—", c_num)

        if pvp_mayorista > Decimal("0") and costo_ppp > Decimal("0"):
            margen_may = ((pvp_mayorista - costo_ppp) / pvp_mayorista) * Decimal("100")
            margen_may_str = f"{margen_may:.1f}%"
            if margen_may < Decimal("10.0"):
                margen_may_cell = Paragraph(f"<font color='#DC2626'><b>{margen_may_str}</b></font>", c_num_bold)
            elif margen_may >= Decimal("18.0"):
                margen_may_cell = Paragraph(f"<font color='#059669'><b>{margen_may_str}</b></font>", c_num_bold)
            else:
                margen_may_cell = Paragraph(f"<b>{margen_may_str}</b>", c_num)
        else:
            margen_may_cell = Paragraph("—", c_num)

        prod_desc = it.get("descripcion") or it.get("nombre") or "Ítem"
        sku_code = str(it.get("sku") or it.get("codigo_interno") or "—")
        barcode = str(it.get("codigo_barra") or "—")
        um = str(it.get("unidad_medida") or "").strip().upper()

        if cant % 1 == 0:
            cant_str = f"{int(cant):,}".replace(",", ".")
        else:
            cant_str = f"{cant:.2f}".rstrip("0").rstrip(".").replace(".", ",")
        if um and um != "UN":
            cant_str = f"{cant_str} {um}"

        pvp_salon_str = _fmt_gs(pvp_salon) if pvp_salon > 0 else "—"
        pvp_may_str = _fmt_gs(pvp_mayorista) if pvp_mayorista > 0 else "—"

        data_rows.append([
            Paragraph(str(idx), c_text),
            Paragraph(sku_code, c_text),
            Paragraph(barcode, c_text),
            Paragraph(prod_desc, c_text_bold),
            Paragraph(cant_str, c_num_bold),
            Paragraph(_fmt_gs(costo_fact), c_num),
            Paragraph(_fmt_gs(costo_ppp), c_num_bold),
            Paragraph(pvp_salon_str, c_num),
            margen_salon_cell,
            Paragraph(pvp_may_str, c_num),
            margen_may_cell,
        ])

    # Fila de Totales
    if total_unidades % 1 == 0:
        tot_cant_str = f"{int(total_unidades):,}".replace(",", ".")
    else:
        tot_cant_str = f"{total_unidades:.2f}".replace(".", ",")

    data_rows.append([
        Paragraph("TOTAL", c_head),
        Paragraph("", c_head),
        Paragraph("", c_head),
        Paragraph(f"{len(items)} Renglones Recibidos", c_head),
        Paragraph(f"{tot_cant_str} un.", c_head_right),
        Paragraph(_fmt_gs(total_costo_factura), c_head_right),
        Paragraph("", c_head),
        Paragraph("", c_head),
        Paragraph("", c_head),
        Paragraph("", c_head),
        Paragraph("", c_head),
    ])

    items_table = Table(data_rows, colWidths=col_widths, repeatRows=1)
    items_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), PRIMARY_COLOR),
        ("TEXTCOLOR", (0, 0), (-1, 0), WHITE),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("ROWBACKGROUNDS", (0, 1), (-1, -2), [WHITE, GRAY_LIGHT]),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
        ("BACKGROUND", (0, -1), (-1, -1), GRAY_LIGHT),
        ("LINEABOVE", (0, -1), (-1, -1), 0.75, GRAY_DARK),
        ("LINEBELOW", (0, 0), (-1, 0), 0.5, PRIMARY_COLOR),
    ]))
    elements.append(items_table)
    elements.append(Spacer(1, 4))

    # 4. CUADRO DE LIQUIDACIÓN IMPOSITIVA Y TOTAL (273 mm)
    gravada_10 = subtotal_10 - iva_10
    gravada_5 = subtotal_5 - iva_5

    summary_cells = [
        [
            Paragraph("<b>LIQUIDACIÓN IMPOSITIVA DEL LOTE RECIBIDO:</b>", c_head),
            Paragraph(f"Gravadas 10%: {_fmt_gs(gravada_10)} | IVA 10%: {_fmt_gs(iva_10)}", c_text),
            Paragraph(f"Gravadas 5%: {_fmt_gs(gravada_5)} | IVA 5%: {_fmt_gs(iva_5)} | Exentas: {_fmt_gs(subtotal_exenta)}", c_text),
        ],
        [
            Paragraph("<b>TOTAL LOTE FACTURADO (IVA INCLUIDO):</b>", c_head),
            Paragraph(f"<font size=10 color='#1E40AF'><b>{_fmt_gs(tot_inv_val)}</b></font>", styles["Normal"]),
            Paragraph("Moneda: <b>Guaraníes (PYG)</b> · Condición: <b>" + str(inv_condicion) + "</b>", c_text),
        ]
    ]
    summary_table = Table([summary_cells], colWidths=[150 * mm, 123 * mm])
    summary_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), GRAY_LIGHT),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("LINEBEFORE", (1, 0), (1, -1), 0.5, WHITE),
    ]))
    elements.append(summary_table)

    obs = receipt.get("observaciones") or order.get("observaciones")
    if obs:
        elements.append(Spacer(1, 3))
        elements.append(Paragraph(f"<b>Observaciones Operativas:</b> {obs}", c_text))

    # 5. BLOQUE DE FIRMAS TRIPARTITAS (273 mm = 91mm x 3)
    elements.append(Spacer(1, 10))
    signatures_data = [
        [
            Paragraph("_________________________________________<br/><b>Recepción Física en Muelle</b><br/>Firma y Aclaración: " + str(rec_usuario) + "<br/><font size=6 color='#64748B'>Descarga, Conteo Físico & Control Lotes</font>", styles["Small"]),
            Paragraph("_________________________________________<br/><b>Auditoría 3-Way Match</b><br/>Firma y Sello: Auditoría Interna / Sistema<br/><font size=6 color='#64748B'>Conciliación OC vs Muelle vs Factura</font>", styles["Small"]),
            Paragraph("_________________________________________<br/><b>Cierre de Compras & Precios</b><br/>Firma y Sello: Gerencia Comercial<br/><font size=6 color='#64748B'>Aprobación de Costos & Márgenes en Góndola</font>", styles["Small"]),
        ]
    ]
    signatures_table = Table(signatures_data, colWidths=[91 * mm, 91 * mm, 91 * mm])
    signatures_table.setStyle(TableStyle([
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]))
    elements.append(signatures_table)

    _build(doc, elements)
    return buffer.getvalue()


