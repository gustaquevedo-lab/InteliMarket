"""add punto_emision_secuencias — numeracion fiscal real por punto de emision
(boca), necesaria para el flujo autoimpresor/preimpreso (switcheable a
electronico via fiscal_config.modo_emision)

Revision ID: 20260807000000
Revises: 20260806000000
Create Date: 2026-08-07 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlalchemy.dialects.postgresql


revision: str = "20260807000000"
down_revision: Union[str, None] = "20260806000000"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "punto_emision_secuencias",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("company_id", sa.dialects.postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("timbrado_id", sa.dialects.postgresql.UUID(as_uuid=True), sa.ForeignKey("sifen_timbrados.id"), nullable=False),
        sa.Column("establecimiento", sa.String(3), nullable=False, server_default="001"),
        sa.Column("punto_emision", sa.String(3), nullable=False),
        sa.Column("tipo_documento", sa.String(20), nullable=False, server_default="factura"),
        sa.Column("numero_actual", sa.Integer, nullable=False),
        sa.Column("numero_final", sa.Integer, nullable=False),
        sa.Column("activo", sa.Boolean, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_punto_emision_secuencias_company_id", "punto_emision_secuencias", ["company_id"])
    op.create_unique_constraint(
        "uq_punto_emision_secuencia",
        "punto_emision_secuencias",
        ["company_id", "establecimiento", "punto_emision", "tipo_documento"],
    )


def downgrade() -> None:
    op.drop_constraint("uq_punto_emision_secuencia", "punto_emision_secuencias", type_="unique")
    op.drop_index("ix_punto_emision_secuencias_company_id", table_name="punto_emision_secuencias")
    op.drop_table("punto_emision_secuencias")
