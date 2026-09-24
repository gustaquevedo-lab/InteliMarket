"""add_numero_to_promotions

Revision ID: 20260924113000
Revises: 20260923200000
Create Date: 2026-09-24 11:30:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = '20260924113000'
down_revision: Union[str, None] = '20260923200000'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Crear secuencia para autoincremento seguro y concurrente
    op.execute("""
        CREATE SEQUENCE IF NOT EXISTS promotions_numero_seq;
    """)

    # 2. Agregar columna numero
    op.execute("""
        ALTER TABLE promotions
        ADD COLUMN IF NOT EXISTS numero INTEGER;
    """)

    # 3. Poblar correlativo para promociones existentes ordenadas por created_at ASC
    op.execute("""
        WITH numbered AS (
            SELECT id, ROW_NUMBER() OVER (ORDER BY created_at ASC, id ASC) as rn
            FROM promotions
        )
        UPDATE promotions p
        SET numero = n.rn
        FROM numbered n
        WHERE p.id = n.id AND p.numero IS NULL;
    """)

    # 4. Ajustar el valor de la secuencia al máximo actual + 1
    op.execute("""
        SELECT setval(
            'promotions_numero_seq',
            COALESCE((SELECT MAX(numero) FROM promotions), 0) + 1,
            false
        );
    """)

    # 5. Establecer default con nextval
    op.execute("""
        ALTER TABLE promotions
        ALTER COLUMN numero SET DEFAULT nextval('promotions_numero_seq');
    """)

    # 6. Crear índice para búsquedas instantáneas
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_promotions_numero ON promotions (numero);
    """)


def downgrade() -> None:
    op.execute("""
        DROP INDEX IF EXISTS idx_promotions_numero;
        ALTER TABLE promotions DROP COLUMN IF EXISTS numero;
        DROP SEQUENCE IF EXISTS promotions_numero_seq;
    """)
