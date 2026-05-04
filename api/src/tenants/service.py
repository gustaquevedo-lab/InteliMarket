"""Tenant service — schema provisioning and management"""

from sqlalchemy import text, select
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime, timezone
import uuid

from api.src.tenants.models import Tenant, UserTenant
from api.src.auth.models import User
from api.src.auth.jwt import hash_password


async def create_tenant_with_schema(
    db: AsyncSession,
    nombre: str,
    slug: str,
    user_email: str,
    user_password: str,
    user_nombre: str,
    plan: str = "starter",
) -> Tenant:
    tenant_id = uuid.uuid4()
    schema_name = f"tenant_{tenant_id.hex[:12]}"

    tenant = Tenant(
        id=tenant_id,
        nombre=nombre,
        slug=slug,
        plan=plan,
        schema_name=schema_name,
        fecha_inicio=datetime.now(timezone.utc),
    )

    user = User(
        email=user_email,
        password_hash=hash_password(user_password),
        nombre=user_nombre,
        rol="admin",
    )

    user_tenant = UserTenant(
        user_id=user.id,
        tenant_id=tenant_id,
        rol="admin",
    )

    db.add(tenant)
    db.add(user)
    db.add(user_tenant)
    await db.flush()

    await create_tenant_schema(schema_name)
    await seed_tenant_schema(schema_name)

    return tenant


async def create_tenant_schema(schema_name: str):
    engine = __import__("api.src.db", fromlist=["engine"]).engine
    async with engine.begin() as conn:
        await conn.execute(text(f"CREATE SCHEMA IF NOT EXISTS {schema_name}"))


PLAN_LIMITS = {
    "starter": {"sucursales": 1, "pos": 1, "usuarios": 2, "facturas_mes": 500, "productos": 500, "almacenes": 1},
    "professional": {"sucursales": 3, "pos": 3, "usuarios": 10, "facturas_mes": 5000, "productos": 10000, "almacenes": 3},
    "business": {"sucursales": 10, "pos": 10, "usuarios": 50, "facturas_mes": 50000, "productos": -1, "almacenes": 10},
    "enterprise": {"sucursales": -1, "pos": -1, "usuarios": -1, "facturas_mes": -1, "productos": -1, "almacenes": -1},
}


async def seed_tenant_schema(schema_name: str):
    engine = __import__("api.src.db", fromlist=["engine"]).engine

    tenant_tables_sql = """
    CREATE TABLE IF NOT EXISTS {schema}.companies (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        ruc VARCHAR(15) NOT NULL UNIQUE,
        razon_social VARCHAR(255) NOT NULL,
        nombre_fantasia VARCHAR(255),
        actividad_principal VARCHAR(255),
        regimen_tributario VARCHAR(50) NOT NULL,
        iva_condition VARCHAR(20) NOT NULL,
        direccion TEXT,
        ciudad VARCHAR(100),
        departamento VARCHAR(100),
        telefono VARCHAR(20),
        email VARCHAR(255),
        logo_url TEXT,
        timbrado_numero VARCHAR(20),
        timbrado_vigencia_desde DATE,
        timbrado_vigencia_hasta DATE,
        sifen_enabled BOOLEAN DEFAULT false,
        sifen_cert_path TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS {schema}.branches (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id UUID NOT NULL REFERENCES {schema}.companies(id),
        codigo VARCHAR(3) NOT NULL,
        nombre VARCHAR(100) NOT NULL,
        direccion TEXT,
        ciudad VARCHAR(100),
        telefono VARCHAR(20),
        activo BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS {schema}.emission_points (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        branch_id UUID NOT NULL REFERENCES {schema}.branches(id),
        codigo VARCHAR(3) NOT NULL,
        tipo VARCHAR(20) NOT NULL,
        secuencia_actual BIGINT DEFAULT 0,
        activo BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS {schema}.product_categories (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id UUID NOT NULL REFERENCES {schema}.companies(id),
        parent_id UUID REFERENCES {schema}.product_categories(id),
        nombre VARCHAR(100) NOT NULL,
        codigo VARCHAR(20) UNIQUE,
        activo BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS {schema}.products (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id UUID NOT NULL REFERENCES {schema}.companies(id),
        category_id UUID REFERENCES {schema}.product_categories(id),
        sku VARCHAR(50) NOT NULL,
        codigo_barra VARCHAR(50),
        nombre VARCHAR(200) NOT NULL,
        descripcion TEXT,
        tipo VARCHAR(20) NOT NULL DEFAULT 'producto',
        unidad_medida VARCHAR(10) DEFAULT 'UN',
        iva_tasa NUMERIC(5,2) DEFAULT 10,
        metodo_costeo VARCHAR(10) DEFAULT 'promedio',
        tiene_lotes BOOLEAN DEFAULT false,
        tiene_vencimiento BOOLEAN DEFAULT false,
        tiene_serial BOOLEAN DEFAULT false,
        stock_minimo INTEGER DEFAULT 0,
        stock_maximo INTEGER,
        peso_kg NUMERIC(10,3),
        activo BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(company_id, sku)
    );

    CREATE TABLE IF NOT EXISTS {schema}.price_lists (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id UUID NOT NULL REFERENCES {schema}.companies(id),
        nombre VARCHAR(100) NOT NULL,
        moneda VARCHAR(3) NOT NULL DEFAULT 'PYG',
        tipo VARCHAR(20) NOT NULL DEFAULT 'venta',
        activa BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS {schema}.product_prices (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        price_list_id UUID NOT NULL REFERENCES {schema}.price_lists(id),
        product_id UUID NOT NULL REFERENCES {schema}.products(id),
        variant_id UUID,
        precio NUMERIC(15,0) NOT NULL,
        precio_minimo NUMERIC(15,0),
        valido_desde DATE,
        valido_hasta DATE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(price_list_id, product_id, variant_id)
    );

    CREATE TABLE IF NOT EXISTS {schema}.customers (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id UUID NOT NULL REFERENCES {schema}.companies(id),
        tipo_persona VARCHAR(20) NOT NULL DEFAULT 'juridica',
        ruc VARCHAR(15),
        ci VARCHAR(20),
        razon_social VARCHAR(255) NOT NULL,
        nombre_fantasia VARCHAR(255),
        condicion_iva VARCHAR(20),
        direccion TEXT,
        ciudad VARCHAR(100),
        departamento VARCHAR(100),
        telefono VARCHAR(20),
        email VARCHAR(255),
        price_list_id UUID REFERENCES {schema}.price_lists(id),
        credito_limite NUMERIC(15,0) DEFAULT 0,
        credito_usado NUMERIC(15,0) DEFAULT 0,
        pago_default VARCHAR(20),
        activo BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS {schema}.warehouses (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id UUID NOT NULL REFERENCES {schema}.companies(id),
        branch_id UUID REFERENCES {schema}.branches(id),
        codigo VARCHAR(10) NOT NULL,
        nombre VARCHAR(100) NOT NULL,
        direccion TEXT,
        tipo VARCHAR(20) DEFAULT 'principal',
        activo BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS {schema}.stock (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        warehouse_id UUID NOT NULL REFERENCES {schema}.warehouses(id),
        product_id UUID NOT NULL REFERENCES {schema}.products(id),
        variant_id UUID,
        cantidad INTEGER NOT NULL DEFAULT 0,
        cantidad_reservada INTEGER NOT NULL DEFAULT 0,
        costo_unitario NUMERIC(15,0),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(warehouse_id, product_id, variant_id)
    );

    CREATE TABLE IF NOT EXISTS {schema}.sales (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id UUID NOT NULL REFERENCES {schema}.companies(id),
        branch_id UUID REFERENCES {schema}.branches(id),
        customer_id UUID REFERENCES {schema}.customers(id),
        emission_point_id UUID REFERENCES {schema}.emission_points(id),
        numero VARCHAR(20) NOT NULL UNIQUE,
        fecha TIMESTAMPTZ DEFAULT NOW(),
        tipo_comprobante VARCHAR(20) NOT NULL,
        condicion VARCHAR(20) NOT NULL DEFAULT 'contado',
        moneda VARCHAR(3) NOT NULL DEFAULT 'PYG',
        tipo_cambio NUMERIC(10,2) DEFAULT 1,
        estado VARCHAR(20) NOT NULL DEFAULT 'pendiente',
        subtotal NUMERIC(15,0) NOT NULL,
        descuento_total NUMERIC(15,0) DEFAULT 0,
        base_gravada_10 NUMERIC(15,0) DEFAULT 0,
        base_gravada_5 NUMERIC(15,0) DEFAULT 0,
        base_exenta NUMERIC(15,0) DEFAULT 0,
        iva_10 NUMERIC(15,0) DEFAULT 0,
        iva_5 NUMERIC(15,0) DEFAULT 0,
        total NUMERIC(15,0) NOT NULL,
        total_pagado NUMERIC(15,0) DEFAULT 0,
        saldo NUMERIC(15,0),
        cdc VARCHAR(44),
        sifen_estado VARCHAR(20),
        sifen_fecha_respuesta TIMESTAMPTZ,
        sifen_xml_sent TEXT,
        sifen_xml_response TEXT,
        observaciones TEXT,
        user_id UUID,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS {schema}.sale_items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        sale_id UUID NOT NULL REFERENCES {schema}.sales(id),
        product_id UUID NOT NULL REFERENCES {schema}.products(id),
        variant_id UUID,
        descripcion VARCHAR(300),
        cantidad NUMERIC(10,3) NOT NULL,
        precio_unitario NUMERIC(15,0) NOT NULL,
        descuento_pct NUMERIC(5,2) DEFAULT 0,
        descuento_monto NUMERIC(15,0) DEFAULT 0,
        iva_tasa NUMERIC(5,2) NOT NULL,
        iva_monto NUMERIC(15,0) NOT NULL,
        total NUMERIC(15,0) NOT NULL,
        costo_unitario NUMERIC(15,0),
        created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS {schema}.audit_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id UUID NOT NULL REFERENCES {schema}.companies(id),
        user_id UUID,
        accion VARCHAR(50) NOT NULL,
        entidad VARCHAR(50) NOT NULL,
        entidad_id UUID,
        datos_anteriores JSONB,
        datos_nuevos JSONB,
        ip_address INET,
        user_agent TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_{schema}_sales_company_fecha ON {schema}.sales(company_id, fecha DESC);
    CREATE INDEX IF NOT EXISTS idx_{schema}_products_sku ON {schema}.products(sku);
    CREATE INDEX IF NOT EXISTS idx_{schema}_stock_warehouse_product ON {schema}.stock(warehouse_id, product_id);
    """.format(schema=schema_name)

    async with engine.begin() as conn:
        await conn.execute(text(tenant_tables_sql))


async def get_tenant_by_id(db: AsyncSession, tenant_id: uuid.UUID) -> Tenant | None:
    result = await db.execute(select(Tenant).where(Tenant.id == tenant_id))
    return result.scalar_one_or_none()


async def get_tenant_by_slug(db: AsyncSession, slug: str) -> Tenant | None:
    result = await db.execute(select(Tenant).where(Tenant.slug == slug))
    return result.scalar_one_or_none()


async def get_user_tenants(db: AsyncSession, user_id: uuid.UUID) -> list[UserTenant]:
    result = await db.execute(select(UserTenant).where(UserTenant.user_id == user_id, UserTenant.activo == True))
    return list(result.scalars().all())


async def get_tenant_schema_name(db: AsyncSession, tenant_id: uuid.UUID) -> str | None:
    tenant = await get_tenant_by_id(db, tenant_id)
    return tenant.schema_name if tenant else None
