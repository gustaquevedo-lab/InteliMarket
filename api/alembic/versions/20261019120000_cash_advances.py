"""cash_advances: adelantos de efectivo contra tarjeta ("Cobrá tu salario") entregados desde la caja

Revision ID: 20261019120000
Revises: 20261017133000
Create Date: 2026-10-19 12:00:00.000000

- cash_advances: cada adelanto aprobado por el terminal Dinelco (o cargado a mano), atado a la
  sesion de caja de la cajera para que el efectivo esperado del cierre baje por lo entregado.
- payment_method_bank_mappings.comision_activa: la comision del canal la PAGA la procesadora al
  comercio (ingreso), en vez de ser una retencion (costo) como en los demas canales.
"""
from typing import Sequence, Union
from alembic import op

revision: str = '20261019120000'
down_revision: Union[str, None] = '20261017133000'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_TABLA = """
    CREATE TABLE IF NOT EXISTS {s}cash_advances (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id UUID NOT NULL,
        session_id UUID NOT NULL,
        user_id UUID,
        cajero_nombre VARCHAR(100),
        punto_emision VARCHAR(10),
        proveedor VARCHAR(20) NOT NULL DEFAULT 'dinelco',
        opcion SMALLINT,
        monto NUMERIC(15, 0) NOT NULL,
        origen VARCHAR(10) NOT NULL DEFAULT 'terminal',
        codigo_autorizacion VARCHAR(20),
        nro_referencia VARCHAR(20),
        issuer_id VARCHAR(5),
        nombre_tarjeta VARCHAR(100),
        pan_ultimos4 VARCHAR(4),
        terminal VARCHAR(20),
        terminal_ip VARCHAR(45),
        comision_gs NUMERIC(15, 2) NOT NULL DEFAULT 0,
        comision_activa BOOLEAN NOT NULL DEFAULT TRUE,
        comision_porcentaje NUMERIC(6, 4),
        comision_fija_gs NUMERIC(12, 0),
        sale_id UUID,
        supervisor_id UUID,
        supervisor_nombre VARCHAR(100),
        estado VARCHAR(12) NOT NULL DEFAULT 'aprobado',
        observaciones TEXT,
        raw_response JSONB,
        created_at TIMESTAMPTZ DEFAULT now()
    )
"""


def upgrade() -> None:
    # public
    op.execute(_TABLA.format(s="") .replace("session_id UUID NOT NULL,", "session_id UUID NOT NULL REFERENCES cash_sessions(id),"))
    op.execute("CREATE INDEX IF NOT EXISTS idx_cash_advances_session ON cash_advances(session_id)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_cash_advances_company ON cash_advances(company_id)")
    op.execute("ALTER TABLE payment_method_bank_mappings ADD COLUMN IF NOT EXISTS comision_activa BOOLEAN NOT NULL DEFAULT FALSE")

    # sandbox (si existe), sin FK para no depender de que tenga las mismas tablas
    op.execute("""
        DO $$
        BEGIN
            IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'sandbox') THEN
                CREATE TABLE IF NOT EXISTS sandbox.cash_advances (LIKE public.cash_advances INCLUDING DEFAULTS);
                IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'sandbox' AND table_name = 'payment_method_bank_mappings') THEN
                    ALTER TABLE sandbox.payment_method_bank_mappings ADD COLUMN IF NOT EXISTS comision_activa BOOLEAN NOT NULL DEFAULT FALSE;
                END IF;
            END IF;
        END $$;
    """)


def downgrade() -> None:
    op.execute("ALTER TABLE payment_method_bank_mappings DROP COLUMN IF EXISTS comision_activa")
    op.execute("DROP TABLE IF EXISTS cash_advances")
