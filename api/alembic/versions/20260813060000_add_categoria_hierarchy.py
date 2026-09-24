"""add parent_id/codigo a product_categories — el modelo ORM ya declaraba
estas columnas (categorizacion jerarquica) pero nunca existieron en la tabla
real, asi que CUALQUIER listado de categorias fallaba en produccion
(select(ProductCategory) selecciona todas las columnas mapeadas). Esto
tambien explica por que el alta manual de productos parecia no funcionar.

Revision ID: 20260813060000
Revises: 20260813050000
Create Date: 2026-08-13 06:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "20260813060000"
down_revision: Union[str, None] = "20260813050000"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("product_categories", sa.Column("parent_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("product_categories.id"), nullable=True))
    op.add_column("product_categories", sa.Column("codigo", sa.String(20), nullable=True))
    op.create_index("ix_product_categories_parent_id", "product_categories", ["parent_id"])
    op.create_unique_constraint("uq_product_categories_codigo", "product_categories", ["codigo"])


def downgrade() -> None:
    op.drop_constraint("uq_product_categories_codigo", "product_categories", type_="unique")
    op.drop_index("ix_product_categories_parent_id", table_name="product_categories")
    op.drop_column("product_categories", "codigo")
    op.drop_column("product_categories", "parent_id")
