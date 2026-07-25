"""add_credit_accounts

Revision ID: 08b26510b7d5
Revises: fbd661dae429
Create Date: 2026-05-05 10:14:32.445254
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '08b26510b7d5'
down_revision: Union[str, None] = 'fbd661dae429'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "credit_accounts",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True), server_default=sa.func.gen_random_uuid(), primary_key=True),
        sa.Column("company_id", sa.dialects.postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("customer_id", sa.dialects.postgresql.UUID(as_uuid=True), sa.ForeignKey("customers.id"), nullable=False, unique=True),
        sa.Column("limite_credito", sa.Numeric(15, 2), nullable=False, server_default="0"),
        sa.Column("saldo_disponible", sa.Numeric(15, 2), nullable=False, server_default="0"),
        sa.Column("saldo_utilizado", sa.Numeric(15, 2), nullable=False, server_default="0"),
        sa.Column("activo", sa.Boolean(), server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
    )
    op.create_index("ix_credit_accounts_company_id", "credit_accounts", ["company_id"])
    op.create_index("ix_credit_accounts_customer_id", "credit_accounts", ["customer_id"])

    op.create_table(
        "credit_movements",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True), server_default=sa.func.gen_random_uuid(), primary_key=True),
        sa.Column("company_id", sa.dialects.postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("credit_account_id", sa.dialects.postgresql.UUID(as_uuid=True), sa.ForeignKey("credit_accounts.id"), nullable=False),
        sa.Column("customer_id", sa.dialects.postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("tipo", sa.String(20), nullable=False),
        sa.Column("monto", sa.Numeric(15, 2), nullable=False),
        sa.Column("saldo_anterior", sa.Numeric(15, 2), nullable=False),
        sa.Column("saldo_nuevo", sa.Numeric(15, 2), nullable=False),
        sa.Column("referencia_type", sa.String(50)),
        sa.Column("referencia_id", sa.dialects.postgresql.UUID(as_uuid=True)),
        sa.Column("observaciones", sa.Text()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_credit_movements_company_id", "credit_movements", ["company_id"])
    op.create_index("ix_credit_movements_credit_account_id", "credit_movements", ["credit_account_id"])
    op.create_index("ix_credit_movements_customer_id", "credit_movements", ["customer_id"])


def downgrade() -> None:
    op.drop_index("ix_credit_movements_customer_id", table_name="credit_movements")
    op.drop_index("ix_credit_movements_credit_account_id", table_name="credit_movements")
    op.drop_index("ix_credit_movements_company_id", table_name="credit_movements")
    op.drop_table("credit_movements")
    op.drop_index("ix_credit_accounts_customer_id", table_name="credit_accounts")
    op.drop_index("ix_credit_accounts_company_id", table_name="credit_accounts")
    op.drop_table("credit_accounts")
