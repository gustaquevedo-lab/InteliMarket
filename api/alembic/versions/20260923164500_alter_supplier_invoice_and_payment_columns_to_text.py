"""Alter supplier_invoices and supplier_invoice_payments columns to Text

Revision ID: 20260923164500
Revises: 20260923131500
Create Date: 2026-09-23 16:45:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = "20260923164500"
down_revision: Union[str, None] = "20260923131500"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
        DO $$
        BEGIN
            IF EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' AND table_name = 'supplier_invoice_payments'
            ) THEN
                ALTER TABLE public.supplier_invoice_payments ALTER COLUMN referencia TYPE TEXT;
                ALTER TABLE public.supplier_invoice_payments ALTER COLUMN comprobante_url TYPE TEXT;
            END IF;

            IF EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' AND table_name = 'supplier_invoices'
            ) THEN
                ALTER TABLE public.supplier_invoices ALTER COLUMN concepto TYPE TEXT;
            END IF;

            IF EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'sandbox' AND table_name = 'supplier_invoice_payments'
            ) THEN
                ALTER TABLE sandbox.supplier_invoice_payments ALTER COLUMN referencia TYPE TEXT;
                ALTER TABLE sandbox.supplier_invoice_payments ALTER COLUMN comprobante_url TYPE TEXT;
            END IF;

            IF EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'sandbox' AND table_name = 'supplier_invoices'
            ) THEN
                ALTER TABLE sandbox.supplier_invoices ALTER COLUMN concepto TYPE TEXT;
            END IF;
        END $$;
    """)


def downgrade() -> None:
    pass
