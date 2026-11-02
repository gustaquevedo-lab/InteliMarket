"""resumen mensual de ventas (acelera el Historico del dashboard)

Revision ID: 20261102100000
Revises: 20261015100000
Create Date: 2026-11-02 10:00:00.000000

"""
from alembic import op

revision = "20261102100000"
down_revision = "20261015100000"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Se llena solo desde reports.service._resumen_guardado; branch_id 0000... = venta sin sucursal
    op.execute("""
        CREATE TABLE sales_summary_monthly (
            company_id UUID NOT NULL,
            mes DATE NOT NULL,
            branch_id UUID NOT NULL,
            total_ventas BIGINT NOT NULL,
            monto_total NUMERIC NOT NULL,
            monto_iva_10 NUMERIC NOT NULL,
            monto_iva_5 NUMERIC NOT NULL,
            total_pagado NUMERIC NOT NULL,
            saldo_pendiente NUMERIC NOT NULL,
            total_items NUMERIC NOT NULL,
            costo_total NUMERIC NOT NULL,
            items_sin_costo BIGINT NOT NULL,
            venta_lineas NUMERIC NOT NULL,
            iva_lineas NUMERIC NOT NULL,
            ventas_sin_importe BIGINT NOT NULL,
            paresa_uc NUMERIC NOT NULL,
            calculado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
            PRIMARY KEY (company_id, mes, branch_id)
        )
    """)


def downgrade() -> None:
    op.execute("DROP TABLE sales_summary_monthly")
