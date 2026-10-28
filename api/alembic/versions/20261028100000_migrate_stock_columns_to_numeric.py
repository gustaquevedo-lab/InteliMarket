"""migrate stock columns to numeric 15 3 for fractional and pesable products

Revision ID: 20261028100000
Revises: 20261023120000
Create Date: 2026-10-28 10:00:00.000000

- Altera stock.cantidad y stock.cantidad_reservada a NUMERIC(15, 3)
- Altera stock_lots.cantidad y stock_lots.cantidad_disponible a NUMERIC(15, 3)
- Altera inventory_movements.cantidad a NUMERIC(15, 3)
- Preserva el trigger trg_stock_enforce_integer_units para que las unidades 'UN' sigan siendo enteras
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '20261028100000'
down_revision: Union[str, None] = '20261023120000'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 0. Desasociar temporalmente el trigger para permitir el cambio de tipo DDL en PostgreSQL
    op.execute("DROP TRIGGER IF EXISTS trg_stock_enforce_integer_units ON stock;")

    # 1. stock
    op.execute("""
        ALTER TABLE stock 
            ALTER COLUMN cantidad TYPE NUMERIC(15, 3) USING cantidad::numeric(15, 3),
            ALTER COLUMN cantidad_reservada TYPE NUMERIC(15, 3) USING cantidad_reservada::numeric(15, 3);
    """)

    # 2. stock_lots
    op.execute("""
        ALTER TABLE stock_lots 
            ALTER COLUMN cantidad TYPE NUMERIC(15, 3) USING cantidad::numeric(15, 3),
            ALTER COLUMN cantidad_disponible TYPE NUMERIC(15, 3) USING cantidad_disponible::numeric(15, 3);
    """)

    # 3. inventory_movements
    op.execute("""
        ALTER TABLE inventory_movements 
            ALTER COLUMN cantidad TYPE NUMERIC(15, 3) USING cantidad::numeric(15, 3);
    """)

    # 4. Restaurar el trigger protector (garantiza que productos con unidad 'UN' sigan forzados a enteros)
    op.execute("""
        CREATE TRIGGER trg_stock_enforce_integer_units
        BEFORE INSERT OR UPDATE ON stock
        FOR EACH ROW
        EXECUTE FUNCTION trg_fn_enforce_integer_units();
    """)


def downgrade() -> None:
    op.execute("DROP TRIGGER IF EXISTS trg_stock_enforce_integer_units ON stock;")
    op.execute("""
        ALTER TABLE inventory_movements 
            ALTER COLUMN cantidad TYPE INTEGER USING ROUND(cantidad)::integer;
        ALTER TABLE stock_lots 
            ALTER COLUMN cantidad TYPE INTEGER USING ROUND(cantidad)::integer,
            ALTER COLUMN cantidad_disponible TYPE INTEGER USING ROUND(cantidad_disponible)::integer;
        ALTER TABLE stock 
            ALTER COLUMN cantidad TYPE INTEGER USING ROUND(cantidad)::integer,
            ALTER COLUMN cantidad_reservada TYPE INTEGER USING ROUND(cantidad_reservada)::integer;
    """)
    op.execute("""
        CREATE TRIGGER trg_stock_enforce_integer_units
        BEFORE INSERT OR UPDATE ON stock
        FOR EACH ROW
        EXECUTE FUNCTION trg_fn_enforce_integer_units();
    """)
