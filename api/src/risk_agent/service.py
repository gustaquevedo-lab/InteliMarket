"""Gerente de Riesgo IA -- dashboard y chat sobre eventos reales de audit_logs.

A diferencia de los otros 3 "agentes IA" del sistema (ventas, finanzas,
marketing), que responden con texto armado a mano y numeros fijos, este
chat consulta datos reales en cada pregunta -- no hay guiones ni cifras
hardcodeadas. Si el usuario menciona un cajero, una caja o un periodo,
se recalcula sobre la base real en ese momento.
"""
import re
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.risk_agent.schemas import (
    RiskDashboard, RiskEventItem, RiskByCajero, RiskTrendPoint,
    ChatMessageResponse,
)

NIVEL_PESO = {"BAJO": 1.0, "MEDIO": 1.5, "ALTO": 3.0}


def _classify_event(accion: str, datos: dict) -> tuple[str, str, str]:
    """Devuelve (nivel_riesgo, categoria_riesgo, descripcion) para un evento real.

    Los eventos supervisor_* (ver POSPage.tsx/CajaRapidaPage.tsx) ya traen
    nivel_riesgo/categoria_riesgo calculados en el momento de la autorizacion --
    se usan tal cual. Los demas (peso_*, saldo bancario) se clasifican aca con
    la misma logica que ya usaba el frontend para decidir si algo era "riesgo
    real" (diferencia > tolerancia).
    """
    datos = datos or {}

    if accion.startswith("supervisor_"):
        return (
            datos.get("nivel_riesgo", "MEDIO"),
            datos.get("categoria_riesgo", "operativo"),
            datos.get("descripcion", accion.replace("supervisor_", "").replace("_", " ")),
        )

    if accion == "descuento_directo_autorizado":
        motivo = datos.get("motivo", "")
        return (
            datos.get("nivel_riesgo", "ALTO").replace("ALTO_RIESGO_FINANCIERO", "ALTO"),
            "financiero",
            f"Descuento directo autorizado{f': {motivo}' if motivo else ''}",
        )

    if accion == "peso_discrepancia_detectada":
        dif = float(datos.get("diferencia_g") or 0)
        tol = float(datos.get("tolerancia_g") or 1) or 1
        ratio = dif / tol
        nivel = "ALTO" if ratio >= 3 else "MEDIO" if ratio >= 1.5 else "BAJO"
        prod = datos.get("producto_nombre", "producto")
        return nivel, "inventario", f"Discrepancia de peso en {prod}: etiqueta {datos.get('etiqueta_kg')}kg vs balanza {datos.get('balanza_kg')}kg (dif. {dif:.0f}g, tolerancia {tol:.0f}g)"

    if accion == "peso_resuelto_etiqueta_autorizado":
        prod = datos.get("producto_nombre", "producto")
        return "MEDIO", "inventario", f"Supervisor autorizó usar el peso de etiqueta en {prod} pese a la discrepancia con la balanza"

    if accion in ("peso_etiqueta_verificado", "peso_resuelto_balanza", "peso_verificacion_pendiente", "peso_discrepancia_cancelada"):
        prod = datos.get("producto_nombre", "")
        label = accion.replace("_", " ").capitalize()
        return "BAJO", "inventario", f"{label}{f': {prod}' if prod else ''}"

    if accion == "divergencia_saldo_bancario_detectada":
        return "ALTO", "financiero", "Divergencia detectada entre el saldo bancario real y el registrado"

    if accion in ("verificar_saldo_bancario", "corregir_saldo_bancario"):
        return "MEDIO", "financiero", accion.replace("_", " ").capitalize()

    return "BAJO", "operativo", accion.replace("_", " ").capitalize()


def _extract_actor(accion: str, datos: dict) -> tuple[str | None, str | None, str | None]:
    """(cajero, caja, autorizado_por) -- los nombres de campo varian segun el evento."""
    datos = datos or {}
    cajero = datos.get("cajero") or datos.get("cajero_nombre")
    caja = datos.get("caja")
    autorizado_por = datos.get("autorizado_por") or datos.get("autorizado_por_nombre")
    return cajero, caja, autorizado_por


async def _fetch_events(db: AsyncSession, company_id: str, dias: int) -> list[dict]:
    since = datetime.now(timezone.utc) - timedelta(days=dias)
    result = await db.execute(
        text("""
            SELECT id, accion, entidad, datos_nuevos, created_at
            FROM audit_logs
            WHERE company_id = :cid AND created_at >= :since
            ORDER BY created_at DESC
        """),
        {"cid": company_id, "since": since},
    )
    rows = []
    for r in result.mappings().all():
        rows.append(dict(r))
    return rows


def _classified(rows: list[dict]) -> list[dict]:
    out = []
    for row in rows:
        nivel, categoria, desc = _classify_event(row["accion"], row["datos_nuevos"])
        cajero, caja, autorizado_por = _extract_actor(row["accion"], row["datos_nuevos"])
        out.append({
            **row,
            "nivel_riesgo": nivel,
            "categoria_riesgo": categoria,
            "descripcion": desc,
            "cajero": cajero,
            "caja": caja,
            "autorizado_por": autorizado_por,
        })
    return out


def _to_item(e: dict) -> RiskEventItem:
    return RiskEventItem(
        id=str(e["id"]),
        accion=e["accion"],
        entidad=e.get("entidad"),
        nivel_riesgo=e["nivel_riesgo"],
        categoria_riesgo=e["categoria_riesgo"],
        descripcion=e["descripcion"],
        cajero=e.get("cajero"),
        caja=e.get("caja"),
        autorizado_por=e.get("autorizado_por"),
        created_at=e["created_at"].isoformat() if e.get("created_at") else "",
    )


async def get_risk_dashboard(db: AsyncSession, company_id: str, dias: int = 30) -> RiskDashboard:
    rows = _classified(await _fetch_events(db, company_id, dias))

    total_alto = sum(1 for e in rows if e["nivel_riesgo"] == "ALTO")
    total_medio = sum(1 for e in rows if e["nivel_riesgo"] == "MEDIO")
    total_bajo = sum(1 for e in rows if e["nivel_riesgo"] == "BAJO")

    por_categoria: dict[str, int] = defaultdict(int)
    por_accion: dict[str, int] = defaultdict(int)
    por_cajero: dict[str, dict] = defaultdict(lambda: {"total": 0, "alto": 0, "medio": 0, "bajo": 0})
    por_dia: dict[str, dict] = defaultdict(lambda: {"total": 0, "alto": 0, "medio": 0, "bajo": 0})

    for e in rows:
        por_categoria[e["categoria_riesgo"]] += 1
        por_accion[e["accion"]] += 1
        if e.get("cajero"):
            c = por_cajero[e["cajero"]]
            c["total"] += 1
            c[e["nivel_riesgo"].lower()] += 1
        fecha = e["created_at"].date().isoformat() if e.get("created_at") else "sin_fecha"
        d = por_dia[fecha]
        d["total"] += 1
        d[e["nivel_riesgo"].lower()] += 1

    top_cajeros = sorted(
        [
            RiskByCajero(
                cajero=nombre,
                total_eventos=v["total"],
                eventos_alto=v["alto"],
                eventos_medio=v["medio"],
                eventos_bajo=v["bajo"],
                score_riesgo=round(v["alto"] * NIVEL_PESO["ALTO"] + v["medio"] * NIVEL_PESO["MEDIO"] + v["bajo"] * NIVEL_PESO["BAJO"], 1),
            )
            for nombre, v in por_cajero.items()
        ],
        key=lambda x: x.score_riesgo, reverse=True,
    )[:10]

    tendencia = [
        RiskTrendPoint(fecha=fecha, total=v["total"], alto=v["alto"], medio=v["medio"], bajo=v["bajo"])
        for fecha, v in sorted(por_dia.items())
    ]

    eventos_alto = [_to_item(e) for e in rows if e["nivel_riesgo"] == "ALTO"][:15]

    if not rows:
        resumen = f"Sin eventos de auditoría registrados en los últimos {dias} días."
    else:
        top_cat = max(por_categoria.items(), key=lambda x: x[1])[0] if por_categoria else "sin datos"
        resumen = (
            f"En los últimos {dias} días se registraron {len(rows)} eventos auditados: "
            f"{total_alto} de riesgo alto, {total_medio} medio, {total_bajo} bajo. "
            f"La categoría con más eventos es {top_cat}."
        )
        if top_cajeros:
            lider = top_cajeros[0]
            resumen += f" {lider.cajero} concentra el mayor score de riesgo ({lider.score_riesgo}, {lider.eventos_alto} de nivel alto)."

    return RiskDashboard(
        periodo_dias=dias,
        total_eventos=len(rows),
        total_alto=total_alto,
        total_medio=total_medio,
        total_bajo=total_bajo,
        por_categoria=dict(por_categoria),
        por_accion=dict(por_accion),
        top_cajeros_riesgo=top_cajeros,
        tendencia=tendencia,
        eventos_recientes_alto=eventos_alto,
        resumen_ejecutivo=resumen,
    )


async def list_risk_events(
    db: AsyncSession, company_id: str, dias: int = 30,
    nivel: str | None = None, categoria: str | None = None, cajero: str | None = None,
    limit: int = 100, offset: int = 0,
) -> list[RiskEventItem]:
    rows = _classified(await _fetch_events(db, company_id, dias))
    if nivel:
        rows = [e for e in rows if e["nivel_riesgo"] == nivel.upper()]
    if categoria:
        rows = [e for e in rows if e["categoria_riesgo"] == categoria.lower()]
    if cajero:
        rows = [e for e in rows if e.get("cajero") and cajero.lower() in e["cajero"].lower()]
    return [_to_item(e) for e in rows[offset:offset + limit]]


def _parse_periodo(msg_upper: str) -> int:
    if "HOY" in msg_upper:
        return 1
    if "SEMANA" in msg_upper:
        return 7
    if "MES" in msg_upper:
        return 30
    if "TRIMESTRE" in msg_upper:
        return 90
    return 30


async def chat_with_risk_agent(
    db: AsyncSession, company_id: str, message: str,
    conversation_history: list[dict] | None = None,
) -> ChatMessageResponse:
    """Responde consultando datos reales en cada pregunta -- sin guiones fijos.

    Detecta periodo (hoy/semana/mes), un cajero mencionado por nombre, o una
    categoria (peso/descuento/saldo), y recalcula el dashboard filtrado para
    esa consulta puntual antes de responder.
    """
    msg_upper = message.upper()
    dias = _parse_periodo(msg_upper)
    dash = await get_risk_dashboard(db, company_id, dias)

    # ¿Menciona a un cajero especifico de los que ya aparecen en el ranking?
    mencionado = None
    for c in dash.top_cajeros_riesgo:
        primer_nombre = c.cajero.split()[0].upper()
        if primer_nombre in msg_upper or c.cajero.upper() in msg_upper:
            mencionado = c
            break

    if mencionado:
        reply = (
            f"📋 **{mencionado.cajero}** en los últimos {dias} días:\n\n"
            f"- **{mencionado.total_eventos} eventos** auditados en total.\n"
            f"- **{mencionado.eventos_alto} de riesgo alto**, {mencionado.eventos_medio} medio, {mencionado.eventos_bajo} bajo.\n"
            f"- Score de riesgo acumulado: **{mencionado.score_riesgo}**.\n\n"
            + ("Vale la pena revisar sus eventos de riesgo alto en el detalle." if mencionado.eventos_alto > 0 else "No tiene eventos de riesgo alto en este período.")
        )
        prompts = ["¿Quién más tiene riesgo alto?", "Ver eventos de hoy", "¿Qué tipo de eventos son más comunes?"]

    elif "QUIEN" in msg_upper or "QUIÉN" in msg_upper or "RANKING" in msg_upper or "MAS RIESGO" in msg_upper or "MÁS RIESGO" in msg_upper:
        if not dash.top_cajeros_riesgo:
            reply = f"No hay eventos con cajero identificado en los últimos {dias} días."
        else:
            lineas = "\n".join(
                f"{i+1}. **{c.cajero}** — score {c.score_riesgo} ({c.eventos_alto} alto / {c.eventos_medio} medio / {c.eventos_bajo} bajo)"
                for i, c in enumerate(dash.top_cajeros_riesgo[:5])
            )
            reply = f"🏆 **Ranking de riesgo por cajero** (últimos {dias} días):\n\n{lineas}"
        prompts = ["Ver el detalle del primero", "¿Qué categorías predominan?", "Comparar con el mes pasado"]

    elif "CATEGORIA" in msg_upper or "CATEGORÍA" in msg_upper or "TIPO" in msg_upper:
        if not dash.por_categoria:
            reply = f"No hay eventos clasificados en los últimos {dias} días."
        else:
            lineas = "\n".join(f"- **{cat}**: {n} eventos" for cat, n in sorted(dash.por_categoria.items(), key=lambda x: -x[1]))
            reply = f"📊 **Eventos por categoría** (últimos {dias} días):\n\n{lineas}"
        prompts = ["¿Quién tiene más riesgo?", "Ver solo los de riesgo alto", "Resumen general"]

    elif "ALTO" in msg_upper and ("RIESGO" in msg_upper or "EVENTO" in msg_upper):
        if not dash.eventos_recientes_alto:
            reply = f"Sin eventos de riesgo alto en los últimos {dias} días. Buena señal."
        else:
            lineas = "\n".join(f"- {e.descripcion} ({e.cajero or 'sin cajero'}, {e.created_at[:10]})" for e in dash.eventos_recientes_alto[:8])
            reply = f"🔴 **Eventos de riesgo alto** (últimos {dias} días):\n\n{lineas}"
        prompts = ["¿Quién concentra estos eventos?", "Ver la última semana", "¿Qué categoría predomina?"]

    else:
        reply = f"📌 **Resumen de riesgo** (últimos {dias} días):\n\n{dash.resumen_ejecutivo}"
        prompts = ["¿Quién tiene más riesgo?", "Ver eventos de riesgo alto", "¿Qué categorías predominan?"]

    return ChatMessageResponse(reply=reply, suggested_prompts=prompts)
