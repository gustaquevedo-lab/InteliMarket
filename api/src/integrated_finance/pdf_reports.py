"""Reportes financieros en PDF — Estado de Resultados, Balance de Comprobacion,
Estado de Cuenta de Cliente/Proveedor. Mismo patron que receipts/pdf_service.py
(reportlab), reutilizado para no inventar una segunda forma de generar PDFs.
"""
import io
from datetime import date, datetime
from decimal import Decimal

from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
from reportlab.lib.colors import HexColor

PRIMARY_COLOR = HexColor("#1E40AF")
GRAY_LIGHT = HexColor("#F3F4F6")
GRAY_MEDIUM = HexColor("#6B7280")
GRAY_DARK = HexColor("#1F2937")
RED = HexColor("#DC2626")
GREEN = HexColor("#059669")
WHITE = HexColor("#FFFFFF")


def _fmt_gs(v) -> str:
    # "Gs." en vez del simbolo ₲ -- Helvetica (fuente base de reportlab) no
    # tiene el glifo del guarani y lo renderiza como un cuadrado vacio.
    n = int(round(float(v or 0)))
    return f"{'-' if n < 0 else ''}Gs. {abs(n):,}".replace(",", ".")


def _base_doc(buffer, title: str):
    doc = SimpleDocTemplate(
        buffer, pagesize=A4,
        rightMargin=15 * mm, leftMargin=15 * mm, topMargin=15 * mm, bottomMargin=15 * mm,
        title=title,
    )
    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle("Header", fontName="Helvetica-Bold", fontSize=15, textColor=PRIMARY_COLOR, spaceAfter=2))
    styles.add(ParagraphStyle("Sub", fontName="Helvetica", fontSize=9, textColor=GRAY_MEDIUM, spaceAfter=1))
    styles.add(ParagraphStyle("SectionTitle", fontName="Helvetica-Bold", fontSize=11, textColor=GRAY_DARK, spaceBefore=10, spaceAfter=4))
    styles.add(ParagraphStyle("Small", fontName="Helvetica", fontSize=8, textColor=GRAY_MEDIUM))
    return doc, styles


def _company_header(company: dict, styles, subtitle: str) -> list:
    return [
        Paragraph(company.get("razon_social", "Empresa"), styles["Header"]),
        Paragraph(f"RUC: {company.get('ruc', 'N/A')}", styles["Sub"]),
        Paragraph(subtitle, styles["Sub"]),
        Paragraph(f"Generado: {datetime.now().strftime('%d/%m/%Y %H:%M')}", styles["Small"]),
        Spacer(1, 6),
        HRFlowable(width="100%", thickness=1, color=PRIMARY_COLOR),
        Spacer(1, 10),
    ]


def _totals_table(rows: list[tuple[str, str, bool]]) -> Table:
    """rows: (label, valor_formateado, es_total_final)"""
    data = [[label, valor] for label, valor, _ in rows]
    t = Table(data, colWidths=[110 * mm, 60 * mm])
    style = [
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("ALIGN", (1, 0), (1, -1), "RIGHT"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
    ]
    for i, (_, _, es_total) in enumerate(rows):
        if es_total:
            style.append(("FONTNAME", (0, i), (-1, i), "Helvetica-Bold"))
            style.append(("LINEABOVE", (0, i), (-1, i), 0.75, GRAY_DARK))
    t.setStyle(TableStyle(style))
    return t


# ── Estado de Resultados ────────────────────────────────────────────────────

def generate_pnl_pdf(company: dict, pnl: dict) -> bytes:
    buffer = io.BytesIO()
    doc, styles = _base_doc(buffer, "Estado de Resultados")
    elements = _company_header(company, styles, f"Estado de Resultados — Periodo {pnl.get('periodo', '')}")

    elements.append(Paragraph("Ingresos", styles["SectionTitle"]))
    rows = [(i["nombre"], _fmt_gs(i["monto"]), False) for i in pnl.get("ingresos", [])]
    rows.append(("Total Ingresos", _fmt_gs(pnl.get("total_ingresos", 0)), True))
    elements.append(_totals_table(rows))

    elements.append(Paragraph("Costo de Mercaderia Vendida", styles["SectionTitle"]))
    rows = [(c["nombre"], _fmt_gs(c["monto"]), False) for c in pnl.get("costos", [])]
    rows.append(("Total Costos", _fmt_gs(pnl.get("total_costos", 0)), True))
    elements.append(_totals_table(rows))

    elements.append(Paragraph(f"Resultado Bruto: {_fmt_gs(pnl.get('resultado_bruto', 0))}", styles["SectionTitle"]))

    elements.append(Paragraph("Gastos Operativos", styles["SectionTitle"]))
    rows = [(g["nombre"], _fmt_gs(g["monto"]), False) for g in pnl.get("gastos", [])]
    rows.append(("Total Gastos", _fmt_gs(pnl.get("total_gastos", 0)), True))
    elements.append(_totals_table(rows))

    elements.append(Spacer(1, 8))
    resultado = pnl.get("resultado_neto", 0)
    color = GREEN if resultado >= 0 else RED
    elements.append(HRFlowable(width="100%", thickness=1.5, color=GRAY_DARK))
    elements.append(Spacer(1, 6))
    style_final = ParagraphStyle("ResultadoFinal", fontName="Helvetica-Bold", fontSize=13, textColor=color)
    elements.append(Paragraph(f"RESULTADO NETO: {_fmt_gs(resultado)}", style_final))
    elements.append(Spacer(1, 10))
    elements.append(Paragraph(
        "Nota: las facturas de compra se registran contablemente como Inventario de Mercaderias por defecto. "
        "Si hay proveedores de servicios (alquiler, luz, honorarios) que no son mercaderia, ese gasto real todavia "
        "no esta reflejado aqui como Gasto Operativo — requiere clasificar esos proveedores.",
        styles["Small"],
    ))

    doc.build(elements)
    return buffer.getvalue()


# ── Balance de Comprobacion ──────────────────────────────────────────────────

def generate_trial_balance_pdf(company: dict, tb: dict) -> bytes:
    buffer = io.BytesIO()
    doc, styles = _base_doc(buffer, "Balance de Comprobacion")
    elements = _company_header(company, styles, f"Balance de Comprobacion — Periodo {tb.get('periodo', '')}")

    header = ["Codigo", "Cuenta", "Debe", "Haber", "Saldo"]
    data = [header]
    for item in tb.get("items", []):
        if not item["debe"] and not item["haber"]:
            continue
        data.append([item["codigo"], item["nombre"], _fmt_gs(item["debe"]), _fmt_gs(item["haber"]), _fmt_gs(item["saldo"])])
    data.append(["", "TOTAL", _fmt_gs(tb.get("total_debe", 0)), _fmt_gs(tb.get("total_haber", 0)), ""])

    t = Table(data, colWidths=[22 * mm, 60 * mm, 32 * mm, 32 * mm, 32 * mm])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), PRIMARY_COLOR),
        ("TEXTCOLOR", (0, 0), (-1, 0), WHITE),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"),
        ("LINEABOVE", (0, -1), (-1, -1), 0.75, GRAY_DARK),
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("ALIGN", (2, 0), (4, -1), "RIGHT"),
        ("ROWBACKGROUNDS", (0, 1), (-1, -2), [WHITE, GRAY_LIGHT]),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
    ]))
    elements.append(t)
    balanceado = tb.get("total_debe") == tb.get("total_haber")
    elements.append(Spacer(1, 10))
    estado_style = ParagraphStyle("Estado", fontName="Helvetica-Bold", fontSize=10, textColor=GREEN if balanceado else RED)
    elements.append(Paragraph("✓ Balance cuadrado (Debe = Haber)" if balanceado else "✗ Balance NO cuadrado — revisar", estado_style))

    doc.build(elements)
    return buffer.getvalue()


# ── Estado de Cuenta (Cliente o Proveedor) ──────────────────────────────────

def generate_account_statement_pdf(company: dict, contraparte: dict, tipo: str, documentos: list[dict]) -> bytes:
    """tipo: 'cliente' o 'proveedor'. documentos: lista de facturas/pendientes
    con numero, fecha_emision, fecha_vencimiento, monto_original, saldo_pendiente, dias_mora."""
    buffer = io.BytesIO()
    doc, styles = _base_doc(buffer, f"Estado de Cuenta - {contraparte.get('nombre', '')}")
    subtitulo = f"Estado de Cuenta de {'Cliente' if tipo == 'cliente' else 'Proveedor'}"
    elements = _company_header(company, styles, subtitulo)

    elements.append(Paragraph(contraparte.get("nombre", ""), styles["SectionTitle"]))
    elements.append(Paragraph(f"RUC: {contraparte.get('ruc', 'N/A')}", styles["Sub"]))
    elements.append(Spacer(1, 8))

    header = ["N° Documento", "Emision", "Vencimiento", "Monto Original", "Saldo Pendiente", "Dias Mora"]
    data = [header]
    total_pendiente = Decimal("0")
    for d in documentos:
        dias_mora = d.get("dias_mora") or 0
        data.append([
            d.get("numero", ""),
            d.get("fecha_emision", ""),
            d.get("fecha_vencimiento", ""),
            _fmt_gs(d.get("monto_original", 0)),
            _fmt_gs(d.get("saldo_pendiente", 0)),
            str(dias_mora) if dias_mora else "-",
        ])
        total_pendiente += Decimal(str(d.get("saldo_pendiente", 0) or 0))
    data.append(["", "", "", "", _fmt_gs(total_pendiente), ""])

    t = Table(data, colWidths=[30 * mm, 25 * mm, 25 * mm, 32 * mm, 32 * mm, 22 * mm])
    style = [
        ("BACKGROUND", (0, 0), (-1, 0), PRIMARY_COLOR),
        ("TEXTCOLOR", (0, 0), (-1, 0), WHITE),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"),
        ("LINEABOVE", (0, -1), (-1, -1), 0.75, GRAY_DARK),
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("ALIGN", (3, 0), (5, -1), "RIGHT"),
        ("ROWBACKGROUNDS", (0, 1), (-1, -2), [WHITE, GRAY_LIGHT]),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
    ]
    for i, d in enumerate(documentos, start=1):
        if (d.get("dias_mora") or 0) > 0:
            style.append(("TEXTCOLOR", (5, i), (5, i), RED))
    t.setStyle(TableStyle(style))
    elements.append(t)

    elements.append(Spacer(1, 10))
    total_style = ParagraphStyle("Total", fontName="Helvetica-Bold", fontSize=12, textColor=PRIMARY_COLOR)
    elements.append(Paragraph(f"Saldo total pendiente: {_fmt_gs(total_pendiente)}", total_style))

    doc.build(elements)
    return buffer.getvalue()
