"""fix drift between products model and actual schema

products (ORM) declaraba category_id, tipo, metodo_costeo, tipo_venta,
tiene_lotes, tiene_vencimiento, tiene_serial, stock_maximo, peso_kg —
ninguna de esas existe en la tabla real (la columna real es
categoria_id, no category_id). Se encontró al correr sync_sales del
conector Ñemuha, que rompía con UndefinedColumnError al crear
productos nuevos. Guards idempotentes por si otra rama ya los agregó.

Revision ID: 20260727000000
Revises: 20260725000000
Create Date: 2026-07-27 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "20260727000000"
down_revision: Union[str, None] = "20260725000000"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _existing_columns(inspector, table: str) -> set[str]:
    return {c["name"] for c in inspector.get_columns(table)}


def _add_if_missing(existing: set[str], table: str, column: sa.Column) -> None:
    if column.name not in existing:
        op.add_column(table, column)


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    cols = _existing_columns(inspector, "products")
    _add_if_missing(cols, "products", sa.Column("tipo", sa.String(20), nullable=False, server_default="producto"))
    _add_if_missing(cols, "products", sa.Column("metodo_costeo", sa.String(10), server_default="promedio"))
    _add_if_missing(cols, "products", sa.Column("tipo_venta", sa.String(20), server_default="unidad"))
    _add_if_missing(cols, "products", sa.Column("tiene_lotes", sa.Boolean(), server_default=sa.text("false")))
    _add_if_missing(cols, "products", sa.Column("tiene_vencimiento", sa.Boolean(), server_default=sa.text("false")))
    _add_if_missing(cols, "products", sa.Column("tiene_serial", sa.Boolean(), server_default=sa.text("false")))
    _add_if_missing(cols, "products", sa.Column("stock_maximo", sa.Integer()))
    _add_if_missing(cols, "products", sa.Column("peso_kg", sa.Numeric(10, 3)))


def downgrade() -> None:
    for col in ("peso_kg", "stock_maximo", "tiene_serial", "tiene_vencimiento", "tiene_lotes", "tipo_venta", "metodo_costeo", "tipo"):
        op.drop_column("products", col)
