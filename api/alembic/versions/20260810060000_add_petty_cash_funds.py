"""add petty_cash_funds — fondo fijo real de caja chica (Fase 1 del rediseño
de Gastos/Caja Chica): un fondo por sucursal con custodio y saldo real,
en vez de un simple log de gastos sin ningun concepto de caja.

Revision ID: 20260810060000
Revises: 20260810050000
Create Date: 2026-08-10 06:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "20260810060000"
down_revision: Union[str, None] = "20260810050000"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "petty_cash_funds",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("branch_id", postgresql.UUID(as_uuid=True), nullable=True, index=True),
        sa.Column("nombre", sa.String(100), nullable=False),
        sa.Column("custodio_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("monto_autorizado", sa.Numeric(15, 0), nullable=False),
        sa.Column("saldo_actual", sa.Numeric(15, 0), nullable=False),
        sa.Column("activo", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )

    op.add_column("expenses", sa.Column("fund_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.create_index("ix_expenses_fund_id", "expenses", ["fund_id"])

    op.create_table(
        "petty_cash_fund_movements",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("fund_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("petty_cash_funds.id"), nullable=False, index=True),
        sa.Column("tipo", sa.String(20), nullable=False),  # apertura | gasto | reposicion | ajuste
        sa.Column("monto", sa.Numeric(15, 0), nullable=False),
        sa.Column("saldo_anterior", sa.Numeric(15, 0), nullable=False),
        sa.Column("saldo_nuevo", sa.Numeric(15, 0), nullable=False),
        sa.Column("referencia_type", sa.String(30)),
        sa.Column("referencia_id", postgresql.UUID(as_uuid=True)),
        sa.Column("observaciones", sa.Text()),
        sa.Column("created_by", postgresql.UUID(as_uuid=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )


def downgrade() -> None:
    op.drop_table("petty_cash_fund_movements")
    op.drop_index("ix_expenses_fund_id", table_name="expenses")
    op.drop_column("expenses", "fund_id")
    op.drop_table("petty_cash_funds")
