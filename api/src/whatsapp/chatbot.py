"""
IntelliZapp Chatbot Engine - Interactive menu system with conversation flows
Personalizado y conectado a la base de datos real de Extra Supermercado
"""
from typing import Optional, Dict, Any, List
from uuid import UUID
import re
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, func, or_
from api.src.whatsapp.models import WhatsAppMessage, WhatsAppConversation
from api.src.products.models import Product
from api.src.sales.models import Sale
from api.src.customers.models import Customer
from api.src.loyalty.models import LoyaltyPoints
from api.src.inventory.models import StockLot
from api.src.companies.models import Company


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

    async def process_message(
        self,
        conversation: WhatsAppConversation,
        message_body: str,
        media_url: Optional[str] = None
    ) -> Dict[str, Any]:
        """Procesa un mensaje entrante y devuelve la respuesta del bot"""
        current_state = conversation.session_state or "idle"
        user_input = message_body.strip().lower()

        # Comandos globales de salida o reseteo
        if user_input in ["0", "menu", "inicio", "volver", "cancelar"]:
            return await self._show_main_menu(conversation)

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
        client_name = conversation.contact_name or "Estimado cliente"
        text = (
            f"🛒 *¡Hola {client_name}!* 👋\n"
            f"Bienvenido al canal oficial de atención de *Extra Supermercado*.\n\n"
            f"Elegí una opción enviando el número correspondiente:\n\n"
            f"1️⃣ *Catálogo & Consulta de Precios*\n"
            f"2️⃣ *Mis Puntos ExtraClub*\n"
            f"3️⃣ *Rastreo de Compras & Pedidos*\n"
            f"4️⃣ *Horarios, Sucursales & Ubicación*\n"
            f"5️⃣ *Hablar con un Agente Humano*"
        )
        return {
            "text": text,
            "buttons": self._get_main_menu_buttons(),
            "next_state": "menu_main"
        }

    async def _handle_main_menu(self, conversation: WhatsAppConversation, user_input: str) -> Dict[str, Any]:
        """Navegación del menú principal"""
        if user_input in ["1", "productos", "catalogo", "catálogo", "precios", "precio", "buscar"]:
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
                "text": "❓ Opción no reconocida. Por favor seleccioná un número del 1 al 5:\n\n1️⃣ Catálogo\n2️⃣ ExtraClub\n3️⃣ Pedidos\n4️⃣ Horarios\n5️⃣ Agente",
                "buttons": self._get_main_menu_buttons(),
                "next_state": "menu_main"
            }

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
            # Consultar stock actual de lotes
            stock_res = await self.db.execute(
                select(func.coalesce(func.sum(StockLot.cantidad_actual), 0)).where(
                    StockLot.producto_id == p.id
                )
            )
            stock = stock_res.scalar() or 0
            precio = p.precio_venta or 0
            precio_str = f"Gs. {precio:,.0f}" if precio > 0 else "Consultar en caja"
            stock_str = f"Stock: {int(stock)}" if stock > 0 else "Consultar en salón"
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
                f"Enviá 0 para volver al menú principal."
            )
        else:
            text = (
                f"⭐ *Programa de Fidelidad ExtraClub* ⭐\n\n"
                f"No encontramos una cuenta ExtraClub vinculada a tu número ({conversation.contact_phone}).\n\n"
                f"¡Hacerte socio es 100% gratuito! Acercate a Atención al Cliente en nuestro salón o solicitale al cajero en tu próxima compra para sumar puntos con cada ticket. 🛒✨\n\n"
                f"Enviá 0 para volver al menú principal."
            )

        return {
            "text": text,
            "buttons": self._get_main_menu_buttons(),
            "next_state": "menu_main"
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
