import urllib.request
import json
import io
import os
from datetime import datetime
from zoneinfo import ZoneInfo

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.units import mm
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether, HRFlowable
)
from reportlab.lib.colors import HexColor
from reportlab.pdfgen import canvas

PY_TZ = ZoneInfo("America/Asuncion")

PRIMARY_COLOR = HexColor("#0F172A")    # Slate 900
ACCENT_COLOR = HexColor("#1E3A8A")     # Blue 900
TEXT_DARK = HexColor("#0F172A")
TEXT_MUTED = HexColor("#475569")       # Slate 600
BORDER_COLOR = HexColor("#CBD5E1")     # Slate 300
BG_HEADER = HexColor("#1E293B")        # Slate 800
BG_ALT = HexColor("#F8FAFC")           # Slate 50
GREEN = HexColor("#15803D")
RED = HexColor("#B91C1C")

def fmt_gs(val):
    if val is None or val == "":
        return "-"
    try:
        n = int(round(float(val)))
        return f"{n:,}".replace(",", ".")
    except Exception:
        return str(val)

class NumberedCanvas(canvas.Canvas):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_decorations(num_pages)
            super().showPage()
        super().save()

    def draw_page_decorations(self, total_pages):
        self.saveState()
        self.setFont("Helvetica", 7.5)
        self.setFillColor(TEXT_MUTED)

        # Footer
        now_str = datetime.now(PY_TZ).strftime("%d/%m/%Y %H:%M:%S")
        footer_left = f"Extra Supermercado (Grupo Santa Teresa E.A.S. - RUC 80150377-9) · Auditoría de Precios · {now_str} (Asunción)"
        footer_right = f"Página {self._pageNumber} de {total_pages}"
        
        # Line
        self.setStrokeColor(BORDER_COLOR)
        self.setLineWidth(0.5)
        self.line(10 * mm, 10 * mm, 287 * mm, 10 * mm)

        self.drawString(10 * mm, 7 * mm, footer_left)
        self.drawRightString(287 * mm, 7 * mm, footer_right)
        self.restoreState()

def build_pdf(items: list[dict], output_path: str):
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=landscape(A4),
        leftMargin=10 * mm,
        rightMargin=10 * mm,
        topMargin=10 * mm,
        bottomMargin=14 * mm,
    )

    styles = getSampleStyleSheet()

    title_style = ParagraphStyle(
        "DocTitle",
        fontName="Helvetica-Bold",
        fontSize=14,
        leading=17,
        textColor=PRIMARY_COLOR,
    )
    subtitle_style = ParagraphStyle(
        "DocSubtitle",
        fontName="Helvetica",
        fontSize=8.5,
        leading=11,
        textColor=TEXT_MUTED,
    )
    meta_style = ParagraphStyle(
        "DocMeta",
        fontName="Helvetica-Bold",
        fontSize=8,
        leading=10,
        alignment=TA_RIGHT,
        textColor=PRIMARY_COLOR,
    )
    meta_sub = ParagraphStyle(
        "DocMetaSub",
        fontName="Helvetica",
        fontSize=7.5,
        leading=9.5,
        alignment=TA_RIGHT,
        textColor=TEXT_MUTED,
    )

    th_style = ParagraphStyle(
        "TableHeader",
        fontName="Helvetica-Bold",
        fontSize=7.5,
        leading=9.5,
        textColor=colors.white,
        alignment=TA_CENTER,
    )
    th_style_left = ParagraphStyle(
        "TableHeaderL",
        fontName="Helvetica-Bold",
        fontSize=7.5,
        leading=9.5,
        textColor=colors.white,
        alignment=TA_LEFT,
    )
    th_style_right = ParagraphStyle(
        "TableHeaderR",
        fontName="Helvetica-Bold",
        fontSize=7.5,
        leading=9.5,
        textColor=colors.white,
        alignment=TA_RIGHT,
    )

    td_idx = ParagraphStyle("TdIdx", fontName="Helvetica", fontSize=7, leading=8.5, alignment=TA_CENTER, textColor=TEXT_MUTED)
    td_sku = ParagraphStyle("TdSku", fontName="Helvetica-Bold", fontSize=7.5, leading=9, alignment=TA_CENTER, textColor=PRIMARY_COLOR)
    td_bar = ParagraphStyle("TdBar", fontName="Helvetica", fontSize=7, leading=8.5, alignment=TA_CENTER, textColor=TEXT_MUTED)
    td_prod_name = ParagraphStyle("TdProdName", fontName="Helvetica-Bold", fontSize=7.5, leading=9.5, textColor=TEXT_DARK)
    td_prod_sub = ParagraphStyle("TdProdSub", fontName="Helvetica", fontSize=6.5, leading=8, textColor=TEXT_MUTED)
    td_num_ant = ParagraphStyle("TdNumAnt", fontName="Helvetica", fontSize=7.5, leading=9, alignment=TA_RIGHT, textColor=TEXT_MUTED)
    td_num_new = ParagraphStyle("TdNumNew", fontName="Helvetica-Bold", fontSize=8, leading=9.5, alignment=TA_RIGHT, textColor=PRIMARY_COLOR)
    td_up = ParagraphStyle("TdUp", fontName="Helvetica-Bold", fontSize=7.5, leading=9, alignment=TA_RIGHT, textColor=GREEN)
    td_down = ParagraphStyle("TdDown", fontName="Helvetica-Bold", fontSize=7.5, leading=9, alignment=TA_RIGHT, textColor=RED)
    td_num = ParagraphStyle("TdNum", fontName="Helvetica", fontSize=7.5, leading=9, alignment=TA_RIGHT, textColor=TEXT_MUTED)
    td_tiers = ParagraphStyle("TdTiers", fontName="Helvetica", fontSize=7, leading=8.5, textColor=HexColor("#1E293B"))

    elements = []

    # Header Table
    now_str = datetime.now(PY_TZ).strftime("%d/%m/%Y %H:%M")
    total_mod = len(items)
    total_subidas = sum(1 for x in items if x["diferencia_monto"] > 0)
    total_bajadas = sum(1 for x in items if x["diferencia_monto"] < 0)
    con_escalas = sum(1 for x in items if x["escalas"] != "-")

    header_left = [
        Paragraph("EXTRA SUPERMERCADO MAYORISTA", title_style),
        Paragraph("GRUPO SANTA TERESA E.A.S. · RUC: 80150377-9 · Pedro Juan Caballero, Paraguay", subtitle_style),
        Paragraph("<b>Catálogo de Precios Auditados y Modificados (Orden Alfabético)</b>", subtitle_style),
    ]
    header_right = [
        Paragraph("DOCUMENTO DE AUDITORÍA DE PRECIOS", meta_style),
        Paragraph(f"Fecha de emisión: {now_str}", meta_sub),
        Paragraph(f"Total productos para modificar: <b>{total_mod}</b>", meta_sub),
        Paragraph(f"Aumentos: <b>{total_subidas}</b> · Rebajas: <b>{total_bajadas}</b> · Con Escalas: <b>{con_escalas}</b>", meta_sub),
    ]

    header_table = Table([[header_left, header_right]], colWidths=[167 * mm, 110 * mm])
    header_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
    ]))
    elements.append(header_table)
    elements.append(Spacer(1, 2.5 * mm))
    elements.append(HRFlowable(width="100%", thickness=1, color=PRIMARY_COLOR, spaceBefore=0, spaceAfter=2.5 * mm))

    # KPI Banner
    kpi_label = ParagraphStyle("KpiL", fontName="Helvetica-Bold", fontSize=7, alignment=TA_CENTER, textColor=TEXT_MUTED)
    kpi_val = ParagraphStyle("KpiV", fontName="Helvetica-Bold", fontSize=10, alignment=TA_CENTER, textColor=PRIMARY_COLOR)
    kpi_val_up = ParagraphStyle("KpiVUp", fontName="Helvetica-Bold", fontSize=10, alignment=TA_CENTER, textColor=GREEN)
    kpi_val_dn = ParagraphStyle("KpiVDn", fontName="Helvetica-Bold", fontSize=10, alignment=TA_CENTER, textColor=RED)

    kpis = Table([
        [
            Paragraph("TOTAL PRODUCTOS MODIFICADOS", kpi_label),
            Paragraph("AUMENTOS APROBADOS (▲)", kpi_label),
            Paragraph("REBAJAS / AJUSTES (▼)", kpi_label),
            Paragraph("PRODUCTOS CON ESCALAS", kpi_label),
        ],
        [
            Paragraph(f"{total_mod}", kpi_val),
            Paragraph(f"{total_subidas}", kpi_val_up),
            Paragraph(f"{total_bajadas}", kpi_val_dn),
            Paragraph(f"{con_escalas}", kpi_val),
        ]
    ], colWidths=[69.2 * mm, 69.2 * mm, 69.2 * mm, 69.2 * mm])
    kpis.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), BG_ALT),
        ("BOX", (0, 0), (-1, -1), 0.5, BORDER_COLOR),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, HexColor("#E2E8F0")),
        ("TOPPADDING", (0, 0), (-1, -1), 2),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
    ]))
    elements.append(kpis)
    elements.append(Spacer(1, 3 * mm))

    # Main Table
    # Widths: 8 + 15 + 24 + 75 + 24 + 25 + 24 + 82 = 277 mm
    col_widths = [8 * mm, 15 * mm, 24 * mm, 75 * mm, 24 * mm, 25 * mm, 24 * mm, 82 * mm]

    table_data = [[
        Paragraph("#", th_style),
        Paragraph("SKU", th_style),
        Paragraph("Cód. Barras", th_style),
        Paragraph("Producto & Clasificación", th_style_left),
        Paragraph("Precio Anterior", th_style_right),
        Paragraph("Precio Nuevo", th_style_right),
        Paragraph("Diferencia", th_style_right),
        Paragraph("Escalas Mayoristas Nuevas (Cantidad : Precio)", th_style_left),
    ]]

    for i, it in enumerate(items, 1):
        diff = it["diferencia_monto"]
        diff_pct = it["diferencia_pct"]
        diff_str = f"{'+' if diff > 0 else ''}{fmt_gs(diff)} ({'+' if diff_pct > 0 else ''}{diff_pct:.1f}%)"
        diff_style = td_up if diff > 0 else (td_down if diff < 0 else td_num)

        prod_cell = [
            Paragraph(it["nombre"], td_prod_name),
            Paragraph(f"{it['categoria']} · Proveedor: {it['proveedor']}", td_prod_sub)
        ]

        table_data.append([
            Paragraph(str(i), td_idx),
            Paragraph(it["sku"], td_sku),
            Paragraph(it["codigo_barra"] or "-", td_bar),
            prod_cell,
            Paragraph(fmt_gs(it["precio_anterior"]), td_num_ant),
            Paragraph(fmt_gs(it["precio_nuevo"]), td_num_new),
            Paragraph(diff_str, diff_style),
            Paragraph(it["escalas"], td_tiers),
        ])

    main_table = Table(table_data, colWidths=col_widths, repeatRows=1)
    main_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), BG_HEADER),
        ("ALIGN", (0, 0), (-1, 0), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("GRID", (0, 0), (-1, -1), 0.3, BORDER_COLOR),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, BG_ALT]),
        ("TOPPADDING", (0, 0), (-1, -1), 2),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
        ("LEFTPADDING", (0, 0), (-1, -1), 2),
        ("RIGHTPADDING", (0, 0), (-1, -1), 2),
    ]))

    elements.append(main_table)

    doc.build(elements, canvasmaker=NumberedCanvas)
    pdf_bytes = buffer.getvalue()
    
    with open(output_path, "wb") as f:
        f.write(pdf_bytes)
    
    print(f"PDF generado exitosamente en {output_path} ({len(pdf_bytes)} bytes)")
    return pdf_bytes

if __name__ == "__main__":
    req_state = urllib.request.urlopen("https://intelimarket.superextra.com.py/api/v1/price-lists/audit-state")
    state = json.loads(req_state.read().decode("utf-8"))
    decisiones = state.get("decisiones", {})

    req_cat = urllib.request.urlopen("https://intelimarket.superextra.com.py/api/v1/price-lists/audit-catalog")
    catalog = json.loads(req_cat.read().decode("utf-8"))
    prod_map = {p["id"]: p for p in catalog}

    modificados = []
    for pid, dec in decisiones.items():
        st = dec.get("status")
        prod = prod_map.get(pid)
        if not prod:
            continue
        p_act = prod.get("p_act", 0)
        p_nuevo = dec.get("price", 0)
        tiers = dec.get("custom_tiers", [])

        if st == "MODIFIED" or (p_nuevo > 0 and p_nuevo != p_act):
            tiers_strs = []
            for t in sorted(tiers, key=lambda x: x.get("min_qty", 0)):
                mq = t.get("min_qty")
                pr = t.get("precio")
                if mq and pr:
                    tiers_strs.append(f"{mq}u: {fmt_gs(pr)}")

            diff = p_nuevo - p_act
            diff_pct = (diff / p_act * 100) if p_act > 0 else 0.0

            modificados.append({
                "id": pid,
                "nombre": prod.get("nom", "").strip(),
                "sku": prod.get("sku", "").strip(),
                "codigo_barra": prod.get("bar", "").strip(),
                "proveedor": prod.get("prv", "").strip(),
                "categoria": prod.get("cat", "").strip(),
                "precio_anterior": p_act,
                "precio_nuevo": p_nuevo,
                "diferencia_monto": diff,
                "diferencia_pct": round(diff_pct, 1),
                "escalas": " | ".join(tiers_strs) if tiers_strs else "-"
            })

    modificados.sort(key=lambda x: x["nombre"].upper())
    os.makedirs("docs", exist_ok=True)
    os.makedirs("ui-web/public/auditoria", exist_ok=True)
    build_pdf(modificados, "docs/productos_modificados_auditoria.pdf")
    build_pdf(modificados, "ui-web/public/auditoria/productos_modificados_auditoria.pdf")
