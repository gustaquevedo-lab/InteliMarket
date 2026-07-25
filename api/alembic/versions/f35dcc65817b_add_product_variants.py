"""add_product_variants

Revision ID: f35dcc65817b
Revises: 8d1b8af06d86
Create Date: 2026-05-05 21:53:15.679575
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f35dcc65817b'
down_revision: Union[str, None] = '8d1b8af06d86'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "product_variants",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True), server_default=sa.func.gen_random_uuid(), primary_key=True),
        sa.Column("product_id", sa.dialects.postgresql.UUID(as_uuid=True), sa.ForeignKey("products.id"), nullable=False),
        sa.Column("company_id", sa.dialects.postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("tipo", sa.String(50), nullable=False, server_default="talle"),
        sa.Column("valor", sa.String(100), nullable=False),
        sa.Column("sku_variante", sa.String(100), nullable=False, unique=True),
        sa.Column("codigo_barra", sa.String(50)),
        sa.Column("precio_extra", sa.Numeric(15, 2), server_default="0"),
        sa.Column("stock", sa.Integer(), server_default="0"),
        sa.Column("orden", sa.Integer(), server_default="0"),
        sa.Column("activo", sa.Boolean(), server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
    )
    op.create_index("ix_product_variants_product_id", "product_variants", ["product_id"])
    op.create_index("ix_product_variants_company_id", "product_variants", ["company_id"])


def downgrade() -> None:
    op.drop_index("ix_product_variants_company_id", table_name="product_variants")
    op.drop_index("ix_product_variants_product_id", table_name="product_variants")
    op.drop_table("product_variants")
