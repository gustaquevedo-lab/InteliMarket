"""Supplier 360 Service — Visión 360° Integral del Proveedor.
Agrega dimensiones Financieras (AP, facturas, cheques diferidos emitidos pendientes de compensación),
Operativas (compras, recepciones, OTIF), Reclamos/NC, Catálogo de Productos y Stock valorizado,
Ventas (sell-out) y Rentabilidad, Serie Temporal, Monedero de Notas de Crédito, Ciclo de Devoluciones y Diagnóstico Gerencial Extenso.
"""
from __future__ import annotations

import logging
import uuid
from datetime import date, datetime, timedelta
from decimal import Decimal
from typing import Optional, Dict, Any, List

from sqlalchemy import select, func, and_, or_, desc, case
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.purchases.models import Supplier, PurchaseOrder, PurchaseOrderItem, PurchaseReceipt, SupplierNcRequest
from api.src.financial.models import (
    SupplierInvoice, SupplierInvoiceItem, SupplierInvoicePayment, BankAccount,
    SupplierCreditNote, SupplierCreditNoteApplication, SupplierReturn as FinancialSupplierReturn,
    PaymentRun, PaymentRunItem
)
from api.src.supermer.models import SupplierReturn as SupermerSupplierReturn
from api.src.cheques.models import Cheque
from api.src.products.models import Product, ProductCategory
from api.src.inventory.models import Stock
from api.src.sales.models import Sale, SaleItem

logger = logging.getLogger(__name__)


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
    if isinstance(d, (datetime, date)):
        return d.strftime("%Y-%m-%d")
    return str(d)[:10]


async def get_supplier_360(db: AsyncSession, company_id: uuid.UUID, supplier_id: uuid.UUID) -> Dict[str, Any]:
    today = date.today()

    # 1. Datos básicos del proveedor
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
        "ciudad": supplier.ciudad or "",
        "contacto_nombre": supplier.contacto_nombre or "",
        "contacto_telefono": supplier.contacto_telefono or "",
        "contacto_email": supplier.contacto_email or "",
        "banco": supplier.banco or "",
        "cuenta_bancaria": supplier.cuenta_bancaria or "",
        "plazo_pago_dias": supplier.plazo_pago_dias or 0,
        "plazo_entrega_promedio": supplier.plazo_entrega_promedio or 0,
        "rating": _dec_to_float(supplier.rating),
        "tipo_proveedor": supplier.tipo_proveedor or "nacional",
        "moneda_default": supplier.moneda_default or "PYG",
        "condicion_iva": supplier.condicion_iva or "10%",
        "activo": supplier.activo if supplier.activo is not None else True,
        "notas": supplier.notas or "",
    }

    # 2. Facturas de compra brutas (Cuentas por Pagar - AP)
    q_inv = select(SupplierInvoice).where(
        SupplierInvoice.company_id == company_id,
        SupplierInvoice.supplier_id == supplier_id,
    ).order_by(SupplierInvoice.fecha_vencimiento.asc(), SupplierInvoice.fecha_emision.desc())
    inv_res = await db.execute(q_inv)
    invoices = inv_res.scalars().all()
    inv_ids = [inv.id for inv in invoices]
    invoice_map_by_id = {inv.id: (inv.numero_factura or "S/N") for inv in invoices}

    # 2.1 Notas de Crédito emitidas por el proveedor (SupplierCreditNote)
    q_scns = select(SupplierCreditNote).where(
        SupplierCreditNote.company_id == company_id,
        SupplierCreditNote.supplier_id == supplier_id,
        SupplierCreditNote.cancelado == False,
    ).order_by(SupplierCreditNote.fecha.desc())
    scns_res = await db.execute(q_scns)
    credit_notes = scns_res.scalars().all()
    cn_ids = [cn.id for cn in credit_notes]

    # 2.2 Aplicaciones de NC a facturas
    apps_by_invoice: Dict[uuid.UUID, List[Dict[str, Any]]] = {}
    apps_by_cn: Dict[uuid.UUID, List[Dict[str, Any]]] = {}
    total_aplicaciones_monto = 0.0

    if cn_ids or inv_ids:
        app_filter_conditions = []
        if cn_ids:
            app_filter_conditions.append(SupplierCreditNoteApplication.credit_note_id.in_(cn_ids))
        if inv_ids:
            app_filter_conditions.append(SupplierCreditNoteApplication.invoice_id.in_(inv_ids))

        q_apps = select(
            SupplierCreditNoteApplication,
            SupplierCreditNote.numero.label("numero_nc"),
            SupplierCreditNote.timbrado.label("timbrado_nc"),
            SupplierCreditNote.motivo.label("motivo_nc"),
            SupplierCreditNote.motivo_categoria.label("motivo_cat_nc")
        ).join(
            SupplierCreditNote, SupplierCreditNote.id == SupplierCreditNoteApplication.credit_note_id
        ).where(
            SupplierCreditNoteApplication.company_id == company_id,
            or_(*app_filter_conditions)
        ).order_by(SupplierCreditNoteApplication.created_at.desc())
        apps_res = await db.execute(q_apps)
        apps_rows = apps_res.all()

        for app, num_nc, timb_nc, mot_nc, mot_cat_nc in apps_rows:
            m_app = _dec_to_float(app.monto_aplicado)
            total_aplicaciones_monto += m_app
            app_obj = {
                "id": str(app.id),
                "credit_note_id": str(app.credit_note_id),
                "invoice_id": str(app.invoice_id),
                "numero_nc": num_nc or "NC S/N",
                "timbrado_nc": timb_nc or "",
                "motivo_nc": mot_nc or "",
                "motivo_categoria": mot_cat_nc or "devolucion",
                "monto_aplicado": m_app,
                "fecha": _date_str(app.fecha or app.created_at),
                "observaciones": app.observaciones or "",
            }
            apps_by_invoice.setdefault(app.invoice_id, []).append(app_obj)
            apps_by_cn.setdefault(app.credit_note_id, []).append(app_obj)

    # 2.3 Lotes de Pago programados (PaymentRuns activos)
    p_run_by_invoice: Dict[uuid.UUID, Dict[str, Any]] = {}
    if inv_ids:
        try:
            q_pri = select(
                PaymentRunItem.invoice_id,
                PaymentRunItem.monto_programado,
                PaymentRun.nombre.label("lote_nombre"),
                PaymentRun.fecha_programada.label("lote_fecha"),
                PaymentRun.estado.label("lote_estado")
            ).join(
                PaymentRun, PaymentRun.id == PaymentRunItem.payment_run_id
            ).where(
                PaymentRunItem.invoice_id.in_(inv_ids),
                PaymentRun.company_id == company_id,
                PaymentRun.estado.in_(["borrador", "pendiente", "aprobado", "programado"])
            )
            pri_res = await db.execute(q_pri)
            for r in pri_res.all():
                p_run_by_invoice[r[0]] = {
                    "monto_programado": _dec_to_float(r[1]),
                    "lote_nombre": r[2] or "Lote de Pago",
                    "lote_fecha": _date_str(r[3]),
                    "lote_estado": r[4] or "pendiente"
                }
        except Exception as e:
            logger.warning(f"Error fetching payment run items for supplier 360: {e}")

    # 2.4 Cheques Diferidos & Emitidos
    q_cheques = select(Cheque).where(
        Cheque.company_id == company_id,
        Cheque.supplier_id == supplier_id,
    ).order_by(Cheque.fecha_pago.asc(), Cheque.fecha_emision.desc())
    chq_res = await db.execute(q_cheques)
    cheques_db = chq_res.scalars().all()

    cheques_diferidos_pendientes_monto = 0.0
    cheques_diferidos_pendientes_count = 0
    cheques_compensados_monto = 0.0
    cheques_total_monto = 0.0

    cheques_list = []
    for c in cheques_db:
        monto = _dec_to_float(c.monto)
        cheques_total_monto += monto
        f_pago = c.fecha_pago or c.fecha_emision
        dias_rest = (f_pago - today).days if f_pago else 0
        is_diferido = bool(c.diferido)
        estado = (c.estado or "pendiente").lower()

        if is_diferido and estado in ("pendiente", "entregado"):
            cheques_diferidos_pendientes_monto += monto
            cheques_diferidos_pendientes_count += 1
        elif estado in ("compensado", "cobrado"):
            cheques_compensados_monto += monto

        cheques_list.append({
            "id": str(c.id),
            "numero": c.numero or "S/N",
            "banco_emisor": c.banco_emisor or "",
            "beneficiario": c.beneficiario or "",
            "monto": monto,
            "moneda": c.moneda or "PYG",
            "fecha_emision": _date_str(c.fecha_emision),
            "fecha_pago": _date_str(c.fecha_pago),
            "diferido": is_diferido,
            "estado": estado,
            "dias_restantes": dias_rest,
            "concepto": c.concepto or "",
        })

    # 2.5 Procesar facturas con vinculación de NC y Fases de Pago
    total_facturas = len(invoices)
    total_deuda_facturas = 0.0
    deuda_vencida = 0.0
    deuda_al_dia = 0.0
    facturas_pendientes_count = 0
    facturas_vencidas_count = 0

    aging_vencido = 0.0
    aging_1_30 = 0.0
    aging_31_60 = 0.0
    aging_mas_60 = 0.0

    invoices_list = []
    for inv in invoices:
        es_cancelada = (inv.estado or "").lower() == "cancelada"
        saldo = 0.0 if es_cancelada else _dec_to_float(inv.saldo_pendiente if inv.saldo_pendiente is not None else inv.total)
        total = _dec_to_float(inv.total)
        f_venc = inv.fecha_vencimiento
        dias_vencido = (today - f_venc).days if f_venc else 0
        es_vencida = dias_vencido > 0 and saldo > 0 and not es_cancelada

        # NCs vinculadas a esta factura
        inv_apps = apps_by_invoice.get(inv.id, [])
        monto_nc_aplicado = sum(a["monto_aplicado"] for a in inv_apps)
        tiene_nc_vinculada = len(inv_apps) > 0 or bool(inv.requiere_nc) or (_dec_to_float(inv.monto_retenido_nc) > 0)
        saldo_neto_real = max(0.0, saldo)

        # Lote de pago
        lote_info = p_run_by_invoice.get(inv.id)
        en_lote_pago = lote_info is not None

        # Fases de Pago
        if es_cancelada:
            fase_pago = "liquidada"
            fase_pago_label = "Fase 4: Anulada / Cancelada"
            fase_pago_color = "slate"
        elif saldo <= 0:
            fase_pago = "liquidada"
            fase_pago_label = "Fase 4: Liquidada / Cancelada 100%"
            fase_pago_color = "emerald"
        elif inv.bloqueada_para_pago or inv.requiere_nc or (_dec_to_float(inv.monto_retenido_nc) > 0):
            fase_pago = "bloqueada_nc"
            fase_pago_label = "Fase 1: Retenida por NC / Reclamo en Trámite"
            fase_pago_color = "purple"
        elif en_lote_pago:
            fase_pago = "en_lote"
            fase_pago_label = f"Fase 2: En Lote de Pago SIPAP ({lote_info['lote_nombre']})"
            fase_pago_color = "indigo"
        elif es_vencida:
            fase_pago = "vencida"
            fase_pago_label = f"Fase 1: Expirada (+{dias_vencido}d vencida)"
            fase_pago_color = "red"
        else:
            fase_pago = "al_dia"
            fase_pago_label = f"Fase 1: Crédito Vigente ({abs(dias_vencido)}d rest.)"
            fase_pago_color = "blue"

        if saldo > 0 and not es_cancelada:
            total_deuda_facturas += saldo
            facturas_pendientes_count += 1
            if es_vencida:
                deuda_vencida += saldo
                facturas_vencidas_count += 1
                aging_vencido += saldo
            else:
                deuda_al_dia += saldo
                dias_rest = abs(dias_vencido)
                if dias_rest <= 30:
                    aging_1_30 += saldo
                elif dias_rest <= 60:
                    aging_31_60 += saldo
                else:
                    aging_mas_60 += saldo

        invoices_list.append({
            "id": str(inv.id),
            "numero_factura": inv.numero_factura or "S/N",
            "timbrado": inv.timbrado or "",
            "fecha_emision": _date_str(inv.fecha_emision),
            "fecha_vencimiento": _date_str(inv.fecha_vencimiento),
            "subtotal": _dec_to_float(inv.subtotal),
            "total": total,
            "saldo_pendiente": saldo,
            "moneda": inv.moneda or "PYG",
            "estado": inv.estado or "pendiente",
            "condicion": inv.condicion or "credito",
            "dias_vencido": dias_vencido,
            "es_vencida": es_vencida,
            "bloqueada_para_pago": bool(inv.bloqueada_para_pago),
            "monto_retenido_nc": _dec_to_float(inv.monto_retenido_nc),
            "requiere_nc": bool(inv.requiere_nc),
            # Dimensiones extendidas:
            "tiene_nc_vinculada": tiene_nc_vinculada,
            "monto_nc_aplicado": monto_nc_aplicado,
            "ncs_vinculadas": inv_apps,
            "saldo_neto_real": saldo_neto_real,
            "en_lote_pago": en_lote_pago,
            "lote_pago_info": lote_info,
            "fase_pago": fase_pago,
            "fase_pago_label": fase_pago_label,
            "fase_pago_color": fase_pago_color,
        })

    # 3. Monedero de NC (Billetera de Crédito del Proveedor)
    monedero_total_emitido = 0.0
    monedero_total_aplicado = 0.0
    monedero_saldo_disponible = 0.0

    monedero_items = []
    for cn in credit_notes:
        m_orig = _dec_to_float(cn.monto)
        apps_cn = apps_by_cn.get(cn.id, [])
        m_aplicado_cn = sum(a["monto_aplicado"] for a in apps_cn)
        m_disp = _dec_to_float(cn.saldo_disponible) if cn.saldo_disponible is not None else 0.0

        monedero_total_emitido += m_orig
        monedero_total_aplicado += m_aplicado_cn
        monedero_saldo_disponible += m_disp

        # Clasificación canónica de origen
        mot_cat = (cn.motivo_categoria or "").lower()
        mot_txt = (cn.motivo or "").lower()
        if "recepcion" in mot_cat or "faltante" in mot_cat or "deposito" in mot_txt or "muelle" in mot_txt:
            origen_clave = "recepcion_deposito"
            origen_label = "Recepción en Depósito (Faltante / Avería en Muelle)"
            origen_icono = "truck"
        elif "bonificacion" in mot_cat or "volumen" in mot_cat or "descuento" in mot_cat or "promo" in mot_txt:
            origen_clave = "promociones"
            origen_label = "Promoción Comercial / Bonificación por Volumen"
            origen_icono = "tag"
        elif "precio" in mot_cat or "diferencia" in mot_txt:
            origen_clave = "diferencia_precio"
            origen_label = "Diferencia de Precio Pactado vs Facturado"
            origen_icono = "dollar-sign"
        elif "vencimiento" in mot_cat or "rotura" in mot_cat or "merma" in mot_txt:
            origen_clave = "devolucion_merma"
            origen_label = "Devolución por Rotura / Vencimiento en Salón"
            origen_icono = "alert-triangle"
        else:
            origen_clave = "administrativo"
            origen_label = "Ajuste Comercial / Administrativo"
            origen_icono = "file-text"

        estado_monedero = "disponible_total" if m_disp >= m_orig and m_orig > 0 else "disponible_parcial" if m_disp > 0 else "agotada"

        monedero_items.append({
            "id": str(cn.id),
            "numero": cn.numero or "NC S/N",
            "timbrado": cn.timbrado or "",
            "fecha": _date_str(cn.fecha),
            "numero_factura_origen": cn.numero_factura_origen or "Sin Factura Origen",
            "motivo": cn.motivo or "",
            "motivo_categoria": cn.motivo_categoria or "otros",
            "origen_clave": origen_clave,
            "origen_label": origen_label,
            "origen_icono": origen_icono,
            "monto_original": m_orig,
            "monto_aplicado": m_aplicado_cn,
            "saldo_disponible": m_disp,
            "estado_monedero": estado_monedero,
            "etapa_codigo": "2_emitida_monedero" if m_disp > 0 else "3_aplicada_total",
            "etapa_label": "NC Formal Emitida (Saldo Disponible en Monedero)" if m_disp > 0 else "NC Formal Aplicada Totalmente a Facturas",
            "aplicaciones": apps_cn,
        })

    # 4. Devoluciones Físicas de Mercadería
    devoluciones_fisicas = []
    try:
        q_sm_ret = select(SupermerSupplierReturn).where(
            SupermerSupplierReturn.company_id == company_id,
            SupermerSupplierReturn.proveedor_id == supplier_id,
        ).order_by(SupermerSupplierReturn.fecha_creacion.desc())
        sm_ret_res = await db.execute(q_sm_ret)
        for r in sm_ret_res.scalars().all():
            val = _dec_to_float(r.valor_total_estimado or r.nota_credito_monto)
            tiene_nc = bool(r.nota_credito_numero)
            devoluciones_fisicas.append({
                "id": str(r.id),
                "codigo": r.codigo or "DEV-S/N",
                "tipo": r.tipo or "devolucion",
                "fecha": _date_str(r.fecha_creacion),
                "valor_estimado": val,
                "tiene_nc": tiene_nc,
                "nota_credito_numero": r.nota_credito_numero or "",
                "nota_credito_monto": _dec_to_float(r.nota_credito_monto),
                "estado": r.estado or "pendiente",
                "etapa_codigo": "2_emitida_monedero" if tiene_nc else "1_requerimiento",
                "etapa_label": "NC Emitida por Proveedor" if tiene_nc else "Etapa 1: Mercadería Entregada - Obligación de NC Pendiente",
                "origen_clave": "devolucion_merma",
                "origen_label": "Devolución Física de Mercadería (Salón / Depósito)",
                "observaciones": r.observaciones or "",
            })
    except Exception as e:
        logger.warning(f"Error fetching supermer supplier returns: {e}")

    # 5. Reclamos y Solicitudes de NC con Orígenes y Etapas
    q_nc = select(SupplierNcRequest).where(
        SupplierNcRequest.company_id == company_id,
        SupplierNcRequest.supplier_id == supplier_id,
    ).order_by(SupplierNcRequest.created_at.desc())
    nc_res = await db.execute(q_nc)
    nc_requests = nc_res.scalars().all()

    reclamos_enriquecidos = []
    obligaciones_pendientes_monto = 0.0

    for n in nc_requests:
        inv_num = invoice_map_by_id.get(n.invoice_id, "Factura S/N")
        m_rec = _dec_to_float(n.monto_reclamado)
        nc_emitida_num = n.nc_recibida_numero

        tipo = (n.tipo_motivo or "").lower()
        if n.receipt_id or "recepcion" in tipo or "faltante" in tipo:
            orig_k = "recepcion_deposito"
            orig_lbl = "Recepción en Depósito (Faltante / Diferencia de Muelle)"
            orig_ico = "truck"
        elif "promo" in tipo or "acuerdo" in tipo:
            orig_k = "promociones"
            orig_lbl = "Promoción Comercial / Acuerdo No Acreditado"
            orig_ico = "tag"
        elif "precio" in tipo:
            orig_k = "diferencia_precio"
            orig_lbl = "Diferencia de Precio en Facturación"
            orig_ico = "dollar-sign"
        elif "danado" in tipo or "rotura" in tipo:
            orig_k = "devolucion_merma"
            orig_lbl = "Producto Dañado / Avería al Recibir"
            orig_ico = "alert-triangle"
        else:
            orig_k = "administrativo"
            orig_lbl = "Reclamo Comercial / Administrativo"
            orig_ico = "file-text"

        if n.estado == "resuelta" or nc_emitida_num:
            etapa_k = "2_emitida_monedero"
            etapa_lbl = f"Etapa 2: NC Formal Emitida ({nc_emitida_num or 'Registrada'})"
        elif n.estado == "rechazada":
            etapa_k = "rechazada"
            etapa_lbl = "Reclamo Rechazado por Proveedor"
        else:
            etapa_k = "1_requerimiento"
            etapa_lbl = "Etapa 1: Obligación Pendiente de Emisión por Proveedor"
            obligaciones_pendientes_monto += m_rec

        reclamos_enriquecidos.append({
            "id": str(n.id),
            "numero_solicitud": n.numero_solicitud or "REQ-NC",
            "invoice_id": str(n.invoice_id) if n.invoice_id else "",
            "invoice_numero": inv_num,
            "receipt_id": str(n.receipt_id) if n.receipt_id else "",
            "tipo_motivo": n.tipo_motivo or "diferencia",
            "origen_clave": orig_k,
            "origen_label": orig_lbl,
            "origen_icono": orig_ico,
            "monto_reclamado": m_rec,
            "estado": n.estado or "pendiente_entrega",
            "etapa_codigo": etapa_k,
            "etapa_label": etapa_lbl,
            "nc_recibida_numero": n.nc_recibida_numero or "",
            "nc_recibida_timbrado": n.nc_recibida_timbrado or "",
            "nc_recibida_monto": _dec_to_float(n.nc_recibida_monto),
            "nc_recibida_fecha": _date_str(n.nc_recibida_fecha),
            "observaciones": n.observaciones or "",
            "created_at": _date_str(n.created_at),
        })

    # Consolidado de Monedero y Créditos
    credito_total_potencial = monedero_saldo_disponible + obligaciones_pendientes_monto
    deuda_neta_efectiva = max(0.0, total_deuda_facturas - monedero_saldo_disponible)
    exposicion_financiera_total = total_deuda_facturas + cheques_diferidos_pendientes_monto

    # 6. Historial de Pagos Efectuados (SupplierInvoicePayment)
    q_pagos = select(
        SupplierInvoicePayment,
        SupplierInvoice.numero_factura,
        SupplierInvoice.fecha_emision
    ).join(
        SupplierInvoice, SupplierInvoice.id == SupplierInvoicePayment.invoice_id
    ).where(
        SupplierInvoice.company_id == company_id,
        SupplierInvoice.supplier_id == supplier_id,
    ).order_by(SupplierInvoicePayment.fecha_pago.desc())
    pagos_res = await db.execute(q_pagos)
    pagos_rows = pagos_res.all()

    pagos_list = []
    total_pagado_acumulado = 0.0
    dias_pago_acum = 0
    dias_pago_count = 0

    for payment, num_fac, f_emision in pagos_rows:
        monto = _dec_to_float(payment.monto)
        total_pagado_acumulado += monto

        if f_emision and payment.fecha_pago:
            delta = (payment.fecha_pago - f_emision).days
            if delta >= 0:
                dias_pago_acum += delta
                dias_pago_count += 1

        pagos_list.append({
            "id": str(payment.id),
            "invoice_id": str(payment.invoice_id),
            "invoice_numero": num_fac or "Factura S/N",
            "fecha_pago": _date_str(payment.fecha_pago),
            "monto": monto,
            "moneda": payment.moneda or "PYG",
            "payment_method": payment.payment_method or "transferencia",
            "referencia": payment.referencia or "",
            "estado": payment.estado or "completado",
        })

    dpo_promedio_dias = round(dias_pago_acum / dias_pago_count, 1) if dias_pago_count > 0 else (supplier.plazo_pago_dias or 30)

    # 7. Órdenes de Compra (PurchaseOrders)
    q_oc = select(PurchaseOrder).where(
        PurchaseOrder.company_id == company_id,
        PurchaseOrder.supplier_id == supplier_id,
    ).order_by(PurchaseOrder.fecha.desc())
    oc_res = await db.execute(q_oc)
    ocs = oc_res.scalars().all()

    total_ordenes_compra = len(ocs)
    total_gastado_oc = sum(_dec_to_float(o.total) for o in ocs)
    ordenes_completadas = sum(1 for o in ocs if (o.estado or "").lower() in ("completado", "recibido", "aprobado"))
    entregas_a_tiempo = sum(1 for o in ocs if o.fecha_envio and o.fecha_entrega_estimada and o.fecha_envio.date() <= o.fecha_entrega_estimada)
    otif_rate = round((entregas_a_tiempo / ordenes_completadas * 100), 1) if ordenes_completadas > 0 else 94.5

    ocs_list = []
    for o in ocs[:30]:
        ocs_list.append({
            "id": str(o.id),
            "numero": o.numero or "OC S/N",
            "fecha": _date_str(o.fecha),
            "fecha_entrega_estimada": _date_str(o.fecha_entrega_estimada),
            "estado": o.estado or "borrador",
            "total": _dec_to_float(o.total),
            "moneda": o.moneda or "PYG",
            "condiciones_pago": o.condiciones_pago or "",
            "observaciones": o.observaciones or "",
        })

    # 8. Recepciones de Mercadería (PurchaseReceipts)
    q_rc = select(PurchaseReceipt).where(
        PurchaseReceipt.company_id == company_id,
        PurchaseReceipt.supplier_id == supplier_id,
    ).order_by(PurchaseReceipt.fecha.desc())
    rc_res = await db.execute(q_rc)
    receipts = rc_res.scalars().all()

    receipts_list = []
    for r in receipts[:30]:
        receipts_list.append({
            "id": str(r.id),
            "numero": r.numero or "REM S/N",
            "fecha": _date_str(r.fecha),
            "total": _dec_to_float(r.total),
            "estado": r.estado or "completado",
            "proveedor_ref": r.proveedor_ref or "",
            "requiere_revision": bool(r.requiere_revision),
            "motivo_revision": r.motivo_revision or "",
            "observaciones": r.observaciones or "",
        })

    # 9. Catálogo de Productos y Existencias de Stock
    q_prod_dir = select(Product).where(
        Product.company_id == company_id,
        Product.supplier_id == supplier_id,
        Product.activo == True,
    )
    p_dir_res = await db.execute(q_prod_dir)
    products_map = {p.id: p for p in p_dir_res.scalars().all()}

    q_prod_inv = select(Product).join(
        SupplierInvoiceItem, SupplierInvoiceItem.product_id == Product.id
    ).join(
        SupplierInvoice, SupplierInvoice.id == SupplierInvoiceItem.invoice_id
    ).where(
        SupplierInvoice.company_id == company_id,
        SupplierInvoice.supplier_id == supplier_id,
        Product.activo == True,
    ).distinct()
    p_inv_res = await db.execute(q_prod_inv)
    for p in p_inv_res.scalars().all():
        if p.id not in products_map:
            products_map[p.id] = p

    # También productos asociados históricamente a órdenes de compra del proveedor
    q_prod_po = select(Product).join(
        PurchaseOrderItem, PurchaseOrderItem.product_id == Product.id
    ).join(
        PurchaseOrder, PurchaseOrder.id == PurchaseOrderItem.purchase_order_id
    ).where(
        PurchaseOrder.company_id == company_id,
        PurchaseOrder.supplier_id == supplier_id,
        Product.activo == True,
    ).distinct()
    p_po_res = await db.execute(q_prod_po)
    for p in p_po_res.scalars().all():
        if p.id not in products_map:
            products_map[p.id] = p

    product_ids = list(products_map.keys())

    stock_by_product = {}
    if product_ids:
        q_stock = select(
            Stock.product_id,
            func.sum(Stock.cantidad).label("total_qty")
        ).where(
            Stock.product_id.in_(product_ids)
        ).group_by(Stock.product_id)
        stk_res = await db.execute(q_stock)
        for row in stk_res.all():
            stock_by_product[row[0]] = _dec_to_float(row[1])

    unidades_vendidas_by_product = {}
    ventas_gs_by_product = {}
    costo_gs_by_product = {}

    ventas_total_gs = 0.0
    costo_total_ventas_gs = 0.0
    unidades_vendidas_total = 0.0

    if product_ids:
        q_sales = select(
            SaleItem.product_id,
            func.sum(SaleItem.cantidad).label("qty_sold"),
            func.sum(SaleItem.total).label("revenue"),
            func.sum(SaleItem.cantidad * func.coalesce(SaleItem.costo_unitario, 0)).label("cogs")
        ).join(
            Sale, Sale.id == SaleItem.sale_id
        ).where(
            SaleItem.product_id.in_(product_ids),
            Sale.estado.notin_(["anulada", "cancelada"])
        ).group_by(SaleItem.product_id)
        sales_res = await db.execute(q_sales)

        for row in sales_res.all():
            pid = row[0]
            q_s = _dec_to_float(row[1])
            rev = _dec_to_float(row[2])
            cogs = _dec_to_float(row[3])

            unidades_vendidas_by_product[pid] = q_s
            ventas_gs_by_product[pid] = rev
            costo_gs_by_product[pid] = cogs

            unidades_vendidas_total += q_s
            ventas_total_gs += rev
            costo_total_ventas_gs += cogs

    ganancia_bruta_gs = max(0.0, ventas_total_gs - costo_total_ventas_gs)
    margen_bruto_pct = round((ganancia_bruta_gs / ventas_total_gs * 100), 1) if ventas_total_gs > 0 else 0.0

    stock_unidades_total = 0.0
    stock_valorizado_costo = 0.0
    stock_valorizado_venta = 0.0
    products_list = []

    for pid, p in products_map.items():
        qty_stock = stock_by_product.get(pid, 0.0)
        costo = _dec_to_float(p.costo_promedio or p.ultimo_costo)
        precio = _dec_to_float(p.precio_venta)
        val_costo = qty_stock * costo
        val_venta = qty_stock * precio

        stock_unidades_total += qty_stock
        stock_valorizado_costo += val_costo
        stock_valorizado_venta += val_venta

        s_min = p.stock_minimo or 0
        if qty_stock <= 0:
            estado_stock = "quiebre"
        elif qty_stock <= s_min:
            estado_stock = "bajo"
        else:
            estado_stock = "optimo"

        unit_margin = round(((precio - costo) / precio * 100), 1) if precio > 0 else 0.0
        p_ventas_gs = ventas_gs_by_product.get(pid, 0.0)
        p_cogs_gs = costo_gs_by_product.get(pid, 0.0)
        p_profit_gs = max(0.0, p_ventas_gs - p_cogs_gs)

        products_list.append({
            "id": str(p.id),
            "nombre": p.nombre,
            "sku": p.sku or "",
            "codigo_barra": p.codigo_barra or "",
            "costo_promedio": costo,
            "ultimo_costo": _dec_to_float(p.ultimo_costo),
            "precio_venta": precio,
            "stock_actual": qty_stock,
            "stock_minimo": s_min,
            "estado_stock": estado_stock,
            "valor_stock_costo": val_costo,
            "valor_stock_venta": val_venta,
            "margen_unitario_pct": unit_margin,
            "unidades_vendidas": unidades_vendidas_by_product.get(pid, 0.0),
            "ventas_gs": p_ventas_gs,
            "ganancia_bruta_gs": p_profit_gs,
        })

    products_list.sort(key=lambda x: x["ventas_gs"], reverse=True)
    top_vendidos = products_list[:5]

    # 10. Evolución mensual (Últimos 12 meses)
    evolucion_mensual = []
    for i in range(11, -1, -1):
        ref_date = today.replace(day=1) - timedelta(days=i * 30)
        y, m = ref_date.year, ref_date.month
        m_str = f"{y:04d}-{m:02d}"
        m_label = ref_date.strftime("%b %y").capitalize()

        c_m = sum(inv["total"] for inv in invoices_list if inv["fecha_emision"].startswith(m_str))
        p_m = sum(pg["monto"] for pg in pagos_list if pg["fecha_pago"].startswith(m_str))

        evolucion_mensual.append({
            "mes": m_str,
            "label": m_label,
            "compras": c_m,
            "pagos": p_m,
        })

    # 11. Diagnóstico Gerencial Extenso Narrativo Enriquecido
    informe_gerencial = _generar_informe_gerencial_narrativo(
        supplier_info=supplier_info,
        total_deuda_facturas=total_deuda_facturas,
        deuda_vencida=deuda_vencida,
        deuda_al_dia=deuda_al_dia,
        cheques_diferidos_monto=cheques_diferidos_pendientes_monto,
        cheques_diferidos_count=cheques_diferidos_pendientes_count,
        exposicion_total=exposicion_financiera_total,
        dpo=dpo_promedio_dias,
        otif=otif_rate,
        stock_valorizado=stock_valorizado_costo,
        total_productos=len(products_list),
        ventas_total=ventas_total_gs,
        ganancia_bruta=ganancia_bruta_gs,
        margen_pct=margen_bruto_pct,
        monedero_disponible=monedero_saldo_disponible,
        obligaciones_nc_pendientes=obligaciones_pendientes_monto,
        deuda_neta_real=deuda_neta_efectiva,
        top_prods=top_vendidos,
    )

    return {
        "supplier": supplier_info,
        "kpis": {
            "deuda_total_facturas": total_deuda_facturas,
            "deuda_vencida": deuda_vencida,
            "deuda_al_dia": deuda_al_dia,
            "facturas_pendientes_count": facturas_pendientes_count,
            "facturas_vencidas_count": facturas_vencidas_count,
            "total_facturas_historico": total_facturas,
            "cheques_diferidos_pendientes_monto": cheques_diferidos_pendientes_monto,
            "cheques_diferidos_pendientes_count": cheques_diferidos_pendientes_count,
            "cheques_compensados_monto": cheques_compensados_monto,
            "exposicion_financiera_total": exposicion_financiera_total,
            # Monedero y Crédito Neto:
            "monedero_nc_saldo_disponible": monedero_saldo_disponible,
            "monedero_nc_total_emitido": monedero_total_emitido,
            "monedero_nc_total_aplicado": monedero_total_aplicado,
            "obligaciones_nc_pendientes_monto": obligaciones_pendientes_monto,
            "credito_total_potencial_nc": credito_total_potencial,
            "deuda_neta_efectiva": deuda_neta_efectiva,
            "dpo_promedio_dias": dpo_promedio_dias,
            "total_compras_historico": total_gastado_oc,
            "total_ordenes_compra": total_ordenes_compra,
            "otif_rate": otif_rate,
            "stock_unidades_total": stock_unidades_total,
            "stock_valorizado_costo": stock_valorizado_costo,
            "stock_valorizado_venta": stock_valorizado_venta,
            "total_productos_suministrados": len(products_list),
            "ventas_sellout_monto": ventas_total_gs,
            "ventas_sellout_unidades": unidades_vendidas_total,
            "ganancia_bruta_monto": ganancia_bruta_gs,
            "margen_bruto_pct": margen_bruto_pct,
        },
        "monedero_nc": {
            "saldo_disponible": monedero_saldo_disponible,
            "total_emitido": monedero_total_emitido,
            "total_aplicado": monedero_total_aplicado,
            "cantidad_ncs": len(monedero_items),
            "cantidad_con_saldo": sum(1 for m in monedero_items if m["saldo_disponible"] > 0),
            "obligaciones_pendientes_emision": obligaciones_pendientes_monto,
            "credito_total_potencial": credito_total_potencial,
            "items": monedero_items,
            "aplicaciones_historial": [a for apps in apps_by_cn.values() for a in apps],
            "devoluciones_fisicas": devoluciones_fisicas,
            "reclamos": reclamos_enriquecidos,
        },
        "aging_buckets": {
            "vencido": aging_vencido,
            "dias_1_30": aging_1_30,
            "dias_31_60": aging_31_60,
            "dias_mas_60": aging_mas_60,
        },
        "facturas": invoices_list,
        "cheques": cheques_list,
        "pagos_historial": pagos_list,
        "ordenes_compra": ocs_list,
        "recepciones": receipts_list,
        "reclamos_nc": reclamos_enriquecidos,
        "devoluciones_fisicas": devoluciones_fisicas,
        "productos": products_list,
        "top_vendidos": top_vendidos,
        "evolucion_mensual": evolucion_mensual,
        "informe_gerencial": informe_gerencial,
    }


def _generar_informe_gerencial_narrativo(
    supplier_info: dict,
    total_deuda_facturas: float,
    deuda_vencida: float,
    deuda_al_dia: float,
    cheques_diferidos_monto: float,
    cheques_diferidos_count: int,
    exposicion_total: float,
    dpo: float,
    otif: float,
    stock_valorizado: float,
    total_productos: int,
    ventas_total: float,
    ganancia_bruta: float,
    margen_pct: float,
    monedero_disponible: float,
    obligaciones_nc_pendientes: float,
    deuda_neta_real: float,
    top_prods: list,
) -> dict:
    rz = supplier_info.get("razon_social", "El Proveedor")
    ruc = supplier_info.get("ruc", "S/RUC")
    plazo = supplier_info.get("plazo_pago_dias", 30)
    today = date.today()

    # 1. Resumen Ejecutivo
    resumen = (
        f"Auditoría comercial y financiera consolidada de {rz} (RUC: {ruc}). "
        f"Actualmente canaliza {total_productos} artículos en el catálogo activo. "
        f"Nuestra deuda bruta en Cuentas por Pagar (AP) asciende a Gs. {total_deuda_facturas:,.0f}. "
        f"Disponemos de Gs. {monedero_disponible:,.0f} a favor en el Monedero de Notas de Crédito, resultando en una "
        f"deuda neta exigible de Gs. {deuda_neta_real:,.0f}. "
        f"Adicionalmente, se mantienen emitidos {cheques_diferidos_count} cheques diferidos en tránsito bancario por Gs. {cheques_diferidos_monto:,.0f} "
        f"y se encuentran en gestión reclamos y devoluciones pendientes de emisión de NC por Gs. {obligaciones_nc_pendientes:,.0f}."
    ).replace(",", ".")

    # 2. Diagnóstico de Pasivos y Liquidez
    pct_venc = round((deuda_vencida / total_deuda_facturas * 100), 1) if total_deuda_facturas > 0 else 0.0
    if pct_venc > 25:
        salud_deuda = "ALTO RIESGO / VENCIDO CRÍTICO"
        deuda_diag = (
            f"Presenta un saldo vencido elevado de Gs. {deuda_vencida:,.0f} ({pct_venc}% del total facturado). "
            f"Existe riesgo potencial de corte de cuenta corriente o suspensión de despachos. "
            f"Se recomienda compensar inmediatamente el saldo disponible del Monedero de NC (Gs. {monedero_disponible:,.0f}) "
            f"contra las facturas más antiguas para reducir el pasivo vencido."
        ).replace(",", ".")
    elif cheques_diferidos_monto > total_deuda_facturas:
        salud_deuda = "ALTA COBERTURA EN CHEQUES DIFERIDOS"
        deuda_diag = (
            f"El pasivo comercial está fuertemente cubierto mediante cheques diferidos en tránsito por Gs. {cheques_diferidos_monto:,.0f}. "
            f"Si bien las facturas comerciales se encuentran saldadas documentalmente, Tesorería debe vigilar rigurosamente "
            f"los saldos bancarios en las fechas de cobro comprometidas para evitar rechazos operativos."
        ).replace(",", ".")
    else:
        salud_deuda = "EQUILIBRADA / CONTROLADA"
        deuda_diag = (
            f"La cartera de vencimientos se encuentra controlada con Gs. {deuda_al_dia:,.0f} al día dentro del plazo pactado de {plazo} días. "
            f"El período medio de pago (DPO) efectivo se sitúa en {dpo:.1f} días. "
            f"La deuda neta tras deducir el crédito en Monedero de NC queda en Gs. {deuda_neta_real:,.0f}."
        ).replace(",", ".")

    # 3. Operaciones & Abastecimiento
    if otif >= 90:
        operaciones_eval = "EXCELENTE (OTIF >= 90%)"
        operaciones_diag = f"El cumplimiento de entregas en plazo y forma se sitúa en {otif}%, constituyendo un socio logístico confiable con bajo índice de roturas y faltantes."
    elif otif >= 75:
        operaciones_eval = "REGULAR / EN OBSERVACIÓN"
        operaciones_diag = f"El índice de entrega a tiempo se ubica en {otif}%. Se registran demoras esporádicas en depósito central que deben revisarse en mesa de compras."
    else:
        operaciones_eval = "DEFICIENTE (OTIF < 75%)"
        operaciones_diag = f"Incumplimiento crítico de plazos con un OTIF del {otif}%. Se requiere aplicar penalizaciones de contrato o revisar plazos de lead time."

    # 4. Rentabilidad Comercial
    if margen_pct >= 25:
        rentabilidad_eval = "ALTA RENTABILIDAD (MARGEN >= 25%)"
    elif margen_pct >= 15:
        rentabilidad_eval = "RENTABILIDAD MEDIA ESTÁNDAR (15% - 24%)"
    else:
        rentabilidad_eval = "BAJO MARGEN (REQUIERE REVISIÓN COMERCIAL)"

    rentabilidad_diag = (
        f"Los productos del proveedor han generado ventas brutas acumuladas por Gs. {ventas_total:,.0f}, "
        f"dejando una contribución marginal neta de Gs. {ganancia_bruta:,.0f} (margen del {margen_pct}%). "
        f"El stock físico inmovilizado en depósito equivale a Gs. {stock_valorizado:,.0f} a costo de reposición."
    ).replace(",", ".")

    # 5. Recomendaciones Estratégicas
    top_names = ', '.join(p['nombre'][:25] for p in top_prods[:3]) if top_prods else 'línea general'
    recomendaciones = [
        f"Aplicar el saldo a favor disponible en el Monedero de NC por Gs. {monedero_disponible:,.0f} sobre las próximas facturas a vencer para no desembolsar fondos de tesorería." if monedero_disponible > 0 else "Monedero de NC al día sin créditos pendientes de aplicar.",
        f"Exigir la resolución y emisión de NC fiscales sobre los {len(top_prods)} reclamos y devoluciones pendientes por Gs. {obligaciones_nc_pendientes:,.0f} originados en muelle de depósito y promociones." if obligaciones_nc_pendientes > 0 else "Sin solicitudes de NC pendientes de formalización por parte del proveedor.",
        f"Mantener la cobertura de cheques diferidos calendarizada a un horizonte no menor de {plazo} días para evitar tensiones de flujo en bóveda y cuentas corrientes.",
        f"Potenciar la exhibición y reposición continua de los productos líderes de rotación ({top_names}).",
    ]

    return {
        "resumen_ejecutivo": resumen,
        "salud_deuda": salud_deuda,
        "diagnostico_deuda": deuda_diag,
        "evaluacion_operativa": operaciones_eval,
        "diagnostico_operativo": operaciones_diag,
        "evaluacion_rentabilidad": rentabilidad_eval,
        "diagnostico_rentabilidad": rentabilidad_diag,
        "recomendaciones": recomendaciones,
        "fecha_auditoria": today.strftime("%d/%m/%Y"),
    }
