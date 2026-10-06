"""add_labor_settlements_table

Revision ID: 20261006171500
Revises: 20261006170000
Create Date: 2026-10-06 17:15:00.000000

Crea la tabla labor_settlements para registrar finiquitos y liquidaciones laborales de SueldOK,
vinculados a la Orden de Pago (SupplierPaymentOrder) respectiva.
"""
from typing import Sequence, Union
from alembic import op


revision: str = '20261006171500'
down_revision: Union[str, None] = '20261006170000'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Esquema public
    op.execute("""
        CREATE TABLE IF NOT EXISTS labor_settlements (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            company_id UUID NOT NULL,
            employee_id VARCHAR(100) NOT NULL,
            employee_nombre VARCHAR(150) NOT NULL,
            employee_ci VARCHAR(50),
            employee_cargo VARCHAR(100),
            fecha_ingreso DATE,
            fecha_salida DATE NOT NULL,
            motivo VARCHAR(100) NOT NULL DEFAULT 'despido_injustificado',
            salario_base NUMERIC(15, 0) NOT NULL DEFAULT 0,
            dias_trabajados_mes INTEGER DEFAULT 0,
            monto_dias_trabajados NUMERIC(15, 0) DEFAULT 0,
            vacaciones_monto NUMERIC(15, 0) DEFAULT 0,
            aguinaldo_proporcional NUMERIC(15, 0) DEFAULT 0,
            preaviso NUMERIC(15, 0) DEFAULT 0,
            indemnizacion_legal NUMERIC(15, 0) DEFAULT 0,
            descuentos_varios NUMERIC(15, 0) DEFAULT 0,
            total_liquidacion_neta NUMERIC(15, 0) NOT NULL DEFAULT 0,
            payment_order_id UUID REFERENCES supplier_payment_orders(id) ON DELETE SET NULL,
            estado VARCHAR(30) NOT NULL DEFAULT 'pendiente',
            observaciones TEXT,
            created_by UUID,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
    """)

    op.execute("CREATE INDEX IF NOT EXISTS idx_settlements_company ON labor_settlements(company_id)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_settlements_employee ON labor_settlements(employee_id)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_settlements_order ON labor_settlements(payment_order_id)")

    # 2. Esquema sandbox si existe
    op.execute("""
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1 FROM information_schema.schemata WHERE schema_name = 'sandbox'
            ) THEN
                CREATE TABLE IF NOT EXISTS sandbox.labor_settlements (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    company_id UUID NOT NULL,
                    employee_id VARCHAR(100) NOT NULL,
                    employee_nombre VARCHAR(150) NOT NULL,
                    employee_ci VARCHAR(50),
                    employee_cargo VARCHAR(100),
                    fecha_ingreso DATE,
                    fecha_salida DATE NOT NULL,
                    motivo VARCHAR(100) NOT NULL DEFAULT 'despido_injustificado',
                    salario_base NUMERIC(15, 0) NOT NULL DEFAULT 0,
                    dias_trabajados_mes INTEGER DEFAULT 0,
                    monto_dias_trabajados NUMERIC(15, 0) DEFAULT 0,
                    vacaciones_monto NUMERIC(15, 0) DEFAULT 0,
                    aguinaldo_proporcional NUMERIC(15, 0) DEFAULT 0,
                    preaviso NUMERIC(15, 0) DEFAULT 0,
                    indemnizacion_legal NUMERIC(15, 0) DEFAULT 0,
                    descuentos_varios NUMERIC(15, 0) DEFAULT 0,
                    total_liquidacion_neta NUMERIC(15, 0) NOT NULL DEFAULT 0,
                    payment_order_id UUID,
                    estado VARCHAR(30) NOT NULL DEFAULT 'pendiente',
                    observaciones TEXT,
                    created_by UUID,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                );
                CREATE INDEX IF NOT EXISTS idx_sandbox_settlements_company ON sandbox.labor_settlements(company_id);
            END IF;
        END $$
    """)


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS labor_settlements CASCADE")
    op.execute("""
        DO $$
        BEGIN
            IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'sandbox') THEN
                DROP TABLE IF EXISTS sandbox.labor_settlements CASCADE;
            END IF;
        END $$
    """)
