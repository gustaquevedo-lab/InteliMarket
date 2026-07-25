"""add_price_lists

Revision ID: c603f2f8ab8b
Revises: f35dcc65817b
Create Date: 2026-05-06 06:23:07.097689
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c603f2f8ab8b'
down_revision: Union[str, None] = 'f35dcc65817b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "price_lists",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True), server_default=sa.func.gen_random_uuid(), primary_key=True),
        sa.Column("company_id", sa.dialects.postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("nombre", sa.String(200), nullable=False),
        sa.Column("tipo", sa.String(20), nullable=False, server_default="general"),
        sa.Column("customer_id", sa.dialects.postgresql.UUID(as_uuid=True)),
        sa.Column("grupo", sa.String(100)),
        sa.Column("activo", sa.Boolean(), server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
    )
    op.create_index("ix_price_lists_company_id", "price_lists", ["company_id"])

    op.create_table(
        "price_list_items",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True), server_default=sa.func.gen_random_uuid(), primary_key=True),
        sa.Column("price_list_id", sa.dialects.postgresql.UUID(as_uuid=True), sa.ForeignKey("price_lists.id"), nullable=False),
        sa.Column("product_id", sa.dialects.postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("variant_id", sa.dialects.postgresql.UUID(as_uuid=True)),
        sa.Column("precio", sa.Numeric(15, 2), nullable=False, server_default="0"),
        sa.Column("moneda", sa.String(3), server_default="PYG"),
        sa.Column("notas", sa.String(200)),
        sa.Column("activo", sa.Boolean(), server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
    )
    op.create_index("ix_price_list_items_pl_id", "price_list_items", ["price_list_id"])
    op.create_index("ix_price_list_items_product_id", "price_list_items", ["product_id"])


def downgrade() -> None:
    op.drop_index("ix_price_list_items_product_id", table_name="price_list_items")
    op.drop_index("ix_price_list_items_pl_id", table_name="price_list_items")
    op.drop_table("price_list_items")
    op.drop_index("ix_price_lists_company_id", table_name="price_lists")
    op.drop_table("price_lists")
