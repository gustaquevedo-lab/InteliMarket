"""Gerente Financiero IA — Router de Endpoints Ejecutivos y Enlace Inter-Agente"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.db import get_db
from api.src.auth.middleware import require_auth
from api.src.finance_agent import service
from api.src.finance_agent.schemas import (
    TriggerRunRequest, FinanceAgentRunResponse, FinanceRecommendationResponse, DecisionRequest, BulkDecisionRequest,
    LiquidityControlTower, InterAgentSyncResponse, CashFlowForecastResponse, FinanceChatRequest, FinanceChatResponse, FinanceBusinessRuleCreate, FinanceBusinessRuleResponse
)

router = APIRouter(prefix="/api/v1/finance-agent", tags=["finance-agent"])


@router.get("/control-tower", response_model=LiquidityControlTower)
async def get_control_tower(
    company_id: str = Query("00000000-0000-0000-0000-000000000010"),
    db: AsyncSession = Depends(get_db)
):
    """Retorna la posición consolidada de tesorería, liquidez, bancos, cuentas por pagar y cuentas por cobrar."""
    return await service.get_liquidity_control_tower(db, company_id)


@router.get("/inter-agent/sync", response_model=InterAgentSyncResponse)
async def get_inter_agent_synchronization(
    company_id: str = Query("00000000-0000-0000-0000-000000000010"),
    db: AsyncSession = Depends(get_db)
):
    """Retorna el canal de comunicación activa y directivas entre el Gerente Financiero y el Gerente de Ventas."""
    return await service.get_inter_agent_sync(db, company_id)


@router.get("/cash-flow-forecast", response_model=CashFlowForecastResponse)
async def get_cash_flow_forecast(
    company_id: str = Query("00000000-0000-0000-0000-000000000010"),
    db: AsyncSession = Depends(get_db)
):
    """Retorna la proyección de flujo de caja día por día a 30 días con detección de baches de liquidez."""
    return await service.get_cash_flow_forecast(db, company_id)


@router.get("/business-rules", response_model=list[FinanceBusinessRuleResponse])
async def list_business_rules(
    company_id: str = Query("00000000-0000-0000-0000-000000000010"),
    db: AsyncSession = Depends(get_db)
):
    """Lista las reglas y directivas financieras aprendidas por el CFO IA."""
    return await service.list_finance_business_rules(db, company_id)


@router.post("/business-rules", response_model=dict)
async def create_business_rule(
    body: FinanceBusinessRuleCreate,
    db: AsyncSession = Depends(get_db)
):
    """Crea una nueva directiva o regla financiera para la memoria del agente."""
    return await service.create_finance_business_rule(
        db, str(body.company_id), body.regla, body.categoria or "financiera", body.origen or "usuario_manual"
    )


@router.post("/chat", response_model=FinanceChatResponse)
async def chat_with_cfo(
    body: FinanceChatRequest,
    db: AsyncSession = Depends(get_db)
):
    """Procesa una consulta financiera en lenguaje natural y genera una respuesta ejecutiva fundamentada."""
    return await service.chat_with_finance_agent(
        db,
        str(body.company_id),
        body.message,
        body.conversation_history,
        body.attachment_name,
        body.attachment_type,
        body.attachment_data
    )


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
    return {"updated": count}
