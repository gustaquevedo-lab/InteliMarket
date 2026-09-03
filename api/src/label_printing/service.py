import asyncio
import uuid
from datetime import date

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from api.src.label_printing.models import LabelPrinterConfig, LabelTemplate
from api.src.label_printing.schemas import (
    LabelPrinterConfigUpsert, LabelTemplateCreate, LabelSourceFilter, ResolvedLabelItem, PriceScaleTierItem,
)
from api.src.products.models import Product
from api.src.purchases.models import PurchaseReceipt, PurchaseReceiptItem, Supplier
from api.src.smart_pricing.models import TieredPrice

MAX_LABELS_POR_PROVEEDOR = 500  # sin esto, un proveedor con miles de productos activos generaba un lote sin tope


# ── Config de impresoras ──────────────────────────────────────────────────

async def get_printer_config(db: AsyncSession, company_id: str, tipo: str) -> LabelPrinterConfig | None:
    result = await db.execute(
        select(LabelPrinterConfig).where(
            LabelPrinterConfig.company_id == uuid.UUID(company_id),
            LabelPrinterConfig.tipo == tipo,
        )
    )
    return result.scalars().first()


async def upsert_printer_config(db: AsyncSession, company_id: str, tipo: str, data: LabelPrinterConfigUpsert) -> LabelPrinterConfig:
    existing = await get_printer_config(db, company_id, tipo)
    if existing:
        for field, value in data.model_dump().items():
            setattr(existing, field, value)
        await db.commit()
        await db.refresh(existing)
        return existing

    row = LabelPrinterConfig(company_id=uuid.UUID(company_id), tipo=tipo, **data.model_dump())
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return row


# ── Plantillas ─────────────────────────────────────────────────────────────

async def list_templates(db: AsyncSession, company_id: str, tipo_impresora: str | None = None) -> list[LabelTemplate]:
    stmt = select(LabelTemplate).where(LabelTemplate.company_id == uuid.UUID(company_id))
    if tipo_impresora:
        stmt = stmt.where(LabelTemplate.tipo_impresora == tipo_impresora)
    result = await db.execute(stmt.order_by(LabelTemplate.es_default.desc(), LabelTemplate.nombre))
    return list(result.scalars().all())


async def create_template(db: AsyncSession, company_id: str, data: LabelTemplateCreate) -> LabelTemplate:
    row = LabelTemplate(
        company_id=uuid.UUID(company_id),
        tipo_impresora=data.tipo_impresora,
        nombre=data.nombre,
        es_default=data.es_default,
        campos=data.campos.model_dump(),
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return row


async def delete_template(db: AsyncSession, company_id: str, template_id: str) -> bool:
    result = await db.execute(
        select(LabelTemplate).where(
            LabelTemplate.id == uuid.UUID(template_id),
            LabelTemplate.company_id == uuid.UUID(company_id),
        )
    )
    row = result.scalars().first()
    if not row:
        return False
    await db.delete(row)
    await db.commit()
    return True


# ── Resolución de origen ────────────────────────────────────────────────────

def _to_resolved(product: Product, cantidad: int, costo_unitario=None, proveedor_nombre: str | None = None, fecha: str | None = None) -> ResolvedLabelItem:
    return ResolvedLabelItem(
        product_id=product.id,
        nombre=product.nombre,
        categoria_nombre=product.categoria.nombre if product.categoria else None,
        sku=product.sku,
        codigo_barra=product.codigo_barra,
        precio_venta=product.precio_venta or 0,
        costo_unitario=costo_unitario if costo_unitario is not None else product.costo_promedio,
        proveedor_nombre=proveedor_nombre,
        fecha=fecha,
        cantidad=cantidad,
    )


async def resolve_label_items(db: AsyncSession, company_id: str, filtro: LabelSourceFilter) -> list[ResolvedLabelItem]:
    cid = uuid.UUID(company_id)
    items: list[ResolvedLabelItem] = []

    if filtro.producto_ids:
        ids = [item.product_id for item in filtro.producto_ids]
        result = await db.execute(select(Product).options(selectinload(Product.categoria)).where(Product.id.in_(ids), Product.company_id == cid))
        products = {p.id: p for p in result.scalars().all()}
        items = [
            _to_resolved(products[item.product_id], item.cantidad)
            for item in filtro.producto_ids
            if item.product_id in products
        ]

    elif filtro.receipt_id:
        result = await db.execute(
            select(PurchaseReceiptItem, Product, PurchaseReceipt, Supplier)
            .join(Product, Product.id == PurchaseReceiptItem.product_id)
            .options(selectinload(Product.categoria))
            .join(PurchaseReceipt, PurchaseReceipt.id == PurchaseReceiptItem.receipt_id)
            .outerjoin(Supplier, Supplier.id == PurchaseReceipt.supplier_id)
            .where(PurchaseReceiptItem.receipt_id == filtro.receipt_id, PurchaseReceipt.company_id == cid)
        )
        rows = result.all()
        items = [
            _to_resolved(
                product,
                int(receipt_item.cantidad_recibida),
                costo_unitario=receipt_item.costo_unitario,
                proveedor_nombre=supplier.razon_social if supplier else None,
                fecha=receipt.fecha.date().isoformat() if receipt.fecha else None,
            )
            for receipt_item, product, receipt, supplier in rows
        ]

    elif filtro.proveedor_id:
        latest_costo = (
            select(
                PurchaseReceiptItem.product_id,
                func.max(PurchaseReceiptItem.costo_unitario).label("costo_unitario"),
            )
            .join(PurchaseReceipt, PurchaseReceipt.id == PurchaseReceiptItem.receipt_id)
            .where(PurchaseReceipt.supplier_id == filtro.proveedor_id, PurchaseReceipt.company_id == cid)
            .group_by(PurchaseReceiptItem.product_id)
            .subquery()
        )
        supplier_result = await db.execute(select(Supplier).where(Supplier.id == filtro.proveedor_id))
        supplier = supplier_result.scalars().first()
        result = await db.execute(
            select(Product, latest_costo.c.costo_unitario)
            .join(latest_costo, latest_costo.c.product_id == Product.id)
            .options(selectinload(Product.categoria))
            .where(Product.company_id == cid, Product.activo.is_(True))
            .limit(MAX_LABELS_POR_PROVEEDOR)
        )
        items = [
            _to_resolved(product, filtro.cantidad_default, costo_unitario=costo, proveedor_nombre=supplier.razon_social if supplier else None)
            for product, costo in result.all()
        ]

    elif filtro.categoria_id:
        result = await db.execute(
            select(Product).options(selectinload(Product.categoria)).where(
                Product.company_id == cid,
                Product.categoria_id == filtro.categoria_id,
                Product.activo.is_(True),
            )
        )
        items = [_to_resolved(p, filtro.cantidad_default) for p in result.scalars().all()]

    # Cargar escalas de precios (Tiered Pricing) para los productos encontrados
    if items:
        pids = [i.product_id for i in items]
        tier_res = await db.execute(
            select(TieredPrice)
            .where(
                TieredPrice.company_id == cid,
                TieredPrice.product_id.in_(pids),
                TieredPrice.activo.is_(True),
                TieredPrice.price_list_id == None,
            )
            .order_by(TieredPrice.min_qty.asc())
        )
        tiers_by_prod: dict[uuid.UUID, list[PriceScaleTierItem]] = {}
        for tp in tier_res.scalars().all():
            tiers_by_prod.setdefault(tp.product_id, []).append(
                PriceScaleTierItem(min_qty=tp.min_qty, precio_unitario=tp.precio_unitario)
            )
        for it in items:
            it.escalas = tiers_by_prod.get(it.product_id, [])

    return items


# ── ZPL (Zebra) ──────────────────────────────────────────────────────────

def _zpl_escape(text: str) -> str:
    return (text or "").replace("^", "").replace("~", "")[:40]


def generate_zpl(items: list[ResolvedLabelItem], campos: dict, printer_config: LabelPrinterConfig) -> str:
    ancho_dots = int(float(printer_config.ancho_mm) * 8)  # ~203dpi = 8 dots/mm
    alto_dots = int(float(printer_config.alto_mm) * 8)
    blocks = []
    for item in items:
        for _ in range(item.cantidad):
            lines = [f"^XA", f"^PW{ancho_dots}", f"^LL{alto_dots}"]
            y = 20
            if campos.get("mostrar_nombre", True):
                lines.append(f"^FO10,{y}^A0N,{campos.get('fuente_tamano_nombre', 8) * 3},{campos.get('fuente_tamano_nombre', 8) * 3}^FD{_zpl_escape(item.nombre)}^FS")
                y += 40
            if campos.get("mostrar_precio", True):
                lines.append(f"^FO10,{y}^A0N,{campos.get('fuente_tamano_precio', 12) * 3},{campos.get('fuente_tamano_precio', 12) * 3}^FDGs. {item.precio_venta:,.0f}^FS")
                y += 50
            if campos.get("mostrar_costo", False) and item.costo_unitario is not None:
                lines.append(f"^FO10,{y}^A0N,20,20^FDCosto: Gs. {item.costo_unitario:,.0f}^FS")
                y += 30
            if campos.get("mostrar_proveedor", False) and item.proveedor_nombre:
                lines.append(f"^FO10,{y}^A0N,18,18^FD{_zpl_escape(item.proveedor_nombre)}^FS")
                y += 25
            if campos.get("mostrar_fecha", False) and item.fecha:
                lines.append(f"^FO10,{y}^A0N,18,18^FD{item.fecha}^FS")
                y += 25
            if campos.get("mostrar_barcode", True) and item.codigo_barra:
                lines.append(f"^FO10,{y}^BY2^BCN,60,Y,N,N^FD{item.codigo_barra}^FS")
            lines.append("^XZ")
            blocks.append("".join(lines))
    return "".join(blocks)


async def send_zpl_over_tcp(host: str, puerto: int, zpl: str, timeout: float = 10.0) -> None:
    reader, writer = await asyncio.wait_for(asyncio.open_connection(host, puerto), timeout=timeout)
    try:
        writer.write(zpl.encode("utf-8"))
        await writer.drain()
    finally:
        writer.close()
        await writer.wait_closed()
