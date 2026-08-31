from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional

from api.src.db import get_db
from api.src.auth.middleware import require_auth
from api.src.promotions import service
from api.src.promotions.schemas import (
    PromotionCreate, PromotionUpdate, PromotionResponse,
    ValidateCartInput, CalculatePromoResponse,
    ProductDualPriceResponse, ReactivatePromoInput, RecordVendorCreditNoteInput,
    VendorClaimResponse, ApproveLossPromoInput,
    AuthorizeFlashGraceInput, AuthorizeFlashGraceResponse,
    ExpiringPromotionAlert
)

router = APIRouter(
    prefix="/api/v1/promotions",
    tags=["promotions"],
)


@router.get("", response_model=list[PromotionResponse])
async def list_promotions(
    activo: Optional[bool] = Query(None),
    tipo: Optional[str] = Query(None),
    estado: Optional[str] = Query(None),
    origen_fuente: Optional[str] = Query(None),
    limit: int = Query(100, le=5000),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.list_promotions(
        db, user["company_id"], activo, tipo, estado, origen_fuente, limit, offset
    )


@router.get("/expiring-alerts")
async def get_expiring_alerts(
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    """Alertas preventivas de vencimiento de lotes en promoción (15, 10, 5 días y vencidos)."""
    return await service.get_expiring_promotions_alerts(db, user["company_id"])


@router.post("/authorize-flash-grace", response_model=AuthorizeFlashGraceResponse)
async def authorize_flash_grace(
    data: AuthorizeFlashGraceInput,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    """Autorización supervisada para excepciones de tolerancia de 60 min en promociones relámpago con registro de auditoría."""
    try:
        return await service.authorize_flash_grace_override(
            db, user["company_id"], data, user.get("sub") or user.get("id")
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/resolve-product/{product_id}", response_model=ProductDualPriceResponse)
async def resolve_product_price(
    product_id: str,
    precio: float = Query(..., description="Precio regular de lista"),
    cantidad: float = Query(1.0, description="Cantidad a consultar"),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    """Consulta de precio dual en tiempo real para cualquier producto."""
    return await service.resolve_product_promotions(
        db, user["company_id"], product_id, precio, cantidad
    )


@router.post("/sync-nemuha", response_model=dict)
async def trigger_nemuha_sync(
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    """Sincroniza todas las promociones activas e históricas de ven_promocao de Nemuha."""
    return await service.sync_nemuha_promotions(db, user["company_id"])


@router.get("/{promo_id}", response_model=PromotionResponse)
async def get_promotion(
    promo_id: str,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    result = await service.get_promotion(db, promo_id)
    if not result:
        raise HTTPException(status_code=404, detail="Promoción no encontrada")
    return result


@router.post("", response_model=PromotionResponse, status_code=status.HTTP_201_CREATED)
async def create_promotion(
    data: PromotionCreate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.create_promotion(db, user["company_id"], data)


@router.put("/{promo_id}", response_model=PromotionResponse)
async def update_promotion(
    promo_id: str,
    data: PromotionUpdate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    result = await service.update_promotion(db, promo_id, data)
    if not result:
        raise HTTPException(status_code=404, detail="Promoción no encontrada")
    return result


@router.post("/{promo_id}/toggle", response_model=PromotionResponse)
async def toggle_promotion(
    promo_id: str,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    result = await service.toggle_promotion_status(db, user["company_id"], promo_id)
    if not result:
        raise HTTPException(status_code=404, detail="Promoción no encontrada")
    return result


@router.post("/{promo_id}/reactivate", response_model=PromotionResponse)
async def reactivate_promotion(
    promo_id: str,
    data: ReactivatePromoInput,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    result = await service.reactivate_promotion(db, user["company_id"], promo_id, data)
    if not result:
        raise HTTPException(status_code=404, detail="Promoción no encontrada")
    return result


@router.post("/{promo_id}/approve-loss", response_model=PromotionResponse)
async def approve_loss_promotion(
    promo_id: str,
    data: ApproveLossPromoInput,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    result = await service.approve_promotion_loss(db, user["company_id"], promo_id, user.get("sub") or user.get("id"))
    if not result:
        raise HTTPException(status_code=404, detail="Promoción no encontrada")
    return result


@router.get("/{promo_id}/sell-out-claim", response_model=VendorClaimResponse)
async def get_sell_out_claim(
    promo_id: str,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    try:
        return await service.generate_sell_out_claim(db, user["company_id"], promo_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/{promo_id}/vendor-credit-note", response_model=PromotionResponse)
async def record_vendor_credit_note(
    promo_id: str,
    data: RecordVendorCreditNoteInput,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    result = await service.record_vendor_credit_note(db, user["company_id"], promo_id, data)
    if not result:
        raise HTTPException(status_code=404, detail="Promoción no encontrada")
    return result


@router.delete("/{promo_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_promotion(
    promo_id: str,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    ok = await service.delete_promotion(db, promo_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Promoción no encontrada")


@router.post("/calculate", response_model=CalculatePromoResponse)
async def calculate_promotions(
    data: ValidateCartInput,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.calculate_applicable(db, user["company_id"], data)


@router.get("/{promo_id}/usage", response_model=list[dict])
async def list_promotion_usage(
    promo_id: str,
    limit: int = Query(50, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.list_usage(db, user["company_id"], promo_id, limit, offset)
