"""Motor de 3-Way Matching Matemático y Gestión de Solicitudes de Notas de Crédito.

Implementa la regla de oro de retail:
'Si la factura tiene discrepancias contra lo recibido en muelle o lo pactado en la OC,
JAMÁS se puede pagar. Se bloquea de inmediato para Tesorería y se genera la Solicitud
de Nota de Crédito. Sin entrega de la NC, no hay pago.'
"""

from __future__ import annotations

from datetime import datetime, date, timezone
from decimal import Decimal
from typing import Any, Optional
import uuid

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from api.src.financial.models import SupplierInvoice, SupplierInvoiceItem
from api.src.purchases.models import (
    PurchaseOrder,
    PurchaseOrderItem,
    PurchaseReceipt,
    PurchaseReceiptItem,
    SupplierNcRequest,
)

TOLERANCIA_PRECIO_GS = Decimal("10")  # Tolerancia máxima para diferencias de redondeo


async def perform_3way_match(
    db: AsyncSession,
    invoice_id: str,
    user_id: Optional[str] = None
) -> dict[str, Any]:
    """Ejecuta la conciliación triple matemática (3-Way Match) para una factura dada."""
    inv_uuid = uuid.UUID(invoice_id)
    
    # 1. Cargar factura e ítems
    inv_q = select(SupplierInvoice).options(
        selectinload(SupplierInvoice.items)
    ).where(SupplierInvoice.id == inv_uuid)
    inv_res = await db.execute(inv_q)
    invoice = inv_res.scalar_one_or_none()
    
    if not invoice:
        raise ValueError("Factura de proveedor no encontrada.")

    # 2. Buscar Orden de Compra asociada
    po: Optional[PurchaseOrder] = None
    po_items_map: dict[str, PurchaseOrderItem] = {}
    if invoice.purchase_order_id:
        po_q = select(PurchaseOrder).options(
            selectinload(PurchaseOrder.items)
        ).where(PurchaseOrder.id == invoice.purchase_order_id)
        po_res = await db.execute(po_q)
        po = po_res.scalar_one_or_none()
        if po:
            for poi in po.items:
                po_items_map[str(poi.product_id)] = poi

    # 3. Buscar Recepción en Muelle asociada
    receipt: Optional[PurchaseReceipt] = None
    receipt_items_map: dict[str, PurchaseReceiptItem] = {}
    
    if invoice.receipt_id:
        rec_q = select(PurchaseReceipt).options(
            selectinload(PurchaseReceipt.items)
        ).where(PurchaseReceipt.id == invoice.receipt_id)
        rec_res = await db.execute(rec_q)
        receipt = rec_res.scalar_one_or_none()
    elif po:
        # Si no tiene receipt_id directo, buscar la recepción de esa OC
        rec_q = select(PurchaseReceipt).options(
            selectinload(PurchaseReceipt.items)
        ).where(
            PurchaseReceipt.purchase_order_id == po.id,
            PurchaseReceipt.estado != "cancelado"
        ).order_by(PurchaseReceipt.created_at.desc())
        rec_res = await db.execute(rec_q)
        receipt = rec_res.scalars().first()
        if receipt and not invoice.receipt_id:
            invoice.receipt_id = receipt.id

    if receipt:
        for ri in receipt.items:
            # Clave por product_id
            receipt_items_map[str(ri.product_id)] = ri

    # 4. Comparación línea a línea
    discrepancias_lines: list[dict[str, Any]] = []
    total_discrepancia_monto = Decimal("0")
    total_facturado = Decimal("0")
    total_recibido_val = Decimal("0")
    
    # Evaluar ítems de la factura
    for inv_item in invoice.items:
        prod_key = str(inv_item.product_id) if inv_item.product_id else None
        
        cant_facturada = Decimal(str(inv_item.cantidad))
        precio_facturado = Decimal(str(inv_item.precio_unitario))
        subtotal_item_facturado = Decimal(str(inv_item.total))
        total_facturado += subtotal_item_facturado

        # Datos de recepción muelle
        rec_item = receipt_items_map.get(prod_key) if prod_key else None
        cant_recibida = Decimal(str(rec_item.cantidad_recibida)) if rec_item else Decimal("0")
        cant_rechazada = Decimal(str(rec_item.cantidad_rechazada or 0)) if rec_item else Decimal("0")
        motivo_rechazo = rec_item.motivo_rechazo if rec_item else None

        # Datos de orden de compra
        po_item = po_items_map.get(prod_key) if prod_key else None
        cant_ordenada = Decimal(str(po_item.cantidad)) if po_item else None
        precio_orden = Decimal(str(po_item.precio_unitario)) if po_item else precio_facturado

        total_recibido_val += cant_recibida * precio_orden

        # Chequeo de faltante físico o rechazo
        diff_cant = cant_facturada - cant_recibida
        diff_precio = precio_facturado - precio_orden

        linea_estado = "conforme"
        motivos_linea = []
        diferencia_linea_monto = Decimal("0")

        if not receipt:
            linea_estado = "sin_recepcion"
            motivos_linea.append("Sin ingreso físico registrado en muelle")
            diferencia_linea_monto = subtotal_item_facturado
        else:
            # 1. Discrepancia por cantidad (facturaron más de lo recibido conforme)
            if diff_cant > Decimal("0.001"):
                linea_estado = "discrepancia_cantidad"
                monto_dif_cant = diff_cant * precio_facturado
                diferencia_linea_monto += monto_dif_cant
                if cant_rechazada > 0:
                    motivos_linea.append(f"Rechazo en muelle: {cant_rechazada} u. ({motivo_rechazo or 'daño/vencimiento'})")
                else:
                    motivos_linea.append(f"Faltante físico: se facturaron {cant_facturada} u. pero solo se recibieron {cant_recibida} u.")

            # 2. Discrepancia por precio (facturaron a mayor precio que el pactado)
            if diff_precio > TOLERANCIA_PRECIO_GS:
                linea_estado = "discrepancia_precio" if linea_estado == "conforme" else "discrepancia_mixta"
                monto_dif_precio = diff_precio * cant_recibida
                diferencia_linea_monto += monto_dif_precio
                motivos_linea.append(f"Sobreprecio: {precio_facturado:,.0f} Gs facturado vs {precio_orden:,.0f} Gs pactado en OC")

        total_discrepancia_monto += diferencia_linea_monto

        discrepancias_lines.append({
            "product_id": prod_key,
            "descripcion": inv_item.descripcion,
            "codigo_proveedor": inv_item.codigo_proveedor,
            "cantidad_ordenada": float(cant_ordenada) if cant_ordenada is not None else None,
            "cantidad_recibida": float(cant_recibida),
            "cantidad_rechazada": float(cant_rechazada),
            "cantidad_facturada": float(cant_facturada),
            "precio_orden": float(precio_orden),
            "precio_facturado": float(precio_facturado),
            "diferencia_cantidad": float(diff_cant),
            "diferencia_precio": float(diff_precio),
            "diferencia_monto": float(diferencia_linea_monto),
            "estado": linea_estado,
            "motivos": "; ".join(motivos_linea) if motivos_linea else "Conforme 100%"
        })

    # 5. Determinar estado general del 3-Way Match
    nc_request_obj: Optional[SupplierNcRequest] = None
    
    if not receipt:
        estado_match = "pendiente_recepcion"
        invoice.bloqueada_para_pago = True
        invoice.estado = "en_revision"
        invoice.motivo_bloqueo = "Bloqueada para Tesorería: Pendiente de recepción física en muelle."
    elif total_discrepancia_monto > TOLERANCIA_PRECIO_GS:
        estado_match = "discrepancia_detectada"
        invoice.bloqueada_para_pago = True
        invoice.estado = "retenida_discrepancia"
        invoice.monto_retenido_nc = total_discrepancia_monto
        invoice.requiere_nc = True
        invoice.motivo_bloqueo = (
            f"BLOQUEADA PARA PAGO: Discrepancia detectada de {total_discrepancia_monto:,.0f} Gs. "
            f"Sin entrega de la Nota de Crédito correspondiente, no se liberará el pago."
        )

        # Buscar si ya existe una solicitud de NC para esta factura
        nc_q = select(SupplierNcRequest).where(
            SupplierNcRequest.invoice_id == invoice.id,
            SupplierNcRequest.estado.in_(["pendiente_entrega", "entregada_parcial"])
        )
        nc_res = await db.execute(nc_q)
        nc_request_obj = nc_res.scalar_one_or_none()

        if not nc_request_obj:
            # Generar número correlativo de solicitud
            count_q = select(func.count(SupplierNcRequest.id)).where(SupplierNcRequest.company_id == invoice.company_id)
            c_res = await db.execute(count_q)
            seq = (c_res.scalar() or 0) + 1
            num_snc = f"SNC-{seq:05d}"

            # Consolidar motivos
            motivos_resumen = [line["motivos"] for line in discrepancias_lines if line["diferencia_monto"] > 0]
            detalle_motivos = " | ".join(motivos_resumen)[:1000]

            nc_request_obj = SupplierNcRequest(
                company_id=invoice.company_id,
                supplier_id=invoice.supplier_id,
                invoice_id=invoice.id,
                receipt_id=receipt.id if receipt else None,
                purchase_order_id=po.id if po else None,
                numero_solicitud=num_snc,
                tipo_motivo="diferencia_recepcion_vs_factura",
                monto_reclamado=total_discrepancia_monto,
                estado="pendiente_entrega",
                observaciones=f"Generado automáticamente por 3-Way Match. Motivos: {detalle_motivos}",
                created_by=uuid.UUID(user_id) if user_id else None
            )
            db.add(nc_request_obj)
        else:
            # Actualizar monto reclamado si cambió la conciliación
            nc_request_obj.monto_reclamado = total_discrepancia_monto
    else:
        estado_match = "conciliado_100"
        invoice.bloqueada_para_pago = False
        invoice.estado = "aprobada"
        invoice.monto_retenido_nc = Decimal("0")
        invoice.motivo_bloqueo = None
        invoice.requiere_nc = False

    await db.commit()

    solicitud_nc_dict = {
        "id": str(nc_request_obj.id),
        "numero_solicitud": nc_request_obj.numero_solicitud,
        "monto_reclamado": float(nc_request_obj.monto_reclamado),
        "estado": nc_request_obj.estado,
    } if nc_request_obj else None

    mensaje = "Conciliación exitosa (Match 100%). Factura habilitada para Tesorería." if estado_match == "conciliado_100" else f"Discrepancia de {total_discrepancia_monto:,.0f} Gs. detectada. Solicitud de NC emitida."

    return {
        "invoice_id": str(invoice.id),
        "numero_factura": invoice.numero_factura,
        "timbrado": invoice.timbrado,
        "cdc": invoice.cdc,
        "purchase_order_id": str(po.id) if po else None,
        "purchase_order_numero": po.numero if po else None,
        "receipt_id": str(receipt.id) if receipt else None,
        "receipt_numero": receipt.numero if receipt else None,
        "estado_match": estado_match,
        "estado_matching": "match_perfecto" if estado_match == "conciliado_100" else "discrepancia_detectada",
        "mensaje": mensaje,
        "bloqueada_para_pago": invoice.bloqueada_para_pago,
        "motivo_bloqueo": invoice.motivo_bloqueo,
        "total_facturado": float(total_facturado),
        "total_factura": float(total_facturado),
        "total_recibido_val": float(total_recibido_val),
        "total_calculado_recepcion": float(total_recibido_val),
        "total_discrepancia_monto": float(total_discrepancia_monto),
        "diferencia_total": float(total_discrepancia_monto),
        "monto_neto_a_pagar": float(max(Decimal("0"), total_facturado - total_discrepancia_monto)),
        "solicitud_nc": solicitud_nc_dict,
        "nc_request_generada": solicitud_nc_dict,
        "items": discrepancias_lines,
        "discrepancias": discrepancias_lines,
    }


async def resolve_supplier_nc(
    db: AsyncSession,
    request_id: str,
    nc_recibida_numero: str,
    nc_recibida_timbrado: str,
    nc_recibida_monto: Decimal,
    nc_recibida_fecha: date,
    nc_recibida_cdc: Optional[str] = None,
    observaciones: Optional[str] = None,
    user_id: Optional[str] = None,
) -> dict[str, Any]:
    """Registra la entrega física/fiscal de la Nota de Crédito por parte del proveedor.

    Descuenta el monto de la factura en cuentas por pagar y, si el reclamo queda
    satisfecho, libera la factura para que Tesorería pueda proceder al pago neto.
    """
    req_uuid = uuid.UUID(request_id)
    req_q = select(SupplierNcRequest).where(SupplierNcRequest.id == req_uuid)
    req_res = await db.execute(req_q)
    nc_req = req_res.scalar_one_or_none()

    if not nc_req:
        raise ValueError("Solicitud de Nota de Crédito no encontrada.")

    # Cargar factura
    inv_q = select(SupplierInvoice).where(SupplierInvoice.id == nc_req.invoice_id)
    inv_res = await db.execute(inv_q)
    invoice = inv_res.scalar_one_or_none()

    if not invoice:
        raise ValueError("Factura asociada a la solicitud no encontrada.")

    # Actualizar la solicitud de NC
    nc_req.nc_recibida_numero = nc_recibida_numero
    nc_req.nc_recibida_timbrado = nc_recibida_timbrado
    nc_req.nc_recibida_cdc = nc_recibida_cdc
    nc_req.nc_recibida_monto = nc_recibida_monto
    nc_req.nc_recibida_fecha = nc_recibida_fecha
    nc_req.observaciones = f"{nc_req.observaciones or ''} | Resuelto: {observaciones or ''}".strip()
    nc_req.resolved_at = datetime.now(timezone.utc)

    # Descontar del saldo pendiente de la factura
    invoice.saldo_pendiente = max(Decimal("0"), (invoice.saldo_pendiente or invoice.total) - nc_recibida_monto)
    
    # Evaluar si cubre el total reclamado
    if nc_recibida_monto >= nc_req.monto_reclamado:
        nc_req.estado = "resuelta"
        invoice.monto_retenido_nc = Decimal("0")
        invoice.bloqueada_para_pago = False
        invoice.estado = "aprobada" if invoice.saldo_pendiente > 0 else "pagada"
        invoice.motivo_bloqueo = f"Liberada para pago: Nota de Crédito N° {nc_recibida_numero} recibida y aplicada por {nc_recibida_monto:,.0f} Gs."
    else:
        nc_req.estado = "entregada_parcial"
        rem = nc_req.monto_reclamado - nc_recibida_monto
        invoice.monto_retenido_nc = rem
        invoice.motivo_bloqueo = f"Retención parcial restante de {rem:,.0f} Gs pendiente de NC complementaria."

    await db.commit()

    return {
        "success": True,
        "solicitud_id": str(nc_req.id),
        "solicitud_numero": nc_req.numero_solicitud,
        "estado": nc_req.estado,
        "factura_id": str(invoice.id),
        "factura_numero": invoice.numero_factura,
        "nuevo_saldo_pendiente": float(invoice.saldo_pendiente),
        "bloqueada_para_pago": invoice.bloqueada_para_pago,
        "mensaje": f"Nota de Crédito {nc_recibida_numero} aplicada con éxito. Nuevo saldo a pagar: {invoice.saldo_pendiente:,.0f} Gs."
    }
