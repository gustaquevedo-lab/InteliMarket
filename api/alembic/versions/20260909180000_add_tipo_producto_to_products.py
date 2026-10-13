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
    op.execute("""
        ALTER TABLE products
        ADD COLUMN IF NOT EXISTS tipo_producto VARCHAR(20) DEFAULT 'producto' NOT NULL
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_products_tipo_producto ON products (tipo_producto)")


def downgrade() -> None:
    op.drop_index('ix_products_tipo_producto', table_name='products')
    op.drop_column('products', 'tipo_producto')
