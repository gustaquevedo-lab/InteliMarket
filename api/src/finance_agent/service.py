"""Gerente Financiero IA — diagnóstico y recomendaciones (modo solo-diagnóstico).

El agente lee dashboards ya existentes (financial, accounts_receivable), le pide
a Claude un diagnóstico + una lista de recomendaciones estructuradas, y las deja
en estado "pending". Nunca ejecuta nada — la aprobación humana es la única forma
de que una recomendación se marque como accionada (y por ahora, aprobar solo
cambia el estado; ejecutar la acción real sobre supplier_invoices/accounts_receivable
queda para cuando el diagnóstico esté validado con el cliente).
"""

import json
from datetime import datetime, date, timedelta
from decimal import Decimal

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.config import settings
from api.src.finance_agent.models import FinanceAgentRun, FinanceRecommendation
from api.src.financial import service as financial_service
from api.src.accounts_receivable import service as ar_service
from api.src.petty_cash import service as petty_cash_service

# Proveedor de LLM intercambiable vía settings.llm_provider ("gemini" | "anthropic").
# Gemini es el default por costo; Anthropic queda listo para reactivar con solo
# cambiar LLM_PROVIDER en el .env, sin tocar código.
ANTHROPIC_MODEL = "claude-opus-4-8"
GEMINI_MODEL = "gemini-2.5-flash"

# Dialecto JSON Schema estándar — usado por Anthropic.
RECOMMENDATION_SCHEMA = {
    "type": "object",
    "properties": {
        "diagnostico": {
            "type": "string",
            "description": "Resumen ejecutivo del estado financiero, en español, 3-5 oraciones.",
        },
        "recomendaciones": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "tipo": {"type": "string", "enum": ["cobranza", "pago_proveedor", "alerta_presupuesto", "reduccion_gasto", "otro"]},
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

# Mismo contenido en dialecto OpenAPI/Gemini (nullable en vez de type: [x, null],
# sin additionalProperties — Gemini no soporta esa palabra clave).
GEMINI_RECOMMENDATION_SCHEMA = {
    "type": "OBJECT",
    "properties": {
        "diagnostico": {"type": "STRING"},
        "recomendaciones": {
            "type": "ARRAY",
            "items": {
                "type": "OBJECT",
                "properties": {
                    "tipo": {"type": "STRING", "enum": ["cobranza", "pago_proveedor", "alerta_presupuesto", "reduccion_gasto", "otro"]},
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

SYSTEM_PROMPT = """Sos el Gerente Financiero IA de InteliMarket para un supermercado en Paraguay.

Recibís el estado actual de finanzas, cuentas por pagar, cuentas por cobrar, y
el dashboard de gastos (caja chica) con desglose por categoría —con presupuesto
y variación vs. período anterior— y por sector/centro de costo del supermercado
(carnicería, panadería, caja, administración, etc.), incluyendo cuánto de esos
gastos son directos de cada sector y cuánto es prorrateo de gastos globales.

La reducción de gastos es un pilar de la rentabilidad tanto como el aumento de
ventas: analizá el dashboard de gastos con el mismo rigor que el financiero.
Si una categoría superó su presupuesto, creció de forma inusual, o un proveedor
concentra una porción grande del gasto, proponé una recomendación tipo
"reduccion_gasto" concreta — con el monto y la categoría/sector involucrado,
nunca "reducir gastos" en genérico. Si detectás que la mayoría de los gastos no
tienen sector asignado, señalalo: sin esa imputación no se puede medir cuánto
gana o pierde cada sector del supermercado.

Tu trabajo: dar un diagnóstico honesto y proponer recomendaciones concretas y
accionables — nunca vagas ("mejorar la cobranza"), siempre con la entidad y el
monto involucrado cuando el dato esté disponible.

No inventes cifras que no estén en los datos que te paso. Si un dato falta,
decilo en el diagnóstico en vez de asumirlo. Nunca proponés ejecutar una acción
vos mismo — solo la sugerís para que un humano la apruebe."""


def _json_default(obj):
    if isinstance(obj, (Decimal,)):
        return float(obj)
    if isinstance(obj, (datetime, date)):
        return obj.isoformat()
    return str(obj)


async def _gather_context(db: AsyncSession, company_id: str) -> dict:
    hoy = date.today()
    hace_30 = hoy - timedelta(days=29)
    return {
        "financial_dashboard": await financial_service.get_financial_dashboard(db, company_id),
        "ap_dashboard": await financial_service.get_ap_dashboard(db, company_id),
        "cash_flow_dashboard": await financial_service.get_cash_flow_dashboard(db, company_id),
        "financial_ratios": await financial_service.get_financial_ratios(db, company_id),
        "ar_aging": await ar_service.get_aging_report(db, company_id),
        "ar_summary": await ar_service.get_receivable_summary(db, company_id),
        "gastos_dashboard": await petty_cash_service.get_expense_dashboard(db, company_id, hace_30, hoy),
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


async def run_diagnosis(db: AsyncSession, company_id: str) -> FinanceAgentRun:
    run = FinanceAgentRun(company_id=company_id, model=_current_model_name(), status="running")
    db.add(run)
    await db.flush()

    try:
        context = await _gather_context(db, company_id)
        context_json = json.dumps(context, default=_json_default, ensure_ascii=False)
        user_content = f"Estado financiero actual (JSON):\n\n{context_json}\n\nDiagnosticá y recomendá."

        if settings.llm_provider == "gemini":
            parsed = _call_gemini(user_content)
        else:
            parsed = _call_anthropic(user_content)

        run.contexto = json.loads(context_json)  # ya pasó por _json_default (Decimal -> float)
        run.respuesta_cruda = parsed
        run.diagnostico = parsed["diagnostico"]
        run.status = "completed"
        run.finished_at = datetime.utcnow()

        for rec in parsed["recomendaciones"]:
            db.add(FinanceRecommendation(
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


async def list_recommendations(
    db: AsyncSession, company_id: str, status: str | None = None, tipo: str | None = None,
    limit: int = 100, offset: int = 0,
) -> list[FinanceRecommendation]:
    query = select(FinanceRecommendation).where(FinanceRecommendation.company_id == company_id)
    if status:
        query = query.where(FinanceRecommendation.status == status)
    if tipo:
        query = query.where(FinanceRecommendation.tipo == tipo)
    query = query.order_by(FinanceRecommendation.created_at.desc()).limit(limit).offset(offset)
    result = await db.execute(query)
    return list(result.scalars().all())


async def count_recommendations_by_tipo(db: AsyncSession, company_id: str, status: str | None = None) -> list[dict]:
    query = select(FinanceRecommendation.tipo, func.count()).where(FinanceRecommendation.company_id == company_id)
    if status:
        query = query.where(FinanceRecommendation.status == status)
    query = query.group_by(FinanceRecommendation.tipo).order_by(func.count().desc())
    result = await db.execute(query)
    return [{"tipo": t, "cantidad": c} for t, c in result.all()]


async def decide_recommendation(db: AsyncSession, recommendation_id: str, approve: bool, approved_by: str, comments: str | None) -> FinanceRecommendation | None:
    result = await db.execute(select(FinanceRecommendation).where(FinanceRecommendation.id == recommendation_id))
    rec = result.scalar_one_or_none()
    if not rec:
        return None

    rec.status = "approved" if approve else "rejected"
    rec.approved_by = approved_by
    rec.comments = comments
    # Nota: aprobar hoy solo cambia el estado. Ejecutar la acción real
    # (ej. disparar una gestión de cobranza) queda para cuando el diagnóstico
    # esté validado con el cliente — modo solo-diagnóstico acordado.
    await db.commit()
    await db.refresh(rec)
    return rec


async def bulk_decide_recommendations(db: AsyncSession, ids: list[str], approve: bool, approved_by: str, comments: str | None) -> int:
    result = await db.execute(
        select(FinanceRecommendation).where(FinanceRecommendation.id.in_(ids), FinanceRecommendation.status == "pending")
    )
    recs = list(result.scalars().all())
    for rec in recs:
        rec.status = "approved" if approve else "rejected"
        rec.approved_by = approved_by
        rec.comments = comments
    await db.commit()
    return len(recs)
