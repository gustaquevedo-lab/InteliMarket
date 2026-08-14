"""add fixed_assets — módulo de activos fijos/depreciación de Finanzas.
Registro con vida útil y depreciación en línea recta, posteada mensualmente
como asiento real via create_manual_entry (mismo motor que Contabilidad
Integrada ya usa para asientos manuales).

Revision ID: 20260813050000
Revises: 20260811120000
Create Date: 2026-08-13 05:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "20260813050000"
down_revision: Union[str, None] = "20260811120000"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "fixed_assets",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("nombre", sa.String(200), nullable=False),
        sa.Column("categoria", sa.String(100), nullable=True),
        sa.Column("fecha_adquisicion", sa.Date, nullable=False),
        sa.Column("valor_adquisicion", sa.Numeric(15, 0), nullable=False),
        sa.Column("valor_residual", sa.Numeric(15, 0), nullable=False, server_default="0"),
        sa.Column("vida_util_meses", sa.Integer, nullable=False),
        sa.Column("meses_depreciados", sa.Integer, nullable=False, server_default="0"),
        sa.Column("depreciacion_acumulada", sa.Numeric(15, 0), nullable=False, server_default="0"),
        sa.Column("estado", sa.String(20), nullable=False, server_default="activo"),
        sa.Column("fecha_baja", sa.Date, nullable=True),
        sa.Column("motivo_baja", sa.Text, nullable=True),
        sa.Column("ultima_depreciacion_periodo", sa.String(7), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("fixed_assets")
