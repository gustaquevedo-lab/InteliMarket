"""Gerente de Riesgo IA -- dashboard y chat sobre eventos reales de audit_logs.

A diferencia de los otros 3 "agentes IA" del sistema (ventas, finanzas,
marketing), que responden con texto armado a mano y numeros fijos, este
chat consulta datos reales en cada pregunta -- no hay guiones ni cifras
hardcodeadas. Si el usuario menciona un cajero, una caja o un periodo,
se recalcula sobre la base real en ese momento.
"""
from collections import defaultdict
from datetime import datetime, timedelta, timezone

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.ai_agents_common import parse_periodo_dias
from api.src.risk_agent.schemas import (
    RiskDashboard, RiskEventItem, RiskByCajero, RiskTrendPoint,
    AccionDisponible, ChatMessageResponse,
)

NIVEL_PESO = {"BAJO": 1.0, "MEDIO": 1.5, "ALTO": 3.0}

ACCION_LABELS = {
    "descuento_directo_autorizado": "Descuento Directo en Caja",
    "supervisor_remove_item": "Anulación de Ítem / Producto",
    "supervisor_decrease_qty": "Disminución de Cantidad",
    "supervisor_clear_cart": "Vaciado de Carrito / Cancelación",
    "supervisor_process_return": "Devolución / Nota de Crédito",
    "supervisor_reopen_payment": "Reapertura de Cobro",
    "supervisor_reopen_invoice": "Reapertura de Factura",
    "supervisor_extra_club_payment": "Cobro Extra Club (Supervisor)",
    "supervisor_otros_payment": "Cobro Otros Medios (Supervisor)",
    "supervisor_open_pos_config": "Apertura Configuración POS",
    "cobro_aprobado_cancelado": "Cobro Aprobado Cancelado",
    "peso_discrepancia_detectada": "Discrepancia de Peso Detectada",
    "peso_resuelto_etiqueta_autorizado": "Autorización Peso Etiqueta",
    "peso_resuelto_balanza": "Corrección Balanza",
    "peso_discrepancia_cancelada": "Discrepancia Cancelada",
    "peso_etiqueta_verificado": "Verificación Peso Etiqueta",
    "peso_verificacion_pendiente": "Verificación Peso Pendiente",
    "venta_offline_rechazada": "Venta Offline Rechazada",
    "conteo_item_registrado": "Conteo de Ítem de Inventario",
    "conteo_sesion_finalizada": "Conteo Finalizado",
    "conteo_sesion_iniciada": "Conteo Iniciado",
    "divergencia_saldo_bancario_detectada": "Divergencia Saldo Bancario",
    "verificar_saldo_bancario": "Verificación Saldo Bancario",
    "corregir_saldo_bancario": "Corrección Saldo Bancario",
    "merma_registrada": "Merma Registrada",
    "merma_aprobada": "Merma Aprobada",
    "merma_rechazada": "Merma Rechazada",
    "diagnostico_pc": "Diagnóstico Hardware POS",
}


def _classify_event(accion: str, datos: dict) -> tuple[str, str, str, float | None, str, dict]:
    """Devuelve (nivel_riesgo, categoria_riesgo, descripcion, monto_gs, tipo_evento_label, detalles) para un evento real."""
    datos = datos or {}
    label = ACCION_LABELS.get(accion, accion.replace("_", " ").title())
    monto_gs: float | None = None
    detalles: dict = {}

    if accion == "descuento_directo_autorizado":
        motivo = datos.get("motivo", "")
        tipo = datos.get("tipo_descuento")
        val = datos.get("valor_descuento")
        monto_pyg = float(datos.get("monto_descuento_pyg") or 0)
        tot_con_desc = datos.get("total_con_descuento_pyg")
        monto_gs = monto_pyg
        detalles = {
            "tipo_descuento": tipo,
            "valor_descuento": val,
            "monto_descuento_pyg": monto_pyg,
            "total_con_descuento_pyg": float(tot_con_desc) if tot_con_desc is not None else None,
            "motivo": motivo,
            "caja": datos.get("caja"),
            "cajero_nombre": datos.get("cajero_nombre"),
            "autorizado_por_nombre": datos.get("autorizado_por_nombre"),
        }
        
        monto_fmt = f"{int(monto_pyg):,}".replace(",", ".")
        if tipo == "percentage":
            desc = f"Descuento {val}% (-₲ {monto_fmt})"
        else:
            desc = f"Descuento fijo (-₲ {monto_fmt})"
        if tot_con_desc is not None:
            tot_fmt = f"{int(float(tot_con_desc)):,}".replace(",", ".")
            desc += f" · Total venta: ₲ {tot_fmt}"
        if motivo:
            desc += f" · Motivo: {motivo}"

        return (
            datos.get("nivel_riesgo", "ALTO").replace("ALTO_RIESGO_FINANCIERO", "ALTO"),
            "financiero",
            desc,
            monto_gs,
            "Descuento Directo en Caja",
            detalles,
        )

    if accion.startswith("supervisor_"):
        desc = datos.get("descripcion", accion.replace("supervisor_", "").replace("_", " ").capitalize())
        return (
            datos.get("nivel_riesgo", "MEDIO"),
            datos.get("categoria_riesgo", "operativo"),
            desc,
            None,
            label,
            {"motivo": datos.get("motivo") or desc, "caja": datos.get("caja")},
        )

    if accion == "cobro_aprobado_cancelado":
        monto = float(datos.get("total_venta_pyg") or 0)
        monto_fmt = f"{int(monto):,}".replace(",", ".")
        desc = f"Cobro aprobado cancelado en caja (Total venta: ₲ {monto_fmt})"
        return (
            "ALTO",
            "financiero",
            desc,
            monto,
            label,
            {"monto_total_pyg": monto, "caja": datos.get("caja")},
        )

    if accion == "peso_discrepancia_detectada":
        dif = float(datos.get("diferencia_g") or 0)
        tol = float(datos.get("tolerancia_g") or 1) or 1
        ratio = dif / tol
        nivel = "ALTO" if ratio >= 3 else "MEDIO" if ratio >= 1.5 else "BAJO"
        prod = datos.get("producto_nombre", "producto")
        desc = f"Discrepancia de peso en {prod}: etiqueta {datos.get('etiqueta_kg')}kg vs balanza {datos.get('balanza_kg')}kg (dif. {dif:.0f}g, tol. {tol:.0f}g)"
        return (
            nivel,
            "inventario",
            desc,
            None,
            label,
            {"producto": prod, "diferencia_g": dif, "tolerancia_g": tol, "caja": datos.get("caja")},
        )

    if accion == "peso_resuelto_etiqueta_autorizado":
        prod = datos.get("producto_nombre", "producto")
        desc = f"Supervisor autorizó usar peso de etiqueta en {prod} pese a la discrepancia con balanza"
        return "MEDIO", "inventario", desc, None, label, {"producto": prod, "caja": datos.get("caja")}

    if accion in ("peso_etiqueta_verificado", "peso_resuelto_balanza", "peso_verificacion_pendiente", "peso_discrepancia_cancelada"):
        prod = datos.get("producto_nombre", "")
        desc = f"{label}{f': {prod}' if prod else ''}"
        return "BAJO", "inventario", desc, None, label, {"producto": prod, "caja": datos.get("caja")}

    if accion == "divergencia_saldo_bancario_detectada":
        return "ALTO", "financiero", "Divergencia detectada entre saldo bancario real y registrado", None, label, {}

    if accion in ("verificar_saldo_bancario", "corregir_saldo_bancario"):
        return "MEDIO", "financiero", label, None, label, {}

    if accion == "venta_offline_rechazada":
        tot = float(datos.get("total") or 0)
        tot_fmt = f"{int(tot):,}".replace(",", ".")
        err = datos.get("error", "Error de sincronización")
        desc = f"Venta offline rechazada (₲ {tot_fmt}): {err}"
        return "ALTO", "operativo", desc, tot, label, {"error": err, "total": tot}

    return "BAJO", "operativo", label, None, label, {}


def _extract_actor(accion: str, datos: dict, user_nombre: str | None = None) -> tuple[str | None, str | None, str | None, str]:
    """(cajero, caja, autorizado_por, usuario_principal)"""
    datos = datos or {}
    cajero = datos.get("cajero") or datos.get("cajero_nombre")
    caja = datos.get("caja")
    autorizado_por = datos.get("autorizado_por") or datos.get("autorizado_por_nombre")
    usuario_principal = cajero or user_nombre or autorizado_por or "Sistema"
    return cajero, caja, autorizado_por, usuario_principal


async def _fetch_events(
    db: AsyncSession,
    company_id: str,
    dias: int,
    usuario: str | None = None,
    accion: str | None = None,
    solo_descuentos: bool = False,
    cajero: str | None = None,
    limit: int | None = None,
    offset: int = 0,
) -> list[dict]:
    since = datetime.now(timezone.utc) - timedelta(days=dias)
    clauses = ["a.company_id = :cid", "a.created_at >= :since"]
    params: dict = {"cid": company_id, "since": since}

    if solo_descuentos:
        clauses.append("a.accion = 'descuento_directo_autorizado'")
    elif accion and accion.strip() and accion.upper() != "ALL":
        clauses.append("a.accion = :accion")
        params["accion"] = accion.strip()

    if usuario and usuario.strip() and usuario.upper() != "ALL":
        u_val = f"%{usuario.strip()}%"
        clauses.append("""(
            a.datos_nuevos->>'cajero_nombre' ILIKE :u
            OR a.datos_nuevos->>'cajero' ILIKE :u
            OR a.datos_nuevos->>'autorizado_por_nombre' ILIKE :u
            OR a.datos_nuevos->>'autorizado_por' ILIKE :u
            OR u.nombre ILIKE :u
        )""")
        params["u"] = u_val

    if cajero and cajero.strip() and cajero.upper() != "ALL":
        c_val = f"%{cajero.strip()}%"
        clauses.append("""(
            a.datos_nuevos->>'cajero_nombre' ILIKE :caj
            OR a.datos_nuevos->>'cajero' ILIKE :caj
        )""")
        params["caj"] = c_val

    where_sql = " AND ".join(clauses)
    query_str = f"""
        SELECT 
            a.id, a.accion, a.entidad, a.datos_nuevos, a.created_at,
            a.user_id, u.nombre as user_nombre, u.email as user_email
        FROM audit_logs a
        LEFT JOIN users u ON u.id = a.user_id
        WHERE {where_sql}
        ORDER BY a.created_at DESC
    """
    if limit is not None:
        query_str += " LIMIT :limit OFFSET :offset"
        params["limit"] = limit
        params["offset"] = offset

    result = await db.execute(text(query_str), params)
    rows = []
    for r in result.mappings().all():
        rows.append(dict(r))
    return rows


def _classified(rows: list[dict]) -> list[dict]:
    out = []
    for row in rows:
        nivel, categoria, desc, monto_gs, tipo_label, detalles = _classify_event(
            row["accion"], row.get("datos_nuevos")
        )
        cajero, caja, autorizado_por, usuario_principal = _extract_actor(
            row["accion"], row.get("datos_nuevos"), row.get("user_nombre")
        )
        out.append({
            **row,
            "nivel_riesgo": nivel,
            "categoria_riesgo": categoria,
            "descripcion": desc,
            "tipo_evento_label": tipo_label,
            "monto_gs": monto_gs,
            "detalles": detalles,
            "cajero": cajero,
            "caja": caja,
            "autorizado_por": autorizado_por,
            "usuario": usuario_principal,
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
        tipo_evento_label=e.get("tipo_evento_label"),
        cajero=e.get("cajero"),
        caja=e.get("caja"),
        autorizado_por=e.get("autorizado_por"),
        usuario=e.get("usuario"),
        usuario_nombre=e.get("user_nombre"),
        monto_gs=e.get("monto_gs"),
        detalles=e.get("detalles"),
        created_at=e["created_at"].isoformat() if e.get("created_at") else "",
    )


async def get_risk_dashboard(db: AsyncSession, company_id: str, dias: int = 30) -> RiskDashboard:
    raw_rows = await _fetch_events(db, company_id, dias)
    rows = _classified(raw_rows)

    total_alto = sum(1 for e in rows if e["nivel_riesgo"] == "ALTO")
    total_medio = sum(1 for e in rows if e["nivel_riesgo"] == "MEDIO")
    total_bajo = sum(1 for e in rows if e["nivel_riesgo"] == "BAJO")

    total_descuentos = sum(1 for e in rows if e["accion"] == "descuento_directo_autorizado")
    monto_total_descuentos = sum(
        (e.get("monto_gs") or 0.0) for e in rows if e["accion"] == "descuento_directo_autorizado"
    )

    por_categoria: dict[str, int] = defaultdict(int)
    por_accion: dict[str, int] = defaultdict(int)
    por_cajero: dict[str, dict] = defaultdict(lambda: {"total": 0, "alto": 0, "medio": 0, "bajo": 0})
    por_dia: dict[str, dict] = defaultdict(lambda: {"total": 0, "alto": 0, "medio": 0, "bajo": 0})

    usuarios_set: set[str] = set()

    for e in rows:
        por_categoria[e["categoria_riesgo"]] += 1
        por_accion[e["accion"]] += 1
        
        caj = e.get("cajero")
        if caj:
            c = por_cajero[caj]
            c["total"] += 1
            c[e["nivel_riesgo"].lower()] += 1
            usuarios_set.add(caj)

        aut = e.get("autorizado_por")
        if aut:
            usuarios_set.add(aut)

        u_nom = e.get("user_nombre")
        if u_nom:
            usuarios_set.add(u_nom)

        u_prin = e.get("usuario")
        if u_prin and u_prin != "Sistema":
            usuarios_set.add(u_prin)

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
    eventos_descuento = [_to_item(e) for e in rows if e["accion"] == "descuento_directo_autorizado"][:20]

    acciones_disponibles = [
        AccionDisponible(
            accion=acc,
            label=ACCION_LABELS.get(acc, acc.replace("_", " ").title()),
            total=cnt,
        )
        for acc, cnt in sorted(por_accion.items(), key=lambda x: -x[1])
    ]

    usuarios_disponibles = sorted(list(usuarios_set))

    if not rows:
        resumen = f"Sin eventos de auditoría registrados en los últimos {dias} días."
    else:
        top_cat = max(por_categoria.items(), key=lambda x: x[1])[0] if por_categoria else "sin datos"
        resumen = (
            f"En los últimos {dias} días se registraron {len(rows)} eventos auditados: "
            f"{total_alto} de riesgo alto, {total_medio} medio, {total_bajo} bajo. "
            f"La categoría predominante es {top_cat}."
        )
        if total_descuentos > 0:
            monto_fmt = f"{int(monto_total_descuentos):,}".replace(",", ".")
            resumen += f" Se autorizaron {total_descuentos} descuentos directos en caja por un total de ₲\u00A0{monto_fmt}."
        if top_cajeros:
            lider = top_cajeros[0]
            resumen += f" {lider.cajero} concentra el mayor score de riesgo ({lider.score_riesgo}, {lider.eventos_alto} de nivel alto)."

    return RiskDashboard(
        periodo_dias=dias,
        total_eventos=len(rows),
        total_alto=total_alto,
        total_medio=total_medio,
        total_bajo=total_bajo,
        total_descuentos=total_descuentos,
        monto_total_descuentos_pyg=monto_total_descuentos,
        por_categoria=dict(por_categoria),
        por_accion=dict(por_accion),
        acciones_disponibles=acciones_disponibles,
        usuarios_disponibles=usuarios_disponibles,
        top_cajeros_riesgo=top_cajeros,
        tendencia=tendencia,
        eventos_recientes_alto=eventos_alto,
        eventos_recientes_descuento=eventos_descuento,
        resumen_ejecutivo=resumen,
    )


async def list_risk_events(
    db: AsyncSession, company_id: str, dias: int = 30,
    nivel: str | None = None, categoria: str | None = None,
    cajero: str | None = None, usuario: str | None = None,
    accion: str | None = None, solo_descuentos: bool = False,
    limit: int = 100, offset: int = 0,
) -> list[RiskEventItem]:
    sql_limit = limit if (not nivel and not categoria) else max(limit * 3, 500)
    sql_offset = offset if (not nivel and not categoria) else 0

    raw_rows = await _fetch_events(
        db, company_id, dias,
        usuario=usuario, accion=accion, solo_descuentos=solo_descuentos, cajero=cajero,
        limit=sql_limit, offset=sql_offset,
    )
    rows = _classified(raw_rows)

    if nivel and nivel.upper() != "ALL":
        rows = [e for e in rows if e["nivel_riesgo"] == nivel.upper()]
    if categoria and categoria.lower() != "all":
        rows = [e for e in rows if e["categoria_riesgo"] == categoria.lower()]

    if (nivel and nivel.upper() != "ALL") or (categoria and categoria.lower() != "all"):
        rows = rows[offset:offset + limit]

    return [_to_item(e) for e in rows]


async def chat_with_risk_agent(
    db: AsyncSession, company_id: str, message: str,
    conversation_history: list[dict] | None = None,
) -> ChatMessageResponse:
    """Responde consultando datos reales en cada pregunta -- sin guiones fijos."""
    msg_upper = message.upper()
    dias = parse_periodo_dias(msg_upper)
    dash = await get_risk_dashboard(db, company_id, dias)

    # ¿Menciona a un cajero especifico?
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

    elif "DESCUENTO" in msg_upper or "REBAJA" in msg_upper:
        if not dash.eventos_recientes_descuento:
            reply = f"No se registraron descuentos directos autorizados en los últimos {dias} días."
        else:
            monto_fmt = f"{int(dash.monto_total_descuentos_pyg):,}".replace(",", ".")
            lineas = "\n".join(
                f"- **{e.cajero or 'Caja'}**: {e.descripcion} (Autorizó: {e.autorizado_por or '—'}, {e.created_at[:16]})"
                for e in dash.eventos_recientes_descuento[:8]
            )
            reply = (
                f"🏷️ **Descuentos Directos Autorizados en Caja** (últimos {dias} días):\n\n"
                f"- Total de eventos: **{dash.total_descuentos}**\n"
                f"- Monto total descontado: **₲\u00A0{monto_fmt}**\n\n"
                f"**Últimos registros:**\n{lineas}"
            )
        prompts = ["¿Quién autorizó más descuentos?", "Ver solo riesgo alto", "Top cajeros por riesgo"]

    elif "QUIEN" in msg_upper or "QUIÉN" in msg_upper or "RANKING" in msg_upper or "MAS RIESGO" in msg_upper or "MÁS RIESGO" in msg_upper:
        if not dash.top_cajeros_riesgo:
            reply = f"No hay eventos con cajero identificado en los últimos {dias} días."
        else:
            lineas = "\n".join(
                f"{i+1}. **{c.cajero}** — score {c.score_riesgo} ({c.eventos_alto} alto / {c.eventos_medio} medio / {c.eventos_bajo} bajo)"
                for i, c in enumerate(dash.top_cajeros_riesgo[:5])
            )
            reply = f"🏆 **Ranking de riesgo por cajero** (últimos {dias} días):\n\n{lineas}"
        prompts = ["Ver el detalle del primero", "¿Qué categorías predominan?", "Ver descuentos en caja"]

    elif "CATEGORIA" in msg_upper or "CATEGORÍA" in msg_upper or "TIPO" in msg_upper:
        if not dash.por_categoria:
            reply = f"No hay eventos clasificados en los últimos {dias} días."
        else:
            lineas = "\n".join(f"- **{cat}**: {n} eventos" for cat, n in sorted(dash.por_categoria.items(), key=lambda x: -x[1]))
            reply = f"📊 **Eventos por categoría** (últimos {dias} días):\n\n{lineas}"
        prompts = ["¿Quién tiene más riesgo?", "Ver eventos de descuento", "Resumen general"]

    elif "ALTO" in msg_upper and ("RIESGO" in msg_upper or "EVENTO" in msg_upper):
        if not dash.eventos_recientes_alto:
            reply = f"Sin eventos de riesgo alto en los últimos {dias} días. Buena señal."
        else:
            lineas = "\n".join(f"- {e.descripcion} ({e.cajero or 'sin cajero'}, {e.created_at[:10]})" for e in dash.eventos_recientes_alto[:8])
            reply = f"🔴 **Eventos de riesgo alto** (últimos {dias} días):\n\n{lineas}"
        prompts = ["¿Quién concentra estos eventos?", "Ver descuentos autorizados", "¿Qué categoría predomina?"]

    else:
        reply = f"📌 **Resumen de riesgo** (últimos {dias} días):\n\n{dash.resumen_ejecutivo}"
        prompts = ["Ver descuentos en caja", "¿Quién tiene más riesgo?", "Ver eventos de riesgo alto"]

    return ChatMessageResponse(reply=reply, suggested_prompts=prompts)
