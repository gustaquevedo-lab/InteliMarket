"""add petty cash / expense tracking (caja chica)

Revision ID: 20260525010000
Revises: 20260525000000
Create Date: 2026-05-25 01:00:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "20260525010000"
down_revision: Union[str, None] = "20260525000000"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "expense_categories",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("company_id", sa.UUID(), nullable=False, index=True),
        sa.Column("nombre", sa.String(100), nullable=False),
        sa.Column("descripcion", sa.Text()),
        sa.Column("presupuesto_mensual", sa.Numeric(15, 2)),
        sa.Column("activo", sa.Boolean(), server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "expenses",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("company_id", sa.UUID(), nullable=False, index=True),
        sa.Column("branch_id", sa.UUID()),
        sa.Column("category_id", sa.UUID()),
        sa.Column("monto", sa.Numeric(15, 2), nullable=False),
        sa.Column("descripcion", sa.String(300), nullable=False),
        sa.Column("proveedor", sa.String(100)),
        sa.Column("comprobante_url", sa.String(500)),
        sa.Column("tipo_pago", sa.String(20)),
        sa.Column("fecha_gasto", sa.Date(), nullable=False, server_default=sa.func.current_date()),
        sa.Column("registrado_por", sa.UUID()),
        sa.Column("aprobado_por", sa.UUID()),
        sa.Column("estado", sa.String(20), server_default="pendiente"),
        sa.Column("notas", sa.Text()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_expenses_company_fecha", "expenses", ["company_id", "fecha_gasto"])
    op.create_index("ix_expenses_estado", "expenses", ["estado"])
    op.create_index("ix_expenses_branch", "expenses", ["branch_id"])


def downgrade() -> None:
    op.drop_table("expenses")
    op.drop_table("expense_categories")
