"""Customer service"""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.customers.models import Customer
from api.src.customers.schemas import CustomerCreate, CustomerUpdate


async def create_customer(db: AsyncSession, data: CustomerCreate) -> Customer:
    customer = Customer(**data.model_dump())
    db.add(customer)
    await db.flush()
    await db.refresh(customer)
    return customer


async def get_customer(db: AsyncSession, customer_id: str) -> Customer | None:
    import uuid
    result = await db.execute(select(Customer).where(Customer.id == uuid.UUID(customer_id)))
    return result.scalar_one_or_none()


async def get_customer_by_ruc(db: AsyncSession, company_id: str, ruc: str) -> Customer | None:
    result = await db.execute(
        select(Customer).where(Customer.company_id == company_id, Customer.ruc == ruc)
    )
    return result.scalar_one_or_none()


async def list_customers(
    db: AsyncSession,
    company_id: str,
    search: str | None = None,
    activo: bool | None = None,
    limit: int = 100,
    offset: int = 0,
) -> list[Customer]:
    query = select(Customer).where(Customer.company_id == company_id)
    if search:
        query = query.where(
            (Customer.razon_social.ilike(f"%{search}%")) |
            (Customer.ruc.ilike(f"%{search}%")) |
            (Customer.ci.ilike(f"%{search}%"))
        )
    if activo is not None:
        query = query.where(Customer.activo == activo)
    query = query.order_by(Customer.razon_social).limit(limit).offset(offset)
    result = await db.execute(query)
    return list(result.scalars().all())


async def update_customer(db: AsyncSession, customer_id: str, data: CustomerUpdate) -> Customer | None:
    customer = await get_customer(db, customer_id)
    if not customer:
        return None
    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(customer, key, value)
    await db.flush()
    await db.refresh(customer)
    return customer


async def delete_customer(db: AsyncSession, customer_id: str) -> bool:
    customer = await get_customer(db, customer_id)
    if not customer:
        return False
    await db.delete(customer)
    await db.flush()
    return True
