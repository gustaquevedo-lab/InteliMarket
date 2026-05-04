"""Product service"""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.products.models import Product, ProductCategory
from api.src.products.schemas import ProductCreate, ProductUpdate, CategoryCreate


async def create_category(db: AsyncSession, data: CategoryCreate) -> ProductCategory:
    category = ProductCategory(**data.model_dump())
    db.add(category)
    await db.flush()
    await db.refresh(category)
    return category


async def get_category(db: AsyncSession, category_id: str) -> ProductCategory | None:
    import uuid
    result = await db.execute(select(ProductCategory).where(ProductCategory.id == uuid.UUID(category_id)))
    return result.scalar_one_or_none()


async def list_categories(db: AsyncSession, company_id: str) -> list[ProductCategory]:
    result = await db.execute(
        select(ProductCategory)
        .where(ProductCategory.company_id == company_id, ProductCategory.activo == True)
        .order_by(ProductCategory.nombre)
    )
    return list(result.scalars().all())


async def create_product(db: AsyncSession, data: ProductCreate) -> Product:
    product = Product(**data.model_dump())
    db.add(product)
    await db.flush()
    await db.refresh(product)
    return product


async def get_product(db: AsyncSession, product_id: str) -> Product | None:
    import uuid
    result = await db.execute(select(Product).where(Product.id == uuid.UUID(product_id)))
    return result.scalar_one_or_none()


async def get_product_by_sku(db: AsyncSession, company_id: str, sku: str) -> Product | None:
    result = await db.execute(
        select(Product).where(Product.company_id == company_id, Product.sku == sku)
    )
    return result.scalar_one_or_none()


async def get_product_by_barcode(db: AsyncSession, company_id: str, codigo_barra: str) -> Product | None:
    result = await db.execute(
        select(Product).where(Product.company_id == company_id, Product.codigo_barra == codigo_barra)
    )
    return result.scalar_one_or_none()


async def list_products(
    db: AsyncSession,
    company_id: str,
    category_id: str | None = None,
    search: str | None = None,
    activo: bool | None = None,
    limit: int = 100,
    offset: int = 0,
) -> list[Product]:
    query = select(Product).where(Product.company_id == company_id)
    if category_id:
        query = query.where(Product.category_id == category_id)
    if search:
        query = query.where(
            (Product.nombre.ilike(f"%{search}%")) |
            (Product.sku.ilike(f"%{search}%")) |
            (Product.codigo_barra.ilike(f"%{search}%"))
        )
    if activo is not None:
        query = query.where(Product.activo == activo)
    query = query.order_by(Product.nombre).limit(limit).offset(offset)
    result = await db.execute(query)
    return list(result.scalars().all())


async def update_product(db: AsyncSession, product_id: str, data: ProductUpdate) -> Product | None:
    product = await get_product(db, product_id)
    if not product:
        return None
    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(product, key, value)
    await db.flush()
    await db.refresh(product)
    return product


async def delete_product(db: AsyncSession, product_id: str) -> bool:
    product = await get_product(db, product_id)
    if not product:
        return False
    await db.delete(product)
    await db.flush()
    return True


async def bulk_create_products(db: AsyncSession, products: list[ProductCreate]) -> list[Product]:
    created = []
    for data in products:
        product = Product(**data.model_dump())
        db.add(product)
        created.append(product)
    await db.flush()
    for p in created:
        await db.refresh(p)
    return created
