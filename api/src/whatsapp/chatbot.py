"""
IntelliZapp Chatbot Engine - Interactive menu system with conversation flows
Personalizado y conectado a la base de datos real de Extra Supermercado
"""
from typing import Optional, Dict, Any, List
from uuid import UUID
from datetime import datetime, timezone
from zoneinfo import ZoneInfo
import re
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, func, or_
from sqlalchemy.orm.attributes import flag_modified
from api.src.whatsapp.models import WhatsAppMessage, WhatsAppConversation
from api.src.whatsapp.service import get_wa_template
from api.src.products.models import Product
from api.src.sales.models import Sale
from api.src.customers.models import Customer
from api.src.loyalty.models import LoyaltyPoints
from api.src.inventory.models import StockLot
from api.src.companies.models import Company
from api.src.promotions.models import Promotion
from api.src.cupones.models import CuponTicket


DEFAULT_BOT_FLOW = {
    "id": "flow-supermercado-master",
    "name": "Flujo Oficial Extra Supermercado",
    "active": True,
    "nodes": [
        {
            "id": "start",
            "title": "Bienvenida y Menú Principal",
            "type": "buttons",
            "content": "¡Hola {cliente}! 👋 Bienvenido al canal oficial de atención de *Extra Supermercado Mayorista* 🛒✨\n\n¿En qué podemos ayudarte hoy?",
            "footer": "Extra Supermercado • Elija una opción",
            "buttons": [
                {"id": "btn_puntos", "text": "⭐ Mis Puntos", "type": "reply", "next_node": "node_puntos"},
                {"id": "btn_ofertas", "text": "🔥 Ofertas del Día", "type": "reply", "next_node": "node_ofertas"},
                {"id": "btn_mas_opciones", "text": "📋 Más Opciones", "type": "reply", "next_node": "node_lista_servicios"},
            ],
            "trigger_keywords": ["hola", "buenas", "buen dia", "buenas tardes", "buenas noches", "menu", "inicio", "empezar", "0"],
        },
        {
            "id": "node_puntos",
            "title": "Saldo ExtraClub",
            "type": "action",
            "action_type": "extraclub_points",
            "content": "⭐ *Tu Saldo ExtraClub — Extra Supermercado* ⭐\n\n👤 Titular: *{cliente}*\n💳 Doc: *{documento}*\n✨ Puntos Disponibles: *{puntos} Pts.*\n💰 Equivalente en Compras: *Gs. {valor_monetario}*\n\n🛒 _Podés canjear tus puntos directamente en línea de caja en tu próxima compra._",
            "footer": "1 Punto = Gs. 100",
            "buttons": [
                {"id": "btn_premios", "text": "🎁 Premios Temporada", "type": "reply", "next_node": "node_premios"},
                {"id": "btn_cupones", "text": "🎟️ Mis Cupones", "type": "reply", "next_node": "node_cupones"},
                {"id": "btn_volver", "text": "⬅️ Menú Principal", "type": "reply", "next_node": "start"},
            ],
            "trigger_keywords": ["puntos", "saldo", "extraclub", "puntos acumulados", "cuanto tengo"],
        },
        {
            "id": "node_ofertas",
            "title": "Promociones y Ofertas",
            "type": "action",
            "action_type": "promotions_active",
            "content": "🔥 *OFERTAS Y PROMOCIONES ACTIVAS EN EXTRA SUPERMERCADO* 🔥\n\n{promociones_texto}\n\n¡Te esperamos en nuestro salón con los mejores precios del país!",
            "footer": "Precios vigentes hasta agotar stock",
            "buttons": [
                {"id": "btn_catalogo_web", "text": "🌐 Ver Tienda Web", "type": "url", "url": "https://superextra.com.py"},
                {"id": "btn_cupones", "text": "🎟️ Mis Cupones", "type": "reply", "next_node": "node_cupones"},
                {"id": "btn_volver", "text": "⬅️ Menú Principal", "type": "reply", "next_node": "start"},
            ],
            "trigger_keywords": ["ofertas", "oferta", "promociones", "promo", "descuentos", "rebajas"],
        },
        {
            "id": "node_cupones",
            "title": "Cupones de Sorteo",
            "type": "action",
            "action_type": "sorteo_cupones",
            "content": "🎟️ *Tus Cupones de Sorteo — Extra Supermercado*\n\n👤 Cliente: *{cliente}* (Doc: {documento})\n🏆 Campaña: *{campana_sorteo}*\n\n🎯 Tenés un total de *{cupones_totales} cupones acumulados* a tu nombre.\n¡Cada compra que realizás en caja te suma más chances automáticas!",
            "footer": "Sorteo oficial Extra Supermercado",
            "buttons": [
                {"id": "btn_puntos", "text": "⭐ Mis Puntos", "type": "reply", "next_node": "node_puntos"},
                {"id": "btn_ofertas", "text": "🔥 Ver Ofertas", "type": "reply", "next_node": "node_ofertas"},
                {"id": "btn_volver", "text": "⬅️ Menú Principal", "type": "reply", "next_node": "start"},
            ],
            "trigger_keywords": ["cupones", "sorteo", "cupon", "sorteos", "mis cupones"],
        },
        {
            "id": "node_lista_servicios",
            "title": "Menú Extendido (Lista)",
            "type": "list",
            "content": "Por favor seleccioná el servicio o departamento que deseás consultar:",
            "button_text": "Ver Servicios 📋",
            "footer": "Extra Supermercado Mayorista",
            "sections": [
                {
                    "title": "Fidelidad & Sorteos",
                    "rows": [
                        {"id": "opt_pts", "title": "⭐ Saldo de Puntos", "description": "Consultá tus puntos ExtraClub acumulados", "next_node": "node_puntos"},
                        {"id": "opt_cup", "title": "🎟️ Cupones de Sorteos", "description": "Tus cupones para el sorteo del año", "next_node": "node_cupones"},
                        {"id": "opt_pre", "title": "🎁 Catálogo de Premios", "description": "Electrodomésticos y canjes disponibles", "next_node": "node_premios"},
                    ],
                },
                {
                    "title": "Compras & Envíos",
                    "rows": [
                        {"id": "opt_ofe", "title": "🔥 Ofertas del Día", "description": "Precios especiales y descuentos relámpago", "next_node": "node_ofertas"},
                        {"id": "opt_del", "title": "🚚 Envíos a Domicilio", "description": "Costos y zonas de cobertura de delivery", "next_node": "node_delivery"},
                        {"id": "opt_ban", "title": "💳 Cuentas Bancarias & Pagos", "description": "Datos para transferencias y PIX", "next_node": "node_banco"},
                    ],
                },
                {
                    "title": "Atención al Cliente",
                    "rows": [
                        {"id": "opt_suc", "title": "📍 Sucursales & Horarios", "description": "Ubicación en Google Maps y horarios", "next_node": "node_sucursales"},
                        {"id": "opt_hum", "title": "👤 Hablar con un Asesor", "description": "Transferir chat a una persona de soporte", "next_node": "node_humano"},
                    ],
                },
            ],
            "trigger_keywords": ["servicios", "opciones", "mas", "lista"],
        },
        {
            "id": "node_premios",
            "title": "Catálogo de Premios",
            "type": "message",
            "content": "🎁 *Premios Disponibles para Canje ExtraClub:*\n\n☕ *1.500 Pts:* Pava Eléctrica Inox 1.8L\n🍳 *2.500 Pts:* Set de Sartenes Antiadherentes\n🥪 *3.500 Pts:* Sandwichera Grill Antiadherente\n💨 *7.000 Pts:* Freidora de Aire Digital 4.5L\n🍲 *12.000 Pts:* Horno Eléctrico de Mesa 45L\n📺 *25.000 Pts:* Smart TV 43\" Full HD\n\n💡 _También podés canjear tus puntos por dinero directo en caja (1 Punto = Gs. 100)._",
            "footer": "Canje directo en línea de caja",
            "buttons": [
                {"id": "btn_puntos", "text": "⭐ Mis Puntos", "type": "reply", "next_node": "node_puntos"},
                {"id": "btn_humano", "text": "👤 Solicitar Canje", "type": "reply", "next_node": "node_humano"},
                {"id": "btn_volver", "text": "⬅️ Menú Principal", "type": "reply", "next_node": "start"},
            ],
            "trigger_keywords": ["premios", "canjes", "catalogo de premios"],
        },
        {
            "id": "node_delivery",
            "title": "Delivery & Envíos",
            "type": "message",
            "content": "🚚 *Envíos a Domicilio — Extra Supermercado*\n\n🕒 *Horario:* Lunes a Sábados de 08:00 a 19:00 hs.\n📍 *Cobertura:* Radio de hasta 15 km de nuestras sucursales.\n💵 *Costo de envío:* Gs. 15.000 (¡Envío GRATIS en compras a partir de Gs. 300.000!).\n\nPodés pasarnos tu lista de compras directamente por este medio.",
            "footer": "Envíos en el día con cadena de frío",
            "buttons": [
                {"id": "btn_pedir", "text": "👤 Pedir a un Asesor", "type": "reply", "next_node": "node_humano"},
                {"id": "btn_ofertas", "text": "🔥 Ver Ofertas", "type": "reply", "next_node": "node_ofertas"},
                {"id": "btn_volver", "text": "⬅️ Menú Principal", "type": "reply", "next_node": "start"},
            ],
            "trigger_keywords": ["delivery", "envio", "envíos", "domicilio", "flete"],
        },
        {
            "id": "node_banco",
            "title": "Datos Bancarios y Pagos",
            "type": "message",
            "content": "💳 *Datos Bancarios Oficiales — Extra Supermercado*\n\n🏦 *Banco:* Banco Continental\n📄 *Razón Social:* GRUPO SANTA TERESA E.A.S.\n🆔 *RUC:* 80150377-9\n🔢 *Cta. Cte. Gs:* 01-2345678-01\n📲 *Alias / PIX:* compras@superextra.com.py\n\n_Por favor envianos tu comprobante por este medio una vez realizada la transferencia._",
            "footer": "Cuentas oficiales verificadas",
            "buttons": [
                {"id": "btn_enviar_comp", "text": "👤 Hablar con Asesor", "type": "reply", "next_node": "node_humano"},
                {"id": "btn_volver", "text": "⬅️ Menú Principal", "type": "reply", "next_node": "start"},
            ],
            "trigger_keywords": ["transferencia", "banco", "alias", "pix", "datos bancarios", "pagar"],
        },
        {
            "id": "node_sucursales",
            "title": "Sucursales & Horarios",
            "type": "buttons",
            "content": "📍 *Sucursales & Horarios — Extra Supermercado*\n\n🕒 *Horario de Atención:*\n• Lunes a Sábados: 07:00 a 21:00 hs\n• Domingos: 07:30 a 13:00 hs\n\n📌 *Casa Central:* Av. Carlos Antonio López y Curupayty, Pedro Juan Caballero, Paraguay.",
            "footer": "Estacionamiento propio y seguridad privada",
            "buttons": [
                {"id": "btn_maps", "text": "📍 Abrir en Google Maps", "type": "url", "url": "https://maps.google.com/?q=Extra+Supermercado+Mayorista"},
                {"id": "btn_humano", "text": "👤 Hablar con Asesor", "type": "reply", "next_node": "node_humano"},
                {"id": "btn_volver", "text": "⬅️ Menú Principal", "type": "reply", "next_node": "start"},
            ],
            "trigger_keywords": ["horario", "horarios", "ubicacion", "sucursales", "donde estan", "direccion"],
        },
        {
            "id": "node_humano",
            "title": "Transferencia a Operador Humano",
            "type": "action",
            "action_type": "human_handoff",
            "content": "👤 *¡Un asesor de atención al cliente se pondrá en contacto contigo a la brevedad!*\n\nHemos pausado la respuesta automática para que un operador humano pueda responderte de forma personalizada.\n\n_Si deseás volver al bot en cualquier momento, enviá *0* o *MENU*._",
            "footer": "Atención personalizada Extra",
            "buttons": [
                {"id": "btn_volver", "text": "⬅️ Reactivar Menú Bot", "type": "reply", "next_node": "start"},
            ],
            "trigger_keywords": ["asesor", "humano", "persona", "operador", "ayuda", "representante"],
        },
    ],
}


class ChatbotFlow:
    """State machine for multi-step conversations"""

    STATES = {
        "idle": "Esperando interacción del cliente",
        "menu_main": "Menú principal desplegado",
        "menu_products": "Catálogo y búsqueda de productos",
        "menu_orders": "Gestión de compras y pedidos",
        "menu_support": "Información y soporte de atención",
        "product_search": "Búsqueda de producto en base de datos",
        "order_status": "Verificación de compra por número",
        "order_history": "Historial de compras del cliente",
        "support_contact": "Transferencia a operador humano",
        "extraclub_info": "Consulta de cuenta ExtraClub",
    }

    @staticmethod
    def get_state_description(state: str) -> str:
        return ChatbotFlow.STATES.get(state, "Estado activo")


class ChatbotEngine:
    """Core chatbot logic con menús interactivos y datos 100% reales"""

    def __init__(self, db: AsyncSession, company_or_tenant_id: UUID):
        self.db = db
        self.entity_id = company_or_tenant_id
        self._company_id: Optional[UUID] = None
        self._config: Optional[Dict[str, Any]] = None

    async def get_company_id(self) -> UUID:
        if self._company_id:
            return self._company_id
        # Verificar si entity_id es un company_id directo
        stmt = select(Company.id).where(Company.id == self.entity_id)
        res = await self.db.execute(stmt)
        cid = res.scalar_one_or_none()
        if cid:
            self._company_id = cid
            return cid
        # De lo contrario buscar la compañía del tenant
        stmt2 = select(Company.id).where(Company.tenant_id == self.entity_id).limit(1)
        res2 = await self.db.execute(stmt2)
        cid2 = res2.scalar_one_or_none()
        if cid2:
            self._company_id = cid2
            return cid2
        # Fallback a la compañía por defecto de supermercado
        self._company_id = UUID("00000000-0000-0000-0000-000000000010")
        return self._company_id

    async def get_config(self) -> Dict[str, Any]:
        if self._config is not None:
            return self._config
        from api.src.tenants.models import Tenant
        tenant = None
        stmt = select(Tenant).where(Tenant.id == self.entity_id)
        res = await self.db.execute(stmt)
        tenant = res.scalar_one_or_none()
        if not tenant:
            c_res = await self.db.execute(select(Company.tenant_id).where(Company.id == self.entity_id))
            tid = c_res.scalar_one_or_none()
            if tid:
                t_res = await self.db.execute(select(Tenant).where(Tenant.id == tid))
                tenant = t_res.scalar_one_or_none()
        if not tenant:
            f_res = await self.db.execute(select(Tenant).limit(1))
            tenant = f_res.scalar_one_or_none()

        t_cfg = (tenant.config or {}) if tenant else {}
        user_bot_cfg = t_cfg.get("chatbot", {})
        merged = {**DEFAULT_CHATBOT_CONFIG, **user_bot_cfg}
        if "keywords" not in user_bot_cfg:
            merged["keywords"] = DEFAULT_CHATBOT_CONFIG["keywords"]
        if "custom_menu_options" not in user_bot_cfg:
            merged["custom_menu_options"] = DEFAULT_CHATBOT_CONFIG["custom_menu_options"]
        if "flow" not in user_bot_cfg or not user_bot_cfg["flow"]:
            merged["flow"] = DEFAULT_BOT_FLOW
        self._config = merged
        return self._config

    async def _render_flow_node(self, node: dict[str, Any], conversation: WhatsAppConversation) -> dict[str, Any]:
        """Renderiza un nodo del flujo visual con datos dinámicos reales de Extra Supermercado"""
        company_id = await self.get_company_id()
        phone_digits = re.sub(r"\D", "", conversation.contact_phone)
        last_digits = phone_digits[-8:] if len(phone_digits) >= 8 else phone_digits

        # Buscar cliente registrado
        stmt = select(Customer).where(
            Customer.company_id == company_id,
            Customer.telefono.ilike(f"%{last_digits}%")
        ).limit(1)
        res = await self.db.execute(stmt)
        customer = res.scalar_one_or_none()

        cliente_nombre = (customer.razon_social or customer.nombre or conversation.contact_name or "Cliente").strip() if customer else (conversation.contact_name or "Cliente")
        documento = (customer.ci or customer.ruc or "").strip() if customer else ""
        socio_numero = (getattr(customer, "extra_club_numero", None) or getattr(customer, "socio_numero", None) or "").strip() if customer else ""

        # Puntos ExtraClub verídicos
        total_pts = 0
        if customer:
            stmt_pts = select(func.coalesce(func.sum(LoyaltyPoints.puntos), 0)).where(
                LoyaltyPoints.customer_id == customer.id
            )
            pts_res = await self.db.execute(stmt_pts)
            total_pts = int(pts_res.scalar() or 0)
        puntos_str = f"{total_pts:,}".replace(",", ".")
        valor_monetario_str = f"{total_pts * 100:,}".replace(",", ".")

        # Cupones de sorteos acumulados
        cupones_tot = 0
        campana_sorteo = "Gran Sorteo Aniversario Extra Supermercado"
        if customer:
            try:
                tot_res = await self.db.execute(
                    select(func.coalesce(func.sum(CuponTicket.cantidad), 0)).where(
                        CuponTicket.cliente_id == customer.id
                    )
                )
                cupones_tot = int(tot_res.scalar() or 0)
            except Exception:
                pass
        cupones_str = f"{cupones_tot:,}".replace(",", ".")

        # Promociones vigentes
        promociones_texto = ""
        action_type = node.get("action_type")
        if action_type == "promotions_active":
            py_today = datetime.now(ZoneInfo("America/Asuncion")).date()
            p_stmt = (
                select(Promotion)
                .where(
                    Promotion.company_id == company_id,
                    Promotion.estado == "activa",
                    Promotion.valido_desde <= py_today,
                    Promotion.valido_hasta >= py_today,
                )
                .order_by(Promotion.created_at.desc())
                .limit(6)
            )
            p_res = await self.db.execute(p_stmt)
            promos = list(p_res.scalars().all())
            if promos:
                promo_lines = []
                for idx, p in enumerate(promos, 1):
                    if p.tipo == "precio_fijo_oferta" and p.precio_fijo_promocional:
                        pr_str = f"Gs. {int(float(p.precio_fijo_promocional)):,}".replace(",", ".")
                        promo_lines.append(f"{idx}️⃣ *{p.nombre}* 🏷️ {pr_str}")
                    elif p.tipo == "porcentaje" and p.valor:
                        promo_lines.append(f"{idx}️⃣ *{p.nombre}* 🏷️ *{int(p.valor)}% OFF*")
                    elif p.tipo == "dos_por_uno":
                        promo_lines.append(f"{idx}️⃣ *{p.nombre}* 🏷️ *¡2x1!*")
                    else:
                        promo_lines.append(f"{idx}️⃣ *{p.nombre}*")
                promociones_texto = "\n".join(promo_lines)
            else:
                promociones_texto = "• Costilla de Primera: Gs. 34.000/Kg\n• Arroz Supremo 5Kg: Gs. 24.500\n• Aceite de Soja 900ml: Gs. 8.500"

        # Traspaso a operador humano
        if action_type == "human_handoff":
            conversation.status = "needs_human"
            await self.db.commit()

        # Reemplazar variables dinámicas en el texto del nodo
        raw_text = node.get("content", "")
        formatted_text = raw_text.replace("{cliente}", cliente_nombre)
        formatted_text = formatted_text.replace("{documento}", documento or "No registrado")
        formatted_text = formatted_text.replace("{socio_numero}", socio_numero or "No registrado")
        formatted_text = formatted_text.replace("{puntos}", puntos_str)
        formatted_text = formatted_text.replace("{valor_monetario}", valor_monetario_str)
        formatted_text = formatted_text.replace("{cupones_totales}", cupones_str)
        formatted_text = formatted_text.replace("{campana_sorteo}", campana_sorteo)
        formatted_text = formatted_text.replace("{promociones_texto}", promociones_texto)

        return {
            "text": formatted_text,
            "type": node.get("type", "buttons" if node.get("buttons") else "message"),
            "buttons": node.get("buttons", []),
            "sections": node.get("sections", []),
            "button_text": node.get("button_text", "Ver Opciones 📋"),
            "title": node.get("title", "Extra Supermercado"),
            "footer": node.get("footer", "Extra Supermercado Mayorista"),
            "next_state": node.get("id"),
        }

    async def _process_visual_flow(
        self,
        conversation: WhatsAppConversation,
        user_input: str,
        flow: dict[str, Any]
    ) -> Optional[dict[str, Any]]:
        nodes = flow.get("nodes") or []
        if not nodes:
            return None
        node_map = {n["id"]: n for n in nodes}
        start_node = node_map.get("start") or nodes[0]

        current_node_id = conversation.session_state or "start"
        current_node = node_map.get(current_node_id) or start_node

        target_node = None

        # 1. Comandos universales de reinicio al menú principal
        if user_input in ["0", "menu", "inicio", "volver", "start", "cancelar", "reiniciar"]:
            target_node = start_node

        # 2. Búsqueda de coincidencia en botones del nodo actual
        if not target_node and current_node:
            for idx, b in enumerate(current_node.get("buttons", [])):
                b_id = str(b.get("id", "")).strip().lower()
                b_text = str(b.get("text", "") or b.get("displayText", "")).strip().lower()
                b_next = b.get("next_node")
                if b_next and (user_input == b_id or user_input == b_text or user_input == str(idx + 1) or (len(b_text) >= 3 and b_text in user_input)):
                    target_node = node_map.get(b_next)
                    break

        # 3. Búsqueda de coincidencia en menú de lista del nodo actual
        if not target_node and current_node:
            row_idx = 1
            for sec in current_node.get("sections", []):
                for row in sec.get("rows", []):
                    r_id = str(row.get("id", "") or row.get("rowId", "")).strip().lower()
                    r_title = str(row.get("title", "")).strip().lower()
                    r_next = row.get("next_node")
                    if r_next and (user_input == r_id or user_input == r_title or user_input == str(row_idx) or (len(user_input) >= 4 and user_input in r_title)):
                        target_node = node_map.get(r_next)
                        break
                    row_idx += 1
                if target_node:
                    break

        # 4. Búsqueda de coincidencia en palabras clave disparadoras (trigger_keywords) de cualquier nodo
        if not target_node:
            for n in nodes:
                keywords = [str(k).strip().lower() for k in n.get("trigger_keywords", []) if k]
                if any(k == user_input or (len(k) >= 4 and k in user_input) for k in keywords):
                    target_node = n
                    break

        # 5. Si no hubo coincidencia y el nodo actual es de búsqueda de catálogo
        if not target_node and current_node and current_node.get("action_type") == "search_catalog":
            return await self._search_products(conversation, user_input)

        # 6. Si no hay coincidencia, reiniciar a start si estaba en estado inicial
        if not target_node:
            if current_node_id in ("start", "idle", None):
                target_node = start_node
            else:
                target_node = start_node

        return await self._render_flow_node(target_node, conversation)

    async def _match_keyword_rule(self, user_input: str) -> Optional[Dict[str, Any]]:
        cfg = await self.get_config()
        keywords_rules = cfg.get("keywords") or []
        for rule in keywords_rules:
            if not rule.get("active", True):
                continue
            kws = rule.get("keywords") or []
            for kw in kws:
                kw_clean = kw.strip().lower()
                if kw_clean and kw_clean in user_input:
                    resp_text = rule.get("response", "")
                    return {
                        "text": f"{resp_text}\n\n_Enviá 0 para volver al menú principal._",
                        "buttons": [{"id": "0", "title": "⬅️ Menú Principal"}],
                        "next_state": "idle",
                    }
        return None

    async def process_message(
        self,
        conversation: WhatsAppConversation,
        message_body: str,
        media_url: Optional[str] = None
    ) -> Dict[str, Any]:
        """Procesa un mensaje entrante y devuelve la respuesta del bot"""
        current_state = conversation.session_state or "idle"
        user_input = message_body.strip().lower()

        # Si el bot tiene un flujo visual configurado y activo, procesar preferentemente con el motor de flujos
        cfg = await self.get_config()
        flow = cfg.get("flow") or DEFAULT_BOT_FLOW
        if flow and flow.get("active", True) and flow.get("nodes"):
            flow_resp = await self._process_visual_flow(conversation, user_input, flow)
            if flow_resp:
                return flow_resp

        # Comandos globales de salida o reseteo
        if user_input in ["0", "menu", "inicio", "volver", "cancelar"]:
            return await self._show_main_menu(conversation)

        # Opt-in a promociones y ofertas (respuesta a cupón de sorteo o invitación)
        if user_input in ["si", "sí", "si quiero", "si por favor", "quiero", "quiero ofertas", "acepto", "si confirmo", "dale"]:
            return await self._handle_optin_confirm(conversation)

        # Opt-out / baja de promociones
        if user_input in ["baja", "desuscribir", "cancelar ofertas", "no quiero", "no quiero ofertas", "salir de promociones"]:
            return await self._handle_optout(conversation)

        # Catálogo de Premios ExtraClub
        if user_input in ["premios", "catalogo", "catalogo de premios", "premios temporada", "premio", "canjes"]:
            return await self._show_seasonal_prizes(conversation)

        # Promociones y ofertas vigentes de Extra Supermercado
        if user_input in ["ofertas", "oferta", "promos", "promo", "promociones", "promocion", "descuentos", "rebajas", "que ofertas hay", "que esta en promo"]:
            return await self._show_current_promotions(conversation)

        # Regla de palabras clave / respuestas rápidas FAQ
        kw_match = await self._match_keyword_rule(user_input)
        if kw_match:
            return kw_match

        if current_state == "idle":
            return await self._handle_idle(conversation, user_input)
        elif current_state == "menu_main":
            return await self._handle_main_menu(conversation, user_input)
        elif current_state == "menu_products":
            return await self._handle_products_menu(conversation, user_input)
        elif current_state == "menu_orders":
            return await self._handle_orders_menu(conversation, user_input)
        elif current_state == "menu_support":
            return await self._handle_support_menu(conversation, user_input)
        elif current_state == "product_search":
            return await self._search_products(conversation, user_input)
        elif current_state == "order_status":
            return await self._handle_order_status(conversation, user_input)
        else:
            return await self._handle_idle(conversation, user_input)

    async def _handle_idle(self, conversation: WhatsAppConversation, user_input: str) -> Dict[str, Any]:
        """Mensaje inicial o saludo"""
        greetings = ["hola", "buenos", "buenas", "hi", "hello", "saludos", "que tal", "epale"]
        if any(g in user_input for g in greetings) or user_input in ["ayuda", "/ayuda", "?"]:
            return await self._show_main_menu(conversation)

        if user_input.startswith("/"):
            return await self._handle_command(conversation, user_input)

        return await self._show_main_menu(conversation)

    async def _show_main_menu(self, conversation: WhatsAppConversation) -> Dict[str, Any]:
        cfg = await self.get_config()
        client_name = conversation.contact_name or "Estimado cliente"
        welcome_tpl = cfg.get("welcome_message") or "¡Hola {cliente}! 👋\nBienvenido al canal oficial de atención de *Extra Supermercado*."
        welcome_text = welcome_tpl.replace("{cliente}", client_name)

        modules = cfg.get("modules_enabled") or {}
        lines = [f"🛒 *{welcome_text}*\n\nElegí una opción enviando el número correspondiente:\n"]
        buttons = []

        if modules.get("catalog_search", True):
            lines.append("1️⃣ *Catálogo & Consulta de Precios*")
            buttons.append({"id": "1", "title": "📦 Catálogo"})
        lines.append("🔥 *Ofertas & Promociones del Día* (Enviá *OFERTAS*)")
        if modules.get("extraclub_points", True):
            lines.append("2️⃣ *Mis Puntos ExtraClub*")
            buttons.append({"id": "2", "title": "⭐ ExtraClub"})
        if modules.get("order_tracking", True):
            lines.append("3️⃣ *Rastreo de Compras & Pedidos*")
            buttons.append({"id": "3", "title": "📋 Pedidos"})
        if modules.get("supermarket_info", True):
            lines.append("4️⃣ *Horarios, Sucursales & Ubicación*")
            buttons.append({"id": "4", "title": "ℹ️ Horarios"})
        if modules.get("human_handoff", True):
            lines.append("5️⃣ *Hablar con un Agente Humano*")
            buttons.append({"id": "5", "title": "👤 Agente"})

        # Opciones personalizadas extras añadidas por el usuario
        custom_opts = cfg.get("custom_menu_options") or []
        for opt in custom_opts:
            if opt.get("active", True):
                num = str(opt.get("number", "")).strip()
                title = opt.get("title", "").strip()
                num_emoji = f"{num}️⃣" if num.isdigit() and len(num) == 1 else f"🔹 *{num}.*"
                lines.append(f"{num_emoji} *{title}*")
                if len(buttons) < 3:
                    buttons.append({"id": num, "title": title[:20]})

        return {
            "text": "\n".join(lines),
            "buttons": buttons[:3],
            "next_state": "menu_main"
        }

    async def _handle_main_menu(self, conversation: WhatsAppConversation, user_input: str) -> Dict[str, Any]:
        """Navegación del menú principal"""
        cfg = await self.get_config()
        # 1. Verificar opciones personalizadas añadidas
        custom_opts = cfg.get("custom_menu_options") or []
        for opt in custom_opts:
            if not opt.get("active", True):
                continue
            opt_num = str(opt.get("number", "")).strip().lower()
            opt_title = str(opt.get("title", "")).strip().lower()
            if user_input == opt_num or (len(user_input) >= 4 and user_input in opt_title):
                return {
                    "text": f"{opt.get('response', '')}\n\n_Enviá 0 para volver al menú principal._",
                    "buttons": [{"id": "0", "title": "⬅️ Volver"}],
                    "next_state": "menu_main"
                }

        # 2. Opciones estándar
        if user_input in ["ofertas", "oferta", "promos", "promo", "promociones", "promocion", "descuentos"]:
            return await self._show_current_promotions(conversation)

        elif user_input in ["1", "productos", "catalogo", "catálogo", "precios", "precio", "buscar"]:
            return {
                "text": (
                    "📦 *Catálogo & Consulta de Precios*\n\n"
                    "Escribí el nombre del producto o marca que estás buscando (ej: *leche*, *arroz*, *coca cola*):\n\n"
                    "_Enviá 0 para volver al menú principal._"
                ),
                "buttons": [{"id": "0", "title": "⬅️ Volver"}],
                "next_state": "product_search"
            }

        elif user_input in ["2", "puntos", "extraclub", "club", "fidelidad", "saldo"]:
            return await self._show_extraclub_points(conversation)

        elif user_input in ["3", "pedidos", "compras", "ordenes", "factura", "ticket"]:
            return {
                "text": (
                    "📋 *Rastreo de Compras & Pedidos*\n\n"
                    "Elegí una opción:\n"
                    "1️⃣ Consultar un Ticket / Pedido específico por número\n"
                    "2️⃣ Ver mis últimas compras registradas\n\n"
                    "_Enviá 0 para volver al menú principal._"
                ),
                "buttons": [
                    {"id": "1", "title": "🔍 Buscar por N°"},
                    {"id": "2", "title": "📜 Historial"},
                    {"id": "0", "title": "⬅️ Volver"}
                ],
                "next_state": "menu_orders"
            }

        elif user_input in ["4", "horarios", "horario", "sucursal", "sucursales", "donde", "ubicacion", "direccion"]:
            return await self._show_supermarket_info(conversation)

        elif user_input in ["5", "soporte", "humano", "agente", "contacto", "reclamo"]:
            return {
                "text": (
                    "👤 *Atención Personalizada*\n\n"
                    "Hemos derivado esta conversación a nuestro equipo de *Atención al Cliente* en salón.\n"
                    "Un operador responderá en este mismo chat a la brevedad.\n\n"
                    "_Horario de atención: Lunes a Sábados 07:00 a 21:00 hs._"
                ),
                "buttons": [{"id": "0", "title": "⬅️ Volver al menú"}],
                "next_state": "idle"
            }

        else:
            # Si escribió directamente un nombre de producto, buscarlo de inmediato
            if len(user_input) >= 3:
                return await self._search_products(conversation, user_input)
            return {
                "text": "❓ Opción no reconocida. Por favor seleccioná un número del menú o escribí el nombre del producto que buscás.",
                "buttons": self._get_main_menu_buttons(),
                "next_state": "menu_main"
            }

    async def _get_active_promotions_for_product(self, product_id: UUID, category_id: Optional[UUID] = None) -> List[Promotion]:
        """Obtiene las promociones vigentes hoy en Paraguay (America/Asuncion) para un producto"""
        py_today = datetime.now(ZoneInfo("America/Asuncion")).date()
        company_id = await self.get_company_id()

        conds = [
            Promotion.producto_ids.contains([product_id])
        ]
        if category_id:
            conds.append(Promotion.categoria_ids.contains([category_id]))

        stmt = select(Promotion).where(
            Promotion.company_id == company_id,
            Promotion.estado == "activa",
            Promotion.valido_desde <= py_today,
            Promotion.valido_hasta >= py_today,
            or_(*conds)
        ).order_by(Promotion.created_at.desc())

        res = await self.db.execute(stmt)
        promos = list(res.scalars().all())
        active = []
        for p in promos:
            if p.limitar_unidades and p.stock_limite_unidades:
                if (p.unidades_vendidas_promo or 0) >= p.stock_limite_unidades:
                    continue
            active.append(p)
        return active

    def _format_promo_badge(self, promo: Promotion, precio_normal: float) -> str:
        """Formatea el badge de promoción para el mensaje de WhatsApp"""
        if promo.tipo == "precio_fijo_oferta" and promo.precio_fijo_promocional:
            p_oferta = float(promo.precio_fijo_promocional)
            ahorro = precio_normal - p_oferta
            pct = int((ahorro / precio_normal * 100)) if precio_normal > 0 else 0
            pct_str = f" (-{pct}%)" if pct > 0 else ""
            return f"🔥 *¡EN OFERTA! Gs. {p_oferta:,.0f}*{pct_str} _(Antes: Gs. {precio_normal:,.0f})_"
        elif promo.tipo == "porcentaje" and promo.valor:
            pct = int(promo.valor)
            p_oferta = precio_normal * (1 - pct / 100)
            return f"🔥 *¡{pct}% OFF! Gs. {p_oferta:,.0f}* _(Antes: Gs. {precio_normal:,.0f})_"
        elif promo.tipo == "dos_por_uno":
            return f"🔥 *¡PROMO 2x1!* _Llevás 2 por Gs. {precio_normal:,.0f}_"
        elif promo.tipo == "tres_por_dos":
            return f"🔥 *¡PROMO 3x2!* _Llevás 3 por el precio de 2_"
        elif promo.tipo == "segunda_unidad_pct" and promo.valor:
            return f"🔥 *¡2da unidad al {int(promo.valor)}% OFF!*"
        elif promo.tipo == "combo_precio" and promo.precio_fijo_promocional:
            return f"🔥 *¡Combo Oferta: Gs. {float(promo.precio_fijo_promocional):,.0f}!*"
        else:
            return f"🔥 *¡EN PROMOCIÓN!* {promo.nombre}"

    async def _handle_products_menu(self, conversation: WhatsAppConversation, user_input: str) -> Dict[str, Any]:
        if user_input in ["0", "menu", "volver"]:
            return await self._show_main_menu(conversation)
        return await self._search_products(conversation, user_input)

    async def _search_products(self, conversation: WhatsAppConversation, query: str) -> Dict[str, Any]:
        """Búsqueda real en la base de datos de productos con stock y precios en Gs."""
        company_id = await self.get_company_id()
        clean_q = query.strip()

        stmt = (
            select(Product)
            .where(
                Product.company_id == company_id,
                Product.activo == True,
            )
            .where(
                or_(
                    Product.nombre.ilike(f"%{clean_q}%"),
                    Product.sku.ilike(f"%{clean_q}%"),
                    Product.codigo_barra.ilike(f"%{clean_q}%"),
                )
            )
            .limit(6)
        )
        result = await self.db.execute(stmt)
        products = result.scalars().all()

        if not products:
            return {
                "text": (
                    f"🔍 No encontramos productos que coincidan con *'{clean_q}'* en nuestro catálogo activo.\n\n"
                    f"Probá con otro término (ej: *leche trebol*, *arroz*, *harina*) o enviá *0* para volver al menú."
                ),
                "buttons": [{"id": "0", "title": "⬅️ Volver"}],
                "next_state": "product_search"
            }

        lines = []
        for i, p in enumerate(products, 1):
            # Consultar stock actual de lotes en tiempo real
            stock_res = await self.db.execute(
                select(func.coalesce(func.sum(StockLot.cantidad_actual), 0)).where(
                    StockLot.producto_id == p.id
                )
            )
            stock = stock_res.scalar() or 0
            precio = float(p.precio_venta or 0)
            precio_str = f"Gs. {precio:,.0f}" if precio > 0 else "Consultar en caja"
            stock_str = f"Stock: {int(stock)} un." if stock > 0 else "Consultar en salón"

            # Verificar si tiene promoción activa vigente
            promos = await self._get_active_promotions_for_product(p.id, p.categoria_id)
            if promos:
                badge = self._format_promo_badge(promos[0], precio)
                lines.append(f"{i}. *{p.nombre}*\n   {badge}\n   📦 {stock_str}")
            else:
                lines.append(f"{i}. *{p.nombre}*\n   💵 {precio_str} | 📦 {stock_str}")

        text = (
            f"🔍 *Resultados para '{clean_q}':*\n\n"
            + "\n\n".join(lines)
            + "\n\n_Podés escribir otra búsqueda directamente, o enviar 0 para volver al menú principal._"
        )
        return {
            "text": text,
            "buttons": [{"id": "0", "title": "⬅️ Volver"}],
            "next_state": "product_search"
        }

    async def _show_extraclub_points(self, conversation: WhatsAppConversation) -> Dict[str, Any]:
        """Consulta verídica de puntos ExtraClub vinculada al cliente por teléfono"""
        company_id = await self.get_company_id()
        phone_digits = re.sub(r"\D", "", conversation.contact_phone)
        last_digits = phone_digits[-8:] if len(phone_digits) >= 8 else phone_digits

        stmt = select(Customer).where(
            Customer.company_id == company_id,
            Customer.telefono.ilike(f"%{last_digits}%")
        ).limit(1)
        res = await self.db.execute(stmt)
        customer = res.scalar_one_or_none()

        if customer:
            # Consultar puntos acumulados
            stmt_pts = select(func.coalesce(func.sum(LoyaltyPoints.puntos), 0)).where(
                LoyaltyPoints.customer_id == customer.id
            )
            pts_res = await self.db.execute(stmt_pts)
            total_pts = int(pts_res.scalar() or 0)
            valor_canje = total_pts * 100

            text = (
                f"⭐ *Tu Cuenta ExtraClub — Extra Supermercado* ⭐\n\n"
                f"👤 Titular: *{customer.razon_social}*\n"
                f"🆔 C.I. / RUC: *{customer.ci or customer.ruc or 'Registrado'}*\n"
                f"💳 Tarjeta Socio: *{customer.extra_club_numero or 'Socio Titular'}*\n"
                f"✨ Puntos Disponibles: *{total_pts:,} Pts.*\n"
                f"💰 Equivalente en Compras: *Gs. {valor_canje:,.0f}*\n\n"
                f"🛒 _Podés canjear tus puntos directamente en línea de caja en tu próxima compra._\n\n"
                f"🎁 *¿Querés ver los premios de la temporada?* Enviá *PREMIOS* para consultar el catálogo.\n"
                f"Enviá 0 para volver al menú principal."
            )
        else:
            text = (
                f"⭐ *Programa de Fidelidad ExtraClub* ⭐\n\n"
                f"No encontramos una cuenta ExtraClub vinculada a tu número ({conversation.contact_phone}).\n\n"
                f"¡Hacerte socio es 100% gratuito! Acercate a Atención al Cliente en nuestro salón o solicitale al cajero en tu próxima compra para sumar puntos con cada ticket. 🛒✨\n\n"
                f"🎁 Enviá *PREMIOS* para ver los premios vigentes de la temporada.\n"
                f"Enviá 0 para volver al menú principal."
            )

        return {
            "text": text,
            "buttons": [
                {"id": "premios", "title": "🎁 Ver Premios"},
                {"id": "0", "title": "⬅️ Volver al Menú"}
            ],
            "next_state": "menu_main"
        }

    async def _handle_optin_confirm(self, conversation: WhatsAppConversation) -> Dict[str, Any]:
        """Marca al cliente como validado para promociones y responde con la confirmación oficial"""
        sess_data = dict(conversation.session_data or {})
        sess_data["optin_promociones"] = True
        sess_data["optin_fecha"] = datetime.now(timezone.utc).isoformat()
        sess_data["optin_validado"] = True
        conversation.session_data = sess_data
        flag_modified(conversation, "session_data")
        await self.db.commit()

        # Intentar obtener la plantilla oficial personalizada
        tmpl_content = await get_wa_template(self.db, self.entity_id, "optin.confirmado")
        if not tmpl_content:
            tmpl_content = (
                "🎉 *¡Excelente! Tu número ha sido validado para recibir promociones exclusivas.*\n\n"
                "A partir de ahora vas a recibir ofertas personalizadas, descuentos relámpago y beneficios de Extra Supermercado directo en tu WhatsApp.\n\n"
                "ℹ️ _Podés responder 'BAJA' en cualquier momento si deseás pausar estas comunicaciones._"
            )

        return {
            "text": f"{tmpl_content}\n\n_Enviá 0 para ver el menú de opciones._",
            "buttons": [{"id": "0", "title": "⬅️ Menú Principal"}],
            "next_state": "idle",
        }

    async def _handle_optout(self, conversation: WhatsAppConversation) -> Dict[str, Any]:
        """Desuscribe al cliente de difusiones automáticas de promociones"""
        sess_data = dict(conversation.session_data or {})
        sess_data["optin_promociones"] = False
        sess_data["optout_fecha"] = datetime.now(timezone.utc).isoformat()
        conversation.session_data = sess_data
        flag_modified(conversation, "session_data")
        await self.db.commit()

        return {
            "text": (
                "✅ *Baja confirmada de promociones.*\n\n"
                "Tu número fue removido de la lista de envíos promocionales automáticos de Extra Supermercado.\n"
                "Si en el futuro deseás reactivarlo, solo escribí *SI* en cualquier momento.\n\n"
                "_Enviá 0 para ver el menú de atención al cliente._"
            ),
            "buttons": [{"id": "0", "title": "⬅️ Menú Principal"}],
            "next_state": "idle",
        }

    async def _show_seasonal_prizes(self, conversation: WhatsAppConversation) -> Dict[str, Any]:
        """Muestra el catálogo oficial de premios de la temporada"""
        tmpl_content = await get_wa_template(self.db, self.entity_id, "extraclub.premios")
        if not tmpl_content:
            tmpl_content = (
                "🎁 *Catálogo de Premios de la Temporada — ExtraClub* 🏆\n\n"
                "¡Canjeá tus puntos por premios fabulosos o descuento directo en tus compras!\n\n"
                "☕ *1.500 Pts:* Pava Eléctrica Inox 1.8L\n"
                "🍳 *2.500 Pts:* Set de Sartenes Antiadherentes (2 piezas)\n"
                "🥪 *3.500 Pts:* Sandwichera Grill Antiadherente\n"
                "💨 *7.000 Pts:* Freidora de Aire Digital 4.5L\n"
                "🍲 *12.000 Pts:* Horno Eléctrico de Mesa 45L\n"
                "📺 *25.000 Pts:* Smart TV 43\" Full HD\n\n"
                "💡 *Descuento en Caja:* Recordá que también podés descontar tus puntos directamente de tu factura: *1 Punto = Gs. 100*.\n"
                "Consultá en Atención al Cliente o escribinos aquí para iniciar tu canje."
            )

        return {
            "text": f"{tmpl_content}\n\n_Enviá 0 para volver al menú principal._",
            "buttons": [{"id": "0", "title": "⬅️ Menú Principal"}],
            "next_state": "idle",
        }

    async def _show_current_promotions(self, conversation: WhatsAppConversation) -> Dict[str, Any]:
        """Muestra las mejores ofertas y promociones vigentes hoy en Extra Supermercado"""
        py_today = datetime.now(ZoneInfo("America/Asuncion")).date()
        company_id = await self.get_company_id()

        stmt = (
            select(Promotion)
            .where(
                Promotion.company_id == company_id,
                Promotion.estado == "activa",
                Promotion.valido_desde <= py_today,
                Promotion.valido_hasta >= py_today,
            )
            .order_by(Promotion.created_at.desc())
            .limit(8)
        )
        res = await self.db.execute(stmt)
        promos = list(res.scalars().all())

        if not promos:
            return {
                "text": (
                    "🛒 *Promociones Extra Supermercado*\n\n"
                    "En este momento estamos renovando las promociones de la semana.\n"
                    "¡Consultanos por cualquier producto específico escribiendo su nombre (ej: *leche*, *arroz*, *carne*)!\n\n"
                    "_Enviá 0 para volver al menú principal._"
                ),
                "buttons": [{"id": "0", "title": "⬅️ Volver"}],
                "next_state": "idle",
            }

        lines = ["🔥 *¡OFERTAS & PROMOCIONES VIGENTES EN EXTRA SUPERMERCADO!* 🛒✨\n"]
        for i, p in enumerate(promos, 1):
            detalle = p.descripcion or p.nombre
            hasta_str = p.valido_hasta.strftime('%d/%m')
            if p.tipo == "precio_fijo_oferta" and p.precio_fijo_promocional:
                precio_promo = f"Gs. {float(p.precio_fijo_promocional):,.0f}"
                lines.append(f"{i}️⃣ *{p.nombre}*\n   🏷️ Precio Oferta: *{precio_promo}*\n   📅 Válido hasta: {hasta_str}")
            elif p.tipo == "porcentaje" and p.valor:
                lines.append(f"{i}️⃣ *{p.nombre}*\n   🏷️ *{int(p.valor)}% de Descuento directo*\n   📅 Válido hasta: {hasta_str}")
            elif p.tipo == "dos_por_uno":
                lines.append(f"{i}️⃣ *{p.nombre}*\n   🏷️ *¡Llevá 2 y Pagá 1 (2x1)!*\n   📅 Válido hasta: {hasta_str}")
            elif p.tipo == "tres_por_dos":
                lines.append(f"{i}️⃣ *{p.nombre}*\n   🏷️ *¡Llevá 3 y Pagá 2 (3x2)!*\n   📅 Válido hasta: {hasta_str}")
            else:
                lines.append(f"{i}️⃣ *{p.nombre}*\n   ℹ️ {detalle}\n   📅 Válido hasta: {hasta_str}")

        lines.append("\n_Escribí el nombre de cualquier producto para ver su precio exacto y stock, o enviá 0 para volver al menú._")

        return {
            "text": "\n".join(lines),
            "buttons": [
                {"id": "1", "title": "📦 Catálogo"},
                {"id": "0", "title": "⬅️ Volver al Menú"}
            ],
            "next_state": "idle",
        }

    async def _handle_orders_menu(self, conversation: WhatsAppConversation, user_input: str) -> Dict[str, Any]:
        if user_input in ["1", "buscar", "estado"]:
            return {
                "text": "🔍 Ingresá el número de ticket o factura (ej: *001-002-001234* o *1234*):\n\n_Enviá 0 para volver._",
                "buttons": [{"id": "0", "title": "⬅️ Volver"}],
                "next_state": "order_status"
            }
        elif user_input in ["2", "historial"]:
            return await self._show_order_history(conversation)
        elif user_input in ["0", "volver"]:
            return await self._show_main_menu(conversation)
        else:
            return await self._handle_order_status(conversation, user_input)

    async def _handle_order_status(self, conversation: WhatsAppConversation, user_input: str) -> Dict[str, Any]:
        """Consulta el estado de una venta en PostgreSQL"""
        if user_input in ["0", "volver"]:
            return await self._show_main_menu(conversation)

        company_id = await self.get_company_id()
        order_num = user_input.replace("#", "").strip()

        stmt = select(Sale).where(
            Sale.company_id == company_id,
            or_(
                Sale.numero == order_num,
                Sale.numero_interno == order_num,
                Sale.numero.ilike(f"%{order_num}%")
            )
        ).limit(1)
        res = await self.db.execute(stmt)
        sale = res.scalar_one_or_none()

        if not sale:
            return {
                "text": (
                    f"❌ No encontramos ninguna compra registrada con el comprobante *#{order_num}*.\n\n"
                    f"Verificá el número impreso en tu ticket o enviá *0* para volver al menú."
                ),
                "buttons": [{"id": "0", "title": "⬅️ Volver"}],
                "next_state": "order_status"
            }

        fecha_str = sale.fecha.strftime("%d/%m/%Y %H:%M") if sale.fecha else "Reciente"
        text = (
            f"🧾 *Comprobante #{sale.numero}*\n\n"
            f"📅 Fecha: {fecha_str}\n"
            f"💰 Total: *Gs. {sale.total:,.0f}*\n"
            f"💳 Condición: *{sale.condicion.upper()}*\n"
            f"📦 Estado: *{sale.estado.upper()}*\n\n"
            f"¡Gracias por elegir Extra Supermercado!\n\n"
            f"_Enviá 0 para volver al menú principal._"
        )
        return {
            "text": text,
            "buttons": [{"id": "0", "title": "⬅️ Volver al menú"}],
            "next_state": "menu_main"
        }

    async def _show_order_history(self, conversation: WhatsAppConversation) -> Dict[str, Any]:
        """Muestra las compras recientes del cliente"""
        company_id = await self.get_company_id()
        phone_digits = re.sub(r"\D", "", conversation.contact_phone)
        last_digits = phone_digits[-8:] if len(phone_digits) >= 8 else phone_digits

        stmt_cust = select(Customer.id).where(
            Customer.company_id == company_id,
            Customer.telefono.ilike(f"%{last_digits}%")
        ).limit(1)
        cust_res = await self.db.execute(stmt_cust)
        customer_id = cust_res.scalar_one_or_none()

        if not customer_id:
            return {
                "text": (
                    "📜 No encontramos compras recientes asociadas a este número telefónico.\n"
                    "Si tenés el ticket físico, podés consultar el número con la opción 1.\n\n"
                    "_Enviá 0 para volver al menú principal._"
                ),
                "buttons": [{"id": "0", "title": "⬅️ Volver al menú"}],
                "next_state": "menu_main"
            }

        stmt_sales = select(Sale).where(
            Sale.company_id == company_id,
            Sale.customer_id == customer_id
        ).order_by(Sale.fecha.desc()).limit(5)
        sales_res = await self.db.execute(stmt_sales)
        sales = sales_res.scalars().all()

        if not sales:
            return {
                "text": "📜 No registramos compras anteriores asociadas a tu cuenta.\n\n_Enviá 0 para volver._",
                "buttons": [{"id": "0", "title": "⬅️ Volver al menú"}],
                "next_state": "menu_main"
            }

        lines = []
        for s in sales:
            f_str = s.fecha.strftime("%d/%m/%Y") if s.fecha else ""
            lines.append(f"• Ticket #{s.numero} ({f_str}): *Gs. {s.total:,.0f}*")

        text = (
            f"📜 *Tus Últimas Compras en Extra Supermercado:*\n\n"
            + "\n".join(lines)
            + "\n\n_Enviá 0 para volver al menú principal._"
        )
        return {
            "text": text,
            "buttons": [{"id": "0", "title": "⬅️ Volver al menú"}],
            "next_state": "menu_main"
        }

    async def _show_supermarket_info(self, conversation: WhatsAppConversation) -> Dict[str, Any]:
        """Información oficial de Extra Supermercado"""
        text = (
            f"🏬 *Extra Supermercado Mayorista*\n"
            f"Razón Social: *GRUPO SANTA TERESA E.A.S.*\n"
            f"RUC: *80150377-9*\n\n"
            f"🕒 *Horarios de Salón & Cajas:*\n"
            f"• Lunes a Sábados: *07:00 a 21:00 hs* (horario continuo)\n"
            f"• Domingos y Feriados: *07:30 a 13:00 hs*\n\n"
            f"📍 *Ubicación:*\n"
            f"Salón Central, Sector Carnicería & Depósito Mayorista.\n\n"
            f"💳 *Medios de Pago Aceptados:*\n"
            f"• Efectivo (Guaraníes, Reales, Dólares)\n"
            f"• Tarjetas de Débito y Crédito (Bancard / Dinelco)\n"
            f"• Pagos por QR y transferencias inmediatas\n"
            f"• Descuentos exclusivos con ExtraClub 🛒\n\n"
            f"_Enviá 0 para volver al menú principal._"
        )
        return {
            "text": text,
            "buttons": self._get_main_menu_buttons(),
            "next_state": "menu_main"
        }

    async def _handle_support_menu(self, conversation: WhatsAppConversation, user_input: str) -> Dict[str, Any]:
        if user_input in ["0", "volver"]:
            return await self._show_main_menu(conversation)
        return {
            "text": "👤 Tu mensaje ha sido registrado. Un representante de Extra Supermercado te responderá en breve.\n\n_Enviá 0 para volver al menú._",
            "buttons": [{"id": "0", "title": "⬅️ Volver"}],
            "next_state": "idle"
        }

    async def _handle_command(self, conversation: WhatsAppConversation, user_input: str) -> Dict[str, Any]:
        parts = user_input.split(maxsplit=1)
        cmd = parts[0].lower()
        args = parts[1] if len(parts) > 1 else ""

        if cmd in ["/stock", "/buscar"]:
            return await self._search_products(conversation, args)
        elif cmd in ["/puntos", "/extraclub"]:
            return await self._show_extraclub_points(conversation)
        elif cmd in ["/pedido", "/ticket"]:
            return await self._handle_order_status(conversation, args)
        else:
            return await self._show_main_menu(conversation)

    def _get_main_menu_buttons(self) -> List[Dict[str, str]]:
        return [
            {"id": "1", "title": "📦 Catálogo & Precios"},
            {"id": "2", "title": "⭐ Puntos ExtraClub"},
            {"id": "3", "title": "📋 Mis Compras"},
            {"id": "4", "title": "ℹ️ Horarios & Info"},
            {"id": "5", "title": "👤 Hablar con Agente"}
        ]


async def update_conversation_state(
    db: AsyncSession,
    conversation_id: UUID,
    new_state: str
) -> None:
    stmt = update(WhatsAppConversation).where(
        WhatsAppConversation.id == conversation_id
    ).values(session_state=new_state)
    await db.execute(stmt)
    await db.commit()


async def get_conversation_state(
    db: AsyncSession,
    conversation_id: UUID
) -> Optional[str]:
    stmt = select(WhatsAppConversation.session_state).where(
        WhatsAppConversation.id == conversation_id
    )
    result = await db.execute(stmt)
    return result.scalar_one_or_none()
