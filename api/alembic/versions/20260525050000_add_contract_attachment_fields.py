"""add commercial_agreements table and attachment fields

Revision ID: 20260525050000
Revises: 20260525040000
Create Date: 2026-05-25 05:00:00.000000
"""
from typing import Sequence, Union
from uuid import uuid4

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision: str = "20260525050000"
down_revision: Union[str, None] = "20260525040000"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
        CREATE TABLE IF NOT EXISTS commercial_agreements (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id UUID NOT NULL REFERENCES tenants(id),
            proveedor_id UUID NOT NULL,
            tipo VARCHAR(30) NOT NULL DEFAULT 'compra',
            estado VARCHAR(20) NOT NULL DEFAULT 'borrador',
            fecha_inicio DATE,
            fecha_fin DATE,
            condiciones TEXT,
            archivo_url TEXT,
            renovacion_automatica BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMPTZ DEFAULT now(),
            updated_at TIMESTAMPTZ DEFAULT now()
        )
    """)
    op.execute("ALTER TABLE commercial_agreements ADD COLUMN IF NOT EXISTS archivo_url TEXT")
    op.execute("ALTER TABLE commercial_agreements ADD COLUMN IF NOT EXISTS renovacion_automatica BOOLEAN DEFAULT FALSE")


def downgrade() -> None:
    op.drop_column("commercial_agreements", "archivo_url")
    op.drop_column("commercial_agreements", "renovacion_automatica")
