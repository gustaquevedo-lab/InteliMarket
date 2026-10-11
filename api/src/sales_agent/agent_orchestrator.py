"""Orquestador de Inteligencia Comercial Hibrido (Qwen 2.5 7B Local + Gemini Flash).

Implementa un agente ReAct autonomo con capacidades de Tool-Calling hacia PostgreSQL
y Evolution API. Aprende activamente registrando reglas y preferencias en company_business_rules.
"""

import json
import logging
from decimal import Decimal
from typing import Optional, Any
import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.config import settings
from api.src.sales_agent import service
from api.src.sales_agent.schemas import ChatMessageResponse, ActionOutcome

logger = logging.getLogger("sales_agent_orchestrator")


TOOL_DEFINITIONS = [
    {
        "type": "function",
        "function": {
            "name": "get_sales_kpis",
            "description": "Obtiene los KPIs de ventas en tiempo real (facturacion total, CMV, margen real, tickets, gap hacia la meta del 24% y proyeccion de cierre).",
            "parameters": {
                "type": "object",
                "properties": {
                    "periodo_tipo": {
                        "type": "string",
                        "enum": ["mes_actual", "mes_anterior", "ultimos_30_dias"],
                        "description": "Periodo a consultar. Default: mes_actual"
                    }
                }
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_pareto_analysis",
            "description": "Obtiene la matriz Pareto 80/20 real con los productos Clase A (generadores del 80% de ventas).",
            "parameters": {
                "type": "object",
                "properties": {
                    "metric_type": {
                        "type": "string",
                        "enum": ["facturacion", "ganancia"],
                        "description": "Metrica para el ranking (facturacion o ganancia)."
                    },
                    "limit": {
                        "type": "integer",
                        "description": "Cantidad de SKUs a traer (ej. 10)."
                    }
                }
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "apply_price_change",
            "description": "Aplica una modificacion real de precio unitario sugerida para un producto en la base de datos y sincroniza escalas de venta.",
            "parameters": {
                "type": "object",
                "properties": {
                    "product_id": {"type": "string", "description": "UUID del producto a remarcar."},
                    "nuevo_precio": {"type": "number", "description": "Nuevo precio de venta en Guaranies (PYG)."},
                    "motivo": {"type": "string", "description": "Justificacion estrategica de la remarcacion."}
                },
                "required": ["product_id", "nuevo_precio", "motivo"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "update_margin_targets",
            "description": "Modifica las metas comerciales de margen de la empresa (minimo e ideal).",
            "parameters": {
                "type": "object",
                "properties": {
                    "target_min_pct": {"type": "number", "description": "Nuevo margen minimo aceptable en % (ej. 20.0)."},
                    "target_ideal_pct": {"type": "number", "description": "Nuevo margen ideal en % (ej. 24.0)."}
                },
                "required": ["target_min_pct", "target_ideal_pct"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "toggle_kvi_product",
            "description": "Marca o desmarca un producto como Gancho (KVI) para protegerlo de aumentos de precio y preservar el flujo de clientes.",
            "parameters": {
                "type": "object",
                "properties": {
                    "product_id": {"type": "string", "description": "UUID del producto."},
                    "es_gancho": {"type": "boolean", "description": "True para marcar como gancho, False para quitar proteccion."},
                    "motivo": {"type": "string", "description": "Razon por la que es gancho (ej. competencia con autoservicio)."}
                },
                "required": ["product_id", "es_gancho"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "learn_business_rule",
            "description": "Guarda una nueva regla o preferencia del dueno en la memoria permanente del Gerente IA.",
            "parameters": {
                "type": "object",
                "properties": {
                    "regla": {"type": "string", "description": "Texto descriptivo de la directiva o regla aprendida."},
                    "categoria": {"type": "string", "description": "Categoria (precios, proveedores, carniceria, etc)."}
                },
                "required": ["regla"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "send_whatsapp_alert",
            "description": "Envia una directiva o alerta por WhatsApp al encargado de salon, carniceria o compras.",
            "parameters": {
                "type": "object",
                "properties": {
                    "telefono": {"type": "string", "description": "Numero de telefono con codigo de pais (ej. 595981123456)."},
                    "mensaje": {"type": "string", "description": "Texto del mensaje ejecutivo."}
                },
                "required": ["telefono", "mensaje"]
            }
        }
    }
]


async def _execute_tool(db: AsyncSession, company_id: str, tool_name: str, arguments: dict) -> dict:
    """Ejecuta una herramienta de negocio contra PostgreSQL o integraciones."""
    try:
        if tool_name == "get_sales_kpis":
            p_tipo = arguments.get("periodo_tipo", "mes_actual")
            analysis = await service.get_executive_analysis(db, company_id, periodo_tipo=p_tipo)
            return {
                "periodo": p_tipo,
                "facturacion_total_gs": int(analysis.facturacion_mes),
                "ganancia_bruta_gs": int(analysis.ganancia_bruta_mes),
                "margen_actual_pct": analysis.margen_actual_pct,
                "meta_minima_pct": analysis.margen_minimo_target_pct,
                "meta_ideal_pct": analysis.margen_ideal_target_pct,
                "gap_para_ideal_gs": int(analysis.gap_para_24_pct_gs),
                "tickets": analysis.tickets_mes,
                "proyeccion_cierre_gs": int(analysis.proyeccion_cierre_mes_gs),
                "departamentos_clave": [
                    {"depto": d["departamento"], "facturacion": d["facturacion_gs"], "margen": d["margen_actual_pct"]}
                    for d in analysis.rentabilidad_por_departamento[:5]
                ]
            }

        elif tool_name == "get_pareto_analysis":
            m_type = arguments.get("metric_type", "facturacion")
            lim = int(arguments.get("limit", 8))
            pareto = await service.get_pareto_analysis(db, company_id, metric_type=m_type, page=1, page_size=lim)
            top_items = [
                {
                    "nombre": it.nombre,
                    "categoria": it.categoria,
                    "facturacion": int(it.facturacion_total),
                    "margen_pct": it.margen_bruto_pct,
                    "participacion_pct": it.participacion_pct,
                    "clase": it.clase
                }
                for it in pareto.items[:lim]
            ]
            return {
                "total_skus": pareto.resumen.total_skus,
                "clase_a_skus": pareto.resumen.clase_a_skus,
                "top_skus": top_items
            }

        elif tool_name == "apply_price_change":
            pid = arguments["product_id"]
            np = float(arguments["nuevo_precio"])
            motivo = arguments.get("motivo", "Ajuste directo sugerido en chat")
            return await service.apply_price_proposal(db, company_id, pid, np, motivo)

        elif tool_name == "update_margin_targets":
            t_min = float(arguments["target_min_pct"])
            t_ideal = float(arguments["target_ideal_pct"])
            return await service.update_company_settings(db, company_id, t_min, t_ideal)

        elif tool_name == "toggle_kvi_product":
            pid = arguments["product_id"]
            es_g = bool(arguments["es_gancho"])
            motivo = arguments.get("motivo", "Gancho definido por usuario en chat")
            return await service.toggle_kvi_product(db, company_id, pid, es_g, motivo)

        elif tool_name == "learn_business_rule":
            regla = arguments["regla"]
            cat = arguments.get("categoria", "comercial")
            return await service.save_business_rule(db, company_id, regla, cat, origen="chat_copiloto")

        elif tool_name == "send_whatsapp_alert":
            tel = arguments["telefono"]
            txt = arguments["mensaje"]
            clean_phone = "".join(c for c in tel if c.isdigit())
            async with httpx.AsyncClient(timeout=10.0) as client:
                evo_url = f"{settings.evolution_api_url}/message/sendText/{settings.evolution_instance_name}"
                resp = await client.post(
                    evo_url,
                    headers={"apikey": settings.evolution_api_key},
                    json={"number": clean_phone, "text": txt}
                )
                return {"success": resp.status_code == 201 or resp.status_code == 200, "status": resp.status_code}

        return {"error": f"Herramienta desconocida: {tool_name}"}

    except Exception as e:
        logger.error(f"Error ejecutando herramienta {tool_name}: {e}")
        return {"error": str(e)}


async def chat_with_sales_agent(
    db: AsyncSession,
    company_id: str,
    message: str,
    context_tab: str = "general",
    conversation_history: list[dict] | None = None
) -> ChatMessageResponse:
    """Procesa la consulta del usuario con Qwen 2.5 7B en Ollama local usando Tool-Calling."""
    # 1. Cargar memoria semantica activa de la empresa
    reglas_aprendidas = await service.list_business_rules(db, company_id)
    reglas_texto = "\n".join([f"- {r.regla} (Categoría: {r.categoria or 'General'})" for r in reglas_aprendidas[:10]])
    if not reglas_texto:
        reglas_texto = "- Sin restricciones previas configuradas. Priorizar margen saludable (20% a 24%) sin destruir rotación de KVIs."

    cfg = await service.get_company_settings(db, company_id)

    system_prompt = f"""Sos el Director Comercial y Gerente de Ventas IA de Extra Supermercado (Intelimarket).
Tu función es auditar rentabilidades, detectar fugas de margen, proteger productos gancho (KVI), simular escenarios comerciales y ejecutar directivas reales.
Hablas con tono ejecutivo, directo, seguro, comercial y en español rioplatense/paraguayo profesional.
Usa siempre la moneda Guaraníes (Gs. o ₲) con formato entero con separadores de miles (ej: Gs. 35.000).

METAS VIGENTES DE LA EMPRESA:
- Margen Mínimo: {cfg['min_pct']}%
- Margen Óptimo: {cfg['ideal_pct']}%

MEMORIA DEL NEGOCIO (Reglas aprendidas de directivas y rechazos anteriores):
{reglas_texto}

REGLAS CRÍTICAS DE EJECUCIÓN:
1. NUNCA inventes números ni nombres de productos. Usa SIEMPRE las herramientas disponibles (get_sales_kpis, get_pareto_analysis) para consultar la base de datos real.
2. Si el usuario te pide modificar metas, aplicar un precio, marcar un gancho (KVI) o enviar un WhatsApp, EJECUTA la herramienta correspondiente.
3. Respuestas ejecutivas con bullet points claros y próximos pasos accionables.
"""

    messages = [{"role": "system", "content": system_prompt}]

    # Inyectar historial previo
    if conversation_history:
        for ch in conversation_history[-6:]:
            if ch.get("role") in ("user", "assistant"):
                messages.append({"role": ch["role"], "content": ch.get("content", "")})

    messages.append({"role": "user", "content": message})

    # 2. Llamada a Ollama con Tool Calling
    base_u = settings.ollama_base_url.replace("/v1", "").rstrip("/")
    ollama_url = f"{base_u}/api/chat"
    model_name = getattr(settings, "ollama_model", "qwen2.5:7b")

    action_outcome = None
    final_reply = ""
    suggested_prompts = []

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

                        # Si la herramienta fue una accion modificatoria, generar ActionOutcome
                        if t_name == "apply_price_change":
                            action_outcome = ActionOutcome(
                                tipo="price_adjustment",
                                titulo=f"Precio Actualizado en POS",
                                descripcion=f"Remarcado exitoso a Gs. {int(t_args.get('nuevo_precio', 0)):,d}",
                                data=tool_res,
                                ejecutable=False
                            )
                        elif t_name == "update_margin_targets":
                            action_outcome = ActionOutcome(
                                tipo="target_update",
                                titulo="Metas Comerciales Actualizadas",
                                descripcion=f"Mínimo: {t_args.get('target_min_pct')}% | Ideal: {t_args.get('target_ideal_pct')}%",
                                data=tool_res,
                                ejecutable=False
                            )

                    # Segunda llamada para generar la explicacion final
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
                        final_reply = "He ejecutado las consultas requeridas en la base de datos."
                else:
                    final_reply = msg_choice.get("content", "")
            else:
                raise Exception(f"Ollama retorno status {resp.status_code}: {resp.text}")

    except Exception as e:
        logger.warning(f"Ollama local error ({type(e).__name__}: {e}). Activando fallback...")
        # Fallback analítico transparente consultando la base de datos directamente
        kpis = await _execute_tool(db, company_id, "get_sales_kpis", {"periodo_tipo": "mes_actual"})
        final_reply = (
            f"📊 **Auditoría en Tiempo Real de Ventas (MTD):**\n\n"
            f"- **Facturación Acumulada:** Gs. {kpis['facturacion_total_gs']:,d}\n"
            f"- **Margen Ponderado Actual:** **{kpis['margen_actual_pct']}%** (Meta Óptima: {kpis['meta_ideal_pct']}%)\n"
            f"- **Gap Restante para Meta:** Gs. {kpis['gap_para_ideal_gs']:,d}\n"
            f"- **Tickets Auditados:** {kpis['tickets']:,d}\n"
            f"- **Proyección de Cierre Mensual:** Gs. {kpis['proyeccion_cierre_gs']:,d}\n\n"
            f"*(Consulta procesada directamente contra PostgreSQL)*"
        )

    # Prompts sugeridos contextuales
    suggested_prompts = [
        "¿Cuáles son los productos con peor margen?",
        "Ver desglose de Pareto Clase A",
        "Modificar meta general a 22%",
        "Propuestas de precios en Carnicería"
    ]

    return ChatMessageResponse(
        reply=final_reply,
        action_outcome=action_outcome,
        suggested_prompts=suggested_prompts
    )
