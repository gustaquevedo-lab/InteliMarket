"""add_scale_reconcile_tables

Revision ID: 20261007180000
Revises: 20261007100000
Create Date: 2026-10-07 18:00:00.000000

Estado de lo ultimo transmitido a cada balanza (por PLU) y estado de salud por balanza,
para que scripts/reconcile_balanzas.py converja solo (reintenta si la balanza estaba apagada).
Solo las usa ese script (SQL directo, sin modelo ORM).
"""
from typing import Sequence, Union
from alembic import op


revision: str = '20261007180000'
down_revision: Union[str, None] = '20261007100000'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _tablas(prefix: str) -> list[str]:
    return [
        f"""
        CREATE TABLE IF NOT EXISTS {prefix}scale_plu_state (
            scale_id UUID NOT NULL,
            plu INTEGER NOT NULL,
            product_id UUID,
            precio NUMERIC(15, 2) NOT NULL,
            nombre VARCHAR(255) NOT NULL,
            pushed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            PRIMARY KEY (scale_id, plu)
        )
        """,
        f"""
        CREATE TABLE IF NOT EXISTS {prefix}scale_sync_status (
            scale_id UUID PRIMARY KEY,
            last_ok_at TIMESTAMP WITH TIME ZONE,
            last_error TEXT,
            last_error_at TIMESTAMP WITH TIME ZONE,
            pendiente_completo BOOLEAN NOT NULL DEFAULT FALSE
        )
        """,
    ]


def upgrade() -> None:
    for ddl in _tablas(""):
        op.execute(ddl)
    sandbox_ddl = ";\n".join(d.strip() for d in _tablas("sandbox."))
    op.execute(
        "DO $$ BEGIN "
        "IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'sandbox') THEN "
        + sandbox_ddl + "; "
        "END IF; END $$"
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS scale_plu_state")
    op.execute("DROP TABLE IF EXISTS scale_sync_status")
