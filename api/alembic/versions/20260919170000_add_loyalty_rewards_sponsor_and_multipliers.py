"""add_loyalty_rewards_sponsor_and_multipliers

Revision ID: 20260919170000
Revises: 20260919130000
Create Date: 2026-09-19 17:00:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = '20260919170000'
down_revision: Union[str, None] = '20260919130000'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Multiplicadores y promociones en loyalty_config
    op.execute("""
        ALTER TABLE loyalty_config
        ADD COLUMN IF NOT EXISTS multiplicador_bronce NUMERIC(3, 2) DEFAULT 1.00 NOT NULL,
        ADD COLUMN IF NOT EXISTS multiplicador_plata NUMERIC(3, 2) DEFAULT 1.20 NOT NULL,
        ADD COLUMN IF NOT EXISTS multiplicador_oro NUMERIC(3, 2) DEFAULT 1.50 NOT NULL,
        ADD COLUMN IF NOT EXISTS multiplicador_vip NUMERIC(3, 2) DEFAULT 2.00 NOT NULL,
        ADD COLUMN IF NOT EXISTS promocion_activa BOOLEAN DEFAULT FALSE NOT NULL,
        ADD COLUMN IF NOT EXISTS promocion_nombre VARCHAR(100) NULL,
        ADD COLUMN IF NOT EXISTS multiplicador_promocional NUMERIC(3, 2) DEFAULT 1.00 NOT NULL;
    """)

    # 2. Patrocinador, producto de catálogo y depósito en loyalty_rewards
    op.execute("""
        ALTER TABLE loyalty_rewards
        ADD COLUMN IF NOT EXISTS supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES products(id) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS warehouse_id UUID REFERENCES warehouses(id) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS patrocinador_nombre VARCHAR(255) NULL,
        ADD COLUMN IF NOT EXISTS aporte_tipo VARCHAR(50) DEFAULT 'donacion_100',
        ADD COLUMN IF NOT EXISTS unidades_pactadas INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS costo_referencial NUMERIC(15, 0) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS notas TEXT NULL;
    """)

    op.execute("CREATE INDEX IF NOT EXISTS ix_loyalty_rewards_supplier_id ON loyalty_rewards (supplier_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_loyalty_rewards_product_id ON loyalty_rewards (product_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_loyalty_rewards_warehouse_id ON loyalty_rewards (warehouse_id)")

    # 3. Tabla de auditoría y canjes de premios
    op.execute("""
        CREATE TABLE IF NOT EXISTS loyalty_redemptions (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            company_id UUID NOT NULL,
            customer_id UUID NOT NULL,
            reward_id UUID NOT NULL REFERENCES loyalty_rewards(id) ON DELETE CASCADE,
            warehouse_id UUID REFERENCES warehouses(id) ON DELETE SET NULL,
            supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
            puntos_canjeados INTEGER NOT NULL,
            cantidad INTEGER DEFAULT 1 NOT NULL,
            comprobante_numero VARCHAR(50) NULL,
            entregado_por VARCHAR(100) NULL,
            notas TEXT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
    """)

    op.execute("CREATE INDEX IF NOT EXISTS ix_loyalty_redemptions_company ON loyalty_redemptions (company_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_loyalty_redemptions_customer ON loyalty_redemptions (customer_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_loyalty_redemptions_reward ON loyalty_redemptions (reward_id)")


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS loyalty_redemptions;")
    op.execute("""
        ALTER TABLE loyalty_rewards
        DROP COLUMN IF EXISTS notas,
        DROP COLUMN IF EXISTS costo_referencial,
        DROP COLUMN IF EXISTS unidades_pactadas,
        DROP COLUMN IF EXISTS aporte_tipo,
        DROP COLUMN IF EXISTS patrocinador_nombre,
        DROP COLUMN IF EXISTS warehouse_id,
        DROP COLUMN IF EXISTS product_id,
        DROP COLUMN IF EXISTS supplier_id;
    """)
    op.execute("""
        ALTER TABLE loyalty_config
        DROP COLUMN IF EXISTS multiplicador_promocional,
        DROP COLUMN IF EXISTS promocion_nombre,
        DROP COLUMN IF EXISTS promocion_activa,
        DROP COLUMN IF EXISTS multiplicador_vip,
        DROP COLUMN IF EXISTS multiplicador_oro,
        DROP COLUMN IF EXISTS multiplicador_plata,
        DROP COLUMN IF EXISTS multiplicador_bronce;
    """)
