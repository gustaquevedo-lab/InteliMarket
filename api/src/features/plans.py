"""Centralized plan definitions with feature sets and limits.

Each plan defines:
- features: list of feature keys enabled by default
- limits: quantitative limits (branches, users, products, etc.)
- pricing: monthly price in USD
"""

from typing import TypedDict


class PlanLimits(TypedDict, total=False):
    sucursales: int
    pos: int
    usuarios: int
    facturas_mes: int
    productos: int
    almacenes: int
    usuarios_caja: int
    reportes_avanzados: bool
    api_access: bool
    integraciones: bool
    soporte: str


class PlanDefinition(TypedDict):
    nombre: str
    precio_mensual_usd: int
    features: list[str]
    limits: PlanLimits


# All available feature keys in the system
ALL_FEATURES = [
    # Core modules
    "pos",
    "crm",
    "inventory",
    "sales",
    "purchases",
    "payments",
    "reports",
    "sifen",
    "caja",
    "branches",
    # Advanced modules
    "logistics",
    "credit_accounts",
    "stock_lots",
    "variants",
    "quotes",
    "sales_orders",
    "returns",
    "discounts",
    "commissions",
    "sales_targets",
    "commercial_agreements",
    "kits",
    "accounts_receivable",
    "price_lists",
    "imports",
    "email",
    "notifications",
    "whatsapp",
    "rbac",
    # Payment gateways (beyond basic cash/card/transfer)
    "pagopar",
    "kuapay",
    "bancard",
    "spi",
    "dinelco",
    # Vertical-specific
    "pharma",
    "supermercado",
    "intelientregas",
    "boutique_pedidos",
    "loyalty",
    "portal",
    # Sub-features Farmacia
    "farmacia_pos",
    "farmacia_recetas",
    "farmacia_obras_sociales",
    "farmacia_controlados",
    "farmacia_cold_chain",
    "farmacia_safety",
    "farmacia_vencimientos",
    "farmacia_clinical",
    "client_app",
    "supplier_portal",
    "marketing_automation",
    "analytics",
    # Financial modules
    "cuentas_a_pagar",
    "cash_flow",
    "financial",
    # Distributor-specific
    "distribuidora",
    "importacion",
    "customer_agreements",
    "sales_routes",
    "customer_credit",
    # Tracking & Map
    "seller_tracking",
    "real_time_map",
    "geofence_zones",
    "seller_performance",
    # IntelliZapp
    "intellizapp",
    # Advanced Inventory
    "advanced_inventory",
    # E-commerce Web
    "ecommerce_web",
    # Integrated Financial Management
    "integrated_finance",
    # SIFEN Avanzado
    "sifen_avanzado",
    # Intelientregas advanced
    "auto_assignment",
    "time_windows",
    # Smart Pricing
    "smart_pricing",
    # Demand Forecast
    "demand_forecast",
    # Intelligent Routing
    "intelligent_routing",
    # Credit Scoring
    "credit_scoring",
    # Comerciales (Opportunity Detection)
    "comerciales",
    # IoT Cold Chain
    "cold_chain",
    # Asistente Virtual IA
    "asistente_virtual",
    # Supermercado Fase 1 modules
    "supermer_rotiseria",
    "supermer_haccp",
    "supermer_audits",
    "supermer_equipment",
    # Supermercado Fase 2 modules
    "supermer_dsd",
    "supermer_inventory",
    "supermer_replenishment",
    "supermer_returns",
    # Clientes — Fidelización & Segmentación
    "clientes_fidelizacion",
    # Scan&Go
    "scanandgo",
    # Customer 360 Analytics & Churn Prevention
    "customer360",
    # Gestión de Turnos & Planilla Horaria
    "schedule",
    # Productividad Laboral por Área
    "productividad",
    # Capacitación & Onboarding Digital
    "capacitacion",
    # PyG Diario por Departamento
    "pyg_diario",
    # Shrinkage Analysis — Merma + Robo + Error
    "shrinkage",
    # Forecasting Avanzado con Factores Externos
    "forecast_avanzado",
    # Store Benchmarking & KPI Dashboards
    "benchmarking",
    # E-commerce Supermercado
    "ecommerce_sm",
    # Delivery App Integrations
    "delivery_integrations",
    # Suscripciones & Órdenes Recurrentes
    "suscripciones",
    # Retail / Tienda vertical
    "retail",
    # Servicios Profesionales (FSM)
    "servicios",
    "servicios_agenda",
    "servicios_contratos",
    "servicios_dispatch",
    "servicios_facturacion",
    "servicios_inventario",
    "servicios_portal",
    # Boutique / Indumentaria
    "boutique",
    "boutique_colecciones",
    "boutique_matriz_variantes",
    "boutique_clienteling",
    "boutique_loyalty",
    "boutique_markdown_ia",
    "boutique_ar_tryon",
    "boutique_eventos",
    "boutique_gift_wrapping",
    "boutique_talles_personalizados",
]

# Feature labels for UI
FEATURE_LABELS: dict[str, str] = {
    # Core
    "pos": "Punto de Venta (POS)",
    "crm": "CRM / Clientes",
    "inventory": "Inventario",
    "sales": "Ventas",
    "purchases": "Compras",
    "payments": "Pagos",
    "reports": "Reportes",
    "sifen": "SIFEN / e-Kuatia",
    "caja": "Caja / Sesiones",
    "branches": "Sucursales",
    # Advanced
    "logistics": "Logística / Entregas",
    "credit_accounts": "Cuentas de Crédito",
    "stock_lots": "Lotes / FIFO-LIFO",
    "variants": "Variantes de Producto",
    "quotes": "Cotizaciones",
    "sales_orders": "Pedidos de Venta",
    "returns": "Devoluciones",
    "discounts": "Descuentos / Promociones",
    "commissions": "Comisiones Vendedores",
    "sales_targets": "Metas de Venta",
    "commercial_agreements": "Acuerdos Comerciales",
    "kits": "Kits / Combos",
    "accounts_receivable": "Cuentas por Cobrar",
    "price_lists": "Listas de Precios",
    "imports": "Importación Masiva",
    "email": "Envío de Emails",
    "notifications": "Notificaciones",
    "whatsapp": "WhatsApp Integration",
    "rbac": "Roles y Permisos",
    # Payment gateways
    "pagopar": "Pagopar",
    "kuapay": "Kuapay",
    "bancard": "Bancard VPOS",
    "spi": "SPI / QR BCP",
    "dinelco": "Dinelco",
    # Vertical-specific
    "pharma": "Módulo Farmacia",
    "farmacia_pos": "Farmacia POS — Dispensación con safety engine",
    "farmacia_recetas": "Farmacia — Recetas digitales & validación de médicos",
    "farmacia_obras_sociales": "Farmacia — Obras sociales, cobertura, cuentas corrientes, facturación",
    "farmacia_controlados": "Farmacia — Psicotrópicos, libro electrónico, DINALFA/JIFE",
    "farmacia_cold_chain": "Farmacia — Cadena de frío con sensores IoT",
    "farmacia_safety": "Farmacia — Safety engine: interacciones, duplicados, dosis, alergias, Beers",
    "farmacia_vencimientos": "Farmacia — Alertas de vencimiento con escaneo automático",
    "farmacia_clinical": "Farmacia — Perfil clínico paciente, adherencia, farmacovigilancia",
    "supermercado": "Supermercado (producción, carnicería, panadería, perecederos, forecasting)",
    "intelientregas": "InteliEntregas Delivery",
    "boutique_pedidos": "Pedidos Boutique / Pre-venta",
    "loyalty": "Programa de Lealtad",
    "portal": "Portal de Clientes",
    "client_app": "App Clientes — Marketplace B2B",
    "supplier_portal": "Portal de Proveedores — autogestión, O/C, documentos, chat",
    "marketing_automation": "Automatización de Marketing — segmentación, campañas multicanal, alertas, ofertas, encuestas",
    "ecommerce_web": "E-commerce Web — tienda online B2B con precios, carrito, pagos, integración ERP",
    "advanced_inventory": "Control de Inventario Avanzado — ubicaciones, picking, ciclo, FIFO, consignación",
    "integrated_finance": "Gestión Financiera Integrada — retenciones, cierre contable, EBITDA, conciliación, scoring, cobranzas",
    "sifen_avanzado": "Cumplimiento DNIT/SIFEN Avanzado — facturación distribuidora, libros IVA, retenciones, DGR, e-Kuatia, CDC",
    "analytics": "Analytics Avanzado",
    # Financial
    "cuentas_a_pagar": "Cuentas por Pagar / Gestión Financiera",
    "cash_flow": "Flujo de Caja / Proyecciones",
    "financial": "Dashboard Financiero Consolidado",
    # IntelliZapp
    "intellizapp": "IntelliZapp — Campañas WhatsApp & Automatización",
    # Distributor
    "distribuidora": "Módulo Distribuidora (completo)",
    "importacion": "Importación — contenedores, costos landed, nacionalización",
    "customer_agreements": "Acuerdos Comerciales con Clientes",
    "sales_routes": "Ruteo de Venta — planificación de visitas, pedidos en ruta",
    "customer_credit": "Gestión Avanzada de Crédito — topes, scoring, bloqueo automático",
    # Tracking & Map
    "seller_tracking": "Rastreo GPS de Vendedores — ubicación, batería, rutas en vivo",
    "real_time_map": "Mapa en Tiempo Real — visualización en mapa con fotos y estado",
    "geofence_zones": "Geocercas Inteligentes — zonas restringidas y alertas automáticas",
    "seller_performance": "Rendimiento de Vendedores — métricas, reportes, scoring",
    # Intelientregas advanced
    "auto_assignment": "Asignación Inteligente de Repartidores — distancia, carga óptima, capacidad vehículo",
    "time_windows": "Ventanas Horarias para Clientes — franja de 2h para recibir entregas",
    # Smart Pricing
    "smart_pricing": "Gestión de Precios Inteligente — listas multicanal, escalonados, promociones, precio dinámico IA, aprobaciones, historial",
    # Demand Forecast
    "demand_forecast": "Forecast Inteligente de Demanda — predicción ML, detección de anomalías, sugerencias de compra, override, precisión",
    # Intelligent Routing
    "intelligent_routing": "Ruteo Inteligente para Repartidores — TSP, carga vehículos, re-ruteo dinámico, ETA predictivo, dashboard eficiencia",
    "credit_scoring": "Scoring de Crédito Automático — ML scoring, límites sugeridos, alertas de riesgo, bloqueo automático, dashboard cartera",
    "comerciales": "Oportunidades Comerciales — churn detection, cross-selling, up-selling, productos dormantes, potencial crédito",
    "cold_chain": "IoT Cadena de Frío — sensores temperatura, monitoreo mapa, alertas DINALFA, simulación MQTT, reportes compliance",
    "asistente_virtual": "Asistente Virtual IA + WhatsApp — chatbot IA, consultas, pedidos, reclamos, derivación a humano, dashboard",
    "supermer_rotiseria": "Rotisería, Deli & Comidas Preparadas — recetas con rendimiento cocción, producción diaria, control térmico HACCP, etiquetado, markdown nocturno",
    "supermer_haccp": "HACCP & Cadena de Frío — puntos críticos, monitoreo temperaturas, acciones correctivas, reportes SENACSA/DIGESA",
    "supermer_audits": "Auditorías Diarias & Checklists — apertura/cierre, limpieza, inocuidad, mobile-first con foto evidencia",
    "supermer_equipment": "Mantenimiento de Equipos — cámaras frigoríficas, hornos, balanzas, POS, preventivo/correctivo, MTBF",
    "supermer_dsd": "Recepción DSD — programación citas proveedores, recepción con verificación temp/lote/vencimiento, rechazos con nota crédito",
    "supermer_inventory": "Inventario Físico & Conteo ABC — sesiones de conteo, clasificación ABC, ajustes con aprobación, dashboard precisión",
    "supermer_replenishment": "Reposición Automática & Cross-Docking — reglas lead time/stock seguridad, sugerencias, cross-dock recepción directa",
    "supermer_returns": "Devoluciones a Proveedor & Backhaul — recall, devolución, autorización, nota crédito, programación viaje retorno",
    "clientes_fidelizacion": "Clientes — Fidelización & Segmentación — RFM scoring, segmentación conductual, programa de lealtad, ofertas personalizadas, cupones",
    "scanandgo": "Scan&Go — Autopago con el Celular — escaneo de productos, carrito en vivo, pago integrado, verificación aleatoria, ticket digital",
    "customer360": "Customer 360 Analytics & Churn Prevention — canasta analítica, penetración por categoría, predicción de abandono, ciclo de vida, campañas de recuperación",
    "schedule": "Gestión de Turnos & Planilla Horaria — plantillas, plan semanal, reloj fichar, cálculo de horas extras/ nocturnas/feriadas, dashboard dotación",
    "productividad": "Productividad Laboral por Área — métricas caja/carnicería/panadería/reposición, eficiencia vs presupuesto, ranking empleados, costo por unidad, dashboard tendencias",
    "capacitacion": "Capacitación & Onboarding Digital — cursos precargados (manipulación alimentos, HACCP, atención cliente, POS, prevención pérdidas), módulos video/texto/quiz, asignación por puesto/área, progreso, certificaciones con vencimiento y recertificación, dashboard",
    "pyg_diario": "PyG Diario por Departamento — estado de resultados diario por departamento (carnicería/panadería/verdulería/almacén/limpieza/bebidas), margen bruto real vs teórico, costo de ventas FIFO, merma, costo laboral, productos con margen negativo, tendencias 7 días",
    "shrinkage": "Shrinkage Analysis — Merma + Robo + Error de Precio — venta teórica vs real, descomposición (robo externo/interno/error precio/merma no registrada/breakage), alertas de anomalía Z-score, recomendaciones automáticas, dashboard comparativo vs benchmark 2-3%",
    "forecast_avanzado": "Forecasting Avanzado con Factores Externos — modelo DOW + feriados PY (Semana Santa, Día Madre, Navidad, etc.) × impacto × clima (>35°C) + promociones + eventos + estacionalidad, calibración por categoría, descomposición de factores, intervalo de confianza",
    "benchmarking": "Store Benchmarking & KPI Dashboards — KPIs por tienda (ventas/m², margen, shrinkage, rotación, ticket, transacciones, productividad), rankings automáticos, score compuesto 0-100 con semáforo, comparativa regional, dashboard ejecutivo con tendencias",
    "ecommerce_sm": "E-commerce Supermercado — catálogo online con stock tiempo real, Click & Collect con preparación <2h, Delivery con franjas 2h y cálculo de envío por zona/distancia, picking en tienda con escaneo por pasillo, pagos Pagopar/Kuapay/Bancard/SPI/contra entrega, dashboard ejecutivo",
    "delivery_integrations": "Integración con Apps de Delivery — iFood, Rappi, PedidosYa: config multi-plataforma, webhooks para recepción de órdenes, sync de catálogo/menú, actualización de estados (preparando/listo/entregado), dashboard con órdenes por plataforma, comisiones, tiempo de preparación",
    "suscripciones": "Suscripciones & Órdenes Recurrentes — planes semanales/quincenales/mensuales con productos de consumo recurrente, descuento por fidelidad 5-10%, generación automática con notificación 24h antes, skip/pausa/reanudar, dashboard con MRR y retención",
    "retail": "Retail / Tienda — Dashboard ejecutivo con KPIs (ventas/m², ticket, hora pico, top productos, alertas stock), POS ultra-rápido con atajos de teclado y sonidos, Cliente Rápido en 1 click (teléfono/DNI/QR), Cupones Digitales con targeting RFM (6 tipos), WhatsApp Local con plantillas PY, Calendario de Eventos Paraguay-aware (15 eventos precargados: Día Madre, Padre, Niño, San Juan, Black Friday, Navidad, etc.) con promos sugeridas por IA, Tienda Online con pickup/delivery y SEO local",
    "servicios": "Servicios Profesionales (FSM) — Omni-servicios: HVAC, plomería, electricidad, belleza, fitness, salud, automotriz, construcción, IT, freelance. 28 modelos con técnicos/skills/certificaciones, agenda con AI dispatch, cotizaciones, work orders con time tracking, contratos recurrentes con auto-billing, inventario móvil (truck stock), facturas con aging",
    "servicios_agenda": "Agenda de Servicios — Calendario multi-técnico con drag&drop, ventanas de tiempo, conflictos detectados, recordatorios 24h, reagendado masivo",
    "servicios_contratos": "Contratos de Mantenimiento — Planes mensuales/trimestrales/anuales con visitas auto-generadas, SLA tracking, auto-renovación, alertas de vencimiento",
    "servicios_dispatch": "AI Dispatch — Asignación inteligente de técnicos por distancia (haversine) + skills + disponibilidad + rating, score de optimalidad",
    "servicios_facturacion": "Facturación de Servicios — Auto-invoice al completar WO, pagos parciales, aging, planes de pago, integración SIFEN Paraguay",
    "servicios_inventario": "Inventario Móvil — Truck stock por técnico, movimientos consumo/devolución/merma, alertas de stock mínimo, transferencias",
    "servicios_portal": "Portal Cliente Self-Service — Reserva de citas online, tracking en tiempo real del técnico, calificaciones, historial de servicios",
    # Boutique
    "boutique": "Boutique / Indumentaria — Módulo completo: colecciones, talles, colores, matriz variante talle×color, inventario por variante, ventas boutique, devoluciones",
    "boutique_colecciones": "Colecciones y Temporadas — Gestión de colecciones primavera/verano y otoño/invierno (hemisferio sur), items por colección, estado borrador/activa/cerrada",
    "boutique_matriz_variantes": "Matriz de Variantes Talle×Color — SKU único por combinación, stock/reservado/mínimo por variante, movimientos de stock, precio sobrecargo por variante",
    "boutique_clienteling": "Clienteling — Perfiles de cliente con preferencias (talle, color, marca, estilo), historial de interacciones, documentos, medidas corporales, notas de estilista",
    "boutique_loyalty": "Loyalty Tiers — Programa de lealtad con 4 niveles (Bronce/Plata/Oro/Platino), puntos por Gs., multiplicadores, beneficios escalonados, canje",
    "boutique_markdown_ia": "Markdown IA — Reglas de descuento progresivo por fin de temporada/exceso de stock, cálculo automático % descuento × días restantes × rotación",
    "boutique_ar_tryon": "AR Try-On — Metadatos de Realidad Aumentada: modelo 3D, GLB/USDZ, puntos de anclaje, talles disponibles para AR, integrable con Zelig/Google AR Core",
    "boutique_eventos": "Eventos y Pop-Ups — Lanzamientos, fashion shows, private sales, gestión de invitados, confirmación de asistencia",
    "boutique_gift_wrapping": "Gift Wrapping — Opciones de empaque de regalo con precio, aplicable por producto o por venta",
    "boutique_talles_personalizados": "Talles Personalizados / Bespoke — Medidas corporales por cliente, histórico de medidas, notas de alteraciones",
}


PLANS: dict[str, PlanDefinition] = {
    "starter": {
        "nombre": "Starter",
        "precio_mensual_usd": 29,
        "features": [
            "pos", "inventory", "sales", "payments", "reports",
            "caja", "branches", "sifen",
        ],
        "limits": {
            "sucursales": 1,
            "pos": 1,
            "usuarios": 3,
            "facturas_mes": 500,
            "productos": 500,
            "almacenes": 1,
            "reportes_avanzados": False,
            "api_access": False,
            "integraciones": False,
            "soporte": "email",
        },
    },
    "pro": {
        "nombre": "Pro",
        "precio_mensual_usd": 79,
        "features": [
            "pos", "crm", "inventory", "sales", "purchases", "payments",
            "reports", "sifen", "caja", "branches",
            "stock_lots", "variants", "quotes", "price_lists",
            "imports", "rbac", "notifications",
            "pagopar", "kuapay",
            "intellizapp",
            "scanandgo",
            "customer360",
            "schedule",
            "productividad",
            "capacitacion",
            "pyg_diario",
            "shrinkage",
            "forecast_avanzado",
            "benchmarking",
            "ecommerce_sm",
            "delivery_integrations",
            "suscripciones",
            "retail",
        ],
        "limits": {
            "sucursales": 5,
            "pos": 5,
            "usuarios": 15,
            "facturas_mes": 5000,
            "productos": 10000,
            "almacenes": 5,
            "reportes_avanzados": True,
            "api_access": True,
            "integraciones": True,
            "soporte": "prioritario",
        },
    },
    "enterprise": {
        "nombre": "Enterprise",
        "precio_mensual_usd": 199,
        "features": ALL_FEATURES,
        "limits": {
            "sucursales": -1,
            "pos": -1,
            "usuarios": -1,
            "facturas_mes": -1,
            "productos": -1,
            "almacenes": -1,
            "reportes_avanzados": True,
            "api_access": True,
            "integraciones": True,
            "soporte": "dedicado",
        },
    },
}


def get_plan_features(plan_slug: str) -> list[str]:
    """Get the list of features enabled for a given plan."""
    plan = PLANS.get(plan_slug)
    if not plan:
        return PLANS["starter"]["features"]
    return list(plan["features"])


def get_plan_limits(plan_slug: str) -> PlanLimits:
    """Get the limits for a given plan."""
    plan = PLANS.get(plan_slug)
    if not plan:
        return PLANS["starter"]["limits"]
    return plan["limits"]


def get_all_plans() -> list[dict]:
    """Return all plans as serializable dicts."""
    return [
        {
            "slug": slug,
            **plan,
        }
        for slug, plan in PLANS.items()
    ]
