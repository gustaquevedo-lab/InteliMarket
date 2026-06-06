"""Vertical presets for industry-specific configurations.

Each vertical defines:
- slug: unique identifier
- nombre: display name
- descripcion: marketing description
- features: list of feature keys enabled by this vertical
- config_defaults: operational settings applied when vertical is activated
- payment_gateways: payment gateways recommended for this vertical
"""

from dataclasses import dataclass, field
from typing import Optional


@dataclass
class VerticalPreset:
    slug: str
    nombre: str
    descripcion: str
    features: list[str] = field(default_factory=list)
    config_defaults: dict = field(default_factory=dict)
    payment_gateways: list[str] = field(default_factory=list)
    icon: str = "store"


# ============================================================
# CORE VERTICALS
# ============================================================

VERTICALS: dict[str, VerticalPreset] = {
    "retail": VerticalPreset(
        slug="retail",
        nombre="Retail / Tienda",
        descripcion="Para tiendas minoristas, boutiques, locales comerciales. Foco en POS, inventario simple, clientes frecuentes.",
        features=[
            "pos", "crm", "inventory", "sales", "purchases", "payments",
            "reports", "sifen", "caja", "branches",
            "quotes", "price_lists", "imports", "rbac", "notifications",
            "retail",
            "marketing", "whatsapp",
            "ecommerce",
        ],
        config_defaults={
            "iva_default": 10,
            "tipo_comprobante_default": "ticket",
            "allow_credit_sales": False,
            "track_lots": False,
            "track_expiry": False,
        },
        payment_gateways=["pagopar", "kuapay"],
        icon="store",
    ),
    "distribucion": VerticalPreset(
        slug="distribucion",
        nombre="Distribución / Mayorista",
        descripcion="Para distribuidores, mayoristas e importadores. Gestión completa: importación con costos landed, acuerdos comerciales con proveedores y clientes, ruteo de venta, gestión de crédito, cobranzas en ruta, InteliCont integrado.",
        features=[
            "pos", "crm", "inventory", "sales", "purchases", "payments",
            "reports", "sifen", "caja", "branches", "returns",
            "logistics", "credit_accounts", "stock_lots", "variants",
            "quotes", "sales_orders", "price_lists", "imports", "rbac",
            "notifications", "commercial_agreements", "accounts_receivable",
            "commissions", "discounts", "whatsapp", "intellizapp",
            "financial", "cuentas_a_pagar", "cash_flow",
            # Distribuidora-specific
            "distribuidora", "importacion", "customer_agreements",
            "sales_routes", "customer_credit",
            # Delivery
            "intelientregas",
            # B2B Client App
            "client_app",
            # Supplier Portal
            "supplier_portal",
            # Marketing Automation
            "marketing_automation",
            # E-commerce Web
            "ecommerce_web",
            # Advanced Inventory
            "advanced_inventory",
            # Integrated Financial Management
            "integrated_finance",
            # SIFEN Avanzado
            "sifen_avanzado",
            # Smart Pricing
            "smart_pricing",
            # Demand Forecast
            "demand_forecast",
            # Intelligent Routing
            "intelligent_routing",
            # Credit Scoring
            "credit_scoring",
            # Comerciales
            "comerciales",
            # IoT Cold Chain
            "cold_chain",
            # Asistente Virtual
            "asistente_virtual",
            # Clientes — Fidelización & Segmentación
            "clientes_fidelizacion",
            # Scan&Go
            "scanandgo",
            # Customer 360 Analytics
            "customer360",
            # Gestión de Turnos
            "schedule",
            # Productividad Laboral
            "productividad",
            # Capacitación Digital
            "capacitacion",
            # PyG Diario
            "pyg_diario",
            # Shrinkage Analysis
            "shrinkage",
            # Forecasting Avanzado
            "forecast_avanzado",
            # Store Benchmarking
            "benchmarking",
        ],
        config_defaults={
            "iva_default": 10,
            "tipo_comprobante_default": "factura",
            "allow_credit_sales": True,
            "multi_warehouse": True,
            "track_lots": True,
            "track_expiry": True,
            "import_landed_cost_auto": True,
            "import_default_incoterm": "FOB",
            "customer_credit_auto_block": True,
            "customer_credit_days_overdue_block": 60,
            "sales_route_geotrack": True,
            "sales_route_offline_mode": True,
            # Limits
            "sucursales": 5,
            "pos": 10,
            "usuarios": 30,
            "productos": 50000,
            "facturas_mes": 30000,
        },
        payment_gateways=["pagopar", "kuapay", "bancard", "spi"],
        icon="truck",
    ),
    "farmacia": VerticalPreset(
        slug="farmacia",
        nombre="Farmacia / Droguería",
        descripcion="Para farmacias y droguerías. Control de lotes, vencimientos, principios activos, equivalencias, recetas médicas, sustancias controladas, cadena de frío y obras sociales.",
        features=[
            "pos", "crm", "inventory", "sales", "purchases", "payments",
            "reports", "sifen", "caja", "branches",
            "stock_lots", "variants", "quotes", "price_lists", "imports",
            "rbac", "notifications",
            # Pharma-specific
            "pharma",
            # Delivery
            "intelientregas",
        ],
        config_defaults={
            "iva_default": 10,
            "tipo_comprobante_default": "ticket",
            "track_lots": True,
            "track_expiry": True,
            "allow_credit_sales": False,
            "pharma_requires_principio_activo": True,
            "pharma_requires_registro_sanitario": True,
            "pharma_expiry_alert_days": 90,
            "pharma_critical_expiry_days": 30,
            "pharma_allow_generic_substitution": True,
            "pharma_requires_receta_for_controlados": True,
        },
        payment_gateways=["pagopar", "kuapay", "bancard", "spi"],
        icon="pill",
    ),
    "supermercado": VerticalPreset(
        slug="supermercado",
        nombre="Supermercado / Autoservicio",
        descripcion="Para supermercados y autoservicios. Gestión completa: producción (carnicería, panadería, rotisería), perecederos con markdown automático, mermas, forecasting de compras, múltiples cajas, balanzas integradas.",
        features=[
            "pos", "crm", "inventory", "sales", "purchases", "payments",
            "reports", "sifen", "caja", "branches",
            "variants", "price_lists", "imports", "rbac", "notifications",
            "discounts", "kits", "loyalty", "stock_lots", "returns",
            "whatsapp", "sales_orders", "commercial_agreements",
            # Supermarket-specific
            "supermercado",
            # Supermercado Fase 1 — Operaciones
            "supermer_rotiseria",
            "supermer_haccp",
            "supermer_audits",
            "supermer_equipment",
            # Supermercado Fase 2 — Supply Chain
            "supermer_dsd",
            "supermer_inventory",
            "supermer_replenishment",
            "supermer_returns",
            # Store Benchmarking
            "benchmarking",
            # E-commerce Supermercado
            "ecommerce_sm",
            # Delivery App Integrations
            "delivery_integrations",
            # Suscripciones Recurrentes
            "suscripciones",
            # Delivery
            "intelientregas",
        ],
        config_defaults={
            "iva_default": 10,
            "tipo_comprobante_default": "ticket",
            "multi_cash_register": True,
            "allow_credit_sales": False,
            "track_lots": True,
            "track_expiry": True,
            "multi_warehouse": True,
            # Production
            "production_enabled": True,
            "production_requires_receta": True,
            "production_track_yield": True,
            # Perishables
            "perishable_expiry_alert_days": 60,
            "perishable_critical_days": 15,
            "perishable_markdown_green": 0,
            "perishable_markdown_yellow": 20,
            "perishable_markdown_red": 50,
            "perishable_markdown_critical_days": 3,
            # Forecasting
            "forecasting_enabled": True,
            "forecasting_lookback_days": 90,
            "forecasting_weather_adjust": True,
            "forecasting_event_adjust": True,
            # Scale (supermercado promedio PY)
            "sucursales": 1,
            "pos": 5,
            "usuarios": 20,
            "productos": 30000,
            "facturas_mes": 15000,
        },
        payment_gateways=["pagopar", "kuapay", "bancard", "spi", "dinelco"],
        icon="shopping-cart",
    ),
    "servicios": VerticalPreset(
        slug="servicios",
        nombre="Servicios Profesionales",
        descripcion="Para empresas de servicios. Foco en facturación, cuentas por cobrar, sin inventario físico.",
        features=[
            "crm", "sales", "payments", "reports", "sifen", "branches",
            "credit_accounts", "quotes", "commissions", "rbac", "notifications",
            "accounts_receivable", "commercial_agreements",
        ],
        config_defaults={
            "iva_default": 10,
            "tipo_comprobante_default": "factura",
            "inventory_enabled": False,
            "allow_credit_sales": True,
        },
        payment_gateways=["pagopar", "kuapay"],
        icon="briefcase",
    ),
    "boutique": VerticalPreset(
        slug="boutique",
        nombre="Boutique / Tienda de Ropa",
        descripcion="Para boutiques y tiendas de indumentaria. Pedidos pre-factura con InteliEntregas, prueba de prendas y facturación electrónica solo post-aprobación.",
        features=[
            "pos", "crm", "inventory", "sales", "purchases", "payments",
            "reports", "sifen", "caja", "branches",
            "variants", "quotes", "price_lists", "imports",
            "rbac", "notifications", "whatsapp",
            "discounts", "loyalty", "returns",
            # Boutique-specific
            "boutique_pedidos",
            "intelientregas",
        ],
        config_defaults={
            "iva_default": 10,
            "tipo_comprobante_default": "ticket",
            "allow_credit_sales": False,
            "invoice_after_delivery": True,
            "track_lots": False,
            "track_expiry": False,
        },
        payment_gateways=["pagopar", "kuapay", "bancard", "spi"],
        icon="shirt",
    ),
    "custom": VerticalPreset(
        slug="custom",
        nombre="Personalizado",
        descripcion="Configuración libre. Elegí los módulos que necesitás manualmente.",
        features=[],  # All features available for manual selection
        config_defaults={},
        payment_gateways=[],
        icon="cog",
    ),
    "servicios": VerticalPreset(
        slug="servicios",
        nombre="Servicios Profesionales (FSM)",
        descripcion="Para empresas de servicios en campo: HVAC, plomería, electricidad, belleza, salud, automotriz, IT, construcción, jardinería, limpieza, freelance. Técnicos, agenda, cotizaciones, work orders, contratos, inventario móvil, facturación.",
        features=[
            "pos", "crm", "sales", "purchases", "payments",
            "reports", "sifen", "caja", "branches",
            "quotes", "price_lists", "rbac", "notifications",
            "servicios", "servicios_agenda", "servicios_contratos",
            "servicios_dispatch", "servicios_facturacion",
            "servicios_inventario", "servicios_portal",
            "marketing", "whatsapp",
        ],
        config_defaults={
            "iva_default": 10,
            "tipo_comprobante_default": "factura",
            "allow_credit_sales": True,
            "track_lots": False,
            "track_expiry": False,
            "enable_geo_dispatch": True,
            "enable_mobile_inventory": True,
        },
        payment_gateways=["pagopar", "kuapay", "bancard", "spi"],
        icon="wrench",
    ),
}


# ============================================================
# PHARMA-SPECIFIC FEATURES
# ============================================================

PHARMA_FEATURES = [
    "pharma_medications",
    "pharma_equivalents",
    "pharma_expiry_alerts",
    "pharma_controlled",
    "pharma_cold_chain",
    "pharma_prescriptions",
    "pharma_insurance",
    "pharma_principio_activo_search",
]

PHARMA_FEATURE_LABELS: dict[str, str] = {
    "pharma_medications": "Registro de Medicamentos",
    "pharma_equivalents": "Equivalencias Genéricos/Marca",
    "pharma_expiry_alerts": "Alertas de Vencimiento",
    "pharma_controlled": "Sustancias Controladas",
    "pharma_cold_chain": "Cadena de Frío",
    "pharma_prescriptions": "Gestión de Recetas",
    "pharma_insurance": "Obras Sociales / Prepagas",
    "pharma_principio_activo_search": "Búsqueda por Principio Activo",
}


# ============================================================
# HELPER FUNCTIONS
# ============================================================

def get_vertical(slug: str) -> VerticalPreset | None:
    return VERTICALS.get(slug)


def get_all_verticals() -> list[VerticalPreset]:
    return list(VERTICALS.values())


def get_features_for_vertical(slug: str) -> list[str]:
    v = VERTICALS.get(slug)
    if not v:
        return []
    if slug == "custom":
        from api.src.features.plans import ALL_FEATURES
        return ALL_FEATURES
    return list(v.features)


def get_config_defaults_for_vertical(slug: str) -> dict:
    v = VERTICALS.get(slug)
    return dict(v.config_defaults) if v else {}


def get_payment_gateways_for_vertical(slug: str) -> list[str]:
    v = VERTICALS.get(slug)
    return list(v.payment_gateways) if v else []


def is_feature_enabled(tenant_config: Optional[dict], feature: str) -> bool:
    """Check if a feature is enabled in tenant config."""
    if not tenant_config:
        return True
    features = tenant_config.get("enabled_features", [])
    return feature in features


def is_payment_gateway_enabled(tenant_config: Optional[dict], gateway: str) -> bool:
    """Check if a payment gateway is enabled in tenant config."""
    if not tenant_config:
        return True
    gateways = tenant_config.get("payment_gateways", [])
    return gateway in gateways
