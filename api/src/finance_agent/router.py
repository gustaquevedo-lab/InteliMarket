"""Gerente Financiero IA — disparo de diagnóstico y aprobación de recomendaciones"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.db import get_db
from api.src.auth.middleware import require_auth
from api.src.finance_agent import service
from api.src.finance_agent.schemas import (
    TriggerRunRequest, FinanceAgentRunResponse, FinanceRecommendationResponse, DecisionRequest, BulkDecisionRequest,
)

router = APIRouter(prefix="/api/v1/finance-agent", tags=["finance-agent"], dependencies=[Depends(require_auth)])


@router.post("/run", response_model=FinanceAgentRunResponse)
async def trigger_run(body: TriggerRunRequest, db: AsyncSession = Depends(get_db)):
    return await service.run_diagnosis(db, str(body.company_id))


@router.get("/recommendations", response_model=list[FinanceRecommendationResponse])
async def list_recommendations(
    company_id: str = Query(),
    status_filter: str | None = Query(None, alias="status"),
    tipo: str | None = Query(None),
    limit: int = Query(100, le=1000),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    return await service.list_recommendations(db, company_id, status_filter, tipo, limit, offset)


@router.get("/recommendations/count-by-tipo")
async def count_by_tipo(company_id: str = Query(), status_filter: str | None = Query(None, alias="status"), db: AsyncSession = Depends(get_db)):
    return await service.count_recommendations_by_tipo(db, company_id, status_filter)


@router.post("/recommendations/bulk-decide")
async def bulk_decide(body: BulkDecisionRequest, approve: bool = Query(...), db: AsyncSession = Depends(get_db)):
    count = await service.bulk_decide_recommendations(db, [str(i) for i in body.ids], approve, str(body.approved_by), body.comments)
    return {"decididas": count}


@router.post("/recommendations/{recommendation_id}/approve", response_model=FinanceRecommendationResponse)
async def approve_recommendation(recommendation_id: str, body: DecisionRequest, db: AsyncSession = Depends(get_db)):
    rec = await service.decide_recommendation(db, recommendation_id, True, str(body.approved_by), body.comments)
    if not rec:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Recomendación no encontrada")
    return rec


@router.post("/recommendations/{recommendation_id}/reject", response_model=FinanceRecommendationResponse)
async def reject_recommendation(recommendation_id: str, body: DecisionRequest, db: AsyncSession = Depends(get_db)):
    rec = await service.decide_recommendation(db, recommendation_id, False, str(body.approved_by), body.comments)
    if not rec:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Recomendación no encontrada")
    return rec
