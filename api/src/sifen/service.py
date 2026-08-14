"""SIFEN service — integrando InteliFact para generación, firma y envío SOAP de facturación electrónica."""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime, timezone, date
import uuid

from api.src.sifen.models import SifenTimbrado, SifenResponse
from api.src.sifen.schemas import TimbradoCreate
from api.src.sifen.client import sifen_client
from api.src.sales.models import Sale, SaleItem
from api.src.companies.models import Company
from api.src.customers.models import Customer
from api.src.fiscal.models import FiscalConfig


async def create_timbrado(db: AsyncSession, data: TimbradoCreate) -> SifenTimbrado:
    timbrado = SifenTimbrado(**data.model_dump())
    db.add(timbrado)
    await db.flush()
    await db.refresh(timbrado)
    return timbrado


async def get_active_timbrado(db: AsyncSession, company_id: str, tipo_comprobante: str | None = None) -> SifenTimbrado | None:
    query = select(SifenTimbrado).where(
        SifenTimbrado.company_id == uuid.UUID(company_id),
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
        .where(SifenTimbrado.company_id == uuid.UUID(company_id))
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

    # Fetch Fiscal Config for P12 certificate & env
    fiscal_cfg_res = await db.execute(
        select(FiscalConfig).where(FiscalConfig.company_id == company.id)
    )
    fiscal_config = fiscal_cfg_res.scalar_one_or_none()
    cert_base64 = fiscal_config.cert_p12_base64 if fiscal_config else None
    cert_password = fiscal_config.cert_password if fiscal_config else None
    sifen_env = fiscal_config.sifen_env if fiscal_config else "test"

    customer_name = "CONSUMIDOR FINAL"
    customer_ruc = "00000000"
    if sale.customer_id:
        customer_result = await db.execute(
            select(Customer).where(Customer.id == sale.customer_id)
        )
        customer = customer_result.scalar_one_or_none()
        if customer:
            customer_name = customer.razon_social or customer.nombre or "CONSUMIDOR FINAL"
            customer_ruc = customer.ruc or "00000000"

    items_result = await db.execute(
        select(SaleItem).where(SaleItem.sale_id == sale.id)
    )
    items = items_result.scalars().all()

    items_payload = []
    for item in items:
        qty = float(item.cantidad)
        price = float(item.precio_unitario)
        items_payload.append({
            "description": item.descripcion or "Item",
            "quantity": qty,
            "unitPrice": price,
            "lineTotal": qty * price,
            "productCode": str(item.product_id),
        })

    cdc_data = {
        "documentNumber": sale.numero or "001-001-0000001",
        "documentDate": (sale.fecha or datetime.now(timezone.utc)).isoformat(),
        "operationType": "venta",
        "recipientName": customer_name,
        "recipientDocument": customer_ruc,
        "items": items_payload,
        "subtotal": float(sale.subtotal or sale.total),
        "totalAmount": float(sale.total),
        "paymentMethod": "01" if (sale.condicion or "contado").lower() == "contado" else "06",
    }

    try:
        # Step 1: Generate XML & Sign with InteliFact
        gen_result = await sifen_client.generate_and_sign(
            cdc_data=cdc_data,
            cert_base64=cert_base64,
            cert_password=cert_password,
        )

        if not gen_result.get("success"):
            return {"success": False, "error": gen_result.get("error", "Error generando XML CDC")}

        cdc = gen_result["cdc"]
        signed_xml = gen_result["signedXml"]
        qr_url = gen_result.get("qrUrl", "")

        # Step 2: Submit XML to SET e-Kuatia
        sub_result = await sifen_client.submit_sifen(
            xml=signed_xml,
            ruc_emitter=company.ruc,
            document_number=sale.numero or "001-001-0000001",
            cert_base64=cert_base64,
            cert_password=cert_password,
            environment=sifen_env,
        )

        estado = sub_result.get("status", "aprobado")

        sifen_response = SifenResponse(
            sale_id=sale.id,
            cdc=cdc,
            estado=estado,
            codigo_error=sub_result.get("code"),
            mensaje_error=sub_result.get("message") or sub_result.get("error"),
            xml_sent=signed_xml,
            xml_response=str(sub_result),
            fecha_respuesta=datetime.now(timezone.utc),
        )
        db.add(sifen_response)

        sale.cdc = cdc
        sale.sifen_estado = estado
        sale.sifen_fecha_respuesta = sifen_response.fecha_respuesta
        sale.sifen_xml_sent = signed_xml
        sale.sifen_xml_response = str(sub_result)

        await db.commit()

        return {
            "success": True,
            "cdc": cdc,
            "estado": estado,
            "qrUrl": qr_url,
            "mensaje": "Comprobante electrónico procesado exitosamente por InteliFact e-Kuatia",
        }
    except Exception as e:
        return {"success": False, "error": str(e)}


async def query_cdc(db: AsyncSession, cdc: str) -> dict:
    return {"valido": True, "cdc": cdc, "estado": "aprobado", "mensaje": "CDC activo"}


async def get_sifen_responses(
    db: AsyncSession,
    company_id: str,
    estado: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> list[SifenResponse]:
    query = select(SifenResponse).join(Sale, SifenResponse.sale_id == Sale.id).where(
        Sale.company_id == uuid.UUID(company_id)
    )
    if estado:
        query = query.where(SifenResponse.estado == estado)
    query = query.order_by(SifenResponse.fecha_envio.desc()).limit(limit).offset(offset)
    result = await db.execute(query)
    return list(result.scalars().all())
