import hmac
import hashlib
import base64
import re
from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

import httpx
from sqlalchemy import select, update, func, text, or_
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.whatsapp.models import (
    WhatsAppConfig, WhatsAppConversation, WhatsAppMessage, WhatsAppTemplate,
    ConversationStatus, MessageDirection, MessageStatus, TemplateTipo,
)
from api.src.whatsapp.schemas import TwilioWebhook


from api.src.whatsapp.evolution_client import evolution_client, normalize_phone_e164


def mask_token(token: str) -> str:
    return "****"


async def make_twilio_call(to_phone: str, content: str, config: Optional[WhatsAppConfig] = None, media_url: Optional[str] = None) -> dict:
    """Wrapper retrocompatible: envía mensaje vía Evolution API."""
    if media_url:
        resp = await evolution_client.send_media_message(to_phone, media_url, caption=content)
    else:
        resp = await evolution_client.send_text_message(to_phone, content)
    
    return {
        "sid": resp.get("message_id", "evolution-ok"),
        "status": resp.get("status", "sent"),
        "success": resp.get("success", False),
    }


async def get_config(db: AsyncSession, tenant_id: UUID) -> WhatsAppConfig:
    """Obtiene o inicializa la configuración de WhatsApp para el tenant."""
    result = await db.execute(
        select(WhatsAppConfig).where(WhatsAppConfig.tenant_id == tenant_id).limit(1)
    )
    config = result.scalar_one_or_none()
    if not config:
        config = WhatsAppConfig(
            tenant_id=tenant_id,
            account_sid="evolution-api",
            auth_token="evolution-token",
            phone_number="+595981000000",
            webhook_url="/api/v1/whatsapp/webhook/evolution",
            enabled=True,
            auto_reply=True,
        )
        db.add(config)
        await db.commit()
        await db.refresh(config)
    return config


async def save_config(db: AsyncSession, tenant_id: UUID, data: dict) -> WhatsAppConfig:
    """Guarda cambios en la configuración de WhatsApp del tenant."""
    config = await get_config(db, tenant_id)
    for key, value in data.items():
        if hasattr(config, key) and value is not None:
            setattr(config, key, value)
    await db.commit()
    await db.refresh(config)
    return config


async def get_or_create_conversation(
    db: AsyncSession, tenant_id: UUID, phone: str, name: Optional[str] = None
) -> WhatsAppConversation:
    norm_digits = normalize_phone_e164(phone) or re.sub(r"\D", "", phone)
    plus_phone = f"+{norm_digits}" if not norm_digits.startswith("+") else norm_digits
    raw_digits = re.sub(r"\D", "", phone)

    result = await db.execute(
        select(WhatsAppConversation)
        .where(WhatsAppConversation.tenant_id == tenant_id)
        .where(
            or_(
                WhatsAppConversation.contact_phone == plus_phone,
                WhatsAppConversation.contact_phone == norm_digits,
                WhatsAppConversation.contact_phone == raw_digits,
                WhatsAppConversation.contact_phone == phone,
            )
        )
    )
    conv = result.scalars().first()
    if conv:
        if name and (not conv.contact_name or conv.contact_name == conv.contact_phone):
            conv.contact_name = name
        conv.last_message_at = datetime.now(timezone.utc)
        await db.commit()
        return conv

    conv = WhatsAppConversation(
        tenant_id=tenant_id,
        contact_phone=plus_phone,
        contact_name=name or plus_phone,
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
    msgs = list(result.scalars().all())
    msgs.reverse()
    return msgs


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
    if not conversation:
        raise ValueError("Conversación no encontrada")

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

    evo_resp = await make_twilio_call(conversation.contact_phone, content, config, media_url)
    msg.message_id = evo_resp.get("sid")
    msg.status = MessageStatus.sent if evo_resp.get("success") else MessageStatus.failed

    conversation.last_message_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(msg)
    return msg


async def reply_to_conversation(
    db: AsyncSession, tenant_id: UUID, conversation_id: UUID, response: str, command: Optional[str] = None
) -> WhatsAppMessage:
    config = await get_config(db, tenant_id)
    conversation = await db.get(WhatsAppConversation, conversation_id)
    if not conversation:
        raise ValueError("Conversación no encontrada")

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

    evo_resp = await make_twilio_call(conversation.contact_phone, response, config)
    msg.message_id = evo_resp.get("sid")
    msg.status = MessageStatus.sent if evo_resp.get("success") else MessageStatus.failed

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
    from sqlalchemy import or_
    result = await db.execute(
        select(WhatsAppTemplate).where(
            or_(
                WhatsAppTemplate.tenant_id == tenant_id,
                WhatsAppTemplate.tenant_id == UUID("00000000-0000-0000-0000-000000000001"),
            )
        ).order_by(WhatsAppTemplate.name.asc())
    )
    templates = list(result.scalars().all())
    if not templates or len(templates) < 5:
        await seed_default_templates(db, tenant_id)
        result2 = await db.execute(
            select(WhatsAppTemplate).where(
                or_(
                    WhatsAppTemplate.tenant_id == tenant_id,
                    WhatsAppTemplate.tenant_id == UUID("00000000-0000-0000-0000-000000000001"),
                )
            ).order_by(WhatsAppTemplate.name.asc())
        )
        templates = list(result2.scalars().all())
    return templates


async def create_template(db: AsyncSession, tenant_id: UUID, data: dict) -> WhatsAppTemplate:
    template = WhatsAppTemplate(tenant_id=tenant_id, **data)
    db.add(template)
    await db.commit()
    await db.refresh(template)
    return template


async def update_template(db: AsyncSession, tenant_id: UUID, template_id: UUID, data: dict) -> WhatsAppTemplate:
    result = await db.execute(
        select(WhatsAppTemplate).where(WhatsAppTemplate.id == template_id)
    )
    template = result.scalar_one_or_none()
    if not template:
        raise ValueError("Plantilla no encontrada")
    for key, value in data.items():
        if value is not None:
            setattr(template, key, value)
    await db.commit()
    await db.refresh(template)
    return template


async def delete_template(db: AsyncSession, tenant_id: UUID, template_id: UUID):
    from sqlalchemy import delete
    await db.execute(
        delete(WhatsAppTemplate).where(WhatsAppTemplate.id == template_id)
    )
    await db.commit()


OFFICIAL_SUPERMARKET_TEMPLATES = [
    {
        "name": "Ticket Digital POS + Puntos",
        "tipo": "venta.creada",
        "content": "🛒 *¡Gracias por tu compra en Extra Supermercado Mayorista!*\n\n📄 Ticket Digital: *#{ticket}*\n💰 Total: *Gs. {monto}*\n⭐ Puntos Sumados: *{puntos} Pts.*\n💳 ExtraClub Socio: *{socio_numero}*\n\n¡Te esperamos pronto en nuestras sucursales!",
        "active": True
    },
    {
        "name": "Agradecimiento + Cupones Sorteo + Opt-In",
        "tipo": "sorteo.optin",
        "content": "🛒 *¡Muchas gracias por tu compra en Extra Supermercado!*\nEsperamos que hayas tenido una excelente experiencia y te esperamos nuevamente muy pronto.\n\n🎟️ *¡Con esta compra generaste {cupones_generados} cupones para el sorteo '{campana_sorteo}'!*\nAcumulás un total de *{cupones_totales} cupones* registrados a tu nombre (Doc: {documento}).\n\n📲 *¿Querés recibir ofertas personalizadas, descuentos relámpago y promociones exclusivas en tu WhatsApp?*\n👉 *Respondé SÍ a este mensaje* para activar tus beneficios exclusivos y enterarte primero que nadie.",
        "active": True
    },
    {
        "name": "Cupón Oficial de Sorteo",
        "tipo": "cupon.sorteo",
        "content": "🎟️ *¡Tu Cupón Oficial de Sorteo — Extra Supermercado!*\n\n🎉 Registramos exitosamente tus *{cantidad}* para el *{sorteo}* con tu Ticket *#{ticket}* en *{empresa}*.\n👤 Titular: *{cliente}*\n\n🛒 ¡Muchas gracias por tu compra y mucha suerte! 🍀✨",
        "active": True
    },
    {
        "name": "Comprobante de Cobro / Pago Recibido",
        "tipo": "pago.recibido",
        "content": "💵 *Pago Recibido — Extra Supermercado*\n\nHola *{cliente}*, confirmamos la recepción de tu pago:\n💰 Monto abonado: *Gs. {monto}*\n📄 Factura / Recibo: *#{numero}*\n📅 Fecha: *{fecha}*\n\n¡Muchas gracias por tu confianza!",
        "active": True
    },
    {
        "name": "Confirmación Opt-In Validado",
        "tipo": "optin.confirmado",
        "content": "🎉 *¡Excelente! Tu número ha sido validado para recibir promociones exclusivas.*\n\nA partir de ahora vas a recibir ofertas personalizadas, descuentos relámpago y beneficios de Extra Supermercado directo en tu WhatsApp.\n\nℹ️ _Podés responder 'BAJA' en cualquier momento si deseás pausar estas comunicaciones._",
        "active": True
    },
    {
        "name": "Invitación ExtraClub (No Socio)",
        "tipo": "extraclub.invitacion",
        "content": "👋 ¡Hola {cliente}! Notamos que aún no contás con tu tarjeta *ExtraClub*, el programa oficial de fidelidad de Extra Supermercado. ✨\n\n🎁 *Beneficios exclusivos:*\n• Acumulás puntos en cada compra que canjeás directamente por dinero en caja al pagar.\n• Participás con cupones adicionales en todos los sorteos del año.\n• Accedés a precios preferenciales en artículos seleccionados.\n\n¡La adhesión es 100% gratuita! Pedile a tu cajero en tu próxima visita o respondenos a este mensaje.",
        "active": True
    },
    {
        "name": "Consulta Saldo de Puntos ExtraClub",
        "tipo": "extraclub.saldo",
        "content": "⭐ *Tu Saldo ExtraClub — Extra Supermercado* ⭐\n\n👤 Titular: *{cliente}*\n💳 N° de Socio: *{socio_numero}*\n✨ Puntos Disponibles: *{puntos} Pts.*\n💰 Equivalente en Compras: *Gs. {valor_monetario}*\n\n🛒 _Podés canjear tus puntos directamente en línea de caja en tu próxima compra._ ¡Gracias por ser parte de la familia Extra!",
        "active": True
    },
    {
        "name": "Catálogo de Premios de la Temporada",
        "tipo": "extraclub.premios",
        "content": "🎁 *Catálogo de Premios de la Temporada — ExtraClub* 🏆\n\n¡Canjeá tus puntos por premios fabulosos o descuento directo en tus compras!\n\n☕ *1.500 Pts:* Pava Eléctrica Inox 1.8L\n🍳 *2.500 Pts:* Set de Sartenes Antiadherentes\n🥪 *3.500 Pts:* Sandwichera Grill Antiadherente\n💨 *7.000 Pts:* Freidora de Aire Digital 4.5L\n🍲 *12.000 Pts:* Horno Eléctrico de Mesa 45L\n📺 *25.000 Pts:* Smart TV 43\" Full HD\n\n💡 _También podés descontar tus puntos directamente de tu factura al abonar en caja._ Consultá con Atención al Cliente.",
        "active": True
    },
    {
        "name": "Recordatorio de Cuota de Crédito",
        "tipo": "cuota.recordatorio",
        "content": "🔔 *Recordatorio de Vencimiento — Extra Supermercado*\n\nEstimado/a *{cliente}*, te recordamos que tu cuota de crédito de *Gs. {monto}* tiene fecha de vencimiento el *{fecha}*.\nPodés abonar en caja de cualquier sucursal o solicitar datos de transferencia respondiendo a este mensaje.",
        "active": True
    },
    {
        "name": "Promoción Relámpago del Día",
        "tipo": "promocion.flash",
        "content": "🔥 *¡OFERTA RELÁMPAGO EXTRA SUPERMERCADO!* 🔥\n\n¡Solo por hoy o hasta agotar stock!\n🛒 *{oferta_titulo}*\n🏷️ Precio Oferta: *Gs. {precio_oferta}* (Antes: Gs. {precio_regular})\n💥 Descuento exclusivo para socios y clientes validados.\n\n¡Te esperamos en nuestro salón! Promoción válida con cualquier medio de pago.",
        "active": True
    },
    {
        "name": "Delivery en Camino / Tránsito",
        "tipo": "entrega.in_transit",
        "content": "🛵 *¡Tu pedido de Extra Supermercado está en camino!*\n\n📦 Pedido: *#{numero}*\n📍 Destino: *{direccion}*\n👤 Repartidor: *{repartidor}*\n\n¡En breves momentos llegará a tu puerta!",
        "active": True
    },
    {
        "name": "Delivery Entregado",
        "tipo": "entrega.delivered",
        "content": "✅ *¡Pedido Entregado con Éxito!*\n\nHola *{cliente}*, tu pedido *#{numero}* ha sido entregado.\n¡Esperamos que disfrutes tus productos y gracias por preferir Extra Supermercado! 🛒",
        "active": True
    },
    {
        "name": "Pedido Recibido / Pendiente",
        "tipo": "pedido.pendiente",
        "content": "📄 *Pedido Registrado con Éxito — Extra Supermercado*\n\nHola *{cliente}*, recibimos tu pedido *#{numero}* por un total de *Gs. {total}*.\nPronto iniciaremos la preparación en tienda.",
        "active": True
    },
    {
        "name": "Pedido Listo para Retiro",
        "tipo": "pedido.listo",
        "content": "📦 *¡Tu Pedido está Listo! — Extra Supermercado*\n\nHola *{cliente}*, tu pedido *#{numero}* ya está empaquetado y listo para ser retirado en nuestro mostrador de Atención al Cliente.",
        "active": True
    },
]


async def seed_default_templates(db: AsyncSession, tenant_id: UUID, force: bool = False):
    from sqlalchemy import or_
    for t in OFFICIAL_SUPERMARKET_TEMPLATES:
        existing = await db.execute(
            select(WhatsAppTemplate).where(
                or_(
                    WhatsAppTemplate.tenant_id == tenant_id,
                    WhatsAppTemplate.tenant_id == UUID("00000000-0000-0000-0000-000000000001"),
                ),
                or_(
                    WhatsAppTemplate.name == t["name"],
                    WhatsAppTemplate.tipo == t["tipo"],
                )
            )
        )
        template_row = existing.scalar_one_or_none()
        if not template_row:
            db.add(WhatsAppTemplate(tenant_id=tenant_id, **t))
        elif force:
            template_row.name = t["name"]
            template_row.content = t["content"]
            template_row.tipo = t["tipo"]
            template_row.active = t["active"]
    await db.commit()


async def send_message_to_phone(
    db: AsyncSession, company_id: str, to_phone: str, message: str
) -> bool:
    """Send WhatsApp to a phone using Evolution API gateway. Non-blocking."""
    try:
        if not to_phone or not message:
            return False
        res = await evolution_client.send_text_message(to_phone, message, delay_ms=1000)
        success = bool(res.get("success", False))
        if success and company_id:
            try:
                from uuid import UUID
                c_uuid = company_id if isinstance(company_id, UUID) else UUID(str(company_id))
                conv = await get_or_create_conversation(db, c_uuid, to_phone, name=to_phone)
                msg_id = (
                    res.get("data", {}).get("key", {}).get("id")
                    or res.get("message_id")
                    or f"auto-{datetime.now(timezone.utc).timestamp()}"
                )
                outbound_msg = WhatsAppMessage(
                    tenant_id=c_uuid,
                    conversation_id=conv.id,
                    direction=MessageDirection.outbound,
                    content=message,
                    message_id=msg_id,
                    status=MessageStatus.sent,
                )
                db.add(outbound_msg)
                conv.last_message_at = datetime.now(timezone.utc)
                await db.commit()
            except Exception as reg_err:
                import logging
                logging.getLogger("whatsapp.service").warning(f"No se pudo registrar mensaje saliente en BD: {reg_err}")
        return success
    except Exception as e:
        import logging
        logging.getLogger("whatsapp.service").error(f"Error in send_message_to_phone: {e}")
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
    # Ventas & Extra Supermercado
    "venta.creada": "🛒 *¡Gracias por tu compra en Extra Supermercado Mayorista!*\n\n📄 Ticket Digital: *#{ticket}*\n💰 Total: *Gs. {monto}*\n⭐ Sumaste *{puntos} Puntos ExtraClub*.\n\n¡Te esperamos pronto en nuestras sucursales!",
    "sorteo.optin": "🛒 *¡Muchas gracias por tu compra en Extra Supermercado!*\nEsperamos que hayas tenido una excelente experiencia y te esperamos nuevamente muy pronto.\n\n🎟️ *¡Con esta compra generaste {cupones_generados} cupones para el sorteo '{campana_sorteo}'!*\nAcumulás un total de *{cupones_totales} cupones* registrados a tu nombre (Doc: {documento}).\n\n📲 *¿Querés recibir ofertas personalizadas, descuentos relámpago y promociones exclusivas en tu WhatsApp?*\n👉 *Respondé SÍ a este mensaje* para activar tus beneficios exclusivos y enterarte primero que nadie.",
    "optin.confirmado": "🎉 *¡Excelente! Tu número ha sido validado para recibir promociones exclusivas.*\n\nA partir de ahora vas a recibir ofertas personalizadas, descuentos relámpago y beneficios de Extra Supermercado directo en tu WhatsApp.\n\nℹ️ _Podés responder 'BAJA' en cualquier momento si deseás pausar estas comunicaciones._",
    "extraclub.invitacion": "👋 ¡Hola {cliente}! Notamos que aún no formás parte de *ExtraClub*, el club de fidelidad de Extra Supermercado. ✨\n\n🎁 *Al ser socio ExtraClub:*\n• Acumulás puntos en cada compra que canjeás por dinero directo en caja (1 Punto = Gs. 100).\n• Participás automáticamente con cupones dobles en todos los sorteos del año.\n• Accedés a descuentos especiales exclusivos para miembros.\n\n¡Hacerte socio es 100% gratuito! Acercate al mostrador de Atención al Cliente en tu próxima visita o pedile al cajero al abonar.",
    "extraclub.saldo": "⭐ *Tu Saldo ExtraClub — Extra Supermercado* ⭐\n\n👤 Titular: *{cliente}*\n💳 N° de Socio: *{socio_numero}*\n✨ Puntos Acumulados: *{puntos} Pts.*\n💰 Equivalente en Compras: *Gs. {valor_monetario}*\n\n🛒 _Podés canjear tus puntos directamente en línea de caja en tu próxima compra._ ¡Gracias por ser parte de la familia Extra!",
    "extraclub.premios": "🎁 *Catálogo de Premios de la Temporada — ExtraClub* 🏆\n\n¡Canjeá tus puntos por premios fabulosos o descuento directo en tus compras!\n\n☕ *1.500 Pts:* Pava Eléctrica Inox 1.8L\n🍳 *2.500 Pts:* Set de Sartenes Antiadherentes (2 piezas)\n🥪 *3.500 Pts:* Sandwichera Grill Antiadherente\n💨 *7.000 Pts:* Freidora de Aire Digital 4.5L\n🍲 *12.000 Pts:* Horno Eléctrico de Mesa 45L\n📺 *25.000 Pts:* Smart TV 43\" Full HD\n\n💡 *Descuento en Caja:* Recordá que también podés descontar tus puntos directamente de tu factura: *1 Punto = Gs. 100*.\nConsultá en Atención al Cliente o escribinos aquí para iniciar tu canje.",
    "cupon.sorteo": "🎟️ *¡Tu Cupón Oficial de Sorteo Extra Supermercado!*\n\nCupón N°: *{cupon_numero}*\nCliente: *{cliente}* (Doc: {documento})\nPromoción: *{campana_sorteo}*\nFecha del Sorteo: *{fecha_sorteo}*\n\nGuardá este mensaje como comprobante oficial. ¡Mucha suerte!",
    "cuota.recordatorio": "🔔 *Recordatorio de Vencimiento — Extra Supermercado*\n\nEstimado/a *{cliente}*, te recordamos que tu cuota de crédito de *Gs. {monto}* tiene fecha de vencimiento el *{fecha}*.\nPodés abonar en caja de cualquier sucursal o solicitar datos de transferencia respondiendo a este mensaje.",
    "promocion.flash": "🔥 *¡OFERTA RELÁMPAGO EXTRA SUPERMERCADO!* 🔥\n\n¡Solo por hoy o hasta agotar stock!\n🛒 *{oferta_titulo}*\n🏷️ Precio Oferta: *Gs. {precio_oferta}* (Antes: Gs. {precio_regular})\n💥 Descuento exclusivo para socios y clientes validados.\n\n¡Te esperamos en nuestro salón! Promoción válida con cualquier medio de pago.",
    "venta.cancelada": "🚫 *Factura {NUMERO}* cancelada.\nSi tenés dudas contactanos.",
    "pago.recibido": "💵 *Pago recibido*\nMonto: {MONTO} PYG\nFactura: {NUMERO}",
}


def format_wa_template(template: str, **kwargs: object) -> str:
    """Replace {VAR} or {{VAR}} placeholders in a template with provided values.

    Supports:
    - Case-insensitive matching: {TICKET}, {ticket}, {Ticket}
    - Double curly braces: {{ticket}}, {{monto}}
    - Whitespace inside braces: { ticket }
    - Automatic synonyms: ticket <-> numero, monto <-> total, puntos <-> puntos_ganados, etc.
    """
    if not template:
        return ""
    result = template
    expanded: dict[str, str] = {}
    for k, v in kwargs.items():
        val_str = str(v) if v is not None else ""
        expanded[k] = val_str
        kl = k.lower()
        if kl in ("ticket", "numero"):
            expanded["ticket"] = val_str
            expanded["numero"] = val_str
        elif kl in ("monto", "total"):
            expanded["monto"] = val_str
            expanded["total"] = val_str
        elif kl in ("puntos", "puntos_ganados"):
            expanded["puntos"] = val_str
            expanded["puntos_ganados"] = val_str
        elif kl in ("cliente", "nombre"):
            expanded["cliente"] = val_str
            expanded["nombre"] = val_str
        elif kl in ("doc", "documento", "ruc", "ci"):
            expanded["documento"] = val_str

    for key, value in expanded.items():
        pattern = re.compile(r"\{{1,2}\s*" + re.escape(key) + r"\s*\}{1,2}", re.IGNORECASE)
        result = pattern.sub(str(value), result)
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
