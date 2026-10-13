"""add_checks_and_dias_plazo

Revision ID: 20260807000000
Revises: dc217bbb50fc
Create Date: 2026-08-07 15:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '20260807000000'
down_revision: Union[str, None] = 'dc217bbb50fc'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "credit_accounts",
        sa.Column("dias_plazo", sa.Integer(), nullable=False, server_default="30"),
    )

    op.create_table(
        "checks",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True), server_default=sa.func.gen_random_uuid(), primary_key=True),
        sa.Column("company_id", sa.dialects.postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("customer_id", sa.dialects.postgresql.UUID(as_uuid=True), sa.ForeignKey("customers.id"), nullable=False),
        sa.Column("tipo", sa.String(10), nullable=False, server_default="cheque"),
        sa.Column("numero", sa.String(50), nullable=False),
        sa.Column("banco", sa.String(100)),
        sa.Column("titular", sa.String(150)),
        sa.Column("monto", sa.Numeric(15, 0), nullable=False),
        sa.Column("moneda", sa.String(3), nullable=False, server_default="PYG"),
        sa.Column("fecha_emision", sa.Date()),
        sa.Column("fecha_vencimiento", sa.Date(), nullable=False),
        sa.Column("estado", sa.String(20), nullable=False, server_default="cartera"),
        sa.Column("payment_id", sa.dialects.postgresql.UUID(as_uuid=True), sa.ForeignKey("payments.id")),
        sa.Column("accounts_receivable_id", sa.dialects.postgresql.UUID(as_uuid=True)),
        sa.Column("reemplaza_check_id", sa.dialects.postgresql.UUID(as_uuid=True), sa.ForeignKey("checks.id")),
        sa.Column("observaciones", sa.Text()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
    )
    op.create_index("ix_checks_company_id", "checks", ["company_id"])
    op.create_index("ix_checks_customer_id", "checks", ["customer_id"])
    op.create_index("ix_checks_estado", "checks", ["estado"])
    op.create_index("ix_checks_fecha_vencimiento", "checks", ["fecha_vencimiento"])

    op.create_table(
        "check_events",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True), server_default=sa.func.gen_random_uuid(), primary_key=True),
        sa.Column("check_id", sa.dialects.postgresql.UUID(as_uuid=True), sa.ForeignKey("checks.id"), nullable=False),
        sa.Column("estado_anterior", sa.String(20)),
        sa.Column("estado_nuevo", sa.String(20), nullable=False),
        sa.Column("motivo", sa.Text()),
        sa.Column("user_id", sa.dialects.postgresql.UUID(as_uuid=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_check_events_check_id", "check_events", ["check_id"])


def downgrade() -> None:
    op.drop_index("ix_check_events_check_id", table_name="check_events")
    op.drop_table("check_events")
    op.drop_index("ix_checks_fecha_vencimiento", table_name="checks")
    op.drop_index("ix_checks_estado", table_name="checks")
    op.drop_index("ix_checks_customer_id", table_name="checks")
    op.drop_index("ix_checks_company_id", table_name="checks")
    op.drop_table("checks")
    op.drop_column("credit_accounts", "dias_plazo")
