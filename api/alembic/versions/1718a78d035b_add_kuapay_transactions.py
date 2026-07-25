"""add_kuapay_transactions

Revision ID: 1718a78d035b
Revises: 4d4c1ee72707
Create Date: 2026-05-05 09:32:08.682577
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '1718a78d035b'
down_revision: Union[str, None] = '4d4c1ee72707'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "kuapay_transactions",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True), server_default=sa.func.gen_random_uuid(), primary_key=True),
        sa.Column("company_id", sa.dialects.postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("order_id", sa.String(100), nullable=False),
        sa.Column("amount", sa.BigInteger(), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("payment_method", sa.String(50)),
        sa.Column("qr_code", sa.Text()),
        sa.Column("qr_image_url", sa.Text()),
        sa.Column("checkout_url", sa.Text()),
        sa.Column("customer_email", sa.String(200), nullable=False),
        sa.Column("customer_name", sa.String(200), nullable=False),
        sa.Column("customer_phone", sa.String(20)),
        sa.Column("customer_ci", sa.String(20)),
        sa.Column("kuapay_id", sa.String(100)),
        sa.Column("webhook_data", sa.Text()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
    )
    op.create_index("ix_kuapay_transactions_company_id", "kuapay_transactions", ["company_id"])
    op.create_index("ix_kuapay_transactions_order_id", "kuapay_transactions", ["order_id"])


def downgrade() -> None:
    op.drop_index("ix_kuapay_transactions_order_id", table_name="kuapay_transactions")
    op.drop_index("ix_kuapay_transactions_company_id", table_name="kuapay_transactions")
    op.drop_table("kuapay_transactions")
