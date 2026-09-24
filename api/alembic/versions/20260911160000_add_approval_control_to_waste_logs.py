"""add_approval_control_to_waste_logs

Revision ID: 20260911160000
Revises: 20260911143000
Create Date: 2026-09-11 16:00:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '20260911160000'
down_revision: Union[str, None] = '20260911143000'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TABLE supermer_waste_logs ADD COLUMN IF NOT EXISTS warehouse_id UUID REFERENCES warehouses(id)")
    op.execute("ALTER TABLE supermer_waste_logs ADD COLUMN IF NOT EXISTS estado VARCHAR(20) NOT NULL DEFAULT 'pendiente'")
    op.execute("ALTER TABLE supermer_waste_logs ADD COLUMN IF NOT EXISTS aprobado_por UUID REFERENCES users(id)")
    op.execute("ALTER TABLE supermer_waste_logs ADD COLUMN IF NOT EXISTS aprobado_at TIMESTAMPTZ")
    op.execute("ALTER TABLE supermer_waste_logs ADD COLUMN IF NOT EXISTS motivo_rechazo TEXT")
    op.execute("ALTER TABLE supermer_waste_logs ADD COLUMN IF NOT EXISTS movimiento_id UUID REFERENCES inventory_movements(id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_supermer_waste_estado ON supermer_waste_logs (company_id, estado)")


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_supermer_waste_estado")
    op.execute("ALTER TABLE supermer_waste_logs DROP COLUMN IF EXISTS movimiento_id")
    op.execute("ALTER TABLE supermer_waste_logs DROP COLUMN IF EXISTS motivo_rechazo")
    op.execute("ALTER TABLE supermer_waste_logs DROP COLUMN IF EXISTS aprobado_at")
    op.execute("ALTER TABLE supermer_waste_logs DROP COLUMN IF EXISTS aprobado_por")
    op.execute("ALTER TABLE supermer_waste_logs DROP COLUMN IF EXISTS estado")
    op.execute("ALTER TABLE supermer_waste_logs DROP COLUMN IF EXISTS warehouse_id")
