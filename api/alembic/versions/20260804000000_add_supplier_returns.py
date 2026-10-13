"""add supplier_returns (devoluciones a proveedor — acredita el saldo, distinto
de una nota de credito recibida)

Revision ID: 20260804000000
Revises: 20260803000000
Create Date: 2026-08-04 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlalchemy.dialects.postgresql


revision: str = "20260804000000"
down_revision: Union[str, None] = "20260803000000"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "supplier_returns",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("company_id", sa.dialects.postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("supplier_id", sa.dialects.postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("numero_factura_origen", sa.String(50)),
        sa.Column("numero_nota_credito", sa.String(30)),
        sa.Column("timbrado", sa.String(30)),
        sa.Column("fecha", sa.Date, nullable=False),
        sa.Column("monto", sa.Numeric(15, 0), nullable=False),
        sa.Column("moneda", sa.String(3), server_default="PYG"),
        sa.Column("observaciones", sa.Text),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_supplier_returns_company_id", "supplier_returns", ["company_id"])
    op.create_index("ix_supplier_returns_supplier_id", "supplier_returns", ["supplier_id"])


def downgrade() -> None:
    op.drop_index("ix_supplier_returns_supplier_id", table_name="supplier_returns")
    op.drop_index("ix_supplier_returns_company_id", table_name="supplier_returns")
    op.drop_table("supplier_returns")
