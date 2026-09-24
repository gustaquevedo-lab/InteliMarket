"""add credit_approval_requests — venta a credito que excede el limite del
cliente, retenida hasta que Supervisor Y Gerente aprueben.

Revision ID: 20260809020000
Revises: 20260809010000
Create Date: 2026-08-09 02:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20260809020000"
down_revision: Union[str, None] = "20260809010000"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "credit_approval_requests",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True), server_default=sa.func.gen_random_uuid(), primary_key=True),
        sa.Column("company_id", sa.dialects.postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("sale_id", sa.dialects.postgresql.UUID(as_uuid=True), nullable=False, unique=True),
        sa.Column("customer_id", sa.dialects.postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("credit_account_id", sa.dialects.postgresql.UUID(as_uuid=True), sa.ForeignKey("credit_accounts.id"), nullable=False),
        sa.Column("monto", sa.Numeric(15, 2), nullable=False),
        sa.Column("limite_credito", sa.Numeric(15, 2)),
        sa.Column("saldo_disponible", sa.Numeric(15, 2)),
        sa.Column("estado", sa.String(20), nullable=False, server_default="pendiente"),
        sa.Column("aprobado_supervisor_id", sa.dialects.postgresql.UUID(as_uuid=True)),
        sa.Column("aprobado_supervisor_at", sa.DateTime(timezone=True)),
        sa.Column("aprobado_gerente_id", sa.dialects.postgresql.UUID(as_uuid=True)),
        sa.Column("aprobado_gerente_at", sa.DateTime(timezone=True)),
        sa.Column("rechazado_por", sa.dialects.postgresql.UUID(as_uuid=True)),
        sa.Column("rechazado_at", sa.DateTime(timezone=True)),
        sa.Column("rechazado_motivo", sa.Text()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
    )
    op.create_index("ix_credit_approval_requests_company_id", "credit_approval_requests", ["company_id"])
    op.create_index("ix_credit_approval_requests_sale_id", "credit_approval_requests", ["sale_id"])
    op.create_index("ix_credit_approval_requests_customer_id", "credit_approval_requests", ["customer_id"])


def downgrade() -> None:
    op.drop_index("ix_credit_approval_requests_customer_id", table_name="credit_approval_requests")
    op.drop_index("ix_credit_approval_requests_sale_id", table_name="credit_approval_requests")
    op.drop_index("ix_credit_approval_requests_company_id", table_name="credit_approval_requests")
    op.drop_table("credit_approval_requests")
