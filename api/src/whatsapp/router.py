import re
from datetime import datetime, timezone
from typing import Optional
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


from api.src.whatsapp.evolution_client import evolution_client


@router.get("/status")
async def get_gateway_status(
    user: dict = Depends(require_auth),
):
    """Obtiene el estado de conexión de la instancia de Evolution API."""
    status = await evolution_client.get_instance_status()
    return {
        "success": True,
        "instance": status.get("instance"),
        "state": status.get("state"),
        "connected": status.get("connected", False),
        "gateway_url": evolution_client.base_url,
    }


@router.post("/connect")
async def connect_gateway(
    user: dict = Depends(require_auth),
):
    """Inicia la instancia y retorna el código QR base64 para emparejar WhatsApp."""
    qr_data = await evolution_client.get_qr_code()
    return qr_data


@router.post("/disconnect")
async def disconnect_gateway(
    user: dict = Depends(require_auth),
):
    """Cierra la sesión de WhatsApp en el gateway."""
    result = await evolution_client.disconnect_instance()
    return result


@router.post("/test")
async def test_send_message(
    body: dict,
    user: dict = Depends(require_auth),
):
    """Envía un mensaje de prueba a través de Evolution API."""
    phone = body.get("phone")
    message = body.get("message") or "Mensaje de prueba desde Extra Supermercado (InteliMarket)"
    if not phone:
        raise HTTPException(status_code=400, detail="El campo 'phone' es obligatorio")

    result = await evolution_client.send_text_message(phone, message)
    if not result.get("success"):
        raise HTTPException(status_code=500, detail=result.get("detail", "Error al enviar mensaje"))
    return result


@router.post("/config/test")
async def test_message_legacy(
    request: Request,
    phone: Optional[str] = Query(None),
    content: Optional[str] = Query(None),
    user: dict = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
):
    target_phone = phone
    target_content = content or "Mensaje de prueba desde InteliMarket"
    try:
        body = await request.json()
        target_phone = target_phone or body.get("to") or body.get("phone")
        target_content = body.get("message") or body.get("content") or target_content
    except Exception:
        pass

    if not target_phone:
        raise HTTPException(status_code=400, detail="Número de teléfono requerido ('phone' o 'to')")

    result = await evolution_client.send_text_message(target_phone, target_content)
    if not result.get("success"):
        raise HTTPException(status_code=500, detail=result.get("detail", "Error enviando mensaje"))
    return {"status": "ok", "message": "Mensaje enviado", "result": result}


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


@router.post("/webhook/evolution")
async def evolution_webhook(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """
    Webhook para eventos de Evolution API:
    - QRCODE_UPDATED / qrcode.updated
    - CONNECTION_UPDATE / connection.update
    - MESSAGES_UPSERT / messages.upsert
    """
    try:
        payload = await request.json()
    except Exception:
        return {"status": "ignored", "detail": "Invalid JSON"}

    event = payload.get("event")
    instance = payload.get("instance")
    logger = logging.getLogger("whatsapp.webhook")
    logger.info(f"[Evolution Webhook] Evento recibido: '{event}' para instancia '{instance}'")

    if event in ("messages.upsert", "MESSAGES_UPSERT"):
        msg_data = payload.get("data", {})
        key = msg_data.get("key", {})
        if key.get("fromMe"):
            return {"status": "ignored", "detail": "Outbound message"}

        remote_jid = key.get("remoteJid", "")
        if not remote_jid or remote_jid.endswith("@g.us") or remote_jid == "status@broadcast":
            return {"status": "ignored", "detail": "Group or broadcast"}

        clean_phone = re.sub(r"@(s\.whatsapp\.net|lid)$", "", remote_jid)
        push_name = msg_data.get("pushName") or clean_phone

        # Extraer texto del mensaje
        content = ""
        msg_content = msg_data.get("message", {})
        if "conversation" in msg_content:
            content = msg_content["conversation"]
        elif "extendedTextMessage" in msg_content:
            content = msg_content["extendedTextMessage"].get("text", "")
        elif "imageMessage" in msg_content:
            content = msg_content["imageMessage"].get("caption", "[Imagen]")
        elif "documentMessage" in msg_content:
            content = msg_content["documentMessage"].get("fileName", "[Documento]")

        if not content:
            return {"status": "ignored", "detail": "Empty content"}

        # Buscar o asociar con el primer tenant disponible de la empresa
        from api.src.tenants.models import Tenant
        tenant_res = await db.execute(select(Tenant).limit(1))
        tenant = tenant_res.scalar_one_or_none()
        if not tenant:
            return {"status": "ignored", "detail": "No tenant found"}

        conv = await whatsapp_service.get_or_create_conversation(db, tenant.id, clean_phone, push_name)
        inbound_msg = WhatsAppMessage(
            tenant_id=tenant.id,
            conversation_id=conv.id,
            direction=MessageDirection.inbound,
            content=content,
            message_id=key.get("id"),
            status=MessageStatus.delivered,
        )
        db.add(inbound_msg)
        await db.commit()

        # Si el chatbot o respuesta automática está configurada
        cfg = await whatsapp_service.get_config(db, tenant.id)
        if cfg and cfg.auto_reply:
            from api.src.companies.models import Company
            from api.src.whatsapp.chatbot import ChatbotEngine, update_conversation_state
            comp_res = await db.execute(select(Company).where(Company.tenant_id == tenant.id).limit(1))
            company = comp_res.scalar_one_or_none()
            if company:
                chatbot = ChatbotEngine(db, company.id)
                resp_data = await chatbot.process_message(conv, content)
                if resp_data and resp_data.get("text"):
                    await whatsapp_service.reply_to_conversation(db, tenant.id, conv.id, resp_data["text"])
                    if resp_data.get("next_state"):
                        await update_conversation_state(db, conv.id, resp_data["next_state"])

        return {"status": "ok", "conversation_id": str(conv.id), "message_id": key.get("id")}

    return {"status": "ok", "event": event}


@router.get("/stats", response_model=WhatsAppStats)
async def get_stats(
    user: dict = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
):
    tenant_id = UUID(user["tenant_id"])
    stats = await whatsapp_service.get_stats(db, tenant_id)
    return WhatsAppStats(**stats)
