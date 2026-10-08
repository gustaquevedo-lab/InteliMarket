"""add_supplier_payment_agreements

Revision ID: 20261008100000
Revises: 20261007180000
Create Date: 2026-10-08 10:00:00.000000

Agrega columnas para acuerdos de pago comerciales en la tabla suppliers:
- plazo_credito_factura_dias (INTEGER)
- plazo_credito_cheque_dias (INTEGER)
- formas_pago_acordadas (TEXT[])
- acuerdo_pago_tipo (VARCHAR(50))
- acuerdo_pago_notas (TEXT)
"""
from typing import Sequence, Union
from alembic import op


revision: str = '20261008100000'
down_revision: Union[str, None] = '20261007180000'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Esquema public (Producción)
    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name='suppliers' AND column_name='plazo_credito_factura_dias'
            ) THEN
                ALTER TABLE suppliers ADD COLUMN plazo_credito_factura_dias INTEGER DEFAULT 0;
            END IF;

            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name='suppliers' AND column_name='plazo_credito_cheque_dias'
            ) THEN
                ALTER TABLE suppliers ADD COLUMN plazo_credito_cheque_dias INTEGER DEFAULT 0;
            END IF;

            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name='suppliers' AND column_name='formas_pago_acordadas'
            ) THEN
                ALTER TABLE suppliers ADD COLUMN formas_pago_acordadas TEXT[] DEFAULT '{}'::text[];
            END IF;

            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name='suppliers' AND column_name='acuerdo_pago_tipo'
            ) THEN
                ALTER TABLE suppliers ADD COLUMN acuerdo_pago_tipo VARCHAR(50) DEFAULT 'contado';
            END IF;

            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name='suppliers' AND column_name='acuerdo_pago_notas'
            ) THEN
                ALTER TABLE suppliers ADD COLUMN acuerdo_pago_notas TEXT;
            END IF;

            -- Sincronizar datos históricos: Si plazo_pago_dias > 0 y plazo_credito_factura_dias está en 0, sembrar valor
            UPDATE suppliers 
            SET plazo_credito_factura_dias = plazo_pago_dias,
                acuerdo_pago_tipo = 'credito_factura'
            WHERE (plazo_credito_factura_dias IS NULL OR plazo_credito_factura_dias = 0)
              AND plazo_pago_dias > 0;
        END $$;
    """)

    # 2. Esquema sandbox si existe
    op.execute("""
        DO $$
        BEGIN
            IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'sandbox') THEN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_schema='sandbox' AND table_name='suppliers' AND column_name='plazo_credito_factura_dias'
                ) THEN
                    ALTER TABLE sandbox.suppliers ADD COLUMN plazo_credito_factura_dias INTEGER DEFAULT 0;
                END IF;

                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_schema='sandbox' AND table_name='suppliers' AND column_name='plazo_credito_cheque_dias'
                ) THEN
                    ALTER TABLE sandbox.suppliers ADD COLUMN plazo_credito_cheque_dias INTEGER DEFAULT 0;
                END IF;

                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_schema='sandbox' AND table_name='suppliers' AND column_name='formas_pago_acordadas'
                ) THEN
                    ALTER TABLE sandbox.suppliers ADD COLUMN formas_pago_acordadas TEXT[] DEFAULT '{}'::text[];
                END IF;

                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_schema='sandbox' AND table_name='suppliers' AND column_name='acuerdo_pago_tipo'
                ) THEN
                    ALTER TABLE sandbox.suppliers ADD COLUMN acuerdo_pago_tipo VARCHAR(50) DEFAULT 'contado';
                END IF;

                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_schema='sandbox' AND table_name='suppliers' AND column_name='acuerdo_pago_notas'
                ) THEN
                    ALTER TABLE sandbox.suppliers ADD COLUMN acuerdo_pago_notas TEXT;
                END IF;

                UPDATE sandbox.suppliers 
                SET plazo_credito_factura_dias = plazo_pago_dias,
                    acuerdo_pago_tipo = 'credito_factura'
                WHERE (plazo_credito_factura_dias IS NULL OR plazo_credito_factura_dias = 0)
                  AND plazo_pago_dias > 0;
            END IF;
        END $$;
    """)


def downgrade() -> None:
    op.execute("""
        ALTER TABLE suppliers DROP COLUMN IF EXISTS plazo_credito_factura_dias;
        ALTER TABLE suppliers DROP COLUMN IF EXISTS plazo_credito_cheque_dias;
        ALTER TABLE suppliers DROP COLUMN IF EXISTS formas_pago_acordadas;
        ALTER TABLE suppliers DROP COLUMN IF EXISTS acuerdo_pago_tipo;
        ALTER TABLE suppliers DROP COLUMN IF EXISTS acuerdo_pago_notas;
    """)
