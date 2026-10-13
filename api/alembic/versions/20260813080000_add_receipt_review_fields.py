"""add requiere_revision/motivo_revision to purchase_receipts, cantidad_rechazada/motivo_rechazo to purchase_receipt_items

Revision ID: 20260813080000
Revises: 20260813070000
Create Date: 2026-08-13 08:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "20260813080000"
down_revision: Union[str, None] = "20260813070000"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("purchase_receipts", sa.Column("requiere_revision", sa.Boolean(), nullable=True, server_default=sa.false()))
    op.add_column("purchase_receipts", sa.Column("motivo_revision", sa.Text(), nullable=True))
    op.add_column("purchase_receipt_items", sa.Column("cantidad_rechazada", sa.Numeric(10, 3), nullable=True))
    op.add_column("purchase_receipt_items", sa.Column("motivo_rechazo", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("purchase_receipt_items", "motivo_rechazo")
    op.drop_column("purchase_receipt_items", "cantidad_rechazada")
    op.drop_column("purchase_receipts", "motivo_revision")
    op.drop_column("purchase_receipts", "requiere_revision")
