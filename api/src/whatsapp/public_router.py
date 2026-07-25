from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from api.src.db import get_db
from api.src.whatsapp.schemas import TwilioWebhook
from api.src.whatsapp.models import WhatsAppConversation
from api.src.whatsapp import service as whatsapp_service


router = APIRouter(prefix="/api/public/wa", tags=["whatsapp-public"])


@router.get("/chat/{phone}")
async def get_public_chat(
    phone: str,
    limit: int = Query(50, le=500),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(WhatsAppConversation)
        .where(WhatsAppConversation.contact_phone == phone.strip())
    )
    conversation = result.scalar_one_or_none()
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversación no encontrada")

    messages = await whatsapp_service.get_conversation_messages(
        db, conversation.tenant_id, conversation.id, limit, offset
    )
    return {
        "conversation_id": str(conversation.id),
        "contact_phone": conversation.contact_phone,
        "contact_name": conversation.contact_name,
        "messages": [
            {
                "id": str(m.id),
                "direction": m.direction.value if m.direction else "inbound",
                "content": m.content,
                "media_url": m.media_url,
                "status": m.status.value if m.status else "queued",
                "created_at": m.created_at.isoformat(),
            }
            for m in messages
        ],
    }


@router.post("/webhook")
async def public_webhook(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    from api.src.tenants.models import Tenant

    body = await request.form()
    payload = TwilioWebhook(
        From=body.get("From", ""),
        To=body.get("To", ""),
        Body=body.get("Body", ""),
        MessageSid=body.get("MessageSid", ""),
        NumMedia=int(body.get("NumMedia", 0)),
        MediaUrl0=body.get("MediaUrl0"),
        AccountSid=body.get("AccountSid", ""),
    )

    tenant_result = await db.execute(select(Tenant))
    tenants = tenant_result.scalars().all()
    config = None
    for tenant in tenants:
        cfg = await whatsapp_service.get_config(db, tenant.id)
        if cfg and cfg.account_sid == payload.AccountSid:
            config = cfg
            break

    if not config:
        raise HTTPException(status_code=404, detail="Config no found")

    await whatsapp_service.handle_inbound_webhook(db, config, payload)
    return {"status": "ok"}
