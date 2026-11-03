"""intelifact_configs: clave del servicio actual y punto de expedicion por sucursal

Revision ID: 20261103100000
Revises: 20261102100000
Create Date: 2026-11-03 10:00:00.000000

"""
from alembic import op

revision = "20261103100000"
down_revision = "20261102100000"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE intelifact_configs ADD COLUMN IF NOT EXISTS api_key TEXT")
    op.execute("ALTER TABLE intelifact_configs ADD COLUMN IF NOT EXISTS puntos_por_sucursal JSONB")
    op.execute("CREATE INDEX IF NOT EXISTS ix_sales_sifen_reintento ON sales (sifen_estado, fecha) "
               "WHERE sifen_estado IN ('pendiente', 'error_envio')")


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_sales_sifen_reintento")
    op.execute("ALTER TABLE intelifact_configs DROP COLUMN IF EXISTS puntos_por_sucursal")
    op.execute("ALTER TABLE intelifact_configs DROP COLUMN IF EXISTS api_key")
