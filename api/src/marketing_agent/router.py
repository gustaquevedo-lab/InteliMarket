from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.db import get_db
from api.src.auth.middleware import require_auth
from api.src.marketing_agent import service
from api.src.marketing_agent.schemas import (
    MarketingDashboard, ChatMessageRequest, ChatMessageResponse,
    SendCouponRequest, LaunchCampaignRequest,
)

router = APIRouter(prefix="/api/v1/marketing-agent", tags=["marketing-agent"], dependencies=[Depends(require_auth)])


@router.get("/dashboard", response_model=MarketingDashboard)
async def get_dashboard(company_id: str = Query(...), db: AsyncSession = Depends(get_db)):
    """Segmentacion de clientes (RFM simple) y campañas sugeridas -- calculado
    en vivo sobre customers/sales reales, sin arrays de ejemplo."""
    return await service.get_marketing_dashboard(db, company_id)


@router.post("/chat", response_model=ChatMessageResponse)
async def chat(body: ChatMessageRequest, db: AsyncSession = Depends(get_db)):
    """Chat que consulta segmentos y stock reales en cada pregunta."""
    return await service.chat_with_marketing_agent(db, body.company_id, body.message, body.conversation_history)


@router.post("/send-coupon")
async def send_coupon(body: SendCouponRequest):
    """Envía un cupón por WhatsApp vía Evolution API."""
    res = await service.send_coupon_via_whatsapp(
        phone=body.phone,
        message=body.message,
        customer_name=body.customer_name,
        cupon=body.cupon,
    )
    return res


@router.post("/launch-campaign")
async def launch_campaign(body: LaunchCampaignRequest, db: AsyncSession = Depends(get_db)):
    """Dispara los mensajes de una campaña sugerida vía Evolution API a los clientes del segmento."""
    res = await service.launch_campaign_via_whatsapp(
        db=db,
        company_id=body.company_id,
        campaign_id=body.campaign_id,
        segmento=body.segmento,
        message=body.message,
    )
    return res
