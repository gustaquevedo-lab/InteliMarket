"""Gerente Financiero IA — endpoints de diagnóstico, chat analítico y aprobación de recomendaciones"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional

from api.src.db import get_db
from api.src.finance_agent import service
from api.src.finance_agent.schemas import (
    TriggerRunRequest, FinanceAgentRunResponse, FinanceRecommendationResponse,
    DecisionRequest, FinanceChatRequest, FinanceChatResponse,
    FinanceExecutiveSummaryResponse
)

router = APIRouter(prefix="/api/v1/finance-agent", tags=["finance-agent"])

DEFAULT_COMPANY_ID = "00000000-0000-0000-0000-000000000010"


@router.post("/run", response_model=FinanceAgentRunResponse)
async def trigger_run(body: Optional[TriggerRunRequest] = None, db: AsyncSession = Depends(get_db)):
    company_id = str(body.company_id) if body else DEFAULT_COMPANY_ID
    return await service.run_diagnosis(db, company_id)


@router.get("/summary", response_model=FinanceExecutiveSummaryResponse)
async def get_summary(company_id: str = Query(DEFAULT_COMPANY_ID), db: AsyncSession = Depends(get_db)):
    return await service.get_financial_executive_summary(db, company_id)


@router.post("/chat", response_model=FinanceChatResponse)
async def chat_agent(
    body: FinanceChatRequest,
    company_id: str = Query(DEFAULT_COMPANY_ID),
    db: AsyncSession = Depends(get_db)
):
    return await service.chat_finance_agent(db, company_id, body.query, body.user_name or "Gustavo")


@router.get("/recommendations", response_model=list[FinanceRecommendationResponse])
async def list_recommendations(
    company_id: str = Query(DEFAULT_COMPANY_ID),
    status_filter: str | None = Query(None, alias="status"),
    db: AsyncSession = Depends(get_db),
):
    return await service.list_recommendations(db, company_id, status_filter)


@router.post("/recommendations/{recommendation_id}/approve", response_model=FinanceRecommendationResponse)
async def approve_recommendation(recommendation_id: str, body: DecisionRequest, db: AsyncSession = Depends(get_db)):
    rec = await service.decide_recommendation(
        db, recommendation_id, True, body.approved_by_name or "Gustavo", body.comments
    )
    if not rec:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Recomendación no encontrada")
    return rec


@router.post("/recommendations/{recommendation_id}/reject", response_model=FinanceRecommendationResponse)
async def reject_recommendation(recommendation_id: str, body: DecisionRequest, db: AsyncSession = Depends(get_db)):
    rec = await service.decide_recommendation(
        db, recommendation_id, False, body.approved_by_name or "Gustavo", body.comments
    )
    if not rec:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Recomendación no encontrada")
    return rec
