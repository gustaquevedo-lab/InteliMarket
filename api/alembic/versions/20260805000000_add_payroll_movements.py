"""add payroll_movements (detalle de nomina por empleado y concepto,
descubierto explorando el modulo rh_* del legado — no estaba migrado)

Revision ID: 20260805000000
Revises: 20260804000000
Create Date: 2026-08-05 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlalchemy.dialects.postgresql


revision: str = "20260805000000"
down_revision: Union[str, None] = "20260804000000"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "payroll_movements",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("company_id", sa.dialects.postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("empleado_nombre", sa.String(150), nullable=False),
        sa.Column("concepto", sa.String(100), nullable=False),
        sa.Column("es_credito", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("monto", sa.Numeric(15, 0), nullable=False),
        sa.Column("fecha", sa.Date, nullable=False),
        sa.Column("cerrado", sa.Boolean, server_default="false"),
        sa.Column("observaciones", sa.Text),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_payroll_movements_company_id", "payroll_movements", ["company_id"])


def downgrade() -> None:
    op.drop_index("ix_payroll_movements_company_id", table_name="payroll_movements")
    op.drop_table("payroll_movements")
