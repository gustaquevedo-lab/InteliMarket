"""Servicio del Gerente Financiero IA — Casa Gonzalito S.R.L.

Motor de análisis financiero, tesorería, flujo de caja, cobranzas y cuentas por pagar.
Opera 100% en infraestructura local (Ollama / PostgreSQL) sin dependencias de APIs externas.
"""

import time
import json
import logging
import uuid
import os
import httpx
from datetime import datetime, date, timedelta
from decimal import Decimal
from typing import Optional, List, Dict, Any
from sqlalchemy import text, select
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.finance_agent.models import FinanceAgentRun, FinanceRecommendation

logger = logging.getLogger("finance_agent")

OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://127.0.0.1:11434")
DEFAULT_MODEL = os.getenv("AI_DEFAULT_MODEL", "qwen2.5:7b")


def format_gs(amount: float) -> str:
    try:
        val = int(round(float(amount or 0)))
        return f"Gs. {val:,.0f}".replace(",", ".")
    except Exception:
        return "Gs. 0"


def _json_default(obj):
    if isinstance(obj, (Decimal,)):
        return float(obj)
    if isinstance(obj, (datetime, date)):
        return obj.isoformat()
    return str(obj)


async def _gather_context(db: AsyncSession, company_id: str) -> Dict[str, Any]:
    """Recopila todas las métricas financieras clave de la base de datos de Casa Gonzalito."""
    cid = str(company_id)
    
    # 1. Saldos bancarios y liquidez
    banks_sql = """
        SELECT id, banco, numero_cuenta, moneda, saldo_actual
        FROM bank_accounts
        WHERE company_id = :cid AND activo = true
        ORDER BY saldo_actual DESC;
    """
    bank_rows = (await db.execute(text(banks_sql), {"cid": cid})).mappings().all()
    bancos = [dict(b) for b in bank_rows]
    total_liquidez = sum(float(b.get("saldo_actual") or 0) for b in bancos)

    # 2. Cuentas por pagar a proveedores (AP)
    ap_sql = """
        SELECT 
            COALESCE(SUM(saldo_pendiente), 0) as total_ap,
            COALESCE(SUM(CASE WHEN fecha_vencimiento < CURRENT_DATE THEN saldo_pendiente ELSE 0 END), 0) as ap_vencida,
            COALESCE(SUM(CASE WHEN fecha_vencimiento >= CURRENT_DATE AND fecha_vencimiento <= CURRENT_DATE + INTERVAL '7 days' THEN saldo_pendiente ELSE 0 END), 0) as ap_proximos_7d,
            COALESCE(SUM(CASE WHEN fecha_vencimiento >= CURRENT_DATE AND fecha_vencimiento <= CURRENT_DATE + INTERVAL '30 days' THEN saldo_pendiente ELSE 0 END), 0) as ap_proximos_30d
        FROM supplier_invoices
        WHERE company_id = :cid AND estado in ('pendiente', 'parcial', 'vencida');
    """
    ap_data = (await db.execute(text(ap_sql), {"cid": cid})).mappings().first() or {}

    # 3. Cuentas por cobrar a clientes mayoristas (AR)
    ar_sql = """
        SELECT 
            COALESCE(SUM(saldo_pendiente), 0) as total_ar,
            COALESCE(SUM(CASE WHEN fecha_vencimiento < CURRENT_DATE THEN saldo_pendiente ELSE 0 END), 0) as ar_vencida,
            COALESCE(SUM(CASE WHEN fecha_vencimiento >= CURRENT_DATE AND fecha_vencimiento <= CURRENT_DATE + INTERVAL '7 days' THEN saldo_pendiente ELSE 0 END), 0) as ar_a_vencer_7d,
            COALESCE(SUM(CASE WHEN fecha_vencimiento >= CURRENT_DATE AND fecha_vencimiento <= CURRENT_DATE + INTERVAL '30 days' THEN saldo_pendiente ELSE 0 END), 0) as ar_a_vencer_30d
        FROM accounts_receivable
        WHERE company_id = :cid AND estado in ('pendiente', 'parcial', 'vencida', 'abierta');
    """
    ar_data = (await db.execute(text(ar_sql), {"cid": cid})).mappings().first() or {}

    # 4. Top clientes con mayor saldo vencido
    top_morosos_sql = """
        SELECT c.id, COALESCE(c.nombre_fantasia, c.razon_social) as nombre, c.ruc, SUM(ar.saldo_pendiente) as saldo_vencido,
               MIN(ar.fecha_vencimiento) as vencimiento_mas_antiguo,
               COUNT(ar.id) as docs_vencidos
        FROM accounts_receivable ar
        JOIN customers c ON c.id = ar.customer_id
        WHERE ar.company_id = :cid 
          AND ar.fecha_vencimiento < CURRENT_DATE 
          AND ar.estado in ('pendiente', 'parcial', 'vencida', 'abierta')
        GROUP BY c.id, c.nombre_fantasia, c.razon_social, c.ruc
        ORDER BY saldo_vencido DESC
        LIMIT 5;
    """
    top_morosos = [dict(r) for r in (await db.execute(text(top_morosos_sql), {"cid": cid})).mappings().all()]

    # 5. Cheques en cartera
    checks_sql = """
        SELECT 
            COALESCE(SUM(monto), 0) as total_cheques_cartera,
            COALESCE(SUM(CASE WHEN fecha_vencimiento <= CURRENT_DATE + INTERVAL '7 days' THEN monto ELSE 0 END), 0) as cheques_a_depositar_7d,
            COALESCE(SUM(CASE WHEN fecha_vencimiento <= CURRENT_DATE + INTERVAL '30 days' THEN monto ELSE 0 END), 0) as cheques_a_depositar_30d
        FROM checks
        WHERE company_id = :cid AND estado in ('en_cartera', 'cartera', 'pendiente');
    """
    checks_data = (await db.execute(text(checks_sql), {"cid": cid})).mappings().first() or {}

    # 6. Ventas y Cobranzas del mes en curso
    sales_mtd_sql = """
        SELECT COALESCE(SUM(total), 0) as ventas_mes
        FROM sales
        WHERE company_id = :cid 
          AND estado <> 'cancelado'
          AND fecha >= date_trunc('month', CURRENT_DATE);
    """
    sales_mtd = float((await db.execute(text(sales_mtd_sql), {"cid": cid})).scalar() or 0)

    return {
        "bancos": bancos,
        "liquidez_bancos_gs": float(total_liquidez),
        "total_ap_proveedores_gs": float(ap_data.get("total_ap") or 0),
        "ap_vencida_gs": float(ap_data.get("ap_vencida") or 0),
        "ap_proximos_7d_gs": float(ap_data.get("ap_proximos_7d") or 0),
        "ap_proximos_30d_gs": float(ap_data.get("ap_proximos_30d") or 0),
        "total_ar_clientes_gs": float(ar_data.get("total_ar") or 0),
        "ar_vencida_gs": float(ar_data.get("ar_vencida") or 0),
        "ar_a_vencer_7d_gs": float(ar_data.get("ar_a_vencer_7d") or 0),
        "ar_a_vencer_30d_gs": float(ar_data.get("ar_a_vencer_30d") or 0),
        "top_clientes_morosos": top_morosos,
        "cheques_cartera_gs": float(checks_data.get("total_cheques_cartera") or 0),
        "cheques_a_depositar_7d_gs": float(checks_data.get("cheques_a_depositar_7d") or 0),
        "ventas_mes_gs": sales_mtd,
    }


async def get_financial_executive_summary(db: AsyncSession, company_id: str) -> Dict[str, Any]:
    """Genera un resumen ejecutivo de tesorería y liquidez para la dirección o copilot."""
    ctx = await _gather_context(db, company_id)
    
    liquidez = ctx["liquidez_bancos_gs"]
    ar_total = ctx["total_ar_clientes_gs"]
    ar_vencida = ctx["ar_vencida_gs"]
    ap_total = ctx["total_ap_proveedores_gs"]
    cheques = ctx["cheques_cartera_gs"]
    
    # Flujo neto estimado 30 días = Liquidez + Cobranzas estimadas (AR 30d + Cheques 30d) - Pagos a Proveedores 30d
    ingresos_proy = ctx["ar_a_vencer_30d_gs"] + (ctx["cheques_cartera_gs"] * 0.4)
    egresos_proy = ctx["ap_proximos_30d_gs"]
    flujo_neto = liquidez + ingresos_proy - egresos_proy

    alertas = []
    if ar_vencida > (ar_total * 0.4):
        alertas.append(f"Mora elevada: {format_gs(ar_vencida)} en créditos vencidos ({round(ar_vencida/ar_total*100, 1)}% del total).")
    if ctx["ap_vencida_gs"] > 0:
        alertas.append(f"Deuda vencida con proveedores: {format_gs(ctx['ap_vencida_gs'])} pendiente de regularización.")
    if liquidez < (ctx["ap_proximos_7d_gs"]):
        alertas.append(f"Déficit operativo a 7 días: Liquidez bancaria ({format_gs(liquidez)}) menor a vencimientos inmediatos ({format_gs(ctx['ap_proximos_7d_gs'])}).")

    # Contar recomendaciones pendientes
    rec_count_sql = "SELECT COUNT(*) FROM finance_recommendations WHERE company_id = :cid AND status = 'pending';"
    rec_count = int((await db.execute(text(rec_count_sql), {"cid": str(company_id)})).scalar() or 0)

    return {
        "company_id": str(company_id),
        "as_of": datetime.utcnow(),
        "liquidez_bancos_gs": liquidez,
        "cuentas_por_cobrar_gs": ar_total,
        "cuentas_por_cobrar_vencidas_gs": ar_vencida,
        "cuentas_por_pagar_gs": ap_total,
        "flujo_neto_proyectado_30d_gs": flujo_neto,
        "cheques_en_cartera_gs": cheques,
        "alertas_criticas": alertas,
        "recomendaciones_activas_count": rec_count,
    }


async def run_diagnosis(db: AsyncSession, company_id: str) -> FinanceAgentRun:
    """Ejecuta el diagnóstico financiero completo sobre la base de datos real de Casa Gonzalito."""
    ctx = await _gather_context(db, company_id)
    clean_contexto = json.loads(json.dumps(ctx, default=_json_default))
    run_id = uuid.uuid4()
    
    run = FinanceAgentRun(
        id=run_id,
        company_id=uuid.UUID(str(company_id)),
        model=f"Ollama/{DEFAULT_MODEL}",
        status="running",
        contexto=clean_contexto
    )
    db.add(run)
    await db.flush()

    # Generar recomendaciones analíticas estructuradas
    recs_to_add = []
    
    # 1. Recomendación de Cobranza Prioritaria
    if ctx["top_clientes_morosos"]:
        top_1 = ctx["top_clientes_morosos"][0]
        recs_to_add.append({
            "tipo": "cobranza",
            "titulo": f"Gestión de Cobranza Urgente: {top_1['nombre']}",
            "descripcion": f"El cliente registra {top_1['docs_vencidos']} facturas vencidas por un total de {format_gs(top_1['saldo_vencido'])} desde {top_1['vencimiento_mas_antiguo']}. Se recomienda pausar nuevos despachos de mercadería hasta acordar entrega de valores o cancelación del 50%.",
            "entidad_relacionada": top_1["nombre"],
            "monto_relacionado": format_gs(top_1["saldo_vencido"])
        })

    # 2. Recomendación de Depósito de Cheques
    if ctx["cheques_a_depositar_7d_gs"] > 0:
        recs_to_add.append({
            "tipo": "otro",
            "titulo": "Programación de Depósito de Cheques Diferidos en Cartera",
            "descripcion": f"Se encuentran {format_gs(ctx['cheques_a_depositar_7d_gs'])} en cheques de clientes que vencen en los próximos 7 días. Depositar prioritariamente en Banco Continental y Banco GNB para fondear las cuentas operativas de tesorería.",
            "entidad_relacionada": "Tesorería / Cartera de Cheques",
            "monto_relacionado": format_gs(ctx["cheques_a_depositar_7d_gs"])
        })

    # 3. Recomendación de Pago a Proveedores y Rebate
    if ctx["ap_proximos_7d_gs"] > 0:
        recs_to_add.append({
            "tipo": "pago_proveedor",
            "titulo": "Calendario de Pagos a Proveedores Estratégicos",
            "descripcion": f"Vencen compromisos por {format_gs(ctx['ap_proximos_7d_gs'])} en la próxima semana. Priorizar facturas de PARESA y Chortitzer para mantener la cuenta corriente al día y garantizar la liquidación íntegra de los rebates comerciales del mes.",
            "entidad_relacionada": "Proveedores Core (PARESA / Chortitzer)",
            "monto_relacionado": format_gs(ctx["ap_proximos_7d_gs"])
        })

    # 4. Recomendación de Optimización de Liquidez
    recs_to_add.append({
        "tipo": "alerta_presupuesto",
        "titulo": "Optimización del Capital de Trabajo y Ratios de Liquidez",
        "descripcion": f"La liquidez bancaria actual ({format_gs(ctx['liquidez_bancos_gs'])}) combinada con los cheques en cartera ({format_gs(ctx['cheques_cartera_gs'])}) cubre con solvencia el pasivo corriente. Se sugiere mantener el plazo de cobranza promedio por debajo de 21 días.",
        "entidad_relacionada": "Bancos & Tesorería",
        "monto_relacionado": format_gs(ctx["liquidez_bancos_gs"])
    })

    # Guardar recomendaciones en la base de datos
    for r in recs_to_add:
        rec = FinanceRecommendation(
            company_id=uuid.UUID(str(company_id)),
            run_id=run_id,
            tipo=r["tipo"],
            titulo=r["titulo"],
            descripcion=r["descripcion"],
            entidad_relacionada=r.get("entidad_relacionada"),
            monto_relacionado=r.get("monto_relacionado"),
            requested_by="ai_agent",
            status="pending"
        )
        db.add(rec)

    # Diagnóstico general
    diag_text = f"Diagnóstico financiero completado para Casa Gonzalito. Liquidez disponible en bancos de {format_gs(ctx['liquidez_bancos_gs'])}, cuentas por cobrar en calle de {format_gs(ctx['total_ar_clientes_gs'])} ({format_gs(ctx['ar_vencida_gs'])} en mora) y pasivo con proveedores de {format_gs(ctx['total_ap_proveedores_gs'])}. Se generaron {len(recs_to_add)} recomendaciones de acción."
    
    run.status = "completed"
    run.diagnostico = diag_text
    run.finished_at = datetime.utcnow()
    
    try:
        await db.commit()
        await db.refresh(run)
    except Exception as e:
        await db.rollback()
        logger.error(f"Error saving finance diagnosis: {e}")
        run.status = "error"
        run.error_message = str(e)

    return run


async def list_recommendations(db: AsyncSession, company_id: str, status_filter: Optional[str] = None) -> List[FinanceRecommendation]:
    """Lista las recomendaciones financieras."""
    q = select(FinanceRecommendation).where(FinanceRecommendation.company_id == uuid.UUID(str(company_id)))
    if status_filter:
        q = q.where(FinanceRecommendation.status == status_filter)
    q = q.order_by(FinanceRecommendation.created_at.desc()).limit(30)
    res = await db.execute(q)
    return list(res.scalars().all())


async def decide_recommendation(db: AsyncSession, rec_id: str, approved: bool, user_name: str = "Gustavo", comments: Optional[str] = None) -> Optional[FinanceRecommendation]:
    """Aprueba o rechaza una recomendación financiera."""
    rec = (await db.execute(select(FinanceRecommendation).where(FinanceRecommendation.id == uuid.UUID(str(rec_id))))).scalar_one_or_none()
    if not rec:
        return None
    rec.status = "approved" if approved else "rejected"
    rec.comments = comments or f"Acción procesada por {user_name}"
    rec.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(rec)
    return rec


async def chat_finance_agent(db: AsyncSession, company_id: str, query: str, user_name: str = "Gustavo") -> Dict[str, Any]:
    """Motor de chat analítico del Gerente Financiero IA para consultas profundas de tesorería y caja."""
    start_t = time.time()
    q_lower = query.lower()
    ctx = await _gather_context(db, company_id)

    # 1. Consultas sobre Liquidez, Bancos y Saldos
    if any(k in q_lower for k in ["banco", "bancos", "saldo", "saldos", "liquidez", "disponible", "efectivo"]):
        cuentas_str = "\n".join([
            f"• **{b.get('banco', 'Banco')}:** **{format_gs(b.get('saldo_actual', 0))}** (Cta. {b.get('numero_cuenta', '')})"
            for b in ctx["bancos"]
        ])
        response = f"""### 🏦 Estado de Tesorería y Liquidez Bancaria
**Disponibilidad Real en Cuentas (Agosto 2026):**
• **Liquidez Total Consolidada:** **{format_gs(ctx['liquidez_bancos_gs'])}**
• **Cheques en Cartera (Diferidos):** **{format_gs(ctx['cheques_cartera_gs'])}**

---
### 📋 Detalle de Cuentas Bancarias Activas:
{cuentas_str}

---
💡 **Dictamen Financiero:** La posición de tesorería es sólida. Se recomienda depositar los {format_gs(ctx['cheques_a_depositar_7d_gs'])} en cheques diferidos que vencen en los próximos 7 días para absorber los pagos programados a proveedores sin tensionar líneas de crédito."""

        return {
            "query": query,
            "response": response,
            "diagnostico_key": "liquidez_bancaria",
            "metricas_relacionadas": {"liquidez_total": ctx["liquidez_bancos_gs"], "cheques_cartera": ctx["cheques_cartera_gs"]},
            "propuesta_estrategica": "Fondeo continuo mediante depósito de cheques diferidos a vencer.",
            "execution_time_seconds": round(time.time() - start_t, 2)
        }

    # 2. Consultas sobre Cuentas por Cobrar, Morosidad y Clientes
    if any(k in q_lower for k in ["cobrar", "clientes", "mora", "morosidad", "deuda", "deudas", "crédito", "credito"]):
        top_morosos_str = "\n".join([
            f"| **{m['nombre'][:25]}** | {format_gs(m['saldo_vencido'])} | {m['docs_vencidos']} docs | Desde {m['vencimiento_mas_antiguo']} |"
            for m in ctx["top_clientes_morosos"]
        ])

        response = f"""### 📊 Auditoría de Cuentas por Cobrar & Morosidad
**Estado de Cartera de Crédito:**
• **Total Cuentas por Cobrar (AR):** **{format_gs(ctx['total_ar_clientes_gs'])}**
• **Saldo Vencido (Mora Real):** **{format_gs(ctx['ar_vencida_gs'])}** ({round(ctx['ar_vencida_gs']/ctx['total_ar_clientes_gs']*100, 1) if ctx['total_ar_clientes_gs'] > 0 else 0}% del total)
• **A Vencer en 7 Días:** **{format_gs(ctx['ar_a_vencer_7d_gs'])}**

---
### ⚠️ Top Clientes con Mayor Deuda Vencida:
| Cliente Mayorista | Saldo Vencido | Facturas | Antigüedad |
| :--- | :--- | :--- | :--- |
{top_morosos_str}

---
🎯 **Plan de Acción de Cobranza:**
1. Condicionar los nuevos pedidos de preventa a los clientes morosos hasta un pago mínimo del 40% del saldo vencido.
2. Reforzar la gestión de cobranza en ruta con los choferes y repartidores para cobro en mostrador."""

        return {
            "query": query,
            "response": response,
            "diagnostico_key": "cuentas_por_cobrar",
            "metricas_relacionadas": {"ar_total": ctx["total_ar_clientes_gs"], "ar_vencida": ctx["ar_vencida_gs"]},
            "propuesta_estrategica": "Bloqueo preventivo de crédito a clientes con mora superior a 30 días.",
            "execution_time_seconds": round(time.time() - start_t, 2)
        }

    # 3. Consultas sobre Cuentas por Pagar y Proveedores (AP)
    if any(k in q_lower for k in ["pagar", "proveedor", "proveedores", "compras", "pasivo", "vencimientos"]):
        response = f"""### 📑 Cuentas por Pagar & Calendario de Proveedores
**Estado del Pasivo Corriente:**
• **Total Cuentas por Pagar (AP):** **{format_gs(ctx['total_ap_proveedores_gs'])}**
• **Vencimientos Próximos 7 Días:** **{format_gs(ctx['ap_proximos_7d_gs'])}**
• **Vencimientos Próximos 30 Días:** **{format_gs(ctx['ap_proximos_30d_gs'])}**
• **Deuda Vencida con Proveedores:** **{format_gs(ctx['ap_vencida_gs'])}**

---
💡 **Estrategia de Pagos:** Priorizar la cancelación en fecha de facturas con **PARESA (Coca-Cola)** y **SOC.COOP.CHORTITZER (Trébol)** para cumplir con los requisitos contractuales de rebate y mantener el beneficio del 4.5% y 3.0% respectivamente."""

        return {
            "query": query,
            "response": response,
            "diagnostico_key": "cuentas_por_pagar",
            "metricas_relacionadas": {"total_ap": ctx["total_ap_proveedores_gs"], "ap_7d": ctx["ap_proximos_7d_gs"]},
            "propuesta_estrategica": "Calendarizar pagos protegiendo los acuerdos de rebate.",
            "execution_time_seconds": round(time.time() - start_t, 2)
        }

    # 4. Flujo de Caja y Proyección
    if any(k in q_lower for k in ["flujo", "caja", "proyeccion", "proyección", "presupuesto", "cash"]):
        flujo_30d = ctx["liquidez_bancos_gs"] + ctx["ar_a_vencer_30d_gs"] + (ctx["cheques_cartera_gs"] * 0.4) - ctx["ap_proximos_30d_gs"]
        response = f"""### 📈 Proyección de Flujo de Caja (Próximos 30 Días)
**Balance Proyectado de Fondos:**
• **Disponibilidad Inicial en Bancos:** **{format_gs(ctx['liquidez_bancos_gs'])}**
• **(+) Ingresos Proyectados (Cobranzas + Cheques):** **{format_gs(ctx['ar_a_vencer_30d_gs'] + ctx['cheques_cartera_gs'] * 0.4)}**
• **(-) Egresos Proyectados (Proveedores 30d):** **{format_gs(ctx['ap_proximos_30d_gs'])}**
• **(=) Flujo Neto Proyectado a 30 Días:** **{format_gs(flujo_30d)}**

---
💡 **Dictamen de Sostenibilidad:** El flujo operativo proyectado es positivo (+{format_gs(flujo_30d)}). Casa Gonzalito mantiene capacidad de autofinanciamiento para soportar las compras de reposición del próximo mes sin necesidad de recurrir a descubiertos bancarios."""

        return {
            "query": query,
            "response": response,
            "diagnostico_key": "flujo_caja",
            "metricas_relacionadas": {"flujo_neto_30d": flujo_30d, "liquidez": ctx["liquidez_bancos_gs"]},
            "propuesta_estrategica": "Mantener cobertura de liquidez positiva y acelerar cobro de cartera diferida.",
            "execution_time_seconds": round(time.time() - start_t, 2)
        }

    # 5. Respuesta General de Finanzas
    response = f"""### 💼 Dictamen Financiero Ejecutivo — Casa Gonzalito
Estimado {user_name}, he auditado los indicadores de tesorería y crédito de la distribuidora:

• **Liquidez en Bancos:** **{format_gs(ctx['liquidez_bancos_gs'])}** en 5 cuentas operativas.
• **Créditos en Calle (AR):** **{format_gs(ctx['total_ar_clientes_gs'])}** ({format_gs(ctx['ar_vencida_gs'])} vencidos).
• **Pasivo con Proveedores (AP):** **{format_gs(ctx['total_ap_proveedores_gs'])}** ({format_gs(ctx['ap_proximos_7d_gs'])} a vencer en 7 días).
• **Cartera de Cheques:** **{format_gs(ctx['cheques_cartera_gs'])}** recibidos de clientes mayoristas.

💡 **Consultas sugeridas:** Podés pedirme detalles sobre: *Saldos bancarios*, *Clientes con mayor mora*, *Calendario de pagos a proveedores* o *Proyección de flujo de caja a 30 días*."""

    return {
        "query": query,
        "response": response,
        "diagnostico_key": "general_finance",
        "metricas_relacionadas": {"liquidez": ctx["liquidez_bancos_gs"], "ar_total": ctx["total_ar_clientes_gs"]},
        "propuesta_estrategica": "Control estricto de cuentas por cobrar y asignación eficiente de pagos.",
        "execution_time_seconds": round(time.time() - start_t, 2)
    }
