"""pagos_mixtos_etapa1

Revision ID: 20261010170000
Revises: 20261010160000
Create Date: 2026-10-10 17:00:00.000000

Pago mixto Etapa 1: lineas de pago enlazadas a cobros del terminal y marcas
de revision en la venta. Todas las columnas son nullable salvo
pos_terminal_transactions.requiere_conciliacion (NOT NULL DEFAULT false).
Una sentencia por op.execute (asyncpg no acepta varias).

Seguridad en produccion: lock_timeout de 5s (SET LOCAL, el env corre las
migraciones dentro de una transaccion) para que un ALTER que no consigue el
lock falle rapido en vez de encolar las ventas detras; el indice se crea
CONCURRENTLY fuera de la transaccion (autocommit_block) para no bloquear
inserts en sale_payments. Si el CONCURRENTLY falla deja un indice INVALID:
DROP INDEX CONCURRENTLY ix_sale_payments_terminal_tx y reintentar.
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
    op.execute("SET LOCAL lock_timeout = '5s'")
    for tabla, definicion in _COLUMNAS:
        op.execute(f"ALTER TABLE {tabla} ADD COLUMN IF NOT EXISTS {definicion}")
    # CONCURRENTLY no puede ir dentro de una transaccion: va despues de los ALTER
    # (autocommit_block confirma lo anterior y vuelve a abrir transaccion al salir).
    with op.get_context().autocommit_block():
        # Un CONCURRENTLY fallado en un intento anterior deja el indice INVALID
        # y el IF NOT EXISTS lo saltaria: se borra solo si existe e es invalido.
        op.execute(
            "DO $$ BEGIN "
            "PERFORM set_config('lock_timeout', '5s', true); "
            "IF EXISTS (SELECT 1 FROM pg_index i "
            "JOIN pg_class c ON c.oid = i.indexrelid "
            "JOIN pg_namespace n ON n.oid = c.relnamespace "
            "WHERE c.relname = 'ix_sale_payments_terminal_tx' "
            "AND n.nspname = current_schema() AND NOT i.indisvalid) THEN "
            "DROP INDEX ix_sale_payments_terminal_tx; "
            "END IF; END $$"
        )
        op.execute(
            "CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_sale_payments_terminal_tx "
            "ON sale_payments (terminal_transaction_id)"
        )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_sale_payments_terminal_tx")
    for tabla, definicion in reversed(_COLUMNAS):
        op.execute(f"ALTER TABLE {tabla} DROP COLUMN IF EXISTS {definicion.split()[0]}")
