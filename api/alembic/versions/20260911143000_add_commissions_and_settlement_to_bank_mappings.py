"""add_commissions_and_settlement_to_bank_mappings

Revision ID: 20260911143000
Revises: 20260910120000
Create Date: 2026-09-11 14:30:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '20260911143000'
down_revision: Union[str, None] = '20260910120000'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TABLE payment_method_bank_mappings ADD COLUMN IF NOT EXISTS comision_porcentaje NUMERIC(6, 4) DEFAULT 0.0000")
    op.execute("ALTER TABLE payment_method_bank_mappings ADD COLUMN IF NOT EXISTS comision_fija_gs NUMERIC(12, 0) DEFAULT 0")
    op.execute("ALTER TABLE payment_method_bank_mappings ADD COLUMN IF NOT EXISTS plazo_acreditacion_dias INTEGER DEFAULT 1")
    op.execute("ALTER TABLE payment_method_bank_mappings ADD COLUMN IF NOT EXISTS tipo_plazo VARCHAR(20) DEFAULT 'habiles'")


def downgrade() -> None:
    op.execute("ALTER TABLE payment_method_bank_mappings DROP COLUMN IF EXISTS comision_porcentaje")
    op.execute("ALTER TABLE payment_method_bank_mappings DROP COLUMN IF EXISTS comision_fija_gs")
    op.execute("ALTER TABLE payment_method_bank_mappings DROP COLUMN IF EXISTS plazo_acreditacion_dias")
    op.execute("ALTER TABLE payment_method_bank_mappings DROP COLUMN IF EXISTS tipo_plazo")
