"""canonical bank architecture and cutoff 30-09-2026

Revision ID: 20261118153000
Revises: 20261118084000
Create Date: 2026-11-18 15:30:00.000000
"""
from typing import Sequence, Union
from alembic import op

revision: str = '20261118153000'
down_revision: Union[str, None] = '20261118084000'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Agregar columna fecha_corte_saldo_inicial a bank_accounts
    op.execute("""
        ALTER TABLE bank_accounts 
        ADD COLUMN IF NOT EXISTS fecha_corte_saldo_inicial DATE DEFAULT '2026-09-30'
    """)

    # 2. Actualizar saldo_inicial auditado al 30 de septiembre de 2026
    op.execute("UPDATE bank_accounts SET saldo_inicial = 4570880.00, fecha_corte_saldo_inicial = '2026-09-30' WHERE numero_cuenta = '382364779308'")
    op.execute("UPDATE bank_accounts SET saldo_inicial = 8497854.00, fecha_corte_saldo_inicial = '2026-09-30' WHERE numero_cuenta = '38250039706001'")
    op.execute("UPDATE bank_accounts SET saldo_inicial = 8772272.00, fecha_corte_saldo_inicial = '2026-09-30' WHERE numero_cuenta = '38250039706208'")
    op.execute("UPDATE bank_accounts SET saldo_inicial = 505978.00, fecha_corte_saldo_inicial = '2026-09-30' WHERE numero_cuenta = '259058910'")
    op.execute("UPDATE bank_accounts SET saldo_inicial = 31987135.00, fecha_corte_saldo_inicial = '2026-09-30' WHERE numero_cuenta = '259026699'")

    # 3. Depurar proyecciones ficticias de ventas_pos en bank_transactions (no son movimientos bancarios)
    op.execute("DELETE FROM bank_transactions WHERE categoria = 'ventas_pos' AND conciliado = false")

    # 4. Depurar batch manual consolidado duplicado en Interfisa Ahorro
    op.execute("DELETE FROM bank_transactions WHERE id = '183ba516-e877-45ba-afb8-8d8d9e249ab0'")

    # 5. Depurar solapamiento de extracto del 30 y 31 de octubre re-importado en noviembre en Interfisa Ahorro
    op.execute("""
        DELETE FROM bank_transactions 
        WHERE bank_account_id = (SELECT id FROM bank_accounts WHERE numero_cuenta = '259026699' LIMIT 1)
          AND fecha IN ('2026-10-30', '2026-10-31')
          AND categoria = 'pendiente_conciliacion'
    """)

    # 6. Candado DDL: Trigger que impide insertar o mutar categoria = 'ventas_pos' en bank_transactions
    op.execute("""
        CREATE OR REPLACE FUNCTION trg_prevent_ventas_pos_bank_transactions()
        RETURNS TRIGGER AS $$
        BEGIN
            IF NEW.categoria = 'ventas_pos' THEN
                RAISE EXCEPTION 'CANONICAL VIOLATION: Las ventas de caja/POS no son transacciones bancarias y no pueden insertarse en bank_transactions.';
            END IF;
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql
    """)

    op.execute("DROP TRIGGER IF EXISTS trg_no_ventas_pos ON bank_transactions")
    op.execute("""
        CREATE TRIGGER trg_no_ventas_pos
        BEFORE INSERT OR UPDATE ON bank_transactions
        FOR EACH ROW
        EXECUTE FUNCTION trg_prevent_ventas_pos_bank_transactions()
    """)


def downgrade() -> None:
    op.execute("DROP TRIGGER IF EXISTS trg_no_ventas_pos ON bank_transactions")
    op.execute("DROP FUNCTION IF EXISTS trg_prevent_ventas_pos_bank_transactions()")
    op.execute("ALTER TABLE bank_accounts DROP COLUMN IF EXISTS fecha_corte_saldo_inicial")
