"""add_notas_credito_to_supplier_returns

Revision ID: 20260928170000
Revises: 20260925190000
Create Date: 2026-09-28 17:00:00.000000

Agrega columna notas_credito (JSONB) a supermer_supplier_returns para soportar
1 o múltiples Notas de Crédito emitidas por el proveedor con sus detalles
(número, timbrado, fecha, monto, factura afectada, observaciones).
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = '20260928170000'
down_revision: Union[str, None] = '20260925190000'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
        ALTER TABLE supermer_supplier_returns
        ADD COLUMN IF NOT EXISTS notas_credito JSONB DEFAULT '[]'::jsonb;

        ALTER TABLE supermer_supplier_returns
        ALTER COLUMN nota_credito_numero TYPE VARCHAR(255);

        ALTER TABLE supplier_returns
        ALTER COLUMN numero_nota_credito TYPE VARCHAR(255);

        ALTER TABLE supplier_returns
        ALTER COLUMN numero_factura_origen TYPE VARCHAR(255);
    """)


def downgrade() -> None:
    op.execute("""
        ALTER TABLE supermer_supplier_returns
        DROP COLUMN IF EXISTS notas_credito;
    """)
