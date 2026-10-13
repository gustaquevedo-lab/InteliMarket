"""Add price_variation_logs and triggers for price modifications

Revision ID: 20261013170000
Revises: 20261013140000
Create Date: 2026-10-13 17:00:00
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


# revision identifiers, used by Alembic.
revision = '20261013170000'
down_revision = '20261013140000'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Crear tabla price_variation_logs
    op.execute("""
        CREATE TABLE IF NOT EXISTS price_variation_logs (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
            product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
            product_nombre VARCHAR(255),
            product_sku VARCHAR(100),
            product_barcode VARCHAR(100),
            categoria_nombre VARCHAR(150),
            tipo VARCHAR(20) NOT NULL, -- 'unitario' | 'escala'
            escala_min_qty INTEGER,
            precio_anterior NUMERIC(15, 2) NOT NULL DEFAULT 0,
            precio_nuevo NUMERIC(15, 2) NOT NULL DEFAULT 0,
            diferencia_monto NUMERIC(15, 2) NOT NULL DEFAULT 0,
            diferencia_pct NUMERIC(7, 2) NOT NULL DEFAULT 0,
            origen VARCHAR(50) DEFAULT 'sistema',
            usuario_id UUID REFERENCES users(id) ON DELETE SET NULL,
            usuario_nombre VARCHAR(150),
            motivo TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
    """)

    # 2. Índices para alto desempeño en reportes y consultas
    op.execute("CREATE INDEX IF NOT EXISTS ix_price_var_cid_created ON price_variation_logs(company_id, created_at DESC);")
    op.execute("CREATE INDEX IF NOT EXISTS ix_price_var_pid ON price_variation_logs(product_id);")
    op.execute("CREATE INDEX IF NOT EXISTS ix_price_var_tipo ON price_variation_logs(company_id, tipo);")
    op.execute("CREATE INDEX IF NOT EXISTS ix_price_var_created ON price_variation_logs(created_at DESC);")

    # 3. Función y Trigger para cambios en products.precio_venta (unitarios)
    op.execute("""
        CREATE OR REPLACE FUNCTION fn_tg_log_product_price_variation()
        RETURNS TRIGGER AS $$
        DECLARE
            v_cat_nombre VARCHAR(150);
            v_diff_monto NUMERIC(15,2);
            v_diff_pct NUMERIC(7,2);
            v_old_p NUMERIC(15,2);
            v_new_p NUMERIC(15,2);
        BEGIN
            IF OLD.precio_venta IS DISTINCT FROM NEW.precio_venta AND NEW.precio_venta IS NOT NULL THEN
                v_old_p := COALESCE(OLD.precio_venta, 0);
                v_new_p := COALESCE(NEW.precio_venta, 0);
                v_diff_monto := v_new_p - v_old_p;
                IF v_old_p > 0 THEN
                    v_diff_pct := ROUND(((v_new_p - v_old_p) / v_old_p) * 100, 2);
                ELSE
                    v_diff_pct := 0;
                END IF;

                IF NEW.categoria_id IS NOT NULL THEN
                    SELECT nombre INTO v_cat_nombre FROM categories WHERE id = NEW.categoria_id;
                END IF;

                INSERT INTO price_variation_logs (
                    id,
                    company_id,
                    product_id,
                    product_nombre,
                    product_sku,
                    product_barcode,
                    categoria_nombre,
                    tipo,
                    escala_min_qty,
                    precio_anterior,
                    precio_nuevo,
                    diferencia_monto,
                    diferencia_pct,
                    origen,
                    created_at
                ) VALUES (
                    gen_random_uuid(),
                    NEW.company_id,
                    NEW.id,
                    NEW.nombre,
                    NEW.sku,
                    NEW.codigo_barra,
                    v_cat_nombre,
                    'unitario',
                    NULL,
                    v_old_p,
                    v_new_p,
                    v_diff_monto,
                    v_diff_pct,
                    'trigger_producto',
                    NOW()
                );
            END IF;
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    """)

    op.execute("DROP TRIGGER IF EXISTS tg_log_product_price_variation ON products;")
    op.execute("""
        CREATE TRIGGER tg_log_product_price_variation
        AFTER UPDATE ON products
        FOR EACH ROW
        EXECUTE FUNCTION fn_tg_log_product_price_variation();
    """)

    # 4. Función y Trigger para cambios en sp_tiered_prices (escalas por volumen)
    op.execute("""
        CREATE OR REPLACE FUNCTION fn_tg_log_tiered_price_variation()
        RETURNS TRIGGER AS $$
        DECLARE
            v_prod_nombre VARCHAR(255);
            v_prod_sku VARCHAR(100);
            v_prod_barcode VARCHAR(100);
            v_cat_nombre VARCHAR(150);
            v_cat_id UUID;
            v_diff_monto NUMERIC(15,2);
            v_diff_pct NUMERIC(7,2);
            v_old_p NUMERIC(15,2);
            v_new_p NUMERIC(15,2);
            v_rec_pid UUID;
            v_rec_cid UUID;
            v_min_qty INT;
        BEGIN
            IF TG_OP = 'UPDATE' THEN
                IF OLD.precio_unitario IS DISTINCT FROM NEW.precio_unitario AND NEW.precio_unitario IS NOT NULL THEN
                    v_rec_pid := NEW.product_id;
                    v_rec_cid := NEW.company_id;
                    v_min_qty := NEW.min_qty;
                    v_old_p := COALESCE(OLD.precio_unitario, 0);
                    v_new_p := COALESCE(NEW.precio_unitario, 0);
                ELSE
                    RETURN NEW;
                END IF;
            ELSIF TG_OP = 'INSERT' THEN
                v_rec_pid := NEW.product_id;
                v_rec_cid := NEW.company_id;
                v_min_qty := NEW.min_qty;
                SELECT COALESCE(precio_venta, 0) INTO v_old_p FROM products WHERE id = v_rec_pid;
                v_old_p := COALESCE(v_old_p, 0);
                v_new_p := COALESCE(NEW.precio_unitario, 0);
            ELSIF TG_OP = 'DELETE' THEN
                v_rec_pid := OLD.product_id;
                v_rec_cid := OLD.company_id;
                v_min_qty := OLD.min_qty;
                v_old_p := COALESCE(OLD.precio_unitario, 0);
                v_new_p := 0;
            END IF;

            v_diff_monto := v_new_p - v_old_p;
            IF v_old_p > 0 THEN
                v_diff_pct := ROUND(((v_new_p - v_old_p) / v_old_p) * 100, 2);
            ELSE
                v_diff_pct := 0;
            END IF;

            SELECT p.nombre, p.sku, p.codigo_barra, p.categoria_id 
            INTO v_prod_nombre, v_prod_sku, v_prod_barcode, v_cat_id
            FROM products p WHERE p.id = v_rec_pid;

            IF v_cat_id IS NOT NULL THEN
                SELECT nombre INTO v_cat_nombre FROM categories WHERE id = v_cat_id;
            END IF;

            INSERT INTO price_variation_logs (
                id,
                company_id,
                product_id,
                product_nombre,
                product_sku,
                product_barcode,
                categoria_nombre,
                tipo,
                escala_min_qty,
                precio_anterior,
                precio_nuevo,
                diferencia_monto,
                diferencia_pct,
                origen,
                created_at
            ) VALUES (
                gen_random_uuid(),
                v_rec_cid,
                v_rec_pid,
                v_prod_nombre,
                v_prod_sku,
                v_prod_barcode,
                v_cat_nombre,
                'escala',
                v_min_qty,
                v_old_p,
                v_new_p,
                v_diff_monto,
                v_diff_pct,
                'trigger_escala',
                NOW()
            );

            IF TG_OP = 'DELETE' THEN
                RETURN OLD;
            ELSE
                RETURN NEW;
            END IF;
        END;
        $$ LANGUAGE plpgsql;
    """)

    op.execute("DROP TRIGGER IF EXISTS tg_log_tiered_price_variation ON sp_tiered_prices;")
    op.execute("""
        CREATE TRIGGER tg_log_tiered_price_variation
        AFTER INSERT OR UPDATE OR DELETE ON sp_tiered_prices
        FOR EACH ROW
        EXECUTE FUNCTION fn_tg_log_tiered_price_variation();
    """)


    # 5. Backfill inicial desde price_audit_log (si la tabla existe y tiene registros)
    op.execute("""
        DO $$
        BEGIN
            IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'price_audit_log') THEN
                INSERT INTO price_variation_logs (
                    id, company_id, product_id, product_nombre, product_sku, product_barcode, categoria_nombre,
                    tipo, escala_min_qty, precio_anterior, precio_nuevo, diferencia_monto, diferencia_pct,
                    origen, usuario_nombre, motivo, created_at
                )
                SELECT 
                    pal.id,
                    pal.company_id,
                    pal.product_id,
                    p.nombre,
                    p.sku,
                    p.codigo_barra,
                    c.nombre,
                    'unitario',
                    NULL,
                    pal.precio_anterior,
                    pal.precio_nuevo,
                    (pal.precio_nuevo - pal.precio_anterior),
                    CASE WHEN pal.precio_anterior > 0 THEN ROUND(((pal.precio_nuevo - pal.precio_anterior) / pal.precio_anterior) * 100, 2) ELSE 0 END,
                    'price_audit_log',
                    pal.aplicado_por,
                    pal.motivo,
                    pal.created_at
                FROM price_audit_log pal
                JOIN products p ON p.id = pal.product_id
                LEFT JOIN categories c ON c.id = p.categoria_id
                ON CONFLICT (id) DO NOTHING;
            END IF;
        END $$;
    """)


def downgrade() -> None:
    op.execute("DROP TRIGGER IF EXISTS tg_log_product_price_variation ON products;")
    op.execute("DROP FUNCTION IF EXISTS fn_tg_log_product_price_variation();")
    op.execute("DROP TRIGGER IF EXISTS tg_log_tiered_price_variation ON sp_tiered_prices;")
    op.execute("DROP FUNCTION IF EXISTS fn_tg_log_tiered_price_variation();")
    op.execute("DROP TABLE IF EXISTS price_variation_logs CASCADE;")
