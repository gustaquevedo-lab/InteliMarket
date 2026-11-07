"""Pack barcode service"""

import logging
import uuid
from sqlalchemy import select, update, func
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.pack_barcodes.models import ProductPackBarcode
from api.src.pack_barcodes.schemas import PackBarcodeCreate, PackBarcodeUpdate
from api.src.products.models import Product
from api.src.variants.models import ProductVariant

logger = logging.getLogger(__name__)


class PackBarcodeCollisionError(Exception):
    pass


async def _check_collision(db: AsyncSession, company_id: str, codigo_barra: str, exclude_pack_id: str | None = None) -> None:
    """Un código de pack/sinónimo multiorigen no puede coincidir con el código o SKU
    de ningún producto activo, variante activa, ni otro código de pack activo.
    Si el código pertenece a un producto o variante inactiva, se libera automáticamente
    para permitir que el producto activo utilice su código legítimo."""
    c_uuid = uuid.UUID(str(company_id))

    # 1. Colisión con Producto
    prod_result = await db.execute(
        select(Product.id, Product.sku, Product.nombre, Product.activo, Product.codigo_barra).where(
            Product.company_id == c_uuid,
            (Product.codigo_barra == codigo_barra) | (Product.sku == codigo_barra),
        )
    )
    prod = prod_result.first()
    if prod:
        if prod.activo:
            raise PackBarcodeCollisionError(
                f"El código '{codigo_barra}' ya está en uso como código/SKU del producto activo '{prod.nombre}' (SKU {prod.sku})"
            )
        else:
            # Si coincide con el código de barras de un producto inactivo, liberarlo automáticamente
            if prod.codigo_barra == codigo_barra:
                await db.execute(
                    update(Product)
                    .where(Product.id == prod.id)
                    .values(codigo_barra=None, updated_at=func.now())
                )
                logger.info(
                    "Código de barras '%s' liberado automáticamente del producto inactivo '%s' (SKU %s) para reasignación en pack/sinónimo.",
                    codigo_barra, prod.nombre, prod.sku
                )
            elif prod.sku == codigo_barra:
                raise PackBarcodeCollisionError(
                    f"El código '{codigo_barra}' coincide con el SKU del producto histórico/inactivo '{prod.nombre}' (SKU {prod.sku}). Debe utilizar un código de barras diferente."
                )

    # 2. Colisión con Variante
    var_result = await db.execute(
        select(ProductVariant.id, ProductVariant.sku_variante, Product.nombre, Product.activo)
        .join(Product, ProductVariant.product_id == Product.id)
        .where(
            ProductVariant.company_id == c_uuid,
            ProductVariant.codigo_barra == codigo_barra,
        )
    )
    var = var_result.first()
    if var:
        if var.activo:
            raise PackBarcodeCollisionError(
                f"El código '{codigo_barra}' ya está en uso como código de la variante '{var.sku_variante}' de '{var.nombre}'"
            )
        else:
            await db.execute(
                update(ProductVariant)
                .where(ProductVariant.id == var.id)
                .values(codigo_barra=None)
            )
            logger.info(
                "Código de barras '%s' liberado automáticamente de la variante inactiva '%s'.",
                codigo_barra, var.sku_variante
            )

    # 3. Colisión con otro Código de Pack / Caja
    pack_query = (
        select(ProductPackBarcode.id, ProductPackBarcode.etiqueta, ProductPackBarcode.activo, Product.sku, Product.nombre)
        .join(Product, ProductPackBarcode.product_id == Product.id)
        .where(
            ProductPackBarcode.company_id == c_uuid,
            ProductPackBarcode.codigo_barra == codigo_barra,
        )
    )
    if exclude_pack_id:
        pack_query = pack_query.where(ProductPackBarcode.id != uuid.UUID(str(exclude_pack_id)))
    pack_result = await db.execute(pack_query)
    pack = pack_result.first()
    if pack:
        if pack.activo:
            raise PackBarcodeCollisionError(
                f"El código '{codigo_barra}' ya está registrado como '{pack.etiqueta}' del producto '{pack.nombre}' (SKU {pack.sku})"
            )
        else:
            await db.execute(
                update(ProductPackBarcode)
                .where(ProductPackBarcode.id == pack.id)
                .values(codigo_barra=None, activo=False)
            )


async def list_pack_barcodes(db: AsyncSession, product_id: str) -> list[ProductPackBarcode]:
    result = await db.execute(
        select(ProductPackBarcode).where(
            ProductPackBarcode.product_id == uuid.UUID(product_id),
            ProductPackBarcode.activo == True,
        ).order_by(ProductPackBarcode.unidades_por_paquete)
    )
    return list(result.scalars().all())


async def create_pack_barcode(db: AsyncSession, company_id: str, product_id: str, data: PackBarcodeCreate) -> ProductPackBarcode:
    await _check_collision(db, company_id, data.codigo_barra)
    pack = ProductPackBarcode(
        product_id=uuid.UUID(product_id),
        company_id=uuid.UUID(str(company_id)),
        codigo_barra=data.codigo_barra,
        etiqueta=data.etiqueta,
        unidades_por_paquete=data.unidades_por_paquete,
    )
    db.add(pack)
    await db.commit()
    await db.refresh(pack)
    return pack


async def get_pack_barcode(db: AsyncSession, pack_id: str) -> ProductPackBarcode | None:
    result = await db.execute(select(ProductPackBarcode).where(ProductPackBarcode.id == uuid.UUID(pack_id)))
    return result.scalar_one_or_none()


async def update_pack_barcode(db: AsyncSession, company_id: str, pack_id: str, data: PackBarcodeUpdate) -> ProductPackBarcode | None:
    pack = await get_pack_barcode(db, pack_id)
    if not pack:
        return None
    update_data = data.model_dump(exclude_unset=True)
    if "codigo_barra" in update_data and update_data["codigo_barra"] != pack.codigo_barra:
        await _check_collision(db, company_id, update_data["codigo_barra"], exclude_pack_id=pack_id)
    for key, value in update_data.items():
        setattr(pack, key, value)
    await db.commit()
    await db.refresh(pack)
    return pack


async def list_all_company_pack_barcodes(db: AsyncSession, company_id: str, product_id: str | None = None) -> list[dict]:
    from sqlalchemy import text
    comp_uuid = uuid.UUID(str(company_id))
    where = "ppb.company_id = :comp_id AND ppb.activo = true"
    params: dict = {"comp_id": comp_uuid}

    if product_id:
        where += " AND ppb.product_id = :prod_id"
        params["prod_id"] = uuid.UUID(str(product_id))

    query = f"""
        SELECT ppb.id, ppb.product_id, ppb.company_id, ppb.codigo_barra, ppb.etiqueta,
               ppb.unidades_por_paquete, ppb.activo, ppb.created_at, ppb.updated_at,
               p.nombre as product_nombre, p.sku as product_sku
        FROM product_pack_barcodes ppb
        JOIN products p ON p.id = ppb.product_id
        WHERE {where}
        ORDER BY p.nombre ASC, ppb.unidades_por_paquete ASC
    """
    res = await db.execute(text(query), params)
    return [dict(r._mapping) for r in res]


async def delete_pack_barcode(db: AsyncSession, pack_id: str) -> bool:
    pack = await get_pack_barcode(db, pack_id)
    if not pack:
        return False
    await db.delete(pack)
    await db.commit()
    return True
