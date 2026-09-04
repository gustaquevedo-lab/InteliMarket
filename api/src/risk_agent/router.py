from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.db import get_db
from api.src.auth.middleware import require_auth
from api.src.risk_agent import service
from api.src.risk_agent.schemas import RiskDashboard, RiskEventItem, ChatMessageRequest, ChatMessageResponse

router = APIRouter(prefix="/api/v1/risk-agent", tags=["risk-agent"], dependencies=[Depends(require_auth)])


@router.get("/dashboard", response_model=RiskDashboard)
async def get_dashboard(
    company_id: str = Query(...),
    dias: int = Query(30, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
):
    """Dashboard de riesgo calculado en vivo sobre audit_logs -- clasifica cada
    evento real (peso, descuentos, reaperturas, saldo bancario, etc.) por
    nivel y categoria de riesgo, sin datos de ejemplo."""
    return await service.get_risk_dashboard(db, company_id, dias)


@router.get("/events", response_model=list[RiskEventItem])
async def list_events(
    company_id: str = Query(...),
    dias: int = Query(30, ge=1, le=365),
    nivel: str | None = Query(None),
    categoria: str | None = Query(None),
    cajero: str | None = Query(None),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    return await service.list_risk_events(db, company_id, dias, nivel, categoria, cajero, limit, offset)


@router.post("/chat", response_model=ChatMessageResponse)
async def chat(body: ChatMessageRequest, db: AsyncSession = Depends(get_db)):
    """A diferencia de los otros agentes IA del sistema, este chat consulta
    datos reales en cada pregunta -- no responde con guiones armados a mano."""
    return await service.chat_with_risk_agent(db, body.company_id, body.message, body.conversation_history)
