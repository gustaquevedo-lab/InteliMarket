"""label_printer_configs: offset vertical de impresion

Complementa a margen_izquierdo_mm. Las dos impresoras necesitaron correr el
contenido para caer sobre el troquel: la Zebra 1mm a la derecha y 1mm hacia
abajo (medido contra el papel real). Es propio del rollo y del montaje del
cabezal, no del modelo de impresora, asi que va en configuracion.

Revision ID: 20260906140000
Revises: 20260906120000
Create Date: 2026-09-06 14:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = '20260906140000'
down_revision = '20260906120000'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('label_printer_configs', sa.Column('offset_vertical_mm', sa.Numeric(6, 2), server_default='0', nullable=False))


def downgrade():
    op.drop_column('label_printer_configs', 'offset_vertical_mm')
