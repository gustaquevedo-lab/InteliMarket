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
                # Pasivos exigibles y deuda real consolidada
                "deuda_total_exigible_gs": tower.deuda_total_exigible_gs,
                "deuda_exigible_inmediata_gs": tower.deuda_exigible_inmediata_gs,
                "deuda_cheques_emitidos_total_gs": tower.deuda_cheques_emitidos_total_gs,
                "deuda_cheques_en_fecha_cobro_gs": tower.deuda_cheques_en_fecha_cobro_gs,
                "deuda_cheques_proximos_30d_gs": tower.deuda_cheques_proximos_30d_gs,
                "deuda_facturas_proveedores_total_gs": tower.deuda_facturas_proveedores_total_gs,
                "deuda_facturas_vencidas_mora_gs": tower.deuda_facturas_vencidas_mora_gs,
                "posicion_financiera_neta_gs": tower.posicion_financiera_neta_gs,
                "deficit_cobertura_inmediata_gs": tower.deficit_cobertura_inmediata_gs,
                "ratio_cobertura_inmediata": tower.ratio_cobertura_inmediata,
                "ap_proximos_7d_gs": tower.ap_proximos_7d_gs,
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
            lim = int(arguments.get("limit", 15))
            items = await service.get_supplier_debt_schedule(db, company_id)
            return {"compromisos_proveedores": items[:lim]}

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
2. NUNCA maquilles la situación financiera. Considera SIEMPRE los cheques diferidos emitidos en circulación y las facturas vencidas en mora. Si los pasivos exigibles superan la liquidez disponible, informa con total crudeza el DÉFICIT y la BRECHA DE CAJA, y advierte sobre el riesgo inminente de rechazo de cheques o sobregiro bancario.
3. Si el usuario te pide emitir una directiva al Gerente de Ventas, usa emit_inter_agent_directive.
4. Si el usuario te plantea una hipótesis ("qué pasa si caen 10% las ventas", "si postergamos pagos"), usa simulate_cash_flow_scenario.
5. Entrega diagnósticos con estructura clara: Balance Real, Pasivos Inmediatos, Puntos Críticos de Quiebre de Caja y Acciones Sugeridas.
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
                f"📈 **Proyección Real de Flujo de Caja (30 Días con Pasivos Reales):**\n\n"
                f"- **Disponibilidad Inicial Real:** ₲ {cff.saldo_actual_gs:,.0f}\n"
                f"- **Pasivo Exigible Inmediato (Día 1):** ₲ {cff.pasivo_exigible_inmediato_gs:,.0f} (Cheques en fecha + Facturas en mora)\n"
                f"- **Ingresos Estimados 30d:** ₲ {cff.total_ingresos_30d_gs:,.0f} (Ventas salón + Cobranzas AR)\n"
                f"- **Egresos Totales Comprometidos 30d:** ₲ {cff.total_egresos_30d_gs:,.0f}\n"
                f"  • Cheques diferidos a pagar: ₲ {cff.total_cheques_30d_gs:,.0f}\n"
                f"  • Facturas de proveedores: ₲ {cff.total_facturas_30d_gs:,.0f}\n"
                f"- **Posición Final Estimada (30d):** ₲ {cff.saldo_proyectado_30d_gs:,.0f}\n"
                f"- **Días en Déficit / Riesgo:** {cff.dias_en_riesgo_count} de 30 días\n"
                f"- **Diagnóstico de Tesorería:** **{cff.estado_general_flujo.upper()}**"
            )
        elif "deuda" in msg_l or "proveedor" in msg_l or "factura" in msg_l or "pagar" in msg_l or "cheque" in msg_l:
            items = await service.get_supplier_debt_schedule(db, company_id)
            top_txt = "\n".join([f"- **{it['proveedor']}** ({it['numero_factura']}): ₲ {it['saldo_pendiente_gs']:,.0f} [{it['estado']}]" for it in items[:8]])
            final_reply = (
                f"📑 **Auditoría de Pasivos Comerciales y Deuda Exigible (Base de Datos Real):**\n\n"
                f"- **Deuda Total Exigible:** **₲ {tower.deuda_total_exigible_gs:,.0f}**\n"
                f"  • **Cheques emitidos en circulación:** ₲ {tower.deuda_cheques_emitidos_total_gs:,.0f} ({tower.deuda_cheques_count} cheques)\n"
                f"    - Ya en fecha de cobro / vencidos: ₲ {tower.deuda_cheques_en_fecha_cobro_gs:,.0f}\n"
                f"    - A vencer próximos 30d: ₲ {tower.deuda_cheques_proximos_30d_gs:,.0f}\n"
                f"  • **Facturas de proveedores pendientes:** ₲ {tower.deuda_facturas_proveedores_total_gs:,.0f} ({tower.deuda_facturas_count} facturas)\n"
                f"    - Ya vencidas en mora: ₲ {tower.deuda_facturas_vencidas_mora_gs:,.0f}\n"
                f"    - A vencer próximos 30d: ₲ {tower.deuda_facturas_proximos_30d_gs:,.0f}\n\n"
                f"- **Pasivo Inmediato Exigible Hoy:** **₲ {tower.deuda_exigible_inmediata_gs:,.0f}**\n"
                f"- **Liquidez Disponible:** ₲ {tower.liquidez_total_gs:,.0f}\n"
                f"- **Brecha de Déficit Inmediato:** **₲ {tower.deficit_cobertura_inmediata_gs:,.0f}**\n"
                f"- **Posición Financiera Neta:** **₲ {tower.posicion_financiera_neta_gs:,.0f}**\n\n"
                f"**Principales Compromisos Exigibles:**\n{top_txt or 'Sin compromisos pendientes.'}"
            )
        elif "cliente" in msg_l or "cobrar" in msg_l or "mora" in msg_l:
            ar_data = await service.get_customer_aging_analysis(db, company_id)
            final_reply = (
                f"⚠️ **Auditoría de Créditos a Clientes (Cuentas por Cobrar):**\n\n"
                f"- **Total Cartera:** ₲ {ar_data.get('total_cartera_gs', 0):,.0f}\n"
                f"- **Cartera al Día:** ₲ {ar_data.get('al_dia_gs', 0):,.0f}\n"
                f"- **Mora 1 a 30 días:** ₲ {ar_data.get('mora_1_30_gs', 0):,.0f}\n"
                f"- **Mora más de 60 días:** ₲ {ar_data.get('mora_mas_60_gs', 0):,.0f}\n"
                f"- **Total Clientes Deudores:** {ar_data.get('total_deudores', 0)}"
            )
        else:
            bancos_txt = "\n".join([f"- **{b.banco} ({b.numero_cuenta}):** ₲ {b.saldo_gs:,.0f} {b.moneda}" for b in tower.desglose_bancos])
            final_reply = (
                f"🏦 **Diagnóstico Consolidado de Tesorería y Pasivos (Tiempo Real):**\n\n"
                f"**1. Activos Líquidos Disponibles:** **₲ {tower.liquidez_total_gs:,.0f}**\n"
                f"- Bancos ({len(tower.desglose_bancos)} cuentas): ₲ {tower.bancos_total_gs:,.0f}\n"
                f"{bancos_txt}\n"
                f"- Bóveda Central (Custodia Físico): ₲ {tower.boveda_central_gs:,.0f}\n"
                f"- Cajas POS Salón: ₲ {tower.cajas_pos_gs:,.0f}\n\n"
                f"**2. Pasivos Comerciales Exigibles:** **₲ {tower.deuda_total_exigible_gs:,.0f}**\n"
                f"- Cheques emitidos en circulación: ₲ {tower.deuda_cheques_emitidos_total_gs:,.0f} ({tower.deuda_cheques_count} cheques)\n"
                f"- Facturas comerciales pendientes: ₲ {tower.deuda_facturas_proveedores_total_gs:,.0f} ({tower.deuda_facturas_count} facturas)\n"
                f"- Exigible inmediato (en fecha + mora): ₲ {tower.deuda_exigible_inmediata_gs:,.0f}\n\n"
                f"**3. Diagnóstico de Solvencia:**\n"
                f"- **Posición Financiera Neta:** **₲ {tower.posicion_financiera_neta_gs:,.0f}** (Déficit)\n"
                f"- **Cobertura Inmediata:** {tower.ratio_cobertura_inmediata}x\n"
                f"- **Estado de Tesorería:** **{tower.estado_liquidez.upper()}**"
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
