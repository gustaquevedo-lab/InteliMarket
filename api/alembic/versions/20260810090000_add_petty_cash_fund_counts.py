"""add petty_cash_fund_counts (arqueo de caja chica) — Fase 5 del rediseño
de Gastos/Caja Chica: conteo ciego del efectivo fisico del fondo, mismo
patron que cash_counts en el modulo Caja. saldo_esperado se guarda como
foto del momento del arqueo (no se recalcula despues).

Revision ID: 20260810090000
Revises: 20260810080000
Create Date: 2026-08-10 09:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "20260810090000"
down_revision: Union[str, None] = "20260810080000"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "petty_cash_fund_counts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("fund_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("contado_por", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("contado_por_nombre", sa.String(100), nullable=True),
        sa.Column("saldo_esperado", sa.Numeric(15, 0), nullable=False),
        sa.Column("monto_contado", sa.Numeric(15, 0), nullable=False),
        sa.Column("diferencia", sa.Numeric(15, 0), nullable=False),
        sa.Column("requiere_revision", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("estado", sa.String(20), nullable=False, server_default="pendiente"),
        sa.Column("confirmado_por", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("confirmado_por_nombre", sa.String(100), nullable=True),
        sa.Column("fecha_confirmacion", sa.DateTime(timezone=True), nullable=True),
        sa.Column("ajusto_saldo", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("observaciones", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )
    op.create_index("ix_petty_cash_fund_counts_company_id", "petty_cash_fund_counts", ["company_id"])
    op.create_index("ix_petty_cash_fund_counts_fund_id", "petty_cash_fund_counts", ["fund_id"])


def downgrade() -> None:
    op.drop_index("ix_petty_cash_fund_counts_fund_id", table_name="petty_cash_fund_counts")
    op.drop_index("ix_petty_cash_fund_counts_company_id", table_name="petty_cash_fund_counts")
    op.drop_table("petty_cash_fund_counts")
