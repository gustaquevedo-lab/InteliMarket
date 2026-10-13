"""add warehouses to recipes and production orders

Revision ID: 20260923120000
Revises: 20260922180000
Create Date: 2026-09-23 12:00:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = "20260923120000"
down_revision: Union[str, None] = "20260922180000"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add columns to supermer_recipes
    op.execute("""
        ALTER TABLE supermer_recipes
        ADD COLUMN IF NOT EXISTS deposito_origen_id UUID REFERENCES warehouses(id) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS deposito_destino_id UUID REFERENCES warehouses(id) ON DELETE SET NULL;
    """)

    # Add columns to supermer_production_orders
    op.execute("""
        ALTER TABLE supermer_production_orders
        ADD COLUMN IF NOT EXISTS deposito_origen_id UUID REFERENCES warehouses(id) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS deposito_destino_id UUID REFERENCES warehouses(id) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS lote_codigo VARCHAR(50);
    """)


def downgrade() -> None:
    op.execute("""
        ALTER TABLE supermer_recipes
        DROP COLUMN IF EXISTS deposito_origen_id,
        DROP COLUMN IF EXISTS deposito_destino_id;

        ALTER TABLE supermer_production_orders
        DROP COLUMN IF EXISTS deposito_origen_id,
        DROP COLUMN IF EXISTS deposito_destino_id,
        DROP COLUMN IF EXISTS lote_codigo;
    """)
