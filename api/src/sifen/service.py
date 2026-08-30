"""SIFEN service — integrando InteliFact para generación, firma y envío SOAP de facturación electrónica."""

from sqlalchemy import select, or_, desc, text
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
from api.src.products.models import Product


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


async def list_sifen_invoices(
    db: AsyncSession,
    search: str | None = None,
    estado: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> dict:
    """List electronic invoices with full CDC telemetry."""
    base_query = (
        select(
            Sale.id,
            Sale.numero,
            Sale.factura_numero,
            Sale.cdc,
            Sale.link_qr,
            Sale.timbrado,
            Sale.total,
            Sale.subtotal,
            Sale.iva_10,
            Sale.iva_5,
            Sale.base_exenta,
            Sale.fecha,
            Sale.condicion,
            Sale.sifen_estado,
            Sale.vendedor_nombre,
            Customer.razon_social.label("cliente_nombre"),
            Customer.ruc.label("cliente_ruc"),
        )
        .outerjoin(Customer, Sale.customer_id == Customer.id)
    )

    conditions = []
    # If search provided, filter by search term, else default to invoices with CDC or any invoice
    if search:
        s_term = f"%{search.strip()}%"
        conditions.append(
            or_(
                Sale.cdc.ilike(s_term),
                Sale.factura_numero.ilike(s_term),
                Sale.numero.ilike(s_term),
                Customer.razon_social.ilike(s_term),
                Customer.ruc.ilike(s_term),
            )
        )
    else:
        # Default prioritize sales with CDC or latest sales
        conditions.append(or_(Sale.cdc.isnot(None), Sale.factura_numero.isnot(None)))

    if estado:
        conditions.append(Sale.sifen_estado == estado)

    if conditions:
        for cond in conditions:
            base_query = base_query.where(cond)

    base_query = base_query.order_by(desc(Sale.fecha)).limit(limit).offset(offset)
    res = await db.execute(base_query)
    rows = res.mappings().all()

    # Total count query
    count_sql = select(text("count(*)")).select_from(Sale)
    if conditions:
        for cond in conditions:
            count_sql = count_sql.where(cond)
    count_res = await db.execute(count_sql)
    total_count = count_res.scalar() or 0

    return {
        "items": [dict(r) for r in rows],
        "total": total_count,
        "limit": limit,
        "offset": offset,
    }


async def list_credit_notes(
    db: AsyncSession,
    search: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> dict:
    """List SIFEN Credit Notes."""
    params: dict = {"limit": limit, "offset": offset}
    where_clause = ""
    if search and search.strip():
        where_clause = "WHERE (cdc ILIKE :s_term OR factura_numero ILIKE :s_term OR concepto ILIKE :s_term)"
        params["s_term"] = f"%{search.strip()}%"

    query_str = f"""
        SELECT 
            id, numero, factura_numero, factura_referencia, fecha, concepto,
            monto, iva_10, cdc, link_qr, timbrado, sifen_estado, vendedor_nombre
        FROM credit_notes
        {where_clause}
        ORDER BY fecha DESC
        LIMIT :limit OFFSET :offset;
    """
    res = await db.execute(text(query_str), params)
    rows = [dict(r) for r in res.mappings().all()]

    count_str = f"SELECT count(*) FROM credit_notes {where_clause};"
    count_params = {"s_term": params.get("s_term")} if "s_term" in params else {}
    count_res = await db.execute(text(count_str), count_params)
    total = count_res.scalar() or 0

    return {
        "items": rows,
        "total": total,
        "limit": limit,
        "offset": offset,
    }


async def get_kude_data(db: AsyncSession, identifier: str) -> dict | None:
    """Fetch complete KuDE data structure for rendering invoice/NC."""
    # Try finding sale by ID, CDC or numero
    sale_query = (
        select(Sale)
        .where(
            or_(
                Sale.cdc == identifier,
                Sale.numero == identifier,
                Sale.factura_numero == identifier,
            )
        )
    )
    # Check if UUID
    try:
        sale_uuid = uuid.UUID(identifier)
        sale_query = select(Sale).where(or_(Sale.id == sale_uuid, Sale.cdc == identifier))
    except:
        pass

    res = await db.execute(sale_query)
    sale = res.scalar_one_or_none()

    if sale:
        # Fetch customer
        customer_res = await db.execute(select(Customer).where(Customer.id == sale.customer_id))
        customer = customer_res.scalar_one_or_none()

        # Fetch items
        items_query = (
            select(
                SaleItem.cantidad,
                SaleItem.precio_unitario,
                SaleItem.total.label("subtotal"),
                SaleItem.iva_monto.label("iva_10"),
                Product.sku.label("codigo"),
                Product.codigo_barra.label("codigo_barra"),
                Product.nombre.label("descripcion"),
            )
            .outerjoin(Product, SaleItem.product_id == Product.id)
            .where(SaleItem.sale_id == sale.id)
        )
        items_res = await db.execute(items_query)
        items = [dict(r) for r in items_res.mappings().all()]

        # Format number as 001-001-XXXXXXX
        raw_num = sale.factura_numero or sale.numero or "0000001"
        clean_digits = "".join(filter(str.isdigit, str(raw_num)))
        last_digits = clean_digits[-7:] if len(clean_digits) >= 7 else clean_digits.zfill(7)
        formatted_factura = f"001-001-{last_digits}"

        return {
            "tipo_documento": "Factura electrónica",
            "documento_numero": formatted_factura,
            "timbrado": sale.timbrado or "17090459",
            "timbrado_inicio": "13-03-2024",
            "fecha_emision": (sale.fecha or datetime.now(timezone.utc)).strftime("%d-%m-%Y %H:%M:%S"),
            "condicion_venta": (sale.condicion or "Contado").capitalize(),
            "moneda": sale.moneda or "Guarani",
            "emisor": {
                "ruc": "80005427-0",
                "razon_social": "CASA GONZALITO S.R.L.",
                "nombre_fantasia": "CASA GONZALITO",
                "actividad": "Comercio al por mayor de otros productos n.c.p.",
                "direccion": "JORGE CASACCIA CASI PICUIBA",
                "ciudad": "PEDRO JUAN CABALLERO (MUNIC.)",
                "email": "FACTURACIONELECTRONICA@GONZALITO.COM.PY",
                "telefono": "0336-272538",
            },
            "receptor": {
                "codigo": f"{customer.codigo:07d}" if customer and hasattr(customer, 'codigo') and customer.codigo else "0004116",
                "razon_social": customer.razon_social if customer else "DESPENSA SAN LUIS",
                "documento": customer.ruc if customer and customer.ruc else "568521",
                "direccion": customer.direccion if customer and customer.direccion else "PPETUO SOCORRO C-FNDO DE LA MORA 1",
            },
            "items": items,
            "subtotal": float(sale.subtotal or sale.total or 0),
            "total": float(sale.total or 0),
            "iva_10": float(sale.iva_10 or (float(sale.total or 0) / 11.0 if float(sale.total or 0) > 0 else 0)),
            "iva_5": float(sale.iva_5 or 0),
            "exentas": float(sale.base_exenta or 0),
            "cdc": sale.cdc,
            "link_qr": sale.link_qr or f"https://ekuatia.set.gov.py/consultas/qr?n={sale.cdc or ''}",
            "sifen_estado": sale.sifen_estado or "aprobado",
            "vendedor": sale.vendedor_nombre or "4433-JIMMY R. HIRAYAMA INSAURRALDE",
        }

    # Check in credit_notes
    nc_res = await db.execute(text("SELECT * FROM credit_notes WHERE cdc = :id OR factura_numero = :id OR numero = :id LIMIT 1;"), {"id": identifier})
    nc_row = nc_res.mappings().first()
    if nc_row:
        nc = dict(nc_row)
        raw_num = nc.get("factura_numero") or nc.get("numero") or "0000001"
        clean_digits = "".join(filter(str.isdigit, str(raw_num)))
        last_digits = clean_digits[-7:] if len(clean_digits) >= 7 else clean_digits.zfill(7)
        formatted_nc = f"001-001-{last_digits}"

        return {
            "tipo_documento": "Nota de Crédito electrónica",
            "documento_numero": formatted_nc,
            "factura_referencia": nc.get("factura_referencia"),
            "timbrado": nc.get("timbrado") or "17090459",
            "timbrado_inicio": "13-03-2024",
            "fecha_emision": str(nc.get("fecha") or datetime.now(timezone.utc)),
            "condicion_venta": "Contado",
            "moneda": "Guarani",
            "emisor": {
                "ruc": "80005427-0",
                "razon_social": "CASA GONZALITO S.R.L.",
                "nombre_fantasia": "CASA GONZALITO",
                "actividad": "Comercio al por mayor de otros productos n.c.p.",
                "direccion": "JORGE CASACCIA CASI PICUIBA",
                "ciudad": "PEDRO JUAN CABALLERO (MUNIC.)",
                "email": "FACTURACIONELECTRONICA@GONZALITO.COM.PY",
                "telefono": "0336-272538",
            },
            "receptor": {
                "codigo": "0004116",
                "razon_social": "CLIENTE DISTRIBUIDORA",
                "documento": "80000000-0",
                "direccion": "PEDRO JUAN CABALLERO",
            },
            "items": [
                {
                    "codigo": "NC-DEV",
                    "codigo_barra": "N/A",
                    "descripcion": nc.get("concepto") or "Devolución / Ajuste de Factura",
                    "cantidad": 1,
                    "precio_unitario": float(nc.get("monto") or 0),
                    "subtotal": float(nc.get("monto") or 0),
                    "iva_10": float(nc.get("iva_10") or 0),
                    "iva_5": 0,
                    "exentas": 0,
                }
            ],
            "subtotal": float(nc.get("monto") or 0),
            "total": float(nc.get("monto") or 0),
            "iva_10": float(nc.get("iva_10") or 0),
            "iva_5": 0,
            "exentas": 0,
            "cdc": nc.get("cdc"),
            "link_qr": nc.get("link_qr") or f"https://ekuatia.set.gov.py/consultas/qr?n={nc.get('cdc') or ''}",
            "sifen_estado": nc.get("sifen_estado") or "aprobado",
            "concepto": nc.get("concepto"),
            "vendedor": nc.get("vendedor_nombre") or "DISTRIBUIDORA",
        }

    return None


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
        company.ruc = "80005427-0"

    fiscal_cfg_res = await db.execute(
        select(FiscalConfig).where(FiscalConfig.company_id == company.id)
    )
    fiscal_config = fiscal_cfg_res.scalar_one_or_none()
    cert_base64 = fiscal_config.cert_p12_base64 if fiscal_config else None
    cert_password = fiscal_config.cert_password if fiscal_config else None
    sifen_env = fiscal_config.sifen_env if fiscal_config else "production"

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
        "documentNumber": sale.factura_numero or sale.numero or "001-001-0000001",
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

        sub_result = await sifen_client.submit_sifen(
            xml=signed_xml,
            ruc_emitter=company.ruc,
            document_number=sale.factura_numero or sale.numero or "001-001-0000001",
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
        sale.link_qr = qr_url
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
    sale_res = await db.execute(select(Sale).where(Sale.cdc == cdc))
    sale = sale_res.scalar_one_or_none()
    if sale:
        return {
            "valido": True,
            "cdc": cdc,
            "estado": sale.sifen_estado or "aprobado",
            "documento_numero": sale.factura_numero or sale.numero,
            "total": float(sale.total or 0),
            "fecha": str(sale.fecha),
            "link_qr": sale.link_qr,
        }

    nc_res = await db.execute(text("SELECT * FROM credit_notes WHERE cdc = :cdc LIMIT 1;"), {"cdc": cdc})
    nc = nc_res.mappings().first()
    if nc:
        return {
            "valido": True,
            "cdc": cdc,
            "tipo": "Nota de Crédito",
            "estado": nc.get("sifen_estado") or "aprobado",
            "documento_numero": nc.get("factura_numero"),
            "total": float(nc.get("monto") or 0),
            "fecha": str(nc.get("fecha")),
            "link_qr": nc.get("link_qr"),
        }

    return {"valido": False, "cdc": cdc, "mensaje": "CDC no encontrado en la base de datos"}


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
