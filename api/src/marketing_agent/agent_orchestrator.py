"""Orquestador de Inteligencia de Marketing Híbrido (Qwen 2.5 7B Local + Gemini Flash).

Implementa un agente ReAct autónomo para el Gerente de Marketing IA (CMO Virtual) de Extra Supermercado:
- Tool-Calling hacia PostgreSQL (cupones_clientes, cupon_ticket_items, promotions, stock).
- Sincronización continua con el CFO Virtual (sobre-stock y piso de margen) y el Copiloto Comercial.
- Memoria corporativa permanente en company_business_rules.
"""

import json
import logging
import uuid
from decimal import Decimal
from typing import Optional, Any, List, Dict
import httpx
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

from api.src.config import settings
from api.src.marketing_agent import service
from api.src.marketing_agent.schemas import ChatMessageResponse, ActionOutcome

logger = logging.getLogger("cmo_agent_orchestrator")


TOOL_DEFINITIONS = [
    {
        "type": "function",
        "function": {
            "name": "get_tripartite_status",
            "description": "Consulta el estado vivo de la tríada (CFO - CMO - CSO): margen real acumulado, piso de margen exigido por finanzas, valor de sobrestock a monetizar y directivas activas.",
            "parameters": {
                "type": "object",
                "properties": {}
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_rfm_customer_segments",
            "description": "Obtiene la segmentación RFM viva de clientes fidelizados de Extra Supermercado (Champions, Frecuentes, VIP en riesgo de abandono y Ocasionales).",
            "parameters": {
                "type": "object",
                "properties": {}
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_customers_with_favorite_products",
            "description": "Obtiene clientes reales con su teléfono, barrio y los 3 productos que compran habitualmente (analizados desde cupon_ticket_items).",
            "parameters": {
                "type": "object",
                "properties": {
                    "limit": {
                        "type": "integer",
                        "description": "Cantidad de clientes a recuperar. Default: 5"
                    },
                    "solo_inactivos": {
                        "type": "boolean",
                        "description": "True para filtrar clientes con más de 20 días sin comprar (riesgo churn)."
                    }
                }
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "create_pos_promotion",
            "description": "Crea y activa una promoción real en la base de datos (tabla promotions) para que las cajas físicas (POS) descuenten automáticamente al cobrar.",
            "parameters": {
                "type": "object",
                "properties": {
                    "nombre": {"type": "string", "description": "Nombre comercial de la promo (ej. Combo Fin de Semana Cerveza)."},
                    "descuento_pct": {"type": "number", "description": "Porcentaje de descuento (ej. 15.0)."},
                    "producto_ids": {"type": "array", "items": {"type": "string"}, "description": "Lista de UUIDs de productos incluidos."},
                    "dias_vigencia": {"type": "integer", "description": "Días de duración de la promo (default: 7)."},
                    "motivo": {"type": "string", "description": "Justificación estratégica de la promoción."}
                },
                "required": ["nombre", "descuento_pct", "producto_ids"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "publish_kiosk_banner",
            "description": "Publica un banner publicitario en los Kioscos verificadores de precios del salón de ventas.",
            "parameters": {
                "type": "object",
                "properties": {
                    "titulo": {"type": "string", "description": "Título principal del banner."},
                    "subtitulo": {"type": "string", "description": "Subtítulo o descripción de la oferta."},
                    "descuento_texto": {"type": "string", "description": "Texto del descuento (ej: '20% OFF')."},
                    "color": {"type": "string", "enum": ["orange", "emerald", "amber", "purple", "blue", "rose"], "description": "Paleta visual."}
                },
                "required": ["titulo", "descuento_texto"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "record_marketing_rule",
            "description": "Guarda una regla o política de marketing en la memoria permanente del negocio (company_business_rules) para que nunca se olvide.",
            "parameters": {
                "type": "object",
                "properties": {
                    "regla": {"type": "string", "description": "Texto de la regla o aprendizaje (ej: 'Los miércoles de verduras el descuento máximo es 15%')."},
                    "categoria": {"type": "string", "description": "Categoría de la regla (default: 'marketing')."}
                },
                "required": ["regla"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "reprofile_customer_base",
            "description": "Ejecuta el pipeline de re-perfilado dinámico continuo: recalcula compras, ticket promedio, recencia, detecta rescates y actualiza las etiquetas vivas en la base de datos.",
            "parameters": {
                "type": "object",
                "properties": {}
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "create_custom_audience_tag",
            "description": "Crea una nueva etiqueta dinámica (ej: 'Amantes del Asado', 'Compradores Cerveza', 'Barrio Obrero') y se la asigna a los clientes que cumplan los criterios de hábitos reales en la base de datos.",
            "parameters": {
                "type": "object",
                "properties": {
                    "tag_name": {"type": "string", "description": "Nombre de la etiqueta a crear."},
                    "producto_keyword": {"type": "string", "description": "Palabra clave de producto en su historial (ej: 'Costilla', 'Cerveza', 'Pañal', 'Yerba')."},
                    "barrio": {"type": "string", "description": "Filtro de barrio en Pedro Juan Caballero."},
                    "min_gasto": {"type": "number", "description": "Gasto total acumulado mínimo en Guaraníes."}
                },
                "required": ["tag_name"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_promotions_pulse",
            "description": "Obtiene el diagnóstico comercial en vivo de todas las promociones: pulso, volumen vendido, productos reales involucrados y efectividad en cajas.",
            "parameters": {
                "type": "object",
                "properties": {}
            }
        }
    }
]


async def _execute_tool(db: AsyncSession, company_id: str, tool_name: str, args: Dict[str, Any]) -> Any:
    """Ejecuta las herramientas reales de Marketing contra la base de datos."""
    if tool_name == "get_promotions_pulse":
        promos = await service.get_promotions_with_ai_pulse(db, company_id)
        return [p.dict() for p in promos[:8]]

    elif tool_name == "get_tripartite_status":
        sync = await service.get_tripartite_sync_status(db, company_id)
        return {
            "estado_general": sync.estado_general,
            "cfo_margen_actual_pct": sync.cfo_margen_actual_pct,
            "cfo_margen_piso_pct": sync.cfo_margen_piso_pct,
            "cfo_sobrestock_valor_gs": sync.cfo_sobrestock_valor_gs,
            "cmo_promociones_activas": sync.cmo_promociones_activas,
            "cso_meta_cumplimiento_pct": sync.cso_meta_cumplimiento_pct,
            "alertas_alineacion": sync.alertas_alineacion,
            "directivas_recientes": [d.dict() for d in sync.directivas_activas[:3]]
        }

    elif tool_name == "get_rfm_customer_segments":
        rfm = await service.get_real_rfm_segments(db, company_id)
        return {
            "total_clientes_fidelizados": rfm["total_clientes"],
            "champions_vip_count": len(rfm["champions_vip"]),
            "vip_inactivos_count": len(rfm["vip_inactivos"]),
            "frecuentes_count": len(rfm["frecuentes"]),
            "ocasionales_count": len(rfm["ocasionales"]),
            "gasto_acumulado_vip_gs": sum(c["total_gastado"] for c in rfm["champions_vip"])
        }

    elif tool_name == "get_customers_with_favorite_products":
        lim = int(args.get("limit", 5))
        inactivos = bool(args.get("solo_inactivos", False))
        custs = await service.get_top_customers_with_favorite_products(db, company_id, limit=lim, solo_inactivos=inactivos)
        return [c.dict() for c in custs]

    elif tool_name == "create_pos_promotion":
        return await service.create_pos_promotion_record(
            db, company_id,
            nombre=args.get("nombre", "Promoción Especial"),
            tipo="porcentaje",
            producto_ids=args.get("producto_ids", []),
            descuento_pct=float(args.get("descuento_pct", 10.0)),
            dias_vigencia=int(args.get("dias_vigencia", 7)),
            motivo=args.get("motivo", "Activada por CMO Virtual")
        )

    elif tool_name == "publish_kiosk_banner":
        # Guardar banner en la BD
        q = text("""
            INSERT INTO kiosk_banners (id, company_id, titulo, subtitulo, descuento_texto, color, activo, orden, created_at, updated_at)
            VALUES (:id, :cid, :tit, :sub, :desc, :col, true, 0, NOW(), NOW())
        """)
        bid = str(uuid.uuid4())
        await db.execute(q, {
            "id": bid,
            "cid": company_id,
            "tit": args.get("titulo", "Oferta Especial"),
            "sub": args.get("subtitulo", ""),
            "desc": args.get("descuento_texto", "PROMO"),
            "col": args.get("color", "orange")
        })
        await db.commit()
        return {"success": True, "banner_id": bid, "mensaje": "Banner publicado y rotando en terminales del salón."}

    elif tool_name == "record_marketing_rule":
        regla = args.get("regla", "")
        cat = args.get("categoria", "marketing")
        return await service.record_learned_rule(db, company_id, regla, cat)

    elif tool_name == "reprofile_customer_base":
        return await service.recalculate_customer_rfm_and_habits(db, company_id)

    elif tool_name == "create_custom_audience_tag":
        return await service.create_custom_audience_tag(
            db, company_id,
            tag_name=args.get("tag_name", ""),
            producto_keyword=args.get("producto_keyword"),
            barrio=args.get("barrio"),
            min_gasto=float(args.get("min_gasto")) if args.get("min_gasto") else None
        )

    return {"error": f"Herramienta desconocida: {tool_name}"}

    return {"error": f"Herramienta desconocida: {tool_name}"}


async def chat_with_marketing_agent(
    db: AsyncSession, company_id: str, message: str, conversation_history: Optional[List[Dict[str, Any]]] = None
) -> ChatMessageResponse:
    """Ejecuta el ciclo ReAct con Qwen 2.5 7B en Ollama local y fallback inteligente."""
    
    # 1. Cargar memoria continua de company_business_rules
    rules = await service.get_learned_rules(db, company_id)
    reglas_texto = "\n".join([f"- {r.regla}" for r in rules]) if rules else "Sin reglas previas."

    system_prompt = f"""Eres el Gerente de Marketing IA (CMO Virtual) de Extra Supermercado en Pedro Juan Caballero, Paraguay.
Operas con datos 100% reales de la base de datos de la empresa:
- Dispones de una base de 7.856 clientes fidelizados con tickets detallados (cupones_clientes y cupon_ticket_items).
- Estás en sincronización continua con el CFO Virtual (te exige respetar el piso de margen bruto y monetizar sobre-stock de capital inmovilizado).
- Estás conectado al Copiloto Comercial (CSO) para coordinar ventas en salón y cajas físicas.

MEMORIA CORPORATIVA Y REGLAS DE NEGOCIO APRENDIDAS:
{reglas_texto}

DIRECTIVAS INMUTABLES:
1. NUNCA inventes clientes ni productos. Si te piden datos de clientes o hábitos, invoca 'get_customers_with_favorite_products' o 'get_rfm_customer_segments'.
2. Si te piden crear una promoción, invoca 'create_pos_promotion' para que impacte en las cajas físicas (POS) de verdad.
3. Si el usuario te da una regla o preferencia de marketing, invoca 'record_marketing_rule' para guardarla permanentemente.
4. Habla con tono ejecutivo de retail paraguayo: Guaraníes (₲ / Gs.), márgenes comerciales y decisiones ágiles.
"""

    messages = [{"role": "system", "content": system_prompt}]
    if conversation_history:
        for ch in conversation_history[-6:]:
            if ch.get("role") in ("user", "assistant"):
                messages.append({"role": ch["role"], "content": ch.get("content", "")})
    messages.append({"role": "user", "content": message})

    # 2. Invocación a Ollama Local
    base_u = settings.ollama_base_url.replace("/v1", "").rstrip("/")
    ollama_url = f"{base_u}/api/chat"
    model_name = getattr(settings, "ollama_model", "qwen2.5:7b")

    action_outcome = None
    final_reply = ""
    suggested_prompts = [
        "Ver estado de sincronización con el CFO",
        "¿Cuáles son los VIPs en riesgo de abandono?",
        "Crear combo para liquidar sobre-stock",
        "Ver reglas aprendidas de marketing"
    ]

    try:
        async with httpx.AsyncClient(timeout=75.0) as client:
            payload = {
                "model": model_name,
                "messages": messages,
                "tools": TOOL_DEFINITIONS,
                "tool_choice": "auto",
                "stream": False,
                "temperature": 0.2
            }
            resp = await client.post(ollama_url, json=payload)
            if resp.status_code == 200:
                res_data = resp.json()
                msg_choice = res_data.get("message", {}) if "message" in res_data else res_data.get("choices", [{}])[0].get("message", {})
                tool_calls = msg_choice.get("tool_calls", [])

                if tool_calls:
                    messages.append(msg_choice)
                    for tc in tool_calls:
                        t_name = tc["function"]["name"]
                        try:
                            t_args = json.loads(tc["function"]["arguments"])
                        except Exception:
                            t_args = {}

                        tool_res = await _execute_tool(db, company_id, t_name, t_args)
                        messages.append({
                            "role": "tool",
                            "tool_call_id": tc.get("id", f"call_{t_name}"),
                            "name": t_name,
                            "content": json.dumps(tool_res)
                        })

                        if t_name == "create_pos_promotion":
                            action_outcome = ActionOutcome(
                                tipo="pos_promotion",
                                titulo="Promoción Inyectada en POS",
                                descripcion=f"{t_args.get('nombre')} ({t_args.get('descuento_pct')}% OFF)",
                                data=tool_res,
                                ejecutable=False
                            )
                        elif t_name == "record_marketing_rule":
                            action_outcome = ActionOutcome(
                                tipo="memory_rule",
                                titulo="Regla Grabada en Memoria",
                                descripcion=t_args.get("regla", ""),
                                data=tool_res,
                                ejecutable=False
                            )
                        elif t_name == "reprofile_customer_base":
                            action_outcome = ActionOutcome(
                                tipo="reprofile_done",
                                titulo="Re-Perfilado Dinámico Completado",
                                descripcion=f"{tool_res.get('total_clientes_recalculados', 0)} clientes recalculados ({tool_res.get('clientes_en_riesgo', 0)} en riesgo, {tool_res.get('clientes_rescatados_recientes', 0)} rescatados)",
                                data=tool_res,
                                ejecutable=False
                            )
                        elif t_name == "create_custom_audience_tag":
                            action_outcome = ActionOutcome(
                                tipo="tag_created",
                                titulo=f"Etiqueta Dinámica: '{t_args.get('tag_name')}'",
                                descripcion=f"Asignada a {tool_res.get('clientes_asignados', 0)} clientes reales",
                                data=tool_res,
                                ejecutable=False
                            )

                    # Segunda pasada para generar la explicación ejecutiva
                    payload_2 = {
                        "model": model_name,
                        "messages": messages,
                        "stream": False,
                        "temperature": 0.2
                    }
                    resp_2 = await client.post(ollama_url, json=payload_2)
                    if resp_2.status_code == 200:
                        final_reply = resp_2.json()["choices"][0]["message"]["content"]
                    else:
                        final_reply = "He procesado las consultas estratégicas sobre la base de datos de Extra Supermercado."
                else:
                    final_reply = msg_choice.get("content", "")
            else:
                raise Exception(f"Ollama devolvió status {resp.status_code}")

    except Exception as e:
        logger.warning(f"Ollama error ({type(e).__name__}: {e}). Ejecutando fallback analítico...")
        # Fallback analítico determinístico consultando la BD
        dash = await service.get_marketing_dashboard(db, company_id)
        sync = dash.sync_tripartito
        final_reply = (
            f"🎯 **Sala de Situación CMO (Consulta Directa contra Base de Datos):**\n\n"
            f"- **Base de Clientes Fidelizados:** **{dash.total_clientes_fidelizados:,d} clientes reales** con historial de consumo.\n"
            f"- **Alineación con el CFO:** Margen actual **{sync.cfo_margen_actual_pct}%** (Piso exigido: {sync.cfo_margen_piso_pct}%). "
            f"Capital inmovilizado en sobre-stock: **₲ {sync.cfo_sobrestock_valor_gs:,.0f}**.\n"
            f"- **Promociones Activas en Cajas POS:** {sync.cmo_promociones_activas} activas.\n\n"
            f"*{dash.resumen_ejecutivo}*"
        )

    return ChatMessageResponse(
        reply=final_reply,
        action_outcome=action_outcome,
        suggested_prompts=suggested_prompts
    )
