"""Product fractionation router -- endpoints REST para vinculación y fraccionamiento de productos."""

from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.db import get_db
from api.src.auth.middleware import require_auth
from api.src.fractionations import service
from api.src.fractionations.schemas import (
    FractionationLinkInput,
    FractionationQuickCreateChildInput,
    FractionationExecuteStockInput,
    FractionationInfoResponse,
)

router = APIRouter(prefix="/api/v1/products/{product_id}/fractionation", tags=["fractionations"])
general_router = APIRouter(prefix="/api/v1/fractionations", tags=["fractionations"])


@router.get("", response_model=FractionationInfoResponse)
async def get_product_fractionation(
    product_id: str,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    """Consulta si un producto es Display o Unidad Fraccionada y sus vínculos."""
    return await service.get_fractionation_for_product(db, user["company_id"], product_id)


@router.post("/link", status_code=201)
async def link_fractionation(
    product_id: str,
    data: FractionationLinkInput,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    """Vincula un producto display padre con un producto unitario hijo existente."""
    frac = await service.link_fractionation(db, user["company_id"], product_id, data)
    return {
        "success": True,
        "message": "Relación de fraccionamiento configurada correctamente",
        "fractionation_id": str(frac.id),
        "factor_conversion": frac.factor_conversion,
    }


@router.post("/quick-create", status_code=201)
async def quick_create_child_and_link(
    product_id: str,
    data: FractionationQuickCreateChildInput,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    """Crea automáticamente el producto unitario hijo y lo vincula al display."""
    user_id = UUID(str(user["id"])) if user.get("id") else None
    return await service.quick_create_child_and_link(db, user["company_id"], product_id, data, user_id=user_id)


@router.post("/execute-stock")
async def execute_stock_fractionation(
    product_id: str,
    data: FractionationExecuteStockInput,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    """Ejecuta la apertura y fraccionamiento físico de displays a unidades para góndola."""
    user_id = UUID(str(user["id"])) if user.get("id") else None
    return await service.execute_stock_fractionation(db, user["company_id"], product_id, data, user_id=user_id)


@general_router.delete("/{fractionation_id}")
async def unlink_fractionation(
    fractionation_id: str,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    """Elimina la relación de fraccionamiento."""
    return await service.unlink_fractionation(db, user["company_id"], fractionation_id)
