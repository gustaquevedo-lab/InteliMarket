"""finanzas_schema_sync

Revision ID: 20260910120000
Revises: 20260909180000
Create Date: 2026-09-10 12:00:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '20260910120000'
down_revision: Union[str, None] = '20260909180000'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Columnas para notas de crédito a favor de proveedores (Fase 4 Finanzas)
    op.execute("ALTER TABLE supplier_credit_notes ADD COLUMN IF NOT EXISTS motivo_categoria VARCHAR(50) DEFAULT 'devolucion_rotura'")
    op.execute("ALTER TABLE supplier_credit_notes ADD COLUMN IF NOT EXISTS impacto_contable VARCHAR(30) DEFAULT 'recuperacion_merma'")
    op.execute("ALTER TABLE supplier_credit_notes ADD COLUMN IF NOT EXISTS archivo_adjunto_path VARCHAR(500)")
    op.execute("ALTER TABLE supplier_credit_notes ADD COLUMN IF NOT EXISTS saldo_disponible NUMERIC(15, 0)")
    op.execute("UPDATE supplier_credit_notes SET saldo_disponible = monto WHERE saldo_disponible IS NULL")

    # 2. Tabla para imputación / aplicación de notas de crédito a facturas
    op.execute("""
    CREATE TABLE IF NOT EXISTS supplier_credit_note_applications (
        id VARCHAR(36) PRIMARY KEY,
        credit_note_id VARCHAR(36) NOT NULL REFERENCES supplier_credit_notes(id) ON DELETE CASCADE,
        invoice_id VARCHAR(36) NOT NULL REFERENCES supplier_invoices(id) ON DELETE CASCADE,
        monto_aplicado NUMERIC(15, 0) NOT NULL,
        fecha_aplicacion TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        creado_por VARCHAR(100),
        observaciones VARCHAR(255)
    )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_scna_credit_note_id ON supplier_credit_note_applications(credit_note_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_scna_invoice_id ON supplier_credit_note_applications(invoice_id)")

    # 3. Columna para número de recibo correlativo en cobros (Cuentas por Cobrar)
    op.execute("ALTER TABLE receivable_payments ADD COLUMN IF NOT EXISTS numero_recibo VARCHAR(50)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_receivable_payments_numero_recibo ON receivable_payments(numero_recibo)")


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS supplier_credit_note_applications CASCADE")
    op.execute("ALTER TABLE supplier_credit_notes DROP COLUMN IF EXISTS motivo_categoria")
    op.execute("ALTER TABLE supplier_credit_notes DROP COLUMN IF EXISTS impacto_contable")
    op.execute("ALTER TABLE supplier_credit_notes DROP COLUMN IF EXISTS archivo_adjunto_path")
    op.execute("ALTER TABLE supplier_credit_notes DROP COLUMN IF EXISTS saldo_disponible")
    op.execute("ALTER TABLE receivable_payments DROP COLUMN IF EXISTS numero_recibo")
