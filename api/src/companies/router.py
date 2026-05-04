"""Company API router"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.db import get_db
from api.src.companies.schemas import CompanyCreate, CompanyUpdate, CompanyResponse
from api.src.companies import service

router = APIRouter(prefix="/api/v1/companies", tags=["companies"])


@router.post("", response_model=CompanyResponse, status_code=status.HTTP_201_CREATED)
async def create_company(body: CompanyCreate, db: AsyncSession = Depends(get_db)):
    existing = await service.get_company_by_ruc(db, body.ruc)
    if existing:
        raise HTTPException(status_code=400, detail="Ya existe una empresa con ese RUC")
    return await service.create_company(db, body)


@router.get("", response_model=list[CompanyResponse])
async def list_companies(db: AsyncSession = Depends(get_db)):
    return await service.list_companies(db)


@router.get("/{company_id}", response_model=CompanyResponse)
async def get_company(company_id: str, db: AsyncSession = Depends(get_db)):
    company = await service.get_company(db, company_id)
    if not company:
        raise HTTPException(status_code=404, detail="Empresa no encontrada")
    return company


@router.patch("/{company_id}", response_model=CompanyResponse)
async def update_company(company_id: str, body: CompanyUpdate, db: AsyncSession = Depends(get_db)):
    company = await service.update_company(db, company_id, body)
    if not company:
        raise HTTPException(status_code=404, detail="Empresa no encontrada")
    return company


@router.delete("/{company_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_company(company_id: str, db: AsyncSession = Depends(get_db)):
    deleted = await service.delete_company(db, company_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Empresa no encontrada")
