"""Servicio de lectura e ingesta automática de Facturas Electrónicas XML desde cuenta IMAP (cPanel).

Permite conectar a la cuenta de correo corporativo (ej. facturaelectronica@superextra.com.py),
descargar adjuntos XML (y ZIP que contengan XML), parsear los DTE de SIFEN,
registrar proveedores y facturas con sus ítems detallados, y dejarlas listas para
la recepción en muelle y el 3-way matching.
"""

from __future__ import annotations

import email
from email.header import decode_header
import imaplib
import io
import logging
import zipfile
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any, Optional
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.financial.models import SupplierInvoice, SupplierInvoiceItem, SupplierCreditNote, SupplierCreditNoteApplication
from api.src.purchases.models import Supplier, PurchaseOrder, PurchaseInboxConfig, PurchaseReceipt, SupplierNcRequest
from api.src.purchases.sifen_xml_parser import parse_sifen_xml, map_sifen_items_to_catalog
from api.src.purchases.utils import normalize_invoice_number, invoice_numbers_match

logger = logging.getLogger(__name__)


def _decode_mime_header(header_value: str | None) -> str:
    """Decodifica encabezados MIME que puedan tener codificación ISO-8859 o UTF-8."""
    if not header_value:
        return ""
    parts = decode_header(header_value)
    decoded_fragments = []
    for content, encoding in parts:
        if isinstance(content, bytes):
            enc = encoding or "utf-8"
            try:
                decoded_fragments.append(content.decode(enc, errors="replace"))
            except Exception:
                decoded_fragments.append(content.decode("utf-8", errors="replace"))
        else:
            decoded_fragments.append(str(content))
    return "".join(decoded_fragments)


def _connect_imap(cfg: PurchaseInboxConfig) -> imaplib.IMAP4:
    """Establece conexión IMAP según la configuración dinámica."""
    if cfg.imap_ssl:
        client = imaplib.IMAP4_SSL(cfg.imap_host, cfg.imap_port)
    else:
        client = imaplib.IMAP4(cfg.imap_host, cfg.imap_port)
    client.login(cfg.imap_user, cfg.imap_password)
    return client


async def sync_inbox_emails(
    db: AsyncSession,
    company_id: str,
    max_emails: int = 50,
    only_unseen: bool = True
) -> dict[str, Any]:
    """Sincroniza la bandeja de correo IMAP configurada para la empresa y procesa facturas XML."""
    q_cfg = select(PurchaseInboxConfig).where(
        PurchaseInboxConfig.company_id == uuid.UUID(company_id),
        PurchaseInboxConfig.activo == True
    )
    res_cfg = await db.execute(q_cfg)
    cfg = res_cfg.scalar_one_or_none()

    if not cfg:
        return {
            "success": False,
            "error": "No hay configuración de correo IMAP activa para esta empresa. Configure el correo en Ajustes de Compras."
        }

    client = None
    resumen = {
        "success": True,
        "emails_procesados": 0,
        "facturas_nuevas": 0,
        "facturas_existentes": 0,
        "errores": [],
        "facturas": []
    }

    try:
        client = _connect_imap(cfg)
        status, _ = client.select(cfg.imap_folder or "INBOX")
        if status != "OK":
            raise ValueError(f"No se pudo seleccionar la carpeta '{cfg.imap_folder}'")

        # Buscar correos
        search_criterion = "UNSEEN" if only_unseen else "ALL"
        status, data = client.search(None, search_criterion)
        if status != "OK" or not data or not data[0]:
            cfg.ultimo_sync = datetime.now(timezone.utc)
            cfg.ultimo_error = None
            await db.commit()
            return resumen

        email_ids = data[0].split()
        # Procesar los más recientes primero, limitado por max_emails
        email_ids = email_ids[-max_emails:]
        email_ids.reverse()

        for eid in email_ids:
            resumen["emails_procesados"] += 1
            status, msg_data = client.fetch(eid, "(RFC822)")
            if status != "OK" or not msg_data:
                continue

            raw_email = msg_data[0][1]
            msg = email.message_from_bytes(raw_email)
            subject = _decode_mime_header(msg.get("Subject"))
            sender = _decode_mime_header(msg.get("From"))

            # Extraer adjuntos XML
            xml_payloads = []
            for part in msg.walk():
                ctype = (part.get_content_type() or "").lower()
                raw_fname = part.get_filename() or part.get_param("name")
                filename = _decode_mime_header(raw_fname).strip().lower() if raw_fname else ""

                payload = part.get_payload(decode=True)
                if not payload:
                    continue

                is_zip = filename.endswith(".zip") or "zip" in ctype or payload.startswith(b"PK\x03\x04")
                is_xml = (
                    filename.endswith(".xml") or
                    "xml" in ctype or
                    payload.lstrip().startswith(b"<?xml") or
                    payload.lstrip().startswith(b"<rDE") or
                    b"<dVerFor>" in payload
                )

                if is_xml and not is_zip:
                    xml_payloads.append((filename or f"factura_{eid.decode()}.xml", payload))
                elif is_zip:
                    # Descomprimir zip en memoria por si el XML viene empaquetado
                    try:
                        with zipfile.ZipFile(io.BytesIO(payload)) as z:
                            for zname in z.namelist():
                                z_lower = zname.lower()
                                if z_lower.endswith(".xml"):
                                    xml_payloads.append((zname, z.read(zname)))
                    except Exception as e:
                        logger.warning(f"Error al descomprimir adjunto ZIP {filename or 'archivo.zip'}: {e}")

            # Procesar cada XML encontrado
            for filename, xml_bytes in xml_payloads:
                try:
                    async with db.begin_nested():
                        dte_data = parse_sifen_xml(xml_bytes)
                        invoice_res = await ingest_parsed_dte(
                            db=db,
                            company_id=company_id,
                            dte_data=dte_data,
                            xml_raw=xml_bytes.decode("utf-8", errors="replace"),
                            origen="imap",
                            origen_info=f"Asunto: {subject} | De: {sender} | Archivo: {filename}"
                        )
                        if invoice_res.get("created"):
                            resumen["facturas_nuevas"] += 1
                            resumen["facturas"].append(invoice_res)
                        else:
                            resumen["facturas_existentes"] += 1
                    await db.commit()
                except Exception as e:
                    err_msg = f"Error al procesar {filename} en correo '{subject}': {str(e)}"
                    logger.warning(err_msg)
                    resumen["errores"].append(err_msg)

        cfg.ultimo_sync = datetime.now(timezone.utc)
        cfg.ultimo_error = None
        await db.commit()

    except Exception as e:
        logger.error(f"Error en sincronización IMAP: {e}", exc_info=True)
        if cfg:
            cfg.ultimo_error = str(e)
            await db.commit()
        return {
            "success": False,
            "error": f"Error al conectar o sincronizar correo IMAP: {str(e)}",
            "detalles": resumen
        }
    finally:
        if client:
            try:
                client.close()
                client.logout()
            except Exception:
                pass

    return resumen


async def ingest_parsed_dte(
    db: AsyncSession,
    company_id: str,
    dte_data: dict[str, Any],
    xml_raw: Optional[str] = None,
    origen: str = "manual",
    origen_info: Optional[str] = None,
    user_id: Optional[str] = None,
    purchase_order_id: Optional[str] = None,
) -> dict[str, Any]:
    """Ingesta y persiste un DTE ya parseado en la base de datos como Factura de Proveedor."""
    company_uuid = uuid.UUID(company_id)
    cdc = dte_data.get("cdc")
    raw_numero_factura = dte_data.get("numero_factura")
    numero_factura = normalize_invoice_number(raw_numero_factura) or raw_numero_factura
    timbrado = dte_data.get("timbrado")
    tipo_doc_code = str(dte_data.get("tipo_documento_code") or "1").strip().lstrip("0")

    # 0. Filtrar Notas de Remisión (tipo 7): no generan deuda ni crédito
    if tipo_doc_code == "7":
        return {
            "created": False,
            "id": None,
            "numero_factura": numero_factura,
            "cdc": cdc,
            "mensaje": f"Nota de remisión electrónica {numero_factura} omitida de cuentas por pagar."
        }

    # 1. Verificar si ya existe por CDC en facturas
    if cdc:
        existing_q = select(SupplierInvoice).where(
            SupplierInvoice.company_id == company_uuid,
            SupplierInvoice.cdc == cdc
        )
        existing_res = await db.execute(existing_q)
        existing_inv = existing_res.scalar_one_or_none()
        if existing_inv:
            return {
                "created": False,
                "id": str(existing_inv.id),
                "numero_factura": existing_inv.numero_factura,
                "cdc": existing_inv.cdc,
                "mensaje": "Factura ya registrada anteriormente con este CDC."
            }

    # 2. Localizar o crear el proveedor
    emisor = dte_data.get("emisor", {})
    emisor_ruc = emisor.get("ruc") or emisor.get("ruc_sin_dv")
    supplier: Optional[Supplier] = None

    if emisor_ruc:
        ruc_raw = emisor_ruc.strip()
        ruc_sin_dv = emisor.get("ruc_sin_dv") or (ruc_raw.split("-")[0] if "-" in ruc_raw else ruc_raw)
        clean_num = ruc_sin_dv.lstrip("0")
        candidates = list({c for c in [ruc_raw, ruc_sin_dv, clean_num, f"{clean_num}-{emisor.get('dv')}" if emisor.get('dv') else None] if c})
        
        from sqlalchemy import or_
        sup_q = select(Supplier).where(
            Supplier.company_id == company_uuid,
            or_(
                Supplier.ruc.in_(candidates),
                Supplier.ruc.like(f"{clean_num}-%") if clean_num else False,
                Supplier.ruc == clean_num
            )
        )
        sup_res = await db.execute(sup_q)
        supplier = sup_res.scalars().first()

    if not supplier:
        # Crear proveedor automáticamente a partir de los datos fiscales del DTE
        razon_social = emisor.get("razon_social") or emisor.get("nombre_fantasia") or "Proveedor SIFEN"
        supplier = Supplier(
            company_id=company_uuid,
            ruc=emisor.get("ruc") or emisor.get("ruc_sin_dv") or "N/A",
            razon_social=razon_social,
            direccion=emisor.get("direccion"),
            telefono=emisor.get("telefono"),
            email=emisor.get("email"),
            activo=True,
            tipo_proveedor="nacional",
            moneda_default=dte_data.get("moneda", "PYG"),
            notas=f"Auto-creado desde DTE SIFEN. {origen_info or ''}".strip(),
        )
        db.add(supplier)
        await db.flush()

    # 2b. Si es Nota de Crédito Electrónica (tipo 5), registrar en SupplierCreditNote
    if tipo_doc_code == "5":
        ex_nc_q = select(SupplierCreditNote).where(
            SupplierCreditNote.company_id == company_uuid,
            SupplierCreditNote.supplier_id == supplier.id,
            SupplierCreditNote.numero == numero_factura
        )
        ex_nc_res = await db.execute(ex_nc_q)
        ex_nc = ex_nc_res.scalar_one_or_none()
        if ex_nc:
            return {
                "created": False,
                "id": str(ex_nc.id),
                "numero_factura": ex_nc.numero,
                "mensaje": f"Nota de crédito {numero_factura} ya registrada anteriormente para {supplier.razon_social}."
            }

        total_nc = dte_data.get("total", Decimal("0"))
        nc = SupplierCreditNote(
            company_id=company_uuid,
            supplier_id=supplier.id,
            numero=numero_factura or "S/N",
            timbrado=timbrado,
            fecha=dte_data.get("fecha_emision") or datetime.now().date(),
            monto=total_nc,
            saldo_disponible=total_nc,
            moneda=dte_data.get("moneda", "PYG"),
            motivo="Nota de crédito electrónica SIFEN",
            observaciones=f"Ingresado vía {origen}. {origen_info or ''}".strip(),
            cancelado=False,
            impacto_contable="devolucion_credito",
            motivo_categoria="devolucion"
        )
        db.add(nc)
        await db.flush()

        # Vinculación formal por documento asociado extraído del XML SIFEN (gCamDEAsoc)
        fac_asoc_num = dte_data.get("numero_factura_asociada")
        if fac_asoc_num:
            nc.numero_factura_origen = fac_asoc_num

        # AUTO-CONCILIACIÓN INTELIGENTE:
        # 1. Si el XML indica explícitamente la factura asociada (gCamDEAsoc), conciliarla prioritariamente
        # 2. Si no, o complementariamente, buscar si hay una SNC pendiente que calce con esta NC
        try:
            target_inv = None
            if fac_asoc_num:
                inv_match_q = select(SupplierInvoice).where(
                    SupplierInvoice.company_id == company_uuid,
                    SupplierInvoice.supplier_id == supplier.id,
                    SupplierInvoice.numero_factura == fac_asoc_num,
                    SupplierInvoice.estado != "cancelada"
                )
                target_inv = (await db.execute(inv_match_q)).scalars().first()

            snc_q = select(SupplierNcRequest).where(
                SupplierNcRequest.company_id == company_uuid,
                SupplierNcRequest.supplier_id == supplier.id,
                SupplierNcRequest.estado.in_(("pendiente_entrega", "entregada_parcial"))
            ).order_by(SupplierNcRequest.created_at.asc())
            open_sncs = (await db.execute(snc_q)).scalars().all()
            
            matched_snc = None
            for s in open_sncs:
                # Si coincide factura o coincide monto exacto
                if (target_inv and s.invoice_id == target_inv.id) or (abs((s.monto_reclamado or Decimal("0")) - total_nc) <= Decimal("10")):
                    matched_snc = s
                    break
            
            if matched_snc:
                matched_snc.estado = "resuelta"
                matched_snc.resolved_at = datetime.now(timezone.utc)
                matched_snc.nc_recibida_numero = nc.numero
                matched_snc.nc_recibida_timbrado = nc.timbrado
                matched_snc.nc_recibida_monto = total_nc
                matched_snc.nc_recibida_fecha = nc.fecha
                matched_snc.observaciones = f"{(matched_snc.observaciones or '').strip()} [Auto-conciliada con NC SIFEN {nc.numero}]".strip()
                if not target_inv and matched_snc.invoice_id:
                    target_inv = (await db.execute(select(SupplierInvoice).where(SupplierInvoice.id == matched_snc.invoice_id, SupplierInvoice.estado != 'cancelada'))).scalar_one_or_none()

            if target_inv:
                if not nc.numero_factura_origen:
                    nc.numero_factura_origen = target_inv.numero_factura

                monto_aplicar = min(total_nc, target_inv.saldo_pendiente or Decimal("0"))
                if monto_aplicar > Decimal("0"):
                    target_inv.saldo_pendiente = max(Decimal("0"), (target_inv.saldo_pendiente or Decimal("0")) - monto_aplicar)
                    nc.saldo_disponible = max(Decimal("0"), total_nc - monto_aplicar)
                else:
                    nc.saldo_disponible = Decimal("0")

                target_inv.monto_retenido_nc = max(Decimal("0"), (target_inv.monto_retenido_nc or Decimal("0")) - total_nc)
                if target_inv.monto_retenido_nc <= Decimal("10"):
                    target_inv.monto_retenido_nc = Decimal("0")
                    target_inv.requiere_nc = False
                    target_inv.bloqueada_para_pago = False
                    target_inv.motivo_bloqueo = None
                if (target_inv.saldo_pendiente or Decimal("0")) <= Decimal("0"):
                    target_inv.estado = "pagada"
                elif target_inv.estado == "retenida_discrepancia":
                    target_inv.estado = "aprobada"

                db.add(SupplierCreditNoteApplication(
                    company_id=company_uuid,
                    credit_note_id=nc.id,
                    invoice_id=target_inv.id,
                    monto_aplicado=total_nc,
                    observaciones=f"Compensación formal de NC SIFEN {nc.numero} referenciada a {target_inv.numero_factura}"
                ))
                logger.info(f"NC SIFEN {nc.numero} aplicada formalmente a factura {target_inv.numero_factura} por ₲ {total_nc:,.0f}")
        except Exception as e_snc:
            logger.warning(f"Error menor en auto-conciliación de NC {nc.numero}: {e_snc}")

        return {
            "created": True,
            "id": str(nc.id),
            "tipo": "nota_credito",
            "numero_factura": nc.numero,
            "timbrado": nc.timbrado,
            "supplier_id": str(supplier.id),
            "supplier_nombre": supplier.razon_social,
            "total": float(nc.monto),
            "items_count": 0,
            "items_mapeados": 0,
        }

    # Verificar si ya existe factura con este número para este proveedor
    if supplier and numero_factura:
        cands = list({c for c in [numero_factura, raw_numero_factura, (raw_numero_factura or '').strip()] if c})
        ex_q = select(SupplierInvoice).where(
            SupplierInvoice.company_id == company_uuid,
            SupplierInvoice.supplier_id == supplier.id,
            SupplierInvoice.numero_factura.in_(cands),
            SupplierInvoice.estado.not_in(["cancelada", "cancelado", "anulada"])
        ).order_by(SupplierInvoice.created_at.asc())
        ex_res = await db.execute(ex_q)
        ex_inv = ex_res.scalars().first()
        if ex_inv:
            # Enriquecer con los datos fiscales oficiales del DTE si no los tenía
            modificado = False
            if cdc and not ex_inv.cdc:
                ex_inv.cdc = cdc
                modificado = True
            if timbrado and not ex_inv.timbrado:
                ex_inv.timbrado = timbrado
                modificado = True
            if xml_raw and not ex_inv.xml_sifen_url:
                ex_inv.xml_sifen_url = xml_raw
                modificado = True
            if modificado:
                await db.flush()
            return {
                "created": False,
                "id": str(ex_inv.id),
                "numero_factura": ex_inv.numero_factura,
                "cdc": ex_inv.cdc,
                "mensaje": f"Factura {numero_factura} enriquecida con datos fiscales de SIFEN para {supplier.razon_social}."
            }

    # 3. Mapear los ítems contra el catálogo de productos local
    raw_items = dte_data.get("items", [])
    mapped_items = await map_sifen_items_to_catalog(db, company_id, raw_items)

    # 4. Buscar Orden de Compra candidata para pre-asociar
    po_candidata: Optional[PurchaseOrder] = None
    if purchase_order_id:
        po_q = select(PurchaseOrder).where(
            PurchaseOrder.id == uuid.UUID(purchase_order_id),
            PurchaseOrder.company_id == company_uuid
        )
        po_res = await db.execute(po_q)
        po_candidata = po_res.scalar_one_or_none()

    if not po_candidata:
        po_q = select(PurchaseOrder).where(
            PurchaseOrder.company_id == company_uuid,
            PurchaseOrder.supplier_id == supplier.id,
            PurchaseOrder.estado.in_(["confirmado", "enviada", "parcial"])
        ).order_by(PurchaseOrder.created_at.desc())
        po_res = await db.execute(po_q)
        pos = po_res.scalars().all()
        
        # Intentar match por monto similar o primer orden abierta
        for po in pos:
            if abs((po.total or 0) - dte_data["total"]) < Decimal("5000"):  # Diferencia de menos de 5.000 Gs
                po_candidata = po
                break
        if not po_candidata and pos:
            po_candidata = pos[0]

    # 4b. Buscar Recepción en Muelle (PurchaseReceipt) candidata para pre-asociar
    receipt_candidata: Optional[PurchaseReceipt] = None
    if po_candidata:
        rec_q = select(PurchaseReceipt).where(
            PurchaseReceipt.purchase_order_id == po_candidata.id,
            PurchaseReceipt.estado != "cancelado"
        ).order_by(PurchaseReceipt.created_at.desc())
        rec_res = await db.execute(rec_q)
        receipt_candidata = rec_res.scalars().first()

    if not receipt_candidata and supplier and numero_factura:
        rec_q = select(PurchaseReceipt).where(
            PurchaseReceipt.company_id == company_uuid,
            PurchaseReceipt.supplier_id == supplier.id,
            PurchaseReceipt.estado != "cancelado"
        ).order_by(PurchaseReceipt.created_at.desc()).limit(30)
        rec_res = await db.execute(rec_q)
        for cand in rec_res.scalars().all():
            if cand.proveedor_ref and invoice_numbers_match(cand.proveedor_ref, numero_factura):
                receipt_candidata = cand
                break

    # 5. Crear la Factura de Proveedor
    total = dte_data.get("total", Decimal("0"))
    invoice = SupplierInvoice(
        company_id=company_uuid,
        supplier_id=supplier.id,
        numero_factura=numero_factura or "S/N",
        timbrado=timbrado,
        cdc=cdc,
        fecha_emision=dte_data.get("fecha_emision") or datetime.now().date(),
        fecha_recepcion=datetime.now().date(),
        fecha_vencimiento=dte_data.get("fecha_vencimiento") or datetime.now().date(),
        subtotal=dte_data.get("subtotal", Decimal("0")),
        descuento=dte_data.get("descuento", Decimal("0")),
        iva_10=dte_data.get("iva_10", Decimal("0")),
        iva_5=dte_data.get("iva_5", Decimal("0")),
        total=total,
        saldo_pendiente=total,
        moneda=dte_data.get("moneda", "PYG"),
        tipo_cambio=dte_data.get("tipo_cambio", Decimal("1")),
        condicion=dte_data.get("condicion", "credito"),
        tipo_comprobante="factura",
        estado="pendiente",
        concepto=f"Factura SIFEN {numero_factura} de {supplier.razon_social}",
        notas=f"Ingresado vía {origen}. {origen_info or ''}".strip(),
        xml_sifen_url=xml_raw if xml_raw else None,
        purchase_order_id=po_candidata.id if po_candidata else None,
        receipt_id=receipt_candidata.id if receipt_candidata else None,
        created_by=uuid.UUID(user_id) if user_id else None,
        bloqueada_para_pago=True if (po_candidata or receipt_candidata) else False,
    )
    db.add(invoice)
    await db.flush()

    # 6. Crear los ítems de la factura
    created_items = []
    for it in mapped_items:
        prod_id = uuid.UUID(it["product_id"]) if it.get("product_id") else None
        item_obj = SupplierInvoiceItem(
            invoice_id=invoice.id,
            product_id=prod_id,
            codigo_proveedor=it.get("codigo_proveedor") or it.get("codigo_arancelario"),
            descripcion=it.get("descripcion", "Item"),
            cantidad=Decimal(str(it.get("cantidad", 1))),
            precio_unitario=Decimal(str(it.get("precio_unitario", 0))),
            descuento=Decimal(str(it.get("descuento", 0))),
            iva_tasa=Decimal(str(it.get("iva_tasa", 10))),
            total=Decimal(str(it.get("total", 0))),
        )
        db.add(item_obj)
        created_items.append(item_obj)

    await db.flush()

    # 7. Ejecutar matching de inmediato contra el pedido y/o recepción si están asociados
    matching_info = None
    if po_candidata or receipt_candidata:
        from api.src.purchases.matching_service import perform_3way_match
        try:
            matching_info = await perform_3way_match(db, str(invoice.id), user_id)
        except Exception as e:
            logger.warning(f"Error al ejecutar matching automático en ingesta de factura {invoice.id}: {e}")

    return {
        "created": True,
        "id": str(invoice.id),
        "numero_factura": invoice.numero_factura,
        "timbrado": invoice.timbrado,
        "cdc": invoice.cdc,
        "supplier_id": str(supplier.id),
        "supplier_nombre": supplier.razon_social,
        "total": float(invoice.total),
        "items_count": len(created_items),
        "items_mapeados": sum(1 for it in mapped_items if it.get("mapeado")),
        "purchase_order_id": str(po_candidata.id) if po_candidata else None,
        "purchase_order_numero": po_candidata.numero if po_candidata else None,
        "matching": matching_info,
    }
