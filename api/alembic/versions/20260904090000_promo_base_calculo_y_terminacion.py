"""promotions: base de calculo del % (venta/costo) y terminacion psicologica de precio

El cliente pregunto explicitamente si el % de descuento se calcula sobre
costo o sobre venta, y si se puede pedir un precio "creativo" (terminado en
un digito especifico, ej. 77) al crear una promocion. Ninguna de las dos
cosas existia: el % siempre se restaba del precio de venta actual, y el
precio final quedaba tal cual salia del calculo, sin ningun redondeo
psicologico.

- base_calculo_pct ('venta' | 'costo'): solo aplica a tipo=porcentaje. Con
  'costo', el precio de oferta se calcula como costo_unitario_referencia *
  (1 + valor/100) en vez de precio_venta * (1 - valor/100) -- util para
  definir un margen objetivo en vez de un descuento directo.
- terminacion_psicologica (0-99, nullable): fuerza que los ultimos 2
  digitos del precio final calculado (por cualquier mecanica) coincidan con
  este valor, ej. terminacion=77 sobre un calculo de Gs. 13.000 da Gs. 12.977.

Ambas columnas tienen defaults que preservan el comportamiento actual para
toda promocion existente (base_calculo_pct='venta', terminacion=NULL).

Revision ID: 20260904090000
Revises: 20260903210000
Create Date: 2026-09-04 09:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = '20260904090000'
down_revision = '20260903210000'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('promotions', sa.Column('base_calculo_pct', sa.String(10), server_default='venta', nullable=True))
    op.add_column('promotions', sa.Column('terminacion_psicologica', sa.Integer(), nullable=True))


def downgrade():
    op.drop_column('promotions', 'terminacion_psicologica')
    op.drop_column('promotions', 'base_calculo_pct')
