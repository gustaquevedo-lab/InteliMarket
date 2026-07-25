"""
IntelliZapp Chatbot Engine - Interactive menu system with conversation flows
"""
from typing import Optional, Dict, Any, List
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from api.src.whatsapp.models import WhatsAppMessage, WhatsAppConversation
from api.src.products.models import Product
from api.src.sales.models import Sale
import json


class ChatbotFlow:
    """State machine for multi-step conversations"""
    
    STATES = {
        "idle": "Waiting for user input",
        "menu_main": "Main menu displayed",
        "menu_products": "Product catalog menu",
        "menu_orders": "Order management menu",
        "menu_support": "Support menu",
        "product_search": "Searching for product",
        "product_detail": "Showing product details",
        "order_status": "Checking order status",
        "order_history": "Showing order history",
        "support_contact": "Connecting to support",
        "confirm_action": "Awaiting confirmation",
    }
    
    @staticmethod
    def get_state_description(state: str) -> str:
        return ChatbotFlow.STATES.get(state, "Unknown state")


class ChatbotEngine:
    """Core chatbot logic with interactive menus"""
    
    def __init__(self, db: AsyncSession, company_id: UUID):
        self.db = db
        self.company_id = company_id
    
    async def process_message(
        self, 
        conversation: WhatsAppConversation,
        message_body: str,
        media_url: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Process inbound message and return response
        
        Returns:
            {
                "text": str,
                "buttons": List[Dict],  # Optional interactive buttons
                "next_state": str,
                "media_url": Optional[str]
            }
        """
        # Get current conversation state
        current_state = conversation.session_state or "idle"
        
        # Parse user input
        user_input = message_body.strip().lower()
        
        # Route based on current state
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
            return await self._handle_product_search(conversation, user_input)
        elif current_state == "order_status":
            return await self._handle_order_status(conversation, user_input)
        elif current_state == "confirm_action":
            return await self._handle_confirmation(conversation, user_input)
        else:
            # Fallback to idle
            return await self._handle_idle(conversation, user_input)
    
    async def _handle_idle(self, conversation: WhatsAppConversation, user_input: str) -> Dict[str, Any]:
        """Handle initial message or return to main menu"""
        
        # Check for greeting
        greetings = ["hola", "buenos", "buenas", "hi", "hello", "saludos"]
        if any(g in user_input for g in greetings):
            return {
                "text": f"¡Hola {conversation.contact_name or 'cliente'}! 👋\n\n¿En qué puedo ayudarte hoy?",
                "buttons": self._get_main_menu_buttons(),
                "next_state": "menu_main"
            }
        
        # Check for help command
        if user_input in ["/ayuda", "ayuda", "help", "?"]:
            return {
                "text": self._get_help_text(),
                "buttons": self._get_main_menu_buttons(),
                "next_state": "menu_main"
            }
        
        # Check for direct commands
        if user_input.startswith("/"):
            return await self._handle_command(conversation, user_input)
        
        # Default: show main menu
        return {
            "text": "¡Bienvenido a nuestro servicio de atención! 🤖\n\nSeleccioná una opción:",
            "buttons": self._get_main_menu_buttons(),
            "next_state": "menu_main"
        }
    
    async def _handle_main_menu(self, conversation: WhatsAppConversation, user_input: str) -> Dict[str, Any]:
        """Handle main menu selection"""
        
        if user_input in ["1", "productos", "catálogo", "catalogo"]:
            return {
                "text": "📦 *Catálogo de Productos*\n\n¿Qué te gustaría hacer?",
                "buttons": [
                    {"id": "search", "title": "🔍 Buscar producto"},
                    {"id": "categories", "title": "📂 Ver categorías"},
                    {"id": "offers", "title": "🔥 Ofertas del día"},
                    {"id": "back", "title": "⬅️ Volver al menú"}
                ],
                "next_state": "menu_products"
            }
        
        elif user_input in ["2", "pedidos", "ordenes", "compras"]:
            return {
                "text": "📋 *Gestión de Pedidos*\n\n¿Qué necesitás?",
                "buttons": [
                    {"id": "status", "title": "📍 Estado de mi pedido"},
                    {"id": "history", "title": "📜 Historial de compras"},
                    {"id": "track", "title": "🚚 Seguir envío"},
                    {"id": "back", "title": "⬅️ Volver al menú"}
                ],
                "next_state": "menu_orders"
            }
        
        elif user_input in ["3", "soporte", "ayuda", "contacto"]:
            return {
                "text": "💬 *Soporte al Cliente*\n\n¿Cómo podemos ayudarte?",
                "buttons": [
                    {"id": "faq", "title": "❓ Preguntas frecuentes"},
                    {"id": "human", "title": "👤 Hablar con agente"},
                    {"id": "complaint", "title": "📝 Hacer reclamo"},
                    {"id": "back", "title": "⬅️ Volver al menú"}
                ],
                "next_state": "menu_support"
            }
        
        elif user_input in ["4", "cuenta", "perfil", "datos"]:
            return await self._show_account_info(conversation)
        
        elif user_input in ["0", "salir", "fin"]:
            return {
                "text": "¡Gracias por contactarnos! 👋\n\nSi necesitás algo más, escribinos cuando quieras.",
                "buttons": [],
                "next_state": "idle"
            }
        
        else:
            return {
                "text": "No entendí tu opción. Por favor elegí una del menú:",
                "buttons": self._get_main_menu_buttons(),
                "next_state": "menu_main"
            }
    
    async def _handle_products_menu(self, conversation: WhatsAppConversation, user_input: str) -> Dict[str, Any]:
        """Handle product catalog interactions"""
        
        if user_input in ["search", "buscar", "1"]:
            return {
                "text": "🔍 *Buscar Producto*\n\nEscribí el nombre o código del producto:",
                "buttons": [{"id": "back", "title": "⬅️ Volver"}],
                "next_state": "product_search"
            }
        
        elif user_input in ["categories", "categorias", "2"]:
            # TODO: Fetch categories from DB
            return {
                "text": "📂 *Categorías Disponibles*\n\n1. Bebidas\n2. Alimentos\n3. Limpieza\n4. Higiene Personal\n\nEscribí el número de la categoría:",
                "buttons": [{"id": "back", "title": "⬅️ Volver"}],
                "next_state": "menu_products"
            }
        
        elif user_input in ["offers", "ofertas", "3"]:
            # TODO: Fetch active promotions
            return {
                "text": "🔥 *Ofertas del Día*\n\n• 2x1 en Bebidas seleccionadas\n• 20% OFF en productos de limpieza\n• Envío gratis en compras +$50.000\n\n¿Querés ver algún producto en particular?",
                "buttons": [
                    {"id": "search", "title": "🔍 Buscar"},
                    {"id": "back", "title": "⬅️ Volver"}
                ],
                "next_state": "menu_products"
            }
        
        elif user_input in ["back", "volver", "0"]:
            return {
                "text": "Menú principal:",
                "buttons": self._get_main_menu_buttons(),
                "next_state": "menu_main"
            }
        
        else:
            # Assume it's a product search
            return await self._search_products(conversation, user_input)
    
    async def _handle_orders_menu(self, conversation: WhatsAppConversation, user_input: str) -> Dict[str, Any]:
        """Handle order management"""
        
        if user_input in ["status", "estado", "1"]:
            return {
                "text": "📍 *Estado de Pedido*\n\nIngresá el número de pedido (ej: #12345):",
                "buttons": [{"id": "back", "title": "⬅️ Volver"}],
                "next_state": "order_status"
            }
        
        elif user_input in ["history", "historial", "2"]:
            return await self._show_order_history(conversation)
        
        elif user_input in ["track", "seguir", "3"]:
            return {
                "text": "🚚 *Seguimiento de Envío*\n\nIngresá el número de pedido para ver el estado del envío:",
                "buttons": [{"id": "back", "title": "⬅️ Volver"}],
                "next_state": "order_status"
            }
        
        elif user_input in ["back", "volver", "0"]:
            return {
                "text": "Menú principal:",
                "buttons": self._get_main_menu_buttons(),
                "next_state": "menu_main"
            }
        
        else:
            return {
                "text": "Opción no válida. Elegí una opción:",
                "buttons": [
                    {"id": "status", "title": "📍 Estado de pedido"},
                    {"id": "history", "title": "📜 Historial"},
                    {"id": "back", "title": "⬅️ Volver"}
                ],
                "next_state": "menu_orders"
            }
    
    async def _handle_support_menu(self, conversation: WhatsAppConversation, user_input: str) -> Dict[str, Any]:
        """Handle support requests"""
        
        if user_input in ["faq", "preguntas", "1"]:
            return {
                "text": "❓ *Preguntas Frecuentes*\n\n*¿Cómo hago un pedido?*\nEscribí /pedido seguido del producto\n\n*¿Cuáles son los horarios?*\nLun-Vie 8-18hs, Sáb 9-13hs\n\n*¿Hacen envíos?*\nSí, a todo el país. Envío gratis +$50.000",
                "buttons": [{"id": "back", "title": "⬅️ Volver"}],
                "next_state": "menu_support"
            }
        
        elif user_input in ["human", "agente", "2"]:
            return {
                "text": "👤 *Conectando con Agente*\n\nUn representante te atenderá en breve.\nHorario de atención: Lun-Vie 8-18hs\n\nMientras tanto, ¿podés contarme más sobre tu consulta?",
                "buttons": [],
                "next_state": "idle"
            }
        
        elif user_input in ["complaint", "reclamo", "3"]:
            return {
                "text": "📝 *Registro de Reclamo*\n\nPor favor describí tu reclamo con el mayor detalle posible. Un agente lo revisará en las próximas 24hs.",
                "buttons": [{"id": "back", "title": "⬅️ Cancelar"}],
                "next_state": "idle"
            }
        
        elif user_input in ["back", "volver", "0"]:
            return {
                "text": "Menú principal:",
                "buttons": self._get_main_menu_buttons(),
                "next_state": "menu_main"
            }
        
        else:
            return {
                "text": "Opción no válida:",
                "buttons": [
                    {"id": "faq", "title": "❓ FAQ"},
                    {"id": "human", "title": "👤 Agente"},
                    {"id": "back", "title": "⬅️ Volver"}
                ],
                "next_state": "menu_support"
            }
    
    async def _handle_product_search(self, conversation: WhatsAppConversation, user_input: str) -> Dict[str, Any]:
        """Search for products"""
        
        if user_input in ["back", "volver", "0"]:
            return {
                "text": "📦 *Catálogo de Productos*",
                "buttons": [
                    {"id": "search", "title": "🔍 Buscar"},
                    {"id": "categories", "title": "📂 Categorías"},
                    {"id": "back", "title": "⬅️ Menú principal"}
                ],
                "next_state": "menu_products"
            }
        
        return await self._search_products(conversation, user_input)
    
    async def _search_products(self, conversation: WhatsAppConversation, query: str) -> Dict[str, Any]:
        """Execute product search"""
        
        # Search products by name or SKU
        stmt = select(Product).where(
            Product.company_id == self.company_id,
            Product.activo == True
        ).where(
            (Product.nombre.ilike(f"%{query}%")) | 
            (Product.sku.ilike(f"%{query}%"))
        ).limit(5)
        
        result = await self.db.execute(stmt)
        products = result.scalars().all()
        
        if not products:
            return {
                "text": f"😕 No encontré productos que coincidan con '{query}'.\n\nProbá con otro término o volvé al menú.",
                "buttons": [
                    {"id": "search", "title": "🔍 Buscar otro"},
                    {"id": "back", "title": "⬅️ Menú principal"}
                ],
                "next_state": "menu_products"
            }
        
        # Format product list
        product_list = []
        for i, p in enumerate(products, 1):
            stock_text = f"Stock: {p.stock or 0}" if p.stock else "Sin stock"
            price_text = f"${p.precio or 0:,.0f}" if p.precio else "Consultar"
            product_list.append(f"{i}. *{p.nombre}*\n   {price_text} | {stock_text}")
        
        text = f"🔍 *Resultados para '{query}':*\n\n" + "\n\n".join(product_list)
        text += "\n\nEscribí el número del producto para ver más detalles, o buscá otro:"
        
        return {
            "text": text,
            "buttons": [
                {"id": "search", "title": "🔍 Nueva búsqueda"},
                {"id": "back", "title": "⬅️ Menú principal"}
            ],
            "next_state": "menu_products"
        }
    
    async def _handle_order_status(self, conversation: WhatsAppConversation, user_input: str) -> Dict[str, Any]:
        """Check order status"""
        
        if user_input in ["back", "volver", "0"]:
            return {
                "text": "📋 *Gestión de Pedidos*",
                "buttons": [
                    {"id": "status", "title": "📍 Estado"},
                    {"id": "history", "title": "📜 Historial"},
                    {"id": "back", "title": "⬅️ Menú principal"}
                ],
                "next_state": "menu_orders"
            }
        
        # Extract order number (remove # if present)
        order_num = user_input.replace("#", "").strip()
        
        # Search for order
        stmt = select(Sale).where(
            Sale.company_id == self.company_id,
            Sale.numero == order_num
        )
        
        result = await self.db.execute(stmt)
        sale = result.scalar_one_or_none()
        
        if not sale:
            return {
                "text": f"😕 No encontré el pedido #{order_num}.\n\nVerificá el número e intentá de nuevo.",
                "buttons": [
                    {"id": "status", "title": "🔍 Buscar otro"},
                    {"id": "back", "title": "⬅️ Menú principal"}
                ],
                "next_state": "menu_orders"
            }
        
        # Format order details
        status_emoji = {
            "pendiente": "⏳",
            "confirmado": "✅",
            "enviado": "🚚",
            "entregado": "📦",
            "cancelado": "❌"
        }.get(sale.estado, "📋")
        
        text = f"{status_emoji} *Pedido #{sale.numero}*\n\n"
        text += f"Estado: *{sale.estado.upper()}*\n"
        text += f"Fecha: {sale.created_at.strftime('%d/%m/%Y %H:%M')}\n"
        text += f"Total: ${sale.total:,.0f}\n\n"
        
        if sale.items:
            text += "*Productos:*\n"
            for item in sale.items[:5]:  # Show first 5 items
                text += f"• {item.producto.nombre if item.producto else 'Producto'} x{item.cantidad}\n"
            if len(sale.items) > 5:
                text += f"... y {len(sale.items) - 5} más\n"
        
        return {
            "text": text,
            "buttons": [
                {"id": "status", "title": "🔍 Otro pedido"},
                {"id": "back", "title": "⬅️ Menú principal"}
            ],
            "next_state": "menu_orders"
        }
    
    async def _show_order_history(self, conversation: WhatsAppConversation) -> Dict[str, Any]:
        """Show customer order history"""
        
        # Search sales by customer phone
        stmt = select(Sale).where(
            Sale.company_id == self.company_id,
            Sale.customer.has(telefono=conversation.contact_phone)
        ).order_by(Sale.created_at.desc()).limit(5)
        
        result = await self.db.execute(stmt)
        sales = result.scalars().all()
        
        if not sales:
            return {
                "text": "📜 No encontramos pedidos anteriores con este número de teléfono.\n\n¿Querés hacer un nuevo pedido?",
                "buttons": [
                    {"id": "new", "title": "🛒 Nuevo pedido"},
                    {"id": "back", "title": "⬅️ Menú principal"}
                ],
                "next_state": "menu_main"
            }
        
        text = "📜 *Últimos Pedidos:*\n\n"
        for sale in sales:
            status_emoji = {"entregado": "✅", "enviado": "🚚"}.get(sale.estado, "⏳")
            text += f"{status_emoji} #{sale.numero} - ${sale.total:,.0f}\n"
            text += f"   {sale.created_at.strftime('%d/%m/%Y')}\n\n"
        
        text += "Escribí el número de pedido para ver detalles:"
        
        return {
            "text": text,
            "buttons": [{"id": "back", "title": "⬅️ Volver"}],
            "next_state": "order_status"
        }
    
    async def _show_account_info(self, conversation: WhatsAppConversation) -> Dict[str, Any]:
        """Show customer account information"""
        
        # TODO: Fetch customer details from CRM
        text = f"👤 *Tu Cuenta*\n\n"
        text += f"Nombre: {conversation.contact_name or 'No registrado'}\n"
        text += f"Teléfono: {conversation.contact_phone}\n"
        text += f"Conversación: {conversation.id}\n\n"
        text += "Para actualizar tus datos, contactá a soporte."
        
        return {
            "text": text,
            "buttons": self._get_main_menu_buttons(),
            "next_state": "menu_main"
        }
    
    async def _handle_command(self, conversation: WhatsAppConversation, user_input: str) -> Dict[str, Any]:
        """Handle legacy /command syntax"""
        
        parts = user_input.split(maxsplit=1)
        command = parts[0].lower()
        args = parts[1] if len(parts) > 1 else ""
        
        if command == "/stock":
            return await self._search_products(conversation, args)
        elif command == "/pedido":
            return await self._handle_order_status(conversation, args)
        elif command == "/ayuda":
            return {
                "text": self._get_help_text(),
                "buttons": self._get_main_menu_buttons(),
                "next_state": "menu_main"
            }
        else:
            return {
                "text": f"Comando no reconocido: {command}\n\nEscribí /ayuda para ver los comandos disponibles.",
                "buttons": self._get_main_menu_buttons(),
                "next_state": "menu_main"
            }
    
    async def _handle_confirmation(self, conversation: WhatsAppConversation, user_input: str) -> Dict[str, Any]:
        """Handle yes/no confirmations"""
        
        if user_input in ["si", "sí", "yes", "1", "confirmar"]:
            # TODO: Execute confirmed action
            return {
                "text": "✅ Acción confirmada",
                "buttons": self._get_main_menu_buttons(),
                "next_state": "menu_main"
            }
        else:
            return {
                "text": "❌ Acción cancelada",
                "buttons": self._get_main_menu_buttons(),
                "next_state": "menu_main"
            }
    
    def _get_main_menu_buttons(self) -> List[Dict[str, str]]:
        """Get main menu button options"""
        return [
            {"id": "1", "title": "📦 Productos"},
            {"id": "2", "title": "📋 Pedidos"},
            {"id": "3", "title": "💬 Soporte"},
            {"id": "4", "title": "👤 Mi cuenta"}
        ]
    
    def _get_help_text(self) -> str:
        """Get help text with available commands"""
        return """🤖 *Comandos Disponibles*

*Menú Interactivo:*
Escribí cualquier mensaje para ver el menú principal

*Comandos Rápidos:*
/stock [producto] - Buscar stock
/pedido [número] - Ver estado de pedido
/ayuda - Ver este mensaje

*Opciones del Menú:*
1️⃣ Productos - Catálogo y búsqueda
2️⃣ Pedidos - Estado e historial
3️⃣ Soporte - Ayuda y contacto
4️⃣ Mi cuenta - Tus datos

¿En qué puedo ayudarte?"""


async def update_conversation_state(
    db: AsyncSession,
    conversation_id: UUID,
    new_state: str
) -> None:
    """Update conversation session state"""
    stmt = update(WhatsAppConversation).where(
        WhatsAppConversation.id == conversation_id
    ).values(session_state=new_state)
    await db.execute(stmt)
    await db.commit()


async def get_conversation_state(
    db: AsyncSession,
    conversation_id: UUID
) -> Optional[str]:
    """Get current conversation state"""
    stmt = select(WhatsAppConversation.session_state).where(
        WhatsAppConversation.id == conversation_id
    )
    result = await db.execute(stmt)
    return result.scalar_one_or_none()
