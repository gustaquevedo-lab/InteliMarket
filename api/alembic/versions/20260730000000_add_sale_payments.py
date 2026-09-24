"""add sale_payments

Revision ID: 20260730000000
Revises: 20260729000000
Create Date: 2026-07-30 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20260730000000"
down_revision: Union[str, None] = "20260729000000"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "sale_payments",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.func.gen_random_uuid()),
        sa.Column("company_id", sa.dialects.postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("sale_id", sa.dialects.postgresql.UUID(as_uuid=True), sa.ForeignKey("sales.id"), nullable=False),
        sa.Column("forma_pago", sa.String(30), nullable=False),
        sa.Column("monto", sa.Numeric(15, 0), nullable=False),
        sa.Column("fecha", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_sale_payments_company_id", "sale_payments", ["company_id"])
    op.create_index("ix_sale_payments_sale_id", "sale_payments", ["sale_id"])


def downgrade() -> None:
    op.drop_index("ix_sale_payments_sale_id", table_name="sale_payments")
    op.drop_index("ix_sale_payments_company_id", table_name="sale_payments")
    op.drop_table("sale_payments")
