"""widen purchase_order estado columns

Revision ID: 20261118084000
Revises: 20261114130000
Create Date: 2026-11-18 08:40:00.000000
"""
from typing import Sequence, Union
from alembic import op

revision: str = '20261118084000'
down_revision: Union[str, None] = '20261114130000'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
        DO $$
        BEGIN
            -- 1. purchase_orders.estado -> VARCHAR(50)
            IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'purchase_orders') THEN
                ALTER TABLE purchase_orders ALTER COLUMN estado TYPE VARCHAR(50);
            END IF;

            -- 2. purchase_order_history.estado_anterior y estado_nuevo -> VARCHAR(50)
            IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'purchase_order_history') THEN
                ALTER TABLE purchase_order_history ALTER COLUMN estado_anterior TYPE VARCHAR(50);
                ALTER TABLE purchase_order_history ALTER COLUMN estado_nuevo TYPE VARCHAR(50);
            END IF;
        END $$;
    """)


def downgrade() -> None:
    op.execute("""
        DO $$
        BEGIN
            IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'purchase_orders') THEN
                ALTER TABLE purchase_orders ALTER COLUMN estado TYPE VARCHAR(20);
            END IF;
            IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'purchase_order_history') THEN
                ALTER TABLE purchase_order_history ALTER COLUMN estado_anterior TYPE VARCHAR(30);
                ALTER TABLE purchase_order_history ALTER COLUMN estado_nuevo TYPE VARCHAR(30);
            END IF;
        END $$;
    """)
