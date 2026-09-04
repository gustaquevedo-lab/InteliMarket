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

from api.src.financial.models import SupplierInvoice, SupplierInvoiceItem
from api.src.purchases.models import Supplier, PurchaseOrder, PurchaseInboxConfig
from api.src.purchases.sifen_xml_parser import parse_sifen_xml, map_sifen_items_to_catalog

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
                content_disposition = str(part.get("Content-Disposition", ""))
                filename = part.get_filename()
                if filename:
                    filename = _decode_mime_header(filename).lower()

                payload = part.get_payload(decode=True)
                if not payload:
                    continue

                if filename and filename.endswith(".xml"):
                    xml_payloads.append((filename, payload))
                elif filename and filename.endswith(".zip"):
                    # Descomprimir zip en memoria por si el XML viene empaquetado
                    try:
                        with zipfile.ZipFile(io.BytesIO(payload)) as z:
                            for zname in z.namelist():
                                if zname.lower().endswith(".xml"):
                                    xml_payloads.append((zname, z.read(zname)))
                    except Exception as e:
                        logger.warning(f"Error al descomprimir adjunto ZIP {filename}: {e}")

            # Procesar cada XML encontrado
            for filename, xml_bytes in xml_payloads:
                try:
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
    user_id: Optional[str] = None
) -> dict[str, Any]:
    """Ingesta y persiste un DTE ya parseado en la base de datos como Factura de Proveedor."""
    company_uuid = uuid.UUID(company_id)
    cdc = dte_data.get("cdc")
    numero_factura = dte_data.get("numero_factura")
    timbrado = dte_data.get("timbrado")

    # 1. Verificar si ya existe por CDC o por (supplier, timbrado, numero_factura)
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
        # Buscar por RUC limpio (sin guion y con guion)
        sup_q = select(Supplier).where(
            Supplier.company_id == company_uuid,
            Supplier.ruc.in_([emisor_ruc, emisor.get("ruc_sin_dv"), emisor.get("ruc")])
        )
        sup_res = await db.execute(sup_q)
        supplier = sup_res.scalars().first()

    if not supplier:
        # Crear proveedor automáticamente a partir de los datos fiscales del DTE
        supplier = Supplier(
            company_id=company_uuid,
            ruc=emisor.get("ruc") or emisor.get("ruc_sin_dv") or "N/A",
            razon_social=emisor.get("razon_social") or emisor.get("nombre_fantasia") or "Proveedor SIFEN",
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

    # 3. Mapear los ítems contra el catálogo de productos local
    raw_items = dte_data.get("items", [])
    mapped_items = await map_sifen_items_to_catalog(db, company_id, raw_items)

    # 4. Buscar Orden de Compra candidata para pre-asociar
    # Busca órdenes abiertas de este proveedor
    po_candidata: Optional[PurchaseOrder] = None
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
        xml_sifen_url=xml_raw[:1000] if xml_raw else None,
        purchase_order_id=po_candidata.id if po_candidata else None,
        created_by=uuid.UUID(user_id) if user_id else None,
        bloqueada_para_pago=False,
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
    }
