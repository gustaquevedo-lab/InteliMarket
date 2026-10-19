"""SueldOK Payroll Non-Cash Deductions & Compensations Service

Processes internal offsets (Extra Club credit purchases, uniform costs)
via official internal collection receipts ('RETENCION_NOMINA') without
touching physical cash drawers (pos_sessions) or bank balances.
"""

from datetime import datetime, timezone, date
from decimal import Decimal
from typing import Optional, List, Dict, Any
import re
import uuid

from sqlalchemy import select, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from api.src.accounts_receivable.models import Account, ReceivablePayment, ReceivablePaymentAllocation
from api.src.customers.models import Customer
from api.src.sueldok.models import PayrollDossier, PayrollDossierPhase


def _clean_ci(ci: str) -> str:
    """Strip spaces, dots, dashes from CI for robust matching."""
    return re.sub(r"[^\w]", "", ci or "").strip()


async def process_payroll_compensations(
    db: AsyncSession,
    company_id: str,
    dossier_id: str,
    user_id: Optional[str] = None
) -> Dict[str, Any]:
    """
    Executes the compensation phases (Extra Club, Uniformes) of a PayrollDossier.
    Generates RC-NOMINA receipts for Extra Club and uniform debts,
    lowering accounts receivable balances without creating bank transactions
    or altering cash drawer sessions.
    """
    cid = company_id if isinstance(company_id, uuid.UUID) else uuid.UUID(str(company_id))
    did = dossier_id if isinstance(dossier_id, uuid.UUID) else uuid.UUID(str(dossier_id))
    uid = uuid.UUID(str(user_id)) if user_id else None

    # 1. Fetch dossier and its compensation phases
    query = (
        select(PayrollDossier)
        .options(selectinload(PayrollDossier.phases))
        .where(PayrollDossier.company_id == cid, PayrollDossier.id == did)
    )
    res = await db.execute(query)
    dossier = res.scalars().first()
    if not dossier:
        raise ValueError(f"Dossier {dossier_id} not found")

    comp_phases = [
        p for p in dossier.phases
        if p.phase_type == "compensacion_no_cash" or p.phase_type.startswith("compensacion_")
    ]
    if not comp_phases:
        raise ValueError(f"No hay fases de compensación en el expediente {dossier_id}")

    pending_phases = [p for p in comp_phases if p.estado != "ejecutado"]
    if not pending_phases:
        return {
            "status": "already_executed",
            "message": "Todas las fases de compensación ya fueron ejecutadas previamente.",
            "phase_ids": [str(p.id) for p in comp_phases],
        }

    all_items = []
    # Collect items from phase metadata
    for p in comp_phases:
        meta = p.phase_metadata or {}
        if p.phase_type in ("compensacion_extra_club", "compensacion_no_cash"):
            for item in meta.get("extra_club", []):
                all_items.append({**item, "tipo_concepto": "EXTRA_CLUB", "phase_id": str(p.id)})
        if p.phase_type in ("compensacion_uniformes", "compensacion_no_cash"):
            for item in meta.get("uniformes", []):
                all_items.append({**item, "tipo_concepto": "UNIFORME", "phase_id": str(p.id)})

    # Fallback: if uniformes items are in the extra_club phase metadata
    if not any(it.get("tipo_concepto") == "UNIFORME" for it in all_items):
        for p in comp_phases:
            meta = p.phase_metadata or {}
            for item in meta.get("uniformes", []):
                all_items.append({**item, "tipo_concepto": "UNIFORME", "phase_id": str(p.id)})

    # Scale UNIFORME items to match phase monto (e.g. 1.791.900)
    uni_phase = next((p for p in comp_phases if "uniforme" in p.phase_type), None)
    if uni_phase and uni_phase.monto:
        target_uni = float(uni_phase.monto)
        uni_items = [it for it in all_items if it.get("tipo_concepto") == "UNIFORME"]
        curr_uni_sum = sum(float(it.get("amount", 0)) for it in uni_items)
        if curr_uni_sum > 0 and abs(curr_uni_sum - target_uni) > 1:
            ratio = target_uni / curr_uni_sum
            for it in uni_items:
                it["amount"] = round(float(it.get("amount", 0)) * ratio)

    receipts_generated = []
    total_offset_amount = Decimal("0")

    for item in all_items:
        raw_ci = str(item.get("employee_ci") or item.get("ci") or "")
        clean_doc = _clean_ci(raw_ci)
        emp_name = item.get("employee_name") or item.get("name") or "Funcionario"
        amount = Decimal(str(int(item.get("amount", 0))))
        ticket_ref = item.get("ticket_ref") or "S/REF"
        concepto = item.get("tipo_concepto", "COMPENSACION")

        if amount <= 0:
            continue

        # 2. Find customer matching CI or extra_club_numero
        cust_query = select(Customer).where(
            Customer.company_id == cid,
            or_(
                Customer.ci == clean_doc,
                Customer.ci == raw_ci,
                Customer.extra_club_numero == clean_doc,
                Customer.ruc.ilike(f"%{clean_doc}%")
            )
        )
        cust_res = await db.execute(cust_query)
        customer = cust_res.scalars().first()

        if not customer:
            customer = Customer(
                company_id=cid,
                razon_social=emp_name,
                ci=clean_doc or "S/CI",
                extra_club_numero=clean_doc or None,
                tipo_persona="fisica",
                tipo="funcionario",
                credito_usado=0,
                activo=True
            )
            db.add(customer)
            await db.flush()

        # 3. Create ReceivablePayment (Official internal receipt)
        clean_periodo = dossier.periodo.replace("-", "")
        suffix = "-U" if concepto == "UNIFORME" else ""
        receipt_num = f"RC-NOMINA-{clean_periodo}-{clean_doc}{suffix}"

        rec_payment = ReceivablePayment(
            company_id=cid,
            customer_id=customer.id,
            monto_total=amount,
            moneda="PYG",
            forma_pago="RETENCION_NOMINA",
            referencia=f"Neteo Nómina {dossier.periodo} ({concepto}) - Ref: {ticket_ref}",
            fecha=date.today(),
            destino_fondos="compensacion_interna",
            numero_recibo=receipt_num,
            observaciones=f"Compensación interna nómina {dossier.periodo} por {concepto}. Funcionario: {emp_name} (CI: {raw_ci})",
            registrado_por=uid
        )
        db.add(rec_payment)
        await db.flush()

        # 4. Search open pending accounts to decrement balance
        ar_query = select(Account).where(
            Account.company_id == cid,
            Account.customer_id == customer.id,
            Account.estado == "pendiente"
        ).order_by(Account.fecha_vencimiento.asc(), Account.created_at.asc())
        ar_res = await db.execute(ar_query)
        open_accounts = ar_res.scalars().all()

        rem_to_apply = amount
        for acc in open_accounts:
            if rem_to_apply <= 0:
                break
            current_saldo = acc.saldo_pendiente or 0
            if current_saldo <= 0:
                continue

            alloc_amt = min(current_saldo, rem_to_apply)
            acc.saldo_pendiente = current_saldo - alloc_amt
            if acc.saldo_pendiente <= 0:
                acc.estado = "pagado"
                acc.saldo_pendiente = 0

            alloc = ReceivablePaymentAllocation(
                receivable_payment_id=rec_payment.id,
                accounts_receivable_id=acc.id,
                monto=alloc_amt
            )
            db.add(alloc)
            rem_to_apply -= alloc_amt

        if customer.credito_usado and customer.credito_usado > 0:
            customer.credito_usado = max(Decimal("0"), customer.credito_usado - amount)

        total_offset_amount += amount
        receipts_generated.append({
            "receipt_id": str(rec_payment.id),
            "numero_recibo": receipt_num,
            "customer_id": str(customer.id),
            "employee_name": emp_name,
            "ci": raw_ci,
            "monto": float(amount),
            "concepto": concepto,
            "ticket_ref": ticket_ref
        })

    # 5. Mark pending phases as executed and attach receipts
    for p in pending_phases:
        p.estado = "ejecutado"
        p.executed_at = datetime.now(timezone.utc)
        p.executed_by = uid
        meta = p.phase_metadata or {}
        meta["recibos_generados"] = receipts_generated
        p.phase_metadata = meta
        if receipts_generated:
            p.collection_receipt_id = uuid.UUID(receipts_generated[0]["receipt_id"])

    await db.commit()

    return {
        "status": "success",
        "phase_ids": [str(p.id) for p in pending_phases],
        "total_compensado": float(total_offset_amount),
        "recibos_count": len(receipts_generated),
        "recibos": receipts_generated,
        "dossier_id": str(dossier.id),
        "periodo": dossier.periodo
    }


async def process_settlement_compensation(
    db: AsyncSession,
    company_id: str,
    employee_nombre: str,
    employee_ci: str | None,
    monto_extra_club: Decimal,
    referencia: str = "Finiquito Laboral",
    user_id: Optional[str] = None
) -> Optional[ReceivablePayment]:
    """
    Extingue formalmente las Cuentas por Cobrar (vales/compras Extra Club)
    de un colaborador desvinculado mediante un Recibo Oficial de Cobranza Interno.
    """
    if monto_extra_club <= Decimal("0"):
        return None

    cid = uuid.UUID(company_id)
    uid = uuid.UUID(user_id) if user_id else None
    raw_ci = str(employee_ci or "")
    clean_doc = _clean_ci(raw_ci)

    # 1. Buscar o crear cliente del empleado
    cust_query = select(Customer).where(
        Customer.company_id == cid,
        or_(
            Customer.ci == clean_doc,
            Customer.ci == raw_ci,
            Customer.extra_club_numero == clean_doc,
            Customer.ruc.ilike(f"%{clean_doc}%")
        )
    )
    cust_res = await db.execute(cust_query)
    customer = cust_res.scalars().first()

    if not customer:
        customer = Customer(
            company_id=cid,
            razon_social=employee_nombre,
            ci=clean_doc or "S/CI",
            extra_club_numero=clean_doc or None,
            tipo_persona="fisica",
            tipo="funcionario",
            credito_usado=0,
            activo=True
        )
        db.add(customer)
        await db.flush()

    # 2. Emitir Recibo Oficial de Cobranza Interno
    clean_fecha = date.today().strftime("%Y%m%d")
    receipt_num = f"RC-FINIQUITO-{clean_fecha}-{clean_doc or 'COL'}"

    rec_payment = ReceivablePayment(
        company_id=cid,
        customer_id=customer.id,
        monto_total=monto_extra_club,
        moneda="PYG",
        forma_pago="RETENCION_NOMINA",
        referencia=f"Compensación Finiquito - {referencia}",
        fecha=date.today(),
        destino_fondos="compensacion_interna",
        numero_recibo=receipt_num,
        observaciones=f"Compensación y extinción formal de deudas comerciales por finiquito laboral. Colaborador: {employee_nombre} (CI: {raw_ci})",
        registrado_por=uid
    )
    db.add(rec_payment)
    await db.flush()

    # 3. Amortizar Cuentas por Cobrar abiertas (vales / créditos impagos)
    ar_query = select(Account).where(
        Account.company_id == cid,
        Account.customer_id == customer.id,
        Account.estado == "pendiente"
    ).order_by(Account.fecha_vencimiento.asc(), Account.created_at.asc())
    ar_res = await db.execute(ar_query)
    open_accounts = ar_res.scalars().all()

    rem_to_apply = monto_extra_club
    for acc in open_accounts:
        if rem_to_apply <= 0:
            break
        current_saldo = acc.saldo_pendiente or 0
        if current_saldo <= 0:
            continue

        alloc_amt = min(current_saldo, rem_to_apply)
        acc.saldo_pendiente = current_saldo - alloc_amt
        if acc.saldo_pendiente <= 0:
            acc.estado = "pagado"
            acc.saldo_pendiente = 0

        alloc = ReceivablePaymentAllocation(
            receivable_payment_id=rec_payment.id,
            accounts_receivable_id=acc.id,
            monto=alloc_amt
        )
        db.add(alloc)
        rem_to_apply -= alloc_amt

    # Actualizar crédito usado del cliente
    if customer.credito_usado and customer.credito_usado > 0:
        customer.credito_usado = max(Decimal("0"), customer.credito_usado - monto_extra_club)

    await db.flush()
    return rec_payment


async def get_dossier_compensations_pdf(
    db: AsyncSession,
    company_id: str,
    dossier_id: str,
    user_name: str = ""
) -> bytes:
    """
    Genera el Comprobante y Planilla Oficial en PDF de las Compensaciones No-Cash
    (Extra Club y Uniformes) con detalle de recibos oficiales RC-NOMINA.
    """
    import io
    from reportlab.lib.units import mm
    from reportlab.lib.styles import ParagraphStyle
    from reportlab.lib.enums import TA_RIGHT, TA_CENTER
    from reportlab.platypus import Paragraph, Spacer, Table, TableStyle, HRFlowable, KeepTogether
    from reportlab.lib.colors import HexColor
    from reportlab.graphics.barcode import qr
    from reportlab.graphics.shapes import Drawing

    from api.src.integrated_finance.pdf_reports import (
        _base_doc, _logo_flowable, _fmt_gs, _accent_bar,
        PRIMARY_COLOR, GRAY_LIGHT, GRAY_MEDIUM, GRAY_DARK, WHITE, RED, GREEN,
        FONT_REGULAR, FONT_BOLD, PY_TZ,
    )

    cid = company_id if isinstance(company_id, uuid.UUID) else uuid.UUID(str(company_id))
    did = dossier_id if isinstance(dossier_id, uuid.UUID) else uuid.UUID(str(dossier_id))

    company = {
        "razon_social": "GRUPO SANTA TERESA E.A.S.",
        "nombre_fantasia": "Extra Supermercado Mayorista",
        "ruc": "80150377-9",
        "direccion": "Alejo Garcia esq. Carlos Antonio López",
        "ciudad": "Pedro Juan Caballero",
        "logo_url": None
    }

    # 1. Obtener dossier y fases
    query = (
        select(PayrollDossier)
        .options(selectinload(PayrollDossier.phases))
        .where(PayrollDossier.company_id == cid, PayrollDossier.id == did)
    )
    res = await db.execute(query)
    dossier = res.scalars().first()
    if not dossier:
        raise ValueError(f"Expediente {dossier_id} no encontrado")

    comp_phases = [
        p for p in dossier.phases
        if p.phase_type == "compensacion_no_cash" or p.phase_type.startswith("compensacion_")
    ]
    if not comp_phases:
        raise ValueError(f"No hay fases de compensación en el expediente {dossier_id}")

    # 2. Obtener lista de recibos/imputaciones
    clean_periodo = dossier.periodo.replace("-", "")
    rc_query = select(ReceivablePayment).where(
        ReceivablePayment.company_id == cid,
        ReceivablePayment.numero_recibo.like(f"RC-NOMINA-{clean_periodo}%")
    ).order_by(ReceivablePayment.created_at.asc())
    rc_res = await db.execute(rc_query)
    payments = rc_res.scalars().all()

    items = []
    tot_extra_club = Decimal("0")
    tot_uniformes = Decimal("0")

    if payments:
        for p in payments:
            concepto = "UNIFORME" if "-U" in (p.numero_recibo or "") else "EXTRA_CLUB"
            obs = p.observaciones or ""
            # Extract employee name
            emp_name = "Funcionario"
            ci_val = ""
            if "Funcionario:" in obs:
                parts = obs.split("Funcionario:")[1].split("(CI:")
                emp_name = parts[0].strip()
                if len(parts) > 1:
                    ci_val = parts[1].replace(")", "").strip()
            items.append({
                "numero_recibo": p.numero_recibo,
                "empleado": emp_name,
                "ci": ci_val,
                "concepto": "Uniformes" if concepto == "UNIFORME" else "Consumo Extra Club",
                "monto": p.monto_total,
                "estado": "COMPENSADO"
            })
            if concepto == "UNIFORME":
                tot_uniformes += p.monto_total
            else:
                tot_extra_club += p.monto_total
    else:
        # Previsualización a partir de la metadata de las fases
        for p in comp_phases:
            meta = p.phase_metadata or {}
            for it in meta.get("extra_club", []):
                amt = Decimal(str(int(it.get("amount", 0))))
                ci_str = str(it.get("employee_ci") or it.get("ci") or "")
                items.append({
                    "numero_recibo": f"RC-NOMINA-{clean_periodo}-{_clean_ci(ci_str)}",
                    "empleado": it.get("employee_name") or it.get("name") or "Funcionario",
                    "ci": ci_str,
                    "concepto": "Consumo Extra Club",
                    "monto": amt,
                    "estado": "PLANIFICADO"
                })
                tot_extra_club += amt
            for it in meta.get("uniformes", []):
                amt = Decimal(str(int(it.get("amount", 0))))
                ci_str = str(it.get("employee_ci") or it.get("ci") or "")
                items.append({
                    "numero_recibo": f"RC-NOMINA-{clean_periodo}-{_clean_ci(ci_str)}-U",
                    "empleado": it.get("employee_name") or it.get("name") or "Funcionario",
                    "ci": ci_str,
                    "concepto": "Uniformes",
                    "monto": amt,
                    "estado": "PLANIFICADO"
                })
                tot_uniformes += amt

        # Escalar uniformes a monto oficial (ej 1.791.900)
        uni_ph = next((p for p in comp_phases if "uniforme" in p.phase_type), None)
        if uni_ph and uni_ph.monto:
            tot_uniformes = Decimal(str(int(uni_ph.monto)))

    tot_general = tot_extra_club + tot_uniformes

    # 3. Construir PDF con ReportLab
    buffer = io.BytesIO()
    doc, styles = _base_doc(buffer, f"Compensaciones_{dossier.periodo}", company, user_name)
    elements = []

    now_py = datetime.now(PY_TZ).strftime("%d/%m/%Y %H:%M")
    logo = _logo_flowable(company, max_w=40 * mm, max_h=14 * mm)
    razon_social = company.get("razon_social")
    nombre_fantasia = company.get("nombre_fantasia")
    ruc_empresa = company.get("ruc")

    empresa_text = (
        f"<font size=10.5 color='#002B49'><b>{nombre_fantasia}</b></font><br/>"
        f"<font size=8 color='#475569'>{razon_social} • RUC: <b>{ruc_empresa}</b></font><br/>"
        f"<font size=7 color='#64748B'>{company.get('direccion')} — {company.get('ciudad')}</font>"
    )

    sub_text = (
        f"<font size=7.5 color='#64748B'>CONTROL FINANCIERO DE NÓMINA</font><br/>"
        f"<font size=10.5 color='#002B49'><b>PLANILLA DE COMPENSACIONES NO-CASH</b></font><br/>"
        f"<font size=9.5 color='#059669'><b>Período: {dossier.periodo}</b></font><br/>"
        f"<font size=7 color='#475569'>Emisión: {now_py}</font>"
    )

    header_table = Table(
        [[
            logo or Paragraph(f"<b>{nombre_fantasia}</b>", styles["Normal"]),
            Paragraph(empresa_text, styles["Normal"]),
            Paragraph(sub_text, ParagraphStyle("Right", parent=styles["Normal"], alignment=TA_RIGHT))
        ]],
        colWidths=[42 * mm, 78 * mm, 62 * mm]
    )
    header_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
    ]))
    elements.append(header_table)
    elements.append(Spacer(1, 3 * mm))
    elements.append(_accent_bar(w=182 * mm, h=1.5 * mm))
    elements.append(Spacer(1, 3.5 * mm))

    # Resumen de Compensaciones
    summary_data = [
        [
            Paragraph("<b>Concepto de Neteo</b>", styles["Normal"]),
            Paragraph("<b>Alcance Operativo</b>", styles["Normal"]),
            Paragraph("<b>Total Compensado</b>", ParagraphStyle("R", parent=styles["Normal"], alignment=TA_RIGHT))
        ],
        [
            Paragraph("<b>Compras a Crédito Extra Club</b>", styles["Normal"]),
            Paragraph("Vales de consumo supermercado compensados contra salarios", styles["Normal"]),
            Paragraph(f"<b>{_fmt_gs(tot_extra_club)}</b>", ParagraphStyle("R", parent=styles["Normal"], alignment=TA_RIGHT))
        ],
        [
            Paragraph("<b>Descuento por Uniformes</b>", styles["Normal"]),
            Paragraph("Cuotas de uniformes autorizadas descontadas de haberes", styles["Normal"]),
            Paragraph(f"<b>{_fmt_gs(tot_uniformes)}</b>", ParagraphStyle("R", parent=styles["Normal"], alignment=TA_RIGHT))
        ],
        [
            Paragraph("<b>TOTAL COMPENSACIONES NO-CASH</b>", styles["Normal"]),
            Paragraph("<b>Blindaje de tesorería: Cero impacto en gavetas ni bancos</b>", styles["Normal"]),
            Paragraph(f"<font color='#059669'><b>{_fmt_gs(tot_general)}</b></font>", ParagraphStyle("R", parent=styles["Normal"], alignment=TA_RIGHT))
        ]
    ]
    summary_table = Table(summary_data, colWidths=[60 * mm, 78 * mm, 44 * mm])
    summary_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), HexColor("#F1F5F9")),
        ("BACKGROUND", (0, -1), (-1, -1), HexColor("#ECFDF5")),
        ("TEXTCOLOR", (0, 0), (-1, 0), PRIMARY_COLOR),
        ("GRID", (0, 0), (-1, -1), 0.5, GRAY_LIGHT),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("FONTNAME", (0, 0), (-1, 0), FONT_BOLD),
        ("FONTSIZE", (0, 0), (-1, -1), 8),
    ]))
    elements.append(summary_table)
    elements.append(Spacer(1, 4 * mm))

    # Tabla Detallada de Recibos RC-NOMINA
    detail_header = [
        Paragraph("<b>N°</b>", styles["Normal"]),
        Paragraph("<b>Recibo Oficial</b>", styles["Normal"]),
        Paragraph("<b>Colaborador / Funcionario</b>", styles["Normal"]),
        Paragraph("<b>C.I. N°</b>", styles["Normal"]),
        Paragraph("<b>Concepto</b>", styles["Normal"]),
        Paragraph("<b>Monto (Gs.)</b>", ParagraphStyle("R", parent=styles["Normal"], alignment=TA_RIGHT)),
        Paragraph("<b>Estado</b>", ParagraphStyle("C", parent=styles["Normal"], alignment=TA_CENTER))
    ]
    detail_rows = [detail_header]
    for idx, it in enumerate(items[:60], start=1):
        detail_rows.append([
            Paragraph(str(idx), styles["Normal"]),
            Paragraph(f"<font size=7 color='#0284C7'><b>{it['numero_recibo']}</b></font>", styles["Normal"]),
            Paragraph(it["empleado"][:26], styles["Normal"]),
            Paragraph(it["ci"] or "—", styles["Normal"]),
            Paragraph(it["concepto"], styles["Normal"]),
            Paragraph(f"<b>{_fmt_gs(it['monto'])}</b>", ParagraphStyle("R", parent=styles["Normal"], alignment=TA_RIGHT)),
            Paragraph(f"<font size=7 color='#059669'><b>{it['estado']}</b></font>", ParagraphStyle("C", parent=styles["Normal"], alignment=TA_CENTER))
        ])

    detail_table = Table(detail_rows, colWidths=[8 * mm, 38 * mm, 50 * mm, 20 * mm, 30 * mm, 22 * mm, 14 * mm])
    detail_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), HexColor("#002B49")),
        ("TEXTCOLOR", (0, 0), (-1, 0), WHITE),
        ("GRID", (0, 0), (-1, -1), 0.4, GRAY_LIGHT),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [WHITE, HexColor("#F8FAFC")]),
        ("TOPPADDING", (0, 0), (-1, -1), 2),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
        ("FONTSIZE", (0, 0), (-1, -1), 7.5),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE")
    ]))
    elements.append(detail_table)
    elements.append(Spacer(1, 4 * mm))

    # Cláusula legal de descargo
    cert_text = (
        "<b>CERTIFICACIÓN DE COMPENSACIÓN INTERNA:</b> Se hace constar que los créditos comerciales Extra Club "
        "y descuentos por uniformes individualizados en la presente nómina han sido cancelados y extinguidos en su "
        "totalidad mediante afectación directa a la nómina de haberes de los funcionarios señalados, generándose los "
        "respectivos Recibos Oficiales de Cobranza Interna (RC-NOMINA) y amortizándose los saldos de Cuentas por Cobrar. "
        "La presente operación no representa egreso de caja física ni desembolso de cuentas bancarias."
    )
    elements.append(Paragraph(f"<font size=6.5 color='#475569'>{cert_text}</font>", styles["Normal"]))
    elements.append(Spacer(1, 6 * mm))

    # Firmas
    signatures_data = [
        [
            Paragraph("____________________________<br/><b>Tesorería & Finanzas</b><br/><font size=6.5 color='#64748B'>Extra Supermercado</font>", ParagraphStyle("C", parent=styles["Normal"], alignment=TA_CENTER)),
            Paragraph("____________________________<br/><b>Recursos Humanos</b><br/><font size=6.5 color='#64748B'>Elaboración de Planilla</font>", ParagraphStyle("C", parent=styles["Normal"], alignment=TA_CENTER)),
            Paragraph("____________________________<br/><b>Gerencia Administrativa</b><br/><font size=6.5 color='#64748B'>Conformidad y Aprobación</font>", ParagraphStyle("C", parent=styles["Normal"], alignment=TA_CENTER))
        ]
    ]
    sig_table = Table(signatures_data, colWidths=[60 * mm, 60 * mm, 62 * mm])
    sig_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 2),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
    ]))
    elements.append(KeepTogether([sig_table]))

    doc.build(elements)
    return buffer.getvalue()
