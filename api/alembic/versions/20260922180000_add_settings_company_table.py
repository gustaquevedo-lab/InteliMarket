"""add settings_company table for per-company configuration

Revision ID: 20260922180000
Revises: 20260922170000
Create Date: 2026-09-22 18:00:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = "20260922180000"
down_revision: Union[str, None] = "20260922170000"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
        CREATE TABLE IF NOT EXISTS settings_company (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            company_id UUID NOT NULL,
            key VARCHAR(100) NOT NULL,
            value TEXT NOT NULL,
            created_at TIMESTAMPTZ DEFAULT now(),
            updated_at TIMESTAMPTZ DEFAULT now(),
            CONSTRAINT uq_settings_company_cid_key UNIQUE (company_id, key)
        )
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_settings_company_cid_key ON settings_company(company_id, key)
    """)


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS settings_company CASCADE;")
