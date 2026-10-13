"""precio_regular en products + revertir precio_venta cuando una promo se desactiva

Complementa la migracion anterior (20260903200000): ahora que el precio de
oferta se aplica solo, hace falta poder volver al precio real cuando la
promo termina -- no existia ningun lugar donde quedara guardado ese precio
"de antes", asi que promotions.activo=false o estado != 'activa' no
revertia nada.

Se agrega products.precio_regular (se completa solo, la primera vez que un
producto entra en promo, con lo que tenia precio_venta en ese momento -- no
se puede reconstruir retroactivamente para los productos que ya estaban en
promo antes de esta migracion, esos quedan con precio_regular NULL hasta la
proxima vez que entren en una promo desde cero).

El trigger sync_promo_precio_fijo se extiende para cubrir ambos sentidos:
- Promo pasa a activa con precio: guarda precio_regular (solo si estaba
  vacio) y aplica el precio de oferta.
- Promo deja de estar activa (activo=false o estado != 'activa'): vuelve
  precio_venta a precio_regular y lo limpia, para que la proxima promo
  capture un valor fresco.

Revision ID: 20260903210000
Revises: 20260903200000
Create Date: 2026-09-03 21:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = '20260903210000'
down_revision = '20260903200000'
branch_labels = None
depends_on = None


FUNCTION_SQL = """
CREATE OR REPLACE FUNCTION sync_promo_precio_fijo() RETURNS trigger AS $$
BEGIN
  IF NEW.tipo = 'precio_fijo_oferta' AND NEW.producto_ids IS NOT NULL THEN
    IF NEW.activo = true AND NEW.estado = 'activa'
       AND NEW.precio_fijo_promocional IS NOT NULL AND NEW.precio_fijo_promocional > 0
    THEN
      UPDATE products
      SET precio_regular = COALESCE(precio_regular, precio_venta),
          precio_venta = NEW.precio_fijo_promocional,
          updated_at = NOW()
      WHERE id = ANY(NEW.producto_ids)
        AND precio_venta != NEW.precio_fijo_promocional;
    ELSIF TG_OP = 'UPDATE'
      AND OLD.activo = true AND OLD.estado = 'activa'
      AND NOT (NEW.activo = true AND NEW.estado = 'activa')
    THEN
      UPDATE products
      SET precio_venta = COALESCE(precio_regular, precio_venta),
          precio_regular = NULL,
          updated_at = NOW()
      WHERE id = ANY(OLD.producto_ids)
        AND precio_regular IS NOT NULL;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
"""


def upgrade():
    op.add_column('products', sa.Column('precio_regular', sa.Numeric(15, 2), nullable=True))
    op.execute(FUNCTION_SQL)


def downgrade():
    op.drop_column('products', 'precio_regular')
    # el downgrade deja la funcion en la version anterior (solo aplica, no revierte)
    op.execute("""
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
    """)
