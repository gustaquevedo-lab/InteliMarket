"""sales_agent_advanced_ecosystem

Revision ID: 20261011140000
Revises: 20261010170000
Create Date: 2026-10-11 14:00:00.000000

Crea las tablas del ecosistema avanzado de Gerente de Ventas IA:
1. sales_agent_settings (metas comerciales configurables)
2. company_business_rules (memoria y reglas de negocio aprendidas por la IA)
3. company_kvi_products (productos gancho / KVI protegidos de subas)
4. sales_action_tasks (plan de accion diario y tareas operativas 1-Click)
5. price_audit_log (auditoria historica de cambios de precio)
"""
from typing import Sequence, Union
from alembic import op


revision: str = '20261011140000'
down_revision: Union[str, None] = '20261010170100'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. sales_agent_settings
    op.execute("""
        CREATE TABLE IF NOT EXISTS sales_agent_settings (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
            target_margen_minimo_pct NUMERIC(5,2) NOT NULL DEFAULT 20.00,
            target_margen_ideal_pct NUMERIC(5,2) NOT NULL DEFAULT 24.00,
            metas_por_categoria JSONB DEFAULT '{}'::jsonb,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW(),
            CONSTRAINT uq_sales_agent_settings_company UNIQUE(company_id)
        );
    """)

    # 2. company_business_rules
    op.execute("""
        CREATE TABLE IF NOT EXISTS company_business_rules (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
            regla TEXT NOT NULL,
            categoria VARCHAR(100),
            origen VARCHAR(50) DEFAULT 'usuario_decision',
            activa BOOLEAN DEFAULT TRUE,
            confianza NUMERIC(3,2) DEFAULT 1.00,
            created_at TIMESTAMPTZ DEFAULT NOW()
        );
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_company_business_rules_cid ON company_business_rules(company_id);")

    # 3. company_kvi_products
    op.execute("""
        CREATE TABLE IF NOT EXISTS company_kvi_products (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
            product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
            es_gancho BOOLEAN DEFAULT TRUE,
            margen_techo_pct NUMERIC(5,2) DEFAULT 15.00,
            motivo_gancho TEXT DEFAULT 'Producto ancla de atraccion de clientes',
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW(),
            CONSTRAINT uq_company_kvi_product UNIQUE(company_id, product_id)
        );
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_company_kvi_products_cid ON company_kvi_products(company_id);")
    op.execute("CREATE INDEX IF NOT EXISTS ix_company_kvi_products_pid ON company_kvi_products(product_id);")

    # 4. sales_action_tasks
    op.execute("""
        CREATE TABLE IF NOT EXISTS sales_action_tasks (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
            titulo VARCHAR(255) NOT NULL,
            descripcion TEXT NOT NULL,
            area VARCHAR(100) NOT NULL,
            prioridad VARCHAR(20) NOT NULL DEFAULT 'alta',
            estado VARCHAR(30) NOT NULL DEFAULT 'pendiente',
            tipo_accion VARCHAR(50) NOT NULL,
            payload_accion JSONB DEFAULT '{}'::jsonb,
            responsable_sugerido VARCHAR(150),
            impacto_estimado VARCHAR(100),
            motivo_descarte TEXT,
            completado_por VARCHAR(150),
            fecha_limite TIMESTAMPTZ,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        );
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_sales_action_tasks_cid ON sales_action_tasks(company_id);")
    op.execute("CREATE INDEX IF NOT EXISTS ix_sales_action_tasks_estado ON sales_action_tasks(estado);")

    # 5. price_audit_log
    op.execute("""
        CREATE TABLE IF NOT EXISTS price_audit_log (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
            product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
            precio_anterior NUMERIC(14,2) NOT NULL,
            precio_nuevo NUMERIC(14,2) NOT NULL,
            costo_unitario_momento NUMERIC(14,2) NOT NULL,
            margen_anterior_pct NUMERIC(5,2),
            margen_nuevo_pct NUMERIC(5,2),
            motivo TEXT,
            aplicado_por VARCHAR(150) DEFAULT 'gerente_ventas_ia',
            created_at TIMESTAMPTZ DEFAULT NOW()
        );
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_price_audit_log_cid ON price_audit_log(company_id);")
    op.execute("CREATE INDEX IF NOT EXISTS ix_price_audit_log_pid ON price_audit_log(product_id);")


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS price_audit_log CASCADE;")
    op.execute("DROP TABLE IF EXISTS sales_action_tasks CASCADE;")
    op.execute("DROP TABLE IF EXISTS company_kvi_products CASCADE;")
    op.execute("DROP TABLE IF EXISTS company_business_rules CASCADE;")
    op.execute("DROP TABLE IF EXISTS sales_agent_settings CASCADE;")
