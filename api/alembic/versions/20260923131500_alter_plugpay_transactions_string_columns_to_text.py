"""Alter plugpay_transactions columns to Text and expand varchar lengths

Revision ID: 20260923131500
Revises: 20260923120000
Create Date: 2026-09-23 13:15:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = "20260923131500"
down_revision: Union[str, None] = "20260923120000"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
        DO $$
        BEGIN
            IF EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' AND table_name = 'plugpay_transactions'
            ) THEN
                ALTER TABLE public.plugpay_transactions ALTER COLUMN qr_code_string_image TYPE TEXT;
                ALTER TABLE public.plugpay_transactions ALTER COLUMN url_payment_form TYPE TEXT;
                ALTER TABLE public.plugpay_transactions ALTER COLUMN error_message TYPE TEXT;
                ALTER TABLE public.plugpay_transactions ALTER COLUMN id_transacao TYPE VARCHAR(100);
                ALTER TABLE public.plugpay_transactions ALTER COLUMN referencia_interna TYPE VARCHAR(150);
                ALTER TABLE public.plugpay_transactions ALTER COLUMN qr_code_id TYPE VARCHAR(150);
            END IF;

            IF EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'sandbox' AND table_name = 'plugpay_transactions'
            ) THEN
                ALTER TABLE sandbox.plugpay_transactions ALTER COLUMN qr_code_string_image TYPE TEXT;
                ALTER TABLE sandbox.plugpay_transactions ALTER COLUMN url_payment_form TYPE TEXT;
                ALTER TABLE sandbox.plugpay_transactions ALTER COLUMN error_message TYPE TEXT;
                ALTER TABLE sandbox.plugpay_transactions ALTER COLUMN id_transacao TYPE VARCHAR(100);
                ALTER TABLE sandbox.plugpay_transactions ALTER COLUMN referencia_interna TYPE VARCHAR(150);
                ALTER TABLE sandbox.plugpay_transactions ALTER COLUMN qr_code_id TYPE VARCHAR(150);
            END IF;
        END $$;
    """)


def downgrade() -> None:
    pass
