from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.db import get_db
from api.src.supplier_returns.schemas import (
    SupplierReturnCreate, SupplierReturnResponse, SupplierReturnWithItems, SupplierReturnApprove,
)
from api.src.supplier_returns import service

router = APIRouter(prefix="/api/v1", tags=["supplier-returns"])


@router.post("/supplier-returns", response_model=SupplierReturnResponse, status_code=status.HTTP_201_CREATED)
async def create_supplier_return(body: SupplierReturnCreate, db: AsyncSession = Depends(get_db)):
    result = await service.create_return(db, body)
    await db.commit()
    return result


@router.get("/supplier-returns/motivos")
async def list_motivos():
    return service.SUPPLIER_RETURN_MOTIVOS


@router.get("/supplier-returns/{return_id}", response_model=SupplierReturnWithItems)
async def get_supplier_return(return_id: str, db: AsyncSession = Depends(get_db)):
    result = await service.get_return_with_items(db, return_id)
    if not result:
        raise HTTPException(status_code=404, detail="Devolución a proveedor no encontrada")
    return result


@router.get("/companies/{company_id}/supplier-returns", response_model=list[SupplierReturnResponse])
async def list_supplier_returns(
    company_id: str,
    estado: str | None = Query(None),
    supplier_id: str | None = Query(None),
    limit: int = Query(50, le=500),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    return await service.list_returns(db, company_id, estado, supplier_id, limit=limit, offset=offset)


@router.post("/supplier-returns/{return_id}/approve", response_model=SupplierReturnResponse)
async def approve_supplier_return(return_id: str, body: SupplierReturnApprove, db: AsyncSession = Depends(get_db)):
    result = await service.approve_return(db, return_id, body)
    if not result:
        raise HTTPException(status_code=400, detail="No se pudo aprobar la devolución")
    await db.commit()
    return result


@router.post("/supplier-returns/{return_id}/reject", response_model=SupplierReturnResponse)
async def reject_supplier_return(
    return_id: str,
    motivo: str = Query(...),
    db: AsyncSession = Depends(get_db),
):
    result = await service.reject_return(db, return_id, motivo)
    if not result:
        raise HTTPException(status_code=400, detail="No se pudo rechazar la devolución")
    await db.commit()
    return result
