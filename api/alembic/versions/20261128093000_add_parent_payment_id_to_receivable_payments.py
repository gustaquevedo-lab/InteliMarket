"""add parent_payment_id to receivable_payments

Revision ID: 20261128093000
Revises: 20261118084000
Create Date: 2026-11-28 09:30:00.000000
"""
from typing import Sequence, Union
from alembic import op

revision: str = '20261128093000'
down_revision: Union[str, None] = '20261118084000'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
        DO $$
        BEGIN
            IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'receivable_payments') THEN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name = 'receivable_payments' AND column_name = 'parent_payment_id'
                ) THEN
                    ALTER TABLE receivable_payments
                        ADD COLUMN parent_payment_id UUID REFERENCES receivable_payments(id) ON DELETE CASCADE;
                    CREATE INDEX IF NOT EXISTS ix_receivable_payments_parent ON receivable_payments(parent_payment_id);
                END IF;
            END IF;
        END $$;
    """)


def downgrade() -> None:
    op.execute("""
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'receivable_payments' AND column_name = 'parent_payment_id'
            ) THEN
                DROP INDEX IF EXISTS ix_receivable_payments_parent;
                ALTER TABLE receivable_payments DROP COLUMN parent_payment_id;
            END IF;
        END $$;
    """)
