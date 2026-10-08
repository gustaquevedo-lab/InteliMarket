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

from api.src.purchases.models import Supplier
from api.src.financial.models import (
    SupplierInvoice, SupplierInvoicePayment,
    SupplierCreditNote, SupplierCreditNoteApplication
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

    # 4. Pagos realizados a facturas del proveedor
    inv_ids = [inv.id for inv in invoices]
    payments: List[SupplierInvoicePayment] = []
    if inv_ids:
        q_pay = select(SupplierInvoicePayment).where(
            SupplierInvoicePayment.invoice_id.in_(inv_ids),
            SupplierInvoicePayment.estado != "cancelado",
        )
        pay_res = await db.execute(q_pay)
        payments = pay_res.scalars().all()

    # 5. Cheques emitidos al proveedor (para sección de valores en tránsito)
    q_chq = select(Cheque).where(
        Cheque.company_id == company_id,
        Cheque.supplier_id == supplier_id,
    ).order_by(Cheque.fecha_pago.asc(), Cheque.fecha_emision.desc())
    chq_res = await db.execute(q_chq)
    cheques_db = chq_res.scalars().all()

    cheques_transito = []
    cheques_diferidos_transito_monto = 0.0
    for c in cheques_db:
        monto_ch = _dec_to_float(c.monto)
        is_diferido = bool(c.diferido)
        estado_ch = (c.estado or "pendiente").lower()
        f_pago = c.fecha_pago or c.fecha_emision
        dias_rest = (f_pago - today).days if f_pago else 0

        # Cheques diferidos entregados aún pendientes de compensación
        if is_diferido and estado_ch in ("pendiente", "entregado"):
            cheques_diferidos_transito_monto += monto_ch
            cheques_transito.append({
                "id": str(c.id),
                "numero": c.numero or "S/N",
                "banco_emisor": c.banco_emisor or "",
                "monto": monto_ch,
                "moneda": c.moneda or "PYG",
                "fecha_emision": _date_str(c.fecha_emision),
                "fecha_pago": _date_str(c.fecha_pago),
                "dias_restantes": dias_rest,
                "concepto": c.concepto or "Pago a Proveedor",
                "estado": estado_ch.upper(),
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

    # 6.3 Movimientos de Pagos Realizados (Créditos)
    for pay in payments:
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
    tot_pago = 0.0

    for m in filtrados:
        d = m["debito"]
        c = m["credito"]
        saldo_acumulado += (d - c)

        if m["tipo"] == "FACTURA":
            tot_debito += d
        elif m["tipo"] == "NOTA_CREDITO":
            tot_nc += c
        elif m["tipo"] == "PAGO":
            tot_pago += c

        m_copy = dict(m)
        m_copy["saldo_progresivo"] = saldo_acumulado
        m_copy["punteado"] = False  # casilla desmarcada por defecto

        # Si solo_pendientes es True, incluimos solo facturas con saldo, NCs con saldo o movimientos recientes
        if solo_pendientes and m["tipo"] == "FACTURA" and m["saldo_documento"] <= 0:
            continue

        final_movements.append(m_copy)

    tot_credito = tot_nc + tot_pago
    saldo_deudor_final = saldo_acumulado
    saldo_neto_con_cheques = saldo_deudor_final - cheques_diferidos_transito_monto

    return {
        "supplier": supplier_info,
        "periodo": {
            "fecha_desde": _date_str(fecha_desde) if fecha_desde else "",
            "fecha_hasta": _date_str(fecha_hasta) if fecha_hasta else "",
            "solo_pendientes": solo_pendientes,
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
            "saldo_neto_con_cheques": saldo_neto_con_cheques,
        },
        "cheques_diferidos": cheques_transito,
        "resumen_items": {
            "total_movimientos": len(final_movements),
            "total_facturas": len([m for m in final_movements if m["tipo"] == "FACTURA"]),
            "total_ncs": len([m for m in final_movements if m["tipo"] == "NOTA_CREDITO"]),
            "total_pagos": len([m for m in final_movements if m["tipo"] == "PAGO"]),
        }
    }
