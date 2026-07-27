"""Gerente General IA — chat conversacional con contexto real del negocio.

A diferencia de finance_agent/sales_agent (diagnóstico por lotes + recomendaciones
con aprobación humana), este es un asistente de chat de solo lectura: contesta
preguntas sobre el estado del negocio usando los mismos dashboards reales que ya
existen (ventas, finanzas, inventario). No propone ni ejecuta acciones — es una
capa de conversación sobre datos que el usuario ya podría ver en el Dashboard,
para no tener que andar buscando entre pantallas.

Mismo flag de proveedor que finance_agent/sales_agent (settings.llm_provider).
Sin persistencia en DB por ahora — el frontend mantiene el historial de la
conversación y lo reenvía en cada mensaje.
"""

import json
from datetime import datetime, date, timedelta
from decimal import Decimal

from api.src.config import settings
from api.src.reports import service as reports_service

ANTHROPIC_MODEL = "claude-opus-4-8"
GEMINI_MODEL = "gemini-2.5-flash"

SYSTEM_PROMPT = """Sos el Gerente General IA de InteliMarket, el asistente conversacional \
de un supermercado en Paraguay. Tenés acceso al estado real y actualizado del negocio: \
ventas, finanzas y stock.

Contestá en español, de forma directa y concreta, usando SIEMPRE los datos reales que se \
te pasan en el contexto — nunca inventes cifras. Si algo no está en el contexto que \
recibiste, decilo explícitamente en vez de asumirlo o inventarlo.

Sos un asistente de consulta y análisis, no un ejecutor: nunca decís que ejecutaste, \
modificaste o vas a ejecutar una acción en el sistema — solo informás, explicás y \
sugerís, para que una persona decida y actúe."""


def _json_default(obj):
    if isinstance(obj, Decimal):
        return float(obj)
    if isinstance(obj, (datetime, date)):
        return obj.isoformat()
    return str(obj)


async def _gather_context(db, company_id: str) -> dict:
    hoy = datetime.utcnow().date()
    hace_30 = hoy - timedelta(days=30)

    ventas_hoy = await reports_service.get_sales_summary(db, hoy, hoy)
    ventas_30_dias = await reports_service.get_sales_summary(db, hace_30, hoy)
    financiero = await reports_service.get_financial_summary(db, hace_30, hoy)
    inventario = await reports_service.get_inventory_summary(db)
    top_productos = await reports_service.get_sales_by_product(db, hace_30, hoy, 10)

    return {
        "fecha_actual": hoy.isoformat(),
        "ventas_hoy": ventas_hoy,
        "ventas_ultimos_30_dias": ventas_30_dias,
        "financiero_ultimos_30_dias": financiero,
        "inventario": inventario,
        "top_10_productos_30_dias": top_productos,
    }


def _call_anthropic(system_with_context: str, history: list[dict], message: str) -> str:
    import anthropic

    client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
    messages = [{"role": h["role"], "content": h["content"]} for h in history]
    messages.append({"role": "user", "content": message})
    response = client.messages.create(
        model=ANTHROPIC_MODEL,
        max_tokens=1024,
        system=system_with_context,
        messages=messages,
    )
    return next(b.text for b in response.content if b.type == "text")


def _call_gemini(system_with_context: str, history: list[dict], message: str) -> str:
    from google import genai
    from google.genai import types

    client = genai.Client(api_key=settings.gemini_api_key)
    contents = []
    for h in history:
        role = "model" if h["role"] == "assistant" else "user"
        contents.append(types.Content(role=role, parts=[types.Part(text=h["content"])]))
    contents.append(types.Content(role="user", parts=[types.Part(text=message)]))

    response = client.models.generate_content(
        model=GEMINI_MODEL,
        contents=contents,
        config=types.GenerateContentConfig(system_instruction=system_with_context),
    )
    return response.text


async def chat(db, company_id: str, message: str, history: list[dict]) -> str:
    context = await _gather_context(db, company_id)
    context_json = json.dumps(context, default=_json_default, ensure_ascii=False)
    system_with_context = f"{SYSTEM_PROMPT}\n\nEstado actual del negocio (JSON):\n\n{context_json}"

    if settings.llm_provider == "gemini":
        return _call_gemini(system_with_context, history, message)
    return _call_anthropic(system_with_context, history, message)
