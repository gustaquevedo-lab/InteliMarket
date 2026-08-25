from decimal import Decimal
from datetime import datetime, timezone
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

import re

from api.src.returns.models import Return, ReturnItem
from api.src.returns.schemas import ReturnCreate, ReturnApprove
from api.src.inventory.models import Stock, InventoryMovement
from api.src.products.models import Product
from api.src.customers.models import Customer
from api.src.sales.models import Sale
from api.src.fiscal.models import NotaCreditoDebito, PuntoEmisionSecuencia
from api.src.sifen.models import SifenTimbrado
from api.src.fiscal.service import reserve_fiscal_invoice_number, TimbradoAgotadoError, TimbradoVencidoError

NUMERO_FISCAL_RE = re.compile(r"^(\d{3})-(\d{3})-(\d+)$")


RETURN_MOTIVOS = [
    "producto_defectuoso", "producto_equivocado", "vencimiento",
    "dano_transporte", "cliente_insatisfecho", "error_venta",
    "devolucion_voluntaria", "garantia", "otro",
]

RETURN_CONDITIONS = ["buen_estado", "defectuoso", "danado", "vencido", "incompleto"]


async def generate_return_number(db: AsyncSession, company_id: str) -> str:
    date_part = datetime.now(timezone.utc).strftime("%Y%m%d")
    result = await db.execute(
        select(Return).where(Return.company_id == company_id).order_by(Return.created_at.desc()).limit(1)
    )
    last = result.scalar_one_or_none()
    seq = int(last.numero.split("-")[-1]) + 1 if last else 1
    return f"DEV-{date_part}-{seq:06d}"


async def create_return(db: AsyncSession, data: ReturnCreate) -> Return:
    numero = await generate_return_number(db, str(data.company_id))

    subtotal = Decimal("0")
    iva_10 = Decimal("0")
    iva_5 = Decimal("0")
    total = Decimal("0")

    return_obj = Return(
        company_id=data.company_id,
        branch_id=data.branch_id,
        sale_id=data.sale_id,
        customer_id=data.customer_id,
        numero=numero,
        tipo=data.tipo,
        motivo=data.motivo,
        motivo_detalle=data.motivo_detalle,
        estado="pendiente",
        moneda=data.moneda,
        tipo_cambio=data.tipo_cambio,
        observaciones=data.observaciones,
        warehouse_id=data.warehouse_id,
        user_id=data.user_id,
    )
    db.add(return_obj)
    await db.flush()

    for item_data in data.items:
        iva_tasa = Decimal(str(item_data.iva_tasa))
        base = Decimal(str(item_data.precio_unitario)) * Decimal(str(item_data.cantidad))
        if iva_tasa == Decimal("0"):
            iva_monto = Decimal("0")
            item_total = base
        else:
            iva_monto = (base * iva_tasa / Decimal("100")).quantize(Decimal("1"), rounding="ROUND_HALF_UP")
            item_total = base + iva_monto

        # Si no viene descripción, buscamos el producto
        desc = item_data.descripcion
        if not desc:
            p_res = await db.execute(select(Product.nombre).where(Product.id == item_data.product_id))
            desc = p_res.scalar_one_or_none()

        item = ReturnItem(
            return_id=return_obj.id,
            sale_item_id=item_data.sale_item_id,
            product_id=item_data.product_id,
            variant_id=item_data.variant_id,
            descripcion=desc,
            cantidad=item_data.cantidad,
            precio_unitario=item_data.precio_unitario,
            iva_tasa=item_data.iva_tasa,
            iva_monto=iva_monto,
            total=item_total,
            motivo_detalle=item_data.motivo_detalle,
            condicion=item_data.condicion,
        )
        db.add(item)

        subtotal += base
        if iva_tasa == Decimal("10"):
            iva_10 += iva_monto
        elif iva_tasa == Decimal("5"):
            iva_5 += iva_monto
        total += item_total

    return_obj.subtotal = subtotal
    return_obj.iva_10 = iva_10
    return_obj.iva_5 = iva_5
    return_obj.total = total

    await db.flush()
    await db.refresh(return_obj)
    return return_obj


async def get_return(db: AsyncSession, return_id: str) -> Return | None:
    result = await db.execute(select(Return).where(Return.id == uuid.UUID(return_id)))
    return result.scalar_one_or_none()


async def get_return_with_items(db: AsyncSession, return_id: str) -> dict | None:
    return_obj = await get_return(db, return_id)
    if not return_obj:
        return None

    # Obtenemos items con join a Producto
    stmt = (
        select(ReturnItem, Product.nombre, Product.sku, Product.codigo_barra)
        .outerjoin(Product, ReturnItem.product_id == Product.id)
        .where(ReturnItem.return_id == return_obj.id)
    )
    items_result = await db.execute(stmt)

    items_list = []
    for ri, p_name, p_sku, p_barcode in items_result.all():
        ri_dict = {c.name: getattr(ri, c.name) for c in ri.__table__.columns}
        ri_dict["product_name"] = p_name or ri.descripcion or "Producto General"
        ri_dict["product_sku"] = p_sku or p_barcode or ""
        ri_dict["descripcion"] = ri.descripcion or p_name or "Producto General"
        items_list.append(ri_dict)

    # Obtenemos cliente y venta si existen
    cust_name = None
    cust_ruc = None
    if return_obj.customer_id:
        c_res = await db.execute(select(Customer.razon_social, Customer.ruc).where(Customer.id == return_obj.customer_id))
        row = c_res.first()
        if row:
            cust_name, cust_ruc = row[0], row[1]

    sale_num = None
    if return_obj.sale_id:
        s_res = await db.execute(select(Sale.numero).where(Sale.id == return_obj.sale_id))
        sale_num = s_res.scalar_one_or_none()

    nc_numero = None
    if return_obj.nota_credito_id:
        nc_res = await db.execute(select(NotaCreditoDebito.numero).where(NotaCreditoDebito.id == return_obj.nota_credito_id))
        nc_numero = nc_res.scalar_one_or_none()

    ret_dict = {c.name: getattr(return_obj, c.name) for c in return_obj.__table__.columns}
    ret_dict["customer_name"] = cust_name
    ret_dict["customer_ruc"] = cust_ruc
    ret_dict["sale_numero"] = sale_num
    ret_dict["nota_credito_numero"] = nc_numero
    ret_dict["items"] = items_list

    return ret_dict


async def list_returns(
    db: AsyncSession, company_id: str, estado: str | None = None, limit: int = 200, offset: int = 0,
) -> list[dict]:
    query = (
        select(Return, Customer.razon_social, Customer.ruc, Sale.numero, NotaCreditoDebito.numero)
        .outerjoin(Customer, Return.customer_id == Customer.id)
        .outerjoin(Sale, Return.sale_id == Sale.id)
        .outerjoin(NotaCreditoDebito, Return.nota_credito_id == NotaCreditoDebito.id)
        .where(Return.company_id == company_id)
    )
    if estado:
        # manejar estados con flexibilidad (aprobado / aprobada, rechazado / rechazada)
        if estado == "aprobado":
            query = query.where(Return.estado.in_(["aprobado", "aprobada", "Aprobado", "APROBADO"]))
        elif estado == "rechazado":
            query = query.where(Return.estado.in_(["rechazado", "rechazada", "Rechazado", "RECHAZADO"]))
        elif estado == "pendiente":
            query = query.where(Return.estado.in_(["pendiente", "Pendiente", "PENDIENTE"]))
        else:
            query = query.where(Return.estado == estado)

    query = query.order_by(Return.fecha.desc()).limit(limit).offset(offset)
    result = await db.execute(query)

    records = []
    for ret, c_name, c_ruc, s_num, nc_num in result.all():
        d = {c.name: getattr(ret, c.name) for c in ret.__table__.columns}
        d["customer_name"] = c_name
        d["customer_ruc"] = c_ruc
        d["sale_numero"] = s_num
        d["nota_credito_numero"] = nc_num
        records.append(d)

    return records


async def approve_return(db: AsyncSession, return_id: str, data: ReturnApprove) -> Return | None:
    return_obj = await get_return(db, return_id)
    if not return_obj or return_obj.estado not in ("pendiente", "Pendiente"):
        return None

    return_obj.estado = "aprobado"
    return_obj.aprobado_por = data.aprobado_por
    return_obj.fecha_aprobacion = datetime.now(timezone.utc)
    if data.warehouse_id:
        return_obj.warehouse_id = data.warehouse_id

    warehouse_id = str(data.warehouse_id or return_obj.warehouse_id or "")

    items_result = await db.execute(select(ReturnItem).where(ReturnItem.return_id == return_obj.id))
    for item in items_result.scalars().all():
        qty = int(item.cantidad)
        stock_result = await db.execute(
            select(Stock).where(
                Stock.product_id == item.product_id,
                Stock.warehouse_id == warehouse_id,
            ).limit(1)
        )
        stock = stock_result.scalar_one_or_none()
        if stock:
            stock.cantidad += qty
            stock.updated_at = datetime.now(timezone.utc)
        else:
            stock = Stock(
                company_id=return_obj.company_id,
                warehouse_id=warehouse_id,
                product_id=item.product_id,
                cantidad=qty,
            )
            db.add(stock)

        movement = InventoryMovement(
            company_id=return_obj.company_id,
            warehouse_id=warehouse_id,
            product_id=item.product_id,
            variant_id=item.variant_id,
            tipo="entrada_devolucion",
            cantidad=qty,
            referencia_type="return",
            referencia_id=return_obj.id,
            user_id=data.aprobado_por,
        )
        db.add(movement)

    # ── Nota de Crédito real, numerada por punto de emisión (autoimpresor) ──
    # Antes la devolución solo revertía stock -- no se generaba ningún
    # documento fiscal, así que no había nada para imprimir. Se reserva un
    # número real de la secuencia "nota_credito" del punto de emisión de la
    # venta original (misma tabla que ya usa la numeración de factura) y se
    # crea el NotaCreditoDebito. Sin CDC/SIFEN a propósito -- el cliente es
    # autoimpresor, no factura electrónica.
    nota_credito_numero = None
    nota_credito_error = None
    sale = None
    if return_obj.sale_id:
        sale_result = await db.execute(select(Sale).where(Sale.id == return_obj.sale_id))
        sale = sale_result.scalar_one_or_none()

    punto_emision = None
    if sale and sale.numero:
        m = NUMERO_FISCAL_RE.match(sale.numero)
        if m:
            punto_emision = m.group(2)

    if not punto_emision:
        nota_credito_error = "La venta original no tiene un número fiscal con punto de emisión reconocible."
    else:
        try:
            numero_reservado = await reserve_fiscal_invoice_number(db, str(return_obj.company_id), punto_emision, "nota_credito")
        except (TimbradoAgotadoError, TimbradoVencidoError, ValueError) as e:
            nota_credito_error = str(e)
        else:
            timbrado_result = await db.execute(
                select(SifenTimbrado.numero)
                .join(PuntoEmisionSecuencia, PuntoEmisionSecuencia.timbrado_id == SifenTimbrado.id)
                .where(
                    PuntoEmisionSecuencia.company_id == return_obj.company_id,
                    PuntoEmisionSecuencia.punto_emision == punto_emision,
                    PuntoEmisionSecuencia.tipo_documento == "nota_credito",
                )
                .limit(1)
            )
            timbrado_numero = timbrado_result.scalar_one_or_none()

            # No hay desglose de base 5%/10% por línea a nivel de Return (solo
            # el agregado) -- se aproxima toda la base gravada al tramo que
            # tenga IVA, razonable para este negocio donde una devolución
            # mixta 5%/10% en la misma boleta es rarísima.
            tiene_iva_10 = (return_obj.iva_10 or 0) > 0
            nota = NotaCreditoDebito(
                company_id=return_obj.company_id,
                sale_id=return_obj.sale_id,
                tipo="credito",
                numero=numero_reservado,
                timbrado_numero=timbrado_numero,
                motivo=f"Devolución {return_obj.numero} — {return_obj.motivo}",
                subtotal=return_obj.subtotal or 0,
                descuento_total=0,
                base_gravada_10=(return_obj.subtotal or 0) if tiene_iva_10 else 0,
                base_gravada_5=(return_obj.subtotal or 0) if not tiene_iva_10 and (return_obj.iva_5 or 0) > 0 else 0,
                base_exenta=0,
                iva_10=return_obj.iva_10 or 0,
                iva_5=return_obj.iva_5 or 0,
                total=return_obj.total or 0,
                estado="emitido",
                user_id=data.aprobado_por,
            )
            db.add(nota)
            await db.flush()
            await db.refresh(nota)
            return_obj.nota_credito_id = nota.id
            nota_credito_numero = nota.numero

    return_obj.updated_at = datetime.now(timezone.utc)
    await db.flush()
    await db.refresh(return_obj)
    setattr(return_obj, "nota_credito_numero", nota_credito_numero)
    setattr(return_obj, "nota_credito_error", nota_credito_error)
    return return_obj


async def reject_return(db: AsyncSession, return_id: str, motivo: str) -> Return | None:
    return_obj = await get_return(db, return_id)
    if not return_obj or return_obj.estado not in ("pendiente", "Pendiente"):
        return None
    return_obj.estado = "rechazado"
    return_obj.observaciones = (return_obj.observaciones or "") + f"\nRechazo: {motivo}"
    return_obj.updated_at = datetime.now(timezone.utc)
    await db.flush()
    await db.refresh(return_obj)
    return return_obj
