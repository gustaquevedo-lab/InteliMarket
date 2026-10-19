"""normalize bank transaction types to credito/debito

Revision ID: 20261019171500
Revises: 20261019154500
Create Date: 2026-10-19 17:15:00.000000

Normaliza las transacciones bancarias historicas generadas por cierres de caja (SIPAP)
y depositos de boveda que tenian 'ingreso' o 'deposito' como tipo, alineandolas
al estandar contable canonico 'credito' (entradas a cuenta).
"""
from typing import Sequence, Union
from alembic import op

revision: str = '20261019171500'
down_revision: Union[str, None] = '20261019154500'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Normalizar 'ingreso' y 'deposito' a 'credito'
    op.execute("""
        UPDATE bank_transactions
        SET tipo = 'credito'
        WHERE tipo IN ('ingreso', 'deposito');
    """)
    # 2. Si hubiera algun 'egreso', normalizar a 'debito'
    op.execute("""
        UPDATE bank_transactions
        SET tipo = 'debito'
        WHERE tipo = 'egreso';
    """)


def downgrade() -> None:
    pass
