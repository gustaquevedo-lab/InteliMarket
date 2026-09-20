"""
Agente de IA Conversacional Local para Extra Supermercado (WhatsApp / IntelliZapp).
Conectado a Qwen 2.5 7B en Ollama (servidor intellihouse-dev: 100.72.38.119:11434),
con soporte nativo de Tool Calling hacia PostgreSQL, venta cruzada proactiva,
armado de carritos y generación de PDF de pedido / derivación a humano.
"""

import json
import logging
import re
import uuid
from datetime import datetime, date, timezone
from zoneinfo import ZoneInfo
from typing import Optional, Dict, Any, List, Tuple
import httpx
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_, desc

from api.src.config import get_settings
from api.src.whatsapp.models import WhatsAppMessage, WhatsAppConversation, MessageDirection, MessageStatus
from api.src.products.models import Product
from api.src.customers.models import Customer
from api.src.loyalty.models import LoyaltyPoints, LoyaltyConfig
from api.src.cupones.models import CuponTicket
from api.src.promotions.models import Promotion
from api.src.inventory.models import StockLot
from api.src.currency.models import ExchangeRate
from api.src.sales_orders.models import SalesOrder, SalesOrderItem
from api.src.whatsapp.order_pdf import generate_whatsapp_order_pdf

logger = logging.getLogger(__name__)
settings = get_settings()

DEFAULT_SYSTEM_PROMPT = """Eres el Asistente Virtual Oficial de "Extra Supermercado Mayorista" (Grupo Santa Teresa E.A.S., RUC: 80150377-9), ubicado en Ciudad del Este, Paraguay.

TU MISIÓN:
Brindar una atención al cliente excepcional, cálida, eficiente y comercialmente proactiva vía WhatsApp. Atiendes tanto en Español como en Portugués según el idioma en que te escriba el cliente.

PERSONALIDAD Y TONO:
- Muy amable, educado y servicial, como el mejor dependiente de atención de Extra Supermercado.
- Conciso y directo en WhatsApp: usa emojis con buen gusto, negritas para precios y listas limpias. No envíes bloques gigantescos de texto aburrido.

TUS HERRAMIENTAS Y CÓMO USARLAS:
1. Cotizaciones del Día (`consultar_cotizaciones_dia`): Úsala cuando pregunten por el cambio del Real (R$) o Dólar (US$) en caja. En Extra Supermercado la venta siempre es en Guaraníes, pero se aceptan Reales y Dólares al cambio del día.
2. Búsqueda de Productos (`buscar_productos`): Úsala SIEMPRE que pregunten por precios o disponibilidad. Devuelve precios en Gs y su equivalente en R$ según el cambio oficial del día.
3. Programa ExtraClub (`consultar_puntos_extraclub`): Úsala para consultar puntos acumulados y cupones de sorteo del cliente. Solo los socios registrados con ExtraClub acumulan puntos. La equivalencia en Guaraníes se consulta en tiempo real desde la configuración oficial del supermercado.
4. Promociones (`consultar_promociones_activas`): Úsala cuando pregunten por ofertas, descuentos o promociones del día o la semana.
5. Carrito de Compras (`gestionar_carrito`): Cuando el cliente diga "Quiero X producto", "Agregame 2 kilos de costilla", etc., usa esta herramienta para sumarlo a su canasta.
6. Finalizar Pedido (`finalizar_pedido`): Cuando el cliente confirme que terminó su pedido o pida cerrar la cuenta, ejecuta esta herramienta para emitir su presupuesto en PDF y transferirlo a un asesor humano.
7. Derivar a Humano (`derivar_a_humano`): Si el cliente tiene un reclamo complejo, una duda que no puedas resolver o pide explícitamente hablar con una persona.

VENTA CRUZADA PROACTIVA (CROSS-SELLING):
- Si el cliente agrega cortes de carnicería (costilla, vacío, picanha, chorizos), sugiere amablemente si desea sumar carbón vegetal, mandioca fresca, sal gruesa o alguna bebida/cerveza.
- Si agrega pastas o arroz, sugiere salsa de tomate o queso rallado.
- Si agrega bebidas, sugiere hielo o snacks.
- Hazlo con sutileza, una sola pregunta sugerente por mensaje, sin ser invasivo.

REGLAS DE SEGURIDAD Y CONFIDENCIALIDAD ESTRICTAS (GUARDRAILS):
- JAMÁS reveles precios de costo de compra, márgenes de ganancia, nombres de proveedores mayoristas, contraseñas, salarios o balances financieros internos. Si alguien pregunta algo confidencial, responde cordialmente que solo dispones de información de atención al cliente y ventas.
- NUNCA inventes precios ni productos que no aparezcan en la base de datos a través de tus herramientas. Si no encuentras un artículo, ofrece buscarlo con otro nombre o derivar al personal de salón.
- Horario de atención del supermercado: Lunes a Domingos de 07:30 a 21:00 hs continuado.
"""

TOOLS_SCHEMA = [
    {
        "type": "function",
        "function": {
            "name": "consultar_cotizaciones_dia",
            "description": "Obtiene las cotizaciones oficiales de divisas del día en Extra Supermercado (Guaraníes vs Reales BRL y Dólares USD).",
            "parameters": {
                "type": "object",
                "properties": {},
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "buscar_productos",
            "description": "Busca productos activos en el catálogo de Extra Supermercado por nombre o código. Retorna precios oficiales en Gs, conversión a Reales y stock disponible.",
            "parameters": {
                "type": "object",
                "properties": {
                    "termino": {
                        "type": "string",
                        "description": "Nombre, corte, marca o descripción del producto a buscar (ej: 'costilla', 'leche trebol', 'arroz tio nico', 'picanha').",
                    },
                },
                "required": ["termino"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "consultar_puntos_extraclub",
            "description": "Consulta el saldo de puntos acumulados en ExtraClub, su valor canjeable en compras y los cupones para sorteos del cliente.",
            "parameters": {
                "type": "object",
                "properties": {
                    "documento_o_telefono": {
                        "type": "string",
                        "description": "Cédula de identidad (CI), RUC o número de teléfono del cliente. Opcional si ya se conoce por el chat.",
                    },
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "consultar_promociones_activas",
            "description": "Consulta las promociones, ofertas de temporada y descuentos vigentes en Extra Supermercado.",
            "parameters": {
                "type": "object",
                "properties": {},
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "gestionar_carrito",
            "description": "Gestiona los productos del pedido o carrito de compras del cliente en la conversación actual.",
            "parameters": {
                "type": "object",
                "properties": {
                    "accion": {
                        "type": "string",
                        "enum": ["agregar", "quitar", "ver", "vaciar"],
                        "description": "Acción a realizar en el carrito.",
                    },
                    "producto_id_o_nombre": {
                        "type": "string",
                        "description": "ID o nombre del producto a agregar o quitar.",
                    },
                    "cantidad": {
                        "type": "number",
                        "description": "Cantidad de unidades o kilos (ej: 1, 2.5, 3).",
                    },
                },
                "required": ["accion"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "finalizar_pedido",
            "description": "Cierra el pedido actual del cliente, registra la orden en el sistema, genera un comprobante PDF premium bimonetario (Gs y R$) y transfiere la atención a un operador humano para coordinar cobro/entrega.",
            "parameters": {
                "type": "object",
                "properties": {
                    "notas": {
                        "type": "string",
                        "description": "Notas adicionales de entrega o preferencia de retiro del cliente.",
                    },
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "derivar_a_humano",
            "description": "Pausa el asistente virtual y transfiere la conversación a un operador o cajero humano en la interfaz de atención de Intelimarket.",
            "parameters": {
                "type": "object",
                "properties": {
                    "motivo": {
                        "type": "string",
                        "description": "Razón de la transferencia (ej: 'solicitud_cliente', 'reclamo_facturacion', 'consulta_no_resuelta').",
                    },
                },
                "required": ["motivo"],
            },
        },
    },
]


class CustomerAIAgent:
    """Motor del Agente de IA para atención al cliente y ventas en WhatsApp."""

    def __init__(self, db: AsyncSession, company_id: uuid.UUID, tenant_id: uuid.UUID):
        self.db = db
        self.company_id = company_id
        self.tenant_id = tenant_id
        self.ollama_base_url = (getattr(settings, "ollama_base_url", None) or "http://100.72.38.119:11434/v1").rstrip("/")
        self.ollama_model = getattr(settings, "ollama_model", None) or "qwen2.5:7b"

    async def get_cotizacion_brl(self) -> float:
        """Obtiene la cotización más reciente de Real (BRL) a Guaraníes."""
        res = await self.db.execute(
            select(ExchangeRate)
            .where(
                ExchangeRate.company_id == self.company_id,
                ExchangeRate.moneda == "BRL",
            )
            .order_by(desc(ExchangeRate.fecha))
            .limit(1)
        )
        rate_obj = res.scalar_one_or_none()
        if rate_obj:
            return float(rate_obj.tasa_compra or rate_obj.tasa_venta or 1400.0)
        return 1400.0  # Fallback habitual si no hay carga

    async def tool_consultar_cotizaciones_dia(self) -> Dict[str, Any]:
        """Tool: Cotizaciones del día registradas en el sistema."""
        stmt = (
            select(ExchangeRate)
            .where(ExchangeRate.company_id == self.company_id)
            .order_by(desc(ExchangeRate.fecha))
            .limit(10)
        )
        res = await self.db.execute(stmt)
        rates = res.scalars().all()

        cotizaciones = {}
        for r in rates:
            if r.moneda not in cotizaciones:
                tasa = float(r.tasa_compra or r.tasa_venta or 0)
                cotizaciones[r.moneda] = {
                    "moneda": r.moneda,
                    "tasa_gs": tasa,
                    "fecha": r.fecha.strftime("%d/%m/%Y") if r.fecha else "Vigente",
                }

        # Fallbacks razonables si falta sincronizar
        if "BRL" not in cotizaciones:
            cotizaciones["BRL"] = {"moneda": "BRL (Real)", "tasa_gs": 1400.0, "fecha": "Referencial"}
        if "USD" not in cotizaciones:
            cotizaciones["USD"] = {"moneda": "USD (Dólar)", "tasa_gs": 7800.0, "fecha": "Referencial"}

        return {
            "status": "success",
            "base": "PYG (Guaraníes)",
            "cotizaciones": cotizaciones,
            "mensaje_resumen": "En caja se reciben Reales y Dólares en efectivo al tipo de cambio del día. También aceptamos pagos con PIX y tarjetas de débito/crédito.",
        }

    async def tool_buscar_productos(self, termino: str) -> Dict[str, Any]:
        """Tool: Búsqueda en catálogo activo con precio en Gs, R$ y stock."""
        clean = termino.strip().lower()
        brl_rate = await self.get_cotizacion_brl()

        stmt = (
            select(Product)
            .where(
                Product.company_id == self.company_id,
                Product.activo == True,
            )
            .where(
                or_(
                    Product.nombre.ilike(f"%{clean}%"),
                    Product.sku.ilike(f"%{clean}%"),
                    Product.codigo_barra.ilike(f"%{clean}%"),
                )
            )
            .limit(6)
        )
        res = await self.db.execute(stmt)
        products = res.scalars().all()

        if not products:
            return {
                "status": "not_found",
                "termino": termino,
                "mensaje": f"No se encontraron productos coincidentes con '{termino}' en el catálogo activo.",
            }

        items = []
        for p in products:
            # Stock en lotes
            stock_res = await self.db.execute(
                select(func.coalesce(func.sum(StockLot.cantidad_disponible), 0)).where(
                    StockLot.product_id == p.id
                )
            )
            stock = float(stock_res.scalar() or 0)
            precio_gs = float(p.precio_venta or 0)
            precio_brl = (precio_gs / brl_rate) if brl_rate > 0 else 0.0

            items.append({
                "id": str(p.id),
                "nombre": p.nombre,
                "codigo": p.codigo_barra or p.sku or "",
                "precio_pyg": precio_gs,
                "precio_pyg_fmt": f"Gs. {int(round(precio_gs)):,}".replace(",", "."),
                "precio_brl_fmt": f"R$ {precio_brl:,.2f}".replace(",", "X").replace(".", ",").replace("X", "."),
                "stock_disponible": stock,
                "disponibilidad": "Disponible en salón" if stock > 0 else "Consultar disponibilidad",
            })

        return {
            "status": "success",
            "total_encontrados": len(items),
            "tasa_brl_aplicada": brl_rate,
            "productos": items,
        }

    async def tool_consultar_puntos_extraclub(self, conversation: WhatsAppConversation, documento_o_telefono: Optional[str] = None) -> Dict[str, Any]:
        """Tool: Saldo ExtraClub y cupones de sorteos."""
        target_phone = documento_o_telefono or conversation.contact_phone
        digits = re.sub(r"\D", "", target_phone)
        last_digits = digits[-8:] if len(digits) >= 8 else digits

        stmt = select(Customer).where(
            Customer.company_id == self.company_id,
            or_(
                Customer.telefono.ilike(f"%{last_digits}%"),
                Customer.ci.ilike(f"%{target_phone}%"),
                Customer.ruc.ilike(f"%{target_phone}%"),
            )
        ).limit(1)
        res = await self.db.execute(stmt)
        customer = res.scalar_one_or_none()

        if not customer:
            return {
                "status": "not_registered",
                "mensaje": "El número o documento no figura registrado en nuestra base de datos de Extra Supermercado. El cliente puede registrarse gratuitamente en cualquier línea de caja o con un asesor.",
            }

        # REGLA ESTRICTA: Solo quien tiene Extra Club (con número de tarjeta/socio asignado) acumula y canjea puntos
        tarjeta_socio = (customer.extra_club_numero or "").strip()
        if not tarjeta_socio:
            return {
                "status": "not_member",
                "titular": customer.razon_social,
                "documento": customer.ci or customer.ruc,
                "mensaje": f"El cliente *{customer.razon_social}* figura registrado, pero aún no tiene su membresía ExtraClub activada. Solo los socios con tarjeta ExtraClub activa pueden acumular y canjear puntos de fidelidad. Invítalo amablemente a solicitar su tarjeta física o digital en caja.",
            }

        # Consultar configuración dinámica de lealtad de la empresa (sin valores fijos en código)
        cfg_res = await self.db.execute(
            select(LoyaltyConfig).where(LoyaltyConfig.company_id == self.company_id)
        )
        loyalty_cfg = cfg_res.scalar_one_or_none()
        guarani_por_punto = int(loyalty_cfg.guarani_por_punto or 100) if loyalty_cfg else 100
        puntos_por_guarani = int(loyalty_cfg.puntos_por_guarani or 1000) if loyalty_cfg else 1000

        # Puntos verídicos acumulados
        pts_res = await self.db.execute(
            select(func.coalesce(func.sum(LoyaltyPoints.puntos), 0)).where(
                LoyaltyPoints.customer_id == customer.id
            )
        )
        total_pts = int(pts_res.scalar() or 0)
        valor_canje_gs = total_pts * guarani_por_punto

        # Cupones de sorteo
        cup_res = await self.db.execute(
            select(func.count(CuponTicket.id)).where(
                CuponTicket.company_id == self.company_id,
                CuponTicket.customer_id == customer.id,
            )
        )
        total_cupones = int(cup_res.scalar() or 0)

        return {
            "status": "success",
            "titular": customer.razon_social,
            "documento": customer.ci or customer.ruc,
            "tarjeta_extra_club": tarjeta_socio,
            "puntos_acumulados": total_pts,
            "valor_canje_pyg": valor_canje_gs,
            "valor_canje_fmt": f"Gs. {valor_canje_gs:,}".replace(",", "."),
            "cupones_sorteo_acumulados": total_cupones,
            "canje_regla": f"1 Punto ExtraClub equivale a Gs. {guarani_por_punto:,} aplicables directamente en línea de caja al pagar.".replace(",", "."),
            "acumulacion_regla": f"Acumulas 1 punto por cada Gs. {puntos_por_guarani:,} de compra.".replace(",", "."),
        }

    async def tool_consultar_promociones_activas(self) -> Dict[str, Any]:
        """Tool: Promociones y ofertas vigentes."""
        now = datetime.now(timezone.utc)
        stmt = (
            select(Promotion)
            .where(
                Promotion.company_id == self.company_id,
                Promotion.activo == True,
            )
            .order_by(desc(Promotion.prioridad))
            .limit(5)
        )
        res = await self.db.execute(stmt)
        promos = res.scalars().all()

        if not promos:
            return {
                "status": "none",
                "mensaje": "Actualmente todos nuestros productos se encuentran a precios mayoristas y minoristas de lista vigentes. ¡Consultá por tu producto preferido!",
            }

        lista = []
        for p in promos:
            lista.append({
                "nombre": p.nombre,
                "descripcion": p.descripcion or "",
                "tipo": p.tipo_descuento,
                "descuento": float(p.valor_descuento or 0),
            })

        return {
            "status": "success",
            "total_promociones": len(lista),
            "promociones": lista,
        }

    async def tool_gestionar_carrito(
        self,
        conversation: WhatsAppConversation,
        accion: str,
        producto_id_o_nombre: Optional[str] = None,
        cantidad: float = 1.0,
    ) -> Dict[str, Any]:
        """Tool: Manejo de canasta temporal en la sesión."""
        session_data = dict(conversation.session_data or {})
        cart = list(session_data.get("cart", []))
        brl_rate = await self.get_cotizacion_brl()

        if accion == "agregar":
            if not producto_id_o_nombre:
                return {"status": "error", "mensaje": "Debe especificar el producto a agregar."}

            # Buscar producto exacto o coincidente
            stmt = select(Product).where(
                Product.company_id == self.company_id,
                Product.activo == True,
                or_(
                    Product.nombre.ilike(f"%{producto_id_o_nombre.strip()}%"),
                    Product.sku.ilike(f"%{producto_id_o_nombre.strip()}%"),
                )
            ).limit(1)
            res = await self.db.execute(stmt)
            p = res.scalar_one_or_none()

            if not p:
                return {
                    "status": "error",
                    "mensaje": f"No se encontró el producto '{producto_id_o_nombre}' para agregar al carrito.",
                }

            precio = float(p.precio_venta or 0)
            cant = max(0.1, float(cantidad or 1.0))
            subtotal = cant * precio

            # Verificar si ya estaba en el carrito para sumar cantidad
            found = False
            for item in cart:
                if item.get("product_id") == str(p.id):
                    item["quantity"] = float(item["quantity"]) + cant
                    item["subtotal"] = float(item["quantity"]) * precio
                    found = True
                    break

            if not found:
                cart.append({
                    "product_id": str(p.id),
                    "product_name": p.nombre,
                    "unit_price": precio,
                    "quantity": cant,
                    "subtotal": subtotal,
                })

            session_data["cart"] = cart
            conversation.session_data = session_data

        elif accion == "quitar":
            if not producto_id_o_nombre:
                return {"status": "error", "mensaje": "Debe especificar el producto a quitar."}

            clean_term = producto_id_o_nombre.strip().lower()
            cart = [it for it in cart if clean_term not in it.get("product_name", "").lower() and it.get("product_id") != clean_term]
            session_data["cart"] = cart
            conversation.session_data = session_data

        elif accion == "vaciar":
            cart = []
            session_data["cart"] = cart
            conversation.session_data = session_data

        # Calcular totales actuales
        total_pyg = sum(float(it.get("subtotal", 0)) for it in cart)
        total_brl = (total_pyg / brl_rate) if brl_rate > 0 else 0.0

        return {
            "status": "success",
            "accion": accion,
            "items_en_carrito": cart,
            "total_items": len(cart),
            "total_pyg": total_pyg,
            "total_pyg_fmt": f"Gs. {int(round(total_pyg)):,}".replace(",", "."),
            "total_brl_fmt": f"R$ {total_brl:,.2f}".replace(",", "X").replace(".", ",").replace("X", "."),
            "tasa_brl_aplicada": brl_rate,
        }

    async def tool_finalizar_pedido(
        self,
        conversation: WhatsAppConversation,
        notas: str = "",
    ) -> Dict[str, Any]:
        """Tool: Cierra el carrito, genera SaleOrder preliminar y compila el PDF."""
        session_data = dict(conversation.session_data or {})
        cart = list(session_data.get("cart", []))

        if not cart:
            return {
                "status": "empty",
                "mensaje": "El carrito de compras se encuentra vacío. El cliente debe agregar productos antes de cerrar el pedido.",
            }

        brl_rate = await self.get_cotizacion_brl()
        total_pyg = sum(float(it.get("subtotal", 0)) for it in cart)

        # Generar código de pedido amigable
        order_num = f"WA-{datetime.now().strftime('%y%m%d')}-{str(uuid.uuid4())[:4].upper()}"

        # 1. Crear SalesOrder preliminar en la base de datos
        try:
            new_order = SalesOrder(
                company_id=self.company_id,
                numero=order_num,
                fecha=datetime.now(timezone.utc),
                estado="borrador",
                moneda="PYG",
                tipo_cambio=brl_rate,
                condicion="contado",
                subtotal=total_pyg,
                total=total_pyg,
                observaciones=f"Pedido generado por Agente IA WhatsApp. Cliente: {conversation.contact_name or 'Cliente WhatsApp'} ({conversation.contact_phone}). Notas: {notas}",
            )
            self.db.add(new_order)
            await self.db.flush()

            for it in cart:
                cant = float(it.get("quantity", 1.0))
                p_unit = float(it.get("unit_price", 0.0))
                subt = cant * p_unit
                item_obj = SalesOrderItem(
                    order_id=new_order.id,
                    product_id=uuid.UUID(it["product_id"]),
                    descripcion=it["product_name"],
                    cantidad=cant,
                    cantidad_pendiente=cant,
                    precio_unitario=p_unit,
                    total=subt,
                )
                self.db.add(item_obj)

            await self.db.flush()
        except Exception as e:
            logger.error(f"Error creando SalesOrder en base de datos: {e}", exc_info=True)

        # 2. Compilar PDF Premium con ReportLab
        try:
            pdf_bytes = generate_whatsapp_order_pdf(
                order_code=order_num,
                customer_name=conversation.contact_name or "Cliente WhatsApp",
                customer_phone=conversation.contact_phone,
                items=cart,
                total_pyg=total_pyg,
                exchange_rate_brl=brl_rate,
                notes=notas,
            )
        except Exception as e:
            logger.error(f"Error compilando PDF con ReportLab: {e}", exc_info=True)
            pdf_bytes = None

        # 3. Derivar conversación a humano
        session_data["human_takeover"] = True
        session_data["human_takeover_reason"] = "cierre_pedido_con_pdf"
        session_data["human_takeover_at"] = datetime.now(timezone.utc).isoformat()
        session_data["last_order_num"] = order_num
        session_data["cart"] = []  # Vaciamos para nueva sesión
        conversation.session_data = session_data
        conversation.session_state = "human_takeover"

        return {
            "status": "success",
            "order_code": order_num,
            "total_pyg_fmt": f"Gs. {int(round(total_pyg)):,}".replace(",", "."),
            "total_brl_fmt": f"R$ {((total_pyg / brl_rate) if brl_rate > 0 else 0):,.2f}".replace(",", "X").replace(".", ",").replace("X", "."),
            "pdf_generated": bool(pdf_bytes is not None),
            "pdf_bytes": pdf_bytes,
            "pdf_filename": f"Pedido_{order_num}.pdf",
            "mensaje": f"El pedido #{order_num} fue registrado con éxito. Se generó el comprobante PDF bimonetario y la atención se derivó a un asesor humano para coordinar la cobranza o despacho.",
        }

    async def tool_derivar_a_humano(self, conversation: WhatsAppConversation, motivo: str = "solicitud_cliente") -> Dict[str, Any]:
        """Tool: Pausa el bot y deriva al equipo de atención humana."""
        session_data = dict(conversation.session_data or {})
        session_data["human_takeover"] = True
        session_data["human_takeover_reason"] = motivo
        session_data["human_takeover_at"] = datetime.now(timezone.utc).isoformat()
        conversation.session_data = session_data
        conversation.session_state = "human_takeover"

        return {
            "status": "success",
            "motivo": motivo,
            "mensaje": "La conversación ha sido transferida a un asesor humano. El bot quedará en pausa para permitir la atención personalizada.",
        }

    async def execute_tool_call(self, tool_name: str, args: Dict[str, Any], conversation: WhatsAppConversation) -> Tuple[Dict[str, Any], Optional[bytes], Optional[str]]:
        """Ejecuta una herramienta y retorna (resultado_json, pdf_bytes_si_aplica, pdf_filename)."""
        pdf_bytes = None
        pdf_filename = None

        if tool_name == "consultar_cotizaciones_dia":
            res = await self.tool_consultar_cotizaciones_dia()
        elif tool_name == "buscar_productos":
            res = await self.tool_buscar_productos(args.get("termino", ""))
        elif tool_name == "consultar_puntos_extraclub":
            res = await self.tool_consultar_puntos_extraclub(conversation, args.get("documento_o_telefono"))
        elif tool_name == "consultar_promociones_activas":
            res = await self.tool_consultar_promociones_activas()
        elif tool_name == "gestionar_carrito":
            res = await self.tool_gestionar_carrito(
                conversation,
                args.get("accion", "ver"),
                args.get("producto_id_o_nombre"),
                float(args.get("cantidad", 1.0)),
            )
        elif tool_name == "finalizar_pedido":
            res = await self.tool_finalizar_pedido(conversation, args.get("notas", ""))
            if res.get("pdf_generated") and res.get("pdf_bytes"):
                pdf_bytes = res.pop("pdf_bytes")
                pdf_filename = res.get("pdf_filename")
        elif tool_name == "derivar_a_humano":
            res = await self.tool_derivar_a_humano(conversation, args.get("motivo", "solicitud_cliente"))
        else:
            res = {"status": "error", "mensaje": f"Herramienta '{tool_name}' desconocida."}

        return res, pdf_bytes, pdf_filename

    async def process_message(
        self,
        conversation: WhatsAppConversation,
        incoming_text: str,
        custom_instructions: str = "",
        emphasis_promotions: str = "",
    ) -> Dict[str, Any]:
        """Procesa un mensaje entrante mediante el ciclo ReAct con Qwen 2.5 en Ollama."""
        # 1. Comprobar si la conversación está en pausa por atención humana
        session_data = conversation.session_data or {}
        if session_data.get("human_takeover"):
            # Si el cliente escribe explícitamente "bot", "reactivar" o "asistente", podemos despausar
            clean_in = incoming_text.strip().lower()
            if clean_in in ["bot", "reactivar", "asistente", "menu", "reiniciar"]:
                session_data["human_takeover"] = False
                session_data.pop("human_takeover_reason", None)
                conversation.session_data = session_data
                conversation.session_state = "ai_agent"
                await self.db.commit()
            else:
                logger.info(f"[AIAgent] Conversación {conversation.id} en Human Takeover. No se responde automáticamente.")
                return {"text": None, "pdf_bytes": None}

        # 2. Construir historial de mensajes recientes (últimos 8 mensajes)
        recent_msgs_res = await self.db.execute(
            select(WhatsAppMessage)
            .where(WhatsAppMessage.conversation_id == conversation.id)
            .order_by(desc(WhatsAppMessage.created_at))
            .limit(8)
        )
        recent_msgs = list(reversed(recent_msgs_res.scalars().all()))

        # System Prompt enriquecido con directivas de la administración
        system_content = DEFAULT_SYSTEM_PROMPT
        if custom_instructions:
            system_content += f"\n\nDIRECTIVAS ADICIONALES DE LA ADMINISTRACIÓN:\n{custom_instructions}"
        if emphasis_promotions:
            system_content += f"\n\nPROMOCIONES CON ÉNFASIS ESPECIAL HOY (Sugierelas activamente cuando sea propicio):\n{emphasis_promotions}"

        messages: List[Dict[str, Any]] = [
            {"role": "system", "content": system_content}
        ]

        for m in recent_msgs:
            role = "assistant" if m.direction == MessageDirection.outbound else "user"
            if m.content:
                messages.append({"role": role, "content": m.content})

        # Si el último mensaje del historial no es el incoming_text actual, agregarlo
        if not messages or messages[-1].get("content") != incoming_text:
            messages.append({"role": "user", "content": incoming_text})

        # 3. Invocar a Ollama con Tools
        url = f"{self.ollama_base_url}/chat/completions"
        payload = {
            "model": self.ollama_model,
            "messages": messages,
            "tools": TOOLS_SCHEMA,
            "temperature": 0.3,
            "max_tokens": 1000,
            "stream": False,
        }

        generated_pdf_bytes = None
        generated_pdf_filename = None

        try:
            async with httpx.AsyncClient(timeout=90.0) as client:
                res = await client.post(url, json=payload)
                if res.status_code != 200:
                    logger.error(f"[AIAgent] Error de Ollama HTTP {res.status_code}: {res.text}")
                    return {
                        "text": "Disculpá, en este momento estoy teniendo una pequeña demora en el sistema. En instantes un asesor continuará tu consulta. 🙏",
                        "pdf_bytes": None,
                    }

                data = res.json()
                choice = data.get("choices", [{}])[0]
                message = choice.get("message", {})
                tool_calls = message.get("tool_calls")

                # Si el modelo decidió invocar herramientas
                if tool_calls:
                    messages.append(message)  # Agregar la respuesta con las llamadas

                    for tc in tool_calls:
                        fn_name = tc.get("function", {}).get("name")
                        fn_args_raw = tc.get("function", {}).get("arguments", "{}")
                        try:
                            fn_args = json.loads(fn_args_raw) if isinstance(fn_args_raw, str) else (fn_args_raw or {})
                        except Exception:
                            fn_args = {}

                        logger.info(f"[AIAgent] Ejecutando tool '{fn_name}' con args: {fn_args}")
                        tool_result, pdf_b, pdf_fn = await self.execute_tool_call(fn_name, fn_args, conversation)

                        if pdf_b:
                            generated_pdf_bytes = pdf_b
                            generated_pdf_filename = pdf_fn

                        messages.append({
                            "role": "tool",
                            "tool_call_id": tc.get("id", "call_1"),
                            "content": json.dumps(tool_result, ensure_ascii=False),
                        })

                    # Segunda llamada a Ollama para que redacte la respuesta final con la data
                    payload["messages"] = messages
                    payload["tools"] = None  # Evitar bucle infinito de tools
                    res2 = await client.post(url, json=payload)
                    if res2.status_code == 200:
                        data2 = res2.json()
                        final_text = data2.get("choices", [{}])[0].get("message", {}).get("content", "")
                    else:
                        final_text = "He consultado la información en nuestro sistema, ¿en qué más te puedo ayudar?"

                else:
                    final_text = message.get("content", "")

                await self.db.commit()

                return {
                    "text": final_text,
                    "pdf_bytes": generated_pdf_bytes,
                    "pdf_filename": generated_pdf_filename,
                }

        except Exception as err:
            logger.error(f"[AIAgent] Excepción invocando a Ollama: {err}", exc_info=True)
            return {
                "text": "¡Hola! En instantes un compañero de atención al cliente te responderá por este chat. ¡Muchas gracias por escribir a Extra Supermercado!",
                "pdf_bytes": None,
            }
