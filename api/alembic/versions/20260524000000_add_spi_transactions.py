"""add spi_transactions table

Revision ID: 20260524000000
Revises: 20260523120000
Create Date: 2026-05-24 00:00:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "20260524000000"
down_revision: Union[str, None] = "20260523120000"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "spi_transactions",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("company_id", sa.UUID(), nullable=False, index=True),
        sa.Column("order_id", sa.String(100), nullable=False, index=True),
        sa.Column("amount", sa.BigInteger(), nullable=False),
        sa.Column("currency", sa.String(3), nullable=False, server_default="PYG"),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("qr_data", sa.Text()),
        sa.Column("qr_image_base64", sa.Text()),
        sa.Column("merchant_name", sa.String(100)),
        sa.Column("description", sa.String(255)),
        sa.Column("customer_email", sa.String(200)),
        sa.Column("customer_name", sa.String(200)),
        sa.Column("bcp_transaction_id", sa.String(100)),
        sa.Column("webhook_data", sa.Text()),
        sa.Column("error_message", sa.Text()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("spi_transactions")
