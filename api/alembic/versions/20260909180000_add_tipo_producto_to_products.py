"""add_tipo_producto_to_products

Revision ID: 20260909180000
Revises: 20260909160000
Create Date: 2026-09-09 18:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '20260909180000'
down_revision: Union[str, None] = '20260909160000'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Agrega columna tipo_producto a products (producto | materia_prima | insumo | servicio)
    op.add_column(
        'products',
        sa.Column(
            'tipo_producto',
            sa.String(20),
            nullable=False,
            server_default='producto',
            comment='Clasificación: producto (final venta), materia_prima (recetas/producción), insumo (uso interno), servicio'
        ),
    )
    op.create_index('ix_products_tipo_producto', 'products', ['tipo_producto'])


def downgrade() -> None:
    op.drop_index('ix_products_tipo_producto', table_name='products')
    op.drop_column('products', 'tipo_producto')
