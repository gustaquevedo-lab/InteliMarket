"""Router para el Gerente Comercial IA — Casa Gonzalito"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional, List

from api.src.db import get_db
from api.src.commercial_agent import service
from api.src.commercial_agent.schemas import (
    TriggerRunRequest, CommercialAgentRunResponse, CommercialRecommendationResponse,
    DecisionRequest, CommercialChatRequest, CommercialChatResponse, CommercialReportRequest
)

router = APIRouter(prefix="/api/v1/commercial-agent", tags=["commercial-agent"])


@router.post("/run", response_model=CommercialAgentRunResponse)
async def trigger_run(body: TriggerRunRequest, db: AsyncSession = Depends(get_db)):
    return await service.run_diagnosis(db, str(body.company_id))


@router.get("/recommendations", response_model=List[CommercialRecommendationResponse])
async def list_recommendations(
    company_id: str = Query(),
    status_filter: Optional[str] = Query(None, alias="status"),
    db: AsyncSession = Depends(get_db),
):
    return await service.list_recommendations(db, company_id, status_filter)


@router.post("/recommendations/{recommendation_id}/approve", response_model=CommercialRecommendationResponse)
async def approve_recommendation(
    recommendation_id: str,
    body: DecisionRequest,
    db: AsyncSession = Depends(get_db)
):
    rec = await service.decide_recommendation(db, recommendation_id, True, str(body.approved_by), body.comments)
    if not rec:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Recomendación no encontrada")
    return rec


@router.post("/recommendations/{recommendation_id}/reject", response_model=CommercialRecommendationResponse)
async def reject_recommendation(
    recommendation_id: str,
    body: DecisionRequest,
    db: AsyncSession = Depends(get_db)
):
    rec = await service.decide_recommendation(db, recommendation_id, False, str(body.approved_by), body.comments)
    if not rec:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Recomendación no encontrada")
    return rec


@router.post("/chat", response_model=CommercialChatResponse)
async def chat_commercial(body: CommercialChatRequest, db: AsyncSession = Depends(get_db)):
    return await service.chat_commercial_agent(db, str(body.company_id), body.query, body.user_name or "Gustavo")
