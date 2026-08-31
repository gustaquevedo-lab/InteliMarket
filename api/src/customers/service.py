"""Customer service"""

from sqlalchemy import select, or_, and_
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
    tipo: str | None = None,
    exclude_proveedores: bool = False,
    limit: int = 10000,
    offset: int = 0,
) -> list[Customer]:
    query = select(Customer).where(Customer.company_id == company_id)
    if search:
        search_terms = search.strip().split()
        if len(search_terms) == 1:
            term = search_terms[0]
            query = query.where(
                (Customer.razon_social.ilike(f"%{term}%")) |
                (Customer.ruc.ilike(f"%{term}%")) |
                (Customer.ci.ilike(f"%{term}%")) |
                (Customer.telefono.ilike(f"%{term}%")) |
                (Customer.extra_club_numero.ilike(f"%{term}%"))
            )
        elif len(search_terms) > 1:
            term_conditions = []
            for term in search_terms:
                term_conditions.append(
                    (Customer.razon_social.ilike(f"%{term}%")) |
                    (Customer.ruc.ilike(f"%{term}%")) |
                    (Customer.ci.ilike(f"%{term}%")) |
                    (Customer.telefono.ilike(f"%{term}%")) |
                    (Customer.extra_club_numero.ilike(f"%{term}%"))
                )
            query = query.where(and_(*term_conditions))
    if activo is not None:
        query = query.where(Customer.activo == activo)
    if tipo:
        query = query.where(Customer.tipo == tipo)
    elif exclude_proveedores:
        query = query.where(or_(Customer.tipo != "proveedor", Customer.tipo.is_(None)))
    query = query.order_by(Customer.razon_social.asc().nulls_last()).limit(limit).offset(offset)
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
