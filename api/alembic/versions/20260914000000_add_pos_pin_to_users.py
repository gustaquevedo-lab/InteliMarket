"""add_pos_pin_to_users

Revision ID: 20260914000000
Revises: 20260911160000
Create Date: 2026-09-14 00:00:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '20260914000000'
down_revision: Union[str, None] = '20260911160000'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # PIN corto (4-6 digitos) propio de autorizaciones en caja, distinto de
    # la contrasena real de login -- se cachea hasheado en las estaciones POS
    # (offlineDB) para poder verificar autorizaciones de supervisor sin
    # depender del servidor. Reduce el radio de exposicion de lo que se
    # distribuye a las cajas: si se compromete el cache local, no compromete
    # la cuenta real (login/portal admin), solo el PIN de autorizaciones.
    op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS pos_pin_hash VARCHAR(255)")
    op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS pos_pin_updated_at TIMESTAMPTZ")


def downgrade() -> None:
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS pos_pin_updated_at")
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS pos_pin_hash")
