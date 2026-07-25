"""Seed for Asistente Virtual - conversaciones, mensajes, tickets, intents"""
import asyncio
import asyncpg
from datetime import date, datetime, timedelta
from uuid import uuid4
from scripts.seed_data import DB, CID, CUST02, CUST04, USER_OP1, VA_CONV1, VA_CONV2, VA_MSG1, VA_TICK1, VA_INTENT


async def seed():
    conn = await asyncpg.connect(DB)
    try:
        # va_conversations
        await conn.execute("""
            INSERT INTO va_conversations (id, company_id, customer_id, customer_name, customer_phone, channel, status, current_intent, message_count, resolved_by_ai, satisfaction_score, started_at, ended_at, metadata_json, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
            ON CONFLICT (id) DO NOTHING
        """, VA_CONV1, CID, CUST02, "María Giménez", "0981-234567", "whatsapp", "closed", "consulta_precio", 6, True, 5, datetime.utcnow() - timedelta(hours=2), datetime.utcnow(), '{"source": "whatsapp_api"}', datetime.utcnow())
        await conn.execute("""
            INSERT INTO va_conversations (id, company_id, customer_id, customer_name, customer_phone, channel, status, current_intent, message_count, resolved_by_ai, satisfaction_score, started_at, ended_at, metadata_json, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
            ON CONFLICT (id) DO NOTHING
        """, VA_CONV2, CID, CUST04, "Juan Pérez", "0971-345678", "web", "active", "reclamo", 3, False, None, datetime.utcnow() - timedelta(minutes=30), None, None, datetime.utcnow())

        # messages for VA_CONV1
        msg_time = datetime.utcnow() - timedelta(hours=2, minutes=10)
        messages = [
            (VA_MSG1, VA_CONV1, CID, "client", "Hola, quería saber el precio de la Coca Cola 2L", None, None, None, False, msg_time),
            (uuid4(), VA_CONV1, CID, "assistant", "El precio de Coca Cola 2L es Gs. 7.200. ¿Deseas realizar un pedido?", "consulta_precio", 0.94, "lookup_price", False, msg_time + timedelta(seconds=30)),
            (uuid4(), VA_CONV1, CID, "client", "Sí, quiero 10 unidades. ¿Hay promociones?", None, None, None, True, msg_time + timedelta(minutes=2)),
        ]
        for mid, conv_id, co, role, content, intent, conf, action, human, ts in messages:
            await conn.execute("""
                INSERT INTO va_messages (id, conversation_id, company_id, role, content, intent, confidence, action_taken, needs_human, created_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                ON CONFLICT (id) DO NOTHING
            """, mid, conv_id, co, role, content, intent, conf, action, human, ts)

        # ticket
        await conn.execute("""
            INSERT INTO va_tickets (id, company_id, conversation_id, customer_id, customer_name, category, description, priority, status, assigned_to, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            ON CONFLICT (id) DO NOTHING
        """, VA_TICK1, CID, VA_CONV2, CUST04, "Juan Pérez", "reclamo_entrega", "Cliente reporta que su pedido llegó incompleto — faltan 3 productos", "high", "open", USER_OP1, datetime.utcnow())

        # intent templates
        await conn.execute("""
            INSERT INTO va_intent_templates (id, company_id, intent_name, keywords, response_template, requires_live_agent, needs_auth, action_handler, is_active, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            ON CONFLICT (id) DO NOTHING
        """, VA_INTENT, CID, "consulta_precio", '["precio", "cuánto", "costo", "vale"]', "El precio de {{producto}} es Gs. {{precio}}. ¿Deseas realizar un pedido?", False, False, "lookup_price", True, datetime.utcnow())
        intent2_id = uuid4()
        await conn.execute("""
            INSERT INTO va_intent_templates (id, company_id, intent_name, keywords, response_template, requires_live_agent, needs_auth, action_handler, is_active, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            ON CONFLICT (id) DO NOTHING
        """, intent2_id, CID, "reclamo", '["reclamo", "queja", "problema", "incompleto", "faltó", "llegó mal"]', "Lamento el inconveniente. Te comunico con un asesor para resolverlo.", True, True, "create_ticket", True, datetime.utcnow())

        print("✅ Asistente Virtual seeded")
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(seed())
