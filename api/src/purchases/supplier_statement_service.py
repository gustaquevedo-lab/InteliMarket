"""Servicio de Extracto de Cuentas a Pagar y Libro Mayor de Cuenta Corriente por Proveedor.
Unifica cronológicamente Facturas de compra (débito), Notas de Crédito (crédito) y Pagos realizados (crédito),
calculando el saldo progresivo acumulado línea a línea e incorporando cheques diferidos en tránsito
para punteo físico de deudas y conciliación de saldos con proveedores.
"""
from __future__ import annotations

import logging
import uuid
from datetime import date, datetime
from typing import Dict, Any, List, Optional
from zoneinfo import ZoneInfo

from sqlalchemy import select, and_, or_, desc, asc
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.purchases.models import Supplier, SupplierNcRequest
from api.src.supermer.models import SupplierReturn as SupermerSupplierReturn
from api.src.financial.models import (
    SupplierInvoice, SupplierInvoicePayment,
    SupplierCreditNote, SupplierCreditNoteApplication,
    BankAccount
)
from api.src.cheques.models import Cheque

logger = logging.getLogger(__name__)
PY_TZ = ZoneInfo("America/Asuncion")


def _dec_to_float(v) -> float:
    if v is None:
        return 0.0
    try:
        return float(v)
    except Exception:
        return 0.0


def _date_str(d) -> str:
    if not d:
        return ""
    if isinstance(d, datetime):
        return d.astimezone(PY_TZ).strftime("%Y-%m-%d")
    if isinstance(d, date):
        return d.strftime("%Y-%m-%d")
    return str(d)[:10]


async def get_supplier_account_statement(
    db: AsyncSession,
    company_id: uuid.UUID,
    supplier_id: uuid.UUID,
    fecha_desde: Optional[date] = None,
    fecha_hasta: Optional[date] = None,
    solo_pendientes: bool = False,
    ordenar_por: str = "numero_factura",
) -> Dict[str, Any]:
    """Genera el estado de cuenta corriente cíclico del proveedor ordenado cronológicamente.
    
    Cada movimiento representa:
      - Débito (+): Factura de compra comercial.
      - Crédito (-): Nota de crédito recibida o Pago parcial/total realizado.
      - Saldo Progresivo (=): Saldo deudor acumulado tras la operación.
    """
    today = date.today()

    # 1. Proveedor
    q_sup = select(Supplier).where(Supplier.id == supplier_id, Supplier.company_id == company_id)
    sup_res = await db.execute(q_sup)
    supplier = sup_res.scalar_one_or_none()
    if not supplier:
        raise ValueError("Proveedor no encontrado")

    supplier_info = {
        "id": str(supplier.id),
        "razon_social": supplier.razon_social or "",
        "ruc": supplier.ruc or "",
        "ci": supplier.ci or "",
        "telefono": supplier.telefono or "",
        "email": supplier.email or "",
        "direccion": supplier.direccion or "",
        "contacto_nombre": supplier.contacto_nombre or "",
        "contacto_telefono": supplier.contacto_telefono or "",
        "banco": supplier.banco or "",
        "cuenta_bancaria": supplier.cuenta_bancaria or "",
        "plazo_pago_dias": supplier.plazo_pago_dias or 0,
        "moneda_default": supplier.moneda_default or "PYG",
    }

    # 2. Facturas de compra (SupplierInvoice)
    q_inv = select(SupplierInvoice).where(
        SupplierInvoice.company_id == company_id,
        SupplierInvoice.supplier_id == supplier_id,
        SupplierInvoice.estado != "cancelada",
    )
    inv_res = await db.execute(q_inv)
    invoices = inv_res.scalars().all()
    invoice_map = {inv.id: inv for inv in invoices}

    # 3. Notas de Crédito (SupplierCreditNote)
    q_nc = select(SupplierCreditNote).where(
        SupplierCreditNote.company_id == company_id,
        SupplierCreditNote.supplier_id == supplier_id,
        SupplierCreditNote.cancelado == False,
    )
    nc_res = await db.execute(q_nc)
    credit_notes = nc_res.scalars().all()

    # 3b. Aplicaciones formales de Notas de Crédito a Facturas
    q_nc_apps = (
        select(
            SupplierCreditNoteApplication.id,
            SupplierCreditNoteApplication.invoice_id,
            SupplierCreditNoteApplication.credit_note_id,
            SupplierCreditNoteApplication.monto_aplicado,
            SupplierCreditNoteApplication.fecha.label("fecha_aplicacion"),
            SupplierCreditNote.numero.label("nc_numero"),
            SupplierCreditNote.timbrado.label("nc_timbrado"),
            SupplierCreditNote.motivo.label("nc_motivo"),
            SupplierCreditNote.fecha.label("nc_fecha"),
        )
        .join(SupplierCreditNote, SupplierCreditNote.id == SupplierCreditNoteApplication.credit_note_id)
        .where(
            SupplierCreditNoteApplication.company_id == company_id,
            SupplierCreditNote.supplier_id == supplier_id,
            SupplierCreditNote.cancelado == False,
        )
    )
    nc_apps_res = await db.execute(q_nc_apps)
    nc_applications = nc_apps_res.all()
    nc_apps_by_inv: dict[uuid.UUID, list] = {}
    for a in nc_applications:
        nc_apps_by_inv.setdefault(a.invoice_id, []).append(a)

    # 4. Pagos realizados a facturas del proveedor
    inv_ids = [inv.id for inv in invoices]
    payments: List[SupplierInvoicePayment] = []
    pay_by_inv: dict[uuid.UUID, list] = {}
    if inv_ids:
        q_pay = select(SupplierInvoicePayment).where(
            SupplierInvoicePayment.invoice_id.in_(inv_ids),
            SupplierInvoicePayment.estado != "cancelado",
        )
        pay_res = await db.execute(q_pay)
        payments = pay_res.scalars().all()
        for p in payments:
            pay_by_inv.setdefault(p.invoice_id, []).append(p)

    # 5. Cheques emitidos al proveedor (para sección de valores en tránsito)
    q_chq = (
        select(Cheque, BankAccount.banco, BankAccount.numero_cuenta)
        .outerjoin(BankAccount, Cheque.bank_account_id == BankAccount.id)
        .where(
            Cheque.company_id == company_id,
            Cheque.supplier_id == supplier_id,
        )
        .order_by(Cheque.fecha_pago.asc(), Cheque.fecha_emision.desc())
    )
    chq_res = await db.execute(q_chq)
    cheques_rows = chq_res.all()

    cheques_transito = []
    cheques_diferidos_transito_monto = 0.0
    for c, b_nombre, b_cta in cheques_rows:
        monto_ch = _dec_to_float(c.monto)
        is_diferido = bool(c.diferido)
        estado_ch = (c.estado or "pendiente").lower()
        f_pago = c.fecha_pago or c.fecha_emision
        dias_rest = (f_pago - today).days if f_pago else 0

        banco_str = b_nombre or c.banco_emisor or "BANCO CONTINENTAL"
        if banco_str.lower() == "banco":
            banco_str = "BANCO CONTINENTAL"
        if b_cta:
            banco_str += f" ({b_cta})"

        # Cheques diferidos entregados aún pendientes de compensación
        if is_diferido and estado_ch in ("pendiente", "entregado"):
            cheques_diferidos_transito_monto += monto_ch
            cheques_transito.append({
                "id": str(c.id),
                "numero": c.numero or "S/N",
                "banco_emisor": banco_str,
                "monto": monto_ch,
                "moneda": c.moneda or "PYG",
                "fecha_emision": _date_str(c.fecha_emision),
                "fecha_pago": _date_str(c.fecha_pago),
                "dias_restantes": dias_rest,
                "concepto": c.concepto or "Pago a Proveedor",
                "estado": estado_ch.upper(),
            })

    # 5b. Solicitudes de Nota de Crédito (SNC) pendientes de entrega del proveedor
    q_snc = (
        select(SupplierNcRequest)
        .where(
            SupplierNcRequest.company_id == company_id,
            SupplierNcRequest.supplier_id == supplier_id,
            SupplierNcRequest.estado.in_(["pendiente_entrega", "entregada_parcial", "pendiente"]),
        )
        .order_by(SupplierNcRequest.created_at.desc())
    )
    snc_res = await db.execute(q_snc)
    snc_pendientes_rows = snc_res.scalars().all()

    solicitudes_nc_pendientes = []
    total_snc_reclamado_monto = 0.0
    for s in snc_pendientes_rows:
        m_rec = _dec_to_float(s.monto_reclamado)
        total_snc_reclamado_monto += m_rec
        solicitudes_nc_pendientes.append({
            "id": str(s.id),
            "numero_solicitud": s.numero_solicitud,
            "invoice_id": str(s.invoice_id),
            "factura_relacionada": invoice_map.get(s.invoice_id).numero_factura if invoice_map.get(s.invoice_id) else "",
            "tipo_motivo": s.tipo_motivo,
            "monto_reclamado": m_rec,
            "estado": s.estado,
            "observaciones": s.observaciones or "",
            "fecha": _date_str(s.created_at),
        })

    # 5c. Devoluciones Físicas de Mercadería con NCs pendientes de emisión (o saldo de cuotas)
    q_dev = (
        select(SupermerSupplierReturn)
        .where(
            SupermerSupplierReturn.company_id == company_id,
            SupermerSupplierReturn.proveedor_id == supplier_id,
            SupermerSupplierReturn.estado.in_(["autorizado", "pendiente", "acreditado_parcial", "parcial"]),
        )
        .order_by(SupermerSupplierReturn.fecha_creacion.desc())
    )
    dev_res = await db.execute(q_dev)
    dev_pendientes_rows = dev_res.scalars().all()

    for d in dev_pendientes_rows:
        val_est = _dec_to_float(d.valor_total_estimado)
        m_nc = _dec_to_float(d.nota_credito_monto)
        m_perd = _dec_to_float(d.monto_perdida)
        saldo_dev = max(0.0, val_est - m_nc - m_perd)
        if saldo_dev > 0:
            total_snc_reclamado_monto += saldo_dev
            solicitudes_nc_pendientes.append({
                "id": str(d.id),
                "numero_solicitud": d.codigo,
                "invoice_id": "",
                "factura_relacionada": f"DEV Física ({d.nota_credito_numero})" if d.nota_credito_numero else "Devolución en Depósito",
                "tipo_motivo": f"Devolución física ({d.tipo or 'devolucion'})",
                "monto_reclamado": saldo_dev,
                "estado": d.estado or "acreditado_parcial",
                "observaciones": d.observaciones or f"Saldo de NC pendiente ({d.codigo})",
                "fecha": _date_str(d.fecha_creacion),
            })

    # 6. Construir lista unificada de movimientos
    raw_movements = []

    # 6.1 Movimientos de Facturas (Débitos)
    for inv in invoices:
        f_emision = inv.fecha_emision or (inv.created_at.date() if inv.created_at else today)
        f_venc = inv.fecha_vencimiento
        monto_total = _dec_to_float(inv.total)
        saldo_pend = _dec_to_float(inv.saldo_pendiente if inv.saldo_pendiente is not None else inv.total)
        dias_venc = (today - f_venc).days if f_venc else 0
        es_vencida = dias_venc > 0 and saldo_pend > 0

        # Estado visual
        if saldo_pend <= 0:
            est_lbl = "Liquidada"
        elif saldo_pend < monto_total:
            est_lbl = "Pago Parcial"
        elif es_vencida:
            est_lbl = f"Vencida (+{dias_venc}d)"
        else:
            est_lbl = "Al Día"

        concepto_str = f"Compra mercaderías"
        if inv.condicion:
            concepto_str += f" ({inv.condicion.capitalize()})"
        if inv.concepto:
            concepto_str += f" - {inv.concepto}"

        raw_movements.append({
            "id": f"fac_{inv.id}",
            "entidad_id": str(inv.id),
            "fecha": f_emision,
            "fecha_str": _date_str(f_emision),
            "fecha_vencimiento_str": _date_str(f_venc),
            "tipo": "FACTURA",
            "tipo_badge": "FAC",
            "tipo_label": "Factura Compra",
            "comprobante": f"FAC {inv.numero_factura or 'S/N'}",
            "timbrado": inv.timbrado or "",
            "concepto": concepto_str,
            "debito": monto_total,
            "credito": 0.0,
            "saldo_documento": saldo_pend,
            "estado": est_lbl,
            "factura_relacionada": inv.numero_factura or "",
            "orden_dia": 1,  # Las facturas van primero en el mismo día
        })

    # 6.2 Movimientos de Notas de Crédito (Créditos)
    for cn in credit_notes:
        f_nc = cn.fecha or (cn.created_at.date() if cn.created_at else today)
        monto_nc = _dec_to_float(cn.monto)
        saldo_disp_nc = _dec_to_float(cn.saldo_disponible if cn.saldo_disponible is not None else 0.0)

        concepto_nc = f"Nota de Crédito"
        if cn.motivo:
            concepto_nc += f" - {cn.motivo}"
        if cn.numero_factura_origen:
            concepto_nc += f" [Afecta FAC {cn.numero_factura_origen}]"

        est_nc = "Disponible" if saldo_disp_nc > 0 else "Aplicada 100%"

        raw_movements.append({
            "id": f"nc_{cn.id}",
            "entidad_id": str(cn.id),
            "fecha": f_nc,
            "fecha_str": _date_str(f_nc),
            "fecha_vencimiento_str": "",
            "tipo": "NOTA_CREDITO",
            "tipo_badge": "NC",
            "tipo_label": "Nota de Crédito",
            "comprobante": f"NC {cn.numero or 'S/N'}",
            "timbrado": cn.timbrado or "",
            "concepto": concepto_nc,
            "debito": 0.0,
            "credito": monto_nc,
            "saldo_documento": saldo_disp_nc,
            "estado": est_nc,
            "factura_relacionada": cn.numero_factura_origen or "",
            "orden_dia": 2,  # NCs en segundo lugar
        })

    # 6.3 Movimientos de Pagos Realizados (Créditos monetarios efectivos)
    for pay in payments:
        metodo_raw = (pay.payment_method or "transferencia").strip().upper()
        # Si el método de pago es "NOTA DE CREDITO", no es una salida de fondos sino
        # la aplicación contable de una NC. Como las NCs ya están formalizadas en
        # la sección 6.2, se omite para evitar duplicar el crédito en el Libro Mayor.
        if metodo_raw in ("NOTA DE CREDITO", "NOTA_CREDITO", "NC"):
            continue

        f_pay = pay.fecha_pago or (pay.created_at.date() if pay.created_at else today)
        monto_pay = _dec_to_float(pay.monto)
        inv_asoc = invoice_map.get(pay.invoice_id)
        num_fac = inv_asoc.numero_factura if inv_asoc else "Factura S/N"

        metodo_lbl = (pay.payment_method or "transferencia").capitalize()
        concepto_pay = f"Pago a {num_fac} ({metodo_lbl})"
        if pay.referencia:
            concepto_pay += f" - Ref: {pay.referencia}"

        comp_pay = f"PAGO {metodo_lbl.upper()}"
        if pay.referencia:
            comp_pay += f" #{pay.referencia[:16]}"

        raw_movements.append({
            "id": f"pay_{pay.id}",
            "entidad_id": str(pay.id),
            "fecha": f_pay,
            "fecha_str": _date_str(f_pay),
            "fecha_vencimiento_str": "",
            "tipo": "PAGO",
            "tipo_badge": "PAGO",
            "tipo_label": f"Pago {metodo_lbl}",
            "comprobante": comp_pay,
            "timbrado": "",
            "concepto": concepto_pay,
            "debito": 0.0,
            "credito": monto_pay,
            "saldo_documento": 0.0,
            "estado": "Completado",
            "factura_relacionada": num_fac,
            "orden_dia": 3,  # Pagos en tercer lugar
        })

    # 6.4 Movimientos de Solicitudes de NC / Devoluciones pendientes en muelle
    for snc in snc_pendientes_rows:
        f_snc = snc.created_at.date() if snc.created_at else today
        m_rec = _dec_to_float(snc.monto_reclamado)
        fac_asoc = invoice_map.get(snc.invoice_id)
        num_fac = fac_asoc.numero_factura if fac_asoc else ""

        concepto_snc = f"Reclamo de mercadería {snc.numero_solicitud}"
        if snc.tipo_motivo:
            concepto_snc += f" ({snc.tipo_motivo.replace('_', ' ')})"
        if num_fac:
            concepto_snc += f" [Afecta FAC {num_fac}]"
        if snc.observaciones:
            concepto_snc += f" - {snc.observaciones}"

        raw_movements.append({
            "id": f"snc_{snc.id}",
            "entidad_id": str(snc.id),
            "fecha": f_snc,
            "fecha_str": _date_str(f_snc),
            "fecha_vencimiento_str": "",
            "tipo": "SOLICITUD_NC",
            "tipo_badge": "SNC",
            "tipo_label": "Devolución / Faltante Muelle",
            "comprobante": snc.numero_solicitud,
            "timbrado": "",
            "concepto": concepto_snc,
            "debito": 0.0,
            "credito": m_rec,
            "saldo_documento": m_rec,
            "estado": "Reclamado (Pendiente NC)",
            "factura_relacionada": num_fac,
            "orden_dia": 2,  # En segundo lugar al igual que NC
        })

    # 6.5 Movimientos de Devoluciones físicas con saldo de NC pendiente
    for d in dev_pendientes_rows:
        val_est = _dec_to_float(d.valor_total_estimado)
        m_nc = _dec_to_float(d.nota_credito_monto)
        m_perd = _dec_to_float(d.monto_perdida)
        saldo_dev = max(0.0, val_est - m_nc - m_perd)
        if saldo_dev > 0:
            f_dev = d.fecha_creacion.date() if d.fecha_creacion else today
            concepto_dev = f"Devolución {d.codigo} - Saldo de NC pendiente de recibir"
            if d.nota_credito_numero:
                concepto_dev += f" [NCs: {d.nota_credito_numero}]"
            if d.observaciones:
                concepto_dev += f" - {d.observaciones}"

            raw_movements.append({
                "id": f"dev_{d.id}",
                "entidad_id": str(d.id),
                "fecha": f_dev,
                "fecha_str": _date_str(f_dev),
                "fecha_vencimiento_str": "",
                "tipo": "SOLICITUD_NC",
                "tipo_badge": "DEV",
                "tipo_label": "Devolución Faltante / Salón",
                "comprobante": d.codigo,
                "timbrado": "",
                "concepto": concepto_dev,
                "debito": 0.0,
                "credito": saldo_dev,
                "saldo_documento": saldo_dev,
                "estado": "Acreditado Parcial (Pendiente NC)" if m_nc > 0 else "Reclamado (Pendiente NC)",
                "factura_relacionada": d.nota_credito_numero or "",
                "orden_dia": 2,
            })

    # 7. Ordenar cronológicamente (ascendente)
    raw_movements.sort(key=lambda m: (m["fecha"], m["orden_dia"], m["id"]))

    # 8. Calcular Saldo Progresivo y aplicar filtros de fecha
    saldo_acumulado = 0.0
    saldo_anterior = 0.0
    filtrados = []

    for m in raw_movements:
        m_fecha = m["fecha"]
        d = m["debito"]
        c = m["credito"]

        # Si hay filtro fecha_desde y el movimiento es anterior, alimenta el saldo inicial
        if fecha_desde and m_fecha < fecha_desde:
            saldo_anterior += (d - c)
            continue

        # Si hay filtro fecha_hasta y el movimiento es posterior, se omite
        if fecha_hasta and m_fecha > fecha_hasta:
            continue

        filtrados.append(m)

    # Iniciar saldo acumulado con el saldo anterior
    saldo_acumulado = saldo_anterior
    final_movements = []
    tot_debito = 0.0
    tot_nc = 0.0
    tot_snc = 0.0
    tot_pago = 0.0

    if solo_pendientes:
        # En modo "Solo Pendientes", la regla inmutable es:
        # 1. Las facturas pendientes muestran SIEMPRE su Monto Real Inmutable (debito = monto_total).
        # 2. Las Notas de Crédito aplicadas a estas facturas se muestran explícitamente como Crédito (-),
        #    con su número y concepto vinculado a la factura.
        # 3. Los pagos parciales aplicados a estas facturas se muestran explícitamente como Crédito (-).
        # 4. Las Notas de Crédito con saldo a favor disponible se muestran como Crédito (-) disponible.
        # De esta manera, el Débito coincide 100% con las facturas físicas del proveedor,
        # las NCs quedan totalmente auditables y NUNCA se descuentan dos veces.
        pendientes_list = []

        pending_invoices = [inv for inv in invoices if (inv.saldo_pendiente or 0) > 0]

        for inv in pending_invoices:
            f_emision = inv.fecha_emision or (inv.created_at.date() if inv.created_at else today)
            f_venc = inv.fecha_vencimiento
            monto_total = _dec_to_float(inv.total)
            saldo_pend = _dec_to_float(inv.saldo_pendiente if inv.saldo_pendiente is not None else inv.total)
            dias_venc = (today - f_venc).days if f_venc else 0
            es_vencida = dias_venc > 0 and saldo_pend > 0

            if saldo_pend < monto_total:
                est_lbl = "Pago Parcial"
            elif es_vencida:
                est_lbl = f"Vencida (+{dias_venc}d)"
            else:
                est_lbl = "Al Día"

            concepto_str = "Compra mercaderías"
            if inv.condicion:
                concepto_str += f" ({inv.condicion.capitalize()})"
            if inv.concepto:
                concepto_str += f" - {inv.concepto}"

            # 1. Movimiento de Factura con su Monto Original Inmutable
            pendientes_list.append({
                "id": f"fac_{inv.id}",
                "entidad_id": str(inv.id),
                "fecha": f_emision,
                "fecha_str": _date_str(f_emision),
                "fecha_vencimiento_str": _date_str(f_venc),
                "tipo": "FACTURA",
                "tipo_badge": "FAC",
                "tipo_label": "Factura Compra",
                "comprobante": f"FAC {inv.numero_factura or 'S/N'}",
                "timbrado": inv.timbrado or "",
                "concepto": concepto_str,
                "debito": monto_total,
                "credito": 0.0,
                "saldo_documento": saldo_pend,
                "estado": est_lbl,
                "factura_relacionada": inv.numero_factura or "",
                "orden_dia": 1,
                "punteado": False,
            })

            # 2. Notas de Crédito aplicadas a esta factura
            for app in nc_apps_by_inv.get(inv.id, []):
                f_app = app.nc_fecha or app.fecha_aplicacion or f_emision
                f_app_date = f_app.date() if hasattr(f_app, "date") else f_app
                pendientes_list.append({
                    "id": f"nc_app_{app.id}",
                    "entidad_id": str(app.credit_note_id),
                    "fecha": f_app_date,
                    "fecha_str": _date_str(f_app_date),
                    "fecha_vencimiento_str": "",
                    "tipo": "NOTA_CREDITO",
                    "tipo_badge": "NC",
                    "tipo_label": "Nota de Crédito",
                    "comprobante": f"NC {app.nc_numero or 'S/N'}",
                    "timbrado": app.nc_timbrado or "",
                    "concepto": f"Nota de Crédito - {app.nc_motivo or 'Deducción'} [Aplicada a FAC {inv.numero_factura}]",
                    "debito": 0.0,
                    "credito": _dec_to_float(app.monto_aplicado),
                    "saldo_documento": 0.0,
                    "estado": "Aplicada",
                    "factura_relacionada": inv.numero_factura or "",
                    "orden_dia": 2,
                    "punteado": False,
                })

            # 3. Pagos parciales aplicados a esta factura
            for pay in pay_by_inv.get(inv.id, []):
                f_pay = pay.fecha_pago or today
                pendientes_list.append({
                    "id": f"pay_{pay.id}",
                    "entidad_id": str(pay.id),
                    "fecha": f_pay,
                    "fecha_str": _date_str(f_pay),
                    "fecha_vencimiento_str": "",
                    "tipo": "PAGO",
                    "tipo_badge": "REC",
                    "tipo_label": "Pago Parcial",
                    "comprobante": f"REC {pay.referencia or 'PAGO'}",
                    "timbrado": "",
                    "concepto": f"Pago Parcial [Aplicado a FAC {inv.numero_factura}]",
                    "debito": 0.0,
                    "credito": _dec_to_float(pay.monto),
                    "saldo_documento": 0.0,
                    "estado": "Aplicado",
                    "factura_relacionada": inv.numero_factura or "",
                    "orden_dia": 3,
                    "punteado": False,
                })

        # 4. Notas de Crédito libres / disponibles a favor
        for cn in credit_notes:
            saldo_disp = _dec_to_float(cn.saldo_disponible if cn.saldo_disponible is not None else 0.0)
            if saldo_disp > 0:
                f_cn = cn.fecha or today
                pendientes_list.append({
                    "id": f"nc_free_{cn.id}",
                    "entidad_id": str(cn.id),
                    "fecha": f_cn,
                    "fecha_str": _date_str(f_cn),
                    "fecha_vencimiento_str": "",
                    "tipo": "NOTA_CREDITO",
                    "tipo_badge": "NC",
                    "tipo_label": "Nota de Crédito",
                    "comprobante": f"NC {cn.numero or 'S/N'}",
                    "timbrado": cn.timbrado or "",
                    "concepto": f"Nota de Crédito - {cn.motivo or 'Devolución de mercadería'} [Saldo disponible a favor]",
                    "debito": 0.0,
                    "credito": saldo_disp,
                    "saldo_documento": saldo_disp,
                    "estado": "Disponible",
                    "factura_relacionada": "",
                    "orden_dia": 2,
                    "punteado": False,
                })

        # 5. Solicitudes de NC si están pendientes
        for s in snc_pendientes_rows:
            f_snc = s.created_at.date() if s.created_at else today
            m_rec = _dec_to_float(s.monto_reclamado)
            pendientes_list.append({
                "id": f"snc_{s.id}",
                "entidad_id": str(s.id),
                "fecha": f_snc,
                "fecha_str": _date_str(f_snc),
                "fecha_vencimiento_str": "",
                "tipo": "SOLICITUD_NC",
                "tipo_badge": "SNC",
                "tipo_label": "Solicitud NC",
                "comprobante": f"SNC {s.numero_solicitud or 'S/N'}",
                "timbrado": "",
                "concepto": f"SNC Reclamada - {s.tipo_motivo or 'Discrepancia'}",
                "debito": 0.0,
                "credito": m_rec,
                "saldo_documento": m_rec,
                "estado": "Pendiente Entrega",
                "factura_relacionada": invoice_map.get(s.invoice_id).numero_factura if invoice_map.get(s.invoice_id) else "",
                "orden_dia": 2,
                "punteado": False,
            })

        # 6. Devoluciones físicas con saldo de NC pendiente
        for d in dev_pendientes_rows:
            val_est = _dec_to_float(d.valor_total_estimado)
            m_nc = _dec_to_float(d.nota_credito_monto)
            m_perd = _dec_to_float(d.monto_perdida)
            saldo_dev = max(0.0, val_est - m_nc - m_perd)
            if saldo_dev > 0:
                f_dev = d.fecha_creacion.date() if d.fecha_creacion else today
                concepto_dev = f"Devolución {d.codigo} - Saldo de NC pendiente"
                if d.nota_credito_numero:
                    concepto_dev += f" [NCs: {d.nota_credito_numero}]"

                pendientes_list.append({
                    "id": f"dev_{d.id}",
                    "entidad_id": str(d.id),
                    "fecha": f_dev,
                    "fecha_str": _date_str(f_dev),
                    "fecha_vencimiento_str": "",
                    "tipo": "SOLICITUD_NC",
                    "tipo_badge": "DEV",
                    "tipo_label": "Devolución Física",
                    "comprobante": f"DEV {d.codigo or 'S/N'}",
                    "timbrado": "",
                    "concepto": concepto_dev,
                    "debito": 0.0,
                    "credito": saldo_dev,
                    "saldo_documento": saldo_dev,
                    "estado": "Pendiente NC (Cuotas restantes)",
                    "factura_relacionada": d.nota_credito_numero or "",
                    "orden_dia": 2,
                    "punteado": False,
                })

        # Aplicar filtros de fecha si se proveyeron
        filtrados_pend = []
        for m in pendientes_list:
            if fecha_desde and m["fecha"] < fecha_desde:
                continue
            if fecha_hasta and m["fecha"] > fecha_hasta:
                continue
            filtrados_pend.append(m)

        # Ordenar pendientes
        if ordenar_por == "numero_factura":
            def _extract_invoice_sort_key(item):
                ref = (item.get("factura_relacionada") or item.get("comprobante") or "").strip()
                return (ref.lower(), item.get("orden_dia", 1), str(item.get("fecha", "")))

            filtrados_pend.sort(key=_extract_invoice_sort_key)
        else:
            filtrados_pend.sort(key=lambda m: (m["fecha"], m.get("orden_dia", 1), m["id"]))

        running = 0.0
        tot_debito = 0.0
        tot_nc = 0.0
        tot_snc = 0.0
        tot_pago = 0.0
        for item in filtrados_pend:
            d = item["debito"]
            c = item["credito"]
            running += (d - c)
            item["saldo_progresivo"] = running
            if item["tipo"] == "FACTURA":
                tot_debito += d
            elif item["tipo"] == "NOTA_CREDITO":
                tot_nc += c
            elif item["tipo"] == "SOLICITUD_NC":
                tot_snc += c
            elif item["tipo"] == "PAGO":
                tot_pago += c

        final_movements = filtrados_pend
        saldo_deudor_final = max(0.0, running)
        tot_credito = tot_nc + tot_pago + tot_snc
    else:
        for m in filtrados:
            d = m["debito"]
            c = m["credito"]
            saldo_acumulado += (d - c)

            if m["tipo"] == "FACTURA":
                tot_debito += d
            elif m["tipo"] == "NOTA_CREDITO":
                tot_nc += c
            elif m["tipo"] == "SOLICITUD_NC":
                tot_snc += c
            elif m["tipo"] == "PAGO":
                tot_pago += c

            m_copy = dict(m)
            m_copy["saldo_progresivo"] = saldo_acumulado
            m_copy["punteado"] = False

            final_movements.append(m_copy)

        if ordenar_por == "numero_factura":
            def _extract_invoice_sort_key_all(item):
                ref = (item.get("factura_relacionada") or item.get("comprobante") or "").strip()
                return (ref.lower(), str(item.get("fecha", "")))

            final_movements.sort(key=_extract_invoice_sort_key_all)

        tot_credito = tot_nc + tot_pago + tot_snc
        saldo_deudor_final = saldo_acumulado

    compromiso_total_con_cheques = saldo_deudor_final + cheques_diferidos_transito_monto
    saldo_neto_con_cheques = max(0.0, saldo_deudor_final - cheques_diferidos_transito_monto)

    return {
        "supplier": supplier_info,
        "periodo": {
            "fecha_desde": _date_str(fecha_desde) if fecha_desde else "",
            "fecha_hasta": _date_str(fecha_hasta) if fecha_hasta else "",
            "solo_pendientes": solo_pendientes,
            "ordenar_por": ordenar_por,
            "fecha_emision_reporte": _date_str(today),
        },
        "saldo_anterior": saldo_anterior,
        "movimientos": final_movements,
        "totales": {
            "total_facturas_debito": tot_debito,
            "total_nc_credito": tot_nc,
            "total_pagos_credito": tot_pago,
            "total_creditos": tot_credito,
            "saldo_deudor_final": saldo_deudor_final,
            "cheques_diferidos_transito_monto": cheques_diferidos_transito_monto,
            "cheques_diferidos_count": len(cheques_transito),
            "compromiso_total_con_cheques": compromiso_total_con_cheques,
            "saldo_neto_con_cheques": saldo_neto_con_cheques,
            "total_snc_reclamado_monto": total_snc_reclamado_monto,
            "snc_pendientes_count": len(solicitudes_nc_pendientes),
        },
        "cheques_diferidos": cheques_transito,
        "solicitudes_nc_pendientes": solicitudes_nc_pendientes,
        "resumen_items": {
            "total_movimientos": len(final_movements),
            "total_facturas": len([m for m in final_movements if m["tipo"] == "FACTURA"]),
            "total_ncs": len([m for m in final_movements if m["tipo"] == "NOTA_CREDITO"]),
            "total_pagos": len([m for m in final_movements if m["tipo"] == "PAGO"]),
            "total_sncs": len(solicitudes_nc_pendientes),
        }
    }
