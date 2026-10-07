"""add_consignment_inventory_flow

Revision ID: 20261007100000
Revises: 20261006171500
Create Date: 2026-10-07 10:00:00.000000

Agrega soporte nativo para mercaderías en consignación (Scan-Based Trading / VMI):
1. modalidad_abastecimiento en products ('propio', 'consignacion').
2. tipo_recepcion ('compra_directa', 'consignacion_remision') y numero_remision en purchase_receipts.
3. Tablas consignment_settlements y consignment_settlement_items para liquidaciones periódicas
   con cotejo automático contra ventas POS y vinculación con Factura Legal del proveedor.
"""
from typing import Sequence, Union
from alembic import op


revision: str = '20261007100000'
down_revision: Union[str, None] = '20261006171500'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── 1. ESQUEMA PUBLIC ─────────────────────────────────────────────────────────
    # A) Columna en products
    op.execute("""
        ALTER TABLE products 
        ADD COLUMN IF NOT EXISTS modalidad_abastecimiento VARCHAR(20) NOT NULL DEFAULT 'propio';
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_products_modalidad_abastecimiento 
        ON products(modalidad_abastecimiento);
    """)

    # Telebingo Triple configurado en consignación por defecto
    op.execute("""
        UPDATE products 
        SET modalidad_abastecimiento = 'consignacion', updated_at = NOW()
        WHERE id = '1ca303a9-7bc9-4766-8867-1a3fa2e34ad4';
    """)

    # B) Columnas en purchase_receipts
    op.execute("""
        ALTER TABLE purchase_receipts 
        ADD COLUMN IF NOT EXISTS tipo_recepcion VARCHAR(30) NOT NULL DEFAULT 'compra_directa';
    """)
    op.execute("""
        ALTER TABLE purchase_receipts 
        ADD COLUMN IF NOT EXISTS numero_remision VARCHAR(50);
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_purchase_receipts_tipo_recepcion 
        ON purchase_receipts(tipo_recepcion);
    """)

    # C) Tabla consignment_settlements
    op.execute("""
        CREATE TABLE IF NOT EXISTS consignment_settlements (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            company_id UUID NOT NULL,
            supplier_id UUID NOT NULL REFERENCES suppliers(id),
            numero VARCHAR(30) NOT NULL UNIQUE,
            fecha_desde DATE NOT NULL,
            fecha_hasta DATE NOT NULL,
            estado VARCHAR(20) NOT NULL DEFAULT 'borrador',
            total_unidades_recibidas NUMERIC(12, 3) NOT NULL DEFAULT 0,
            total_unidades_vendidas NUMERIC(12, 3) NOT NULL DEFAULT 0,
            total_unidades_devueltas NUMERIC(12, 3) NOT NULL DEFAULT 0,
            total_unidades_liquidadas NUMERIC(12, 3) NOT NULL DEFAULT 0,
            total_costo_liquidado NUMERIC(15, 0) NOT NULL DEFAULT 0,
            total_recaudado_pos NUMERIC(15, 0) NOT NULL DEFAULT 0,
            margen_ganancia NUMERIC(15, 0) NOT NULL DEFAULT 0,
            supplier_invoice_id UUID REFERENCES supplier_invoices(id) ON DELETE SET NULL,
            numero_factura_proveedor VARCHAR(50),
            observaciones TEXT,
            liquidado_por UUID,
            fecha_liquidacion TIMESTAMP WITH TIME ZONE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
    """)
    op.execute("CREATE INDEX IF NOT EXISTS idx_consignment_settlements_company ON consignment_settlements(company_id);")
    op.execute("CREATE INDEX IF NOT EXISTS idx_consignment_settlements_supplier ON consignment_settlements(supplier_id);")
    op.execute("CREATE INDEX IF NOT EXISTS idx_consignment_settlements_estado ON consignment_settlements(estado);")
    op.execute("CREATE INDEX IF NOT EXISTS idx_consignment_settlements_fechas ON consignment_settlements(fecha_desde, fecha_hasta);")

    # D) Tabla consignment_settlement_items
    op.execute("""
        CREATE TABLE IF NOT EXISTS consignment_settlement_items (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            settlement_id UUID NOT NULL REFERENCES consignment_settlements(id) ON DELETE CASCADE,
            product_id UUID NOT NULL REFERENCES products(id),
            stock_inicial NUMERIC(12, 3) NOT NULL DEFAULT 0,
            cantidad_recibida NUMERIC(12, 3) NOT NULL DEFAULT 0,
            cantidad_vendida NUMERIC(12, 3) NOT NULL DEFAULT 0,
            cantidad_devuelta NUMERIC(12, 3) NOT NULL DEFAULT 0,
            stock_final_teorico NUMERIC(12, 3) NOT NULL DEFAULT 0,
            stock_fisico_remanente NUMERIC(12, 3) NOT NULL DEFAULT 0,
            diferencia_merma NUMERIC(12, 3) NOT NULL DEFAULT 0,
            unidades_a_liquidar NUMERIC(12, 3) NOT NULL DEFAULT 0,
            costo_unitario NUMERIC(15, 0) NOT NULL DEFAULT 0,
            precio_venta_promedio NUMERIC(15, 0) NOT NULL DEFAULT 0,
            total_costo NUMERIC(15, 0) NOT NULL DEFAULT 0,
            total_venta NUMERIC(15, 0) NOT NULL DEFAULT 0,
            margen_ganancia NUMERIC(15, 0) NOT NULL DEFAULT 0,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
    """)
    op.execute("CREATE INDEX IF NOT EXISTS idx_consignment_items_settlement ON consignment_settlement_items(settlement_id);")
    op.execute("CREATE INDEX IF NOT EXISTS idx_consignment_items_product ON consignment_settlement_items(product_id);")

    # ── 2. ESQUEMA SANDBOX (SI EXISTE) ───────────────────────────────────────────
    op.execute("""
        DO $$
        BEGIN
            IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'sandbox') THEN
                ALTER TABLE sandbox.products 
                ADD COLUMN IF NOT EXISTS modalidad_abastecimiento VARCHAR(20) NOT NULL DEFAULT 'propio';

                ALTER TABLE sandbox.purchase_receipts 
                ADD COLUMN IF NOT EXISTS tipo_recepcion VARCHAR(30) NOT NULL DEFAULT 'compra_directa';

                ALTER TABLE sandbox.purchase_receipts 
                ADD COLUMN IF NOT EXISTS numero_remision VARCHAR(50);

                CREATE TABLE IF NOT EXISTS sandbox.consignment_settlements (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    company_id UUID NOT NULL,
                    supplier_id UUID NOT NULL,
                    numero VARCHAR(30) NOT NULL UNIQUE,
                    fecha_desde DATE NOT NULL,
                    fecha_hasta DATE NOT NULL,
                    estado VARCHAR(20) NOT NULL DEFAULT 'borrador',
                    total_unidades_recibidas NUMERIC(12, 3) NOT NULL DEFAULT 0,
                    total_unidades_vendidas NUMERIC(12, 3) NOT NULL DEFAULT 0,
                    total_unidades_devueltas NUMERIC(12, 3) NOT NULL DEFAULT 0,
                    total_unidades_liquidadas NUMERIC(12, 3) NOT NULL DEFAULT 0,
                    total_costo_liquidado NUMERIC(15, 0) NOT NULL DEFAULT 0,
                    total_recaudado_pos NUMERIC(15, 0) NOT NULL DEFAULT 0,
                    margen_ganancia NUMERIC(15, 0) NOT NULL DEFAULT 0,
                    supplier_invoice_id UUID,
                    numero_factura_proveedor VARCHAR(50),
                    observaciones TEXT,
                    liquidado_por UUID,
                    fecha_liquidacion TIMESTAMP WITH TIME ZONE,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                );

                CREATE TABLE IF NOT EXISTS sandbox.consignment_settlement_items (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    settlement_id UUID NOT NULL REFERENCES sandbox.consignment_settlements(id) ON DELETE CASCADE,
                    product_id UUID NOT NULL,
                    stock_inicial NUMERIC(12, 3) NOT NULL DEFAULT 0,
                    cantidad_recibida NUMERIC(12, 3) NOT NULL DEFAULT 0,
                    cantidad_vendida NUMERIC(12, 3) NOT NULL DEFAULT 0,
                    cantidad_devuelta NUMERIC(12, 3) NOT NULL DEFAULT 0,
                    stock_final_teorico NUMERIC(12, 3) NOT NULL DEFAULT 0,
                    stock_fisico_remanente NUMERIC(12, 3) NOT NULL DEFAULT 0,
                    diferencia_merma NUMERIC(12, 3) NOT NULL DEFAULT 0,
                    unidades_a_liquidar NUMERIC(12, 3) NOT NULL DEFAULT 0,
                    costo_unitario NUMERIC(15, 0) NOT NULL DEFAULT 0,
                    precio_venta_promedio NUMERIC(15, 0) NOT NULL DEFAULT 0,
                    total_costo NUMERIC(15, 0) NOT NULL DEFAULT 0,
                    total_venta NUMERIC(15, 0) NOT NULL DEFAULT 0,
                    margen_ganancia NUMERIC(15, 0) NOT NULL DEFAULT 0,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                );
            END IF;
        END $$;
    """)


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS consignment_settlement_items CASCADE;")
    op.execute("DROP TABLE IF EXISTS consignment_settlements CASCADE;")
    op.execute("ALTER TABLE purchase_receipts DROP COLUMN IF EXISTS numero_remision;")
    op.execute("ALTER TABLE purchase_receipts DROP COLUMN IF EXISTS tipo_recepcion;")
    op.execute("ALTER TABLE products DROP COLUMN IF EXISTS modalidad_abastecimiento;")

    op.execute("""
        DO $$
        BEGIN
            IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'sandbox') THEN
                DROP TABLE IF EXISTS sandbox.consignment_settlement_items CASCADE;
                DROP TABLE IF EXISTS sandbox.consignment_settlements CASCADE;
                ALTER TABLE sandbox.purchase_receipts DROP COLUMN IF EXISTS numero_remision;
                ALTER TABLE sandbox.purchase_receipts DROP COLUMN IF EXISTS tipo_recepcion;
                ALTER TABLE sandbox.products DROP COLUMN IF EXISTS modalidad_abastecimiento;
            END IF;
        END $$;
    """)
