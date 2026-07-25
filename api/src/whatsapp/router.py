import re
from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Header
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.db import get_db
from api.src.auth.middleware import require_auth
from api.src.whatsapp.schemas import (
    WhatsAppConfigCreate, WhatsAppConfigUpdate, WhatsAppConfigResponse,
    WhatsAppConversationResponse, WhatsAppMessageResponse,
    WhatsAppTemplateCreate, WhatsAppTemplateUpdate, WhatsAppTemplateResponse,
    TwilioWebhook, SendMessageRequest, WhatsAppStats,
)
from api.src.whatsapp import service as whatsapp_service
from api.src.whatsapp.models import WhatsAppConversation


router = APIRouter(prefix="/api/v1/whatsapp", tags=["whatsapp"])


@router.get("/config", response_model=WhatsAppConfigResponse)
async def get_config(
    user: dict = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
):
    tenant_id = UUID(user["tenant_id"])
    config = await whatsapp_service.get_config(db, tenant_id)
    if not config:
        raise HTTPException(status_code=404, detail="Configuración no encontrada")
    return WhatsAppConfigResponse.from_config(config)


@router.put("/config", response_model=WhatsAppConfigResponse)
async def save_config(
    body: WhatsAppConfigCreate,
    user: dict = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
):
    tenant_id = UUID(user["tenant_id"])
    data = body.model_dump()
    config = await whatsapp_service.save_config(db, tenant_id, data)
    return WhatsAppConfigResponse.from_config(config)


@router.post("/config/test")
async def test_message(
    phone: str = Query(...),
    content: str = Query("Mensaje de prueba desde InteliMarket"),
    user: dict = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
):
    tenant_id = UUID(user["tenant_id"])
    config = await whatsapp_service.get_config(db, tenant_id)
    if not config:
        raise HTTPException(status_code=404, detail="Configuración no encontrada")
    if not config.enabled:
        raise HTTPException(status_code=400, detail="WhatsApp no está habilitado")
    try:
        await whatsapp_service.make_twilio_call(phone, content, config)
        return {"status": "ok", "message": "Mensaje enviado"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error enviando mensaje: {str(e)}")


@router.get("/conversations")
async def list_conversations(
    status: str = Query(None),
    limit: int = Query(50, le=500),
    offset: int = Query(0, ge=0),
    user: dict = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
):
    from sqlalchemy import select
    tenant_id = UUID(user["tenant_id"])
    query = select(WhatsAppConversation).where(WhatsAppConversation.tenant_id == tenant_id)
    if status:
        query = query.where(WhatsAppConversation.status == status)
    query = query.order_by(WhatsAppConversation.last_message_at.desc()).limit(limit).offset(offset)
    result = await db.execute(query)
    return [
        WhatsAppConversationResponse(
            id=c.id,
            tenant_id=c.tenant_id,
            contact_id=c.contact_id,
            contact_name=c.contact_name,
            contact_phone=c.contact_phone,
            last_message_at=c.last_message_at,
            status=c.status.value if c.status else "active",
            created_at=c.created_at,
        )
        for c in result.scalars().all()
    ]


@router.get("/conversations/{conv_id}")
async def get_conversation(
    conv_id: str,
    user: dict = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
):
    tenant_id = UUID(user["tenant_id"])
    from uuid import UUID as U
    conversation = await db.get(WhatsAppConversation, U(conv_id))
    if not conversation or conversation.tenant_id != tenant_id:
        raise HTTPException(status_code=404, detail="Conversación no encontrada")
    return WhatsAppConversationResponse(
        id=conversation.id,
        tenant_id=conversation.tenant_id,
        contact_id=conversation.contact_id,
        contact_name=conversation.contact_name,
        contact_phone=conversation.contact_phone,
        last_message_at=conversation.last_message_at,
        status=conversation.status.value if conversation.status else "active",
        created_at=conversation.created_at,
    )


@router.get("/conversations/{conv_id}/messages")
async def get_messages(
    conv_id: str,
    limit: int = Query(50, le=500),
    offset: int = Query(0, ge=0),
    user: dict = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
):
    tenant_id = UUID(user["tenant_id"])
    from uuid import UUID as U
    messages = await whatsapp_service.get_conversation_messages(db, tenant_id, U(conv_id), limit, offset)
    return [
        WhatsAppMessageResponse(
            id=m.id,
            tenant_id=m.tenant_id,
            conversation_id=m.conversation_id,
            direction=m.direction.value if m.direction else "inbound",
            content=m.content,
            message_id=m.message_id,
            media_url=m.media_url,
            status=m.status.value if m.status else "queued",
            command=m.command,
            created_at=m.created_at,
        )
        for m in messages
    ]


@router.post("/conversations/{conv_id}/messages")
async def send_outbound_message(
    conv_id: str,
    body: SendMessageRequest,
    user: dict = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
):
    tenant_id = UUID(user["tenant_id"])
    from uuid import UUID as U
    msg = await whatsapp_service.send_message(db, tenant_id, U(conv_id), body.content, body.media_url)
    return WhatsAppMessageResponse(
        id=msg.id,
        tenant_id=msg.tenant_id,
        conversation_id=msg.conversation_id,
        direction=msg.direction.value if msg.direction else "outbound",
        content=msg.content,
        message_id=msg.message_id,
        media_url=msg.media_url,
        status=msg.status.value if msg.status else "queued",
        command=msg.command,
        created_at=msg.created_at,
    )


@router.put("/conversations/{conv_id}/archive")
async def archive_conversation(
    conv_id: str,
    user: dict = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
):
    tenant_id = UUID(user["tenant_id"])
    from uuid import UUID as U
    await whatsapp_service.archive_conversation(db, tenant_id, U(conv_id))
    return {"status": "ok"}


@router.get("/templates")
async def list_templates(
    user: dict = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
):
    tenant_id = UUID(user["tenant_id"])
    templates = await whatsapp_service.get_templates(db, tenant_id)
    return [
        WhatsAppTemplateResponse(
            id=t.id,
            tenant_id=t.tenant_id,
            name=t.name,
            content=t.content,
            tipo=t.tipo.value if t.tipo else "custom",
            active=t.active,
            created_at=t.created_at,
        )
        for t in templates
    ]


@router.post("/templates")
async def create_template(
    body: WhatsAppTemplateCreate,
    user: dict = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
):
    tenant_id = UUID(user["tenant_id"])
    data = body.model_dump()
    template = await whatsapp_service.create_template(db, tenant_id, data)
    return WhatsAppTemplateResponse(
        id=template.id,
        tenant_id=template.tenant_id,
        name=template.name,
        content=template.content,
        tipo=template.tipo.value if template.tipo else "custom",
        active=template.active,
        created_at=template.created_at,
    )


@router.put("/templates/{template_id}")
async def update_template(
    template_id: str,
    body: WhatsAppTemplateUpdate,
    user: dict = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
):
    tenant_id = UUID(user["tenant_id"])
    from uuid import UUID as U
    data = {k: v for k, v in body.model_dump().items() if v is not None}
    template = await whatsapp_service.update_template(db, tenant_id, U(template_id), data)
    return WhatsAppTemplateResponse(
        id=template.id,
        tenant_id=template.tenant_id,
        name=template.name,
        content=template.content,
        tipo=template.tipo.value if template.tipo else "custom",
        active=template.active,
        created_at=template.created_at,
    )


@router.delete("/templates/{template_id}")
async def delete_template(
    template_id: str,
    user: dict = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
):
    tenant_id = UUID(user["tenant_id"])
    from uuid import UUID as U
    await whatsapp_service.delete_template(db, tenant_id, U(template_id))
    return {"status": "ok"}


@router.post("/webhook")
async def webhook(
    request: Request,
    x_twilio_signature: str = Header("", alias="X-Twilio-Signature"),
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
        raise HTTPException(status_code=404, detail="Configuración no encontrada")

    if x_twilio_signature:
        url = str(request.url)
        params = {k: v for k, v in body.items()}
        if not whatsapp_service.verify_twilio_signature(config.auth_token, x_twilio_signature, url, params):
            raise HTTPException(status_code=403, detail="Firma inválida")

    result = await whatsapp_service.handle_inbound_webhook(db, config, payload)
    return result


@router.get("/stats", response_model=WhatsAppStats)
async def get_stats(
    user: dict = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
):
    tenant_id = UUID(user["tenant_id"])
    stats = await whatsapp_service.get_stats(db, tenant_id)
    return WhatsAppStats(**stats)
