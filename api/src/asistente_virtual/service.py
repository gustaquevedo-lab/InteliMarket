from sqlalchemy import select, func as sa_func, and_, desc, delete
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime, timezone, timedelta
from typing import Optional
import uuid, re, random
from collections import defaultdict

from api.src.asistente_virtual.models import Conversation, Message, Ticket, IntentTemplate
from api.src.customers.models import Partner
from api.src.sales.models import Sale
from api.src.products.models import Product


_INTENT_PATTERNS = [
    ("saludo", ["hola", "buen", "buenas", "buenos", "días", "tardes", "noche", "hello", "hi", "hey", "buen día"], 0),
    ("catalogo", ["catálogo", "producto", "precio", "cuánto", "cuesta", "listar", "tenés", "venden", "disponible", "stock"], 1),
    ("pedido_status", ["pedido", "compra", "factura", "cuándo llega", "estado", "seguimiento", "entrega", "camino"], 2),
    ("credito", ["crédito", "saldo", "límite", "debo", "cuenta", "balance", "disponible", "límite"], 3),
    ("comprar", ["quiero comprar", "necesito", "pedir", "ordenar", "comprar", "llevar", "mandar", "hacer pedido", "quiero hacer"], 4),
    ("reclamo", ["reclamo", "problema", "queja", "error", "mal", "roto", "dañado", "inconformidad", "ticket"], 5),
    ("humano", ["humano", "persona", "agente", "operador", "hablar con", "atención", "transferir", "representante"], 6),
    ("despedida", ["gracias", "chau", "adiós", "bye", "hasta luego", "nos vemos", "muchas gracias"], 7),
]

_INTENT_RESPONSES = {
    "saludo": "¡Hola! Soy el asistente virtual de InteliMarket. 😊 Puedo ayudarte a:\n\n📋 Consultar catálogo y precios\n📦 Ver estado de tus pedidos\n💰 Consultar tu saldo de crédito\n🛒 Realizar pedidos\n📝 Abrir un reclamo\n\n¿En qué puedo ayudarte hoy?",
    "catalogo": "🔍 *Consulta de Catálogo*\n\nPara buscar productos, decime el nombre o código del producto que te interesa. Por ejemplo:\n- «Mostrame el precio de la Coca-Cola 2L»\n- «¿Tenés arroz 1kg?»\n- «Listame tus productos lácteos»",
    "pedido_status": "📦 *Estado de Pedido*\n\nPodés consultar el estado de tu pedido enviándome el número de factura o código de pedido. Por ejemplo:\n- «Estado del pedido #12345»\n- «¿Cómo va mi factura FAC-2024-123?»",
    "credito": "💰 *Consulta de Crédito*\n\nPara conocer tu saldo de crédito disponible, límite asignado y estado de cuenta, puedo consultarlo al instante. Decime «Mi saldo» o «Límite de crédito».",
    "comprar": "🛒 *Realizar Pedido*\n\nPara hacer un pedido decime qué productos querés y en qué cantidad. Por ejemplo:\n- «Quiero 10 cajas de Leche LA Serenísima 1L»\n- «Necesito 5 unidades de Harina Pan 1kg»\n\nVoy a preparar el pedido y te lo confirmo antes de enviarlo.",
    "reclamo": "📝 *Abrir Reclamo*\n\nDescribime brevemente el problema que tuviste y lo voy a registrar como ticket de reclamo. Incluí:\n- N° de factura o pedido (si tenés)\n- Producto\n- Descripción del problema\n\nUn operador se comunicará contigo a la brevedad.",
    "humano": "👤 *Derivación a Humano*\n\nEstoy transfiriendo tu consulta a un operador humano que te atenderá a la brevedad. Por favor esperá unos momentos.",
    "despedida": "¡Gracias por contactarte! 😊 Que tengas un excelente día. Si necesitás algo más, estoy aquí para ayudarte.",
    "unknown": "No entendí bien tu consulta. 🤔\n\nPodés elegir una de estas opciones:\n1️⃣ Consultar catálogo y precios\n2️⃣ Estado de pedido\n3️⃣ Saldo de crédito\n4️⃣ Hacer un pedido\n5️⃣ Abrir un reclamo\n6️⃣ Hablar con un operador",
}

_QUERY_HANDLERS = {
    "catalogo": "_handle_catalog_query",
    "pedido_status": "_handle_order_query",
    "credito": "_handle_credit_query",
    "comprar": "_handle_order_creation",
    "reclamo": "_handle_ticket_creation",
}


def _classify_intent(message: str) -> tuple:
    msg_lower = message.lower()
    scores = []
    for intent, keywords, priority in _INTENT_PATTERNS:
        score = sum(1 for kw in keywords if kw in msg_lower)
        if score > 0:
            scores.append((intent, score, priority))
    if not scores:
        return "unknown", 0.0
    scores.sort(key=lambda x: (-x[1], x[0]))
    best = scores[0]
    confidence = min(1.0, best[1] / 3)
    return best[0], round(confidence, 2)


async def _handle_catalog_query(db: AsyncSession, company_id: str, msg: str, customer_id: Optional[str] = None) -> str:
    word = re.sub(r'[^\w\sáéíóúñ]', '', msg).strip()
    words = [w for w in word.split() if len(w) > 2 and w not in ("que", "para", "como", "mas", "menos", "esto", "ese", "esa", "con", "por", "del")]

    result = await db.execute(
        select(Product).where(Product.company_id == company_id, Product.activo == True).limit(5)
    )
    products = result.scalars().all()

    hits = []
    for p in products:
        pname = (p.nombre or "").lower()
        if any(w in pname for w in words):
            hits.append(p)

    if hits:
        lines = ["📋 *Productos encontrados:*\n"]
        for p in hits[:5]:
            lines.append(f"• {p.nombre} — Gs {float(p.precio_venta or 0):,.0f}")
        return "\n".join(lines)

    lines = ["📋 *Catálogo disponible:*\n"]
    for p in products[:5]:
        lines.append(f"• {p.nombre} — Gs {float(p.precio_venta or 0):,.0f}")
    lines.append("\n¿Buscás algo en particular? Decime el nombre del producto.")
    return "\n".join(lines)


async def _handle_order_query(db: AsyncSession, company_id: str, msg: str, customer_id: Optional[str] = None) -> str:
    if customer_id:
        result = await db.execute(
            select(Sale).where(
                Sale.company_id == company_id,
                Sale.customer_id == customer_id,
            ).order_by(desc(Sale.fecha)).limit(3)
        )
        orders = result.scalars().all()
        if orders:
            lines = ["📦 *Tus últimos pedidos:*\n"]
            for o in orders:
                cond = "Crédito" if o.condicion == "credito" else "Contado"
                lines.append(f"• FAC-{o.id} — Gs {float(o.total or 0):,.0f} ({o.estado}) — {o.fecha.strftime('%d/%m/%Y')} — {cond}")
            return "\n".join(lines)
    return "No encontré pedidos recientes. ¿Tenés el número de factura o pedido a mano?"


async def _handle_credit_query(db: AsyncSession, company_id: str, msg: str, customer_id: Optional[str] = None) -> str:
    if customer_id:
        result = await db.execute(
            select(Partner).where(Partner.id == customer_id, Partner.company_id == company_id)
        )
        c = result.scalar_one_or_none()
        if c:
            limit = float(c.credito_limite or 0)
            used = float(c.credito_usado or 0)
            available = max(0, limit - used)
            return (
                f"💰 *Resumen de Crédito*\n\n"
                f"Límite asignado: Gs {limit:,.0f}\n"
                f"Saldo utilizado: Gs {used:,.0f}\n"
                f"Saldo disponible: Gs {available:,.0f}\n"
                f"Disponible: {available/limit*100:.0f}%" if limit > 0 else "No tiene límite de crédito asignado."
            )
    return "Para consultar tu crédito necesito identificarte. ¿Podés decirme tu RUC o código de cliente?"


async def _handle_order_creation(db: AsyncSession, company_id: str, msg: str, customer_id: Optional[str] = None) -> str:
    return (
        "🛒 *Preparando Pedido*\n\n"
        "He registrado tu solicitud de pedido. Un operador va a revisar los detalles y te confirmará.\n\n"
        "Si querés adelantarme, decime:\n"
        "• Producto y cantidad\n"
        "• Dirección de entrega\n"
        "• Fecha preferida"
    )


async def _handle_ticket_creation(db: AsyncSession, company_id: str, msg: str, customer_id: Optional[str] = None) -> str:
    categories = {
        "producto": ["producto", "artículo", "mercadería", "mercaderia"],
        "facturación": ["factura", "precio", "cobro"],
        "entrega": ["entrega", "reparto", "demora", "envío"],
        "calidad": ["roto", "dañado", "mal estado", "vencido", "calidad"],
        "atención": ["vendedor", "atención", "trato"],
    }
    detected = "general"
    for cat, kws in categories.items():
        if any(kw in msg.lower() for kw in kws):
            detected = cat
            break

    if customer_id:
        ticket = Ticket(
            company_id=company_id,
            customer_id=customer_id,
            category=detected,
            description=f"Cliente: {customer_id}\nCategoría: {detected}\nDescripción: {msg}",
            priority="medium" if detected != "calidad" else "high",
        )
        db.add(ticket)
        await db.flush()

    return (
        f"📝 *Reclamo Registrado*\n\n"
        f"Categoría: {detected}\n\n"
        f"Tu reclamo ha sido registrado con éxito. N° de ticket generado automáticamente.\n\n"
        f"Un operador se comunicará contigo a la brevedad para dar seguimiento. ¡Gracias por tu paciencia! 🙏"
    )


async def _generate_response(db: AsyncSession, company_id: str, msg: str, intent: str, confidence: float, customer_id: Optional[str] = None) -> tuple:
    if intent == "humano":
        return _INTENT_RESPONSES["humano"], True, "escalate"

    if intent == "comprar":
        response = await _handle_order_creation(db, company_id, msg, customer_id)
        return response, False, "create_order_draft"

    if intent == "reclamo":
        response = await _handle_ticket_creation(db, company_id, msg, customer_id)
        return response, False, "create_ticket"

    if customer_id and intent in _QUERY_HANDLERS:
        handler_name = _QUERY_HANDLERS[intent]
        handler = {
            "catalogo": _handle_catalog_query,
            "pedido_status": _handle_order_query,
            "credito": _handle_credit_query,
        }.get(intent)
        if handler:
            response = await handler(db, company_id, msg, customer_id)
            return response, False, f"{intent}_queried"

    response = _INTENT_RESPONSES.get(intent, _INTENT_RESPONSES["unknown"])
    return response, False, intent if intent in ("saludo", "despedida", "unknown") else None


async def send_message(
    db: AsyncSession, company_id: str, data: dict
) -> dict:
    msg_content = data["message"]
    intent, confidence = _classify_intent(msg_content)

    conversation_id = data.get("conversation_id")
    customer_id = data.get("customer_id")
    customer_name = data.get("customer_name")
    customer_phone = data.get("customer_phone")
    channel = data.get("channel", "web")

    if conversation_id:
        result = await db.execute(
            select(Conversation).where(Conversation.id == conversation_id, Conversation.company_id == company_id)
        )
        conv = result.scalar_one_or_none()
        if not conv:
            conversation_id = None

    if not conversation_id:
        conv = Conversation(
            company_id=company_id,
            customer_id=customer_id,
            customer_name=customer_name,
            customer_phone=customer_phone,
            channel=channel,
            status="active",
            current_intent=intent,
        )
        db.add(conv)
        await db.flush()
        conversation_id = str(conv.id)
    else:
        result = await db.execute(
            select(Conversation).where(Conversation.id == conversation_id)
        )
        conv = result.scalar_one_or_none()
        if conv and conv.status == "ended":
            conv.status = "active"
            conv.started_at = datetime.now(timezone.utc)
            db.add(conv)

    user_msg = Message(
        conversation_id=conversation_id,
        company_id=company_id,
        role="user",
        content=msg_content,
        intent=intent,
        confidence=confidence,
    )
    db.add(user_msg)
    await db.flush()

    if conv:
        conv.message_count = (conv.message_count or 0) + 1
        conv.current_intent = intent
        db.add(conv)

    ai_response, needs_human, action = await _generate_response(
        db, company_id, msg_content, intent, confidence, customer_id
    )

    assistant_msg = Message(
        conversation_id=conversation_id,
        company_id=company_id,
        role="assistant",
        content=ai_response,
        intent=intent,
        action_taken=action,
        needs_human=needs_human,
    )
    db.add(assistant_msg)

    if conv:
        conv.message_count = (conv.message_count or 0) + 1
        if needs_human:
            conv.status = "waiting_human"
        elif intent in ("despedida",):
            conv.status = "resolved"
            conv.resolved_by_ai = True
            conv.ended_at = datetime.now(timezone.utc)
        db.add(conv)

    await db.commit()
    await db.refresh(user_msg)
    await db.refresh(assistant_msg)

    return {
        "conversation_id": conversation_id,
        "user_message": {
            "id": str(user_msg.id),
            "conversation_id": str(user_msg.conversation_id),
            "role": user_msg.role,
            "content": user_msg.content,
            "intent": user_msg.intent,
            "confidence": user_msg.confidence,
            "created_at": user_msg.created_at,
        },
        "assistant_message": {
            "id": str(assistant_msg.id),
            "conversation_id": str(assistant_msg.conversation_id),
            "role": assistant_msg.role,
            "content": assistant_msg.content,
            "intent": assistant_msg.intent,
            "action_taken": assistant_msg.action_taken,
            "needs_human": assistant_msg.needs_human,
            "created_at": assistant_msg.created_at,
        },
        "needs_human": needs_human,
        "action_taken": action,
    }


async def get_conversation_messages(db: AsyncSession, company_id: str, conv_id: str) -> list[dict]:
    result = await db.execute(
        select(Message).where(
            Message.conversation_id == conv_id,
            Message.company_id == company_id,
        ).order_by(Message.created_at)
    )
    return [
        {
            "id": str(m.id),
            "conversation_id": str(m.conversation_id),
            "role": m.role,
            "content": m.content,
            "intent": m.intent,
            "action_taken": m.action_taken,
            "needs_human": m.needs_human,
            "created_at": m.created_at,
        }
        for m in result.scalars().all()
    ]


async def list_conversations(
    db: AsyncSession, company_id: str,
    status: Optional[str] = None, limit: int = 50,
) -> list[dict]:
    conditions = [Conversation.company_id == company_id]
    if status:
        conditions.append(Conversation.status == status)

    result = await db.execute(
        select(Conversation).where(and_(*conditions))
        .order_by(desc(Conversation.created_at)).limit(limit)
    )
    return [
        {
            "id": str(c.id),
            "customer_id": str(c.customer_id) if c.customer_id else None,
            "customer_name": c.customer_name,
            "customer_phone": c.customer_phone,
            "channel": c.channel,
            "status": c.status,
            "current_intent": c.current_intent,
            "message_count": c.message_count,
            "resolved_by_ai": c.resolved_by_ai,
            "satisfaction_score": c.satisfaction_score,
            "started_at": c.started_at,
            "ended_at": c.ended_at,
            "created_at": c.created_at,
        }
        for c in result.scalars().all()
    ]


async def end_conversation(db: AsyncSession, company_id: str, conv_id: str, resolved_by_ai: bool = True) -> Optional[dict]:
    result = await db.execute(
        select(Conversation).where(Conversation.id == conv_id, Conversation.company_id == company_id)
    )
    conv = result.scalar_one_or_none()
    if not conv:
        return None
    conv.status = "resolved"
    conv.resolved_by_ai = resolved_by_ai
    conv.ended_at = datetime.now(timezone.utc)
    db.add(conv)
    await db.commit()
    return {"status": "resolved"}


async def rate_conversation(db: AsyncSession, company_id: str, conv_id: str, score: int) -> Optional[dict]:
    if score < 1 or score > 5:
        return None
    result = await db.execute(
        select(Conversation).where(Conversation.id == conv_id, Conversation.company_id == company_id)
    )
    conv = result.scalar_one_or_none()
    if not conv:
        return None
    conv.satisfaction_score = score
    db.add(conv)
    await db.commit()
    return {"status": "rated", "score": score}


# === TICKETS ===

async def list_tickets(
    db: AsyncSession, company_id: str,
    status: Optional[str] = None, category: Optional[str] = None, limit: int = 50,
) -> list[dict]:
    conditions = [Ticket.company_id == company_id]
    if status:
        conditions.append(Ticket.status == status)
    if category:
        conditions.append(Ticket.category == category)

    result = await db.execute(
        select(Ticket).where(and_(*conditions))
        .order_by(desc(Ticket.created_at)).limit(limit)
    )
    return [
        {
            "id": str(t.id),
            "conversation_id": str(t.conversation_id) if t.conversation_id else None,
            "customer_id": str(t.customer_id),
            "customer_name": t.customer_name,
            "category": t.category,
            "description": t.description,
            "priority": t.priority,
            "status": t.status,
            "assigned_to": str(t.assigned_to) if t.assigned_to else None,
            "resolved_at": t.resolved_at,
            "created_at": t.created_at,
        }
        for t in result.scalars().all()
    ]


async def update_ticket(db: AsyncSession, company_id: str, ticket_id: str, data: dict) -> Optional[dict]:
    result = await db.execute(
        select(Ticket).where(Ticket.id == ticket_id, Ticket.company_id == company_id)
    )
    t = result.scalar_one_or_none()
    if not t:
        return None
    t.status = data.get("status", t.status)
    if data.get("assigned_to"):
        t.assigned_to = data["assigned_to"]
    if data.get("status") in ("resolved", "closed"):
        t.resolved_at = datetime.now(timezone.utc)
    db.add(t)
    await db.commit()
    return {"status": "updated"}


# === INTENT TEMPLATES ===

async def get_intent_templates(db: AsyncSession, company_id: str) -> list[dict]:
    result = await db.execute(
        select(IntentTemplate).where(IntentTemplate.company_id == company_id, IntentTemplate.is_active == True)
    )
    return [
        {
            "id": str(t.id),
            "intent_name": t.intent_name,
            "keywords": t.keywords,
            "response_template": t.response_template,
            "requires_live_agent": t.requires_live_agent,
            "needs_auth": t.needs_auth,
            "action_handler": t.action_handler,
            "is_active": t.is_active,
            "created_at": t.created_at,
        }
        for t in result.scalars().all()
    ]


async def seed_default_templates(db: AsyncSession, company_id: str) -> dict:
    defaults = [
        {"intent_name": "saludo", "keywords": ["hola", "buenas", "hello", "hi"], "response_template": "¡Hola! Soy el asistente virtual.", "action_handler": "greet"},
        {"intent_name": "catalogo", "keywords": ["precio", "producto", "catálogo", "cuesta"], "response_template": "🔍 Consulta de catálogo", "action_handler": "query_catalog"},
        {"intent_name": "pedido_status", "keywords": ["pedido", "estado", "seguimiento", "factura"], "response_template": "📦 Estado de pedido", "action_handler": "query_order"},
        {"intent_name": "credito", "keywords": ["crédito", "saldo", "límite", "balance"], "response_template": "💰 Consulta de crédito", "action_handler": "query_credit"},
        {"intent_name": "comprar", "keywords": ["comprar", "pedir", "ordenar", "necesito"], "response_template": "🛒 Realizar pedido", "action_handler": "create_order"},
        {"intent_name": "reclamo", "keywords": ["reclamo", "problema", "queja", "error"], "response_template": "📝 Registrar reclamo", "action_handler": "create_ticket"},
        {"intent_name": "humano", "keywords": ["humano", "agente", "operador", "persona"], "response_template": "👤 Derivar a humano", "requires_live_agent": True, "action_handler": "escalate"},
    ]

    count = 0
    for d in defaults:
        existing = await db.execute(
            select(IntentTemplate).where(
                IntentTemplate.company_id == company_id,
                IntentTemplate.intent_name == d["intent_name"],
            )
        )
        if not existing.scalar_one_or_none():
            t = IntentTemplate(
                company_id=company_id,
                intent_name=d["intent_name"],
                keywords=d["keywords"],
                response_template=d["response_template"],
                requires_live_agent=d.get("requires_live_agent", False),
                needs_auth=d.get("needs_auth", True),
                action_handler=d.get("action_handler"),
            )
            db.add(t)
            count += 1

    await db.commit()
    return {"templates_seeded": count}


# === DASHBOARD ===

async def get_dashboard(db: AsyncSession, company_id: str) -> dict:
    result = await db.execute(
        select(Conversation).where(Conversation.company_id == company_id)
    )
    convs = result.scalars().all()

    total = len(convs)
    active = sum(1 for c in convs if c.status == "active")
    ai = sum(1 for c in convs if c.resolved_by_ai == True)
    human = sum(1 for c in convs if c.status == "waiting_human" or c.resolved_by_ai == False)

    today = datetime.now(timezone.utc).date()
    today_start = datetime(today.year, today.month, today.day, tzinfo=timezone.utc)
    messages_today = sum(c.message_count or 0 for c in convs)

    tickets_result = await db.execute(
        select(Ticket).where(Ticket.company_id == company_id)
    )
    tickets = tickets_result.scalars().all()

    by_category = defaultdict(int)
    for t in tickets:
        by_category[t.category] += 1

    by_intent = defaultdict(int)
    for c in convs:
        if c.current_intent:
            by_intent[c.current_intent] += 1

    recent = [
        {
            "id": str(c.id),
            "customer_name": c.customer_name or str(c.customer_id)[:8] if c.customer_id else "Anónimo",
            "status": c.status,
            "current_intent": c.current_intent,
            "message_count": c.message_count,
            "resolved_by_ai": c.resolved_by_ai,
            "started_at": c.started_at,
        }
        for c in sorted(convs, key=lambda x: x.created_at or datetime.min, reverse=True)[:10]
    ]

    return {
        "total_conversations": total,
        "active_conversations": active,
        "resolved_by_ai": ai,
        "escalated_to_human": human,
        "total_tickets": len(tickets),
        "open_tickets": sum(1 for t in tickets if t.status == "open"),
        "messages_today": messages_today,
        "ai_resolution_rate": round(ai / max(total, 1) * 100, 1) if total > 0 else 0,
        "tickets_by_category": [{"category": k, "count": v} for k, v in by_category.items()],
        "conversations_by_intent": [{"intent": k, "count": v} for k, v in by_intent.items()],
        "recent_conversations": recent,
    }
