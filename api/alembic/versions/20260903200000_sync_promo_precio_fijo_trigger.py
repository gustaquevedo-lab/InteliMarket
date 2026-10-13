"""Trigger: sincroniza products.precio_venta con promotions.precio_fijo_promocional

Sin esto, una promocion tipo precio_fijo_oferta queda visible en el sistema
(tabla promotions) pero sin ningun efecto real en lo que cobra el POS, que
lee products.precio_venta -- ese campo solo se actualizaba corriendo a mano
scripts/update_products_with_promo_prices.py. Se salteo ese paso al migrar
promociones desde Nemuha y dejo 403 productos con el precio viejo, visibles
"en promocion" en el sistema pero cobrando el precio normal en caja.

Revision ID: 20260903200000
Revises: 20260903110000
Create Date: 2026-09-03 20:00:00.000000

"""
from alembic import op

revision = '20260903200000'
down_revision = '20260903110000'
branch_labels = None
depends_on = None


FUNCTION_SQL = """
CREATE OR REPLACE FUNCTION sync_promo_precio_fijo() RETURNS trigger AS $$
BEGIN
  IF NEW.tipo = 'precio_fijo_oferta'
     AND NEW.activo = true
     AND NEW.estado = 'activa'
     AND NEW.precio_fijo_promocional IS NOT NULL
     AND NEW.precio_fijo_promocional > 0
     AND NEW.producto_ids IS NOT NULL
  THEN
    UPDATE products
    SET precio_venta = NEW.precio_fijo_promocional, updated_at = NOW()
    WHERE id = ANY(NEW.producto_ids)
      AND precio_venta != NEW.precio_fijo_promocional;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
"""

def upgrade():
    op.execute(FUNCTION_SQL)
    op.execute("DROP TRIGGER IF EXISTS trg_sync_promo_precio_fijo ON promotions;")
    op.execute("""
        CREATE TRIGGER trg_sync_promo_precio_fijo
        AFTER INSERT OR UPDATE ON promotions
        FOR EACH ROW EXECUTE FUNCTION sync_promo_precio_fijo();
    """)


def downgrade():
    op.execute("DROP TRIGGER IF EXISTS trg_sync_promo_precio_fijo ON promotions;")
    op.execute("DROP FUNCTION IF EXISTS sync_promo_precio_fijo();")
