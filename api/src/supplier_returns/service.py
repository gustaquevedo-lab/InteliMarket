from decimal import Decimal
from datetime import datetime, timezone, date
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.supplier_returns.models import PurchaseReturn, PurchaseReturnItem
from api.src.supplier_returns.schemas import SupplierReturnCreate, SupplierReturnApprove
from api.src.inventory.models import Stock, InventoryMovement
from api.src.financial.models import SupplierInvoice


SUPPLIER_RETURN_MOTIVOS = [
    "producto_vencido", "producto_danado", "error_pedido",
    "calidad_deficiente", "exceso_stock", "producto_incorrecto", "otro",
]

SUPPLIER_RETURN_CONDITIONS = ["vencido", "danado", "buen_estado", "incompleto"]


async def generate_return_number(db: AsyncSession, company_id: str) -> str:
    date_part = datetime.now(timezone.utc).strftime("%Y%m%d")
    result = await db.execute(
        select(PurchaseReturn).where(PurchaseReturn.company_id == company_id)
        .order_by(PurchaseReturn.created_at.desc()).limit(1)
    )
    last = result.scalar_one_or_none()
    seq = int(last.numero.split("-")[-1]) + 1 if last and last.numero.startswith("DEVP-") else 1
    return f"DEVP-{date_part}-{seq:06d}"


async def create_return(db: AsyncSession, data: SupplierReturnCreate) -> PurchaseReturn:
    numero = await generate_return_number(db, str(data.company_id))

    subtotal = Decimal("0")
    iva_10 = Decimal("0")
    iva_5 = Decimal("0")
    total = Decimal("0")

    return_obj = PurchaseReturn(
        company_id=data.company_id,
        supplier_id=data.supplier_id,
        purchase_order_id=data.purchase_order_id,
        numero=numero,
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

        item = PurchaseReturnItem(
            return_id=return_obj.id,
            product_id=item_data.product_id,
            variant_id=item_data.variant_id,
            descripcion=item_data.descripcion,
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


async def get_return(db: AsyncSession, return_id: str) -> PurchaseReturn | None:
    result = await db.execute(select(PurchaseReturn).where(PurchaseReturn.id == uuid.UUID(return_id)))
    return result.scalar_one_or_none()


async def get_return_with_items(db: AsyncSession, return_id: str) -> dict | None:
    return_obj = await get_return(db, return_id)
    if not return_obj:
        return None
    items_result = await db.execute(select(PurchaseReturnItem).where(PurchaseReturnItem.return_id == return_obj.id))
    items = items_result.scalars().all()
    return {**{c.name: getattr(return_obj, c.name) for c in return_obj.__table__.columns}, "items": items}


async def list_returns(
    db: AsyncSession, company_id: str, estado: str | None = None,
    supplier_id: str | None = None, limit: int = 50, offset: int = 0,
) -> list[PurchaseReturn]:
    query = select(PurchaseReturn).where(PurchaseReturn.company_id == company_id)
    if estado:
        query = query.where(PurchaseReturn.estado == estado)
    if supplier_id:
        query = query.where(PurchaseReturn.supplier_id == supplier_id)
    query = query.order_by(PurchaseReturn.fecha.desc()).limit(limit).offset(offset)
    result = await db.execute(query)
    return list(result.scalars().all())


async def generate_credit_note_number(db: AsyncSession, company_id: str) -> str:
    date_part = datetime.now(timezone.utc).strftime("%Y%m%d")
    result = await db.execute(
        select(SupplierInvoice).where(
            SupplierInvoice.company_id == company_id,
            SupplierInvoice.numero_factura.like("NCPROV-%"),
        ).order_by(SupplierInvoice.created_at.desc()).limit(1)
    )
    last = result.scalar_one_or_none()
    seq = int(last.numero_factura.split("-")[-1]) + 1 if last else 1
    return f"NCPROV-{date_part}-{seq:06d}"


async def _create_supplier_credit_note(db: AsyncSession, return_obj: PurchaseReturn) -> uuid.UUID:
    """Nota de credito DEL proveedor (nos deben menos / nos deben devolver
    plata) -- sin esto, aprobar una devolucion a proveedor sacaba stock pero
    nunca aparecia en Cuentas por Pagar ni en ningun reporte financiero,
    quedaba invisible igual que pasaba con las devoluciones de clientes
    antes del fix de esa sesion."""
    numero = await generate_credit_note_number(db, str(return_obj.company_id))
    total = -abs(return_obj.total or Decimal("0"))
    today = datetime.now(timezone.utc).date()
    nc = SupplierInvoice(
        company_id=return_obj.company_id,
        supplier_id=return_obj.supplier_id,
        numero_factura=numero,
        fecha_emision=today,
        fecha_vencimiento=today,
        tipo_comprobante="nota_credito",
        condicion="credito",
        subtotal=-abs(return_obj.subtotal or Decimal("0")),
        iva_10=-abs(return_obj.iva_10 or Decimal("0")),
        iva_5=-abs(return_obj.iva_5 or Decimal("0")),
        total=total,
        saldo_pendiente=total,
        moneda=return_obj.moneda,
        tipo_cambio=return_obj.tipo_cambio,
        purchase_order_id=return_obj.purchase_order_id,
        estado="pendiente",
        concepto=f"Devolucion a proveedor {return_obj.numero} — {return_obj.motivo}",
    )
    db.add(nc)
    await db.flush()
    return nc.id


async def approve_return(db: AsyncSession, return_id: str, data: SupplierReturnApprove) -> PurchaseReturn | None:
    return_obj = await get_return(db, return_id)
    if not return_obj or return_obj.estado != "pendiente":
        return None

    return_obj.estado = "aprobado"
    return_obj.aprobado_por = data.aprobado_por
    return_obj.fecha_aprobacion = datetime.now(timezone.utc)
    if data.warehouse_id:
        return_obj.warehouse_id = data.warehouse_id

    warehouse_id = str(data.warehouse_id or return_obj.warehouse_id or "")

    items_result = await db.execute(select(PurchaseReturnItem).where(PurchaseReturnItem.return_id == return_obj.id))
    return_items = list(items_result.scalars().all())
    return_obj.supplier_invoice_id = await _create_supplier_credit_note(db, return_obj)

    for item in return_items:
        qty = int(item.cantidad)
        stock_result = await db.execute(
            select(Stock).where(
                Stock.product_id == item.product_id,
                Stock.warehouse_id == warehouse_id,
            ).limit(1)
        )
        stock = stock_result.scalar_one_or_none()
        if stock:
            stock.cantidad = (stock.cantidad or 0) - qty
            stock.updated_at = datetime.now(timezone.utc)

        movement = InventoryMovement(
            company_id=return_obj.company_id,
            warehouse_id=warehouse_id,
            product_id=item.product_id,
            variant_id=item.variant_id,
            tipo="salida_devolucion_proveedor",
            cantidad=-qty,
            referencia_type="supplier_return",
            referencia_id=return_obj.id,
            user_id=data.aprobado_por,
        )
        db.add(movement)

    return_obj.updated_at = datetime.now(timezone.utc)
    await db.flush()
    await db.refresh(return_obj)
    return return_obj


async def reject_return(db: AsyncSession, return_id: str, motivo: str) -> PurchaseReturn | None:
    return_obj = await get_return(db, return_id)
    if not return_obj or return_obj.estado != "pendiente":
        return None
    return_obj.estado = "rechazado"
    return_obj.observaciones = (return_obj.observaciones or "") + f"\nRechazo: {motivo}"
    return_obj.updated_at = datetime.now(timezone.utc)
    await db.flush()
    await db.refresh(return_obj)
    return return_obj
