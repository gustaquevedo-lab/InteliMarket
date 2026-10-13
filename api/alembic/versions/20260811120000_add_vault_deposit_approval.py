"""add vault_deposit_approval_requests — Fase 3 del overhaul de Caja/Bóveda:
los depósitos a bóveda por un monto grande (umbral configurable) ya no se
ejecutan de un solo paso; quedan retenidos hasta que Supervisor Y Gerente
aprueben, mismo patrón de doble aprobación ya usado en credit_accounts y
en la corrección de saldo de Bancos.

Revision ID: 20260811120000
Revises: 20260810110000
Create Date: 2026-08-11 12:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "20260811120000"
down_revision: Union[str, None] = "20260810110000"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "vault_deposit_approval_requests",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("entry_ids", postgresql.ARRAY(postgresql.UUID(as_uuid=True)), nullable=False),
        sa.Column("monto_total_pyg", sa.Numeric(15, 0), nullable=False),
        sa.Column("estado", sa.String(20), nullable=False, server_default="pendiente"),
        sa.Column("aprobado_supervisor_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("aprobado_supervisor_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("aprobado_gerente_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("aprobado_gerente_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("rechazado_por", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("rechazado_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("rechazado_motivo", sa.Text, nullable=True),
        sa.Column("solicitado_por", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("vault_deposit_approval_requests")
