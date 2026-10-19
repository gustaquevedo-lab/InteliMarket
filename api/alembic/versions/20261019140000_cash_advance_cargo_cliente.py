"""cargo al cliente en adelantos de efectivo (comision que cobra el terminal y que es de la procesadora)

Revision ID: 20261019140000
Revises: 20261019120000
Create Date: 2026-10-19 14:00:00.000000

El terminal Dinelco le cobra al cliente una comision por el adelanto (probado el 19-oct-2026 con un POS de prueba:
Gs. 1.000 hasta Gs. 100.000, y 1 % desde ahi). Esa plata es de la procesadora, no del comercio: se guarda aparte
de la comision activa que la procesadora le paga al comercio.
"""
from typing import Sequence, Union
from alembic import op

revision: str = '20261019140000'
down_revision: Union[str, None] = '20261019120000'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
        ALTER TABLE payment_method_bank_mappings
            ADD COLUMN IF NOT EXISTS cargo_cliente_porcentaje NUMERIC(6, 4) NOT NULL DEFAULT 0,
            ADD COLUMN IF NOT EXISTS cargo_cliente_minimo_gs NUMERIC(12, 0) NOT NULL DEFAULT 0
    """)
    op.execute("ALTER TABLE cash_advances ADD COLUMN IF NOT EXISTS cargo_cliente_gs NUMERIC(15, 2) NOT NULL DEFAULT 0")
    # El canal de adelantos puede existir ya (se crea solo al abrir la pantalla de comisiones): cargarle lo medido.
    op.execute("""
        UPDATE payment_method_bank_mappings SET cargo_cliente_porcentaje = 1, cargo_cliente_minimo_gs = 1000
        WHERE canal_key = 'ADELANTO_DINELCO' AND cargo_cliente_porcentaje = 0 AND cargo_cliente_minimo_gs = 0
    """)
    op.execute("""
        DO $$
        BEGIN
            IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'sandbox' AND table_name = 'payment_method_bank_mappings') THEN
                ALTER TABLE sandbox.payment_method_bank_mappings
                    ADD COLUMN IF NOT EXISTS cargo_cliente_porcentaje NUMERIC(6, 4) NOT NULL DEFAULT 0,
                    ADD COLUMN IF NOT EXISTS cargo_cliente_minimo_gs NUMERIC(12, 0) NOT NULL DEFAULT 0;
            END IF;
            IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'sandbox' AND table_name = 'cash_advances') THEN
                ALTER TABLE sandbox.cash_advances ADD COLUMN IF NOT EXISTS cargo_cliente_gs NUMERIC(15, 2) NOT NULL DEFAULT 0;
            END IF;
        END $$;
    """)


def downgrade() -> None:
    op.execute("ALTER TABLE cash_advances DROP COLUMN IF EXISTS cargo_cliente_gs")
    op.execute("ALTER TABLE payment_method_bank_mappings DROP COLUMN IF EXISTS cargo_cliente_porcentaje, DROP COLUMN IF EXISTS cargo_cliente_minimo_gs")
