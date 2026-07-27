"""Gerente de Ventas IA — disparo de diagnóstico y aprobación de recomendaciones"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.db import get_db
from api.src.sales_agent import service
from api.src.sales_agent.schemas import (
    TriggerRunRequest, SalesAgentRunResponse, SalesRecommendationResponse, DecisionRequest,
)

router = APIRouter(prefix="/api/v1/sales-agent", tags=["sales-agent"])


@router.post("/run", response_model=SalesAgentRunResponse)
async def trigger_run(body: TriggerRunRequest, db: AsyncSession = Depends(get_db)):
    return await service.run_diagnosis(db, str(body.company_id))


@router.get("/recommendations", response_model=list[SalesRecommendationResponse])
async def list_recommendations(
    company_id: str = Query(),
    status_filter: str | None = Query(None, alias="status"),
    db: AsyncSession = Depends(get_db),
):
    return await service.list_recommendations(db, company_id, status_filter)


@router.post("/recommendations/{recommendation_id}/approve", response_model=SalesRecommendationResponse)
async def approve_recommendation(recommendation_id: str, body: DecisionRequest, db: AsyncSession = Depends(get_db)):
    rec = await service.decide_recommendation(db, recommendation_id, True, str(body.approved_by), body.comments)
    if not rec:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Recomendación no encontrada")
    return rec


@router.post("/recommendations/{recommendation_id}/reject", response_model=SalesRecommendationResponse)
async def reject_recommendation(recommendation_id: str, body: DecisionRequest, db: AsyncSession = Depends(get_db)):
    rec = await service.decide_recommendation(db, recommendation_id, False, str(body.approved_by), body.comments)
    if not rec:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Recomendación no encontrada")
    return rec
