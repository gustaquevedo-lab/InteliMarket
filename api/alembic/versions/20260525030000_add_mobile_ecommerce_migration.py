"""add mobile, ecommerce, and data_migration tables

Revision ID: 20260525030000
Revises: 20260525020000
Create Date: 2026-05-25 03:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "20260525030000"
down_revision: Union[str, None] = "20260525020000"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "ecommerce_sync_logs",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.func.gen_random_uuid(), primary_key=True),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("tipo", sa.String(20), nullable=False),
        sa.Column("estado", sa.String(20), nullable=False, server_default="pendiente"),
        sa.Column("productos_count", sa.Integer(), default=0),
        sa.Column("errores_count", sa.Integer(), default=0),
        sa.Column("resultado", sa.Text()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_table(
        "migration_logs",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.func.gen_random_uuid(), primary_key=True),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("tipo", sa.String(30), nullable=False),
        sa.Column("origen", sa.String(30), nullable=False),
        sa.Column("archivo_nombre", sa.String(255)),
        sa.Column("estado", sa.String(20), nullable=False, server_default="pendiente"),
        sa.Column("total_registros", sa.Integer(), default=0),
        sa.Column("importados", sa.Integer(), default=0),
        sa.Column("errores", sa.Integer(), default=0),
        sa.Column("errores_detalle", sa.Text()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("migration_logs")
    op.drop_table("ecommerce_sync_logs")

