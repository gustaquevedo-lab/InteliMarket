"""SIFEN service"""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime, timezone, date
import uuid

from api.src.sifen.models import SifenTimbrado, SifenResponse
from api.src.sifen.schemas import TimbradoCreate, SifenSendRequest
from api.src.sifen.xml_generator import generate_ekuatia_xml
from api.src.sifen.client import send_to_sifen, TIPO_DE_MAP
from api.src.sifen.cdc import validate_ruc, validate_cdc
from api.src.sales.models import Sale, SaleItem
from api.src.companies.models import Company
from api.src.customers.models import Customer


async def create_timbrado(db: AsyncSession, data: TimbradoCreate) -> SifenTimbrado:
    timbrado = SifenTimbrado(**data.model_dump())
    db.add(timbrado)
    await db.flush()
    await db.refresh(timbrado)
    return timbrado


async def get_active_timbrado(db: AsyncSession, company_id: str, tipo_comprobante: str | None = None) -> SifenTimbrado | None:
    query = select(SifenTimbrado).where(
        SifenTimbrado.company_id == company_id,
        SifenTimbrado.activo == True,
        SifenTimbrado.fecha_inicio <= date.today(),
        SifenTimbrado.fecha_fin >= date.today(),
    )
    if tipo_comprobante:
        query = query.where(SifenTimbrado.tipo_comprobante == tipo_comprobante)
    query = query.order_by(SifenTimbrado.fecha_inicio.desc()).limit(1)
    result = await db.execute(query)
    return result.scalar_one_or_none()


async def list_timbrados(db: AsyncSession, company_id: str) -> list[SifenTimbrado]:
    result = await db.execute(
        select(SifenTimbrado)
        .where(SifenTimbrado.company_id == company_id)
        .order_by(SifenTimbrado.fecha_inicio.desc())
    )
    return list(result.scalars().all())


async def send_sale_to_sifen(db: AsyncSession, sale_id: str) -> dict:
    sale_result = await db.execute(
        select(Sale).where(Sale.id == uuid.UUID(sale_id))
    )
    sale = sale_result.scalar_one_or_none()
    if not sale:
        return {"success": False, "error": "Venta no encontrada"}

    company_result = await db.execute(
        select(Company).where(Company.id == sale.company_id)
    )
    company = company_result.scalar_one_or_none()
    if not company:
        return {"success": False, "error": "Empresa no encontrada"}

    if not company.ruc:
        return {"success": False, "error": "La empresa no tiene RUC configurado"}

    if not validate_ruc(company.ruc):
        return {"success": False, "error": "RUC de la empresa invalido"}

    customer_name = "CONSUMIDOR FINAL"
    customer_ruc = None
    if sale.customer_id:
        customer_result = await db.execute(
            select(Customer).where(Customer.id == sale.customer_id)
        )
        customer = customer_result.scalar_one_or_none()
        if customer:
            customer_name = customer.razon_social
            customer_ruc = customer.ruc

    items_result = await db.execute(
        select(SaleItem).where(SaleItem.sale_id == sale.id)
    )
    items = items_result.scalars().all()

    items_dict = []
    for item in items:
        items_dict.append({
            "product_id": str(item.product_id),
            "descripcion": item.descripcion or "Item",
            "cantidad": float(item.cantidad),
            "precio_unitario": float(item.precio_unitario),
            "descuento_monto": float(item.descuento_monto or 0),
            "iva_tasa": float(item.iva_tasa),
        })

    timbrado = await get_active_timbrado(db, str(sale.company_id), sale.tipo_comprobante)
    if not timbrado:
        return {"success": False, "error": "No hay timbrado activo para esta empresa"}

    tipo_de = TIPO_DE_MAP.get(sale.tipo_comprobante, 1)

    xml_content, cdc = generate_ekuatia_xml(
        ruc_emisor=company.ruc,
        ruc_receptor=customer_ruc,
        nombre_receptor=customer_name,
        tipo_de=tipo_de,
        timbrado=timbrado.numero,
        numero=sale.numero,
        fecha_emision=sale.fecha or datetime.now(timezone.utc),
        condicion=sale.condicion,
        items=items_dict,
        moneda=sale.moneda,
        tipo_cambio=float(sale.tipo_cambio or 1),
    )

    if not validate_cdc(cdc):
        return {"success": False, "error": "CDC generado invalido"}

    sifen_result = await send_to_sifen(xml_content, cdc)

    sifen_response = SifenResponse(
        sale_id=sale.id,
        cdc=cdc,
        estado=sifen_result["estado"],
        codigo_error=sifen_result.get("codigo_error"),
        mensaje_error=sifen_result.get("mensaje"),
        xml_sent=xml_content,
        xml_response=sifen_result.get("xml_response", ""),
        fecha_respuesta=datetime.now(timezone.utc) if sifen_result["success"] else None,
    )
    db.add(sifen_response)

    sale.cdc = cdc
    sale.sifen_estado = sifen_result["estado"]
    sale.sifen_fecha_respuesta = sifen_response.fecha_respuesta
    sale.sifen_xml_sent = xml_content
    sale.sifen_xml_response = sifen_result.get("xml_response", "")

    await db.flush()

    return {
        "success": sifen_result["success"],
        "cdc": cdc,
        "estado": sifen_result["estado"],
        "mensaje": sifen_result.get("mensaje", ""),
    }


async def query_cdc(db: AsyncSession, cdc: str) -> dict:
    from api.src.sifen.client import sifen_client

    if not validate_cdc(cdc):
        return {"valido": False, "mensaje": "CDC con formato invalido"}

    try:
        result = await sifen_client.query_cdc(cdc)
        return {
            "valido": True,
            "cdc": cdc,
            "estado": result.get("estado"),
            "ruc_emisor": result.get("ruc_emisor"),
            "tipo_de": result.get("tipo_de"),
            "numero": result.get("numero"),
            "fecha_emision": result.get("fecha_emision"),
            "total": result.get("total"),
        }
    except Exception as e:
        return {"valido": False, "mensaje": str(e)}


async def get_sifen_responses(
    db: AsyncSession,
    company_id: str,
    estado: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> list[SifenResponse]:
    query = select(SifenResponse).join(Sale, SifenResponse.sale_id == Sale.id).where(
        Sale.company_id == company_id
    )
    if estado:
        query = query.where(SifenResponse.estado == estado)
    query = query.order_by(SifenResponse.fecha_envio.desc()).limit(limit).offset(offset)
    result = await db.execute(query)
    return list(result.scalars().all())
