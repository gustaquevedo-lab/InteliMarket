"""fix drift between companies model and actual schema

companies (ORM) declaraba iva_condition, pero la columna real es
condicion_iva. Le faltaban tenant_id, config y activo (existen en la
tabla real, no estaban mapeados en el modelo). Y le faltaban en la
tabla real: regimen_tributario, actividad_principal, ciudad,
departamento, logo_url, timbrado_* y sifen_* (el modelo los declara,
la tabla no los tenía). Se encontró al intentar leer
verticals.router.get_company_vertical, que rompía con
UndefinedColumnError.

Revision ID: 20260729000000
Revises: 20260728000000
Create Date: 2026-07-29 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "20260729000000"
down_revision: Union[str, None] = "20260728000000"
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

    cols = _existing_columns(inspector, "companies")
    _add_if_missing(cols, "companies", sa.Column("regimen_tributario", sa.String(50)))
    _add_if_missing(cols, "companies", sa.Column("actividad_principal", sa.String(255)))
    _add_if_missing(cols, "companies", sa.Column("ciudad", sa.String(100)))
    _add_if_missing(cols, "companies", sa.Column("departamento", sa.String(100)))
    _add_if_missing(cols, "companies", sa.Column("logo_url", sa.Text()))
    _add_if_missing(cols, "companies", sa.Column("timbrado_numero", sa.String(20)))
    _add_if_missing(cols, "companies", sa.Column("timbrado_vigencia_desde", sa.DateTime(timezone=True)))
    _add_if_missing(cols, "companies", sa.Column("timbrado_vigencia_hasta", sa.DateTime(timezone=True)))
    _add_if_missing(cols, "companies", sa.Column("sifen_enabled", sa.Boolean(), server_default=sa.text("false")))
    _add_if_missing(cols, "companies", sa.Column("sifen_cert_path", sa.Text()))


def downgrade() -> None:
    for col in (
        "sifen_cert_path", "sifen_enabled", "timbrado_vigencia_hasta", "timbrado_vigencia_desde",
        "timbrado_numero", "logo_url", "departamento", "ciudad", "actividad_principal", "regimen_tributario",
    ):
        op.drop_column("companies", col)
