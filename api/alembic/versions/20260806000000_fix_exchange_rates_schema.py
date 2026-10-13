"""fix exchange_rates: real table never matched the ExchangeRate model/service
(moneda_origen/moneda_destino/tasa/timestamp vs company_id/moneda/tasa_compra/
tasa_venta/date) — the whole currency module was broken against prod since it
was written. Table has 0 rows, safe to restructure directly.

Revision ID: 20260806000000
Revises: 20260805000000
Create Date: 2026-08-06 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlalchemy.dialects.postgresql


revision: str = "20260806000000"
down_revision: Union[str, None] = "20260805000000"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("exchange_rates", sa.Column("company_id", sa.dialects.postgresql.UUID(as_uuid=True)))
    op.add_column("exchange_rates", sa.Column("moneda", sa.String(3)))
    op.add_column("exchange_rates", sa.Column("tasa_compra", sa.Numeric(10, 2)))
    op.add_column("exchange_rates", sa.Column("tasa_venta", sa.Numeric(10, 2)))

    op.drop_column("exchange_rates", "moneda_origen")
    op.drop_column("exchange_rates", "moneda_destino")
    op.drop_column("exchange_rates", "tasa")

    op.alter_column("exchange_rates", "fecha", type_=sa.Date, postgresql_using="fecha::date")
    op.alter_column("exchange_rates", "company_id", nullable=False)
    op.alter_column("exchange_rates", "moneda", nullable=False)

    op.create_index("ix_exchange_rates_company_id", "exchange_rates", ["company_id"])


def downgrade() -> None:
    op.drop_index("ix_exchange_rates_company_id", table_name="exchange_rates")
    op.alter_column("exchange_rates", "fecha", type_=sa.DateTime)
    op.add_column("exchange_rates", sa.Column("moneda_origen", sa.String(3)))
    op.add_column("exchange_rates", sa.Column("moneda_destino", sa.String(3)))
    op.add_column("exchange_rates", sa.Column("tasa", sa.Numeric(10, 4)))
    op.drop_column("exchange_rates", "tasa_venta")
    op.drop_column("exchange_rates", "tasa_compra")
    op.drop_column("exchange_rates", "moneda")
    op.drop_column("exchange_rates", "company_id")
