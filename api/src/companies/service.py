"""Company service"""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.companies.models import Company
from api.src.companies.schemas import CompanyCreate, CompanyUpdate


async def create_company(db: AsyncSession, data: CompanyCreate) -> Company:
    company = Company(**data.model_dump())
    db.add(company)
    await db.flush()
    await db.refresh(company)
    return company


async def get_company(db: AsyncSession, company_id: str) -> Company | None:
    import uuid
    result = await db.execute(select(Company).where(Company.id == uuid.UUID(company_id)))
    return result.scalar_one_or_none()


async def get_company_by_ruc(db: AsyncSession, ruc: str) -> Company | None:
    result = await db.execute(select(Company).where(Company.ruc == ruc))
    return result.scalar_one_or_none()


async def list_companies(db: AsyncSession) -> list[Company]:
    result = await db.execute(select(Company).order_by(Company.created_at.desc()))
    return list(result.scalars().all())


async def update_company(db: AsyncSession, company_id: str, data: CompanyUpdate) -> Company | None:
    import uuid
    company = await get_company(db, company_id)
    if not company:
        return None

    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(company, key, value)

    await db.flush()
    await db.refresh(company)
    return company


async def delete_company(db: AsyncSession, company_id: str) -> bool:
    import uuid
    company = await get_company(db, company_id)
    if not company:
        return False
    await db.delete(company)
    await db.flush()
    return True
