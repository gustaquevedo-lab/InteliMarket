"""add_api_keys

Revision ID: dc217bbb50fc
Revises: c603f2f8ab8b
Create Date: 2026-05-06 06:34:58.289019
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'dc217bbb50fc'
down_revision: Union[str, None] = 'c603f2f8ab8b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "api_keys",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True), server_default=sa.func.gen_random_uuid(), primary_key=True),
        sa.Column("company_id", sa.dialects.postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("key_hash", sa.String(255), nullable=False, unique=True),
        sa.Column("prefix", sa.String(20), nullable=False),
        sa.Column("label", sa.String(200)),
        sa.Column("activo", sa.Boolean(), server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("last_used_at", sa.DateTime(timezone=True)),
    )
    op.create_index("ix_api_keys_company_id", "api_keys", ["company_id"])


def downgrade() -> None:
    op.drop_index("ix_api_keys_company_id", table_name="api_keys")
    op.drop_table("api_keys")
