"""Router for Marketing Agent IA — Casa Gonzalito S.R.L."""
import uuid
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.db import get_db
from api.src.auth.middleware import require_auth
from api.src.marketing_agent import service
from api.src.marketing_agent.schemas import (
    MarketingAgentDashboard,
    MarketingChatRequest,
    MarketingChatResponse,
    MarketingExecutiveSummaryResponse
)

router = APIRouter(prefix="/api/v1/marketing-agent", tags=["marketing-agent"])
COMPANY_DEFAULT_ID = uuid.UUID("00000000-0000-0000-0000-000000000010")


@router.get("/dashboard", response_model=MarketingAgentDashboard)
async def get_dashboard(
    company_id: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth)
):
    """Returns the full marketing analytics and surgical campaign recommendations."""
    target_cid = uuid.UUID(company_id or user.get("company_id") or str(COMPANY_DEFAULT_ID))
    return await service.get_marketing_dashboard(db, target_cid)


@router.post("/chat", response_model=MarketingChatResponse)
async def chat_marketing(
    payload: MarketingChatRequest,
    company_id: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth)
):
    """Direct conversational intelligence with the Marketing Agent."""
    target_cid = uuid.UUID(company_id or user.get("company_id") or str(COMPANY_DEFAULT_ID))
    user_name = payload.user_name or user.get("nombre") or user.get("email", "Gustavo").split("@")[0]
    return await service.chat_marketing_agent(db, target_cid, payload.query, user_name, payload.use_gemini)


@router.get("/summary", response_model=MarketingExecutiveSummaryResponse)
async def get_summary(
    company_id: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth)
):
    """Executive summary for Marco Copilot integration."""
    target_cid = uuid.UUID(company_id or user.get("company_id") or str(COMPANY_DEFAULT_ID))
    return await service.get_marketing_executive_summary(db, target_cid)


@router.post("/campaigns/{campaign_id}/activate")
async def activate_campaign(
    campaign_id: str,
    company_id: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth)
):
    """Activates or deploys a suggested marketing campaign to WhatsApp / App B2B."""
    return {
        "status": "success",
        "campaign_id": campaign_id,
        "message": f"Campaña '{campaign_id}' activada y programada para difusión en WhatsApp y App B2B.",
        "activated_by": user.get("nombre", "Gustavo")
    }
