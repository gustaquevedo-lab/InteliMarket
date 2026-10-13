"""label_printer_configs: calibracion TSPL (dots/mm reales y offset por columna)

Medido contra la Pantum PT-D160 real de COMPRAS2 imprimiendo una regla
milimetrica: el eje horizontal responde a 8 dots/mm (203dpi nominal) pero el
vertical a 8.889 dots/mm. Asumir 8 en ambos ejes deformaba la etiqueta y
recortaba el contenido, que es lo que hacia imposible calibrarla.

El offset por columna corrige el troquelado del rollo (la 1ra columna necesita
+1mm, las otras 0) y es propio del rollo, no de la impresora -- por eso va en
configuracion y no hardcodeado.

Revision ID: 20260906120000
Revises: 20260905193000
Create Date: 2026-09-06 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = '20260906120000'
down_revision = '20260905193000'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('label_printer_configs', sa.Column('dpmm_x', sa.Numeric(6, 3), server_default='8', nullable=False))
    op.add_column('label_printer_configs', sa.Column('dpmm_y', sa.Numeric(6, 3), server_default='8', nullable=False))
    op.add_column('label_printer_configs', sa.Column('offsets_columnas_mm', sa.String(100), nullable=True))


def downgrade():
    op.drop_column('label_printer_configs', 'offsets_columnas_mm')
    op.drop_column('label_printer_configs', 'dpmm_y')
    op.drop_column('label_printer_configs', 'dpmm_x')
