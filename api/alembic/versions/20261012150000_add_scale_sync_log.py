"""add_scale_sync_log

Revision ID: 20261012150000
Revises: 20261012120000
Create Date: 2026-10-12 15:00:00.000000

Registro visible en /escalas de cada transmision a balanzas (scale_sync_log) y marca de ultimo
chequeo del vigilante por balanza (scale_sync_status.last_check_at). Las escribe el reconciliador
(api/src/integrations/scales/reconciler.py). Retencion: 30 dias (se purga al registrar).
"""
from typing import Sequence, Union
from alembic import op

revision: str = '20261012150000'
down_revision: Union[str, None] = '20261012120000'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _ddl(prefix: str) -> list[str]:
    return [
        f"""
        CREATE TABLE IF NOT EXISTS {prefix}scale_sync_log (
            id BIGSERIAL PRIMARY KEY,
            scale_id UUID NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            ultimo_intento TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            origen VARCHAR(30) NOT NULL,
            tipo VARCHAR(20) NOT NULL DEFAULT 'cambios',
            estado VARCHAR(10) NOT NULL,
            total INTEGER NOT NULL DEFAULT 0,
            repeticiones INTEGER NOT NULL DEFAULT 1,
            detalle JSONB,
            error TEXT
        )
        """,
        f"CREATE INDEX IF NOT EXISTS idx_scale_sync_log_scale ON {prefix}scale_sync_log (scale_id, id DESC)",
        f"CREATE INDEX IF NOT EXISTS idx_scale_sync_log_created ON {prefix}scale_sync_log (created_at)",
        f"ALTER TABLE {prefix}scale_sync_status ADD COLUMN IF NOT EXISTS last_check_at TIMESTAMP WITH TIME ZONE",
    ]


def upgrade() -> None:
    for ddl in _ddl(""):
        op.execute(ddl)
    sandbox = ";\n".join(d.strip() for d in _ddl("sandbox."))
    op.execute(
        "DO $$ BEGIN "
        "IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'sandbox') THEN "
        + sandbox + "; "
        "END IF; END $$"
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS scale_sync_log")
    op.execute("ALTER TABLE scale_sync_status DROP COLUMN IF EXISTS last_check_at")
