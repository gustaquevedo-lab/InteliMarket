import io
from datetime import datetime
from typing import Optional

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm, cm
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    Image, KeepTogether, HRFlowable
)
from reportlab.lib.colors import HexColor
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

from api.src.sifen.qr_service import generate_qr_image


PRIMARY_COLOR = HexColor("#1E40AF")
SECONDARY_COLOR = HexColor("#059669")
GRAY_LIGHT = HexColor("#F3F4F6")
GRAY_MEDIUM = HexColor("#6B7280")
GRAY_DARK = HexColor("#1F2937")
WHITE = HexColor("#FFFFFF")
BLACK = HexColor("#000000")


def generate_receipt_pdf(
    company: dict,
    sale: dict,
    items: list,
    cdc: Optional[str] = None,
    qr_image_bytes: Optional[bytes] = None,
) -> bytes:
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

    styles.add(ParagraphStyle(
        "CompanyHeader",
        fontName="Helvetica-Bold",
        fontSize=14,
        textColor=PRIMARY_COLOR,
        alignment=TA_LEFT,
        spaceAfter=2,
    ))

    styles.add(ParagraphStyle(
        "CompanySub",
        fontName="Helvetica",
        fontSize=8,
        textColor=GRAY_MEDIUM,
        alignment=TA_LEFT,
        spaceAfter=1,
    ))

    styles.add(ParagraphStyle(
        "ReceiptTitle",
        fontName="Helvetica-Bold",
        fontSize=16,
        textColor=PRIMARY_COLOR,
        alignment=TA_CENTER,
        spaceAfter=4,
    ))

    styles.add(ParagraphStyle(
        "ReceiptSubTitle",
        fontName="Helvetica",
        fontSize=9,
        textColor=GRAY_MEDIUM,
        alignment=TA_CENTER,
        spaceAfter=8,
    ))

    styles.add(ParagraphStyle(
        "SectionTitle",
        fontName="Helvetica-Bold",
        fontSize=10,
        textColor=GRAY_DARK,
        spaceBefore=8,
        spaceAfter=4,
    ))

    styles.add(ParagraphStyle(
        "InfoLabel",
        fontName="Helvetica",
        fontSize=8,
        textColor=GRAY_MEDIUM,
        spaceAfter=1,
    ))

    styles.add(ParagraphStyle(
        "InfoValue",
        fontName="Helvetica-Bold",
        fontSize=9,
        textColor=GRAY_DARK,
        spaceAfter=4,
    ))

    styles.add(ParagraphStyle(
        "FooterText",
        fontName="Helvetica",
        fontSize=7,
        textColor=GRAY_MEDIUM,
        alignment=TA_CENTER,
        spaceAfter=2,
    ))

    elements = []

    # Header
    header_data = [
        [
            Paragraph(company.get("razon_social", "Empresa"), styles["CompanyHeader"]),
            Paragraph(f"RUC: {company.get('ruc', 'N/A')}", styles["CompanySub"]),
            Paragraph(company.get("direccion", ""), styles["CompanySub"]),
            Paragraph(f"Tel: {company.get('telefono', '')}", styles["CompanySub"]),
        ]
    ]
    header_table = Table(header_data, colWidths=[100 * mm])
    header_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), WHITE),
        ("LINEBELOW", (0, -1), (-1, -1), 1, PRIMARY_COLOR),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    elements.append(header_table)
    elements.append(Spacer(1, 8 * mm))

    # Receipt title
    tipo_comprobante = sale.get("tipo_comprobante", "factura").title()
    elements.append(Paragraph(f"FACTURA ELECTR\u00d3NICA", styles["ReceiptTitle"]))
    elements.append(Paragraph(
        f"Nro: {sale.get('numero', 'N/A')} | {sale.get('condicion', 'Contado').title()}",
        styles["ReceiptSubTitle"],
    ))

    if cdc:
        elements.append(Paragraph(f"CDC: {cdc}", ParagraphStyle(
            "CDC", fontName="Helvetica", fontSize=7, textColor=GRAY_MEDIUM,
            alignment=TA_CENTER, spaceAfter=8,
        )))

    # Customer info
    elements.append(Paragraph("DATOS DEL CLIENTE", styles["SectionTitle"]))
    customer_data = [
        [
            Paragraph("Cliente:", styles["InfoLabel"]),
            Paragraph(sale.get("customer_name", "Consumidor Final"), styles["InfoValue"]),
        ],
        [
            Paragraph("RUC/CI:", styles["InfoLabel"]),
            Paragraph(sale.get("customer_ruc", "N/A"), styles["InfoValue"]),
        ],
        [
            Paragraph("Fecha:", styles["InfoLabel"]),
            Paragraph(
                datetime.fromisoformat(sale["created_at"]).strftime("%d/%m/%Y %H:%M")
                if sale.get("created_at") else "N/A",
                styles["InfoValue"],
            ),
        ],
    ]
    customer_table = Table(customer_data, colWidths=[25 * mm, 135 * mm])
    customer_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), GRAY_LIGHT),
        ("BOX", (0, 0), (-1, -1), 0.5, HexColor("#E5E7EB")),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, HexColor("#E5E7EB")),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
    ]))
    elements.append(customer_table)

    # Items table
    elements.append(Paragraph("DETALLE", styles["SectionTitle"]))

    items_header = [
        Paragraph("<b>Cant.</b>", ParagraphStyle("h", fontSize=8, alignment=TA_CENTER)),
        Paragraph("<b>Descripci\u00f3n</b>", ParagraphStyle("h", fontSize=8)),
        Paragraph("<b>P. Unit.</b>", ParagraphStyle("h", fontSize=8, alignment=TA_RIGHT)),
        Paragraph("<b>IVA</b>", ParagraphStyle("h", fontSize=8, alignment=TA_CENTER)),
        Paragraph("<b>Subtotal</b>", ParagraphStyle("h", fontSize=8, alignment=TA_RIGHT)),
    ]

    items_data = [items_header]
    for item in items:
        qty = item.get("cantidad", 1)
        desc = item.get("product_name", item.get("product_id", ""))
        price = item.get("precio_unitario", 0)
        iva_tasa = item.get("iva_tasa", 10)
        subtotal = qty * price

        iva_label = f"{iva_tasa}%" if iva_tasa > 0 else "Exento"

        items_data.append([
            Paragraph(str(qty), ParagraphStyle("i", fontSize=8, alignment=TA_CENTER)),
            Paragraph(desc, ParagraphStyle("i", fontSize=8)),
            Paragraph(f"Gs {price:,.0f}", ParagraphStyle("i", fontSize=8, alignment=TA_RIGHT)),
            Paragraph(iva_label, ParagraphStyle("i", fontSize=8, alignment=TA_CENTER)),
            Paragraph(f"Gs {subtotal:,.0f}", ParagraphStyle("i", fontSize=8, alignment=TA_RIGHT)),
        ])

    items_table = Table(items_data, colWidths=[15 * mm, 80 * mm, 25 * mm, 15 * mm, 30 * mm])
    items_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), PRIMARY_COLOR),
        ("TEXTCOLOR", (0, 0), (-1, 0), WHITE),
        ("BACKGROUND", (0, 1), (-1, -1), WHITE),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [WHITE, GRAY_LIGHT]),
        ("GRID", (0, 0), (-1, -1), 0.5, HexColor("#E5E7EB")),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
    ]))
    elements.append(items_table)

    # Totals
    total = sale.get("total", 0)
    iva_10 = sale.get("iva_10", 0)
    iva_5 = sale.get("iva_5", 0)
    subtotal_sin_iva = total - iva_10 - iva_5

    totals_data = [
        [
            Paragraph("Subtotal:", ParagraphStyle("t", fontSize=9, textColor=GRAY_MEDIUM)),
            Paragraph(f"Gs {subtotal_sin_iva:,.0f}", ParagraphStyle("t", fontSize=9, alignment=TA_RIGHT)),
        ],
        [
            Paragraph("IVA 10%:", ParagraphStyle("t", fontSize=9, textColor=GRAY_MEDIUM)),
            Paragraph(f"Gs {iva_10:,.0f}", ParagraphStyle("t", fontSize=9, alignment=TA_RIGHT)),
        ],
        [
            Paragraph("IVA 5%:", ParagraphStyle("t", fontSize=9, textColor=GRAY_MEDIUM)),
            Paragraph(f"Gs {iva_5:,.0f}", ParagraphStyle("t", fontSize=9, alignment=TA_RIGHT)),
        ],
        [
            Paragraph("<b>TOTAL:</b>", ParagraphStyle("t", fontSize=12, textColor=PRIMARY_COLOR)),
            Paragraph(f"<b>Gs {total:,.0f}</b>", ParagraphStyle("t", fontSize=12, alignment=TA_RIGHT, textColor=PRIMARY_COLOR)),
        ],
    ]

    totals_table = Table(totals_data, colWidths=[100 * mm, 65 * mm])
    totals_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -2), GRAY_LIGHT),
        ("BACKGROUND", (0, -1), (-1, -1), HexColor("#DBEAFE")),
        ("LINEABOVE", (0, -1), (-1, -1), 2, PRIMARY_COLOR),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
    ]))
    elements.append(totals_table)

    # QR Code
    if qr_image_bytes:
        elements.append(Spacer(1, 10 * mm))
        qr_img = io.BytesIO(qr_image_bytes)
        qr_image = Image(qr_img, width=30 * mm, height=30 * mm)
        qr_wrapper = Table([[qr_image]], colWidths=[30 * mm])
        qr_wrapper.setStyle(TableStyle([
            ("ALIGN", (0, 0), (-1, -1), "CENTER"),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ]))
        elements.append(qr_wrapper)
        elements.append(Paragraph(
            "Escane\u00e1 para verificar en SET - e-Kuatia",
            ParagraphStyle("qr", fontSize=7, textColor=GRAY_MEDIUM, alignment=TA_CENTER, spaceAfter=4),
        ))

    # Footer
    elements.append(Spacer(1, 8 * mm))
    elements.append(HRFlowable(width="100%", thickness=0.5, color=HexColor("#E5E7EB")))
    elements.append(Spacer(1, 4 * mm))
    elements.append(Paragraph(
        "Documento generado por InteliMarket - Sistema de Facturaci\u00f3n Electr\u00f3nica",
        styles["FooterText"],
    ))
    elements.append(Paragraph(
        "Este documento es una representaci\u00f3n impresa de la Factura Electr\u00f3nica",
        styles["FooterText"],
    ))

    doc.build(elements)
    return buffer.getvalue()
