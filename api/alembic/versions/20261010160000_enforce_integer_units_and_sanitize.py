"""enforce_integer_units_and_sanitize

Revision ID: 20261010160000
Revises: 20261010150000
Create Date: 2026-10-10 16:00:00.000000

1. Sanea el historial de sale_items redondeando cantidades fraccionarias de productos unitarios (UN/unidad).
2. Instala triggers BEFORE INSERT/UPDATE en sale_items y stock para asegurar de por vida que ningun producto unitario pueda registrar cantidades decimales.
"""
from typing import Sequence, Union
from alembic import op


revision: str = '20261010160000'
down_revision: Union[str, None] = '20261010150000'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
        DO $$
        DECLARE
            sch TEXT;
        BEGIN
            FOR sch IN SELECT nspname FROM pg_namespace WHERE nspname IN ('public', 'sandbox')
            LOOP
                -- 1. Saneamiento historico de sale_items para productos unitarios
                EXECUTE format('
                    UPDATE %I.sale_items si
                    SET cantidad = GREATEST(1, ROUND(si.cantidad))
                    FROM %I.products p
                    WHERE si.product_id = p.id
                      AND (UPPER(COALESCE(p.unidad_medida, ''UN'')) = ''UN'' OR LOWER(COALESCE(p.tipo_venta, ''unidad'')) = ''unidad'')
                      AND UPPER(COALESCE(p.unidad_medida, '''')) NOT IN (''KG'', ''KILO'', ''KILOS'', ''L'', ''LT'', ''LITRO'', ''M'', ''MT'', ''METRO'')
                      AND LOWER(COALESCE(p.tipo_venta, '''')) != ''peso''
                      AND si.cantidad != ROUND(si.cantidad);
                ', sch, sch);

                -- 2. Crear funcion de trigger para blindaje automatico
                EXECUTE format('
                    CREATE OR REPLACE FUNCTION %I.trg_fn_enforce_integer_units()
                    RETURNS TRIGGER AS $func$
                    DECLARE
                        v_um VARCHAR;
                        v_tv VARCHAR;
                    BEGIN
                        IF NEW.product_id IS NOT NULL THEN
                            SELECT unidad_medida, tipo_venta INTO v_um, v_tv
                            FROM %I.products WHERE id = NEW.product_id;
                            
                            IF (UPPER(COALESCE(v_um, ''UN'')) = ''UN'' OR LOWER(COALESCE(v_tv, ''unidad'')) = ''unidad'')
                               AND UPPER(COALESCE(v_um, '''')) NOT IN (''KG'', ''KILO'', ''KILOS'', ''L'', ''LT'', ''LITRO'', ''M'', ''MT'', ''METRO'')
                               AND LOWER(COALESCE(v_tv, '''')) != ''peso'' THEN
                                IF NEW.cantidad IS NOT NULL AND NEW.cantidad != ROUND(NEW.cantidad) THEN
                                    NEW.cantidad := GREATEST(1, ROUND(NEW.cantidad));
                                END IF;
                            END IF;
                        END IF;
                        RETURN NEW;
                    END;
                    $func$ LANGUAGE plpgsql;
                ', sch, sch);

                -- 3. Instalar trigger en sale_items
                EXECUTE format('
                    DROP TRIGGER IF EXISTS trg_sale_items_enforce_integer_units ON %I.sale_items;
                    CREATE TRIGGER trg_sale_items_enforce_integer_units
                    BEFORE INSERT OR UPDATE OF cantidad, product_id ON %I.sale_items
                    FOR EACH ROW
                    EXECUTE FUNCTION %I.trg_fn_enforce_integer_units();
                ', sch, sch, sch);

                -- 4. Instalar trigger en stock
                EXECUTE format('
                    DROP TRIGGER IF EXISTS trg_stock_enforce_integer_units ON %I.stock;
                    CREATE TRIGGER trg_stock_enforce_integer_units
                    BEFORE INSERT OR UPDATE OF cantidad, product_id ON %I.stock
                    FOR EACH ROW
                    EXECUTE FUNCTION %I.trg_fn_enforce_integer_units();
                ', sch, sch, sch);
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
                EXECUTE format('DROP TRIGGER IF EXISTS trg_sale_items_enforce_integer_units ON %I.sale_items;', sch);
                EXECUTE format('DROP TRIGGER IF EXISTS trg_stock_enforce_integer_units ON %I.stock;', sch);
                EXECUTE format('DROP FUNCTION IF EXISTS %I.trg_fn_enforce_integer_units();', sch);
            END LOOP;
        END $$;
    """)
