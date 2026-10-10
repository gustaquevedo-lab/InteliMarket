"""enforce_integer_pyg_globally

Revision ID: 20261010120000
Revises: 20261008100000
Create Date: 2026-10-10 12:00:00.000000

Erradica de raíz los decimales en precios y costos en Guaraníes (PYG).
1. Sanea valores existentes en products y promotions eliminando fracciones/centavos.
2. Instala triggers BEFORE INSERT OR UPDATE en products y promotions para garantizar
   que ningún proceso futuro (API, scripts, imports de ERP) pueda guardar decimales en Guaraníes.
"""
from typing import Sequence, Union
from alembic import op


revision: str = '20261010120000'
down_revision: Union[str, None] = '20261008100000'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Aplicar saneamiento y triggers en esquemas public y sandbox si existen
    op.execute("""
        DO $$
        DECLARE
            sch TEXT;
        BEGIN
            FOR sch IN SELECT nspname FROM pg_namespace WHERE nspname IN ('public', 'sandbox')
            LOOP
                -- 1. Saneamiento de datos históricos en products
                EXECUTE format('
                    UPDATE %I.products SET 
                        precio_venta = ROUND(precio_venta),
                        costo_promedio = ROUND(costo_promedio),
                        ultimo_costo = ROUND(ultimo_costo)
                    WHERE (precio_venta IS NOT NULL AND precio_venta != ROUND(precio_venta))
                       OR (costo_promedio IS NOT NULL AND costo_promedio != ROUND(costo_promedio))
                       OR (ultimo_costo IS NOT NULL AND ultimo_costo != ROUND(ultimo_costo));
                ', sch);

                -- 2. Saneamiento de datos históricos en promotions
                EXECUTE format('
                    UPDATE %I.promotions SET 
                        precio_fijo_promocional = ROUND(precio_fijo_promocional)
                    WHERE precio_fijo_promocional IS NOT NULL AND precio_fijo_promocional != ROUND(precio_fijo_promocional);
                ', sch);

                EXECUTE format('
                    UPDATE %I.promotions SET 
                        valor = ROUND(valor)
                    WHERE tipo = ''monto_fijo'' AND valor IS NOT NULL AND valor != ROUND(valor);
                ', sch);

                IF EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_schema = sch AND table_name = 'promotions' AND column_name = 'valor_maximo'
                ) THEN
                    EXECUTE format('
                        UPDATE %I.promotions SET 
                            valor_maximo = ROUND(valor_maximo)
                        WHERE valor_maximo IS NOT NULL AND valor_maximo != ROUND(valor_maximo);
                    ', sch);
                END IF;

                -- 3. Crear función de trigger para products
                EXECUTE format('
                    CREATE OR REPLACE FUNCTION %I.trg_enforce_integer_pyg_products()
                    RETURNS TRIGGER AS $func$
                    BEGIN
                        IF NEW.precio_venta IS NOT NULL THEN
                            NEW.precio_venta := ROUND(NEW.precio_venta);
                        END IF;
                        IF NEW.costo_promedio IS NOT NULL THEN
                            NEW.costo_promedio := ROUND(NEW.costo_promedio);
                        END IF;
                        IF NEW.ultimo_costo IS NOT NULL THEN
                            NEW.ultimo_costo := ROUND(NEW.ultimo_costo);
                        END IF;
                        RETURN NEW;
                    END;
                    $func$ LANGUAGE plpgsql;
                ', sch);

                -- 4. Instalar trigger en products
                EXECUTE format('
                    DROP TRIGGER IF EXISTS trg_enforce_integer_products ON %I.products;
                    CREATE TRIGGER trg_enforce_integer_products
                        BEFORE INSERT OR UPDATE ON %I.products
                        FOR EACH ROW
                        EXECUTE FUNCTION %I.trg_enforce_integer_pyg_products();
                ', sch, sch, sch);

                -- 5. Crear función de trigger para promotions
                EXECUTE format('
                    CREATE OR REPLACE FUNCTION %I.trg_enforce_integer_pyg_promotions()
                    RETURNS TRIGGER AS $func$
                    BEGIN
                        IF NEW.precio_fijo_promocional IS NOT NULL THEN
                            NEW.precio_fijo_promocional := ROUND(NEW.precio_fijo_promocional);
                        END IF;
                        IF NEW.tipo = ''monto_fijo'' AND NEW.valor IS NOT NULL THEN
                            NEW.valor := ROUND(NEW.valor);
                        END IF;
                        IF NEW.valor_maximo IS NOT NULL THEN
                            NEW.valor_maximo := ROUND(NEW.valor_maximo);
                        END IF;
                        IF NEW.monto_total_nc_comprometido IS NOT NULL THEN
                            NEW.monto_total_nc_comprometido := ROUND(NEW.monto_total_nc_comprometido);
                        END IF;
                        RETURN NEW;
                    END;
                    $func$ LANGUAGE plpgsql;
                ', sch);

                -- 6. Instalar trigger en promotions
                EXECUTE format('
                    DROP TRIGGER IF EXISTS trg_enforce_integer_promotions ON %I.promotions;
                    CREATE TRIGGER trg_enforce_integer_promotions
                        BEFORE INSERT OR UPDATE ON %I.promotions
                        FOR EACH ROW
                        EXECUTE FUNCTION %I.trg_enforce_integer_pyg_promotions();
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
                EXECUTE format('DROP TRIGGER IF EXISTS trg_enforce_integer_products ON %I.products;', sch);
                EXECUTE format('DROP FUNCTION IF EXISTS %I.trg_enforce_integer_pyg_products();', sch);
                EXECUTE format('DROP TRIGGER IF EXISTS trg_enforce_integer_promotions ON %I.promotions;', sch);
                EXECUTE format('DROP FUNCTION IF EXISTS %I.trg_enforce_integer_pyg_promotions();', sch);
            END LOOP;
        END $$;
    """)
