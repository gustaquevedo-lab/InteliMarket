import logging
import re
from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Header
from sqlalchemy import select, delete, func, or_
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
from api.src.whatsapp.models import (
    WhatsAppConversation,
    WhatsAppMessage,
    MessageDirection,
    MessageStatus,
    ConversationStatus,
)
from api.src.whatsapp.evolution_client import evolution_client, normalize_phone_e164

logger = logging.getLogger("whatsapp.router")


router = APIRouter(prefix="/api/v1/whatsapp", tags=["whatsapp"])


def _val(obj, default=""):
    if obj is None:
        return default
    if hasattr(obj, "value"):
        return obj.value
    return str(obj)


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


@router.get("/chatbot-config")
async def get_chatbot_config(
    user: dict = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
):
    from api.src.tenants.models import Tenant
    tenant_id = UUID(user["tenant_id"])
    tenant = await db.get(Tenant, tenant_id)
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant no encontrado")

    cfg = await whatsapp_service.get_config(db, tenant_id)
    t_cfg = tenant.config or {}
    bot_cfg = t_cfg.get("chatbot", {})

    default_config = {
        "bot_name": "ExtraBot",
        "auto_reply": cfg.auto_reply if cfg else True,
        "welcome_message": "¡Hola {cliente}! 👋 Bienvenido al canal oficial de atención de Extra Supermercado.",
        "out_of_hours_message": "¡Hola! En este momento nuestras sucursales se encuentran cerradas. Nuestro horario de atención es de Lunes a Sábados de 07:00 a 21:00 hs y Domingos de 07:30 a 13:00 hs. Dejanos tu consulta y te responderemos ni bien abramos.",
        "business_hours_start": "07:00",
        "business_hours_end": "21:00",
        "business_days": ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado"],
        "modules_enabled": {
            "catalog_search": True,
            "extraclub_points": True,
            "order_tracking": True,
            "supermarket_info": True,
            "human_handoff": True,
        },
        "keywords": [
            {
                "id": "kw-delivery",
                "name": "Envíos a Domicilio",
                "keywords": ["delivery", "envio", "envíos", "domicilio", "flete"],
                "response": "🚚 *Envíos a Domicilio — Extra Supermercado*\n\nRealizamos entregas de Lunes a Sábados de 08:00 a 19:00 hs.\n📍 *Cobertura:* Radio de hasta 15 km de nuestras sucursales.\n💵 *Costo de envío:* Gs. 15.000 (¡Envío GRATIS en compras superiores a Gs. 300.000!).\n\nPodés pasarnos tu lista de compras por este chat indicando los productos.",
                "active": True,
            },
            {
                "id": "kw-banco",
                "name": "Datos Bancarios y Pagos",
                "keywords": ["transferencia", "banco", "alias", "pix", "datos bancarios", "cuenta", "pagar"],
                "response": "💳 *Datos Bancarios Oficiales — Extra Supermercado*\n\n🏦 *Banco:* Banco Continental\n📄 *Razón Social:* GRUPO SANTA TERESA E.A.S.\n🆔 *RUC:* 80150377-9\n🔢 *Cta. Cte. Gs:* 01-2345678-01\n📲 *Alias / PIX:* compras@superextra.com.py\n\n_Por favor envianos tu comprobante por este medio una vez realizada la transferencia._",
                "active": True,
            },
            {
                "id": "kw-carniceria",
                "name": "Carnicería y Cortes Asado",
                "keywords": ["carniceria", "carnicería", "asado", "costilla", "vacio", "vacío", "carne"],
                "response": "🥩 *Cortes Especiales & Carnicería — Extra Supermercado*\n\n¡Cortes frescos envasados al vacío y seleccionados para tu asado!\n🔥 Costilla de primera\n🔥 Tapa cuadril, vacío y colita\n🔥 Chorizos parrilleros artesanales\n\nEscribí el nombre del corte para consultar precio en Gs. o acercate a cualquiera de nuestras sucursales.",
                "active": True,
            },
        ],
        "custom_menu_options": [
            {
                "id": "opt-delivery",
                "number": "6",
                "title": "Envíos & Delivery a Domicilio",
                "response": "🚚 *Envíos a Domicilio — Extra Supermercado*\n\nRealizamos entregas de Lunes a Sábados de 08:00 a 19:00 hs.\n📍 *Cobertura:* Radio de hasta 15 km de sucursales.\n💵 *Costo:* Gs. 15.000 (¡Gratis a partir de Gs. 300.000!).\n\nDejanos tu lista de productos para coordinar despacho.",
                "active": True,
            },
            {
                "id": "opt-banco",
                "number": "7",
                "title": "Cuentas Bancarias & Pagos",
                "response": "💳 *Datos Bancarios Oficiales — Extra Supermercado*\n\n🏦 *Banco:* Banco Continental\n📄 *Razón Social:* GRUPO SANTA TERESA E.A.S.\n🆔 *RUC:* 80150377-9\n🔢 *Cta. Cte. Gs:* 01-2345678-01\n📲 *Alias / PIX:* compras@superextra.com.py",
                "active": True,
            },
        ],
    }
    merged = {**default_config, **bot_cfg}
    # Asegurar que keywords y custom_menu_options existan en el resultado
    if "keywords" not in merged:
        merged["keywords"] = default_config["keywords"]
    if "custom_menu_options" not in merged:
        merged["custom_menu_options"] = default_config["custom_menu_options"]
    merged["auto_reply"] = cfg.auto_reply if cfg else True
    return merged


@router.post("/toggle-auto-reply")
async def toggle_auto_reply(
    body: dict,
    user: dict = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
):
    """Activa o desactiva de inmediato el auto-responder de WhatsApp."""
    from api.src.tenants.models import Tenant
    from sqlalchemy.orm.attributes import flag_modified
    tenant_id = UUID(user["tenant_id"])
    tenant = await db.get(Tenant, tenant_id)
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant no encontrado")

    active = bool(body.get("active", False))
    await whatsapp_service.save_config(db, tenant_id, {"auto_reply": active})

    t_cfg = dict(tenant.config or {})
    bot_cfg = dict(t_cfg.get("chatbot", {}))
    bot_cfg["auto_reply"] = active
    if "flow" in bot_cfg and isinstance(bot_cfg["flow"], dict):
        bot_cfg["flow"]["active"] = active
    t_cfg["chatbot"] = bot_cfg
    tenant.config = t_cfg
    flag_modified(tenant, "config")
    await db.commit()
    logger.info(f"[Chatbot] Auto-responder cambiado a: {active} para tenant {tenant_id}")
    return {"status": "ok", "auto_reply": active}


@router.put("/chatbot-config")
async def save_chatbot_config(
    body: dict,
    user: dict = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
):
    from api.src.tenants.models import Tenant
    from sqlalchemy.orm.attributes import flag_modified
    tenant_id = UUID(user["tenant_id"])
    tenant = await db.get(Tenant, tenant_id)
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant no encontrado")

    auto_reply = bool(body.get("auto_reply", False))
    await whatsapp_service.save_config(db, tenant_id, {"auto_reply": auto_reply})

    t_cfg = dict(tenant.config or {})
    existing_bot_cfg = dict(t_cfg.get("chatbot", {}))
    if "flow" in existing_bot_cfg and "flow" not in body:
        body["flow"] = existing_bot_cfg["flow"]
    if isinstance(body.get("flow"), dict):
        body["flow"]["active"] = auto_reply

    t_cfg["chatbot"] = body
    tenant.config = t_cfg
    flag_modified(tenant, "config")
    await db.commit()
    return {"status": "ok", "config": body}


@router.get("/flow")
async def get_bot_flow(
    user: dict = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
):
    """Obtiene la configuración del flujo visual activo para el bot de WhatsApp."""
    from api.src.tenants.models import Tenant
    from api.src.whatsapp.chatbot import DEFAULT_BOT_FLOW
    tenant_id = UUID(user["tenant_id"])
    tenant = await db.get(Tenant, tenant_id)
    t_cfg = (tenant.config or {}) if tenant else {}
    bot_cfg = t_cfg.get("chatbot", {})
    flow = bot_cfg.get("flow") or DEFAULT_BOT_FLOW
    return {"status": "ok", "flow": flow}


@router.put("/flow")
async def save_bot_flow(
    body: dict,
    user: dict = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
):
    """Guarda y publica la configuración del flujo visual del bot de WhatsApp."""
    from api.src.tenants.models import Tenant
    from sqlalchemy.orm.attributes import flag_modified
    tenant_id = UUID(user["tenant_id"])
    tenant = await db.get(Tenant, tenant_id)
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant no encontrado")

    t_cfg = dict(tenant.config or {})
    bot_cfg = dict(t_cfg.get("chatbot", {}))
    flow_data = body.get("flow") or body
    flow_active = bool(flow_data.get("active", True)) if isinstance(flow_data, dict) else True
    bot_cfg["flow"] = flow_data
    bot_cfg["auto_reply"] = flow_active
    await whatsapp_service.save_config(db, tenant_id, {"auto_reply": flow_active})

    t_cfg["chatbot"] = bot_cfg
    tenant.config = t_cfg
    flag_modified(tenant, "config")
    await db.commit()
    return {"status": "ok", "flow": bot_cfg["flow"]}


@router.post("/flow/reset")
async def reset_bot_flow(
    user: dict = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
):
    """Restaura el flujo oficial recomendado para Extra Supermercado."""
    from api.src.tenants.models import Tenant
    from api.src.whatsapp.chatbot import DEFAULT_BOT_FLOW
    from sqlalchemy.orm.attributes import flag_modified
    tenant_id = UUID(user["tenant_id"])
    tenant = await db.get(Tenant, tenant_id)
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant no encontrado")

    t_cfg = dict(tenant.config or {})
    bot_cfg = dict(t_cfg.get("chatbot", {}))
    bot_cfg["flow"] = DEFAULT_BOT_FLOW
    t_cfg["chatbot"] = bot_cfg
    tenant.config = t_cfg
    flag_modified(tenant, "config")
    await db.commit()
    return {"status": "ok", "flow": DEFAULT_BOT_FLOW}


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
    db: AsyncSession = Depends(get_db),
):
    """Envía un mensaje de prueba a través de Evolution API y registra la conversación."""
    tenant_id = UUID(user["tenant_id"])
    phone = body.get("phone")
    message = body.get("message") or "Mensaje de prueba desde Extra Supermercado (InteliMarket)"
    if not phone:
        raise HTTPException(status_code=400, detail="El campo 'phone' es obligatorio")

    result = await evolution_client.send_text_message(phone, message)
    if not result.get("success"):
        raise HTTPException(status_code=500, detail=result.get("detail", "Error al enviar mensaje"))

    # Crear / actualizar conversación para que aparezca de inmediato en la bandeja de Chat en Vivo
    try:
        conv = await whatsapp_service.get_or_create_conversation(db, tenant_id, phone, name=phone)
        msg_id = (
            result.get("data", {}).get("key", {}).get("id")
            or result.get("message_id")
            or f"test-{datetime.now(timezone.utc).timestamp()}"
        )
        outbound_msg = WhatsAppMessage(
            tenant_id=tenant_id,
            conversation_id=conv.id,
            direction=MessageDirection.outbound,
            content=message,
            message_id=msg_id,
            status=MessageStatus.sent,
        )
        db.add(outbound_msg)
        conv.last_message_at = datetime.now(timezone.utc)
        await db.commit()
    except Exception as e:
        logger.error(f"Error registrando mensaje de prueba en BD: {e}", exc_info=True)

    return result


@router.post("/config/test")
async def test_message_legacy(
    request: Request,
    phone: Optional[str] = Query(None),
    content: Optional[str] = Query(None),
    user: dict = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
):
    tenant_id = UUID(user["tenant_id"])
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

    try:
        conv = await whatsapp_service.get_or_create_conversation(db, tenant_id, target_phone, name=target_phone)
        msg_id = (
            result.get("data", {}).get("key", {}).get("id")
            or result.get("message_id")
            or f"test-{datetime.now(timezone.utc).timestamp()}"
        )
        outbound_msg = WhatsAppMessage(
            tenant_id=tenant_id,
            conversation_id=conv.id,
            direction=MessageDirection.outbound,
            content=target_content,
            message_id=msg_id,
            status=MessageStatus.sent,
        )
        db.add(outbound_msg)
        conv.last_message_at = datetime.now(timezone.utc)
        await db.commit()
    except Exception as e:
        logger.error(f"Error registrando mensaje de prueba legacy en BD: {e}", exc_info=True)

    return {"status": "ok", "message": "Mensaje enviado", "result": result}


@router.get("/conversations")
async def list_conversations(
    status: str = Query(None),
    limit: int = Query(50, le=500),
    offset: int = Query(0, ge=0),
    user: dict = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
):
    tenant_id = UUID(user["tenant_id"])
    query = select(WhatsAppConversation).where(WhatsAppConversation.tenant_id == tenant_id)
    if status:
        query = query.where(WhatsAppConversation.status == status)
    else:
        # Por defecto excluir pruebas simuladas o números ficticios
        query = query.where(WhatsAppConversation.status != "simulated")
        query = query.where(WhatsAppConversation.contact_phone != "+595990000000")

    query = query.order_by(
        WhatsAppConversation.last_message_at.desc().nulls_last(),
        WhatsAppConversation.created_at.desc()
    ).limit(limit).offset(offset)
    result = await db.execute(query)
    convs = list(result.scalars().all())
    if not convs:
        return []

    conv_ids = [c.id for c in convs]

    # Último mensaje para preview
    subq = (
        select(
            WhatsAppMessage.conversation_id,
            WhatsAppMessage.content,
            func.row_number().over(
                partition_by=WhatsAppMessage.conversation_id,
                order_by=WhatsAppMessage.created_at.desc()
            ).label("rn")
        )
        .where(WhatsAppMessage.conversation_id.in_(conv_ids))
        .subquery()
    )
    latest_msgs_res = await db.execute(
        select(subq.c.conversation_id, subq.c.content).where(subq.c.rn == 1)
    )
    previews = {row[0]: row[1] for row in latest_msgs_res.all()}

    # Total de mensajes por conversación
    count_res = await db.execute(
        select(WhatsAppMessage.conversation_id, func.count(WhatsAppMessage.id))
        .where(WhatsAppMessage.conversation_id.in_(conv_ids))
        .group_by(WhatsAppMessage.conversation_id)
    )
    counts = {row[0]: row[1] for row in count_res.all()}

    return [
        WhatsAppConversationResponse(
            id=c.id,
            tenant_id=c.tenant_id,
            contact_id=c.contact_id,
            contact_name=c.contact_name,
            contact_phone=c.contact_phone,
            last_message_at=c.last_message_at,
            status=_val(c.status, "active"),
            session_state=c.session_state or "idle",
            session_data=c.session_data,
            last_message_preview=previews.get(c.id),
            total_messages=counts.get(c.id, 0),
            created_at=c.created_at,
        )
        for c in convs
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
        status=_val(conversation.status, "active"),
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
            direction=_val(m.direction, "inbound"),
            content=m.content,
            message_id=m.message_id,
            media_url=m.media_url,
            status=_val(m.status, "queued"),
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
        direction=_val(msg.direction, "outbound"),
        content=msg.content,
        message_id=msg.message_id,
        media_url=msg.media_url,
        status=_val(msg.status, "queued"),
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


@router.delete("/conversations/{conv_id}")
async def delete_conversation(
    conv_id: str,
    user: dict = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
):
    """Elimina una conversación y todo su historial de mensajes."""
    tenant_id = UUID(user["tenant_id"])
    from uuid import UUID as U
    c_uuid = U(conv_id)
    await db.execute(
        delete(WhatsAppMessage)
        .where(WhatsAppMessage.tenant_id == tenant_id)
        .where(WhatsAppMessage.conversation_id == c_uuid)
    )
    res = await db.execute(
        delete(WhatsAppConversation)
        .where(WhatsAppConversation.tenant_id == tenant_id)
        .where(WhatsAppConversation.id == c_uuid)
    )
    await db.commit()
    return {"status": "ok", "deleted": res.rowcount}


@router.delete("/conversations/cleanup/tests")
@router.post("/conversations/cleanup/tests")
async def cleanup_test_conversations(
    user: dict = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
):
    """Limpia las conversaciones residuales de pruebas y del simulador."""
    tenant_id = UUID(user["tenant_id"])
    test_conv_res = await db.execute(
        select(WhatsAppConversation.id).where(
            WhatsAppConversation.tenant_id == tenant_id,
            or_(
                WhatsAppConversation.contact_phone.like("%0000000%"),
                WhatsAppConversation.contact_name == "Test Simulador",
                WhatsAppConversation.status == "simulated",
            )
        )
    )
    test_ids = [row[0] for row in test_conv_res.all()]
    if test_ids:
        await db.execute(
            delete(WhatsAppMessage).where(WhatsAppMessage.conversation_id.in_(test_ids))
        )
        await db.execute(
            delete(WhatsAppConversation).where(WhatsAppConversation.id.in_(test_ids))
        )
        await db.commit()
    return {"status": "ok", "deleted_count": len(test_ids)}



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
            tipo=_val(t.tipo, "custom"),
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
        tipo=_val(template.tipo, "custom"),
        active=template.active,
        created_at=template.created_at,
    )


@router.post("/templates/seed")
async def seed_templates(
    user: dict = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
):
    """Sincroniza y re-siembra las plantillas oficiales de Extra Supermercado."""
    tenant_id = UUID(user["tenant_id"])
    await whatsapp_service.seed_default_templates(db, tenant_id, force=True)
    templates = await whatsapp_service.get_templates(db, tenant_id)
    return [
        WhatsAppTemplateResponse(
            id=t.id,
            tenant_id=t.tenant_id,
            name=t.name,
            content=t.content,
            tipo=_val(t.tipo, "custom"),
            active=t.active,
            created_at=t.created_at,
        )
        for t in templates
    ]


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
    try:
        template = await whatsapp_service.update_template(db, tenant_id, U(template_id), data)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al actualizar plantilla: {str(e)}")

    return WhatsAppTemplateResponse(
        id=template.id,
        tenant_id=template.tenant_id,
        name=template.name,
        content=template.content,
        tipo=_val(template.tipo, "custom"),
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
    try:
        await whatsapp_service.delete_template(db, tenant_id, U(template_id))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al eliminar plantilla: {str(e)}")
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
    logger.info(f"[Evolution Webhook] Evento recibido: '{event}' para instancia '{instance}'")

    if event in ("messages.upsert", "MESSAGES_UPSERT"):
        msg_data = payload.get("data", {})
        key = msg_data.get("key", {})
        if key.get("fromMe"):
            return {"status": "ignored", "detail": "Outbound message"}

        remote_jid = key.get("remoteJid", "")
        if not remote_jid or remote_jid.endswith("@g.us") or remote_jid == "status@broadcast":
            return {"status": "ignored", "detail": "Group or broadcast"}

        # Soporte para WhatsApp iOS / Moderno que usa identificadores LID (@lid)
        sender_jid = remote_jid
        if remote_jid.endswith("@lid"):
            alt_jid = key.get("remoteJidAlt") or msg_data.get("remoteJidAlt") or key.get("participant")
            if alt_jid and "@s.whatsapp.net" in str(alt_jid):
                sender_jid = alt_jid

        raw_phone = sender_jid.split("@")[0].split(":")[0]
        clean_phone = re.sub(r"[^\d+]", "", raw_phone)
        push_name = msg_data.get("pushName") or clean_phone

        # Extraer texto o respuesta de botón/lista
        content = ""
        msg_content = msg_data.get("message", {})
        if "conversation" in msg_content:
            content = msg_content["conversation"]
        elif "extendedTextMessage" in msg_content:
            content = msg_content["extendedTextMessage"].get("text", "")
        elif "buttonsResponseMessage" in msg_content:
            b_resp = msg_content["buttonsResponseMessage"]
            content = b_resp.get("selectedDisplayText") or b_resp.get("selectedButtonId", "")
        elif "listResponseMessage" in msg_content:
            l_resp = msg_content["listResponseMessage"]
            single_reply = l_resp.get("singleSelectReply", {})
            content = single_reply.get("selectedRowId") or l_resp.get("title", "")
        elif "templateButtonReplyMessage" in msg_content:
            t_resp = msg_content["templateButtonReplyMessage"]
            content = t_resp.get("selectedDisplayText") or t_resp.get("selectedId", "")
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
        conv.last_message_at = datetime.now(timezone.utc)
        await db.commit()

        # Si el chatbot o respuesta automática está configurada
        try:
            t_cfg = (tenant.config or {}) if tenant else {}
            bot_cfg = t_cfg.get("chatbot", {})
            flow_cfg = bot_cfg.get("flow") or {}

            # El bot responde si auto_reply está activo Y el flujo no está en pausa
            flow_active = flow_cfg.get("active", True)
            auto_reply_active = bot_cfg.get("auto_reply", False)
            should_reply = bool(auto_reply_active and flow_active)

            if not should_reply:
                logger.info(f"[Evolution Webhook] Chatbot en PAUSA para '{clean_phone}'. No se genera respuesta (auto_reply={auto_reply_active}, flow_active={flow_active})")
            else:
                from api.src.companies.models import Company
                from api.src.whatsapp.chatbot import ChatbotEngine
                comp_res = await db.execute(select(Company).where(Company.tenant_id == tenant.id).limit(1))
                company = comp_res.scalar_one_or_none()
                if not company:
                    comp_res = await db.execute(select(Company).limit(1))
                    company = comp_res.scalar_one_or_none()

                if company:
                    chatbot = ChatbotEngine(db, company.id)
                    logger.info(f"[Evolution Webhook] Disparando motor de bot para '{clean_phone}' mensaje: '{content}'")
                    resp_data = await chatbot.process_message(conv, content)
                    if resp_data and resp_data.get("text"):
                        logger.info(f"[Evolution Webhook] Despachando mensaje de flujo a '{clean_phone}'")
                        await evolution_client.send_text_message(clean_phone, resp_data["text"])

                        # Registrar mensaje saliente en la conversación del sistema
                        outbound_msg = WhatsAppMessage(
                            tenant_id=tenant.id,
                            conversation_id=conv.id,
                            direction=MessageDirection.outbound,
                            content=resp_data["text"],
                            message_id=f"bot-{datetime.now(timezone.utc).timestamp()}",
                            status=MessageStatus.sent,
                        )
                        db.add(outbound_msg)
                        conv.last_message_at = datetime.now(timezone.utc)
                        if resp_data.get("next_state"):
                            conv.session_state = resp_data["next_state"]
                        await db.commit()
        except Exception as bot_err:
            logger.error(f"[Evolution Webhook] Error en respuesta de chatbot: {bot_err}", exc_info=True)

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
