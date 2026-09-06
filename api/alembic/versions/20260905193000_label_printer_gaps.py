"""label_printer_configs: gap horizontal/vertical y margen izquierdo del rollo

La Pantum PT-D160 corta el rollo con separacion fisica real entre etiquetas
(troquelado): en la prueba real con el cliente, 3mm horizontal y 2mm
vertical entre etiquetas, mas un margen izquierdo antes de la primera
columna -- ninguno de los dos existia, la grilla se armaba pegada (gap=0),
por eso el contenido quedaba corrido respecto al troquelado real del rollo.

Revision ID: 20260905193000
Revises: 20260904090000
Create Date: 2026-09-05 19:30:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = '20260905193000'
down_revision = '20260904090000'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('label_printer_configs', sa.Column('gap_horizontal_mm', sa.Numeric(6, 2), server_default='0', nullable=False))
    op.add_column('label_printer_configs', sa.Column('gap_vertical_mm', sa.Numeric(6, 2), server_default='0', nullable=False))
    op.add_column('label_printer_configs', sa.Column('margen_izquierdo_mm', sa.Numeric(6, 2), server_default='0', nullable=False))


def downgrade():
    op.drop_column('label_printer_configs', 'margen_izquierdo_mm')
    op.drop_column('label_printer_configs', 'gap_vertical_mm')
    op.drop_column('label_printer_configs', 'gap_horizontal_mm')
