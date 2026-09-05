"""Gerente de Marketing IA -- dashboard y chat sobre clientes/ventas/stock reales.

Antes esta pagina no tenia ningun modulo de backend: el chat, el mensaje de
bienvenida y las "campanas sugeridas" eran arrays hardcodeados en el
frontend (4.854 clientes, 42 VIP inactivos, montos de recaudacion --
ninguno real). Este modulo calcula todo eso sobre datos reales:
segmentacion RFM simple de customers+sales, y reutiliza la misma deteccion
de sobre-stock que ya usa finance_agent (misma fuente, sin duplicar SQL).
"""
from datetime import datetime, timezone

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.finance_agent.service import get_inter_agent_sync
from api.src.marketing_agent.schemas import (
    MarketingDashboard, CustomerSegment, CampaignSuggestion, ChatMessageResponse,
)

VIP_MIN_GASTO_GS = 500_000  # gasto historico total minimo para considerar "cliente frecuente/VIP"
DIAS_INACTIVIDAD = 15


async def _segmentos_reales(db: AsyncSession, company_id: str) -> dict:
    q = text("""
        SELECT
            s.customer_id,
            COUNT(*) as compras,
            SUM(s.total) as gasto_total,
            MAX(s.fecha) as ultima_compra
        FROM sales s
        WHERE s.company_id = :cid AND s.estado = 'confirmado' AND s.customer_id IS NOT NULL
        GROUP BY s.customer_id
    """)
    rows = (await db.execute(q, {"cid": company_id})).mappings().all()
    now = datetime.now(timezone.utc)

    total_clientes = len(rows)
    vip = [r for r in rows if float(r["gasto_total"] or 0) >= VIP_MIN_GASTO_GS]
    vip_inactivos = [
        r for r in vip
        if r["ultima_compra"] and (now - r["ultima_compra"]).days >= DIAS_INACTIVIDAD
    ]
    frecuentes = [r for r in rows if r["compras"] >= 3]

    return {
        "total_clientes": total_clientes,
        "vip": vip,
        "vip_inactivos": vip_inactivos,
        "frecuentes": frecuentes,
    }


async def get_marketing_dashboard(db: AsyncSession, company_id: str) -> MarketingDashboard:
    seg = await _segmentos_reales(db, company_id)
    sync = await get_inter_agent_sync(db, company_id)

    segmentos = [
        CustomerSegment(nombre="Clientes con compras registradas", cantidad=seg["total_clientes"], criterio=f"al menos 1 venta confirmada"),
        CustomerSegment(nombre="Frecuentes", cantidad=len(seg["frecuentes"]), criterio="3 o más compras históricas"),
        CustomerSegment(nombre="VIP (alto gasto histórico)", cantidad=len(seg["vip"]), criterio=f"gasto acumulado ≥ Gs. {VIP_MIN_GASTO_GS:,d}"),
        CustomerSegment(nombre="VIP inactivos", cantidad=len(seg["vip_inactivos"]), criterio=f"VIP sin compras en los últimos {DIAS_INACTIVIDAD} días"),
    ]

    campañas: list[CampaignSuggestion] = []
    if seg["vip_inactivos"]:
        campañas.append(CampaignSuggestion(
            id="reactivacion-vip",
            titulo="Reactivación de clientes VIP inactivos",
            segmento=f"{len(seg['vip_inactivos'])} clientes VIP sin compras en {DIAS_INACTIVIDAD}+ días",
            cantidad_clientes=len(seg["vip_inactivos"]),
            motivo=f"Gasto histórico acumulado combinado de estos clientes: Gs. {sum(float(r['gasto_total']) for r in seg['vip_inactivos']):,.0f}",
        ))
    if sync.oportunidades_flash_stock:
        top = sync.oportunidades_flash_stock[0]
        campañas.append(CampaignSuggestion(
            id=f"liquidacion-{top.product_id}",
            titulo=f"Combo/promo para liquidar {top.producto}",
            segmento="Clientes frecuentes de la categoría del producto",
            cantidad_clientes=len(seg["frecuentes"]),
            motivo=f"Gs. {top.monto_inmovilizado_gs:,.0f} inmovilizados en stock ({top.stock_actual:,.0f} unidades) -- mismo dato que usa el Gerente Financiero IA.",
        ))

    resumen = (
        f"{seg['total_clientes']} clientes con compras registradas, de los cuales {len(seg['vip'])} son VIP "
        f"por gasto histórico y {len(seg['vip_inactivos'])} de esos VIP no compran hace {DIAS_INACTIVIDAD}+ días."
    )

    return MarketingDashboard(
        segmentos=segmentos,
        campañas_sugeridas=campañas,
        resumen_ejecutivo=resumen,
    )


async def chat_with_marketing_agent(
    db: AsyncSession, company_id: str, message: str,
    conversation_history: list[dict] | None = None,
) -> ChatMessageResponse:
    """Responde consultando segmentos y stock reales en cada pregunta -- sin
    guiones fijos ni cifras de relleno (ver auditoria de sidebar: el chat
    anterior inventaba 4854 clientes, 42 VIP y montos de campaña)."""
    msg_lower = message.lower()
    seg = await _segmentos_reales(db, company_id)

    if "combo" in msg_lower or "sobre-stock" in msg_lower or "sobrestock" in msg_lower or "verduler" in msg_lower or "liquidar" in msg_lower:
        sync = await get_inter_agent_sync(db, company_id)
        if not sync.oportunidades_flash_stock:
            reply = "No encontré productos con sobre-stock significativo en este momento para armar un combo."
        else:
            top = sync.oportunidades_flash_stock[0]
            reply = (
                f"🥦 **Estrategia de liquidación con datos reales:**\n\n"
                f"- Producto con más capital inmovilizado: **{top.producto}** ({top.stock_actual:,.0f} unidades, Gs. {top.monto_inmovilizado_gs:,.0f}).\n"
                f"- Descuento sugerido: **{top.descuento_sugerido_pct:.0f}%**, recaudación estimada Gs. {top.recaudacion_estimada_gs:,.0f}.\n"
                f"- Alcance potencial: **{len(seg['frecuentes'])} clientes frecuentes** (3+ compras históricas).\n\n"
                f"¿Armamos la campaña para enviar por IntelliZapp a ese segmento?"
            )
        suggestions = ["¿Cuántos clientes VIP están inactivos?", "Ver margen y ROI real", "Otras oportunidades de stock"]

    elif "vip" in msg_lower or "reactivar" in msg_lower or "churn" in msg_lower or "abandon" in msg_lower or "inactiv" in msg_lower:
        if not seg["vip_inactivos"]:
            reply = f"No hay clientes VIP inactivos en este momento (de {len(seg['vip'])} VIP totales, todos compraron en los últimos {DIAS_INACTIVIDAD} días)."
        else:
            gasto_total = sum(float(r["gasto_total"]) for r in seg["vip_inactivos"])
            reply = (
                f"🌟 **Plan de reactivación (datos reales):**\n\n"
                f"- **{len(seg['vip_inactivos'])} clientes VIP** (gasto histórico ≥ Gs. {VIP_MIN_GASTO_GS:,d}) sin compras hace {DIAS_INACTIVIDAD}+ días.\n"
                f"- Gasto histórico combinado de este grupo: **Gs. {gasto_total:,.0f}**.\n"
                f"- Sugerencia: cupón personalizado vía IntelliZapp, dirigido a este segmento puntual.\n\n"
                f"¿Preparamos el envío?"
            )
        suggestions = ["Ver oportunidades de combo/sobre-stock", "¿Cuántos clientes frecuentes tenemos?", "Resumen general"]

    elif "margen" in msg_lower or "roi" in msg_lower or "financiero" in msg_lower:
        sync = await get_inter_agent_sync(db, company_id)
        reply = (
            f"📊 **Cruce con Finanzas (datos reales, misma fuente que el Gerente Financiero IA):**\n\n"
            f"- Margen bruto mínimo exigido: **{sync.meta_margen_minimo_exigido_pct}%**.\n"
            f"- Ventas proyectadas cierre de mes: **Gs. {sync.ventas_proyectadas_cierre_mes_gs:,.0f}**.\n"
            f"- Oportunidades de stock activas: **{len(sync.oportunidades_flash_stock)}**."
        )
        suggestions = ["Ver clientes VIP inactivos", "Ver oportunidades de combo", "Resumen general"]

    else:
        reply = (
            f"📌 {seg['total_clientes']} clientes con compras registradas, "
            f"**{len(seg['vip'])} VIP** por gasto histórico, de los cuales **{len(seg['vip_inactivos'])} están inactivos** "
            f"({DIAS_INACTIVIDAD}+ días sin comprar). "
            f"¿Querés que analicemos reactivación VIP, oportunidades de combo por sobre-stock, o el cruce de margen con Finanzas?"
        )
        suggestions = ["Reactivar clientes VIP inactivos", "Ver combo de sobre-stock", "Cruce de margen con Finanzas"]

    return ChatMessageResponse(reply=reply, suggested_prompts=suggestions)
