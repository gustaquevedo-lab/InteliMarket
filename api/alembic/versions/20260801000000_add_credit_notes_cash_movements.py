"""add supplier_credit_notes and cash_register_movements

Revision ID: 20260801000000
Revises: 20260731000000
Create Date: 2026-08-01 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20260801000000"
down_revision: Union[str, None] = "20260731000000"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "supplier_credit_notes",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.func.gen_random_uuid()),
        sa.Column("company_id", sa.dialects.postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("supplier_id", sa.dialects.postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("numero", sa.String(30), nullable=False),
        sa.Column("numero_factura_origen", sa.String(50)),
        sa.Column("timbrado", sa.String(30)),
        sa.Column("fecha", sa.Date(), nullable=False),
        sa.Column("motivo", sa.String(150)),
        sa.Column("monto", sa.Numeric(15, 0), nullable=False),
        sa.Column("moneda", sa.String(3), server_default="PYG"),
        sa.Column("observaciones", sa.Text()),
        sa.Column("cancelado", sa.Boolean(), server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_supplier_credit_notes_company_id", "supplier_credit_notes", ["company_id"])
    op.create_index("ix_supplier_credit_notes_supplier_id", "supplier_credit_notes", ["supplier_id"])

    op.create_table(
        "cash_register_movements",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.func.gen_random_uuid()),
        sa.Column("company_id", sa.dialects.postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("register_id", sa.dialects.postgresql.UUID(as_uuid=True), sa.ForeignKey("cash_registers.id"), nullable=False),
        sa.Column("tipo", sa.String(20), nullable=False),
        sa.Column("monto", sa.Numeric(15, 0), nullable=False),
        sa.Column("moneda", sa.String(3), server_default="PYG"),
        sa.Column("fecha", sa.DateTime(timezone=True), nullable=False),
        sa.Column("usuario", sa.String(60)),
        sa.Column("observaciones", sa.Text()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_cash_register_movements_company_id", "cash_register_movements", ["company_id"])
    op.create_index("ix_cash_register_movements_register_id", "cash_register_movements", ["register_id"])


def downgrade() -> None:
    op.drop_index("ix_cash_register_movements_register_id", table_name="cash_register_movements")
    op.drop_index("ix_cash_register_movements_company_id", table_name="cash_register_movements")
    op.drop_table("cash_register_movements")

    op.drop_index("ix_supplier_credit_notes_supplier_id", table_name="supplier_credit_notes")
    op.drop_index("ix_supplier_credit_notes_company_id", table_name="supplier_credit_notes")
    op.drop_table("supplier_credit_notes")
