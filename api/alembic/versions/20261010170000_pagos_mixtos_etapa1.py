"""pagos_mixtos_etapa1

Revision ID: 20261010170000
Revises: 20261010160000
Create Date: 2026-10-10 17:00:00.000000

Pago mixto Etapa 1: lineas de pago enlazadas a cobros del terminal y marcas
de revision en la venta. Todas las columnas son nullable salvo
pos_terminal_transactions.requiere_conciliacion (NOT NULL DEFAULT false).
Una sentencia por op.execute (asyncpg no acepta varias).
"""
from typing import Sequence, Union
from alembic import op


revision: str = "20261010170000"
down_revision: Union[str, None] = "20261010160000"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_COLUMNAS = [
    ("sale_payments", "proveedor VARCHAR(20)"),
    ("sale_payments", "terminal_transaction_id UUID"),
    ("sale_payments", "referencia VARCHAR(60)"),
    ("sale_payments", "cuotas SMALLINT"),
    ("sale_payments", "monto_pyg NUMERIC(15,0)"),
    ("pos_terminal_transactions", "requiere_conciliacion BOOLEAN NOT NULL DEFAULT false"),
    ("pos_terminal_transactions", "revisado_por UUID"),
    ("pos_terminal_transactions", "revisado_at TIMESTAMPTZ"),
    ("sales", "pagos_revision VARCHAR(20)"),
    ("sales", "pagos_diferencia NUMERIC(15,0)"),
    ("sales", "pagos_revisado_por UUID"),
    ("sales", "pagos_revisado_at TIMESTAMPTZ"),
]


def upgrade() -> None:
    for tabla, definicion in _COLUMNAS:
        op.execute(f"ALTER TABLE {tabla} ADD COLUMN IF NOT EXISTS {definicion}")
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_sale_payments_terminal_tx "
        "ON sale_payments (terminal_transaction_id)"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_sale_payments_terminal_tx")
    for tabla, definicion in reversed(_COLUMNAS):
        op.execute(f"ALTER TABLE {tabla} DROP COLUMN IF EXISTS {definicion.split()[0]}")
