"""Add 4 price columns (minorista & escala) and user tracking to price_variation_logs

Revision ID: 20261013173000
Revises: 20261013170000
Create Date: 2026-10-13 17:30:00
"""

from alembic import op
import sqlalchemy as sa


revision = '20261013173000'
down_revision = '20261013170000'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Agregar columnas para P. Minorista y P. Escala explícitos
    op.execute("""
        ALTER TABLE price_variation_logs
        ADD COLUMN IF NOT EXISTS precio_minorista_anterior NUMERIC(15, 2) NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS precio_minorista_nuevo NUMERIC(15, 2) NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS precio_escala_anterior NUMERIC(15, 2) NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS precio_escala_nuevo NUMERIC(15, 2) NOT NULL DEFAULT 0;
    """)

    # 2. Actualizar triggers para capturar usuario y ambos precios (minorista + primera escala)
    op.execute("""
        CREATE OR REPLACE FUNCTION fn_tg_log_product_price_variation()
        RETURNS TRIGGER AS $$
        DECLARE
            v_cat_nombre VARCHAR(150);
            v_diff_monto NUMERIC(15,2);
            v_diff_pct NUMERIC(7,2);
            v_old_p NUMERIC(15,2);
            v_new_p NUMERIC(15,2);
            v_escala_qty INTEGER;
            v_escala_precio NUMERIC(15,2);
            v_user_name VARCHAR(150);
            v_user_id UUID;
            v_user_id_str VARCHAR(100);
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
                    SELECT nombre INTO v_cat_nombre FROM product_categories WHERE id = NEW.categoria_id;
                END IF;

                -- Buscar primera escala activa (menor min_qty)
                SELECT min_qty, precio_unitario 
                INTO v_escala_qty, v_escala_precio
                FROM sp_tiered_prices
                WHERE product_id = NEW.id AND activo = true
                ORDER BY min_qty ASC
                LIMIT 1;

                -- Capturar usuario de la sesión de PostgreSQL si fue inyectado por FastAPI
                v_user_name := NULLIF(current_setting('app.current_user_name', true), '');
                IF v_user_name IS NULL OR TRIM(v_user_name) = '' THEN
                    v_user_name := 'Administrador';
                END IF;

                v_user_id_str := NULLIF(current_setting('app.current_user_id', true), '');
                IF v_user_id_str IS NOT NULL AND TRIM(v_user_id_str) != '' THEN
                    BEGIN
                        v_user_id := v_user_id_str::UUID;
                    EXCEPTION WHEN OTHERS THEN
                        v_user_id := NULL;
                    END;
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
                    precio_minorista_anterior,
                    precio_minorista_nuevo,
                    precio_escala_anterior,
                    precio_escala_nuevo,
                    precio_anterior,
                    precio_nuevo,
                    diferencia_monto,
                    diferencia_pct,
                    origen,
                    usuario_id,
                    usuario_nombre,
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
                    v_escala_qty,
                    v_old_p,
                    v_new_p,
                    COALESCE(v_escala_precio, 0),
                    COALESCE(v_escala_precio, 0),
                    v_old_p,
                    v_new_p,
                    v_diff_monto,
                    v_diff_pct,
                    'producto_manual',
                    v_user_id,
                    v_user_name,
                    NOW()
                );
            END IF;
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    """)

    # 3. Trigger para cambios en sp_tiered_prices (escalas)
    op.execute("""
        CREATE OR REPLACE FUNCTION fn_tg_log_tiered_price_variation()
        RETURNS TRIGGER AS $$
        DECLARE
            v_prod_nombre VARCHAR(255);
            v_prod_sku VARCHAR(100);
            v_prod_barcode VARCHAR(100);
            v_cat_id UUID;
            v_cat_nombre VARCHAR(150);
            v_prod_precio NUMERIC(15,2);
            v_diff_monto NUMERIC(15,2);
            v_diff_pct NUMERIC(7,2);
            v_old_p NUMERIC(15,2);
            v_new_p NUMERIC(15,2);
            v_user_name VARCHAR(150);
            v_user_id UUID;
            v_user_id_str VARCHAR(100);
        BEGIN
            IF (TG_OP = 'UPDATE' AND OLD.precio_unitario IS DISTINCT FROM NEW.precio_unitario)
               OR (TG_OP = 'INSERT') THEN

                v_old_p := CASE WHEN TG_OP = 'INSERT' THEN 0 ELSE COALESCE(OLD.precio_unitario, 0) END;
                v_new_p := COALESCE(NEW.precio_unitario, 0);
                v_diff_monto := v_new_p - v_old_p;
                IF v_old_p > 0 THEN
                    v_diff_pct := ROUND(((v_new_p - v_old_p) / v_old_p) * 100, 2);
                ELSE
                    v_diff_pct := 0;
                END IF;

                SELECT nombre, sku, codigo_barra, categoria_id, precio_venta
                INTO v_prod_nombre, v_prod_sku, v_prod_barcode, v_cat_id, v_prod_precio
                FROM products WHERE id = NEW.product_id;

                IF v_cat_id IS NOT NULL THEN
                    SELECT nombre INTO v_cat_nombre FROM product_categories WHERE id = v_cat_id;
                END IF;

                v_user_name := NULLIF(current_setting('app.current_user_name', true), '');
                IF v_user_name IS NULL OR TRIM(v_user_name) = '' THEN
                    v_user_name := 'Administrador';
                END IF;

                v_user_id_str := NULLIF(current_setting('app.current_user_id', true), '');
                IF v_user_id_str IS NOT NULL AND TRIM(v_user_id_str) != '' THEN
                    BEGIN
                        v_user_id := v_user_id_str::UUID;
                    EXCEPTION WHEN OTHERS THEN
                        v_user_id := NULL;
                    END;
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
                    precio_minorista_anterior,
                    precio_minorista_nuevo,
                    precio_escala_anterior,
                    precio_escala_nuevo,
                    precio_anterior,
                    precio_nuevo,
                    diferencia_monto,
                    diferencia_pct,
                    origen,
                    usuario_id,
                    usuario_nombre,
                    created_at
                ) VALUES (
                    gen_random_uuid(),
                    NEW.company_id,
                    NEW.product_id,
                    v_prod_nombre,
                    v_prod_sku,
                    v_prod_barcode,
                    v_cat_nombre,
                    'escala',
                    NEW.min_qty,
                    COALESCE(v_prod_precio, 0),
                    COALESCE(v_prod_precio, 0),
                    v_old_p,
                    v_new_p,
                    v_old_p,
                    v_new_p,
                    v_diff_monto,
                    v_diff_pct,
                    'escala_manual',
                    v_user_id,
                    v_user_name,
                    NOW()
                );
            END IF;
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    """)

    # 4. Actualizar registros existentes para inicializar las columnas nuevas
    op.execute("""
        UPDATE price_variation_logs
        SET 
            precio_minorista_anterior = CASE WHEN tipo = 'unitario' THEN precio_anterior ELSE COALESCE(precio_minorista_anterior, 0) END,
            precio_minorista_nuevo = CASE WHEN tipo = 'unitario' THEN precio_nuevo ELSE COALESCE(precio_minorista_nuevo, 0) END,
            precio_escala_anterior = CASE WHEN tipo = 'escala' THEN precio_anterior ELSE COALESCE(precio_escala_anterior, 0) END,
            precio_escala_nuevo = CASE WHEN tipo = 'escala' THEN precio_nuevo ELSE COALESCE(precio_escala_nuevo, 0) END
        WHERE precio_minorista_nuevo = 0 AND precio_escala_nuevo = 0;
    """)


def downgrade() -> None:
    op.execute("""
        ALTER TABLE price_variation_logs
        DROP COLUMN IF EXISTS precio_minorista_anterior,
        DROP COLUMN IF EXISTS precio_minorista_nuevo,
        DROP COLUMN IF EXISTS precio_escala_anterior,
        DROP COLUMN IF EXISTS precio_escala_nuevo;
    """)
