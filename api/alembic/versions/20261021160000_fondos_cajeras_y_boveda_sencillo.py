"""create cashier_fund_assignments, vault_petty_funds, and surprise_audits

Revision ID: 20261021160000
Revises: 20261020093000
Create Date: 2026-10-21 16:00:00.000000

- cashier_fund_assignments: fondos fijos de cambio asignados a cada cajera (₲ 500.000 + R$ 300)
- vault_petty_funds: fondo permanente de sencillo en bóveda central (₲ 3.800.000)
- vault_petty_fund_audits: historial de arqueos físicos de sencillo en bóveda central
- cash_surprise_audits: actas de arqueos sorpresa a cajeras en turnos abiertos sin cerrar caja
- ampliación de columnas origen y estado en vault_entries a VARCHAR(60) y VARCHAR(50)
"""
from typing import Sequence, Union
from alembic import op

revision: str = '20261021160000'
down_revision: Union[str, None] = '20261020093000'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Ampliación anti-truncamiento en vault_entries (Regla 12)
    op.execute("ALTER TABLE vault_entries ALTER COLUMN origen TYPE VARCHAR(60);")
    op.execute("ALTER TABLE vault_entries ALTER COLUMN estado TYPE VARCHAR(50);")

    # 2. Tabla de fondos asignados a cajeras
    op.execute("""
        CREATE TABLE IF NOT EXISTS cashier_fund_assignments (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            company_id UUID NOT NULL,
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            cajero_nombre VARCHAR(100) NOT NULL,
            monto_pyg NUMERIC(15, 0) NOT NULL DEFAULT 500000,
            monto_brl NUMERIC(12, 2) NOT NULL DEFAULT 300.00,
            monto_usd NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
            estado VARCHAR(30) NOT NULL DEFAULT 'activo',
            fecha_asignacion TIMESTAMPTZ DEFAULT clock_timestamp(),
            asignado_por UUID,
            observaciones TEXT,
            created_at TIMESTAMPTZ DEFAULT clock_timestamp(),
            updated_at TIMESTAMPTZ DEFAULT clock_timestamp(),
            CONSTRAINT uq_cashier_fund_company_user UNIQUE (company_id, user_id)
        );
    """)
    op.execute("CREATE INDEX IF NOT EXISTS idx_cfa_company ON cashier_fund_assignments(company_id);")
    op.execute("CREATE INDEX IF NOT EXISTS idx_cfa_user ON cashier_fund_assignments(user_id);")
    op.execute("CREATE INDEX IF NOT EXISTS idx_cfa_estado ON cashier_fund_assignments(estado);")

    # 3. Tabla de fondo permanente de sencillo en bóveda central
    op.execute("""
        CREATE TABLE IF NOT EXISTS vault_petty_funds (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            company_id UUID NOT NULL UNIQUE,
            nombre VARCHAR(100) NOT NULL DEFAULT 'Fondo Permanente de Sencillo Bóveda',
            monto_objetivo_pyg NUMERIC(15, 0) NOT NULL DEFAULT 3800000,
            saldo_actual_pyg NUMERIC(15, 0) NOT NULL DEFAULT 3800000,
            monto_objetivo_brl NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
            saldo_actual_brl NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
            activo BOOLEAN NOT NULL DEFAULT TRUE,
            created_at TIMESTAMPTZ DEFAULT clock_timestamp(),
            updated_at TIMESTAMPTZ DEFAULT clock_timestamp()
        );
    """)
    op.execute("CREATE INDEX IF NOT EXISTS idx_vpf_company ON vault_petty_funds(company_id);")

    # 4. Tabla de arqueos del fondo de sencillo en bóveda
    op.execute("""
        CREATE TABLE IF NOT EXISTS vault_petty_fund_audits (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            company_id UUID NOT NULL,
            fund_id UUID NOT NULL REFERENCES vault_petty_funds(id) ON DELETE CASCADE,
            auditado_por UUID,
            auditado_por_nombre VARCHAR(100),
            fecha TIMESTAMPTZ DEFAULT clock_timestamp(),
            monto_esperado_pyg NUMERIC(15, 0) NOT NULL,
            monto_contado_pyg NUMERIC(15, 0) NOT NULL,
            diferencia_pyg NUMERIC(15, 0) NOT NULL DEFAULT 0,
            desglose JSONB,
            resultado VARCHAR(30) NOT NULL DEFAULT 'cuadrado',
            observaciones TEXT,
            created_at TIMESTAMPTZ DEFAULT clock_timestamp()
        );
    """)
    op.execute("CREATE INDEX IF NOT EXISTS idx_vpfa_company_fund ON vault_petty_fund_audits(company_id, fund_id);")
    op.execute("CREATE INDEX IF NOT EXISTS idx_vpfa_fecha ON vault_petty_fund_audits(fecha);")

    # 5. Tabla de arqueos sorpresa de cajeras en turnos abiertos
    op.execute("""
        CREATE TABLE IF NOT EXISTS cash_surprise_audits (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            session_id UUID NOT NULL REFERENCES cash_sessions(id) ON DELETE CASCADE,
            company_id UUID NOT NULL,
            auditor_id UUID,
            auditor_nombre VARCHAR(100),
            cajero_nombre VARCHAR(100),
            fecha TIMESTAMPTZ DEFAULT clock_timestamp(),
            monto_esperado_pyg NUMERIC(15, 0) NOT NULL DEFAULT 0,
            monto_contado_pyg NUMERIC(15, 0) NOT NULL DEFAULT 0,
            diferencia_pyg NUMERIC(15, 0) NOT NULL DEFAULT 0,
            monto_esperado_brl NUMERIC(12, 2) NOT NULL DEFAULT 0,
            monto_contado_brl NUMERIC(12, 2) NOT NULL DEFAULT 0,
            diferencia_brl NUMERIC(12, 2) NOT NULL DEFAULT 0,
            monto_esperado_usd NUMERIC(12, 2) NOT NULL DEFAULT 0,
            monto_contado_usd NUMERIC(12, 2) NOT NULL DEFAULT 0,
            diferencia_usd NUMERIC(12, 2) NOT NULL DEFAULT 0,
            desglose JSONB,
            resultado VARCHAR(30) NOT NULL DEFAULT 'cuadrado',
            observaciones TEXT,
            created_at TIMESTAMPTZ DEFAULT clock_timestamp()
        );
    """)
    op.execute("CREATE INDEX IF NOT EXISTS idx_csa_session ON cash_surprise_audits(session_id);")
    op.execute("CREATE INDEX IF NOT EXISTS idx_csa_company ON cash_surprise_audits(company_id);")
    op.execute("CREATE INDEX IF NOT EXISTS idx_csa_fecha ON cash_surprise_audits(fecha);")

    # 6. Semilla inicial del Fondo Permanente de Sencillo Bóveda (₲ 3.800.000)
    op.execute("""
        INSERT INTO vault_petty_funds (company_id, nombre, monto_objetivo_pyg, saldo_actual_pyg)
        VALUES ('00000000-0000-0000-0000-000000000010', 'Fondo Permanente de Sencillo Bóveda', 3800000, 3800000)
        ON CONFLICT (company_id) DO NOTHING;
    """)

    # 7. Semilla inicial para las cajeras activas existentes (₲ 500.000 y R$ 300)
    op.execute("""
        INSERT INTO cashier_fund_assignments (company_id, user_id, cajero_nombre, monto_pyg, monto_brl, estado, observaciones)
        SELECT 
            '00000000-0000-0000-0000-000000000010'::uuid,
            u.id,
            u.nombre,
            500000,
            300.00,
            'activo',
            'Fondo inicial asignado por política de tienda'
        FROM users u
        WHERE u.rol ILIKE '%cajer%' AND u.activo = TRUE
        ON CONFLICT (company_id, user_id) DO NOTHING;
    """)


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS cash_surprise_audits;")
    op.execute("DROP TABLE IF EXISTS vault_petty_fund_audits;")
    op.execute("DROP TABLE IF EXISTS vault_petty_funds;")
    op.execute("DROP TABLE IF EXISTS cashier_fund_assignments;")
