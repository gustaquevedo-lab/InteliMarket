"""Gerente Financiero IA — diagnóstico y recomendaciones (modo solo-diagnóstico).

El agente lee dashboards ya existentes (financial, accounts_receivable), le pide
a Claude un diagnóstico + una lista de recomendaciones estructuradas, y las deja
en estado "pending". Nunca ejecuta nada — la aprobación humana es la única forma
de que una recomendación se marque como accionada (y por ahora, aprobar solo
cambia el estado; ejecutar la acción real sobre supplier_invoices/accounts_receivable
queda para cuando el diagnóstico esté validado con el cliente).
"""

import json
from datetime import datetime, date
from decimal import Decimal

import anthropic
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.config import settings
from api.src.finance_agent.models import FinanceAgentRun, FinanceRecommendation
from api.src.financial import service as financial_service
from api.src.accounts_receivable import service as ar_service

MODEL = "claude-opus-4-8"

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
                    "tipo": {"type": "string", "enum": ["cobranza", "pago_proveedor", "alerta_presupuesto", "otro"]},
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

SYSTEM_PROMPT = """Sos el Gerente Financiero IA de InteliMarket para un supermercado en Paraguay.

Recibís el estado actual de finanzas, cuentas por pagar y cuentas por cobrar.
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
    return {
        "financial_dashboard": await financial_service.get_financial_dashboard(db, company_id),
        "ap_dashboard": await financial_service.get_ap_dashboard(db, company_id),
        "cash_flow_dashboard": await financial_service.get_cash_flow_dashboard(db, company_id),
        "financial_ratios": await financial_service.get_financial_ratios(db, company_id),
        "ar_aging": await ar_service.get_aging_report(db, company_id),
        "ar_summary": await ar_service.get_receivable_summary(db, company_id),
    }


async def run_diagnosis(db: AsyncSession, company_id: str) -> FinanceAgentRun:
    run = FinanceAgentRun(company_id=company_id, model=MODEL, status="running")
    db.add(run)
    await db.flush()

    try:
        context = await _gather_context(db, company_id)
        context_json = json.dumps(context, default=_json_default, ensure_ascii=False)

        client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
        response = client.messages.create(
            model=MODEL,
            max_tokens=4096,
            thinking={"type": "adaptive"},
            system=SYSTEM_PROMPT,
            output_config={"format": {"type": "json_schema", "schema": RECOMMENDATION_SCHEMA}},
            messages=[{
                "role": "user",
                "content": f"Estado financiero actual (JSON):\n\n{context_json}\n\nDiagnosticá y recomendá.",
            }],
        )

        text_block = next(b.text for b in response.content if b.type == "text")
        parsed = json.loads(text_block)

        run.contexto = context
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


async def list_recommendations(db: AsyncSession, company_id: str, status: str | None = None) -> list[FinanceRecommendation]:
    query = select(FinanceRecommendation).where(FinanceRecommendation.company_id == company_id)
    if status:
        query = query.where(FinanceRecommendation.status == status)
    query = query.order_by(FinanceRecommendation.created_at.desc())
    result = await db.execute(query)
    return list(result.scalars().all())


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
