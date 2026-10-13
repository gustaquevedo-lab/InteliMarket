"""purge_brl_bank_accounts

Revision ID: 20260917000000
Revises: 20260914000000
Create Date: 2026-09-17 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '20260917000000'
down_revision = '20260914000000'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # En Paraguay no existen cuentas bancarias en BRL (Reales).
    # Las divisas BRL se operan exclusivamente en efectivo físico en caja/bóveda.
    # Desvinculamos mappings de canales de pago y mapeos de legacy, y eliminamos transacciones huérfanas y cuentas BRL.
    op.execute("""
        UPDATE payment_method_bank_mappings 
        SET bank_account_id = NULL 
        WHERE bank_account_id IN (
            SELECT id FROM bank_accounts WHERE moneda = 'BRL'
        );
    """)
    op.execute("""
        DELETE FROM nemuha_record_map 
        WHERE target_id IN (
            SELECT id FROM bank_accounts WHERE moneda = 'BRL'
        );
    """)
    op.execute("""
        DELETE FROM bank_transactions 
        WHERE bank_account_id IN (
            SELECT id FROM bank_accounts WHERE moneda = 'BRL'
        );
    """)
    op.execute("DELETE FROM bank_accounts WHERE moneda = 'BRL';")


def downgrade() -> None:
    pass
