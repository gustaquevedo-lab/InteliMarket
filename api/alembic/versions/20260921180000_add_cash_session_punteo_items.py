"""Add cash_session_punteo_items table for voucher auditing

Revision ID: 20260921180000
Revises: 20260921150000
Create Date: 2026-09-21 18:00:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = '20260921180000'
down_revision: Union[str, None] = '20260921150000'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
    CREATE TABLE IF NOT EXISTS cash_session_punteo_items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id UUID NOT NULL,
        session_id UUID NOT NULL REFERENCES cash_sessions(id) ON DELETE CASCADE,
        voucher_id VARCHAR(100) NOT NULL,
        estado VARCHAR(20) NOT NULL DEFAULT 'conforme',
        monto_sistema NUMERIC(15, 0) NOT NULL DEFAULT 0,
        monto_fisico NUMERIC(15, 0) NOT NULL DEFAULT 0,
        diferencia_gs NUMERIC(15, 0) NOT NULL DEFAULT 0,
        observacion TEXT,
        auditor_nombre VARCHAR(100),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_cash_punteo_session_id ON cash_session_punteo_items(session_id);")
    op.execute("CREATE INDEX IF NOT EXISTS ix_cash_punteo_voucher_id ON cash_session_punteo_items(voucher_id);")
    op.execute("CREATE INDEX IF NOT EXISTS ix_cash_punteo_company_id ON cash_session_punteo_items(company_id);")
    op.execute("CREATE UNIQUE INDEX IF NOT EXISTS uq_cash_punteo_session_voucher ON cash_session_punteo_items(session_id, voucher_id);")


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS cash_session_punteo_items CASCADE;")
