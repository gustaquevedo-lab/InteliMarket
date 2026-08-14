"""Reportes financieros en PDF — Estado de Resultados, Balance de Comprobacion,
Estado de Cuenta de Cliente/Proveedor. Mismo patron que receipts/pdf_service.py
(reportlab), reutilizado para no inventar una segunda forma de generar PDFs.

Encabezado con logo (del cliente si `company.logo_url` esta cargado, sino el
wordmark de InteliMarket dibujado en vector) + metadata de auditoria (tipo de
reporte, fecha/hora de generacion, usuario que lo genero). Pie de pagina con
paginacion real (Pagina X de Y) y datos de la empresa en cada hoja.
"""
import io
import os
from datetime import date, datetime
from decimal import Decimal
from zoneinfo import ZoneInfo

import requests
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable, Image
from reportlab.lib.colors import HexColor
from reportlab.pdfgen import canvas as pdfcanvas
from reportlab.graphics.shapes import Drawing, Rect, String
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

# Fuente Lato (Google Fonts, OFL) en vez de la Helvetica base de reportlab —
# se ve notablemente mas moderna/premium en un reporte corporativo. Se
# registra una sola vez al importar el modulo; si los archivos no estan
# presentes (entorno sin los .ttf bajados) cae a Helvetica sin romper nada.
_FONTS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "assets", "fonts")
FONT_REGULAR = "Helvetica"
FONT_BOLD = "Helvetica-Bold"
try:
    pdfmetrics.registerFont(TTFont("Lato", os.path.join(_FONTS_DIR, "Lato-Regular.ttf")))
    pdfmetrics.registerFont(TTFont("Lato-Bold", os.path.join(_FONTS_DIR, "Lato-Bold.ttf")))
    pdfmetrics.registerFont(TTFont("Lato-Medium", os.path.join(_FONTS_DIR, "Lato-Medium.ttf")))
    pdfmetrics.registerFont(TTFont("Lato-SemiBold", os.path.join(_FONTS_DIR, "Lato-SemiBold.ttf")))
    pdfmetrics.registerFontFamily("Lato", normal="Lato", bold="Lato-Bold")
    FONT_REGULAR = "Lato"
    FONT_BOLD = "Lato-Bold"
except Exception:
    pass  # sin los .ttf disponibles, se sigue viendo bien con Helvetica

PY_TZ = ZoneInfo("America/Asuncion")

PRIMARY_COLOR = HexColor("#1E40AF")
GRAY_LIGHT = HexColor("#F3F4F6")
GRAY_MEDIUM = HexColor("#6B7280")
GRAY_DARK = HexColor("#1F2937")
RED = HexColor("#DC2626")
GREEN = HexColor("#059669")
WHITE = HexColor("#FFFFFF")

PAGE_W, PAGE_H = A4
MARGIN = 15 * mm


def _fmt_gs(v) -> str:
    # "Gs." en vez del simbolo ₲ -- Helvetica (fuente base de reportlab) no
    # tiene el glifo del guarani y lo renderiza como un cuadrado vacio.
    n = int(round(float(v or 0)))
    return f"{'-' if n < 0 else ''}Gs. {abs(n):,}".replace(",", ".")


def _logo_flowable(company: dict):
    logo_url = company.get("logo_url")
    if logo_url:
        try:
            resp = requests.get(logo_url, timeout=3)
            if resp.ok and resp.content:
                img = Image(io.BytesIO(resp.content))
                img._restrictSize(30 * mm, 16 * mm)
                return img
        except Exception:
            pass  # logo del cliente no disponible -- cae al wordmark propio, no rompe el reporte

    d = Drawing(42 * mm, 14 * mm)
    d.add(Rect(0, 2, 11 * mm, 11 * mm, rx=2, ry=2, fillColor=PRIMARY_COLOR, strokeColor=None))
    d.add(String(5.5 * mm, 5.3 * mm, "IM", fontSize=8.5, fillColor=WHITE, textAnchor="middle", fontName=FONT_BOLD))
    d.add(String(14 * mm, 5 * mm, "InteliMarket", fontSize=12, fillColor=PRIMARY_COLOR, fontName=FONT_BOLD))
    return d


class _AuditedCanvas(pdfcanvas.Canvas):
    """Canvas que numera 'Pagina X de Y' de verdad (requiere saber el total de
    paginas antes de dibujar el pie, por eso se buffean y se dibujan en save())."""

    def __init__(self, *args, footer_left="", footer_right="", **kwargs):
        pdfcanvas.Canvas.__init__(self, *args, **kwargs)
        self._saved_states = []
        self._footer_left = footer_left
        self._footer_right = footer_right

    def showPage(self):
        self._saved_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        total_pages = len(self._saved_states)
        for state in self._saved_states:
            self.__dict__.update(state)
            self._draw_footer(total_pages)
            pdfcanvas.Canvas.showPage(self)
        pdfcanvas.Canvas.save(self)

    def _draw_footer(self, total_pages):
        self.setStrokeColor(GRAY_LIGHT)
        self.setLineWidth(0.5)
        self.line(MARGIN, 16 * mm, PAGE_W - MARGIN, 16 * mm)
        self.setFont(FONT_REGULAR, 7)
        self.setFillColor(GRAY_MEDIUM)
        self.drawString(MARGIN, 11 * mm, self._footer_left)
        self.drawRightString(PAGE_W - MARGIN, 11 * mm, f"Página {self._pageNumber} de {total_pages}")
        self.drawCentredString(PAGE_W / 2, 7 * mm, self._footer_right)


def _base_doc(buffer, title: str, company: dict, generated_by: str = "") -> tuple:
    footer_left = f"{company.get('razon_social', 'Empresa')} · RUC: {company.get('ruc', 'N/A')}"
    footer_right = "Generado por InteliMarket ERP — documento de uso interno"

    def _canvasmaker(*args, **kwargs):
        return _AuditedCanvas(*args, footer_left=footer_left, footer_right=footer_right, **kwargs)

    doc = SimpleDocTemplate(
        buffer, pagesize=A4,
        rightMargin=MARGIN, leftMargin=MARGIN, topMargin=15 * mm, bottomMargin=22 * mm,
        title=title,
    )
    doc._audited_canvasmaker = _canvasmaker
    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle("Header", fontName=FONT_BOLD, fontSize=13, leading=15, textColor=GRAY_DARK, spaceAfter=1))
    styles.add(ParagraphStyle("Sub", fontName=FONT_REGULAR, fontSize=8, leading=10, textColor=GRAY_MEDIUM))
    styles.add(ParagraphStyle("SectionTitle", fontName=FONT_BOLD, fontSize=11, leading=14, textColor=GRAY_DARK, spaceBefore=10, spaceAfter=4))
    styles.add(ParagraphStyle("Small", fontName=FONT_REGULAR, fontSize=8, leading=11, textColor=GRAY_MEDIUM))
    styles.add(ParagraphStyle("MetaRight", fontName=FONT_REGULAR, fontSize=7.5, leading=10, textColor=GRAY_MEDIUM, alignment=TA_RIGHT))
    styles.add(ParagraphStyle("Eyebrow", fontName=FONT_BOLD, fontSize=8.5, leading=11, textColor=WHITE, alignment=TA_LEFT))
    return doc, styles


def _build(doc, elements):
    doc.build(elements, canvasmaker=doc._audited_canvasmaker)


def _accent_bar(report_title: str) -> Table:
    """Franja superior de color solido con el nombre del reporte en mayusculas
    -- reemplaza al subtitulo suelto de antes, da un punto de color premium
    arriba de todo sin ocupar una linea extra de texto plano."""
    t = Table([[Paragraph(report_title.upper(), ParagraphStyle("EyebrowInline", fontName=FONT_BOLD, fontSize=8.5, leading=11, textColor=WHITE))]], colWidths=[180 * mm])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), PRIMARY_COLOR),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
    ]))
    return t


def _company_header(company: dict, styles, report_title: str, subtitle: str, generated_by: str = "") -> list:
    # Hora real de Paraguay -- el servidor corre en UTC (datetime.now() sin
    # tz daba la hora del servidor, ~4 horas adelantada de la hora real).
    now = datetime.now(PY_TZ)
    meta_lines = [
        Paragraph(f"<b>Generado:</b> {now.strftime('%d/%m/%Y %H:%M')}", styles["MetaRight"]),
        Paragraph(f"<b>Por:</b> {generated_by or 'Sistema'}", styles["MetaRight"]),
    ]
    header_table = Table(
        [[
            _logo_flowable(company),
            [
                Paragraph(company.get("razon_social", "Empresa"), styles["Header"]),
                Paragraph(f"RUC: {company.get('ruc', 'N/A')}", styles["Sub"]),
            ],
            meta_lines,
        ]],
        colWidths=[38 * mm, 87 * mm, 55 * mm],
    )
    header_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
    ]))
    # Orden: primero los datos de la empresa (quien emite el reporte), el
    # nombre del reporte va debajo — antes la franja de titulo iba arriba de
    # todo, como si el reporte importara mas que quien lo emite.
    return [
        header_table,
        Spacer(1, 8),
        _accent_bar(subtitle),
        Spacer(1, 8),
        HRFlowable(width="100%", thickness=0.75, color=GRAY_LIGHT),
        Spacer(1, 8),
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
            style.append(("FONTNAME", (0, i), (-1, i), FONT_BOLD))
            style.append(("LINEABOVE", (0, i), (-1, i), 0.75, GRAY_DARK))
    t.setStyle(TableStyle(style))
    return t


# ── Estado de Resultados ────────────────────────────────────────────────────

def generate_pnl_pdf(company: dict, pnl: dict, generated_by: str = "") -> bytes:
    buffer = io.BytesIO()
    doc, styles = _base_doc(buffer, "Estado de Resultados", company, generated_by)
    elements = _company_header(company, styles, "Estado de Resultados", f"Estado de Resultados — Periodo {pnl.get('periodo', '')}", generated_by)

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
    style_final = ParagraphStyle("ResultadoFinal", fontName=FONT_BOLD, fontSize=13, textColor=color)
    elements.append(Paragraph(f"RESULTADO NETO: {_fmt_gs(resultado)}", style_final))
    elements.append(Spacer(1, 10))
    elements.append(Paragraph(
        "Nota: las facturas de compra se registran contablemente como Inventario de Mercaderias por defecto. "
        "Si hay proveedores de servicios (alquiler, luz, honorarios) que no son mercaderia, ese gasto real todavia "
        "no esta reflejado aqui como Gasto Operativo — requiere clasificar esos proveedores.",
        styles["Small"],
    ))

    _build(doc, elements)
    return buffer.getvalue()


# ── Balance de Comprobacion ──────────────────────────────────────────────────

def generate_trial_balance_pdf(company: dict, tb: dict, generated_by: str = "") -> bytes:
    buffer = io.BytesIO()
    doc, styles = _base_doc(buffer, "Balance de Comprobacion", company, generated_by)
    elements = _company_header(company, styles, "Balance de Comprobación", f"Balance de Comprobacion — Periodo {tb.get('periodo', '')}", generated_by)

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
        ("FONTNAME", (0, 0), (-1, 0), FONT_BOLD),
        ("FONTNAME", (0, -1), (-1, -1), FONT_BOLD),
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
    estado_style = ParagraphStyle("Estado", fontName=FONT_BOLD, fontSize=10, textColor=GREEN if balanceado else RED)
    elements.append(Paragraph("✓ Balance cuadrado (Debe = Haber)" if balanceado else "✗ Balance NO cuadrado — revisar", estado_style))

    _build(doc, elements)
    return buffer.getvalue()


# ── Estado de Cuenta (Cliente o Proveedor) ──────────────────────────────────

def generate_account_statement_pdf(company: dict, contraparte: dict, tipo: str, documentos: list[dict], generated_by: str = "") -> bytes:
    """tipo: 'cliente' o 'proveedor'. documentos: lista de facturas/pendientes
    con numero, fecha_emision, fecha_vencimiento, monto_original, saldo_pendiente, dias_mora."""
    buffer = io.BytesIO()
    report_title = f"Estado de Cuenta de {'Cliente' if tipo == 'cliente' else 'Proveedor'}"
    doc, styles = _base_doc(buffer, f"Estado de Cuenta - {contraparte.get('nombre', '')}", company, generated_by)
    elements = _company_header(company, styles, report_title, report_title, generated_by)

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
        ("FONTNAME", (0, 0), (-1, 0), FONT_BOLD),
        ("FONTNAME", (0, -1), (-1, -1), FONT_BOLD),
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
    total_style = ParagraphStyle("Total", fontName=FONT_BOLD, fontSize=12, textColor=PRIMARY_COLOR)
    elements.append(Paragraph(f"Saldo total pendiente: {_fmt_gs(total_pendiente)}", total_style))

    _build(doc, elements)
    return buffer.getvalue()
