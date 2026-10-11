"""Orquestador de Inteligencia Financiera Hibrido (Qwen 2.5 7B Local + Gemini Flash).

Implementa un agente ReAct autonomo para el Gerente Financiero IA (CFO Virtual) con
capacidades de Tool-Calling hacia PostgreSQL (Bancos, Boveda, Cajas, AP, AR, Gastos)
y Evolution API. Aprende activamente registrando reglas y directivas en:
- finance_agent_settings (parametros de tesoreria)
- inter_agent_directives (bus formal inter-agente)
- company_business_rules (memoria y politicas del dueno)
"""

import json
import logging
from decimal import Decimal
from typing import Optional, Any, List, Dict
import httpx
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

from api.src.config import settings
from api.src.finance_agent import service
from api.src.finance_agent.schemas import FinanceChatResponse

logger = logging.getLogger("finance_agent_orchestrator")


TOOL_DEFINITIONS = [
    {
        "type": "function",
        "function": {
            "name": "get_liquidity_summary",
            "description": "Obtiene la posicion consolidada de liquidez en tiempo real: saldos de bancos desglosados, efectivo en boveda/custodia, cajas POS en salon, cuentas por pagar (AP) y cobrar (AR).",
            "parameters": {
                "type": "object",
                "properties": {}
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_supplier_debt_schedule",
            "description": "Obtiene el calendario detallado de facturas a pagar a proveedores (AP) ordenadas por fecha de vencimiento y monto.",
            "parameters": {
                "type": "object",
                "properties": {
                    "dias": {
                        "type": "integer",
                        "description": "Ventana de dias hacia adelante (ej. 7, 15, 30). Default: 15"
                    },
                    "limit": {
                        "type": "integer",
                        "description": "Cantidad maxima de proveedores a listar. Default: 8"
                    }
                }
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_customer_aging_analysis",
            "description": "Analiza la cartera de creditos a clientes (AR), identificando morosos, dias de atraso y capital inmovilizado.",
            "parameters": {
                "type": "object",
                "properties": {
                    "solo_morosos": {
                        "type": "boolean",
                        "description": "True para filtrar solo clientes con dias de mora > 0."
                    },
                    "limit": {
                        "type": "integer",
                        "description": "Cantidad maxima de clientes a listar. Default: 5"
                    }
                }
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "simulate_cash_flow_scenario",
            "description": "Ejecuta una simulacion what-if de flujo de caja proyectado a 30 dias con variacion de ventas, prorroga a proveedores o recuperacion de cartera.",
            "parameters": {
                "type": "object",
                "properties": {
                    "variacion_ventas_pct": {
                        "type": "number",
                        "description": "Variacion porcentual de ventas (-20 a +30)."
                    },
                    "prorroga_proveedores_dias": {
                        "type": "integer",
                        "description": "Dias de prorroga acordada con proveedores."
                    },
                    "recuperacion_mora_pct": {
                        "type": "number",
                        "description": "Porcentaje de cobro proyectado de cartera vencida (ej. 30)."
                    }
                }
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "emit_inter_agent_directive",
            "description": "Emite una directiva formal del CFO hacia el Gerente de Ventas (o Compras) persistida en la base de datos.",
            "parameters": {
                "type": "object",
                "properties": {
                    "receptor": {
                        "type": "string",
                        "enum": ["sales_agent", "marketing_agent", "purchases_agent"],
                        "description": "Agente destinatario de la directiva."
                    },
                    "titulo": {"type": "string", "description": "Titulo claro de la directiva."},
                    "mensaje": {"type": "string", "description": "Cuerpo explicativo y meta cuantitativa solicitada."},
                    "accion_sugerida": {"type": "string", "description": "Accion concreta sugerida."},
                    "prioridad": {
                        "type": "string",
                        "enum": ["critica", "alta", "media", "baja"],
                        "description": "Nivel de urgencia."
                    },
                    "impacto_estimado_gs": {"type": "number", "description": "Monto proyectado a recaudar o ahorrar en PYG."}
                },
                "required": ["receptor", "titulo", "mensaje"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "update_treasury_settings",
            "description": "Ajusta las politicas de tesoreria de la empresa: colchon minimo bancario en Gs. o limite de pago diario sin autorizacion.",
            "parameters": {
                "type": "object",
                "properties": {
                    "colchon_minimo_bancos_gs": {"type": "number", "description": "Monto de colchon de reserva minimo en bancos en PYG."},
                    "limite_pago_diario_sin_autorizacion_gs": {"type": "number", "description": "Monto maximo a pagar por dia sin firma de direccion."},
                    "dias_alerta_mora": {"type": "integer", "description": "Dias de mora a partir de los cuales levantar alerta roja."}
                }
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "learn_finance_business_rule",
            "description": "Guarda una regla o preferencia de tesoreria del dueno en la memoria permanente del Gerente Financiero IA.",
            "parameters": {
                "type": "object",
                "properties": {
                    "regla": {"type": "string", "description": "Texto descriptivo de la regla o politica."},
                    "categoria": {"type": "string", "description": "Categoria (tesoreria, bancos, cheques, proveedores, etc)."}
                },
                "required": ["regla"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "send_finance_whatsapp_alert",
            "description": "Envia una notificacion urgente de tesoreria o cobranzas por WhatsApp.",
            "parameters": {
                "type": "object",
                "properties": {
                    "telefono": {"type": "string", "description": "Numero con codigo de pais (ej. 595981123456)."},
                    "mensaje": {"type": "string", "description": "Texto del mensaje ejecutivo."}
                },
                "required": ["telefono", "mensaje"]
            }
        }
    }
]


async def _execute_finance_tool(db: AsyncSession, company_id: str, tool_name: str, arguments: dict) -> dict:
    """Ejecuta la herramienta de tesoreria contra PostgreSQL o integraciones."""
    try:
        if tool_name == "get_liquidity_summary":
            tower = await service.get_liquidity_control_tower(db, company_id)
            return {
                "liquidez_total_gs": tower.liquidez_total_gs,
                "bancos_total_gs": tower.bancos_total_gs,
                "boveda_central_gs": tower.boveda_central_gs,
                "cajas_pos_gs": tower.cajas_pos_gs,
                "cuentas_bancarias": [
                    {"banco": b.banco, "cuenta": b.numero_cuenta, "saldo_gs": b.saldo_gs, "moneda": b.moneda}
                    for b in tower.desglose_bancos
                ],
                "ap_proximos_7d_gs": tower.ap_proximos_7d_gs,
                "ap_proximos_15d_gs": tower.ap_proximos_15d_gs,
                "ap_total_mes_gs": tower.ap_total_mes_gs,
                "ar_vigente_gs": tower.ar_vigente_gs,
                "ar_moroso_gs": tower.ar_moroso_gs,
                "ar_total_gs": tower.ar_total_gs,
                "cash_runway_dias": tower.cash_runway_dias,
                "cobertura_7d_ratio": tower.cobertura_7d_ratio,
                "estado_liquidez": tower.estado_liquidez,
                "margen_bruto_mes_pct": tower.margen_bruto_mes_pct
            }

        elif tool_name == "get_supplier_debt_schedule":
            dias = int(arguments.get("dias", 15))
            lim = int(arguments.get("limit", 8))
            return await service.get_supplier_debt_schedule_data(db, company_id, dias=dias, limit=lim)

        elif tool_name == "get_customer_aging_analysis":
            solo_mora = bool(arguments.get("solo_morosos", True))
            lim = int(arguments.get("limit", 5))
            return await service.get_customer_aging_analysis_data(db, company_id, solo_morosos=solo_mora, limit=lim)

        elif tool_name == "simulate_cash_flow_scenario":
            v_pct = float(arguments.get("variacion_ventas_pct", 0.0))
            p_dias = int(arguments.get("prorroga_proveedores_dias", 0))
            rec_mora = float(arguments.get("recuperacion_mora_pct", 0.0))
            sim = await service.simulate_cash_flow(
                db, company_id,
                variacion_ventas_pct=v_pct,
                prorroga_proveedores_dias=p_dias,
                recuperacion_mora_pct=rec_mora
            )
            return {
                "saldo_actual_gs": sim.saldo_actual_gs,
                "saldo_base_30d_gs": sim.saldo_proyectado_30d_base_gs,
                "saldo_simulado_30d_gs": sim.saldo_proyectado_30d_simulado_gs,
                "impacto_neto_gs": sim.impacto_neto_gs,
                "dias_en_riesgo_base": sim.dias_en_riesgo_base,
                "dias_en_riesgo_simulado": sim.dias_en_riesgo_simulado,
                "conclusion_cfo": sim.conclusion_cfo
            }

        elif tool_name == "emit_inter_agent_directive":
            rec = arguments["receptor"]
            tit = arguments["titulo"]
            msg = arguments["mensaje"]
            acc = arguments.get("accion_sugerida")
            prio = arguments.get("prioridad", "alta")
            imp = float(arguments.get("impacto_estimado_gs", 0.0))
            d = await service.create_inter_agent_directive(
                db, company_id,
                emisor="cfo_agent",
                receptor=rec,
                titulo=tit,
                mensaje=msg,
                accion_sugerida=acc,
                prioridad=prio,
                impacto_estimado_gs=imp
            )
            return {
                "success": True,
                "codigo": d.codigo,
                "titulo": d.titulo,
                "receptor": d.receptor,
                "impacto_estimado_gs": float(d.impacto_estimado_gs or 0)
            }

        elif tool_name == "update_treasury_settings":
            colchon = arguments.get("colchon_minimo_bancos_gs")
            limite = arguments.get("limite_pago_diario_sin_autorizacion_gs")
            dias_mora = arguments.get("dias_alerta_mora")
            cfg = await service.update_finance_settings(
                db, company_id,
                colchon_minimo_bancos_gs=colchon,
                limite_pago_diario_sin_autorizacion_gs=limite,
                dias_alerta_mora=dias_mora
            )
            return {
                "success": True,
                "colchon_minimo_bancos_gs": float(cfg.colchon_minimo_bancos_gs),
                "limite_pago_diario_sin_autorizacion_gs": float(cfg.limite_pago_diario_sin_autorizacion_gs),
                "dias_alerta_mora": cfg.dias_alerta_mora
            }

        elif tool_name == "learn_finance_business_rule":
            regla = arguments["regla"]
            cat = arguments.get("categoria", "tesoreria")
            res = await service.save_finance_business_rule(db, company_id, regla, cat, origen="chat_cfo")
            return {"success": True, "regla": regla, "categoria": cat}

        elif tool_name == "send_finance_whatsapp_alert":
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
                return {"success": resp.status_code in (200, 201), "status": resp.status_code}

        return {"error": f"Herramienta desconocida: {tool_name}"}

    except Exception as e:
        logger.error(f"Error ejecutando herramienta financiera {tool_name}: {e}")
        return {"error": str(e)}


async def chat_with_cfo_agent(
    db: AsyncSession,
    company_id: str,
    message: str,
    conversation_history: Optional[List[Dict[str, str]]] = None
) -> FinanceChatResponse:
    """Procesa consultas financieras ejecutivas con ReAct Tool Calling y conexion a PostgreSQL."""
    # 1. Cargar politicas de tesoreria y reglas aprendidas
    cfg = await service.get_or_create_finance_settings(db, company_id)
    reglas = await service.list_finance_business_rules(db, company_id)
    reglas_txt = "\n".join([f"- {r.regla} (Categoría: {r.categoria or 'General'})" for r in reglas[:8]])
    if not reglas_txt:
        reglas_txt = f"- Mantener colchon bancario minimo de Gs. {float(cfg.colchon_minimo_bancos_gs):,.0f} para emergencias operativas.\n- Priorizar pago de proveedores perecederos sobre fijos."

    system_prompt = f"""Sos el Director Financiero IA (CFO Virtual) de Extra Supermercado (Intelimarket).
Tu misión es vigilar la liquidez, proteger la caja, auditar compromisos a proveedores (AP), acelerar la cobranza a clientes (AR), simular escenarios de tesorería y coordinar directivas cuantitativas con el Gerente de Ventas y Compras.
Hablas con tono ejecutivo, analítico, seguro, preventivo y en español rioplatense/paraguayo corporativo.
Usa SIEMPRE la moneda Guaraníes (Gs. o ₲) formateada como entero con separadores de miles (ej: Gs. 50.000.000).

PARÁMETROS Y POLÍTICAS DE TESORERÍA ACTUALES:
- Colchón Mínimo en Bancos: Gs. {float(cfg.colchon_minimo_bancos_gs):,.0f}
- Límite de Pago Diario sin Autorización: Gs. {float(cfg.limite_pago_diario_sin_autorizacion_gs):,.0f}
- Alerta Roja de Mora en Clientes: > {cfg.dias_alerta_mora} días

MEMORIA Y REGLAS DE NEGOCIO DEL DUEÑO:
{reglas_txt}

REGLAS DE ACTUACIÓN:
1. NUNCA inventes saldos bancarios ni facturas. Usa SIEMPRE get_liquidity_summary, get_supplier_debt_schedule o get_customer_aging_analysis.
2. Si el usuario te pide emitir una directiva al Gerente de Ventas, usa emit_inter_agent_directive.
3. Si el usuario te plantea una hipótesis ("qué pasa si caen 10% las ventas", "si postergamos pagos"), usa simulate_cash_flow_scenario.
4. Entrega diagnósticos con estructura clara: Balance, Puntos Críticos y Acciones Sugeridas.
"""

    messages = [{"role": "system", "content": system_prompt}]

    if conversation_history:
        for ch in conversation_history[-6:]:
            if ch.get("role") in ("user", "assistant"):
                messages.append({"role": ch["role"], "content": ch.get("content", "")})

    messages.append({"role": "user", "content": message})

    base_u = settings.ollama_base_url.replace("/v1", "").rstrip("/")
    ollama_url = f"{base_u}/api/chat"
    model_name = getattr(settings, "ollama_model", "qwen2.5:7b")

    final_reply = ""
    action_proposal = None
    tools_executed = []
    provider_used = "ollama_local"

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

                        tool_res = await _execute_finance_tool(db, company_id, t_name, t_args)
                        tools_executed.append({"tool": t_name, "args": t_args, "result": tool_res})

                        messages.append({
                            "role": "tool",
                            "tool_call_id": tc.get("id", f"call_{t_name}"),
                            "name": t_name,
                            "content": json.dumps(tool_res)
                        })

                        if t_name == "emit_inter_agent_directive":
                            action_proposal = {
                                "tipo": "inter_agent_directive",
                                "titulo": f"Directiva Emitida: {t_args.get('titulo')}",
                                "descripcion": f"Enviada al {t_args.get('receptor')}. Impacto: Gs. {int(t_args.get('impacto_estimado_gs', 0)):,d}",
                                "data": tool_res
                            }
                        elif t_name == "update_treasury_settings":
                            action_proposal = {
                                "tipo": "settings_update",
                                "titulo": "Políticas de Tesorería Actualizadas",
                                "descripcion": f"Colchón bancario ajustado a Gs. {int(t_args.get('colchon_minimo_bancos_gs', 0)):,d}",
                                "data": tool_res
                            }

                    # Segunda pasada con explicacion ejecutiva
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
                        final_reply = "Se han ejecutado las consultas y directivas financieras correspondientes en la base de datos."
                else:
                    final_reply = msg_choice.get("content", "")
            else:
                raise Exception(f"Ollama local retorno status {resp.status_code}: {resp.text}")

    except Exception as e:
        logger.warning(f"Ollama local error en CFO ({type(e).__name__}: {e}). Activando fallback analitico fidedigno...")
        provider_used = "sql_analytical_engine"

        # Fallback analitico 100% fidedigno usando los datos de PostgreSQL
        tower = await service.get_liquidity_control_tower(db, company_id)
        msg_l = message.lower()

        if "flujo" in msg_l or "proyec" in msg_l or "simula" in msg_l:
            cff = await service.get_cash_flow_forecast(db, company_id)
            final_reply = (
                f"📈 **Proyección Ejecutiva de Flujo de Caja (30 Días):**\n\n"
                f"- **Liquidez Inicial Consolidada:** Gs. {cff.saldo_actual_gs:,.0f}\n"
                f"- **Ingresos Estimados 30d:** Gs. {cff.total_ingresos_30d_gs:,.0f} (Ventas en salón modeladas por día + Cobranzas AR)\n"
                f"- **Egresos Comprometidos 30d:** Gs. {cff.total_egresos_30d_gs:,.0f} (Facturas de proveedores + Reposición de mercadería CMV + Nómina)\n"
                f"- **Saldo Proyectado a Cierre de Mes:** Gs. {cff.saldo_proyectado_30d_gs:,.0f}\n"
                f"- **Días en Alerta / Déficit:** {cff.dias_en_riesgo_count} días\n\n"
                f"💡 *Recomendación:* Mantener la disciplina en el pago a proveedores y sincronizar con Ventas para monetizar el sobrestock."
            )
        elif "proveedor" in msg_l or "factura" in msg_l or "pagar" in msg_l:
            ap_data = await service.get_supplier_debt_schedule_data(db, company_id, dias=15, limit=5)
            prov_txt = "\n".join([f"- **{p['proveedor']}:** Gs. {p['saldo_pendiente_gs']:,.0f} (Vto: {p['fecha_vencimiento']})" for p in ap_data.get("facturas", [])])
            final_reply = (
                f"📑 **Compromisos con Proveedores (Próximos 15 Días):**\n\n"
                f"- **Total a pagar en 7 días:** Gs. {tower.ap_proximos_7d_gs:,.0f}\n"
                f"- **Total a pagar en 15 días:** Gs. {tower.ap_proximos_15d_gs:,.0f}\n"
                f"- **Total general pendiente:** Gs. {tower.ap_total_mes_gs:,.0f} ({tower.ap_facturas_pendientes_count} facturas)\n\n"
                f"**Principales Vencimientos:**\n{prov_txt or 'Sin facturas venciendo en esta ventana.'}"
            )
        elif "cliente" in msg_l or "cobrar" in msg_l or "mora" in msg_l:
            ar_data = await service.get_customer_aging_analysis_data(db, company_id, solo_morosos=True, limit=5)
            clie_txt = "\n".join([f"- **{c['cliente']}:** Gs. {c['saldo_deudor_gs']:,.0f} (Mora: {c['dias_mora_max']} días) — {c['accion_sugerida']}" for c in ar_data.get("clientes_en_riesgo", [])])
            final_reply = (
                f"⚠️ **Auditoría de Créditos a Clientes (Cuentas por Cobrar):**\n\n"
                f"- **Cartera Vigente al Día:** Gs. {tower.ar_vigente_gs:,.0f}\n"
                f"- **Cartera Vencida en Mora:** Gs. {tower.ar_moroso_gs:,.0f}\n"
                f"- **Clientes Morosos:** {tower.ar_clientes_morosos_count}\n\n"
                f"**Casos Críticos:**\n{clie_txt or 'Sin clientes con mora activa superior a 15 días.'}"
            )
        else:
            bancos_txt = "\n".join([f"- **{b.banco} ({b.numero_cuenta}):** Gs. {b.saldo_gs:,.0f} {b.moneda}" for b in tower.desglose_bancos])
            final_reply = (
                f"🏦 **Diagnóstico Consolidado de Tesorería y Liquidez (Tiempo Real):**\n\n"
                f"La **Posición Consolidada de Liquidez** asciende a **Gs. {tower.liquidez_total_gs:,.0f}**:\n\n"
                f"1. **Disponibilidad Bancaria:** Gs. {tower.bancos_total_gs:,.0f} ({len(tower.desglose_bancos)} cuentas)\n"
                f"{bancos_txt}\n\n"
                f"2. **Custodia y Bóveda Central:** Gs. {tower.boveda_central_gs:,.0f}\n"
                f"3. **Cajas POS en Salón Hoy:** Gs. {tower.cajas_pos_gs:,.0f}\n\n"
                f"**Indicadores Clave:**\n"
                f"- **Cobertura a 7 Días:** {tower.cobertura_7d_ratio}x sobre compromisos de proveedores (Gs. {tower.ap_proximos_7d_gs:,.0f})\n"
                f"- **Cash Runway Estimado:** {tower.cash_runway_dias} días de operación\n"
                f"- **Estado de Liquidez:** **{tower.estado_liquidez.upper()}**"
            )

    suggestions = [
        "¿Cuáles son los vencimientos de proveedores de la semana?",
        "Simular caída del 15% en ventas",
        "Emitir directiva a Ventas para liquidar sobrestock",
        "Ver clientes con más de 15 días de mora"
    ]

    return FinanceChatResponse(
        response=final_reply,
        suggestions=suggestions,
        action_proposal=action_proposal,
        tools_executed=tools_executed,
        provider_used=provider_used
    )
