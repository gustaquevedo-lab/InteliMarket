"""
Migration script for minisforum-ia (distribuidora VM).
Bypasses alembic (broken DNS + multiple heads) and applies DDL directly via asyncpg.
Run by deploy.sh on every deploy — all statements are idempotent (IF NOT EXISTS / IF NOT EXISTS col).
"""
import asyncio, os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '.env'))
import asyncpg

# ──────────────────────────────────────────────
# Column additions (safe to run repeatedly)
# ──────────────────────────────────────────────
COLUMN_MIGRATIONS = [
    # users extra cols
    ("users",                    "foto_url",              "VARCHAR(500)"),
    ("users",                    "current_session_id",    "VARCHAR(64)"),
    ("users",                    "pos_pin_hash",          "VARCHAR(255)"),
    ("users",                    "pos_pin_updated_at",    "TIMESTAMPTZ"),
    # companies
    ("companies",                "tenant_id",             "UUID"),
    ("companies",                "nombre_fantasia",       "VARCHAR(255)"),
    # customers
    ("customers",                "tipo",                  "VARCHAR(50) DEFAULT 'cliente'"),
    ("customers",                "tipo_persona",          "VARCHAR(20) DEFAULT 'juridica'"),
    ("customers",                "empresa_vinculada_nombre", "VARCHAR(255)"),
    # suppliers
    ("suppliers",                "nombre_fantasia",       "VARCHAR(200)"),
    # tenants
    ("tenants",                  "fecha_vencimiento",     "TIMESTAMPTZ"),
    # products
    ("products",                 "categoria_id",          "UUID"),
    # sales
    ("sales",                    "session_id",            "UUID"),
    # supplier_invoices
    ("supplier_invoices",        "total_brl",             "NUMERIC(12,2)"),
    ("supplier_invoices",        "estado",                "VARCHAR(50) DEFAULT 'pendiente'"),
    # purchase_requisitions
    ("purchase_requisitions",    "estado",                "VARCHAR(30) DEFAULT 'borrador'"),
    # demand_forecast purchase_suggestions
    ("purchase_suggestions",     "supplier_candidates",   "JSONB"),
    # tenants
    ("tenants",                  "contacto_email",        "VARCHAR(255)"),
    # customers geocoords (migration 20261012100000)
    ("customers",                "lat",                   "NUMERIC(10,8)"),
    ("customers",                "lng",                   "NUMERIC(11,8)"),
    ("customers",                "geocoded_at",           "TIMESTAMPTZ"),
    # customers extra cols
    ("customers",                "empresa_vinculada_ruc", "VARCHAR(20)"),
    # products
    ("products",                 "tipo_producto",         "VARCHAR(20) DEFAULT 'producto'"),
    # tenants
    ("tenants",                  "contacto_phone",        "VARCHAR(30)"),
    # customers
    ("customers",                "contacto",              "VARCHAR(200)"),
    # suppliers
    ("suppliers",                "contacto",              "VARCHAR(200)"),
    ("suppliers",                "contacto_nombre",       "VARCHAR(100)"),
    ("suppliers",                "contacto_telefono",     "VARCHAR(20)"),
    ("suppliers",                "contacto_email",        "VARCHAR(255)"),
    # sales_orders
    ("sales_orders",             "cliente_contacto",      "VARCHAR(100)"),
    # accounts_receivable SP4 extensions (migration 20261013110000)
    ("accounts_receivable",      "cobrador_id",           "UUID"),
    ("accounts_receivable",      "route_id",              "UUID"),
    ("accounts_receivable",      "dias_mora",             "NUMERIC(10,0) DEFAULT 0"),
    ("accounts_receivable",      "notas_cobranza",        "TEXT"),
    ("accounts_receivable",      "user_id",               "UUID"),
    ("accounts_receivable",      "corporate_remission_id","UUID"),
    ("accounts_receivable",      "remitido_empresa_at",   "TIMESTAMPTZ"),
    # receivable_payments SP4 extensions
    ("receivable_payments",      "cobrador_id",           "UUID"),
    ("receivable_payments",      "delivery_note_id",      "UUID"),
    ("receivable_payments",      "delivery_note_monto",   "NUMERIC(15,0)"),
    ("sales_reps",               "warehouse_id",          "UUID"),
    ("sales",                    "warehouse_id",          "UUID"),
    ("purchase_orders",          "ajuste_redondeo",       "NUMERIC(15,0) DEFAULT 0"),
    # companies
    ("companies",                "condicion_iva",         "VARCHAR(50) DEFAULT 'responsable_inscripto'"),
    ("companies",                "config",                "JSONB DEFAULT '{}'"),
    ("companies",                "activo",                "BOOLEAN DEFAULT true"),
    # products
    ("products",                 "precio_regular",        "NUMERIC(15,2)"),
    ("products",                 "plu_balanza",           "INTEGER"),
    ("products",                 "imagen_url",            "VARCHAR(500)"),
    # customers
    ("customers",                "limite_credito",        "NUMERIC(15,0) DEFAULT 0"),
    ("customers",                "es_agente_retencion",   "BOOLEAN DEFAULT false"),
    ("customers",                "regimen_retencion",     "VARCHAR(30) DEFAULT 'general'"),
    ("customers",                "porcentaje_retencion_iva", "NUMERIC(5,2) DEFAULT 30.00"),
    ("customers",                "idioma",                "VARCHAR(10) DEFAULT 'es'"),
    ("customers",                "whatsapp_valido",       "BOOLEAN DEFAULT true"),
    ("customers",                "arquetipo",             "VARCHAR(100)"),
    ("customers",                "tags",                  "TEXT[] DEFAULT '{}'"),
    ("customers",                "ia_analisis",           "JSONB DEFAULT '{}'"),
    # sales
    ("sales",                    "numero_interno",        "VARCHAR(20)"),
    ("sales",                    "monto_donacion",        "NUMERIC(15,0) DEFAULT 0"),
    ("sales",                    "donacion_campana",      "VARCHAR(100)"),
    ("sales",                    "donacion_ong",          "VARCHAR(100)"),
    ("sales",                    "recibo_html",           "TEXT"),
    ("sales",                    "recibo_escpos_b64",     "TEXT"),
    # suppliers
    ("suppliers",                "tipo_provision",        "VARCHAR(30) DEFAULT 'bienes'"),
    ("suppliers",                "rubro",                 "VARCHAR(100)"),
    ("suppliers",                "pais",                  "VARCHAR(50) DEFAULT 'Paraguay'"),
    ("suppliers",                "limite_credito",        "NUMERIC(14,2) DEFAULT 0"),
    ("suppliers",                "dia_visita",            "VARCHAR(50)"),
    ("suppliers",                "frecuencia_entrega",    "VARCHAR(50)"),
    ("suppliers",                "titular_cuenta_bancaria", "VARCHAR(200)"),
    ("suppliers",                "tipo_cuenta_bancaria",  "VARCHAR(50)"),
    ("suppliers",                "identificacion_bancaria", "VARCHAR(50)"),
    ("suppliers",                "porcentaje_retencion_iva", "INTEGER DEFAULT 30"),
    ("suppliers",                "agente_retencion",      "BOOLEAN DEFAULT false"),
    ("suppliers",                "admite_bonificaciones", "BOOLEAN DEFAULT false"),
    ("suppliers",                "control_envases",       "BOOLEAN DEFAULT false"),
    ("suppliers",                "vida_util_minima_dias", "INTEGER DEFAULT 0"),
    ("suppliers",                "unidad_compra_minima",  "VARCHAR(50) DEFAULT 'unidad'"),
    ("suppliers",                "escalas_costo_volumen", "JSONB DEFAULT '[]'"),
    # purchase_receipts
    ("purchase_receipts",        "supplier_id",           "UUID"),
    ("purchase_receipts",        "total",                 "NUMERIC(15,0) DEFAULT 0"),
    ("purchase_receipts",        "requiere_revision",     "BOOLEAN DEFAULT false"),
    ("purchase_receipts",        "motivo_revision",       "TEXT"),
    # purchase_receipt_items
    ("purchase_receipt_items",   "precio_unitario",       "NUMERIC(15,0) DEFAULT 0"),
    ("purchase_receipt_items",   "total",                 "NUMERIC(15,0) DEFAULT 0"),
    ("purchase_receipt_items",   "cantidad_rechazada",    "NUMERIC(10,3) DEFAULT 0"),
    ("purchase_receipt_items",   "motivo_rechazo",        "TEXT"),
    ("purchase_receipt_items",   "es_extraordinario",     "BOOLEAN DEFAULT false"),
    ("purchase_receipt_items",   "autorizado_por",        "UUID"),
    ("purchase_receipt_items",   "autorizacion_motivo",   "TEXT"),
    # warehouses
    ("warehouses",               "parent_id",             "UUID"),
    ("warehouses",               "responsable",           "VARCHAR(100)"),
    ("warehouses",               "descripcion",           "TEXT"),
    # inventory_adjustments
    ("inventory_adjustments",    "motivo_codigo",         "VARCHAR(50)"),
    ("inventory_adjustments",    "motivo_label",          "VARCHAR(120)"),
    ("inventory_adjustments",    "motivo_detalle",        "TEXT"),
    ("inventory_adjustments",    "riesgo",                "VARCHAR(10)"),
    ("inventory_adjustments",    "impacto_financiero_gs", "NUMERIC(18,0) DEFAULT 0"),
    ("inventory_adjustments",    "evidencia_urls",        "JSONB DEFAULT '[]'"),
    ("inventory_adjustments",    "aprobado_por_gerencia", "UUID"),
    ("inventory_adjustments",    "aprobado_por_gerencia_nombre", "VARCHAR(120)"),
    ("inventory_adjustments",    "fecha_aprobacion_gerencia", "TIMESTAMPTZ"),
    ("inventory_adjustments",    "comentario_gerencia",   "TEXT"),
    ("inventory_adjustments",    "aprobado_por_administracion", "UUID"),
    ("inventory_adjustments",    "aprobado_por_administracion_nombre", "VARCHAR(120)"),
    ("inventory_adjustments",    "fecha_aprobacion_administracion", "TIMESTAMPTZ"),
    ("inventory_adjustments",    "comentario_administracion", "TEXT"),
    ("inventory_adjustments",    "rechazado_por",         "UUID"),
    ("inventory_adjustments",    "rechazado_por_nombre",  "VARCHAR(120)"),
    ("inventory_adjustments",    "motivo_rechazo",        "TEXT"),
    ("inventory_adjustments",    "fecha_rechazo",         "TIMESTAMPTZ"),
    ("inventory_adjustments",    "physical_session_id",   "UUID"),
    ("inventory_adjustments",    "updated_at",            "TIMESTAMPTZ DEFAULT now()"),
    # inventory_adjustment_items
    ("inventory_adjustment_items","product_nombre",       "VARCHAR(200)"),
    ("inventory_adjustment_items","product_sku",          "VARCHAR(60)"),
    ("inventory_adjustment_items","impacto_gs",           "NUMERIC(18,0) DEFAULT 0"),
    # promotions
    ("promotions",               "precio_fijo_promocional", "NUMERIC(15,2)"),
    ("promotions",               "origen",                "VARCHAR(50)"),
    ("promotions",               "financiamiento",        "VARCHAR(50)"),
    ("promotions",               "supplier_id",           "UUID"),
    ("promotions",               "purchases_invoices_ids", "JSONB DEFAULT '[]'"),
    ("promotions",               "porcentaje_aporte_proveedor", "NUMERIC(5,2)"),
    ("promotions",               "porcentaje_aporte_tienda", "NUMERIC(5,2)"),
    ("promotions",               "monto_aporte_proveedor_pyg", "NUMERIC(15,2)"),
    ("promotions",               "monto_aporte_tienda_pyg", "NUMERIC(15,2)"),
    ("promotions",               "costo_unitario_referencia", "NUMERIC(15,2)"),
    ("promotions",               "vende_bajo_costo",      "BOOLEAN DEFAULT false"),
    ("promotions",               "base_calculo_pct",      "VARCHAR(10)"),
    ("promotions",               "terminacion_psicologica", "INTEGER"),
    ("promotions",               "precios_por_producto",  "JSONB DEFAULT '{}'"),
    ("promotions",               "estado",                "VARCHAR(50) DEFAULT 'activa'"),
    ("promotions",               "aprobado_por",          "UUID"),
    ("promotions",               "fecha_aprobacion",      "TIMESTAMPTZ"),
    ("promotions",               "limite_por_compra",     "INTEGER"),
    ("promotions",               "limitar_unidades",      "BOOLEAN DEFAULT false"),
    ("promotions",               "stock_limite_unidades", "NUMERIC(15,2)"),
    ("promotions",               "unidades_vendidas_promo", "NUMERIC(15,2) DEFAULT 0"),
    ("promotions",               "nc_estado",             "VARCHAR(50)"),
    ("promotions",               "porcentaje_nc_costo",   "NUMERIC(5,2)"),
    ("promotions",               "monto_total_nc_comprometido", "NUMERIC(15,2)"),
    ("promotions",               "fecha_vencimiento_lote", "DATE"),
    ("promotions",               "ar_receivable_id",      "UUID"),
    ("promotions",               "nc_numero_proveedor",   "VARCHAR(50)"),
    ("promotions",               "nc_timbrado_proveedor", "VARCHAR(20)"),
    ("promotions",               "nc_monto_total",        "NUMERIC(15,2)"),
    ("promotions",               "origen_fuente",         "VARCHAR(30)"),
    ("promotions",               "legacy_id",             "INTEGER"),
    ("promotions",               "usuario_registro",      "VARCHAR(100)"),
    # promotion_usages
    ("promotion_usages",         "product_id",            "UUID"),
    ("promotion_usages",         "cantidad_items",        "NUMERIC(15,2)"),
    ("promotion_usages",         "precio_regular_unitario", "NUMERIC(15,2)"),
    ("promotion_usages",         "precio_promo_unitario", "NUMERIC(15,2)"),
    ("promotion_usages",         "es_venta_mayorista",    "BOOLEAN DEFAULT false"),
    # accounting
    ("accounting_periods",       "reabierto_por",         "UUID"),
    ("accounting_periods",       "fecha_reapertura",      "TIMESTAMPTZ"),
    ("accounting_periods",       "motivo_reapertura",     "TEXT"),
    ("accounting_entries",       "reversa_de_asiento",    "VARCHAR(20)"),
    # cash
    ("cash_registers",           "cash_drop_threshold",   "NUMERIC(15,0) DEFAULT 0"),
    ("cash_registers",           "diferencia_maxima_tolerada", "NUMERIC(15,0) DEFAULT 0"),
    ("cash_sessions",            "cajero_nombre",         "VARCHAR(100)"),
    ("cash_sessions",            "monto_apertura_usd",    "NUMERIC(15,2) DEFAULT 0"),
    ("cash_sessions",            "monto_apertura_brl",    "NUMERIC(15,2) DEFAULT 0"),
    ("cash_sessions",            "ultimo_cash_drop_at",   "TIMESTAMPTZ"),
    ("cash_counts",              "monto_efectivo_usd",    "NUMERIC(12,2) DEFAULT 0"),
    ("cash_counts",              "monto_efectivo_brl",    "NUMERIC(12,2) DEFAULT 0"),
    ("cash_counts",              "diferencia_usd",        "NUMERIC(12,2) DEFAULT 0"),
    ("cash_counts",              "diferencia_brl",        "NUMERIC(12,2) DEFAULT 0"),
    ("cash_counts",              "requiere_revision",     "BOOLEAN DEFAULT false"),
    # whatsapp
    ("whatsapp_conversations",   "handling_mode",         "VARCHAR(30) DEFAULT 'bot'"),
    ("whatsapp_conversations",   "assigned_user_id",      "UUID"),
    ("whatsapp_conversations",   "assigned_user_name",    "VARCHAR(150)"),
    ("whatsapp_conversations",   "department",            "VARCHAR(50)"),
    ("whatsapp_conversations",   "waiting_since",         "TIMESTAMPTZ"),
    ("whatsapp_conversations",   "unread_agent_count",    "INTEGER DEFAULT 0"),
    ("whatsapp_messages",        "sender_type",           "VARCHAR(30) DEFAULT 'client'"),
    ("whatsapp_messages",        "sender_user_id",        "UUID"),
    ("whatsapp_messages",        "sender_name",           "VARCHAR(150)"),
    ("whatsapp_messages",        "media_type",            "VARCHAR(30)"),
    ("whatsapp_messages",        "media_filename",        "VARCHAR(255)"),
    ("whatsapp_messages",        "media_size_bytes",      "BIGINT"),
    # supplier_invoices
    ("supplier_invoices",        "saldo_pendiente_brl",   "NUMERIC(12,2) DEFAULT 0"),
    ("supplier_invoices",        "bloqueada_para_pago",   "BOOLEAN DEFAULT false"),
    ("supplier_invoices",        "motivo_bloqueo",        "TEXT"),
    ("supplier_invoices",        "monto_retenido_nc",     "NUMERIC(15,0) DEFAULT 0"),
    ("supplier_invoices",        "requiere_nc",           "BOOLEAN DEFAULT false"),
    ("supplier_invoices",        "xml_sifen_url",         "TEXT"),
    ("supplier_invoice_payments","petty_cash_fund_id",    "UUID"),
    # bank
    ("bank_accounts",            "alias",                 "VARCHAR(100)"),
    ("bank_accounts",            "saldo_minimo_alerta",   "NUMERIC(15,2) DEFAULT 0"),
    ("bank_accounts",            "saldo_verificado_manualmente", "BOOLEAN DEFAULT false"),
    ("bank_accounts",            "saldo_verificado_at",   "TIMESTAMPTZ"),
    ("bank_accounts",            "saldo_verificado_por",  "UUID"),
    ("bank_transactions",        "cheque_id",             "UUID"),
    # supplier_returns
    ("supplier_returns",         "numero_factura_origen", "VARCHAR(50)"),
    ("supplier_returns",         "numero_nota_credito",   "VARCHAR(30)"),
    ("supplier_returns",         "timbrado",              "VARCHAR(30)"),
    ("supplier_returns",         "monto",                 "NUMERIC(15,0) DEFAULT 0"),
    # expenses
    ("expenses",                 "fund_id",               "UUID"),
    ("expenses",                 "rendicion_id",          "UUID"),
    ("expenses",                 "cost_center_id",        "UUID"),
    ("expenses",                 "monto_brl",             "NUMERIC(12,2) DEFAULT 0"),
    ("expenses",                 "ruc",                   "VARCHAR(20)"),
    ("expenses",                 "timbrado",              "VARCHAR(20)"),
    ("expenses",                 "numero_factura",        "VARCHAR(50)"),
    ("expenses",                 "tipo_comprobante",      "VARCHAR(30)"),
    ("expenses",                 "gravado_10",            "NUMERIC(15,0) DEFAULT 0"),
    ("expenses",                 "gravado_5",             "NUMERIC(15,0) DEFAULT 0"),
    ("expenses",                 "exentas",               "NUMERIC(15,0) DEFAULT 0"),
    ("expenses",                 "iva_10",                "NUMERIC(15,0) DEFAULT 0"),
    ("expenses",                 "iva_5",                 "NUMERIC(15,0) DEFAULT 0"),
    ("expenses",                 "es_inversion",          "BOOLEAN DEFAULT false"),
    ("expenses",                 "fixed_asset_id",        "UUID"),
    ("expenses",                 "vida_util_meses",       "INTEGER"),
    ("expenses",                 "categoria_activo",      "VARCHAR(100)"),
    ("expenses",                 "es_pago_proveedor",     "BOOLEAN DEFAULT false"),
    ("expenses",                 "supplier_id",           "UUID"),
    ("expenses",                 "supplier_invoice_id",   "UUID"),
    ("expenses",                 "es_anticipo_sueldo",    "BOOLEAN DEFAULT false"),
    ("expenses",                 "employee_id",           "VARCHAR(100)"),
    ("expenses",                 "employee_nombre",       "VARCHAR(150)"),
    ("expenses",                 "employee_ci",           "VARCHAR(30)"),
    ("expenses",                 "periodo_nomina",        "VARCHAR(7)"),
    ("expenses",                 "cuotas_anticipo",       "INTEGER"),
    ("expenses",                 "sueldok_sync_status",   "VARCHAR(30)"),
    ("expenses",                 "sueldok_sync_id",       "VARCHAR(100)"),
    ("expenses",                 "auditoria_estado",      "VARCHAR(20)"),
    ("expenses",                 "auditoria_motivo",      "TEXT"),
    ("expenses",                 "aprobado_at",           "TIMESTAMPTZ"),
    ("expenses",                 "rechazado_por",         "UUID"),
    ("expenses",                 "rechazado_at",          "TIMESTAMPTZ"),
    ("expenses",                 "rechazado_motivo",      "TEXT"),
    ("expenses",                 "anulado",               "BOOLEAN DEFAULT false"),
    ("expenses",                 "anulado_por",           "UUID"),
    ("expenses",                 "anulado_at",            "TIMESTAMPTZ"),
    ("expenses",                 "anulado_motivo",        "TEXT"),
    ("expenses",                 "fecha_pago",            "DATE"),
    ("expenses",                 "pagado_por",            "UUID"),
    ("expenses",                 "pagado_at",             "TIMESTAMPTZ"),
    ("expenses",                 "forma_pago_resumen",    "VARCHAR(100)"),
]

# ──────────────────────────────────────────────
# Table creations (SP3 Caja/Ruta/Tesorería)
# ──────────────────────────────────────────────
SP3_DDL = """
CREATE TABLE IF NOT EXISTS route_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL,
    cobrador_id UUID NOT NULL,
    route_id UUID,
    fecha DATE NOT NULL,
    estado VARCHAR(20) NOT NULL DEFAULT 'abierta',
    fondo_inicial NUMERIC(18,0) NOT NULL DEFAULT 0,
    fondo_sobrante NUMERIC(18,0),
    opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    closed_at TIMESTAMPTZ,
    created_by UUID NOT NULL,
    CONSTRAINT uq_route_session_cobrador_fecha UNIQUE (company_id, cobrador_id, fecha)
);
CREATE INDEX IF NOT EXISTS ix_route_sessions_company_fecha ON route_sessions (company_id, fecha);

CREATE TABLE IF NOT EXISTS route_liquidations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    route_session_id UUID NOT NULL REFERENCES route_sessions(id),
    efectivo_declarado NUMERIC(18,0) NOT NULL DEFAULT 0,
    cheques_declarado NUMERIC(18,0) NOT NULL DEFAULT 0,
    pagares_declarado NUMERIC(18,0) NOT NULL DEFAULT 0,
    nc_aplicadas NUMERIC(18,0) NOT NULL DEFAULT 0,
    descuentos_autorizados NUMERIC(18,0) NOT NULL DEFAULT 0,
    efectivo_esperado NUMERIC(18,0) NOT NULL DEFAULT 0,
    total_cobrado_ar NUMERIC(18,0) NOT NULL DEFAULT 0,
    estado VARCHAR(20) NOT NULL DEFAULT 'pendiente',
    supervisor_id UUID,
    observaciones TEXT,
    fecha_autorizacion TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS route_liquidation_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    liquidation_id UUID NOT NULL REFERENCES route_liquidations(id) ON DELETE CASCADE,
    tipo VARCHAR(10) NOT NULL,
    numero VARCHAR(50) NOT NULL,
    banco VARCHAR(100),
    monto NUMERIC(18,0) NOT NULL,
    customer_id UUID,
    vencimiento DATE
);

CREATE TABLE IF NOT EXISTS bank_deposits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL,
    fecha DATE NOT NULL,
    bank_name VARCHAR(150) NOT NULL,
    account_number VARCHAR(50) NOT NULL,
    monto_efectivo NUMERIC(18,0) NOT NULL DEFAULT 0,
    monto_cheques NUMERIC(18,0) NOT NULL DEFAULT 0,
    referencia VARCHAR(100),
    route_liquidation_ids JSONB NOT NULL DEFAULT '[]',
    cash_session_ids JSONB NOT NULL DEFAULT '[]',
    observaciones TEXT,
    created_by UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_bank_deposits_company_fecha ON bank_deposits (company_id, fecha);
"""

# ──────────────────────────────────────────────
# Table creations (SP5 Logística/Reparto)
# ──────────────────────────────────────────────
SP5_DDL = """
CREATE TABLE IF NOT EXISTS trip_vehicles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL,
    patente VARCHAR(15) NOT NULL,
    descripcion VARCHAR(100),
    max_weight_kg NUMERIC(10,2) NOT NULL,
    activo BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_trip_vehicle_company_patente UNIQUE (company_id, patente)
);

CREATE TABLE IF NOT EXISTS trips (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL,
    cobrador_id UUID NOT NULL,
    patente VARCHAR(15) NOT NULL,
    fecha DATE NOT NULL,
    estado VARCHAR(20) NOT NULL DEFAULT 'armando',
    km_salida INTEGER,
    km_llegada INTEGER,
    peso_total_kg NUMERIC(10,2),
    route_session_id UUID,
    despachante_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_trip_cobrador_fecha UNIQUE (company_id, cobrador_id, fecha)
);
CREATE INDEX IF NOT EXISTS ix_trips_company_fecha ON trips (company_id, fecha);

CREATE TABLE IF NOT EXISTS trip_stops (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    sales_order_id UUID NOT NULL,
    customer_id UUID NOT NULL,
    orden_visita INTEGER NOT NULL,
    estado VARCHAR(20) NOT NULL DEFAULT 'pendiente',
    firmado BOOLEAN NOT NULL DEFAULT false,
    observaciones TEXT,
    visited_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS ix_trip_stops_trip_id ON trip_stops (trip_id);

CREATE TABLE IF NOT EXISTS trip_stop_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stop_id UUID NOT NULL REFERENCES trip_stops(id) ON DELETE CASCADE,
    sales_order_item_id UUID NOT NULL,
    product_id UUID NOT NULL,
    cantidad_asignada NUMERIC(12,3) NOT NULL,
    cantidad_entregada NUMERIC(12,3) NOT NULL DEFAULT 0,
    cantidad_rechazada NUMERIC(12,3) NOT NULL DEFAULT 0,
    cantidad_faltante NUMERIC(12,3) NOT NULL DEFAULT 0,
    nc_id UUID
);
"""

# ──────────────────────────────────────────────
# Table creations (Plataforma / Monitor)
# ──────────────────────────────────────────────
PLATFORM_DDL = """
CREATE TABLE IF NOT EXISTS mon_issues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    environment VARCHAR(12) NOT NULL DEFAULT 'production',
    fingerprint VARCHAR(64) NOT NULL,
    source VARCHAR(16) NOT NULL,
    level VARCHAR(10) NOT NULL DEFAULT 'error',
    title VARCHAR(300) NOT NULL,
    culprit VARCHAR(300),
    provider VARCHAR(40),
    status VARCHAR(12) NOT NULL DEFAULT 'unresolved',
    first_seen TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_seen TIMESTAMPTZ NOT NULL DEFAULT now(),
    occurrences INTEGER NOT NULL DEFAULT 1,
    regressions INTEGER NOT NULL DEFAULT 0,
    first_release VARCHAR(60),
    last_release VARCHAR(60),
    resolved_at TIMESTAMPTZ,
    resolved_release VARCHAR(60),
    resolved_by VARCHAR(120),
    ignored_until TIMESTAMPTZ,
    last_alert_at TIMESTAMPTZ,
    spike_alert_at TIMESTAMPTZ,
    note TEXT,
    dims JSONB NOT NULL DEFAULT '{}',
    CONSTRAINT uq_mon_issue_fp UNIQUE (environment, fingerprint)
);
CREATE INDEX IF NOT EXISTS ix_mon_issues_status_last ON mon_issues (status, last_seen);
CREATE INDEX IF NOT EXISTS ix_mon_issues_source ON mon_issues (source);
CREATE INDEX IF NOT EXISTS ix_mon_issues_provider ON mon_issues (provider);

CREATE TABLE IF NOT EXISTS mon_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    issue_id UUID NOT NULL REFERENCES mon_issues(id) ON DELETE CASCADE,
    ts TIMESTAMPTZ NOT NULL DEFAULT now(),
    level VARCHAR(10) NOT NULL DEFAULT 'error',
    message TEXT,
    stack TEXT,
    request_id VARCHAR(16),
    route VARCHAR(300),
    http_method VARCHAR(8),
    http_status INTEGER,
    duration_ms INTEGER,
    user_id VARCHAR(40),
    user_name VARCHAR(120),
    rol VARCHAR(40),
    hostname VARCHAR(80),
    punto_emision VARCHAR(10),
    release VARCHAR(60),
    app_version VARCHAR(40),
    url VARCHAR(500),
    client_ip VARCHAR(45),
    user_agent VARCHAR(300),
    breadcrumbs JSONB,
    extra JSONB
);
CREATE INDEX IF NOT EXISTS ix_mon_events_issue_ts ON mon_events (issue_id, ts);
CREATE INDEX IF NOT EXISTS ix_mon_events_ts ON mon_events (ts);

CREATE TABLE IF NOT EXISTS mon_issue_hourly (
    issue_id UUID NOT NULL REFERENCES mon_issues(id) ON DELETE CASCADE,
    bucket TIMESTAMPTZ NOT NULL,
    count INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (issue_id, bucket)
);

CREATE TABLE IF NOT EXISTS mon_heartbeats (
    key VARCHAR(120) PRIMARY KEY,
    kind VARCHAR(10) NOT NULL DEFAULT 'web',
    environment VARCHAR(12) NOT NULL DEFAULT 'production',
    hostname VARCHAR(80),
    punto_emision VARCHAR(10),
    user_name VARCHAR(120),
    rol VARCHAR(40),
    release VARCHAR(60),
    app_version VARCHAR(40),
    electron_version VARCHAR(40),
    capabilities JSONB,
    url VARCHAR(500),
    client_ip VARCHAR(45),
    user_agent VARCHAR(300),
    first_seen TIMESTAMPTZ DEFAULT now(),
    last_seen TIMESTAMPTZ DEFAULT now(),
    meta JSONB
);

CREATE TABLE IF NOT EXISTS platform_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ts TIMESTAMPTZ NOT NULL DEFAULT now(),
    actor_id VARCHAR(40),
    actor_name VARCHAR(120),
    action VARCHAR(60) NOT NULL,
    target_type VARCHAR(40),
    target_id VARCHAR(80),
    target_label VARCHAR(160),
    company_id UUID,
    before JSONB,
    after JSONB,
    client_ip VARCHAR(45)
);
CREATE INDEX IF NOT EXISTS ix_platform_audit_ts ON platform_audit (ts);

CREATE TABLE IF NOT EXISTS integration_checks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ts TIMESTAMPTZ NOT NULL DEFAULT now(),
    company_id UUID,
    provider VARCHAR(40) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'ok',
    latency_ms INTEGER,
    error_message TEXT,
    meta JSONB
);

CREATE TABLE IF NOT EXISTS platform_settings (
    key VARCHAR(60) PRIMARY KEY,
    value JSONB,
    updated_at TIMESTAMPTZ DEFAULT now()
);
"""

ADV_INVENTORY_DDL = """
CREATE TABLE IF NOT EXISTS adv_storage_locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL,
    warehouse_id UUID NOT NULL,
    codigo VARCHAR(50) NOT NULL,
    pasillo VARCHAR(50),
    estante VARCHAR(50),
    posicion VARCHAR(50),
    capacidad_maxima NUMERIC(15,3),
    activo BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT uq_location_code UNIQUE (company_id, warehouse_id, codigo)
);
CREATE INDEX IF NOT EXISTS ix_adv_storage_locations_company ON adv_storage_locations (company_id);

CREATE TABLE IF NOT EXISTS adv_picking_lists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL,
    warehouse_id UUID NOT NULL,
    numero VARCHAR(30) NOT NULL,
    referencia_tipo VARCHAR(30),
    referencia_id UUID,
    estado VARCHAR(20) NOT NULL DEFAULT 'pendiente',
    assigned_to UUID,
    notas TEXT,
    total_items INTEGER DEFAULT 0,
    picked_items INTEGER DEFAULT 0,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_adv_picking_lists_company ON adv_picking_lists (company_id);

CREATE TABLE IF NOT EXISTS adv_picking_list_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    picking_list_id UUID NOT NULL REFERENCES adv_picking_lists(id) ON DELETE CASCADE,
    product_id UUID NOT NULL,
    product_nombre VARCHAR(200),
    cantidad_solicitada NUMERIC(15,3) NOT NULL,
    cantidad_pickeada NUMERIC(15,3) DEFAULT 0,
    location_id UUID,
    lot_id UUID,
    estado VARCHAR(20) DEFAULT 'pendiente',
    notas TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS adv_cycle_counts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL,
    warehouse_id UUID NOT NULL,
    numero VARCHAR(30) NOT NULL,
    tipo VARCHAR(20) NOT NULL DEFAULT 'rotativo',
    estado VARCHAR(20) NOT NULL DEFAULT 'abierto',
    conteo_total INTEGER DEFAULT 0,
    conteo_completado INTEGER DEFAULT 0,
    discrepancias INTEGER DEFAULT 0,
    notas TEXT,
    created_by UUID,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_adv_cycle_counts_company ON adv_cycle_counts (company_id);

CREATE TABLE IF NOT EXISTS adv_cycle_count_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cycle_count_id UUID NOT NULL REFERENCES adv_cycle_counts(id) ON DELETE CASCADE,
    product_id UUID NOT NULL,
    product_nombre VARCHAR(200),
    location_id UUID,
    cantidad_sistema NUMERIC(15,3) NOT NULL DEFAULT 0,
    cantidad_fisica NUMERIC(15,3),
    diferencia NUMERIC(15,3),
    estado VARCHAR(20) DEFAULT 'pendiente',
    notas TEXT,
    counted_by UUID,
    counted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS adv_consignment_stock (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL,
    warehouse_id UUID NOT NULL,
    product_id UUID NOT NULL,
    supplier_id UUID NOT NULL,
    supplier_nombre VARCHAR(200),
    cantidad NUMERIC(15,3) NOT NULL DEFAULT 0,
    costo_acordado NUMERIC(15,2),
    moneda VARCHAR(3) DEFAULT 'PYG',
    fecha_ingreso TIMESTAMPTZ,
    fecha_vencimiento TIMESTAMPTZ,
    notas TEXT,
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_adv_consignment_company ON adv_consignment_stock (company_id);

CREATE TABLE IF NOT EXISTS adv_consignment_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    consignment_id UUID NOT NULL REFERENCES adv_consignment_stock(id) ON DELETE CASCADE,
    tipo VARCHAR(20) NOT NULL,
    cantidad NUMERIC(15,3) NOT NULL,
    referencia_tipo VARCHAR(30),
    referencia_id UUID,
    notas TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS adv_auto_replenish_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL,
    product_id UUID NOT NULL,
    warehouse_id UUID NOT NULL,
    stock_minimo NUMERIC(15,3) NOT NULL,
    stock_seguridad NUMERIC(15,3) DEFAULT 0,
    cantidad_reorden NUMERIC(15,3),
    lead_time_dias INTEGER DEFAULT 1,
    supplier_id UUID,
    activo BOOLEAN DEFAULT true,
    ultima_alerta_at TIMESTAMPTZ,
    auto_generar_oc BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT uq_replenish_rule UNIQUE (company_id, product_id, warehouse_id)
);
CREATE INDEX IF NOT EXISTS ix_adv_auto_replenish_company ON adv_auto_replenish_rules (company_id);
"""

SP4_DDL = """
CREATE TABLE IF NOT EXISTS pagares (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL,
    customer_id UUID NOT NULL,
    receivable_account_id UUID,
    numero_pagare VARCHAR(30) NOT NULL,
    monto_original NUMERIC(15,0) NOT NULL,
    saldo_pendiente NUMERIC(15,0) NOT NULL,
    fecha_emision DATE NOT NULL,
    fecha_vencimiento DATE NOT NULL,
    motivo TEXT,
    estado VARCHAR(20) NOT NULL DEFAULT 'vigente',
    cobrador_id UUID,
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_pagares_company ON pagares (company_id);
CREATE INDEX IF NOT EXISTS ix_pagares_customer ON pagares (customer_id);

CREATE TABLE IF NOT EXISTS pagare_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pagare_id UUID NOT NULL REFERENCES pagares(id),
    receivable_payment_id UUID,
    monto_aplicado NUMERIC(15,0) NOT NULL,
    fecha DATE NOT NULL,
    observaciones TEXT,
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_pagare_payments_pagare ON pagare_payments (pagare_id);

CREATE TABLE IF NOT EXISTS delivery_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL,
    customer_id UUID NOT NULL,
    sale_id UUID,
    numero_nota VARCHAR(30) NOT NULL,
    fecha DATE NOT NULL,
    monto_total NUMERIC(15,0) NOT NULL DEFAULT 0,
    estado VARCHAR(20) NOT NULL DEFAULT 'pendiente',
    cobrador_id UUID,
    cobrado_at TIMESTAMPTZ,
    observaciones TEXT,
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_delivery_notes_company ON delivery_notes (company_id);
CREATE INDEX IF NOT EXISTS ix_delivery_notes_customer ON delivery_notes (customer_id);
"""

# Índices medidos (lecturas completas en pg_stat_user_tables, 19-oct-2026). En una base con datos,
# crearlos antes a mano con CREATE INDEX CONCURRENTLY y el mismo nombre para no bloquear escrituras.
INDEX_DDL = """
CREATE INDEX IF NOT EXISTS ix_sales_order_items_order ON sales_order_items (order_id);
CREATE INDEX IF NOT EXISTS ix_sales_order_items_product ON sales_order_items (product_id);
CREATE INDEX IF NOT EXISTS ix_purchase_order_items_po ON purchase_order_items (purchase_order_id);
CREATE INDEX IF NOT EXISTS ix_purchase_order_items_product ON purchase_order_items (product_id);
CREATE INDEX IF NOT EXISTS ix_stock_product ON stock (product_id);
CREATE INDEX IF NOT EXISTS ix_sales_own_numero ON sales (company_id, created_at DESC) WHERE numero ~ '^[0-9]{8}-[A-Z0-9]{3}-[0-9]+$';
CREATE INDEX IF NOT EXISTS ix_supplier_invoices_receipt ON supplier_invoices (receipt_id);
CREATE INDEX IF NOT EXISTS ix_supplier_invoices_po ON supplier_invoices (purchase_order_id);
CREATE INDEX IF NOT EXISTS ix_supplier_invoices_company_estado_venc ON supplier_invoices (company_id, estado, fecha_vencimiento);
CREATE INDEX IF NOT EXISTS ix_purchase_orders_supplier ON purchase_orders (supplier_id);
CREATE INDEX IF NOT EXISTS ix_purchase_orders_company_fecha ON purchase_orders (company_id, fecha);
CREATE INDEX IF NOT EXISTS ix_sales_orders_company_fecha ON sales_orders (company_id, fecha);
CREATE INDEX IF NOT EXISTS ix_sales_orders_sale ON sales_orders (sale_id);
CREATE INDEX IF NOT EXISTS ix_inventory_movements_ref ON inventory_movements (referencia_id);
CREATE INDEX IF NOT EXISTS ix_inventory_movements_product_created ON inventory_movements (product_id, created_at);
"""

ALEMBIC_VERSIONS = [
    ("20260531230000", "adv_storage_locations/picking_lists/cycle_counts/consignment/replenish"),
    ("20261012100000", "geocoords lat/lng/geocoded_at on customers"),
    ("20261013110000", "pagares/delivery_notes/AR extensions"),
    ("20261014120000", "SP3 route_sessions/liquidations/bank_deposits"),
    ("20261015100000", "SP5 trip_vehicles/trips/stops/items"),
    ("20261015200000", "platform mon_issues/mon_events/mon_heartbeats/platform_audit"),
]


async def main():
    url = os.getenv('DATABASE_URL', '').replace('postgresql+asyncpg://', 'postgresql://')
    if not url:
        print("ERROR: DATABASE_URL not set", file=sys.stderr)
        sys.exit(1)
    c = await asyncpg.connect(url)
    try:
        # 1. Column additions
        existing_cols = {(r['table_name'], r['column_name']) for r in await c.fetch(
            "SELECT table_name, column_name FROM information_schema.columns WHERE table_schema='public'"
        )}
        for table, col, typ in COLUMN_MIGRATIONS:
            if (table, col) not in existing_cols:
                await c.execute(f"ALTER TABLE {table} ADD COLUMN IF NOT EXISTS {col} {typ}")
                print(f"  + column {table}.{col}")
            else:
                print(f"  ✓ {table}.{col}")

        # 2. Tables
        await c.execute(ADV_INVENTORY_DDL)
        print("  ✓ advanced inventory tables")
        await c.execute(SP4_DDL)
        print("  ✓ SP4 tables (pagares/delivery_notes)")
        await c.execute(SP3_DDL)
        print("  ✓ SP3 tables")
        await c.execute(SP5_DDL)
        print("  ✓ SP5 tables")
        await c.execute(PLATFORM_DDL)
        print("  ✓ platform tables")
        await c.execute(INDEX_DDL)
        print("  ✓ índices de rendimiento")

        # 2b. Create any remaining missing tables defined in SQLAlchemy models
        try:
            from sqlalchemy.ext.asyncio import create_async_engine
            from api.src.db import Base
            import api.src.main
            async_url = os.getenv('DATABASE_URL', '')
            if not async_url.startswith('postgresql+asyncpg://'):
                async_url = async_url.replace('postgresql://', 'postgresql+asyncpg://')
            engine = create_async_engine(async_url)
            async with engine.begin() as conn:
                await conn.run_sync(Base.metadata.create_all)
            await engine.dispose()
            print("  ✓ all missing sqlalchemy tables created (IF NOT EXISTS)")
        except Exception as e:
            print(f"  ⚠ warning creating sqlalchemy tables: {e}")


        # 3. Alembic versions
        for ver, label in ALEMBIC_VERSIONS:
            await c.execute(
                "INSERT INTO alembic_version (version_num) VALUES ($1) ON CONFLICT DO NOTHING",
                ver
            )
            print(f"  ✓ alembic {ver} ({label})")

        print("migrate.py: OK")
    finally:
        await c.close()


if __name__ == "__main__":
    asyncio.run(main())
