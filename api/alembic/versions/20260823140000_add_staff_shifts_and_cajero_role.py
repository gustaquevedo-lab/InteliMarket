"""add_staff_shifts_and_cajero_role

Revision ID: 20260823140000
Revises: 20260813100000
Create Date: 2026-08-23 14:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '20260823140000'
down_revision: Union[str, None] = '20260813100000'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "staff_shifts",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True), server_default=sa.func.gen_random_uuid(), primary_key=True),
        sa.Column("user_id", sa.dialects.postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("rol_en_turno", sa.String(30), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("ended_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_staff_shifts_user_id", "staff_shifts", ["user_id"])

    # "vendedor" -> "cajero": mismo rol operativo, nuevo nombre para que
    # coincida con el selector de login del POS y con lo que la empresa
    # llama en la práctica a quien atiende una caja.
    op.execute("UPDATE users SET rol = 'cajero' WHERE rol = 'vendedor'")
    op.execute("UPDATE user_tenants SET rol = 'cajero' WHERE rol = 'vendedor'")


def downgrade() -> None:
    op.execute("UPDATE users SET rol = 'vendedor' WHERE rol = 'cajero'")
    op.execute("UPDATE user_tenants SET rol = 'vendedor' WHERE rol = 'cajero'")
    op.drop_index("ix_staff_shifts_user_id", table_name="staff_shifts")
    op.drop_table("staff_shifts")
