"""SueldOK Third-Party Deductions Report & Consolidated Payment Orders

Generates:
1. Formal PDF 'Planilla Anexa de Rendición de Descuentos por Convenio'
2. Consolidated SupplierPaymentOrder for external merchants (e.g. Comercial Malou)
3. Formal SupplierPaymentOrder for IPS 25.5% statutory contribution
"""

from io import BytesIO
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Optional, Dict, Any, List
import uuid
import os

from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.colors import HexColor
from reportlab.lib.units import mm
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable, KeepTogether
)
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from api.src.sueldok.models import PayrollDossier, PayrollDossierPhase
from api.src.financial.models import SupplierPaymentOrder
from api.src.financial.schemas import SupplierPaymentOrderCreate
from api.src.financial import service as financial_service


def generate_third_party_annex_pdf(
    company_name: str,
    company_ruc: str,
    third_party_name: str,
    third_party_ruc: Optional[str],
    periodo: str,
    cheque_numero: Optional[str],
    banco_nombre: Optional[str],
    employees: List[Dict[str, Any]],
    total_monto: float
) -> bytes:
    """
    Renders the official Annex Payroll Rendition PDF for a third-party merchant.
    """
    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=14 * mm,
        rightMargin=14 * mm,
        topMargin=12 * mm,
        bottomMargin=14 * mm
    )

    styles = getSampleStyleSheet()
    primary_color = HexColor("#1E3A8A")  # Corporate navy
    dark_gray = HexColor("#334155")
    light_bg = HexColor("#F8FAFC")
    border_color = HexColor("#CBD5E1")

    title_style = ParagraphStyle(
        "TitleStyle",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=13,
        leading=16,
        textColor=primary_color,
        alignment=TA_LEFT
    )
    subtitle_style = ParagraphStyle(
        "SubTitleStyle",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=9,
        leading=12,
        textColor=HexColor("#475569"),
        alignment=TA_LEFT
    )
    meta_label = ParagraphStyle(
        "MetaLabel",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=8,
        leading=10,
        textColor=HexColor("#64748B")
    )
    meta_val = ParagraphStyle(
        "MetaVal",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=8.5,
        leading=11,
        textColor=dark_gray
    )
    tbl_hdr = ParagraphStyle(
        "TblHdr",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=7.5,
        leading=9,
        textColor=colors.white,
        alignment=TA_CENTER
    )
    tbl_cell = ParagraphStyle(
        "TblCell",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=7.5,
        leading=9.5,
        textColor=dark_gray
    )
    tbl_cell_r = ParagraphStyle(
        "TblCellR",
        parent=tbl_cell,
        alignment=TA_RIGHT
    )
    tbl_cell_c = ParagraphStyle(
        "TblCellC",
        parent=tbl_cell,
        alignment=TA_CENTER
    )

    story = []

    # 1. Header Box
    header_data = [
        [
            Paragraph(f"<b>{company_name.upper()}</b>", title_style),
            Paragraph("<b>PLANILLA ANEXA DE RENDICIÓN</b><br/>Convenios Comerciales a Terceros", subtitle_style)
        ],
        [
            Paragraph(f"RUC: {company_ruc}", meta_val),
            Paragraph(f"Período Nómina: <b>{periodo}</b>", meta_val)
        ]
    ]
    t_header = Table(header_data, colWidths=[105 * mm, 77 * mm])
    t_header.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
        ("TOPPADDING", (0, 0), (-1, -1), 2),
    ]))
    story.append(t_header)
    story.append(Spacer(1, 4 * mm))
    story.append(HRFlowable(width="100%", thickness=1, color=border_color, spaceAfter=4 * mm))

    # 2. Beneficiary & Payment Metadata Box
    meta_box = [
        [
            Paragraph("<b>ACREEDOR / FIRMA BENEFICIARIA:</b>", meta_label),
            Paragraph(f"<b>{third_party_name.upper()}</b> (RUC: {third_party_ruc or 'S/RUC'})", meta_val),
        ],
        [
            Paragraph("<b>INSTRUMENTO DE PAGO:</b>", meta_label),
            Paragraph(
                f"Cheque N°: <b>{cheque_numero or 'A Designar'}</b> | Banco: <b>{banco_nombre or 'A Designar'}</b>",
                meta_val
            ),
        ],
        [
            Paragraph("<b>TOTAL RENDICIÓN GS.:</b>", meta_label),
            Paragraph(f"<b>₲ {int(total_monto):,}</b>".replace(",", "."), title_style),
        ]
    ]
    t_meta = Table(meta_box, colWidths=[55 * mm, 127 * mm])
    t_meta.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), light_bg),
        ("BOX", (0, 0), (-1, -1), 0.5, border_color),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, border_color),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
    ]))
    story.append(t_meta)
    story.append(Spacer(1, 5 * mm))

    # 3. Grid of Employees
    col_widths = [10 * mm, 22 * mm, 65 * mm, 45 * mm, 40 * mm]
    grid_rows = [
        [
            Paragraph("<b>N°</b>", tbl_hdr),
            Paragraph("<b>C.I.</b>", tbl_hdr),
            Paragraph("<b>COLABORADOR / FUNCIONARIO</b>", tbl_hdr),
            Paragraph("<b>REF. FACTURA / CRÉDITO</b>", tbl_hdr),
            Paragraph("<b>IMPORTE GS.</b>", tbl_hdr),
        ]
    ]

    for idx, emp in enumerate(employees, 1):
        amt = float(emp.get("amount", 0))
        grid_rows.append([
            Paragraph(str(idx), tbl_cell_c),
            Paragraph(str(emp.get("ci", "")), tbl_cell_c),
            Paragraph(str(emp.get("name") or emp.get("employee_name", "")).upper(), tbl_cell),
            Paragraph(str(emp.get("invoice_reference") or emp.get("ticket_ref") or "S/Ref"), tbl_cell),
            Paragraph(f"₲ {int(amt):,}".replace(",", "."), tbl_cell_r),
        ])

    # Totals Row
    grid_rows.append([
        Paragraph("<b>TOTAL</b>", tbl_cell_c),
        Paragraph("", tbl_cell),
        Paragraph(f"<b>{len(employees)} funcionarios</b>", tbl_cell),
        Paragraph("", tbl_cell),
        Paragraph(f"<b>₲ {int(total_monto):,}</b>".replace(",", "."), tbl_cell_r),
    ])

    t_grid = Table(grid_rows, colWidths=col_widths, repeatRows=1)
    t_grid.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), primary_color),
        ("ALIGN", (0, 0), (-1, -1), "LEFT"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, border_color),
        ("BOX", (0, 0), (-1, -1), 0.5, border_color),
        ("BACKGROUND", (0, -1), (-1, -1), HexColor("#F1F5F9")),
    ]))
    story.append(t_grid)
    story.append(Spacer(1, 8 * mm))

    # 4. Formal Receipt Signature Block
    sig_block = [
        [
            Paragraph(
                "<i>Recibí conforme el cheque de referencia y la presente planilla detallada de descuentos correspondientes al mes de nómina indicado.</i>",
                meta_val
            ),
            Paragraph("", meta_val)
        ],
        [
            Spacer(1, 14 * mm),
            Spacer(1, 14 * mm)
        ],
        [
            Paragraph("________________________________________<br/><b>FIRMA Y SELLO DE LA FIRMA EXTERNA</b><br/>Aclaración:<br/>C.I. N°:<br/>Fecha:", meta_val),
            Paragraph("________________________________________<br/><b>AUTORIZADO POR TESORERÍA / RRHH</b><br/>Extra Supermercado<br/>Fecha:", meta_val)
        ]
    ]
    t_sig = Table(sig_block, colWidths=[91 * mm, 91 * mm])
    t_sig.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 2),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
    ]))
    story.append(KeepTogether([t_sig]))

    doc.build(story)
    return buffer.getvalue()


async def execute_third_party_phase(
    db: AsyncSession,
    company_id: str,
    phase_id: str,
    cheque_numero: Optional[str] = None,
    banco_nombre: Optional[str] = None,
    user_id: Optional[str] = None
) -> Dict[str, Any]:
    """
    Executes a third-party phase:
    1. Creates a SupplierPaymentOrder for the creditor
    2. Generates the Annex PDF Rendition
    3. Links the payment order and updates the phase state
    """
    cid = uuid.UUID(company_id)
    pid = uuid.UUID(phase_id)
    uid = uuid.UUID(user_id) if user_id else None

    query = select(PayrollDossierPhase).where(
        PayrollDossierPhase.id == pid
    ).options(selectinload(PayrollDossierPhase.dossier))
    res = await db.execute(query)
    phase = res.scalars().first()
    if not phase:
        raise ValueError(f"Phase {phase_id} not found")

    metadata = phase.phase_metadata or {}
    third_party_name = metadata.get("third_party_name") or phase.phase_label or "Acreedor Tercero"
    third_party_ruc = metadata.get("third_party_ruc")
    employees = metadata.get("employees", [])
    total_monto = float(phase.monto or 0)
    periodo = phase.dossier.periodo if phase.dossier else "2026-10"

    # 1. Create SupplierPaymentOrder (considerando si incluye factura institucional)
    total_banco = float(metadata.get("total_transferencia_banco") or 0)
    gasto_factura = float(metadata.get("gasto_institucional_factura") or 0)
    factura_num = metadata.get("factura_numero")
    monto_op = total_banco if total_banco > 0 else total_monto
    obs_extra = f" (Incluye Factura Gasto N° {factura_num} por ₲ {gasto_factura:,.0f} | Retenciones: ₲ {total_monto:,.0f} | Total Transferencia: ₲ {monto_op:,.0f})" if gasto_factura > 0 else ""

    op_payload = SupplierPaymentOrderCreate(
        subtipo="convenio_tercero",
        beneficiario_nombre=third_party_name,
        beneficiario_documento=third_party_ruc,
        periodo_nomina=periodo,
        monto_neto=Decimal(str(int(monto_op))),
        observaciones=f"Pago consolidado convenio {third_party_name} - Nómina {periodo} ({len(employees)} funcionarios){obs_extra}",
        sueldok_sync_id=str(phase.id)
    )
    op_result = await financial_service.create_supplier_payment_order(
        db, company_id, op_payload, user_id=user_id
    )
    op_id = uuid.UUID(op_result["id"])

    # 2. Generate Annex PDF
    pdf_bytes = generate_third_party_annex_pdf(
        company_name="Extra Supermercado S.A.",
        company_ruc="80012345-6",
        third_party_name=third_party_name,
        third_party_ruc=third_party_ruc,
        periodo=periodo,
        cheque_numero=cheque_numero,
        banco_nombre=banco_nombre,
        employees=employees,
        total_monto=total_monto
    )

    # 3. Store PDF file locally or key
    reports_dir = "/tmp/payroll_reports"
    os.makedirs(reports_dir, exist_ok=True)
    clean_party = third_party_name.lower().replace(" ", "_").replace(".", "")
    filename = f"planilla_anexa_{clean_party}_{periodo}.pdf"
    filepath = os.path.join(reports_dir, filename)
    with open(filepath, "wb") as f:
        f.write(pdf_bytes)

    # 4. Update phase
    phase.estado = "ejecutado"
    phase.payment_order_id = op_id
    phase.pdf_storage_key = filepath
    phase.executed_at = datetime.now(timezone.utc)
    phase.executed_by = uid

    await db.commit()

    return {
        "status": "success",
        "phase_id": str(phase.id),
        "payment_order_id": str(op_id),
        "payment_order_numero": op_result.get("numero_orden"),
        "pdf_storage_key": filepath,
        "monto": total_monto,
        "beneficiario": third_party_name
    }


async def execute_ips_phase(
    db: AsyncSession,
    company_id: str,
    phase_id: str,
    user_id: Optional[str] = None,
    monto_ajustado: Optional[Decimal] = None,
    motivo_ajuste: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Executes the IPS phase:
    Creates a formal SupplierPaymentOrder for Instituto de Previsión Social
    with the combined 25.5% (or extraordinary adjusted amount if provided).
    """
    cid = uuid.UUID(company_id)
    pid = uuid.UUID(phase_id)
    uid = uuid.UUID(user_id) if user_id else None

    query = select(PayrollDossierPhase).where(
        PayrollDossierPhase.id == pid
    ).options(selectinload(PayrollDossierPhase.dossier))
    res = await db.execute(query)
    phase = res.scalars().first()
    if not phase:
        raise ValueError(f"Phase {phase_id} not found")

    metadata = dict(phase.phase_metadata or {})
    total_monto = float(phase.monto or 0)
    periodo = phase.dossier.periodo if phase.dossier else "2026-10"

    # Si se envía un monto ajustado extraordinario
    if monto_ajustado is not None and monto_ajustado > 0:
        monto_teorico = metadata.get("monto_teorico_calculado")
        if monto_teorico is None:
            monto_teorico = total_monto
            metadata["monto_teorico_calculado"] = monto_teorico
        metadata["monto_ajustado"] = float(monto_ajustado)
        metadata["motivo_ajuste"] = motivo_ajuste or "Ajuste extraordinario según extracto real IPS (bajas no procesadas)"
        metadata["diferencia_ajuste"] = float(monto_ajustado) - monto_teorico
        phase.phase_metadata = metadata
        phase.monto = monto_ajustado
        total_monto = float(monto_ajustado)

    obs = f"Aporte Previsional IPS Nómina {periodo} - 9% Obrero + 16.5% Patronal (Total: 25.5%). Vencimiento legal: {phase.fecha_vencimiento}"
    if metadata.get("monto_ajustado"):
        obs += f" | Ajuste extraordinario s/ extracto: {int(total_monto):,} Gs. (Teórico: {int(metadata.get('monto_teorico_calculado', 0)):,} Gs. - Motivo: {metadata.get('motivo_ajuste')})"

    # Create SupplierPaymentOrder for IPS
    op_payload = SupplierPaymentOrderCreate(
        subtipo="prevision_ips",
        beneficiario_nombre="Instituto de Previsión Social (IPS)",
        beneficiario_documento="80000000-0",
        periodo_nomina=periodo,
        monto_neto=Decimal(str(int(total_monto))),
        observaciones=obs,
        sueldok_sync_id=str(phase.id)
    )
    op_result = await financial_service.create_supplier_payment_order(
        db, company_id, op_payload, user_id=user_id
    )
    op_id = uuid.UUID(op_result["id"])

    phase.estado = "ejecutado"
    phase.payment_order_id = op_id
    phase.executed_at = datetime.now(timezone.utc)
    phase.executed_by = uid

    await db.commit()

    return {
        "status": "success",
        "phase_id": str(phase.id),
        "payment_order_id": str(op_id),
        "payment_order_numero": op_result.get("numero_orden"),
        "monto": total_monto,
        "beneficiario": "Instituto de Previsión Social (IPS)",
        "fecha_vencimiento": phase.fecha_vencimiento.isoformat() if phase.fecha_vencimiento else None,
        "metadata": metadata,
    }


async def adjust_ips_phase(
    db: AsyncSession,
    company_id: str,
    phase_id: str,
    monto_ajustado: Decimal,
    motivo_ajuste: Optional[str] = None,
    user_id: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Guarda un ajuste extraordinario sobre la fase de previsión IPS
    (ej. cuando la planilla emitida por IPS contiene funcionarios no dados de baja a tiempo).
    """
    cid = uuid.UUID(company_id)
    pid = uuid.UUID(phase_id)
    uid = uuid.UUID(user_id) if user_id else None

    query = select(PayrollDossierPhase).where(
        PayrollDossierPhase.id == pid
    ).options(selectinload(PayrollDossierPhase.dossier))
    res = await db.execute(query)
    phase = res.scalars().first()
    if not phase:
        raise ValueError(f"Phase {phase_id} not found")
    if phase.estado == "ejecutado":
        raise ValueError("No se puede ajustar una fase que ya fue ejecutada con Orden de Pago emitida")

    meta = dict(phase.phase_metadata or {})
    monto_teorico = meta.get("monto_teorico_calculado")
    if monto_teorico is None:
        monto_teorico = float(phase.monto or 0)
        meta["monto_teorico_calculado"] = monto_teorico

    meta["monto_ajustado"] = float(monto_ajustado)
    meta["motivo_ajuste"] = motivo_ajuste or "Ajuste extraordinario según extracto real IPS (bajas no procesadas)"
    meta["diferencia_ajuste"] = float(monto_ajustado) - monto_teorico
    meta["ajustado_at"] = datetime.now(timezone.utc).isoformat()
    if user_id:
        meta["ajustado_por"] = user_id

    phase.phase_metadata = meta
    phase.monto = monto_ajustado
    periodo = phase.dossier.periodo if phase.dossier else ""
    phase.phase_label = f"Aporte IPS {periodo} (Ajuste Extraordinario s/ Extracto Real)"

    await db.commit()

    return {
        "status": "success",
        "phase_id": str(phase.id),
        "monto_teorico": monto_teorico,
        "monto_ajustado": float(monto_ajustado),
        "diferencia": float(monto_ajustado) - monto_teorico,
        "motivo_ajuste": meta["motivo_ajuste"],
        "metadata": meta,
    }


async def revert_dossier_phase(
    db: AsyncSession,
    company_id: str,
    phase_id: str,
    user_id: Optional[str] = None
) -> Dict[str, Any]:
    """
    Revierte la ejecución de una fase del expediente de nómina (ej. Cafetería Malou, Credi Pora, etc.):
    1. Si tiene Orden de Pago asociada (SupplierPaymentOrder), la elimina si está en estado 'registrado'/'pendiente'.
    2. Restablece la fase a estado 'pendiente' y limpia referencias de ejecución.
    """
    cid = uuid.UUID(company_id)
    pid = uuid.UUID(phase_id)

    query = select(PayrollDossierPhase).where(
        PayrollDossierPhase.id == pid
    ).options(selectinload(PayrollDossierPhase.dossier))
    res = await db.execute(query)
    phase = res.scalars().first()
    if not phase:
        raise ValueError(f"Fase {phase_id} no encontrada")

    if phase.estado != "ejecutado":
        return {
            "status": "info",
            "message": "La fase ya se encuentra en estado pendiente",
            "phase_id": str(phase.id)
        }

    op_id = phase.payment_order_id
    if op_id:
        op_res = await db.execute(
            select(SupplierPaymentOrder).where(SupplierPaymentOrder.id == op_id)
        )
        op = op_res.scalars().first()
        if op:
            if op.estado in ("pagado", "conciliado"):
                raise ValueError("No se puede revertir la fase porque la Orden de Pago ya fue pagada/desembolsada en Tesorería.")
            await db.delete(op)

    # Limpiar fase
    phase.estado = "pendiente"
    phase.payment_order_id = None
    phase.executed_at = None
    phase.executed_by = None

    if phase.dossier and phase.dossier.estado == "completado":
        phase.dossier.estado = "en_proceso"

    await db.commit()

    return {
        "status": "success",
        "message": f"Fase '{phase.phase_label or phase.phase_type}' revertida a estado pendiente exitosamente.",
        "phase_id": str(phase.id)
    }


