"""IntelliZapp — Campaign engine, automation, segmentation & analytics."""

from datetime import datetime, timezone, timedelta
from decimal import Decimal
from uuid import UUID
import re

from sqlalchemy import select, func, and_, or_, update
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.whatsapp.models import (
    WhatsAppCampaign, WhatsAppCampaignRecipient, WhatsAppAutomationRule,
    WhatsAppTemplate, WhatsAppConfig, WhatsAppConversation, WhatsAppMessage,
    CampaignStatus, CampaignRecipientStatus, AutomationTriggerEvent,
    MessageDirection, MessageStatus,
)
from api.src.whatsapp.service import make_twilio_call, format_wa_template, get_wa_template


# ═══════════════════════════════════════════════════════════════
# CAMPAIGNS
# ═══════════════════════════════════════════════════════════════

async def list_campaigns(db: AsyncSession, tenant_id: UUID, status: str | None = None):
    q = select(WhatsAppCampaign).where(WhatsAppCampaign.tenant_id == tenant_id)
    if status:
        q = q.where(WhatsAppCampaign.status == status)
    q = q.order_by(WhatsAppCampaign.created_at.desc()).limit(100)
    r = await db.execute(q)
    return r.scalars().all()


async def get_campaign(db: AsyncSession, campaign_id: UUID):
    r = await db.execute(select(WhatsAppCampaign).where(WhatsAppCampaign.id == campaign_id))
    return r.scalar_one_or_none()


async def create_campaign(db: AsyncSession, tenant_id: UUID, data: dict) -> WhatsAppCampaign:
    obj = WhatsAppCampaign(tenant_id=tenant_id, **data)
    db.add(obj)
    await db.commit()
    await db.refresh(obj)
    return obj


async def update_campaign(db: AsyncSession, campaign_id: UUID, data: dict) -> WhatsAppCampaign:
    r = await db.execute(select(WhatsAppCampaign).where(WhatsAppCampaign.id == campaign_id))
    obj = r.scalar_one_or_none()
    if not obj:
        raise ValueError("Campaña no encontrada")
    for k, v in data.items():
        if v is not None:
            setattr(obj, k, v)
    obj.updated_at = func.now()
    await db.commit()
    await db.refresh(obj)
    return obj


async def delete_campaign(db: AsyncSession, campaign_id: UUID):
    r = await db.execute(select(WhatsAppCampaign).where(WhatsAppCampaign.id == campaign_id))
    obj = r.scalar_one_or_none()
    if not obj:
        raise ValueError("Campaña no encontrada")
    # Delete recipients first
    await db.execute(
        select(WhatsAppCampaignRecipient).where(WhatsAppCampaignRecipient.campaign_id == campaign_id)
    )
    await db.delete(obj)
    await db.commit()


async def launch_campaign(db: AsyncSession, campaign_id: UUID):
    """Resolve segment → create recipients → mark as sending."""
    r = await db.execute(select(WhatsAppCampaign).where(WhatsAppCampaign.id == campaign_id))
    campaign = r.scalar_one_or_none()
    if not campaign:
        raise ValueError("Campaña no encontrada")
    if campaign.status in (CampaignStatus.sending, CampaignStatus.completed):
        raise ValueError("La campaña ya está en ejecución o completada")

    recipients = await _resolve_segment(db, campaign.tenant_id, campaign.segment_filters or {})
    if not recipients:
        raise ValueError("El segmento no devolvió destinatarios")

    # Bulk create recipients
    for rec in recipients:
        db.add(WhatsAppCampaignRecipient(
            campaign_id=campaign.id,
            tenant_id=campaign.tenant_id,
            customer_id=rec.get("customer_id"),
            contact_phone=rec["phone"],
            contact_name=rec.get("name"),
            status=CampaignRecipientStatus.pending,
        ))

    campaign.total_recipients = len(recipients)
    campaign.status = CampaignStatus.scheduled
    if not campaign.scheduled_at:
        campaign.scheduled_at = datetime.now(timezone.utc)
    await db.commit()
    return {"recipients_created": len(recipients)}


async def _resolve_segment(db: AsyncSession, tenant_id: UUID, filters: dict) -> list[dict]:
    """Resolve segment filters into a list of {phone, name, customer_id} dicts.

    Supported filters:
      - zona: list[str] — customer zone/neighborhood
      - producto_comprado: list[str] — product IDs they've bought
      - frecuencia_min: int — minimum purchase frequency (in last 90d)
      - monto_min: int — minimum total purchased (in last 90d)
      - dias_inactivo: int — days since last purchase
      - con_credito: bool — has credit limit
    """
    from api.src.customers.models import Customer
    from api.src.sales.models import Sale

    cid = tenant_id  # We use tenant_id as company_id context
    q = select(Customer).where(Customer.company_id == cid)

    zona = filters.get("zona")
    if zona:
        q = q.where(Customer.zona.in_(zona))

    r = await db.execute(q)
    customers = r.scalars().all()

    # If no filters, default to customers with phones
    if not filters or not any(k for k in filters if k != "con_credito"):
        return [
            {"customer_id": c.id, "phone": c.telefono, "name": c.nombre}
            for c in customers if c.telefono
        ][:5000]

    results = []
    ninety_days_ago = datetime.now(timezone.utc).date() - timedelta(days=90)

    for c in customers:
        if not c.telefono:
            continue

        # Frequency filter
        freq_min = filters.get("frecuencia_min")
        if freq_min:
            r = await db.execute(
                select(func.count(Sale.id))
                .where(
                    Sale.customer_id == c.id,
                    Sale.fecha >= ninety_days_ago,
                    Sale.estado == "confirmado",
                )
            )
            freq = r.scalar() or 0
            if freq < freq_min:
                continue

        # Amount filter
        monto_min = filters.get("monto_min")
        if monto_min:
            r = await db.execute(
                select(func.coalesce(func.sum(Sale.total), 0))
                .where(
                    Sale.customer_id == c.id,
                    Sale.fecha >= ninety_days_ago,
                    Sale.estado == "confirmado",
                )
            )
            total = r.scalar() or Decimal("0")
            if total < monto_min:
                continue

        # Inactivity filter
        dias_inactivo = filters.get("dias_inactivo")
        if dias_inactivo:
            r = await db.execute(
                select(func.max(Sale.fecha))
                .where(Sale.customer_id == c.id, Sale.estado == "confirmado")
            )
            last_date = r.scalar()
            if last_date:
                days_since = (datetime.now(timezone.utc).date() - last_date).days
                if days_since < dias_inactivo:
                    continue
            else:
                continue  # Never bought

        results.append({
            "customer_id": c.id,
            "phone": c.telefono,
            "name": c.nombre,
        })

        if len(results) >= 5000:
            break

    return results


async def send_campaign_batch(db: AsyncSession, campaign_id: UUID, batch_size: int = 50):
    """Send pending recipients in batch via Twilio."""
    r = await db.execute(select(WhatsAppCampaign).where(WhatsAppCampaign.id == campaign_id))
    campaign = r.scalar_one_or_none()
    if not campaign:
        return {"sent": 0, "errors": 0}

    # Get config
    config_r = await db.execute(
        select(WhatsAppConfig).where(
            WhatsAppConfig.tenant_id == campaign.tenant_id,
            WhatsAppConfig.enabled == True,
        )
    )
    config = config_r.scalar_one_or_none()
    if not config:
        raise ValueError("WhatsApp no configurado para este tenant")

    # Resolve template
    template_content = campaign.message_template
    if not template_content and campaign.template_id:
        t_r = await db.execute(select(WhatsAppTemplate).where(WhatsAppTemplate.id == campaign.template_id))
        tmpl = t_r.scalar_one_or_none()
        if tmpl:
            template_content = tmpl.content

    if not template_content:
        return {"sent": 0, "errors": 0, "error": "No hay template definido"}

    # Get pending recipients
    r = await db.execute(
        select(WhatsAppCampaignRecipient)
        .where(
            WhatsAppCampaignRecipient.campaign_id == campaign_id,
            WhatsAppCampaignRecipient.status == CampaignRecipientStatus.pending,
        )
        .limit(batch_size)
    )
    pending = r.scalars().all()
    if not pending:
        # Mark campaign as completed
        campaign.status = CampaignStatus.completed
        campaign.completed_at = datetime.now(timezone.utc)
        await db.commit()
        return {"sent": 0, "errors": 0, "done": True}

    sent = 0
    errors = 0
    for rec in pending:
        try:
            # Replace variables in template
            content = template_content
            if rec.contact_name:
                content = content.replace("{cliente}", rec.contact_name)
            if rec.customer_id:
                content = content.replace("{cliente_id}", str(rec.customer_id))

            twilio_resp = await make_twilio_call(rec.contact_phone, content, config)
            rec.status = CampaignRecipientStatus.sent
            rec.sent_at = datetime.now(timezone.utc)
            rec.error_message = None
            sent += 1

            # Create a conversation entry if doesn't exist
            from api.src.whatsapp.service import get_or_create_conversation
            conv = await get_or_create_conversation(db, campaign.tenant_id, rec.contact_phone, rec.contact_name)
            msg = WhatsAppMessage(
                tenant_id=campaign.tenant_id,
                conversation_id=conv.id,
                direction=MessageDirection.outbound,
                content=content,
                message_id=twilio_resp.get("sid"),
                status=MessageStatus.sent,
                command="campaign",
            )
            db.add(msg)
        except Exception as e:
            rec.status = CampaignRecipientStatus.failed
            rec.error_message = str(e)[:500]
            errors += 1

        await db.flush()

    campaign.sent_count = (campaign.sent_count or 0) + sent
    await db.commit()

    return {"sent": sent, "errors": errors, "remaining": len(pending) - sent - errors}


# ═══════════════════════════════════════════════════════════════
# AUTOMATION RULES
# ═══════════════════════════════════════════════════════════════

async def list_automation_rules(db: AsyncSession, tenant_id: UUID, active_only: bool = False):
    q = select(WhatsAppAutomationRule).where(WhatsAppAutomationRule.tenant_id == tenant_id)
    if active_only:
        q = q.where(WhatsAppAutomationRule.active == True)
    q = q.order_by(WhatsAppAutomationRule.created_at.desc())
    r = await db.execute(q)
    return r.scalars().all()


async def get_automation_rule(db: AsyncSession, rule_id: UUID):
    r = await db.execute(select(WhatsAppAutomationRule).where(WhatsAppAutomationRule.id == rule_id))
    return r.scalar_one_or_none()


async def create_automation_rule(db: AsyncSession, tenant_id: UUID, data: dict) -> WhatsAppAutomationRule:
    obj = WhatsAppAutomationRule(tenant_id=tenant_id, **data)
    db.add(obj)
    await db.commit()
    await db.refresh(obj)
    return obj


async def update_automation_rule(db: AsyncSession, rule_id: UUID, data: dict) -> WhatsAppAutomationRule:
    r = await db.execute(select(WhatsAppAutomationRule).where(WhatsAppAutomationRule.id == rule_id))
    obj = r.scalar_one_or_none()
    if not obj:
        raise ValueError("Regla no encontrada")
    for k, v in data.items():
        if v is not None:
            setattr(obj, k, v)
    obj.updated_at = func.now()
    await db.commit()
    await db.refresh(obj)
    return obj


async def delete_automation_rule(db: AsyncSession, rule_id: UUID):
    r = await db.execute(select(WhatsAppAutomationRule).where(WhatsAppAutomationRule.id == rule_id))
    obj = r.scalar_one_or_none()
    if not obj:
        raise ValueError("Regla no encontrada")
    await db.delete(obj)
    await db.commit()


async def trigger_automation(db: AsyncSession, tenant_id: UUID, event: str, context: dict):
    """Execute all automation rules that match the event.

    context must include:
      - customer_id (UUID)
      - customer_phone (str)
      - customer_name (str, optional)
      - plus any event-specific variables for template substitution
    """
    from api.src.whatsapp.service import get_or_create_conversation, reply_to_conversation

    try:
        trigger = AutomationTriggerEvent(event)
    except ValueError:
        return {"triggered": 0, "error": f"Evento desconocido: {event}"}

    r = await db.execute(
        select(WhatsAppAutomationRule).where(
            WhatsAppAutomationRule.tenant_id == tenant_id,
            WhatsAppAutomationRule.trigger_event == trigger,
            WhatsAppAutomationRule.active == True,
        )
    )
    rules = r.scalars().all()
    if not rules:
        return {"triggered": 0}

    triggered = 0
    phone = context.get("customer_phone", "")
    customer_name = context.get("customer_name", "Cliente")

    for rule in rules:
        try:
            # Resolve template
            template_content = rule.message_template
            if not template_content and rule.template_id:
                t_r = await db.execute(select(WhatsAppTemplate).where(WhatsAppTemplate.id == rule.template_id))
                tmpl = t_r.scalar_one_or_none()
                if tmpl:
                    template_content = tmpl.content

            if not template_content:
                continue

            # Replace variables
            content = template_content
            for k, v in context.items():
                if isinstance(v, str) or isinstance(v, (int, float, Decimal)):
                    content = content.replace(f"{{{k}}}", str(v))
            content = content.replace("{cliente}", customer_name)

            # Get config and send
            config_r = await db.execute(
                select(WhatsAppConfig).where(
                    WhatsAppConfig.tenant_id == tenant_id,
                    WhatsAppConfig.enabled == True,
                )
            )
            config = config_r.scalar_one_or_none()
            if not config:
                continue

            if rule.delay_minutes > 0:
                # For delayed sends, store in a queue table or handle via scheduler
                # For now, we send immediately
                pass

            twilio_resp = await make_twilio_call(phone, content, config)
            conv = await get_or_create_conversation(db, tenant_id, phone, customer_name)

            msg = WhatsAppMessage(
                tenant_id=tenant_id,
                conversation_id=conv.id,
                direction=MessageDirection.outbound,
                content=content,
                message_id=twilio_resp.get("sid"),
                status=MessageStatus.sent,
                command=f"auto:{event}",
            )
            db.add(msg)
            triggered += 1
        except Exception:
            pass

    await db.commit()
    return {"triggered": triggered, "total_rules": len(rules)}


# ═══════════════════════════════════════════════════════════════
# ANALYTICS
# ═══════════════════════════════════════════════════════════════

async def get_campaign_analytics(db: AsyncSession, tenant_id: UUID) -> dict:
    total_r = await db.execute(
        select(func.count(WhatsAppCampaign.id))
        .where(WhatsAppCampaign.tenant_id == tenant_id)
    )
    total_campaigns = total_r.scalar() or 0

    active_r = await db.execute(
        select(func.count(WhatsAppCampaign.id))
        .where(
            WhatsAppCampaign.tenant_id == tenant_id,
            WhatsAppCampaign.status.in_(["scheduled", "sending"]),
        )
    )
    active_campaigns = active_r.scalar() or 0

    total_sent_r = await db.execute(
        select(func.coalesce(func.sum(WhatsAppCampaign.sent_count), 0))
        .where(WhatsAppCampaign.tenant_id == tenant_id)
    )
    total_messages_sent = total_sent_r.scalar() or 0

    total_delivered_r = await db.execute(
        select(func.coalesce(func.sum(WhatsAppCampaign.delivered_count), 0))
        .where(WhatsAppCampaign.tenant_id == tenant_id)
    )
    total_delivered = total_delivered_r.scalar() or 0

    total_replied_r = await db.execute(
        select(func.coalesce(func.sum(WhatsAppCampaign.replied_count), 0))
        .where(WhatsAppCampaign.tenant_id == tenant_id)
    )
    total_replied = total_replied_r.scalar() or 0

    # Automation rules
    rules_r = await db.execute(
        select(func.count(WhatsAppAutomationRule.id))
        .where(WhatsAppAutomationRule.tenant_id == tenant_id, WhatsAppAutomationRule.active == True)
    )
    active_rules = rules_r.scalar() or 0

    delivery_rate = (total_delivered / total_messages_sent * 100) if total_messages_sent > 0 else 0
    reply_rate = (total_replied / total_delivered * 100) if total_delivered > 0 else 0

    return {
        "total_campaigns": total_campaigns,
        "active_campaigns": active_campaigns,
        "total_messages_sent": total_messages_sent,
        "total_delivered": total_delivered,
        "total_replied": total_replied,
        "delivery_rate_pct": round(delivery_rate, 1),
        "reply_rate_pct": round(reply_rate, 1),
        "active_automation_rules": active_rules,
    }


async def get_campaign_recipients(db: AsyncSession, campaign_id: UUID, status: str | None = None, limit: int = 500):
    q = select(WhatsAppCampaignRecipient).where(WhatsAppCampaignRecipient.campaign_id == campaign_id)
    if status:
        q = q.where(WhatsAppCampaignRecipient.status == status)
    q = q.order_by(WhatsAppCampaignRecipient.created_at.desc()).limit(limit)
    r = await db.execute(q)
    return r.scalars().all()


# ═══════════════════════════════════════════════════════════════
# CHATBOT TEST / SIMULATOR
# ═══════════════════════════════════════════════════════════════

async def chatbot_test(
    db: AsyncSession,
    tenant_id: UUID,
    message: str,
    conversation_id: UUID | None = None,
    reset: bool = False,
) -> dict:
    """Process a test message through the real chatbot engine.
    Creates/retrieves a test conversation and returns the chatbot response.
    """
    from api.src.whatsapp.chatbot import ChatbotEngine, ChatbotFlow

    if conversation_id and not reset:
        r = await db.execute(
            select(WhatsAppConversation).where(
                WhatsAppConversation.id == conversation_id,
                WhatsAppConversation.tenant_id == tenant_id,
            )
        )
        conversation = r.scalar_one_or_none()
        if not conversation:
            conversation_id = None

    if not conversation_id:
        conversation = WhatsAppConversation(
            tenant_id=tenant_id,
            contact_name="Test Simulador",
            contact_phone="+595990000000",
            session_state="idle",
        )
        db.add(conversation)
        await db.commit()
        await db.refresh(conversation)

    engine = ChatbotEngine(db, tenant_id)
    response = await engine.process_message(conversation, message)

    conversation.session_state = response.get("next_state", "idle")
    await db.commit()

    return {
        "response_text": response.get("text", ""),
        "buttons": response.get("buttons", []),
        "next_state": response.get("next_state", "idle"),
        "state_description": ChatbotFlow.get_state_description(response.get("next_state", "idle")),
        "conversation_id": str(conversation.id),
    }
