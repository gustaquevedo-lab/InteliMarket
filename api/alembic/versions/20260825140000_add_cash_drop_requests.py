"""add_cash_drop_requests

Revision ID: 20260825140000
Revises: 20260825110000
Create Date: 2026-08-25 14:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = '20260825140000'
down_revision: Union[str, None] = '20260825110000'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "cash_drop_requests",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("session_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("cash_sessions.id"), nullable=False),
        sa.Column("register_id", postgresql.UUID(as_uuid=True)),
        sa.Column("solicitado_por", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("solicitado_por_nombre", sa.String(100)),
        sa.Column("monto_pyg", sa.Numeric(15, 0), server_default="0"),
        sa.Column("monto_usd", sa.Numeric(12, 2), server_default="0"),
        sa.Column("monto_brl", sa.Numeric(12, 2), server_default="0"),
        sa.Column("observaciones", sa.Text()),
        sa.Column("estado", sa.String(20), nullable=False, server_default="pendiente"),
        sa.Column("confirmado_por", postgresql.UUID(as_uuid=True)),
        sa.Column("confirmado_por_nombre", sa.String(100)),
        sa.Column("monto_confirmado_pyg", sa.Numeric(15, 0)),
        sa.Column("monto_confirmado_usd", sa.Numeric(12, 2)),
        sa.Column("monto_confirmado_brl", sa.Numeric(12, 2)),
        sa.Column("discrepancia_confirmacion", sa.Boolean(), server_default=sa.text("false")),
        sa.Column("motivo_rechazo", sa.Text()),
        sa.Column("fecha_confirmacion", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )
    op.create_index("ix_cash_drop_requests_company_id", "cash_drop_requests", ["company_id"])


def downgrade() -> None:
    op.drop_index("ix_cash_drop_requests_company_id", table_name="cash_drop_requests")
    op.drop_table("cash_drop_requests")
