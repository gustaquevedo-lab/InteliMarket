"""add receivable_writeoff_requests — baja de facturas incobrables (Fase 3 de
Cuentas por Cobrar/Lineas de Credito), requiere doble aprobacion Gerente Y
Finanzas (dos personas reales, no el mismo rol dos veces) antes de marcar el
documento como 'incobrable' y sacarlo de la cartera pendiente/aging.

Revision ID: 20260810030000
Revises: 20260810020000
Create Date: 2026-08-10 03:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "20260810030000"
down_revision: Union[str, None] = "20260810020000"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "receivable_writeoff_requests",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("accounts_receivable_id", postgresql.UUID(as_uuid=True), nullable=False, unique=True, index=True),
        sa.Column("customer_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("credit_account_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("monto", sa.Numeric(15, 2), nullable=False),
        sa.Column("motivo", sa.Text(), nullable=False),
        sa.Column("estado", sa.String(20), nullable=False, server_default="pendiente"),  # pendiente, aprobado, rechazado
        sa.Column("solicitado_por", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("aprobado_gerente_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("aprobado_gerente_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("aprobado_finanzas_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("aprobado_finanzas_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("rechazado_por", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("rechazado_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("rechazado_motivo", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )


def downgrade() -> None:
    op.drop_table("receivable_writeoff_requests")
