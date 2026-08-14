"""add customer_advances — anticipos de clientes (Fase 5 de Lineas de
Credito): dinero que un cliente adelanta antes de tener una factura contra
la cual aplicarlo, queda como saldo a favor disponible para aplicar despues
a documentos puntuales de accounts_receivable.

Revision ID: 20260810050000
Revises: 20260810040000
Create Date: 2026-08-10 05:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "20260810050000"
down_revision: Union[str, None] = "20260810040000"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "customer_advances",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("customer_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("monto_total", sa.Numeric(15, 0), nullable=False),
        sa.Column("monto_disponible", sa.Numeric(15, 0), nullable=False),
        sa.Column("moneda", sa.String(3), nullable=False, server_default="PYG"),
        sa.Column("forma_pago", sa.String(30)),
        sa.Column("referencia", sa.String(200)),
        sa.Column("fecha", sa.Date(), nullable=False, server_default=sa.text("CURRENT_DATE")),
        sa.Column("observaciones", sa.Text()),
        sa.Column("registrado_por", postgresql.UUID(as_uuid=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )
    op.create_index("ix_customer_advances_company", "customer_advances", ["company_id"])
    op.create_index("ix_customer_advances_customer", "customer_advances", ["customer_id"])

    op.create_table(
        "customer_advance_applications",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("customer_advance_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("customer_advances.id"), nullable=False, index=True),
        sa.Column("accounts_receivable_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("monto", sa.Numeric(15, 0), nullable=False),
        sa.Column("aplicado_por", postgresql.UUID(as_uuid=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )


def downgrade() -> None:
    op.drop_table("customer_advance_applications")
    op.drop_table("customer_advances")
