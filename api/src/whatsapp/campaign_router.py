"""IntelliZapp — Campaign & Automation API endpoints."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.db import get_db
from api.src.auth.middleware import require_auth
from api.src.whatsapp import schemas as sc
from api.src.whatsapp import campaign_service

router = APIRouter(prefix="/api/v1/intellizapp", tags=["intellizapp"])


# ═══════════════════════════════════════════════════════════════
# CAMPAIGNS
# ═══════════════════════════════════════════════════════════════

@router.get("/campaigns", response_model=list[sc.CampaignResponse])
async def list_campaigns(
    status: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    tenant_id = UUID(user["tenant_id"])
    return await campaign_service.list_campaigns(db, tenant_id, status)


@router.post("/campaigns", response_model=sc.CampaignResponse, status_code=201)
async def create_campaign(
    body: sc.CampaignCreate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    tenant_id = UUID(user["tenant_id"])
    return await campaign_service.create_campaign(db, tenant_id, body.model_dump(exclude_none=True))


@router.get("/campaigns/{campaign_id}", response_model=sc.CampaignResponse)
async def get_campaign(
    campaign_id: UUID,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    obj = await campaign_service.get_campaign(db, campaign_id)
    if not obj:
        raise HTTPException(404, "Campaña no encontrada")
    return obj


@router.put("/campaigns/{campaign_id}", response_model=sc.CampaignResponse)
async def update_campaign(
    campaign_id: UUID,
    body: sc.CampaignUpdate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    try:
        return await campaign_service.update_campaign(db, campaign_id, body.model_dump(exclude_none=True))
    except ValueError as e:
        raise HTTPException(404, str(e))


@router.delete("/campaigns/{campaign_id}")
async def delete_campaign(
    campaign_id: UUID,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    try:
        await campaign_service.delete_campaign(db, campaign_id)
        return {"success": True}
    except ValueError as e:
        raise HTTPException(404, str(e))


@router.post("/campaigns/{campaign_id}/launch")
async def launch_campaign(
    campaign_id: UUID,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    """Resolve segment, create recipients, schedule sending."""
    try:
        result = await campaign_service.launch_campaign(db, campaign_id)
        return result
    except ValueError as e:
        raise HTTPException(400, str(e))


@router.post("/campaigns/{campaign_id}/send-batch")
async def send_campaign_batch(
    campaign_id: UUID,
    batch_size: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    """Send next batch of pending recipients."""
    try:
        result = await campaign_service.send_campaign_batch(db, campaign_id, batch_size)
        return result
    except ValueError as e:
        raise HTTPException(400, str(e))


@router.get("/campaigns/{campaign_id}/recipients", response_model=list[sc.CampaignRecipientResponse])
async def get_campaign_recipients(
    campaign_id: UUID,
    status: str | None = Query(None),
    limit: int = Query(500, le=2000),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await campaign_service.get_campaign_recipients(db, campaign_id, status, limit)


# ═══════════════════════════════════════════════════════════════
# AUTOMATION RULES
# ═══════════════════════════════════════════════════════════════

@router.get("/automation-rules", response_model=list[sc.AutomationRuleResponse])
async def list_rules(
    active_only: bool = Query(False),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    tenant_id = UUID(user["tenant_id"])
    return await campaign_service.list_automation_rules(db, tenant_id, active_only)


@router.post("/automation-rules", response_model=sc.AutomationRuleResponse, status_code=201)
async def create_rule(
    body: sc.AutomationRuleCreate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    tenant_id = UUID(user["tenant_id"])
    return await campaign_service.create_automation_rule(db, tenant_id, body.model_dump())


@router.get("/automation-rules/{rule_id}", response_model=sc.AutomationRuleResponse)
async def get_rule(
    rule_id: UUID,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    obj = await campaign_service.get_automation_rule(db, rule_id)
    if not obj:
        raise HTTPException(404, "Regla no encontrada")
    return obj


@router.put("/automation-rules/{rule_id}", response_model=sc.AutomationRuleResponse)
async def update_rule(
    rule_id: UUID,
    body: sc.AutomationRuleUpdate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    try:
        return await campaign_service.update_automation_rule(db, rule_id, body.model_dump(exclude_none=True))
    except ValueError as e:
        raise HTTPException(404, str(e))


@router.delete("/automation-rules/{rule_id}")
async def delete_rule(
    rule_id: UUID,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    try:
        await campaign_service.delete_automation_rule(db, rule_id)
        return {"success": True}
    except ValueError as e:
        raise HTTPException(404, str(e))


# ═══════════════════════════════════════════════════════════════
# ANALYTICS
# ═══════════════════════════════════════════════════════════════

@router.get("/analytics")
async def get_analytics(
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    tenant_id = UUID(user["tenant_id"])
    return await campaign_service.get_campaign_analytics(db, tenant_id)


# ═══════════════════════════════════════════════════════════════
# WEBHOOK — Automation trigger (called internally by other modules)
# ═══════════════════════════════════════════════════════════════

from pydantic import BaseModel

class AutomationTriggerBody(BaseModel):
    event: str
    customer_id: str
    customer_phone: str
    customer_name: str | None = None
    context: dict = {}


class ChatbotTestBody(BaseModel):
    message: str
    conversation_id: str | None = None
    reset: bool = False


class ChatbotTestResponse(BaseModel):
    response_text: str
    buttons: list[dict]
    next_state: str
    state_description: str
    conversation_id: str


@router.post("/chatbot/test", response_model=ChatbotTestResponse)
async def test_chatbot(
    body: ChatbotTestBody,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    """Test the chatbot engine — send a message and get the simulated response.
    Creates a test conversation if none provided. Pass ?reset to start fresh.
    """
    tenant_id = UUID(user["tenant_id"])
    conv_id = UUID(body.conversation_id) if body.conversation_id else None
    return await campaign_service.chatbot_test(db, tenant_id, body.message, conv_id, body.reset)


@router.post("/trigger")
async def trigger_automation(
    body: AutomationTriggerBody,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    """Trigger automation rules for a given event.
    Called by other modules when something happens (sale created, payment received, etc.)
    """
    tenant_id = UUID(user["tenant_id"])
    ctx = body.context or {}
    ctx.update({
        "customer_id": body.customer_id,
        "customer_phone": body.customer_phone,
        "customer_name": body.customer_name or "Cliente",
    })
    return await campaign_service.trigger_automation(db, tenant_id, body.event, ctx)
