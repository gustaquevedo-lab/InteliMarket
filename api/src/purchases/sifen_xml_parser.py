"""Parser robusto para Documentos Tributarios Electrónicos (DTE / Factura Electrónica) SIFEN Paraguay.

Permite leer archivos XML emitidos por proveedores (norma DNIT / SIFEN e-Kuatia),
extrayendo CDC, timbrado, RUC del emisor, receptor, condiciones comerciales,
e ítems detallados con sus códigos EAN y precios, y mapeándolos contra el catálogo
de productos y packs del supermercado.
"""

from __future__ import annotations

import re
from datetime import date, datetime
from decimal import Decimal
from typing import Any, Optional
from xml.etree import ElementTree as ET

from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.products.models import Product
from api.src.pack_barcodes.models import ProductPackBarcode


def _strip_ns(tag: str) -> str:
    """Remueve namespace XML {http://...}tag -> tag"""
    if "}" in tag:
        return tag.split("}", 1)[1]
    return tag


def _find_text(element: Optional[ET.Element], path_tags: list[str]) -> Optional[str]:
    """Busca recursivamente o por secuencia de tags ignorando namespaces"""
    if element is None:
        return None
    curr = [element]
    for tag in path_tags:
        nxt = []
        for c in curr:
            for child in c:
                if _strip_ns(child.tag).lower() == tag.lower():
                    nxt.append(child)
        if not nxt:
            return None
        curr = nxt
    if curr and curr[0].text:
        return curr[0].text.strip()
    return None


def parse_sifen_xml(xml_content: str | bytes) -> dict[str, Any]:
    """Parsea el contenido de un XML SIFEN (DTE) y extrae datos estructurados."""
    if isinstance(xml_content, str):
        xml_bytes = xml_content.encode("utf-8")
    else:
        xml_bytes = xml_content

    # Limpiar posibles caracteres BOM o basura inicial
    if xml_bytes.startswith(b"\xef\xbb\xbf"):
        xml_bytes = xml_bytes[3:]

    root = ET.fromstring(xml_bytes)

    # Buscar elemento DE (Documento Electrónico)
    de_elem = None
    if _strip_ns(root.tag).lower() == "de":
        de_elem = root
    else:
        for elem in root.iter():
            if _strip_ns(elem.tag).lower() == "de":
                de_elem = elem
                break

    if de_elem is None:
        raise ValueError("El archivo XML no contiene un elemento <DE> válido de SIFEN Paraguay.")

    # CDC: suele estar en de_elem.attrib['Id'] (ej. '01801503779001001000123412024090112345678901') o con prefijo 'DE'
    raw_id = de_elem.attrib.get("Id", "") or de_elem.attrib.get("id", "")
    cdc = re.sub(r"^DE", "", raw_id) if raw_id else None

    # Si no vino en el atributo Id, buscar <dProtAut> o <dCDC>
    if not cdc:
        for elem in root.iter():
            tag = _strip_ns(elem.tag).lower()
            if tag in ("dcdc", "cprotaut") and elem.text:
                cdc = elem.text.strip()
                break

    # 1. Datos del Timbrado y Documento
    timbrado = _find_element_text(de_elem, ["gTimb", "dNumTim"]) or _find_element_text(de_elem, ["dNumTim"]) or ""
    establecimiento = _find_element_text(de_elem, ["gTimb", "dEst"]) or "001"
    punto_expedicion = _find_element_text(de_elem, ["gTimb", "dPunExp"]) or "001"
    numero_doc = _find_element_text(de_elem, ["gTimb", "dNumDoc"]) or ""
    
    # Formatear número formal 001-001-0000123 si están los componentes
    if establecimiento and punto_expedicion and numero_doc:
        establecimiento_clean = establecimiento.zfill(3)
        punto_clean = punto_expedicion.zfill(3)
        numero_clean = numero_doc.zfill(7)
        numero_factura = f"{establecimiento_clean}-{punto_clean}-{numero_clean}"
    else:
        numero_factura = numero_doc or "S/N"

    # Fecha de emisión
    fecha_emision_raw = _find_element_text(de_elem, ["gDGen", "dFeEmiDE"]) or ""
    fecha_emision: Optional[date] = None
    if fecha_emision_raw:
        try:
            fecha_emision = datetime.fromisoformat(fecha_emision_raw.split("T")[0]).date()
        except Exception:
            fecha_emision = date.today()
    else:
        fecha_emision = date.today()

    tipo_documento_code = _find_element_text(de_elem, ["gTimb", "iTiDE"]) or "1"
    tipo_documento_desc = _find_element_text(de_elem, ["gTimb", "dDesTiDE"]) or "Factura electrónica"

    # 2. Datos del Emisor (Proveedor)
    emisor_ruc = _find_element_text(de_elem, ["gEmis", "dRucEm"]) or ""
    emisor_dv = _find_element_text(de_elem, ["gEmis", "dDVEmi"]) or ""
    emisor_ruc_completo = f"{emisor_ruc}-{emisor_dv}" if emisor_dv else emisor_ruc
    emisor_razon_social = _find_element_text(de_elem, ["gEmis", "dNomEmi"]) or "Proveedor Desconocido"
    emisor_nombre_fantasia = _find_element_text(de_elem, ["gEmis", "dNomFanEmi"]) or emisor_razon_social
    emisor_direccion = _find_element_text(de_elem, ["gEmis", "dDirEmi"]) or ""
    emisor_telefono = _find_element_text(de_elem, ["gEmis", "dTelEmi"]) or ""
    emisor_email = _find_element_text(de_elem, ["gEmis", "dEmailE"]) or ""

    # 3. Datos del Receptor
    receptor_ruc = _find_element_text(de_elem, ["gDatRec", "dRucRec"]) or ""
    receptor_dv = _find_element_text(de_elem, ["gDatRec", "dDVRec"]) or ""
    receptor_ruc_completo = f"{receptor_ruc}-{receptor_dv}" if receptor_dv else receptor_ruc
    receptor_razon_social = _find_element_text(de_elem, ["gDatRec", "dNomRec"]) or ""

    # 4. Condición de Operación
    condicion_code = _find_element_text(de_elem, ["gCamCond", "iCondOpe"]) or "1"
    condicion = "credito" if condicion_code == "2" else "contado"
    plazo_credito_dias = 30
    fecha_vencimiento: Optional[date] = None

    # Buscar cuotas o plazo en caso de crédito
    for cuota in de_elem.iter():
        if _strip_ns(cuota.tag).lower() == "gcuotas":
            venc_raw = _find_element_text(cuota, ["dVenCuo"])
            if venc_raw:
                try:
                    fecha_vencimiento = datetime.fromisoformat(venc_raw.split("T")[0]).date()
                    break
                except Exception:
                    pass

    if not fecha_vencimiento and fecha_emision:
        if condicion == "credito":
            from datetime import timedelta
            fecha_vencimiento = fecha_emision + timedelta(days=plazo_credito_dias)
        else:
            fecha_vencimiento = fecha_emision

    # Moneda
    moneda = _find_element_text(de_elem, ["gCamCond", "cMoneOpe"]) or "PYG"
    tipo_cambio_raw = _find_element_text(de_elem, ["gCamCond", "dTiCam"]) or "1"
    tipo_cambio = Decimal(tipo_cambio_raw) if tipo_cambio_raw else Decimal("1")

    # 5. Ítems detallados
    items: list[dict[str, Any]] = []
    for elem in de_elem.iter():
        if _strip_ns(elem.tag).lower() == "gcamitem":
            codigo_proveedor = _find_element_text(elem, ["dCodInt"]) or ""
            codigo_arancelario = _find_element_text(elem, ["dParAranc"]) or ""
            descripcion = _find_element_text(elem, ["dDesProSer"]) or "Producto"
            
            cantidad_raw = _find_element_text(elem, ["dCantProSer"]) or "1"
            precio_unit_raw = _find_element_text(elem, ["gValorItem", "dPUniProSer"]) or _find_element_text(elem, ["dPUniProSer"]) or "0"
            descuento_raw = _find_element_text(elem, ["gValorItem", "gValorRestaItem", "dDescItem"]) or "0"
            total_item_raw = _find_element_text(elem, ["gValorItem", "gValorRestaItem", "dTotOpeItem"]) or _find_element_text(elem, ["dTotOpeItem"]) or "0"

            cantidad = Decimal(cantidad_raw)
            precio_unitario = Decimal(precio_unit_raw)
            descuento = Decimal(descuento_raw)
            total_item = Decimal(total_item_raw) if total_item_raw != "0" else (cantidad * precio_unitario - descuento)

            # Tasa de IVA: iAfecIVA -> 1 (10%), 2 (5%), 3 (Exento), 4 (Exento)
            afec_iva = _find_element_text(elem, ["gCamIVA", "iAfecIVA"]) or "1"
            prop_iva = _find_element_text(elem, ["gCamIVA", "dPropIVA"]) or "100"
            tasa_iva_raw = _find_element_text(elem, ["gCamIVA", "dTasaIVA"]) or "10"
            
            if afec_iva in ("3", "4"):
                iva_tasa = Decimal("0")
            elif afec_iva == "2" or tasa_iva_raw == "5":
                iva_tasa = Decimal("5")
            else:
                iva_tasa = Decimal("10")

            # Identificar código de barras (puede estar en dCodInt o dParAranc si tiene 8, 12, 13 o 14 dígitos numéricos)
            codigo_barra_candidato = None
            for cod in (codigo_arancelario, codigo_proveedor):
                cleaned = re.sub(r"\D", "", cod)
                if len(cleaned) in (8, 12, 13, 14):
                    codigo_barra_candidato = cleaned
                    break

            items.append({
                "codigo_proveedor": codigo_proveedor,
                "codigo_arancelario": codigo_arancelario,
                "codigo_barra_candidato": codigo_barra_candidato,
                "descripcion": descripcion,
                "cantidad": cantidad,
                "precio_unitario": precio_unitario,
                "descuento": descuento,
                "iva_tasa": iva_tasa,
                "total": total_item,
            })

    # 6. Totales
    total_gral_raw = _find_element_text(de_elem, ["gTotSub", "dTotOpe"]) or "0"
    subtotal_10_raw = _find_element_text(de_elem, ["gTotSub", "dSub10"]) or "0"
    subtotal_5_raw = _find_element_text(de_elem, ["gTotSub", "dSub5"]) or "0"
    subtotal_exenta_raw = _find_element_text(de_elem, ["gTotSub", "dSubExe"]) or "0"
    iva_10_raw = _find_element_text(de_elem, ["gTotSub", "dIVA10"]) or "0"
    iva_5_raw = _find_element_text(de_elem, ["gTotSub", "dIVA5"]) or "0"
    descuento_total_raw = _find_element_text(de_elem, ["gTotSub", "dTotDesc"]) or "0"

    total = Decimal(total_gral_raw) if total_gral_raw != "0" else sum(it["total"] for it in items)
    iva_10 = Decimal(iva_10_raw)
    iva_5 = Decimal(iva_5_raw)
    descuento_total = Decimal(descuento_total_raw)
    subtotal = total - iva_10 - iva_5 + descuento_total

    return {
        "cdc": cdc,
        "timbrado": timbrado,
        "numero_factura": numero_factura,
        "establecimiento": establecimiento,
        "punto_expedicion": punto_expedicion,
        "numero_doc": numero_doc,
        "fecha_emision": fecha_emision,
        "fecha_vencimiento": fecha_vencimiento,
        "tipo_documento_code": tipo_documento_code,
        "tipo_documento_desc": tipo_documento_desc,
        "emisor": {
            "ruc": emisor_ruc_completo,
            "ruc_sin_dv": emisor_ruc,
            "dv": emisor_dv,
            "razon_social": emisor_razon_social,
            "nombre_fantasia": emisor_nombre_fantasia,
            "direccion": emisor_direccion,
            "telefono": emisor_telefono,
            "email": emisor_email,
        },
        "receptor": {
            "ruc": receptor_ruc_completo,
            "ruc_sin_dv": receptor_ruc,
            "dv": receptor_dv,
            "razon_social": receptor_razon_social,
        },
        "condicion": condicion,
        "moneda": moneda,
        "tipo_cambio": tipo_cambio,
        "subtotal": subtotal,
        "descuento": descuento_total,
        "iva_10": iva_10,
        "iva_5": iva_5,
        "total": total,
        "items": items,
    }


def _find_element_text(parent: ET.Element, tags: list[str]) -> Optional[str]:
    """Helper para encontrar texto por lista de tags relativos sin namespace"""
    curr = [parent]
    for tag in tags:
        nxt = []
        for c in curr:
            for child in c:
                if _strip_ns(child.tag).lower() == tag.lower():
                    nxt.append(child)
        if not nxt:
            return None
        curr = nxt
    if curr and curr[0].text:
        return curr[0].text.strip()
    return None


async def map_sifen_items_to_catalog(
    db: AsyncSession,
    company_id: str,
    parsed_items: list[dict[str, Any]]
) -> list[dict[str, Any]]:
    """Mapea los ítems parseados de un DTE contra el catálogo de productos de la empresa.

    Prioridad:
    1. Coincidencia por código de barras de pack/caja (ProductPackBarcode) -> devuelve producto base y factor.
    2. Coincidencia por código de barras unitario (Product.codigo_barra).
    3. Coincidencia por SKU (Product.sku = codigo_proveedor o codigo_barra_candidato).
    """
    mapped_items = []

    # Recolectar todos los códigos de barra y SKUs candidatos
    candidate_barcodes = set()
    candidate_skus = set()
    for it in parsed_items:
        if it.get("codigo_barra_candidato"):
            candidate_barcodes.add(it["codigo_barra_candidato"])
        if it.get("codigo_proveedor"):
            candidate_barcodes.add(it["codigo_proveedor"])
            candidate_skus.add(it["codigo_proveedor"])

    # 1. Buscar en ProductPackBarcode (códigos de caja/pack)
    pack_map = {}
    if candidate_barcodes:
        pack_q = select(ProductPackBarcode).where(
            ProductPackBarcode.company_id == company_id,
            ProductPackBarcode.codigo_barra.in_(candidate_barcodes),
            ProductPackBarcode.activo == True
        )
        pack_res = await db.execute(pack_q)
        for pb in pack_res.scalars().all():
            pack_map[pb.codigo_barra] = pb

    # 2. Buscar en Products por codigo_barra o sku
    prod_map_by_barcode = {}
    prod_map_by_sku = {}
    if candidate_barcodes or candidate_skus:
        conditions = []
        if candidate_barcodes:
            conditions.append(Product.codigo_barra.in_(candidate_barcodes))
        if candidate_skus:
            conditions.append(Product.sku.in_(candidate_skus))

        prod_q = select(Product).where(
            Product.company_id == company_id,
            or_(*conditions)
        )
        prod_res = await db.execute(prod_q)
        for p in prod_res.scalars().all():
            if p.codigo_barra:
                prod_map_by_barcode[p.codigo_barra] = p
            if p.sku:
                prod_map_by_sku[p.sku] = p

    # Mapear cada ítem
    for it in parsed_items:
        item_copy = dict(it)
        matched_product: Optional[Product] = None
        matched_pack: Optional[ProductPackBarcode] = None
        unidades_factor = Decimal("1")

        c1 = it.get("codigo_barra_candidato")
        c2 = it.get("codigo_proveedor")

        # Intentar pack de caja
        for cod in (c1, c2):
            if cod and cod in pack_map:
                matched_pack = pack_map[cod]
                unidades_factor = Decimal(str(matched_pack.unidades_por_paquete))
                # Cargar el producto base
                base_prod_res = await db.execute(select(Product).where(Product.id == matched_pack.product_id))
                matched_product = base_prod_res.scalar_one_or_none()
                break

        # Si no es pack, intentar producto por código de barras
        if not matched_product:
            for cod in (c1, c2):
                if cod and cod in prod_map_by_barcode:
                    matched_product = prod_map_by_barcode[cod]
                    break

        # Si no, intentar por SKU
        if not matched_product and c2 and c2 in prod_map_by_sku:
            matched_product = prod_map_by_sku[c2]

        if matched_product:
            item_copy["product_id"] = str(matched_product.id)
            item_copy["product_nombre"] = matched_product.nombre
            item_copy["product_sku"] = matched_product.sku
            item_copy["product_codigo_barra"] = matched_product.codigo_barra
            item_copy["product_costo_actual"] = float(matched_product.costo_unitario or 0)
            item_copy["unidades_por_paquete"] = float(unidades_factor)
            item_copy["cantidad_unidades_sueltas"] = float(it["cantidad"] * unidades_factor)
            item_copy["es_pack"] = matched_pack is not None
            item_copy["pack_etiqueta"] = matched_pack.etiqueta if matched_pack else None
            item_copy["mapeado"] = True
        else:
            item_copy["product_id"] = None
            item_copy["product_nombre"] = None
            item_copy["product_sku"] = None
            item_copy["product_codigo_barra"] = None
            item_copy["product_costo_actual"] = None
            item_copy["unidades_por_paquete"] = 1.0
            item_copy["cantidad_unidades_sueltas"] = float(it["cantidad"])
            item_copy["es_pack"] = False
            item_copy["pack_etiqueta"] = None
            item_copy["mapeado"] = False

        mapped_items.append(item_copy)

    return mapped_items
