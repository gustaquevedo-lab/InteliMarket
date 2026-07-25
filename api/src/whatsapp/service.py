import hmac
import hashlib
import base64
import re
from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

import httpx
from sqlalchemy import select, update, func, text
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.whatsapp.models import (
    WhatsAppConfig, WhatsAppConversation, WhatsAppMessage, WhatsAppTemplate,
    ConversationStatus, MessageDirection, MessageStatus, TemplateTipo,
)
from api.src.whatsapp.schemas import TwilioWebhook


TWILIO_API_URL = "https://api.twilio.com/2010-04-01"


def mask_token(token: str) -> str:
    return "****"


def verify_twilio_signature(auth_token: str, signature: str, url: str, params: dict) -> bool:
    data = url + "".join(f"{k}{v}" for k, v in sorted(params.items()))
    expected = base64.b64encode(
        hmac.new(auth_token.encode(), data.encode(), hashlib.sha1).digest()
    ).decode()
    return hmac.compare_digest(expected, signature)


async def get_config(db: AsyncSession, tenant_id: UUID) -> Optional[WhatsAppConfig]:
    result = await db.execute(
        select(WhatsAppConfig).where(WhatsAppConfig.tenant_id == tenant_id)
    )
    return result.scalar_one_or_none()


async def save_config(db: AsyncSession, tenant_id: UUID, data: dict) -> WhatsAppConfig:
    config = await get_config(db, tenant_id)
    if config:
        for key, value in data.items():
            if value is not None and key != "auth_token" or (key == "auth_token" and value):
                setattr(config, key, value)
        await db.commit()
        await db.refresh(config)
        return config
    else:
        config = WhatsAppConfig(tenant_id=tenant_id, **data)
        db.add(config)
        await db.commit()
        await db.refresh(config)
        return config


async def make_twilio_call(to_phone: str, content: str, config: WhatsAppConfig, media_url: Optional[str] = None) -> dict:
    url = f"{TWILIO_API_URL}/Accounts/{config.account_sid}/Messages.json"
    auth = (config.account_sid, config.auth_token)
    data = {
        "From": config.phone_number,
        "To": to_phone,
        "Body": content,
    }
    if media_url:
        data["MediaUrl"] = media_url

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(url, data=data, auth=auth)
        resp.raise_for_status()
        return resp.json()


async def get_or_create_conversation(
    db: AsyncSession, tenant_id: UUID, phone: str, name: Optional[str] = None
) -> WhatsAppConversation:
    clean_phone = re.sub(r"[^\d+]", "", phone)
    result = await db.execute(
        select(WhatsAppConversation)
        .where(WhatsAppConversation.tenant_id == tenant_id)
        .where(WhatsAppConversation.contact_phone == clean_phone)
    )
    conv = result.scalar_one_or_none()
    if conv:
        conv.last_message_at = datetime.now(timezone.utc)
        await db.commit()
        return conv
    conv = WhatsAppConversation(
        tenant_id=tenant_id,
        contact_phone=clean_phone,
        contact_name=name,
        last_message_at=datetime.now(timezone.utc),
    )
    db.add(conv)
    await db.commit()
    await db.refresh(conv)
    return conv


async def get_conversation_messages(
    db: AsyncSession, tenant_id: UUID, conversation_id: UUID, limit: int = 50, offset: int = 0
) -> list:
    result = await db.execute(
        select(WhatsAppMessage)
        .where(WhatsAppMessage.tenant_id == tenant_id)
        .where(WhatsAppMessage.conversation_id == conversation_id)
        .order_by(WhatsAppMessage.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    return list(result.scalars().all())


async def archive_conversation(db: AsyncSession, tenant_id: UUID, conversation_id: UUID):
    await db.execute(
        update(WhatsAppConversation)
        .where(WhatsAppConversation.id == conversation_id)
        .where(WhatsAppConversation.tenant_id == tenant_id)
        .values(status=ConversationStatus.archived)
    )
    await db.commit()


async def send_message(
    db: AsyncSession, tenant_id: UUID, conversation_id: UUID, content: str, media_url: Optional[str] = None
) -> WhatsAppMessage:
    config = await get_config(db, tenant_id)
    conversation = await db.get(WhatsAppConversation, conversation_id)

    msg = WhatsAppMessage(
        tenant_id=tenant_id,
        conversation_id=conversation_id,
        direction=MessageDirection.outbound,
        content=content,
        media_url=media_url,
        status=MessageStatus.queued,
    )
    db.add(msg)
    await db.flush()

    if config and config.enabled:
        twilio_resp = await make_twilio_call(conversation.contact_phone, content, config, media_url)
        msg.message_id = twilio_resp.get("sid")
        msg.status = MessageStatus.sent

    await db.commit()
    await db.refresh(msg)
    return msg


async def reply_to_conversation(
    db: AsyncSession, tenant_id: UUID, conversation_id: UUID, response: str, command: Optional[str] = None
) -> WhatsAppMessage:
    config = await get_config(db, tenant_id)
    conversation = await db.get(WhatsAppConversation, conversation_id)

    msg = WhatsAppMessage(
        tenant_id=tenant_id,
        conversation_id=conversation_id,
        direction=MessageDirection.outbound,
        content=response,
        status=MessageStatus.queued,
        command=command,
    )
    db.add(msg)
    await db.flush()

    if config and config.enabled:
        twilio_resp = await make_twilio_call(conversation.contact_phone, response, config)
        msg.message_id = twilio_resp.get("sid")
        msg.status = MessageStatus.sent

    conversation.last_message_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(msg)
    return msg


def parse_command(body: str) -> tuple[Optional[str], Optional[str]]:
    body = body.strip()
    if not body.startswith("/"):
        return None, None
    parts = body.split(maxsplit=1)
    cmd = parts[0].lower()
    args = parts[1].strip() if len(parts) > 1 else ""
    return cmd, args


GREETING_RE = re.compile(r"^(hola|buenos?\\s*dias|buenas?\\s*(tardes|noches)?|saludos?|hello|hi)\\b", re.IGNORECASE)


async def execute_command(
    db: AsyncSession, command: str, args: str, tenant_id: UUID, company_name: str = "InteliMarket", raw_body: str = ""
) -> str:
    from sqlalchemy import or_, Date
    from api.src.sales.models import Sale
    from api.src.products.models import Product
    from api.src.inventory.models import StockLot
    from uuid import UUID

    if command == "/ayuda":
        return (
            "📋 *Menú de comandos*\n"
            "/stock [producto] - Consultar stock\n"
            "/pedido [id] - Estado de tu pedido\n"
            "/estado [id] - Estado de pago\n"
            "/ventas - Resumen del día\n"
            "/ayuda - Este menú"
        )

    if command == "/stock":
        if not args:
            return "📦 Indica el nombre del producto: /stock [nombre]"
        result = await db.execute(
            select(Product)
            .where(Product.nombre.ilike(f"%{args}%"))
        )
        products = result.scalars().all()
        if not products:
            return f"🔍 No encontré productos con '{args}'"
        lines = []
        for p in products[:5]:
            stock_result = await db.execute(
                select(func.coalesce(func.sum(StockLot.cantidad_actual), 0))
                .where(StockLot.producto_id == p.id)
            )
            stock = stock_result.scalar() or 0
            lines.append(f"• {p.nombre}: {stock} unidades")
        return "📦 *Stock disponible*\n" + "\n".join(lines)

    if command == "/pedido":
        if not args:
            return "📄 Indica el ID o número de pedido: /pedido [id]"
        try:
            sale_result = await db.execute(
                select(Sale).where(
                    or_(Sale.id == UUID(args), Sale.numero == args, Sale.cdc == args)
                )
            )
        except ValueError:
            sale_result = await db.execute(
                select(Sale).where(Sale.numero == args)
            )
        sale = sale_result.scalar_one_or_none()
        if not sale:
            return f"❌ No encontré pedido '{args}'"
        items_result = await db.execute(
            text("""
                SELECT p.nombre, si.cantidad, si.precio_unitario
                FROM sale_items si
                JOIN products p ON p.id = si.producto_id
                WHERE si.venta_id = :sale_id
            """),
            {"sale_id": str(sale.id)},
        )
        items = items_result.fetchall()
        total_iva = float(sale.total_iva or 0)
        total_neto = float(sale.total or 0) - total_iva
        item_lines = [f"• {r[0]} x{r[1]}: {r[2]:,.0f} PYG" for r in items]
        return (
            f"📄 *Pedido #{sale.numero}*\n"
            f"Estado: {sale.estado}\n"
            + "\n".join(item_lines) + "\n"
            f"Total: {total_neto:,.0f} PYG\n"
            f"IVA: {total_iva:,.0f} PYG\n"
            f"*Total: {sale.total:,.0f} PYG*\n"
            f"Pagado: {sale.total_pagado or 0:,.0f} PYG\n"
            f"Saldo: {sale.saldo or 0:,.0f} PYG"
        )

    if command == "/estado":
        if not args:
            return "💳 Indica el ID o número: /estado [id]"
        try:
            sale_result = await db.execute(
                select(Sale).where(
                    or_(Sale.id == UUID(args), Sale.numero == args)
                )
            )
        except ValueError:
            sale_result = await db.execute(
                select(Sale).where(Sale.numero == args)
            )
        sale = sale_result.scalar_one_or_none()
        if not sale:
            return f"❌ No encontré pedido '{args}'"
        estado_emoji = {"pagado": "✅", "parcial": "⏳", "pendiente": "⏳", "cancelado": "❌"}.get(sale.estado, "❓")
        return (
            f"{estado_emoji} *Estado de pago*\n"
            f"Pedido: #{sale.numero}\n"
            f"Estado: {sale.estado.upper()}\n"
            f"Total: {sale.total:,.0f} PYG\n"
            f"Pagado: {sale.total_pagado or 0:,.0f} PYG\n"
            f"Saldo: {sale.saldo or 0:,.0f} PYG"
        )

    if command == "/ventas":
        today = datetime.now(timezone.utc).date()
        result = await db.execute(
            select(
                func.count(Sale.id).label("count"),
                func.coalesce(func.sum(Sale.total), 0).label("total"),
            ).where(func.cast(Sale.created_at, Date) == today)
        )
        row = result.one()
        return (
            f"📊 *Resumen del día*\n"
            f"Ventas: {row.count}\n"
            f"Total: {row.total or 0:,.0f} PYG"
        )

    if GREETING_RE.match(raw_body or ""):
        return f"¡Hola! 👋 Bienvenido a *{company_name}*. Escribe /ayuda para ver los comandos disponibles."

    return (
        f"🤖 No entendí tu mensaje. Escribe /ayuda para ver los comandos disponibles."
    )


async def handle_inbound_webhook(
    db: AsyncSession, config: WhatsAppConfig, payload: TwilioWebhook
) -> dict:
    from sqlalchemy import or_

    phone = re.sub(r"[^\d+]", "", payload.From)
    body = payload.Body.strip()

    conversation = await get_or_create_conversation(db, config.tenant_id, phone)

    msg = WhatsAppMessage(
        tenant_id=config.tenant_id,
        conversation_id=conversation.id,
        direction=MessageDirection.inbound,
        content=body,
        message_id=payload.MessageSid,
        media_url=payload.MediaUrl0 if payload.NumMedia > 0 else None,
        status=MessageStatus.delivered,
    )
    db.add(msg)
    conversation.last_message_at = datetime.now(timezone.utc)
    await db.flush()

    command, args = parse_command(body)
    if command:
        msg.command = command

    await db.commit()

    if config.auto_reply:
        # Use new chatbot engine with interactive menus
        from api.src.whatsapp.chatbot import ChatbotEngine, update_conversation_state
        
        # Get company_id from tenant (assuming first company)
        from api.src.companies.models import Company
        company_result = await db.execute(
            select(Company).where(Company.tenant_id == config.tenant_id).limit(1)
        )
        company = company_result.scalar_one_or_none()
        
        if company:
            chatbot = ChatbotEngine(db, company.id)
            response_data = await chatbot.process_message(conversation, body, msg.media_url)
            
            if response_data and response_data.get("text"):
                # Send response
                await reply_to_conversation(db, config.tenant_id, conversation.id, response_data["text"], command)
                
                # Update conversation state
                if response_data.get("next_state"):
                    await update_conversation_state(db, conversation.id, response_data["next_state"])
        else:
            # Fallback to old command system if no company found
            response = await execute_command(db, command or "", args, config.tenant_id, raw_body=body)
            if response:
                await reply_to_conversation(db, config.tenant_id, conversation.id, response, command)

    return {"status": "ok", "conversation_id": str(conversation.id), "message_id": str(msg.id)}


async def get_templates(db: AsyncSession, tenant_id: UUID) -> list:
    result = await db.execute(
        select(WhatsAppTemplate).where(WhatsAppTemplate.tenant_id == tenant_id)
    )
    return list(result.scalars().all())


async def create_template(db: AsyncSession, tenant_id: UUID, data: dict) -> WhatsAppTemplate:
    template = WhatsAppTemplate(tenant_id=tenant_id, **data)
    db.add(template)
    await db.commit()
    await db.refresh(template)
    return template


async def update_template(db: AsyncSession, tenant_id: UUID, template_id: UUID, data: dict) -> WhatsAppTemplate:
    result = await db.execute(
        select(WhatsAppTemplate)
        .where(WhatsAppTemplate.id == template_id)
        .where(WhatsAppTemplate.tenant_id == tenant_id)
    )
    template = result.scalar_one_or_none()
    if not template:
        raise ValueError("Template not found")
    for key, value in data.items():
        if value is not None:
            setattr(template, key, value)
    await db.commit()
    await db.refresh(template)
    return template


async def delete_template(db: AsyncSession, tenant_id: UUID, template_id: UUID):
    await db.execute(
        select(WhatsAppTemplate)
        .where(WhatsAppTemplate.id == template_id)
        .where(WhatsAppTemplate.tenant_id == tenant_id)
    )


async def seed_default_templates(db: AsyncSession, tenant_id: UUID):
    defaults = [
        {"name": "Bienvenido", "tipo": TemplateTipo.welcome,
         "content": "¡Hola! Bienvenido a [EMPRESA]. ¿En qué podemos ayudarte hoy?", "active": True},
        {"name": "Estado de pedido", "tipo": TemplateTipo.order_status,
         "content": "Tu pedido #[ID] está: [ESTADO]. Monto: [MONTO] PYG. Gracias por confiar en nosotros.", "active": True},
        {"name": "Alerta de stock", "tipo": TemplateTipo.stock_alert,
         "content": "⚠️ Alerta: [PRODUCTO] tiene stock bajo. Stock actual: [CANTIDAD] unidades.", "active": True},
    ]
    for t in defaults:
        existing = await db.execute(
            select(WhatsAppTemplate).where(
                WhatsAppTemplate.tenant_id == tenant_id,
                WhatsAppTemplate.name == t["name"],
            )
        )
        if not existing.scalar_one_or_none():
            db.add(WhatsAppTemplate(tenant_id=tenant_id, **t))
    await db.commit()


async def send_message_to_phone(
    db: AsyncSession, company_id: str, to_phone: str, message: str
) -> bool:
    """Send WhatsApp to a phone using the company's Twilio config. Non-blocking."""
    try:
        from api.src.companies.models import Company
        from sqlalchemy import select as sel_q

        company_result = await db.execute(sel_q(Company).where(Company.id == company_id))
        company = company_result.scalar_one_or_none()
        if not company or not company.tenant_id:
            return False

        config_result = await db.execute(
            sel_q(WhatsAppConfig).where(
                WhatsAppConfig.tenant_id == company.tenant_id,
                WhatsAppConfig.enabled == True,
            )
        )
        config = config_result.scalar_one_or_none()
        if not config:
            return False

        phone = to_phone
        if not phone.startswith("+"):
            phone = "+595" + phone.lstrip("0")

        await make_twilio_call(phone, message, config)
        return True
    except Exception:
        return False


async def get_stats(db: AsyncSession, tenant_id: UUID) -> dict:
    from datetime import timedelta
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    today_messages = await db.execute(
        select(func.count(WhatsAppMessage.id)).where(
            WhatsAppMessage.tenant_id == tenant_id,
            WhatsAppMessage.created_at >= today_start,
        )
    )
    messages_today = today_messages.scalar() or 0

    active_result = await db.execute(
        select(func.count(WhatsAppConversation.id)).where(
            WhatsAppConversation.tenant_id == tenant_id,
            WhatsAppConversation.last_message_at >= today_start,
        )
    )
    active_today = active_result.scalar() or 0

    total_result = await db.execute(
        select(func.count(WhatsAppConversation.id)).where(
            WhatsAppConversation.tenant_id == tenant_id
        )
    )
    total_conversations = total_result.scalar() or 0

    inbound_today = await db.execute(
        select(func.count(WhatsAppMessage.id)).where(
            WhatsAppMessage.tenant_id == tenant_id,
            WhatsAppMessage.direction == MessageDirection.inbound,
            WhatsAppMessage.created_at >= today_start,
        )
    )
    inbound_count = inbound_today.scalar() or 0

    outbound_today = await db.execute(
        select(func.count(WhatsAppMessage.id)).where(
            WhatsAppMessage.tenant_id == tenant_id,
            WhatsAppMessage.direction == MessageDirection.outbound,
            WhatsAppMessage.created_at >= today_start,
        )
    )
    outbound_count = outbound_today.scalar() or 0

    avg_response_time = None
    if inbound_count > 0 and outbound_count > 0:
        avg_response_time = 0.0

    return {
        "total_conversations": total_conversations,
        "active_today": active_today,
        "messages_today": messages_today,
        "avg_response_time_seconds": avg_response_time,
    }


# ============================================================
# NOTIFICATION TEMPLATES (tenant-customizable WhatsApp messages)
# ============================================================

DEFAULT_WA_TEMPLATES: dict[str, str] = {
    # Boutique / Pedidos
    "pedido.pendiente": "📄 *Pedido creado*\nTu pedido {NUMERO} ha sido registrado. Pronto lo procesaremos.",
    "pedido.en_preparacion": "👨‍🍳 *Pedido en preparación*\nTu pedido {NUMERO} está siendo preparado.",
    "pedido.listo": "✅ *Pedido listo*\nTu pedido {NUMERO} está listo para entrega.",
    "pedido.aprobado": "👍 *Pedido aprobado*\nTu pedido {NUMERO} ha sido aprobado.",
    "pedido.rechazado": "❌ *Pedido rechazado*\nTu pedido {NUMERO} no pudo ser procesado. Contactanos para más información.",
    "pedido.cancelado": "🚫 *Pedido cancelado*\nTu pedido {NUMERO} ha sido cancelado.",
    "pedido.facturado": "🧾 *Pedido facturado*\nTu pedido {NUMERO} ha sido facturado con éxito.",
    # InteliEntregas
    "entrega.assigned": "🛵 *Tu pedido está en camino!*\nUn repartidor ha sido asignado para entregar tu pedido.",
    "entrega.picked_up": "📦 *Pedido recogido!*\nEl repartidor ha recogido tu pedido y está en camino.",
    "entrega.in_transit": "🚚 *Tu pedido está en tránsito!*\nEl repartidor va en camino a tu dirección.",
    "entrega.delivered": "✅ *Pedido entregado!*\nTu pedido ha sido entregado con éxito.",
    "entrega.failed": "❌ *Entrega fallida*\nNo se pudo entregar tu pedido. Contactanos para más información.",
    # Ventas
    "venta.creada": "🧾 *Factura {NUMERO}*\nTotal: {TOTAL} PYG\nGracias por tu compra!",
    "venta.cancelada": "🚫 *Factura {NUMERO}* cancelada.\nSi tenés dudas contactanos.",
    "pago.recibido": "💵 *Pago recibido*\nMonto: {MONTO} PYG\nFactura: {NUMERO}",
}


def format_wa_template(template: str, **kwargs: str) -> str:
    """Replace {VAR} placeholders in a template with provided values."""
    result = template
    for key, value in kwargs.items():
        result = result.replace(f"{{{key}}}", value)
    return result


async def get_wa_template(db: AsyncSession, tenant_id: UUID, tipo: str) -> str | None:
    """Resolve a WhatsApp notification template for a tenant.

    Looks up tenant-specific WhatsAppTemplate first, falls back to DEFAULT_WA_TEMPLATES.
    Variables in the template use {VAR} syntax (not [VAR]).
    """
    from api.src.whatsapp.models import WhatsAppTemplate

    result = await db.execute(
        select(WhatsAppTemplate).where(
            WhatsAppTemplate.tenant_id == tenant_id,
            WhatsAppTemplate.tipo == tipo,
            WhatsAppTemplate.active == True,
        ).order_by(WhatsAppTemplate.created_at.desc()).limit(1)
    )
    template = result.scalar_one_or_none()
    if template:
        return template.content
    return DEFAULT_WA_TEMPLATES.get(tipo)


DEFAULT_WA_TEMPLATE_SEED: list[dict] = [
    {"name": "Pedido pendiente", "tipo": "pedido.pendiente", "content": DEFAULT_WA_TEMPLATES["pedido.pendiente"]},
    {"name": "Pedido en preparación", "tipo": "pedido.en_preparacion", "content": DEFAULT_WA_TEMPLATES["pedido.en_preparacion"]},
    {"name": "Pedido listo", "tipo": "pedido.listo", "content": DEFAULT_WA_TEMPLATES["pedido.listo"]},
    {"name": "Pedido aprobado", "tipo": "pedido.aprobado", "content": DEFAULT_WA_TEMPLATES["pedido.aprobado"]},
    {"name": "Pedido rechazado", "tipo": "pedido.rechazado", "content": DEFAULT_WA_TEMPLATES["pedido.rechazado"]},
    {"name": "Pedido cancelado", "tipo": "pedido.cancelado", "content": DEFAULT_WA_TEMPLATES["pedido.cancelado"]},
    {"name": "Pedido facturado", "tipo": "pedido.facturado", "content": DEFAULT_WA_TEMPLATES["pedido.facturado"]},
    {"name": "Entrega asignada", "tipo": "entrega.assigned", "content": DEFAULT_WA_TEMPLATES["entrega.assigned"]},
    {"name": "Entrega recogida", "tipo": "entrega.picked_up", "content": DEFAULT_WA_TEMPLATES["entrega.picked_up"]},
    {"name": "Entrega en tránsito", "tipo": "entrega.in_transit", "content": DEFAULT_WA_TEMPLATES["entrega.in_transit"]},
    {"name": "Entrega entregada", "tipo": "entrega.delivered", "content": DEFAULT_WA_TEMPLATES["entrega.delivered"]},
    {"name": "Entrega fallida", "tipo": "entrega.failed", "content": DEFAULT_WA_TEMPLATES["entrega.failed"]},
    {"name": "Venta creada", "tipo": "venta.creada", "content": DEFAULT_WA_TEMPLATES["venta.creada"]},
    {"name": "Venta cancelada", "tipo": "venta.cancelada", "content": DEFAULT_WA_TEMPLATES["venta.cancelada"]},
    {"name": "Pago recibido", "tipo": "pago.recibido", "content": DEFAULT_WA_TEMPLATES["pago.recibido"]},
]


async def seed_wa_templates(db: AsyncSession, tenant_id: UUID):
    """Seed default WhatsApp templates for a new tenant."""
    for tmpl in DEFAULT_WA_TEMPLATE_SEED:
        result = await db.execute(
            select(WhatsAppTemplate).where(
                WhatsAppTemplate.tenant_id == tenant_id,
                WhatsAppTemplate.tipo == tmpl["tipo"],
            )
        )
        existing = result.scalar_one_or_none()
        if not existing:
            template = WhatsAppTemplate(
                tenant_id=tenant_id,
                name=tmpl["name"],
                content=tmpl["content"],
                tipo=tmpl["tipo"],
                active=True,
            )
            db.add(template)
    await db.commit()
