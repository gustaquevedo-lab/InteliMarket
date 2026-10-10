"""add_product_performance_indexes

Revision ID: 20261010150000
Revises: 20261010120000
Create Date: 2026-10-10 15:00:00.000000

Instala indices de alto rendimiento para el catalogo completo de productos y busquedas rapidas:
1. Extension pg_trgm para indexacion difusa y trigramas.
2. Indices B-Tree y GIN en products (company_id, activo, nombre, codigo_barra, sku, plu_balanza, categoria_id).
3. Indices en tablas relacionales para calculos de stock y proveedores (stock, purchase_receipt_items, purchase_order_items).
"""
from typing import Sequence, Union
from alembic import op


revision: str = '20261010150000'
down_revision: Union[str, None] = '20261010120000'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Crear extension pg_trgm
    op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm;")

    # 2. Aplicar indices en esquemas public y sandbox
    op.execute("""
        DO $$
        DECLARE
            sch TEXT;
        BEGIN
            FOR sch IN SELECT nspname FROM pg_namespace WHERE nspname IN ('public', 'sandbox')
            LOOP
                -- Indices en products
                EXECUTE format('CREATE INDEX IF NOT EXISTS idx_products_company_activo_nombre ON %I.products (company_id, activo, nombre);', sch);
                EXECUTE format('CREATE INDEX IF NOT EXISTS idx_products_codigo_barra ON %I.products (codigo_barra) WHERE codigo_barra IS NOT NULL;', sch);
                EXECUTE format('CREATE INDEX IF NOT EXISTS idx_products_categoria_id ON %I.products (categoria_id) WHERE categoria_id IS NOT NULL;', sch);
                EXECUTE format('CREATE INDEX IF NOT EXISTS idx_products_plu_balanza ON %I.products (plu_balanza) WHERE plu_balanza IS NOT NULL;', sch);
                EXECUTE format('CREATE INDEX IF NOT EXISTS idx_products_nombre_trgm ON %I.products USING gin (nombre gin_trgm_ops);', sch);
                EXECUTE format('CREATE INDEX IF NOT EXISTS idx_products_codigo_barra_trgm ON %I.products USING gin (codigo_barra gin_trgm_ops) WHERE codigo_barra IS NOT NULL;', sch);
                EXECUTE format('CREATE INDEX IF NOT EXISTS idx_products_sku_trgm ON %I.products USING gin (sku gin_trgm_ops);', sch);

                -- Indices relacionales de stock y compras
                EXECUTE format('CREATE INDEX IF NOT EXISTS idx_stock_product_id ON %I.stock (product_id);', sch);
                EXECUTE format('CREATE INDEX IF NOT EXISTS idx_pri_product_id ON %I.purchase_receipt_items (product_id);', sch);
                EXECUTE format('CREATE INDEX IF NOT EXISTS idx_poi_product_id ON %I.purchase_order_items (product_id);', sch);
            END LOOP;
        END $$;
    """)


def downgrade() -> None:
    op.execute("""
        DO $$
        DECLARE
            sch TEXT;
        BEGIN
            FOR sch IN SELECT nspname FROM pg_namespace WHERE nspname IN ('public', 'sandbox')
            LOOP
                EXECUTE format('DROP INDEX IF EXISTS %I.idx_products_company_activo_nombre;', sch);
                EXECUTE format('DROP INDEX IF EXISTS %I.idx_products_codigo_barra;', sch);
                EXECUTE format('DROP INDEX IF EXISTS %I.idx_products_categoria_id;', sch);
                EXECUTE format('DROP INDEX IF EXISTS %I.idx_products_plu_balanza;', sch);
                EXECUTE format('DROP INDEX IF EXISTS %I.idx_products_nombre_trgm;', sch);
                EXECUTE format('DROP INDEX IF EXISTS %I.idx_products_codigo_barra_trgm;', sch);
                EXECUTE format('DROP INDEX IF EXISTS %I.idx_products_sku_trgm;', sch);
                EXECUTE format('DROP INDEX IF EXISTS %I.idx_stock_product_id;', sch);
                EXECUTE format('DROP INDEX IF EXISTS %I.idx_pri_product_id;', sch);
                EXECUTE format('DROP INDEX IF EXISTS %I.idx_poi_product_id;', sch);
            END LOOP;
        END $$;
    """)
