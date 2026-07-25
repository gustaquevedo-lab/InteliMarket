"""fix drift between suppliers/customers models and actual schema

Varias columnas se agregaron al modelo ORM (purchases.models.Supplier,
customers.models.Customer) en sesiones anteriores sin la migración
correspondiente — el conector de Ñemuha los pisó al intentar insertar. Guards
idempotentes por si alguna otra rama ya agregó alguna de estas columnas.

Revision ID: 20260724000000
Revises: 20260723000000
Create Date: 2026-07-24 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "20260724000000"
down_revision: Union[str, None] = "20260723000000"
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

    suppliers_cols = _existing_columns(inspector, "suppliers")
    _add_if_missing(suppliers_cols, "suppliers", sa.Column("tipo_persona", sa.String(20), nullable=False, server_default="juridica"))
    _add_if_missing(suppliers_cols, "suppliers", sa.Column("ci", sa.String(20)))
    _add_if_missing(suppliers_cols, "suppliers", sa.Column("condicion_iva", sa.String(20)))
    _add_if_missing(suppliers_cols, "suppliers", sa.Column("ciudad", sa.String(100)))
    _add_if_missing(suppliers_cols, "suppliers", sa.Column("plazo_pago_dias", sa.Integer(), server_default="0"))

    customers_cols = _existing_columns(inspector, "customers")
    _add_if_missing(customers_cols, "customers", sa.Column("tipo_persona", sa.String(20), nullable=False, server_default="juridica"))
    _add_if_missing(customers_cols, "customers", sa.Column("condicion_iva", sa.String(20)))
    _add_if_missing(customers_cols, "customers", sa.Column("ciudad", sa.String(100)))
    _add_if_missing(customers_cols, "customers", sa.Column("departamento", sa.String(100)))
    _add_if_missing(customers_cols, "customers", sa.Column("price_list_id", postgresql.UUID(as_uuid=True)))
    _add_if_missing(customers_cols, "customers", sa.Column("credito_limite", sa.Numeric(15, 0), server_default="0"))
    _add_if_missing(customers_cols, "customers", sa.Column("credito_usado", sa.Numeric(15, 0), server_default="0"))
    _add_if_missing(customers_cols, "customers", sa.Column("pago_default", sa.String(20)))


def downgrade() -> None:
    for col in ("pago_default", "credito_usado", "credito_limite", "price_list_id", "departamento", "ciudad", "condicion_iva", "tipo_persona"):
        op.drop_column("customers", col)
    for col in ("plazo_pago_dias", "ciudad", "condicion_iva", "ci", "tipo_persona"):
        op.drop_column("suppliers", col)
