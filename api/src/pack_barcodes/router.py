"""Pack barcode router"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.db import get_db
from api.src.auth.middleware import require_auth
from api.src.pack_barcodes import service
from api.src.pack_barcodes.schemas import PackBarcodeCreate, PackBarcodeUpdate, PackBarcodeResponse

router = APIRouter(prefix="/api/v1/products/{product_id}/pack-barcodes", tags=["pack-barcodes"])

# Listado global por empresa, filtrable por producto -- mismo patron que
# variants/router.py::list_all_company_variants, para alimentar la tabla
# de la pestana "Packs" en ProductsPage.tsx sin tener que elegir un
# producto primero.
company_router = APIRouter(prefix="/api/v1/companies/{company_id}/pack-barcodes", tags=["pack-barcodes"])


@company_router.get("")
async def list_all_pack_barcodes(company_id: str, product_id: str | None = None, db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    return await service.list_all_company_pack_barcodes(db, company_id, product_id)


@router.get("", response_model=list[PackBarcodeResponse])
async def list_pack_barcodes(product_id: str, db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    return await service.list_pack_barcodes(db, product_id)


@router.post("", response_model=PackBarcodeResponse, status_code=201)
async def create_pack_barcode(product_id: str, data: PackBarcodeCreate, db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    try:
        return await service.create_pack_barcode(db, user["company_id"], product_id, data)
    except service.PackBarcodeCollisionError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.patch("/{pack_id}", response_model=PackBarcodeResponse)
async def update_pack_barcode(product_id: str, pack_id: str, data: PackBarcodeUpdate, db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    try:
        pack = await service.update_pack_barcode(db, user["company_id"], pack_id, data)
    except service.PackBarcodeCollisionError as e:
        raise HTTPException(status_code=400, detail=str(e))
    if not pack:
        raise HTTPException(status_code=404, detail="Código de pack no encontrado")
    return pack


@router.delete("/{pack_id}")
async def delete_pack_barcode(product_id: str, pack_id: str, db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    success = await service.delete_pack_barcode(db, pack_id)
    if not success:
        raise HTTPException(status_code=404, detail="Código de pack no encontrado")
    return {"message": "Código de pack eliminado"}
