"""add dunning_notifications — recordatorios de cobro automaticos por
WhatsApp (Fase 4 de Lineas de Credito), un registro por (cliente, umbral de
dias de mora) para no repetir el mismo aviso dos veces.

Revision ID: 20260810040000
Revises: 20260810030000
Create Date: 2026-08-10 04:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "20260810040000"
down_revision: Union[str, None] = "20260810030000"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "dunning_notifications",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("customer_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("bucket_dias", sa.Integer(), nullable=False),
        sa.Column("monto_total", sa.Numeric(15, 2), nullable=False),
        sa.Column("documentos_count", sa.Integer(), nullable=False),
        sa.Column("telefono", sa.String(30)),
        sa.Column("mensaje", sa.Text()),
        sa.Column("sent_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.UniqueConstraint("company_id", "customer_id", "bucket_dias", name="uq_dunning_customer_bucket"),
    )


def downgrade() -> None:
    op.drop_table("dunning_notifications")
