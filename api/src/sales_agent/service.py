"""Gerente de Ventas IA — diagnóstico y recomendaciones (modo solo-diagnóstico).

Mismo patrón que finance_agent: lee agregados reales de ventas ya existentes
en la base (nada inventado), le pide al LLM un diagnóstico + recomendaciones
estructuradas, y las deja en estado "pending". Nunca ejecuta nada — la
aprobación humana es la única forma de que una recomendación se marque como
accionada.

Mismo flag de proveedor que finance_agent (settings.llm_provider): Gemini por
default, Anthropic detrás del mismo flag para reactivar sin tocar código.
"""

import json
from datetime import datetime, date, timedelta
from decimal import Decimal

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.config import settings
from api.src.sales_agent.models import SalesAgentRun, SalesRecommendation

ANTHROPIC_MODEL = "claude-opus-4-8"
GEMINI_MODEL = "gemini-2.5-flash"

RECOMMENDATION_SCHEMA = {
    "type": "object",
    "properties": {
        "diagnostico": {
            "type": "string",
            "description": "Resumen ejecutivo del desempeño de ventas, en español, 3-5 oraciones.",
        },
        "recomendaciones": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "tipo": {"type": "string", "enum": ["oportunidad", "alerta_caida", "concentracion_cliente", "estacionalidad", "otro"]},
                    "titulo": {"type": "string"},
                    "descripcion": {"type": "string"},
                    "entidad_relacionada": {"type": ["string", "null"]},
                    "monto_relacionado": {"type": ["string", "null"]},
                },
                "required": ["tipo", "titulo", "descripcion", "entidad_relacionada", "monto_relacionado"],
                "additionalProperties": False,
            },
        },
    },
    "required": ["diagnostico", "recomendaciones"],
    "additionalProperties": False,
}

GEMINI_RECOMMENDATION_SCHEMA = {
    "type": "OBJECT",
    "properties": {
        "diagnostico": {"type": "STRING"},
        "recomendaciones": {
            "type": "ARRAY",
            "items": {
                "type": "OBJECT",
                "properties": {
                    "tipo": {"type": "STRING", "enum": ["oportunidad", "alerta_caida", "concentracion_cliente", "estacionalidad", "otro"]},
                    "titulo": {"type": "STRING"},
                    "descripcion": {"type": "STRING"},
                    "entidad_relacionada": {"type": "STRING", "nullable": True},
                    "monto_relacionado": {"type": "STRING", "nullable": True},
                },
                "required": ["tipo", "titulo", "descripcion"],
            },
        },
    },
    "required": ["diagnostico", "recomendaciones"],
}

SYSTEM_PROMPT = """Sos el Gerente de Ventas IA de InteliMarket para un supermercado en Paraguay.

Recibís agregados reales de ventas: resumen de hoy, últimos 30 días vs. los 30
anteriores, top de productos y clientes por facturación, patrón por día de la
semana, y la serie semanal de las últimas 12 semanas. Tu trabajo: dar un
diagnóstico honesto del desempeño comercial y proponer recomendaciones
concretas y accionables — nunca vagas ("mejorar las ventas"), siempre con el
producto, cliente o período involucrado y el monto cuando el dato esté
disponible.

Podés señalar tendencias, estacionalidad, concentración de riesgo en pocos
clientes o productos, y anticipar escenarios a partir de la serie semanal
(pero dejalo claro como proyección, no como certeza). No inventes cifras que
no estén en los datos que te paso. Si un dato falta o es insuficiente para
una conclusión firme, decilo en el diagnóstico en vez de asumirlo. Nunca
proponés ejecutar una acción vos mismo — solo la sugerís para que un humano
la apruebe."""


def _json_default(obj):
    if isinstance(obj, (Decimal,)):
        return float(obj)
    if isinstance(obj, (datetime, date)):
        return obj.isoformat()
    return str(obj)


async def _gather_context(db: AsyncSession, company_id: str) -> dict:
    hoy = datetime.utcnow().date()
    hace_30 = hoy - timedelta(days=30)
    hace_60 = hoy - timedelta(days=60)
    hace_90 = hoy - timedelta(days=90)

    resumen_hoy = (await db.execute(text("""
        SELECT COUNT(*) cantidad, COALESCE(SUM(total), 0) total_ventas
        FROM sales WHERE company_id = :cid AND fecha::date = :hoy AND estado = 'confirmado'
    """), {"cid": company_id, "hoy": hoy})).mappings().first()

    periodo_actual = (await db.execute(text("""
        SELECT COUNT(*) cantidad, COALESCE(SUM(total), 0) total, COALESCE(AVG(total), 0) ticket_promedio
        FROM sales WHERE company_id = :cid AND fecha::date >= :desde AND fecha::date < :hoy AND estado = 'confirmado'
    """), {"cid": company_id, "desde": hace_30, "hoy": hoy})).mappings().first()

    periodo_anterior = (await db.execute(text("""
        SELECT COUNT(*) cantidad, COALESCE(SUM(total), 0) total
        FROM sales WHERE company_id = :cid AND fecha::date >= :desde AND fecha::date < :hasta AND estado = 'confirmado'
    """), {"cid": company_id, "desde": hace_60, "hasta": hace_30})).mappings().first()

    top_productos = (await db.execute(text("""
        SELECT p.nombre, SUM(si.cantidad) cantidad_vendida, SUM(si.total) facturacion
        FROM sale_items si
        JOIN sales s ON s.id = si.sale_id
        JOIN products p ON p.id = si.product_id
        WHERE s.company_id = :cid AND s.fecha::date >= :desde AND s.estado = 'confirmado'
        GROUP BY p.nombre ORDER BY facturacion DESC LIMIT 10
    """), {"cid": company_id, "desde": hace_90})).mappings().all()

    top_clientes = (await db.execute(text("""
        SELECT c.razon_social, COUNT(*) cantidad_compras, SUM(s.total) facturacion
        FROM sales s
        JOIN customers c ON c.id = s.customer_id
        WHERE s.company_id = :cid AND s.fecha::date >= :desde AND s.estado = 'confirmado'
        GROUP BY c.razon_social ORDER BY facturacion DESC LIMIT 10
    """), {"cid": company_id, "desde": hace_90})).mappings().all()

    por_dia_semana = (await db.execute(text("""
        SELECT to_char(fecha, 'Day') dia, COUNT(*) cantidad, SUM(total) facturacion, AVG(total) ticket_promedio
        FROM sales WHERE company_id = :cid AND fecha::date >= :desde AND estado = 'confirmado'
        GROUP BY to_char(fecha, 'Day'), EXTRACT(ISODOW FROM fecha) ORDER BY EXTRACT(ISODOW FROM fecha)
    """), {"cid": company_id, "desde": hace_90})).mappings().all()

    tendencia_semanal = (await db.execute(text("""
        SELECT to_char(date_trunc('week', fecha), 'YYYY-MM-DD') semana, COUNT(*) cantidad, SUM(total) facturacion
        FROM sales WHERE company_id = :cid AND fecha >= (now() - interval '12 weeks') AND estado = 'confirmado'
        GROUP BY date_trunc('week', fecha) ORDER BY 1
    """), {"cid": company_id})).mappings().all()

    return {
        "ventas_hoy": dict(resumen_hoy) if resumen_hoy else {},
        "ultimos_30_dias": dict(periodo_actual) if periodo_actual else {},
        "30_dias_anteriores": dict(periodo_anterior) if periodo_anterior else {},
        "top_10_productos_90_dias": [dict(r) for r in top_productos],
        "top_10_clientes_90_dias": [dict(r) for r in top_clientes],
        "ventas_por_dia_semana_90_dias": [dict(r) for r in por_dia_semana],
        "tendencia_semanal_12_semanas": [dict(r) for r in tendencia_semanal],
    }


def _call_anthropic(user_content: str) -> dict:
    import anthropic

    client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
    response = client.messages.create(
        model=ANTHROPIC_MODEL,
        max_tokens=4096,
        thinking={"type": "adaptive"},
        system=SYSTEM_PROMPT,
        output_config={"format": {"type": "json_schema", "schema": RECOMMENDATION_SCHEMA}},
        messages=[{"role": "user", "content": user_content}],
    )
    text_block = next(b.text for b in response.content if b.type == "text")
    return json.loads(text_block)


def _call_gemini(user_content: str) -> dict:
    from google import genai
    from google.genai import types

    client = genai.Client(api_key=settings.gemini_api_key)
    response = client.models.generate_content(
        model=GEMINI_MODEL,
        contents=user_content,
        config=types.GenerateContentConfig(
            system_instruction=SYSTEM_PROMPT,
            response_mime_type="application/json",
            response_schema=GEMINI_RECOMMENDATION_SCHEMA,
        ),
    )
    return json.loads(response.text)


def _current_model_name() -> str:
    return GEMINI_MODEL if settings.llm_provider == "gemini" else ANTHROPIC_MODEL


async def run_diagnosis(db: AsyncSession, company_id: str) -> SalesAgentRun:
    run = SalesAgentRun(company_id=company_id, model=_current_model_name(), status="running")
    db.add(run)
    await db.flush()

    try:
        context = await _gather_context(db, company_id)
        context_json = json.dumps(context, default=_json_default, ensure_ascii=False)
        user_content = f"Datos de ventas actuales (JSON):\n\n{context_json}\n\nDiagnosticá y recomendá."

        if settings.llm_provider == "gemini":
            parsed = _call_gemini(user_content)
        else:
            parsed = _call_anthropic(user_content)

        run.contexto = json.loads(context_json)
        run.respuesta_cruda = parsed
        run.diagnostico = parsed["diagnostico"]
        run.status = "completed"
        run.finished_at = datetime.utcnow()

        for rec in parsed["recomendaciones"]:
            db.add(SalesRecommendation(
                company_id=company_id,
                run_id=run.id,
                tipo=rec["tipo"],
                titulo=rec["titulo"],
                descripcion=rec["descripcion"],
                entidad_relacionada=rec.get("entidad_relacionada"),
                monto_relacionado=rec.get("monto_relacionado"),
            ))

    except Exception as e:  # noqa: BLE001
        run.status = "error"
        run.error_message = str(e)
        run.finished_at = datetime.utcnow()

    db.add(run)
    await db.commit()
    await db.refresh(run)
    return run


async def list_recommendations(db: AsyncSession, company_id: str, status: str | None = None) -> list[SalesRecommendation]:
    query = select(SalesRecommendation).where(SalesRecommendation.company_id == company_id)
    if status:
        query = query.where(SalesRecommendation.status == status)
    query = query.order_by(SalesRecommendation.created_at.desc())
    result = await db.execute(query)
    return list(result.scalars().all())


async def decide_recommendation(db: AsyncSession, recommendation_id: str, approve: bool, approved_by: str, comments: str | None) -> SalesRecommendation | None:
    result = await db.execute(select(SalesRecommendation).where(SalesRecommendation.id == recommendation_id))
    rec = result.scalar_one_or_none()
    if not rec:
        return None

    rec.status = "approved" if approve else "rejected"
    rec.approved_by = approved_by
    rec.comments = comments
    await db.commit()
    await db.refresh(rec)
    return rec
