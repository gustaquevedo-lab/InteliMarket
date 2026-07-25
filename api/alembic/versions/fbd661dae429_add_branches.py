"""add_branches

Revision ID: fbd661dae429
Revises: 1718a78d035b
Create Date: 2026-05-05 10:03:13.763163
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'fbd661dae429'
down_revision: Union[str, None] = '1718a78d035b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "branches",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True), server_default=sa.func.gen_random_uuid(), primary_key=True),
        sa.Column("company_id", sa.dialects.postgresql.UUID(as_uuid=True), sa.ForeignKey("companies.id"), nullable=False),
        sa.Column("codigo", sa.String(20), nullable=False, unique=True),
        sa.Column("nombre", sa.String(200), nullable=False),
        sa.Column("direccion", sa.String(500)),
        sa.Column("ciudad", sa.String(100)),
        sa.Column("departamento", sa.String(100)),
        sa.Column("telefono", sa.String(20)),
        sa.Column("email", sa.String(200)),
        sa.Column("ruc", sa.String(20)),
        sa.Column("punto_emision", sa.Integer(), server_default="1"),
        sa.Column("activo", sa.Boolean(), server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
    )
    op.create_index("ix_branches_company_id", "branches", ["company_id"])


def downgrade() -> None:
    op.drop_index("ix_branches_company_id", table_name="branches")
    op.drop_table("branches")
