"""restore vault brl balances decoupled from pyg bank deposits

Revision ID: 20260922140000
Revises: 20260922130000
Create Date: 2026-09-22 14:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20260922140000"
down_revision: Union[str, None] = "20260922130000"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Desdoblar y restaurar los saldos en Reales (BRL) que quedaron atrapados en estado 'depositado'
    # debido a la remesa de Guaraníes (PYG) a bancos paraguayos.
    # 1. Insertamos un nuevo registro en 'en_boveda' por el remanente en BRL
    op.execute(
        """
        INSERT INTO vault_entries (
            id, company_id, branch_id, origen, handoff_id,
            monto_pyg, monto_usd, monto_brl, estado,
            registrado_por, observaciones, created_at
        )
        SELECT 
            gen_random_uuid(),
            company_id,
            branch_id,
            origen,
            handoff_id,
            0,
            0,
            monto_brl,
            'en_boveda',
            registrado_por,
            'Restauración saldo BRL en bóveda (separado de depósito bancario en PYG) - Ref: ' || id::text,
            created_at
        FROM vault_entries 
        WHERE estado = 'depositado' AND monto_brl > 0;
        """
    )
    # 2. Limpiamos monto_brl en las entradas 'depositado' para evitar duplicidad
    op.execute(
        """
        UPDATE vault_entries 
        SET monto_brl = 0 
        WHERE estado = 'depositado' AND monto_brl > 0;
        """
    )


def downgrade() -> None:
    pass
