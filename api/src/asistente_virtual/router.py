from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional

from api.src.db import get_db
from api.src.auth.middleware import require_auth
from api.src.features.deps import require_feature
from api.src.asistente_virtual import service
from api.src.asistente_virtual.schemas import SendMessageRequest, TicketUpdate

router = APIRouter(
    prefix="/api/v1/asistente-virtual",
    tags=["asistente-virtual"],
    dependencies=[Depends(require_feature("asistente_virtual")), Depends(require_auth)],
)


@router.post("/message")
async def send_message(
    data: SendMessageRequest,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.send_message(db, user["company_id"], data.model_dump())


@router.get("/conversations")
async def list_conversations(
    status: Optional[str] = Query(None),
    limit: int = Query(50),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.list_conversations(db, user["company_id"], status, limit)


@router.get("/conversations/{conv_id}/messages")
async def get_messages(
    conv_id: str,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.get_conversation_messages(db, user["company_id"], conv_id)


@router.post("/conversations/{conv_id}/end")
async def end_conversation(
    conv_id: str,
    resolved_by_ai: bool = Query(True),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    result = await service.end_conversation(db, user["company_id"], conv_id, resolved_by_ai)
    if not result:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return result


@router.post("/conversations/{conv_id}/rate")
async def rate_conversation(
    conv_id: str,
    score: int = Query(...),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    result = await service.rate_conversation(db, user["company_id"], conv_id, score)
    if not result:
        raise HTTPException(status_code=404, detail="Conversation not found or invalid score")
    return result


@router.get("/tickets")
async def list_tickets(
    status: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    limit: int = Query(50),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.list_tickets(db, user["company_id"], status, category, limit)


@router.patch("/tickets/{ticket_id}")
async def update_ticket(
    ticket_id: str,
    data: TicketUpdate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    result = await service.update_ticket(db, user["company_id"], ticket_id, data.model_dump())
    if not result:
        raise HTTPException(status_code=404, detail="Ticket not found")
    return result


@router.get("/templates")
async def get_templates(
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.get_intent_templates(db, user["company_id"])


@router.post("/templates/seed")
async def seed_templates(
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.seed_default_templates(db, user["company_id"])


@router.get("/dashboard")
async def get_dashboard(
    db: AsyncSession = Depends(get_db),
    user=Depends(require_auth),
):
    return await service.get_dashboard(db, user["company_id"])
