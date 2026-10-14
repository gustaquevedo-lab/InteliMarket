from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.db import get_db
from api.src.auth.middleware import require_auth
from api.src.loyalty.schemas import (
    LoyaltyConfigCreate, LoyaltyConfigUpdate, LoyaltyConfigResponse,
    PointsCreate, PointsResponse, PointsBalance,
    LoyaltyRewardCreate, LoyaltyRewardUpdate, LoyaltyRewardResponse,
)
from api.src.loyalty import service

router = APIRouter(prefix="/api/v1/loyalty", tags=["loyalty"])


@router.get("/config/{company_id}", response_model=LoyaltyConfigResponse)
async def get_config(company_id: str, db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    return await service.get_or_create_config(db, company_id)


@router.put("/config/{company_id}", response_model=LoyaltyConfigResponse)
async def update_config(company_id: str, body: LoyaltyConfigUpdate, db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    result = await service.update_config(db, company_id, body)
    if not result:
        raise HTTPException(status_code=404, detail="Config no encontrada")
    return result


@router.post("/points", response_model=PointsResponse, status_code=status.HTTP_201_CREATED)
async def add_points(body: PointsCreate, db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    return await service.earn_points(db, body)


@router.get("/balance/{customer_id}", response_model=PointsBalance)
async def get_balance(customer_id: str, company_id: str = Query(), db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    return await service.get_balance(db, customer_id, company_id)


@router.get("/history/{customer_id}", response_model=list[PointsResponse])
async def get_history(customer_id: str, company_id: str = Query(), limit: int = Query(50), db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    return await service.get_history(db, customer_id, company_id, limit)


@router.post("/rewards", response_model=LoyaltyRewardResponse, status_code=status.HTTP_201_CREATED)
async def create_reward(body: LoyaltyRewardCreate, db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    return await service.create_reward(db, body)


@router.get("/rewards/{reward_id}", response_model=LoyaltyRewardResponse)
async def get_reward(reward_id: str, db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    result = await service.get_reward(db, reward_id)
    if not result:
        raise HTTPException(status_code=404, detail="Recompensa no encontrada")
    return result


@router.get("/rewards", response_model=list[LoyaltyRewardResponse])
async def list_rewards(company_id: str, activo: bool | None = Query(None), db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    return await service.list_rewards(db, company_id, activo)


@router.put("/rewards/{reward_id}", response_model=LoyaltyRewardResponse)
async def update_reward(reward_id: str, body: LoyaltyRewardUpdate, db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    result = await service.update_reward(db, reward_id, body)
    if not result:
        raise HTTPException(status_code=404, detail="Recompensa no encontrada")
    return result


@router.delete("/rewards/{reward_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_reward(reward_id: str, db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    deleted = await service.delete_reward(db, reward_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Recompensa no encontrada")
