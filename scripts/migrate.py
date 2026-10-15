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
"""

ALEMBIC_VERSIONS = [
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
        await c.execute(SP3_DDL)
        print("  ✓ SP3 tables")
        await c.execute(SP5_DDL)
        print("  ✓ SP5 tables")
        await c.execute(PLATFORM_DDL)
        print("  ✓ platform tables")

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
