"""Gerente de Marketing IA (CMO Virtual) -- Inteligencia Híbrida, RFM Real y Sincronización Tripartita.

Opera 100% sobre la base de datos de Extra Supermercado:
- 7.856 clientes en cupones_clientes con teléfono, documento y barrio.
- 278.020 líneas de consumo en cupon_ticket_items para detección de productos favoritos.
- Conexión viva con el CFO Virtual (sobre-stock y piso de margen) y el Copiloto Comercial (CSO).
- Impacto real en cajas físicas vía tabla promotions.
- Memoria corporativa permanente en company_business_rules.
"""

from datetime import datetime, timezone, date, timedelta
from decimal import Decimal
import json
import logging
import uuid
import zoneinfo
from typing import Optional, List, Dict, Any

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.finance_agent.service import get_inter_agent_sync, get_liquidity_control_tower
from api.src.marketing_agent.schemas import (
    CustomerSegment, CampaignSuggestion, CustomerProfileDetail, TopProductHabit,
    TripartiteSyncResponse, DirectiveItem, MarketingDashboard, LearnedRuleItem,
    PromotionPulseItem
)

logger = logging.getLogger("cmo_marketing_service")
PARAGUAY_TZ = zoneinfo.ZoneInfo("America/Asuncion")

VIP_MIN_GASTO_GS = 1_500_000  # Gs. 1.5M gasto acumulado para VIP en retail
DIAS_CHURN_RIESGO = 20        # > 20 días sin comprar en retail = riesgo de fuga


async def get_real_rfm_segments(db: AsyncSession, company_id: str) -> Dict[str, Any]:
    """Calcula la segmentación RFM viva sobre cupones_clientes y sales de Extra Supermercado."""
    now = datetime.now(PARAGUAY_TZ)
    
    # 1. Agregado de cupones_clientes con compras y último consumo
    q = text("""
        SELECT 
            id,
            documento,
            nombre,
            telefono,
            barrio,
            ciudad,
            COALESCE(ticket_promedio, 0) as ticket_promedio,
            COALESCE(total_gastado, 0) as total_gastado,
            COALESCE(cantidad_compras, 0) as cantidad_compras,
            ultimo_consumo
        FROM cupones_clientes
        WHERE company_id = :cid AND activo = true
        ORDER BY total_gastado DESC
    """)
    rows = (await db.execute(q, {"cid": company_id})).fetchall()
    
    total_fidelizados = len(rows)
    champions_vip = []
    frecuentes = []
    vip_inactivos = []
    ocasionales = []
    
    for r in rows:
        cid_str = str(r[0])
        doc = str(r[1])
        nom = str(r[2])
        tel = str(r[3]) if r[3] else None
        barrio = str(r[4]) if r[4] else "Centro"
        ciudad = str(r[5]) if r[5] else "Pedro Juan Caballero"
        t_prom = float(r[6] or 0)
        t_gast = float(r[7] or 0)
        c_comp = int(r[8] or 0)
        u_cons = r[9]
        
        dias_inactivo = (now.date() - u_cons.date()).days if u_cons else 60
        
        cli_obj = {
            "id": cid_str,
            "documento": doc,
            "nombre": nom,
            "telefono": tel,
            "barrio": barrio,
            "ciudad": ciudad,
            "ticket_promedio": t_prom,
            "total_gastado": t_gast,
            "cantidad_compras": c_comp,
            "dias_inactivo": dias_inactivo
        }
        
        if t_gast >= VIP_MIN_GASTO_GS or c_comp >= 8:
            champions_vip.append(cli_obj)
            if dias_inactivo >= DIAS_CHURN_RIESGO:
                vip_inactivos.append(cli_obj)
        elif c_comp >= 3:
            frecuentes.append(cli_obj)
        else:
            ocasionales.append(cli_obj)
            
    return {
        "total_clientes": total_fidelizados,
        "champions_vip": champions_vip,
        "vip_inactivos": vip_inactivos,
        "frecuentes": frecuentes,
        "ocasionales": ocasionales,
    }


async def get_top_customers_with_favorite_products(
    db: AsyncSession, company_id: str,
    segmento: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = 24,
    solo_inactivos: bool = False
) -> List[CustomerProfileDetail]:
    """Recupera clientes reales con filtrado estricto por segmento RFM, búsqueda y hábitos de compra."""
    now = datetime.now(PARAGUAY_TZ)
    
    filtros = ["cc.company_id = :cid", "cc.activo = true"]
    params: Dict[str, Any] = {"cid": company_id, "lim": limit}

    # 1. Filtro estricto por segmento RFM y Etiquetas Dinámicas
    seg_clean = (segmento or "").strip().lower()
    if solo_inactivos or seg_clean in ("churn", "inactivos", "riesgo", "riesgo churn"):
        filtros.append("""
            (
                (cc.ultimo_consumo IS NULL OR (CURRENT_DATE - date(cc.ultimo_consumo)) >= :churn_dias)
                AND (cc.total_gastado >= :min_gasto_churn OR cc.cantidad_compras >= 3)
            )
        """)
        params["churn_dias"] = DIAS_CHURN_RIESGO
        params["min_gasto_churn"] = VIP_MIN_GASTO_GS
    elif seg_clean in ("champions", "vip", "vip champions", "vip platino"):
        filtros.append("""
            (
                cc.total_gastado >= :vip_min
                AND cc.ultimo_consumo IS NOT NULL
                AND (CURRENT_DATE - date(cc.ultimo_consumo)) < :churn_dias
            )
        """)
        params["vip_min"] = VIP_MIN_GASTO_GS
        params["churn_dias"] = DIAS_CHURN_RIESGO
    elif seg_clean in ("frecuentes", "frecuente"):
        filtros.append("""(
            (cc.cantidad_compras >= 4 AND cc.total_gastado < :vip_min)
            OR cc.segmentos ILIKE :seg_tag_frec
        )""")
        params["vip_min"] = VIP_MIN_GASTO_GS
        params["seg_tag_frec"] = "%Frecuente%"
    elif "nuevo" in seg_clean or "ocasional" in seg_clean:
        filtros.append("""(
            (cc.cantidad_compras < 4 AND cc.total_gastado < :vip_min)
            OR cc.segmentos ILIKE :seg_tag_ocas
            OR cc.segmentos ILIKE :seg_tag_nuev
        )""")
        params["vip_min"] = VIP_MIN_GASTO_GS
        params["seg_tag_ocas"] = "%Ocasional%"
        params["seg_tag_nuev"] = "%Nuevo%"
    elif seg_clean and seg_clean != "todos":
        # Buscar por etiqueta dinámica en segmentos
        filtros.append("cc.segmentos ILIKE :seg_tag")
        params["seg_tag"] = f"%{segmento.strip()}%"

    # 2. Filtro de búsqueda libre (nombre, documento, barrio)
    if search and search.strip():
        filtros.append("(cc.nombre ILIKE :kw OR cc.documento ILIKE :kw OR cc.barrio ILIKE :kw)")
        params["kw"] = f"%{search.strip()}%"

    where_sql = " AND ".join(filtros)
    q_cli = text(f"""
        SELECT 
            cc.id,
            cc.nombre,
            cc.documento,
            cc.telefono,
            cc.barrio,
            cc.ciudad,
            COALESCE(cc.ticket_promedio, 0) as ticket_promedio,
            COALESCE(cc.total_gastado, 0) as total_gastado,
            COALESCE(cc.cantidad_compras, 0) as cantidad_compras,
            cc.ultimo_consumo,
            cc.segmentos
        FROM cupones_clientes cc
        WHERE {where_sql}
        ORDER BY cc.total_gastado DESC
        LIMIT :lim
    """)
    rows = (await db.execute(q_cli, params)).fetchall()
    
    profiles = []
    for r in rows:
        cid_val = r[0]
        c_nombre = str(r[1])
        c_doc = str(r[2])
        c_tel = str(r[3]) if r[3] else None
        c_barrio = str(r[4]) if r[4] else "Centro"
        c_ciudad = str(r[5]) if r[5] else "Pedro Juan Caballero"
        c_tprom = float(r[6] or 0)
        c_tot = float(r[7] or 0)
        c_compras = int(r[8] or 0)
        u_cons = r[9]
        c_segs_raw = r[10] or ""
        tags_list = [t.strip() for t in c_segs_raw.split(",") if t.strip()]

        dias_inactivo = (now.date() - u_cons.date()).days if u_cons else 60
        
        # Consultar top 3 productos favoritos en cupon_ticket_items
        q_prod = text("""
            SELECT 
                cti.descripcion,
                COUNT(*) as compras,
                COALESCE(SUM(cti.total), 0) as total_gastado
            FROM cupon_ticket_items cti
            JOIN cupon_tickets ct ON cti.ticket_id = ct.id
            WHERE ct.cliente_id = :clid
            GROUP BY cti.descripcion
            ORDER BY COUNT(*) DESC, SUM(cti.total) DESC
            LIMIT 3
        """)
        prod_rows = (await db.execute(q_prod, {"clid": cid_val})).fetchall()
        favs = [
            TopProductHabit(
                producto_nombre=str(p[0]),
                compras_count=int(p[1]),
                total_gastado_gs=float(p[2] or 0)
            ) for p in prod_rows
        ]

        # Clasificación descriptiva
        es_inactivo = dias_inactivo >= DIAS_CHURN_RIESGO
        if c_tot >= 3_000_000:
            segmento_label = "VIP Platino"
        elif c_tot >= 1_500_000:
            segmento_label = "VIP Oro"
        elif c_compras >= 4:
            segmento_label = "Cliente Frecuente"
        else:
            segmento_label = "Cliente Ocasional"
            
        if es_inactivo and (c_tot >= 1_500_000 or c_compras >= 3):
            segmento_label += " (En Riesgo Churn)"

        # 3. Generación de Acción y Mensaje Individual con IA
        prod_fav_txt = favs[0].producto_nombre if favs else "tus compras habituales"
        if es_inactivo:
            accion_ia = f"Disparar oferta de rescate: 15% OFF en {prod_fav_txt} (Inactivo hace {dias_inactivo} días)"
            msg_wsp = (
                f"¡Hola {c_nombre}! En Extra Supermercado te extrañamos mucho. "
                f"Te preparamos un beneficio especial de 15% de descuento en {prod_fav_txt} "
                f"para tu próxima visita. ¡Solo mencioná tu cédula {c_doc} en caja!"
            )
        else:
            accion_ia = f"Incentivo de fidelización: Combo exclusivo / 2x1 en {prod_fav_txt}"
            msg_wsp = (
                f"¡Hola {c_nombre}! Como cliente destacado de Extra Supermercado, este fin de semana "
                f"tenés una promoción exclusiva en {prod_fav_txt} y cortes de carnicería. "
                f"¡Te esperamos con la mejor atención!"
            )

        profiles.append(CustomerProfileDetail(
            id=str(cid_val),
            nombre=c_nombre,
            documento=c_doc,
            telefono=c_tel,
            barrio=c_barrio,
            ciudad=c_ciudad,
            ticket_promedio_gs=c_tprom,
            total_gastado_gs=c_tot,
            cantidad_compras=c_compras,
            dias_inactivo=dias_inactivo,
            segmento=segmento_label,
            segmentos_tags=tags_list,
            productos_favoritos=favs,
            accion_sugerida_ia=accion_ia,
            whatsapp_mensaje_sugerido=msg_wsp
        ))
        
    return profiles


async def get_promotions_with_ai_pulse(db: AsyncSession, company_id: str) -> List[PromotionPulseItem]:
    """Obtiene todas las promociones con diagnóstico de IA, productos afectados, ventas reales en cajas
    y ordenamiento estricto: vigentes primero en orden de próximo vencimiento."""
    now = datetime.now(PARAGUAY_TZ)
    q = text("""
        SELECT 
            p.id, p.nombre, p.tipo, p.valor, p.valido_desde, p.valido_hasta, 
            p.producto_ids, COALESCE(p.usos_actuales, 0) as usos, p.activo, p.descripcion
        FROM promotions p
        WHERE p.company_id = :cid
        ORDER BY 
            CASE 
                WHEN p.activo = true AND (p.valido_hasta IS NULL OR p.valido_hasta >= CURRENT_DATE) THEN 0
                WHEN p.activo = true THEN 1
                ELSE 2
            END,
            p.valido_hasta ASC NULLS LAST,
            p.created_at DESC
        LIMIT 35
    """)
    rows = (await db.execute(q, {"cid": company_id})).fetchall()
    
    result = []
    for r in rows:
        pid = str(r[0])
        nombre = str(r[1])
        tipo = str(r[2])
        valor = float(r[3] or 0)
        v_desde = r[4]
        v_hasta = r[5]
        p_ids = r[6] or []
        usos = int(r[7] or 0)
        activo = bool(r[8])
        
        # Obtener nombres de productos afectados
        prod_names = []
        valid_uuids = []
        if isinstance(p_ids, list) and p_ids:
            try:
                import uuid as _uuid
                for x in p_ids[:6]:
                    try:
                        valid_uuids.append(str(_uuid.UUID(str(x))))
                    except Exception:
                        pass
                if valid_uuids:
                    q_pnames = text("SELECT nombre FROM products WHERE id::text = ANY(:ids)")
                    pn_rows = (await db.execute(q_pnames, {"ids": valid_uuids})).fetchall()
                    prod_names = [str(pn[0]) for pn in pn_rows]
            except Exception:
                pass

        # Consultar tickets reales y volumen facturado en cajas registradoras
        monto_facturado = 0.0
        if valid_uuids:
            try:
                q_sales = text("""
                    SELECT 
                        COUNT(DISTINCT si.sale_id) as tickets,
                        COALESCE(SUM(si.total), 0) as total_gs
                    FROM sale_items si
                    JOIN sales s ON s.id = si.sale_id
                    WHERE si.product_id::text = ANY(:pids)
                      AND s.company_id::text = :cid
                      AND s.estado IN ('completado', 'confirmado')
                      AND (CAST(:desde AS date) IS NULL OR s.created_at >= CAST(:desde AS timestamp))
                """)
                s_row = (await db.execute(q_sales, {
                    "pids": valid_uuids,
                    "cid": str(company_id),
                    "desde": v_desde if v_desde else None
                })).fetchone()
                if s_row:
                    usos = max(usos, int(s_row[0] or 0))
                    monto_facturado = float(s_row[1] or 0)
            except Exception as _e:
                import logging
                logging.getLogger("uvicorn.error").warning(f"Error calculando ventas de promo {nombre}: {_e}")
            
        dias_restantes = None
        if v_hasta:
            try:
                v_hasta_date = v_hasta.date() if hasattr(v_hasta, "date") else v_hasta
                now_date = now.date() if hasattr(now, "date") else now
                dias_restantes = max(0, (v_hasta_date - now_date).days)
            except Exception:
                pass
            
        # Calcular pulso comercial y diagnóstico del CMO
        monto_str = f"Gs. {int(monto_facturado):,}".replace(",", ".")
        if usos >= 20:
            nivel = "alta_traccion"
            label = "🔥 Alta Tracción"
            diag = f"Promoción validada en cajas con {usos} tickets de venta reales y {monto_str}. Fuerte respuesta del consumidor."
            rec = "Extender vigencia o promocionar en cabeceras de góndola para maximizar rotación."
        elif usos >= 5:
            nivel = "estable"
            label = "⚡ Pulso Estable"
            diag = f"Registra {usos} tickets en cajas con {monto_str}. Flujo constante sin canibalización de margen."
            rec = "Reforzar con banner en verificadores de precios y WhatsApp para acelerar salida."
        else:
            nivel = "bajo_impacto"
            label = "⚠️ Bajo Rendimiento"
            diag = f"Apenas {usos} tickets registrados. El cliente no percibe la oferta o los productos tienen baja visibilidad en góndola."
            rec = "Revisar cartelera en góndola, aumentar el descuento al 20% o convertir a formato 2x1."
            
        result.append(PromotionPulseItem(
            id=pid,
            nombre=nombre,
            tipo=tipo,
            descuento_pct=valor if tipo == "porcentaje" else None,
            activo=activo,
            fecha_inicio=v_desde.strftime("%d/%m/%Y") if v_desde else None,
            fecha_fin=v_hasta.strftime("%d/%m/%Y") if v_hasta else None,
            dias_restantes=dias_restantes,
            productos_count=len(p_ids) if isinstance(p_ids, list) else 0,
            productos_nombres=prod_names,
            total_usos=usos,
            monto_facturado_gs=monto_facturado,
            pulso_nivel=nivel,
            pulso_label=label,
            diagnostico_ia=diag,
            recomendacion_ia=rec
        ))
    return result


async def get_tripartite_sync_status(db: AsyncSession, company_id: str) -> TripartiteSyncResponse:
    """Calcula el estado de coherencia y directivas vivas entre CFO, CMO y CSO."""
    cfo_sync = await get_inter_agent_sync(db, company_id)
    cfo_tower = await get_liquidity_control_tower(db, company_id)
    
    # Promociones activas reales en BD
    q_promos = text("SELECT COUNT(*) FROM promotions WHERE company_id = :cid AND (activo = true OR estado = 'activa')")
    promos_activas = (await db.execute(q_promos, {"cid": company_id})).scalar() or 0
    
    # Cupones emitidos / clientes impactados
    q_wa = text("SELECT COUNT(*) FROM cupon_tickets WHERE company_id = :cid AND whatsapp_enviado = true")
    wa_enviados = (await db.execute(q_wa, {"cid": company_id})).scalar() or 0
    
    # Directivas en inter_agent_directives
    q_dir = text("""
        SELECT id, codigo, emisor, receptor, titulo, mensaje, accion_sugerida, prioridad, estado, impacto_estimado_gs, created_at, payload
        FROM inter_agent_directives
        WHERE company_id = :cid
        ORDER BY created_at DESC
        LIMIT 10
    """)
    dir_rows = (await db.execute(q_dir, {"cid": company_id})).fetchall()
    
    directivas = []
    for d in dir_rows:
        directivas.append(DirectiveItem(
            id=str(d[0]),
            codigo=str(d[1]),
            emisor=str(d[2]),
            receptor=str(d[3]),
            titulo=str(d[4]),
            mensaje=str(d[5]),
            accion_sugerida=str(d[6]) if d[6] else None,
            prioridad=str(d[7]),
            estado=str(d[8]),
            impacto_estimado_gs=float(d[9] or 0),
            created_at=d[10].strftime("%d/%m/%Y %H:%M") if d[10] else None,
            payload=d[11] if isinstance(d[11], dict) else {}
        ))
        
    # Si no hay directivas registradas aún, sembrar la directiva viva del CFO a partir de su sobrestock real
    if not directivas and cfo_sync.oportunidades_flash_stock:
        top_stock = cfo_sync.oportunidades_flash_stock[0]
        directivas.append(DirectiveItem(
            id=str(uuid.uuid4()),
            codigo="DIR-CFO-01",
            emisor="cfo_agent",
            receptor="marketing_agent",
            titulo=f"Monetizar Sobre-Stock en {top_stock.producto}",
            mensaje=f"Capital inmovilizado de ₲ {top_stock.monto_inmovilizado_gs:,.0f} ({top_stock.stock_actual:,.0f} un). Activar combo o escala con piso de margen {cfo_sync.meta_margen_minimo_exigido_pct}%.",
            accion_sugerida="Crear Combo POS + Notificación WhatsApp",
            prioridad="alta",
            estado="emitida",
            impacto_estimado_gs=top_stock.recaudacion_estimada_gs,
            created_at=datetime.now(PARAGUAY_TZ).strftime("%d/%m/%Y %H:%M"),
            payload={"product_id": top_stock.product_id, "descuento_sugerido_pct": top_stock.descuento_sugerido_pct}
        ))
        
    # Consultar métricas vivas y metas comerciales del Gerente de Ventas (CSO)
    from api.src.sales_agent import service as sa_service
    sa_exec = await sa_service.get_executive_analysis(db, company_id)
    sa_cfg = await sa_service.get_company_settings(db, company_id)

    cso_margen_actual = float(sa_exec.margen_actual_pct)
    cso_margen_piso = float(sa_cfg.get("min_pct") or 20.0)
    cso_margen_ideal = float(sa_cfg.get("ideal_pct") or 24.0)
    cso_tickets = sa_exec.tickets_mes
    cso_facturacion = float(sa_exec.facturacion_mes)
    cso_tkt_prom = cso_facturacion / max(1, cso_tickets)
    cso_gap = float(sa_exec.gap_para_20_pct_gs)
    cso_cumplimiento = round(min(100.0, (cso_margen_actual / max(0.1, cso_margen_piso)) * 100), 1)

    # Calcular semáforo y diagnóstico de alineación tripartita con datos reales
    alertas = []
    estado_general = "sincronizado"
    if cso_margen_actual < cso_margen_piso:
        dif = round(cso_margen_piso - cso_margen_actual, 1)
        alertas.append(
            f"Margen real del mes ({cso_margen_actual}%) está {dif}% por debajo del piso comercial exigido ({cso_margen_piso}%). "
            f"Brecha a recuperar: ₲ {cso_gap:,.0f}. Prohibido autorizar descuentos en KVIs sin combo compensatorio."
        )
        estado_general = "advertencia"
        
    tot_sobrestock = sum(o.monto_inmovilizado_gs for o in cfo_sync.oportunidades_flash_stock)
    if tot_sobrestock > 50_000_000 and promos_activas == 0:
        alertas.append(f"Hay ₲ {tot_sobrestock:,.0f} inmovilizados en sobre-stock y no hay promociones activas en caja para liquidarlo.")
        estado_general = "desalineado"

    return TripartiteSyncResponse(
        estado_general=estado_general,
        cfo_margen_actual_pct=cso_margen_actual,
        cfo_margen_piso_pct=cso_margen_piso,
        cfo_sobrestock_valor_gs=tot_sobrestock,
        cmo_promociones_activas=promos_activas,
        cmo_clientes_fidelizados_impactados=wa_enviados,
        cso_meta_cumplimiento_pct=cso_cumplimiento,
        cso_ticket_promedio_gs=cso_tkt_prom,
        cso_margen_actual_pct=cso_margen_actual,
        cso_margen_piso_pct=cso_margen_piso,
        cso_margen_ideal_pct=cso_margen_ideal,
        cso_tickets_mes=cso_tickets,
        cso_facturacion_mes_gs=cso_facturacion,
        cso_gap_meta_gs=cso_gap,
        cso_proyeccion_cierre_gs=float(sa_exec.proyeccion_cierre_mes_gs),
        directivas_activas=directivas,
        alertas_alineacion=alertas
    )


async def get_marketing_dashboard(db: AsyncSession, company_id: str) -> MarketingDashboard:
    """Dashboard consolidado para el CMO Virtual con datos 100% reales."""
    rfm = await get_real_rfm_segments(db, company_id)
    sync = await get_tripartite_sync_status(db, company_id)
    cfo_sync = await get_inter_agent_sync(db, company_id)
    
    # Conteo de reglas aprendidas
    q_rules = text("SELECT COUNT(*) FROM company_business_rules WHERE company_id = :cid AND activa = true")
    rules_count = (await db.execute(q_rules, {"cid": company_id})).scalar() or 0
    
    segmentos = [
        CustomerSegment(
            id="vip_champions",
            nombre="VIP Champions (Mayor Gasto)",
            cantidad=len(rfm["champions_vip"]),
            criterio=f"Gasto histórico ≥ Gs. {VIP_MIN_GASTO_GS:,.0f} o 8+ compras",
            ticket_promedio_gs=sum(c["ticket_promedio"] for c in rfm["champions_vip"]) / max(1, len(rfm["champions_vip"])),
            gasto_total_gs=sum(c["total_gastado"] for c in rfm["champions_vip"])
        ),
        CustomerSegment(
            id="vip_churn_risk",
            nombre="VIPs en Riesgo de Churn",
            cantidad=len(rfm["vip_inactivos"]),
            criterio=f"VIP sin compras hace más de {DIAS_CHURN_RIESGO} días",
            ticket_promedio_gs=sum(c["ticket_promedio"] for c in rfm["vip_inactivos"]) / max(1, len(rfm["vip_inactivos"])),
            gasto_total_gs=sum(c["total_gastado"] for c in rfm["vip_inactivos"])
        ),
        CustomerSegment(
            id="frecuentes",
            nombre="Clientes Frecuentes",
            cantidad=len(rfm["frecuentes"]),
            criterio="3 a 7 compras registradas",
            ticket_promedio_gs=sum(c["ticket_promedio"] for c in rfm["frecuentes"]) / max(1, len(rfm["frecuentes"])),
            gasto_total_gs=sum(c["total_gastado"] for c in rfm["frecuentes"])
        ),
        CustomerSegment(
            id="ocasionales",
            nombre="Clientes Ocasionales / Nuevos",
            cantidad=len(rfm["ocasionales"]),
            criterio="1 a 2 compras registradas",
            ticket_promedio_gs=sum(c["ticket_promedio"] for c in rfm["ocasionales"]) / max(1, len(rfm["ocasionales"])),
            gasto_total_gs=sum(c["total_gastado"] for c in rfm["ocasionales"])
        )
    ]
    
    # Construir campañas sugeridas reales cruzando con el CFO
    campanas = []
    if rfm["vip_inactivos"]:
        motivo_rescate = f"Gasto combinado de este grupo: ₲ {sum(c['total_gastado'] for c in rfm['vip_inactivos']):,.0f}. Enviar cupón personalizado en su producto favorito."
        campanas.append(CampaignSuggestion(
            id="rescate-vip-inactivos",
            titulo=f"Plan de Rescate: {len(rfm['vip_inactivos'])} VIPs Inactivos",
            segmento="VIPs sin compras en 20+ días",
            cantidad_clientes=len(rfm["vip_inactivos"]),
            motivo=motivo_rescate,
            descripcion=motivo_rescate,
            descuento_sugerido_pct=15.0,
            origen_directiva="DIR-CMO-RESCATE",
            estado="propuesta"
        ))
        
    for idx, opp in enumerate(cfo_sync.oportunidades_flash_stock[:2]):
        motivo_stock = f"Directiva del CFO: ₲ {opp.monto_inmovilizado_gs:,.0f} inmovilizados ({opp.stock_actual:,.0f} un). Margen protegido."
        campanas.append(CampaignSuggestion(
            id=f"promo-sobrestock-{opp.product_id}",
            titulo=f"Liquidación Estratégica: {opp.producto}",
            segmento="Clientes con afinidad a la categoría",
            cantidad_clientes=len(rfm["frecuentes"]),
            producto_destacado=opp.producto,
            descuento_sugerido_pct=opp.descuento_sugerido_pct,
            motivo=motivo_stock,
            descripcion=motivo_stock,
            origen_directiva=f"DIR-CFO-0{idx+1}",
            estado="propuesta"
        ))

    resumen = (
        f"Base fidelizada de {rfm['total_clientes']:,d} clientes analizada en tiempo real. "
        f"{len(rfm['champions_vip'])} clientes VIP identificados ({len(rfm['vip_inactivos'])} en riesgo de abandono). "
        f"Tríada operando con piso de margen en {sync.cfo_margen_piso_pct}% y ₲ {sync.cfo_sobrestock_valor_gs:,.0f} en stock objetivo."
    )
    
    return MarketingDashboard(
        total_clientes_fidelizados=rfm["total_clientes"],
        segmentos=segmentos,
        campanas_sugeridas=campanas,
        campañas_sugeridas=campanas,
        resumen_ejecutivo=resumen,
        sync_tripartito=sync,
        reglas_aprendidas_count=rules_count
    )


async def create_pos_promotion_record(
    db: AsyncSession, company_id: str, nombre: str, tipo: str,
    producto_ids: List[str], descuento_pct: float, dias_vigencia: int = 7,
    motivo: str = "Creada por Gerente de Marketing IA"
) -> Dict[str, Any]:
    """Crea e inserta una promoción real en la tabla promotions para impacto inmediato en caja."""
    promo_id = str(uuid.uuid4())
    today = date.today()
    hasta = today + timedelta(days=dias_vigencia)
    
    q = text("""
        INSERT INTO promotions (
            id, company_id, nombre, descripcion, tipo, valor, aplica_a,
            producto_ids, valido_desde, valido_hasta, activo, estado,
            origen, creado_por, created_at, updated_at
        ) VALUES (
            :pid, :cid, :nombre, :desc, :tipo, :valor, 'productos',
            :pids, :desde, :hasta, true, 'activa',
            'cmo_agent', 'cmo_agent', NOW(), NOW()
        )
    """)
    await db.execute(q, {
        "pid": promo_id,
        "cid": company_id,
        "nombre": nombre,
        "desc": motivo,
        "tipo": tipo or "porcentaje",
        "valor": Decimal(str(descuento_pct)),
        "pids": [uuid.UUID(p) for p in producto_ids],
        "desde": today,
        "hasta": hasta
    })
    await db.commit()
    
    # Emitir directiva hacia el Copiloto Comercial (CSO) informando de la promo activa en POS
    q_dir = text("""
        INSERT INTO inter_agent_directives (
            id, company_id, codigo, emisor, receptor, titulo, mensaje, accion_sugerida, prioridad, estado, payload, created_at, updated_at
        ) VALUES (
            :id, :cid, :cod, 'marketing_agent', 'sales_agent', :tit, :msg, 'Impulsar en Cajas POS y Góndolas', 'alta', 'emitida', :pay, NOW(), NOW()
        )
    """)
    await db.execute(q_dir, {
        "id": uuid.uuid4(),
        "cid": company_id,
        "cod": f"DIR-CMO-{int(datetime.now().timestamp()) % 10000}",
        "tit": f"Promo POS Activa: {nombre}",
        "msg": f"Se activó un descuento del {descuento_pct}% en POS para {len(producto_ids)} productos hasta el {hasta.strftime('%d/%m/%Y')}.",
        "pay": json.dumps({"promo_id": promo_id, "producto_ids": producto_ids, "descuento_pct": descuento_pct})
    })
    await db.commit()
    
    return {
        "success": True,
        "promotion_id": promo_id,
        "nombre": nombre,
        "descuento_pct": descuento_pct,
        "valido_hasta": hasta.strftime("%Y-%m-%d"),
        "mensaje": "Promoción activa e inyectada en el motor de precios de las cajas físicas (POS)."
    }


async def record_learned_rule(
    db: AsyncSession, company_id: str, regla: str, categoria: str = "marketing", origen: str = "cmo_agent"
) -> Dict[str, Any]:
    """Guarda una regla o aprendizaje en company_business_rules para memoria permanente."""
    rule_id = str(uuid.uuid4())
    q = text("""
        INSERT INTO company_business_rules (id, company_id, regla, categoria, origen, activa, confianza, created_at)
        VALUES (:id, :cid, :regla, :cat, :orig, true, 0.95, NOW())
    """)
    await db.execute(q, {
        "id": rule_id,
        "cid": company_id,
        "regla": regla,
        "cat": categoria,
        "orig": origen
    })
    await db.commit()
    return {"success": True, "id": rule_id, "regla": regla}


async def get_learned_rules(db: AsyncSession, company_id: str) -> List[LearnedRuleItem]:
    """Recupera la memoria continua del negocio y buenas prácticas aprendidas."""
    q = text("""
        SELECT id, regla, categoria, origen, activa, confianza, created_at
        FROM company_business_rules
        WHERE company_id = :cid AND (categoria LIKE '%market%' OR categoria = 'general')
        ORDER BY created_at DESC
        LIMIT 20
    """)
    rows = (await db.execute(q, {"cid": company_id})).fetchall()
    rules = []
    for r in rows:
        rules.append(LearnedRuleItem(
            id=str(r[0]),
            regla=str(r[1]),
            categoria=str(r[2]),
            origen=str(r[3]),
            activa=bool(r[4]),
            confianza=float(r[5] or 1.0),
            created_at=r[6].strftime("%d/%m/%Y %H:%M") if r[6] else None
        ))
    return rules


async def recalculate_customer_rfm_and_habits(db: AsyncSession, company_id: str) -> Dict[str, Any]:
    """Motor de Re-Perfilado Dinámico Continuo.
    Recalcula compras, ticket promedio, recencia, y reasigna etiquetas vivas sobre cupones_clientes."""
    now = datetime.now(PARAGUAY_TZ)

    # 1. Recalcular métricas de consumo acumuladas desde cupon_tickets
    q_recalc_metrics = text("""
        UPDATE cupones_clientes cc
        SET 
            total_gastado = sub.tot_gastado,
            cantidad_compras = sub.cant_compras,
            ticket_promedio = sub.t_promedio,
            ultimo_consumo = sub.ult_consumo,
            updated_at = NOW()
        FROM (
            SELECT 
                cliente_id,
                COALESCE(SUM(monto_compra), 0) as tot_gastado,
                COUNT(id) as cant_compras,
                COALESCE(AVG(monto_compra), 0) as t_promedio,
                MAX(COALESCE(fecha_compra, fecha_captura)) as ult_consumo
            FROM cupon_tickets
            WHERE company_id = :cid
            GROUP BY cliente_id
        ) sub
        WHERE cc.id = sub.cliente_id AND cc.company_id = :cid
    """)
    await db.execute(q_recalc_metrics, {"cid": company_id})
    await db.commit()

    # 2. Asignar etiquetas básicas de valor y riesgo (VIP Platino, Oro, Frecuente, Riesgo Churn)
    q_all = text("""
        SELECT id, total_gastado, cantidad_compras, ultimo_consumo, segmentos
        FROM cupones_clientes
        WHERE company_id = :cid AND activo = true
    """)
    rows = (await db.execute(q_all, {"cid": company_id})).fetchall()

    actualizados = 0
    rescatados_count = 0
    en_riesgo_count = 0

    for r in rows:
        cid_val = r[0]
        tot = float(r[1] or 0)
        compras = int(r[2] or 0)
        ult = r[3]
        seg_actual = (r[4] or "").split(",") if r[4] else []
        seg_set = set([s.strip() for s in seg_actual if s.strip()])

        dias_inactivo = (now.date() - ult.date()).days if ult else 60

        # Nivel de valor
        if tot >= 3_000_000:
            seg_set.add("VIP Platino")
            seg_set.discard("VIP Oro")
            seg_set.discard("Ocasional")
        elif tot >= 1_500_000:
            seg_set.add("VIP Oro")
            seg_set.discard("VIP Platino")
            seg_set.discard("Ocasional")
        elif compras >= 4:
            seg_set.add("Frecuente")
            seg_set.discard("Ocasional")
        else:
            seg_set.add("Ocasional")

        # Dinámica de Churn / Rescate
        if dias_inactivo >= DIAS_CHURN_RIESGO and (tot >= 1_500_000 or compras >= 3):
            seg_set.add("Riesgo Churn")
            en_riesgo_count += 1
        else:
            if "Riesgo Churn" in seg_set:
                seg_set.discard("Riesgo Churn")
                seg_set.add("Cliente Rescatado")
                rescatados_count += 1

        # Guardar etiquetas actualizadas
        new_segs = ",".join(sorted(list(seg_set)))
        q_upd = text("UPDATE cupones_clientes SET segmentos = :segs WHERE id = :id")
        await db.execute(q_upd, {"segs": new_segs, "id": cid_val})
        actualizados += 1

    await db.commit()

    return {
        "success": True,
        "total_clientes_recalculados": actualizados,
        "clientes_en_riesgo": en_riesgo_count,
        "clientes_rescatados_recientes": rescatados_count,
        "mensaje": f"Se recalcularon {actualizados:,d} clientes. {en_riesgo_count} en riesgo de abandono y {rescatados_count} clientes que volvieron a comprar tras campañas."
    }


async def create_custom_audience_tag(
    db: AsyncSession, company_id: str, tag_name: str,
    producto_keyword: Optional[str] = None, barrio: Optional[str] = None, min_gasto: Optional[float] = None
) -> Dict[str, Any]:
    """Crea una etiqueta personalizada y la asigna a los clientes que cumplan los criterios de hábitos reales."""
    clean_tag = tag_name.strip()
    if not clean_tag:
        return {"success": False, "error": "El nombre de la etiqueta no puede estar vacío."}

    # Buscar clientes objetivo
    cliente_ids_target = set()

    # Si hay palabra clave de producto (ej. 'Costilla', 'Cerveza', 'Pañal', 'Yerba')
    if producto_keyword:
        q_prod = text("""
            SELECT DISTINCT ct.cliente_id
            FROM cupon_ticket_items cti
            JOIN cupon_tickets ct ON cti.ticket_id = ct.id
            WHERE ct.company_id = :cid AND cti.descripcion ILIKE :kw
        """)
        p_rows = (await db.execute(q_prod, {"cid": company_id, "kw": f"%{producto_keyword}%"})).fetchall()
        for pr in p_rows:
            if pr[0]:
                cliente_ids_target.add(str(pr[0]))

    # Si hay filtro de barrio o gasto
    filtros = ["company_id = :cid", "activo = true"]
    params: Dict[str, Any] = {"cid": company_id}
    if barrio:
        filtros.append("barrio ILIKE :barrio")
        params["barrio"] = f"%{barrio}%"
    if min_gasto:
        filtros.append("total_gastado >= :min_gasto")
        params["min_gasto"] = min_gasto

    q_cli = text(f"SELECT id FROM cupones_clientes WHERE {' AND '.join(filtros)}")
    c_rows = (await db.execute(q_cli, params)).fetchall()

    if not producto_keyword:
        for cr in c_rows:
            cliente_ids_target.add(str(cr[0]))
    else:
        # Intersección
        cli_ids_barrio = set(str(cr[0]) for cr in c_rows)
        cliente_ids_target = cliente_ids_target.intersection(cli_ids_barrio)

    if not cliente_ids_target:
        return {"success": True, "etiqueta": clean_tag, "clientes_asignados": 0, "mensaje": "Ningún cliente cumplió con los criterios especificados."}

    # Asignar etiqueta en segmentos
    for cid_str in cliente_ids_target:
        q_get = text("SELECT segmentos FROM cupones_clientes WHERE id = :id")
        curr = (await db.execute(q_get, {"id": cid_str})).scalar() or ""
        segs = set([s.strip() for s in curr.split(",") if s.strip()])
        segs.add(clean_tag)
        await db.execute(text("UPDATE cupones_clientes SET segmentos = :s WHERE id = :id"), {"s": ",".join(sorted(list(segs))), "id": cid_str})

    await db.commit()

    # Guardar la regla de creación de etiqueta en la memoria continua del CMO
    await record_learned_rule(
        db, company_id,
        f"Etiqueta creada: '{clean_tag}' (Criterio: {producto_keyword or ''} {barrio or ''} {f'Gasto >= Gs. {min_gasto:,.0f}' if min_gasto else ''}) asignada a {len(cliente_ids_target)} clientes.",
        categoria="audiencias",
        origen="cmo_segmentacion"
    )

    return {
        "success": True,
        "etiqueta": clean_tag,
        "clientes_asignados": len(cliente_ids_target),
        "mensaje": f"Etiqueta '{clean_tag}' creada y asignada a {len(cliente_ids_target):,d} clientes reales."
    }


async def get_audience_tags_summary(db: AsyncSession, company_id: str) -> List[Dict[str, Any]]:
    """Obtiene el listado de todas las etiquetas dinámicas activas con el conteo de clientes."""
    q = text("SELECT segmentos FROM cupones_clientes WHERE company_id = :cid AND activo = true AND segmentos IS NOT NULL")
    rows = (await db.execute(q, {"cid": company_id})).fetchall()

    conteo: Dict[str, int] = {}
    for r in rows:
        cadena = r[0] or ""
        tags = [t.strip() for t in cadena.split(",") if t.strip()]
        for t in tags:
            conteo[t] = conteo.get(t, 0) + 1

    resultado = [{"etiqueta": k, "cantidad": v} for k, v in sorted(conteo.items(), key=lambda x: x[1], reverse=True)]
    return resultado

