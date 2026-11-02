"""promo auto revert on product removal and delete

Revision ID: 20261102170000
Revises: 20261031170000
Create Date: 2026-11-02 17:00:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '20261102170000'
down_revision: Union[str, None] = '20261031170000'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


FUNCTION_SQL = """
CREATE OR REPLACE FUNCTION sync_promo_precio_fijo()
RETURNS trigger AS $$
DECLARE
  prod_id text;
  promo_val numeric;
  today_date date;
  today_dow int;
  is_valid_today boolean;
  affected_pid uuid;
  other_promo_price numeric;
BEGIN
  today_date := (CURRENT_TIMESTAMP AT TIME ZONE 'America/Asuncion')::date;
  today_dow := EXTRACT(DOW FROM (CURRENT_TIMESTAMP AT TIME ZONE 'America/Asuncion'))::int;

  -- 1. Determinar vigencia
  IF TG_OP = 'DELETE' THEN
    is_valid_today := false;
  ELSE
    is_valid_today := (
      NEW.activo = true AND NEW.estado = 'activa'
      AND (NEW.valido_desde IS NULL OR today_date >= NEW.valido_desde)
      AND (NEW.valido_hasta IS NULL OR today_date <= NEW.valido_hasta)
      AND (NEW.dias_semana IS NULL OR array_length(NEW.dias_semana, 1) IS NULL OR today_dow = ANY(NEW.dias_semana))
    );
  END IF;

  -- ══════════════════════════════════════════════════════════════════════════
  -- CASO 1: DELETE de una promoción
  -- ══════════════════════════════════════════════════════════════════════════
  IF TG_OP = 'DELETE' THEN
    IF OLD.tipo = 'precio_fijo_oferta' AND OLD.producto_ids IS NOT NULL THEN
      FOREACH affected_pid IN ARRAY OLD.producto_ids
      LOOP
        SELECT
          COALESCE(
            CASE 
              WHEN pr.precios_por_producto IS NOT NULL AND pr.precios_por_producto::jsonb ? affected_pid::text 
              THEN (pr.precios_por_producto->>affected_pid::text)::numeric
              ELSE NULL 
            END,
            pr.precio_fijo_promocional
          ) INTO other_promo_price
        FROM promotions pr
        WHERE pr.id != OLD.id
          AND pr.activo = true AND pr.estado = 'activa'
          AND pr.tipo = 'precio_fijo_oferta'
          AND (pr.valido_desde IS NULL OR today_date >= pr.valido_desde)
          AND (pr.valido_hasta IS NULL OR today_date <= pr.valido_hasta)
          AND (pr.dias_semana IS NULL OR array_length(pr.dias_semana, 1) IS NULL OR today_dow = ANY(pr.dias_semana))
          AND (affected_pid = ANY(pr.producto_ids) OR (pr.precios_por_producto IS NOT NULL AND pr.precios_por_producto::jsonb ? affected_pid::text))
        ORDER BY pr.updated_at DESC
        LIMIT 1;

        IF other_promo_price IS NOT NULL AND other_promo_price > 0 THEN
          UPDATE products
          SET precio_venta = other_promo_price,
              updated_at = NOW()
          WHERE id = affected_pid
            AND precio_venta != other_promo_price;
        ELSE
          UPDATE products
          SET precio_venta = COALESCE(precio_regular, precio_venta),
              precio_regular = NULL,
              updated_at = NOW()
          WHERE id = affected_pid
            AND precio_regular IS NOT NULL;
        END IF;
      END LOOP;
    END IF;
    RETURN OLD;
  END IF;

  -- ══════════════════════════════════════════════════════════════════════════
  -- CASO 2: Promo activa vigente HOY (INSERT o UPDATE)
  -- ══════════════════════════════════════════════════════════════════════════
  IF NEW.tipo = 'precio_fijo_oferta' AND is_valid_today THEN
    -- A) Aplicar precios promocionales a los productos incluidos
    IF NEW.precios_por_producto IS NOT NULL AND jsonb_typeof(NEW.precios_por_producto::jsonb) = 'object' THEN
      FOR prod_id, promo_val IN
        SELECT key, value::text::numeric FROM jsonb_each_text(NEW.precios_por_producto::jsonb)
      LOOP
        IF promo_val > 0 THEN
          UPDATE products
          SET precio_regular = COALESCE(precio_regular, precio_venta),
              precio_venta = promo_val,
              updated_at = NOW()
          WHERE id = prod_id::uuid
            AND precio_venta != promo_val;
        END IF;
      END LOOP;
    ELSIF NEW.precio_fijo_promocional IS NOT NULL AND NEW.precio_fijo_promocional > 0 AND NEW.producto_ids IS NOT NULL THEN
      UPDATE products
      SET precio_regular = COALESCE(precio_regular, precio_venta),
          precio_venta = NEW.precio_fijo_promocional,
          updated_at = NOW()
      WHERE id = ANY(NEW.producto_ids)
        AND precio_venta != NEW.precio_fijo_promocional;
    END IF;

    -- B) En UPDATE: REVERTIR cualquier producto removido de producto_ids o de precios_por_producto
    IF TG_OP = 'UPDATE' AND OLD.producto_ids IS NOT NULL THEN
      FOREACH affected_pid IN ARRAY OLD.producto_ids
      LOOP
        IF (NEW.producto_ids IS NULL OR NOT (affected_pid = ANY(NEW.producto_ids)))
           OR (NEW.precios_por_producto IS NOT NULL AND NOT (NEW.precios_por_producto::jsonb ? affected_pid::text))
        THEN
          -- El producto fue REMOVIDO. Verificar si tiene OTRA promo activa hoy:
          SELECT
            COALESCE(
              CASE 
                WHEN pr.precios_por_producto IS NOT NULL AND pr.precios_por_producto::jsonb ? affected_pid::text 
                THEN (pr.precios_por_producto->>affected_pid::text)::numeric
                ELSE NULL 
              END,
              pr.precio_fijo_promocional
            ) INTO other_promo_price
          FROM promotions pr
          WHERE pr.id != NEW.id
            AND pr.activo = true AND pr.estado = 'activa'
            AND pr.tipo = 'precio_fijo_oferta'
            AND (pr.valido_desde IS NULL OR today_date >= pr.valido_desde)
            AND (pr.valido_hasta IS NULL OR today_date <= pr.valido_hasta)
            AND (pr.dias_semana IS NULL OR array_length(pr.dias_semana, 1) IS NULL OR today_dow = ANY(pr.dias_semana))
            AND (affected_pid = ANY(pr.producto_ids) OR (pr.precios_por_producto IS NOT NULL AND pr.precios_por_producto::jsonb ? affected_pid::text))
          ORDER BY pr.updated_at DESC
          LIMIT 1;

          IF other_promo_price IS NOT NULL AND other_promo_price > 0 THEN
            UPDATE products
            SET precio_venta = other_promo_price,
                updated_at = NOW()
            WHERE id = affected_pid
              AND precio_venta != other_promo_price;
          ELSE
            UPDATE products
            SET precio_venta = COALESCE(precio_regular, precio_venta),
                precio_regular = NULL,
                updated_at = NOW()
            WHERE id = affected_pid
              AND precio_regular IS NOT NULL;
          END IF;
        END IF;
      END LOOP;
    END IF;

  -- ══════════════════════════════════════════════════════════════════════════
  -- CASO 3: Promo que se desactiva, pausa, vence o cambió de tipo (UPDATE)
  -- ══════════════════════════════════════════════════════════════════════════
  ELSIF TG_OP = 'UPDATE'
    AND OLD.tipo = 'precio_fijo_oferta'
    AND OLD.producto_ids IS NOT NULL
    AND (
      (OLD.activo = true AND OLD.estado = 'activa' AND NOT is_valid_today)
      OR NEW.tipo != 'precio_fijo_oferta'
    )
  THEN
    FOREACH affected_pid IN ARRAY OLD.producto_ids
    LOOP
      SELECT
        COALESCE(
          CASE 
            WHEN pr.precios_por_producto IS NOT NULL AND pr.precios_por_producto::jsonb ? affected_pid::text 
            THEN (pr.precios_por_producto->>affected_pid::text)::numeric
            ELSE NULL 
          END,
          pr.precio_fijo_promocional
        ) INTO other_promo_price
      FROM promotions pr
      WHERE pr.id != OLD.id
        AND pr.activo = true AND pr.estado = 'activa'
        AND pr.tipo = 'precio_fijo_oferta'
        AND (pr.valido_desde IS NULL OR today_date >= pr.valido_desde)
        AND (pr.valido_hasta IS NULL OR today_date <= pr.valido_hasta)
        AND (pr.dias_semana IS NULL OR array_length(pr.dias_semana, 1) IS NULL OR today_dow = ANY(pr.dias_semana))
        AND (affected_pid = ANY(pr.producto_ids) OR (pr.precios_por_producto IS NOT NULL AND pr.precios_por_producto::jsonb ? affected_pid::text))
      ORDER BY pr.updated_at DESC
      LIMIT 1;

      IF other_promo_price IS NOT NULL AND other_promo_price > 0 THEN
        UPDATE products
        SET precio_venta = other_promo_price,
            updated_at = NOW()
        WHERE id = affected_pid
          AND precio_venta != other_promo_price;
      ELSE
        UPDATE products
        SET precio_venta = COALESCE(precio_regular, precio_venta),
            precio_regular = NULL,
            updated_at = NOW()
        WHERE id = affected_pid
          AND precio_regular IS NOT NULL;
      END IF;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
"""

TRIGGER_DROP_SQL = "DROP TRIGGER IF EXISTS trg_sync_promo_precio_fijo ON promotions;"
TRIGGER_CREATE_SQL = """
CREATE TRIGGER trg_sync_promo_precio_fijo
AFTER INSERT OR UPDATE OR DELETE ON promotions
FOR EACH ROW EXECUTE FUNCTION sync_promo_precio_fijo();
"""

CLEANUP_ORPHANS_SQL = """
WITH active_promo_pids AS (
    SELECT DISTINCT unnest(producto_ids) AS pid
    FROM promotions
    WHERE activo = true AND estado = 'activa'
      AND (valido_desde IS NULL OR CURRENT_DATE >= valido_desde)
      AND (valido_hasta IS NULL OR CURRENT_DATE <= valido_hasta)
    UNION
    SELECT DISTINCT jsonb_object_keys(precios_por_producto::jsonb)::uuid AS pid
    FROM promotions
    WHERE activo = true AND estado = 'activa'
      AND precios_por_producto IS NOT NULL
      AND (valido_desde IS NULL OR CURRENT_DATE >= valido_desde)
      AND (valido_hasta IS NULL OR CURRENT_DATE <= valido_hasta)
)
UPDATE products
SET precio_venta = COALESCE(precio_regular, precio_venta),
    precio_regular = NULL,
    updated_at = NOW()
WHERE precio_regular IS NOT NULL
  AND precio_regular > precio_venta
  AND id NOT IN (SELECT pid FROM active_promo_pids WHERE pid IS NOT NULL);
"""


def upgrade() -> None:
    # 1. Actualizar la función del trigger para cubrir remoción de productos en UPDATE y DELETE
    op.execute(FUNCTION_SQL)
    # 2. Re-crear el trigger asegurando que escuche INSERT OR UPDATE OR DELETE (separado para asyncpg)
    op.execute(TRIGGER_DROP_SQL)
    op.execute(TRIGGER_CREATE_SQL)
    # 3. Limpieza inmediata de productos huérfanos con precio regular desfasado
    op.execute(CLEANUP_ORPHANS_SQL)


def downgrade() -> None:
    # Restaurar versión anterior de 2 eventos (INSERT OR UPDATE)
    op.execute("DROP TRIGGER IF EXISTS trg_sync_promo_precio_fijo ON promotions;")
    op.execute("""
        CREATE TRIGGER trg_sync_promo_precio_fijo
        AFTER INSERT OR UPDATE ON promotions
        FOR EACH ROW EXECUTE FUNCTION sync_promo_precio_fijo();
    """)
