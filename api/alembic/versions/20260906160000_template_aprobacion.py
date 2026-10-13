"""label_templates: aprobacion de diseno

El cliente lo pidio explicito: quien disena puede probar e imprimir libremente,
pero cuando da por buena una version la aprueba y queda congelada. La estacion
del gondolero no tiene disenador -- imprime solo la version aprobada vigente.

Revision ID: 20260906160000
Revises: 20260906140000
Create Date: 2026-09-06 16:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = '20260906160000'
down_revision = '20260906140000'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('label_templates', sa.Column('aprobada', sa.Boolean(), server_default='false', nullable=False))
    op.add_column('label_templates', sa.Column('aprobada_en', sa.DateTime(timezone=True), nullable=True))
    op.add_column('label_templates', sa.Column('aprobada_por', sa.String(200), nullable=True))


def downgrade():
    op.drop_column('label_templates', 'aprobada_por')
    op.drop_column('label_templates', 'aprobada_en')
    op.drop_column('label_templates', 'aprobada')
