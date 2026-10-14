"""Add product_fractionations table

Revision ID: 20261014160000
Revises: 20261013173000
Create Date: 2026-10-14 16:00:00.000000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "20261014160000"
down_revision = "20261013173000"
branch_labels = None
depends_on = None

def upgrade() -> None:
    op.create_table(
        "product_fractionations",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("parent_product_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("products.id", ondelete="CASCADE"), nullable=False),
        sa.Column("child_product_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("products.id", ondelete="CASCADE"), nullable=False),
        sa.Column("factor_conversion", sa.Integer(), nullable=False),
        sa.Column("activo", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
        sa.UniqueConstraint("parent_product_id", name="uq_fractionation_parent"),
        sa.UniqueConstraint("child_product_id", name="uq_fractionation_child"),
        sa.CheckConstraint("factor_conversion > 1", name="chk_fractionation_factor"),
        sa.CheckConstraint("parent_product_id <> child_product_id", name="chk_fractionation_diff"),
    )
    op.create_index("ix_product_fractionations_parent", "product_fractionations", ["parent_product_id"])
    op.create_index("ix_product_fractionations_child", "product_fractionations", ["child_product_id"])

def downgrade() -> None:
    op.drop_table("product_fractionations")
