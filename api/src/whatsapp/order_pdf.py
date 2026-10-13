"""
Generador de PDF Premium para pedidos y presupuestos armados por el
Agente de IA Conversacional de Extra Supermercado (WhatsApp / IntelliZapp).
"""

import io
from datetime import datetime
from zoneinfo import ZoneInfo
from typing import Optional, List, Dict, Any

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
)
from reportlab.lib.colors import HexColor


PRIMARY_COLOR = HexColor("#0F766E")    # Verde Azulado corporativo
SECONDARY_COLOR = HexColor("#0D9488")
DARK_COLOR = HexColor("#0F172A")
GRAY_LIGHT = HexColor("#F8FAFC")
GRAY_BORDER = HexColor("#E2E8F0")
GRAY_TEXT = HexColor("#64748B")
WHITE = HexColor("#FFFFFF")
ACCENT_COLOR = HexColor("#EA580C")


def _fmt_gs(val: float) -> str:
    return f"{int(round(val)):,}".replace(",", ".")


def _fmt_brl(val: float) -> str:
    return f"{val:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")


def generate_whatsapp_order_pdf(
    order_code: str,
    customer_name: str,
    customer_phone: str,
    items: List[Dict[str, Any]],
    total_pyg: float,
    exchange_rate_brl: float = 0.0,
    created_at: Optional[datetime] = None,
    notes: str = "",
) -> bytes:
    """
    Genera un PDF premium con el detalle de los productos pedidos por el cliente.
    """
    buffer = io.BytesIO()

    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=15 * mm,
        leftMargin=15 * mm,
        topMargin=15 * mm,
        bottomMargin=15 * mm,
    )

    styles = getSampleStyleSheet()

    title_style = ParagraphStyle(
        "OrderTitle",
        fontName="Helvetica-Bold",
        fontSize=15,
        textColor=PRIMARY_COLOR,
        alignment=TA_LEFT,
        spaceAfter=3,
    )

    subtitle_style = ParagraphStyle(
        "OrderSubtitle",
        fontName="Helvetica",
        fontSize=8,
        textColor=GRAY_TEXT,
        alignment=TA_LEFT,
        spaceAfter=6,
    )

    right_header_style = ParagraphStyle(
        "OrderHeaderRight",
        fontName="Helvetica-Bold",
        fontSize=11,
        textColor=DARK_COLOR,
        alignment=TA_RIGHT,
    )

    right_sub_style = ParagraphStyle(
        "OrderHeaderRightSub",
        fontName="Helvetica",
        fontSize=8,
        textColor=GRAY_TEXT,
        alignment=TA_RIGHT,
    )

    table_header_style = ParagraphStyle(
        "TableHeader",
        fontName="Helvetica-Bold",
        fontSize=8,
        textColor=WHITE,
        alignment=TA_CENTER,
    )

    cell_left = ParagraphStyle(
        "CellLeft",
        fontName="Helvetica",
        fontSize=8,
        textColor=DARK_COLOR,
        alignment=TA_LEFT,
    )

    cell_right = ParagraphStyle(
        "CellRight",
        fontName="Helvetica",
        fontSize=8,
        textColor=DARK_COLOR,
        alignment=TA_RIGHT,
    )

    cell_center = ParagraphStyle(
        "CellCenter",
        fontName="Helvetica",
        fontSize=8,
        textColor=DARK_COLOR,
        alignment=TA_CENTER,
    )

    tz_asuncion = ZoneInfo("America/Asuncion")
    fecha_emision = (created_at or datetime.now(tz_asuncion)).astimezone(tz_asuncion)
    fecha_str = fecha_emision.strftime("%d/%m/%Y %H:%M hs")

    elements = []

    # 1. ENCABEZADO
    header_data = [
        [
            Paragraph("<b>EXTRA SUPERMERCADO MAYORISTA</b>", title_style),
            Paragraph(f"<b>PEDIDO / COTIZACIÓN</b><br/><font color='#0F766E'>#{order_code}</font>", right_header_style),
        ],
        [
            Paragraph("GRUPO SANTA TERESA E.A.S. • RUC: 80150377-9<br/>Canal Oficial de WhatsApp • Atención al Cliente", subtitle_style),
            Paragraph(f"Fecha: {fecha_str}<br/>Moneda Base: Guaraníes (PYG)", right_sub_style),
        ]
    ]

    header_table = Table(header_data, colWidths=[110 * mm, 70 * mm])
    header_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 1),
        ("TOPPADDING", (0, 0), (-1, -1), 1),
    ]))
    elements.append(header_table)
    elements.append(Spacer(1, 4 * mm))
    elements.append(HRFlowable(width="100%", thickness=1, color=PRIMARY_COLOR, spaceAfter=8))

    # 2. DATOS DEL CLIENTE
    client_box = [
        [
            Paragraph("<b>Cliente:</b>", cell_left),
            Paragraph(customer_name or "Cliente General", cell_left),
            Paragraph("<b>Teléfono / WhatsApp:</b>", cell_left),
            Paragraph(customer_phone, cell_left),
        ]
    ]
    t_client = Table(client_box, colWidths=[20 * mm, 70 * mm, 38 * mm, 52 * mm])
    t_client.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), GRAY_LIGHT),
        ("BOX", (0, 0), (-1, -1), 0.5, GRAY_BORDER),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
    ]))
    elements.append(t_client)
    elements.append(Spacer(1, 5 * mm))

    # 3. TABLA DE ÍTEMS
    headers = [
        Paragraph("#", table_header_style),
        Paragraph("Descripción del Producto", table_header_style),
        Paragraph("Cant.", table_header_style),
        Paragraph("P. Unit (Gs)", table_header_style),
        Paragraph("Subtotal (Gs)", table_header_style),
    ]
    if exchange_rate_brl > 0:
        headers.append(Paragraph("Subtotal (R$)", table_header_style))

    table_data = [headers]

    for idx, it in enumerate(items, start=1):
        cant = float(it.get("quantity", 1))
        precio = float(it.get("unit_price", 0))
        subtotal = cant * precio

        row = [
            Paragraph(str(idx), cell_center),
            Paragraph(str(it.get("product_name", "Producto")), cell_left),
            Paragraph(f"{cant:g}", cell_center),
            Paragraph(_fmt_gs(precio), cell_right),
            Paragraph(_fmt_gs(subtotal), cell_right),
        ]
        if exchange_rate_brl > 0:
            brl_sub = subtotal / exchange_rate_brl if exchange_rate_brl > 0 else 0
            row.append(Paragraph(f"R$ {_fmt_brl(brl_sub)}", cell_right))

        table_data.append(row)

    if exchange_rate_brl > 0:
        col_widths = [10 * mm, 70 * mm, 18 * mm, 26 * mm, 28 * mm, 28 * mm]
    else:
        col_widths = [10 * mm, 90 * mm, 20 * mm, 30 * mm, 30 * mm]

    items_table = Table(table_data, colWidths=col_widths, repeatRows=1)
    items_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), PRIMARY_COLOR),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("GRID", (0, 0), (-1, -1), 0.5, GRAY_BORDER),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [WHITE, GRAY_LIGHT]),
    ]))
    elements.append(items_table)
    elements.append(Spacer(1, 4 * mm))

    # 4. RESUMEN DE TOTALES
    total_brl = (total_pyg / exchange_rate_brl) if exchange_rate_brl > 0 else 0.0

    totals_rows = [
        [
            Paragraph("<b>TOTAL EN GUARANÍES:</b>", ParagraphStyle("TLabel", fontName="Helvetica-Bold", fontSize=10, textColor=DARK_COLOR, alignment=TA_RIGHT)),
            Paragraph(f"<b>Gs. {_fmt_gs(total_pyg)}</b>", ParagraphStyle("TVal", fontName="Helvetica-Bold", fontSize=12, textColor=PRIMARY_COLOR, alignment=TA_RIGHT)),
        ]
    ]

    if exchange_rate_brl > 0:
        totals_rows.append([
            Paragraph(f"Equivalente en Reales (Cambio 1 R$ = Gs. {_fmt_gs(exchange_rate_brl)}):", ParagraphStyle("TSub", fontName="Helvetica", fontSize=8, textColor=GRAY_TEXT, alignment=TA_RIGHT)),
            Paragraph(f"<b>R$ {_fmt_brl(total_brl)}</b>", ParagraphStyle("TValBRL", fontName="Helvetica-Bold", fontSize=10, textColor=ACCENT_COLOR, alignment=TA_RIGHT)),
        ])

    totals_table = Table(totals_rows, colWidths=[120 * mm, 60 * mm])
    totals_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 2),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
    ]))
    elements.append(totals_table)

    # 5. NOTAS Y CONDICIONES
    elements.append(Spacer(1, 6 * mm))
    note_text = (
        "<b>Nota de Atención:</b> Este documento representa un presupuesto o pedido preliminar solicitado por WhatsApp. "
        "Los precios y disponibilidad quedan sujetos a confirmación de stock al momento del cierre en caja o confirmación del operador humano. "
        "¡Gracias por elegir <b>Extra Supermercado</b>!"
    )
    elements.append(Paragraph(note_text, ParagraphStyle("Notes", fontName="Helvetica", fontSize=7.5, textColor=GRAY_TEXT, alignment=TA_CENTER, leading=10)))

    doc.build(elements)
    return buffer.getvalue()
