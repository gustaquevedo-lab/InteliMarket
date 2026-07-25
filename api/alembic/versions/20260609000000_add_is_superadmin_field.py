"""add is_superadmin field to users table

Revision ID: 20260609000000
Revises: 20260608000000
Create Date: 2026-06-09 12:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

revision = "20260609000000"
down_revision = "20260608000000"
branch_labels = None
depends_on = None


def upgrade():
    # a1b2c3d4e5f6_add_rbac.py (otra rama de trabajo, ya fusionada en esta cadena)
    # agrega esta misma columna — guard idempotente para que esta migración no
    # falle si ya existe.
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_columns = {c["name"] for c in inspector.get_columns("users")}
    if "is_superadmin" not in existing_columns:
        op.add_column(
            "users",
            sa.Column("is_superadmin", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        )
    op.execute("UPDATE users SET is_superadmin = true WHERE rol = 'super_admin'")


def downgrade():
    op.drop_column("users", "is_superadmin")
