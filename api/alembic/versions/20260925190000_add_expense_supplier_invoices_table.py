"""add_expense_supplier_invoices_table

Revision ID: 20260925190000
Revises: 20260925180000
Create Date: 2026-09-25 19:00:00

Tabla join para vincular múltiples facturas comerciales de proveedores
a un único comprobante de gasto (expense). Reemplaza la relación 1:1
supplier_invoice_id en la tabla expenses por una relación N:M.

El campo supplier_invoice_id en expenses se mantiene por compatibilidad
(apunta a la primera factura vinculada, si hay una sola).
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = '20260925190000'
down_revision: Union[str, None] = '20260925180000'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'expense_supplier_invoices',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('expense_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('expenses.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('supplier_invoice_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('supplier_invoices.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('monto_aplicado', sa.Numeric(15, 2), nullable=False, default=0),
        sa.Column('moneda', sa.String(3), nullable=False, server_default='PYG'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.UniqueConstraint('expense_id', 'supplier_invoice_id', name='uq_expense_supplier_invoice'),
    )


def downgrade() -> None:
    op.drop_table('expense_supplier_invoices')
