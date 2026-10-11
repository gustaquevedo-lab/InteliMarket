"""finance_agent_advanced_ecosystem

Revision ID: 20261011153000
Revises: 20261011140000
Create Date: 2026-10-11 15:30:00.000000

Crea las tablas del ecosistema avanzado de Gerente Financiero IA (CFO Virtual)
e interconexion inter-agente:
1. finance_agent_settings (parametros de tesoreria, colchon minimo bancario, politicas de pago)
2. inter_agent_directives (bus de directivas persistidas CFO <-> Ventas <-> Marketing)
3. cash_flow_scenarios (escenarios y simulaciones comparativas de flujo de caja)
"""
from typing import Sequence, Union
from alembic import op


revision: str = '20261011153000'
down_revision: Union[str, None] = '20261011140000'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. finance_agent_settings
    op.execute("""
        CREATE TABLE IF NOT EXISTS finance_agent_settings (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
            colchon_minimo_bancos_gs NUMERIC(14,2) NOT NULL DEFAULT 50000000.00,
            dias_alerta_mora INTEGER NOT NULL DEFAULT 15,
            limite_pago_diario_sin_autorizacion_gs NUMERIC(14,2) NOT NULL DEFAULT 20000000.00,
            prioridad_pagos JSONB DEFAULT '{"servicios": 1, "nomina": 2, "proveedores_perecederos": 3, "proveedores_generales": 4}'::jsonb,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW(),
            CONSTRAINT uq_finance_agent_settings_company UNIQUE(company_id)
        );
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_finance_agent_settings_cid ON finance_agent_settings(company_id);")

    # 2. inter_agent_directives
    op.execute("""
        CREATE TABLE IF NOT EXISTS inter_agent_directives (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
            codigo VARCHAR(50) NOT NULL,
            emisor VARCHAR(50) NOT NULL,
            receptor VARCHAR(50) NOT NULL,
            titulo VARCHAR(255) NOT NULL,
            mensaje TEXT NOT NULL,
            accion_sugerida VARCHAR(100),
            prioridad VARCHAR(20) NOT NULL DEFAULT 'alta',
            estado VARCHAR(30) NOT NULL DEFAULT 'emitida',
            payload JSONB DEFAULT '{}'::jsonb,
            impacto_estimado_gs NUMERIC(14,2) DEFAULT 0.00,
            impacto_real_recaudado_gs NUMERIC(14,2) DEFAULT 0.00,
            feedback_receptor TEXT,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        );
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_inter_agent_directives_cid ON inter_agent_directives(company_id);")
    op.execute("CREATE INDEX IF NOT EXISTS ix_inter_agent_directives_emisor ON inter_agent_directives(emisor);")
    op.execute("CREATE INDEX IF NOT EXISTS ix_inter_agent_directives_receptor ON inter_agent_directives(receptor);")
    op.execute("CREATE INDEX IF NOT EXISTS ix_inter_agent_directives_estado ON inter_agent_directives(estado);")

    # 3. cash_flow_scenarios
    op.execute("""
        CREATE TABLE IF NOT EXISTS cash_flow_scenarios (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
            nombre VARCHAR(150) NOT NULL,
            descripcion TEXT,
            parametros JSONB NOT NULL DEFAULT '{}'::jsonb,
            resultado_30d JSONB NOT NULL DEFAULT '{}'::jsonb,
            creado_por VARCHAR(100) DEFAULT 'cfo_agent',
            created_at TIMESTAMPTZ DEFAULT NOW()
        );
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_cash_flow_scenarios_cid ON cash_flow_scenarios(company_id);")


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS cash_flow_scenarios CASCADE;")
    op.execute("DROP TABLE IF EXISTS inter_agent_directives CASCADE;")
    op.execute("DROP TABLE IF EXISTS finance_agent_settings CASCADE;")
