"""fix sifen_timbrados: real table never matched the SifenTimbrado model/service
(punto_emision_inicio/punto_emision_fin/estado vs rango_desde/rango_hasta/activo)
-- another module broken against prod since it was written. Table has 0 rows,
safe to restructure directly.

Revision ID: 20260808000000
Revises: 20260807000000
Create Date: 2026-08-08 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20260808000000"
down_revision: Union[str, None] = "20260807000000"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("sifen_timbrados", sa.Column("rango_desde", sa.Integer))
    op.add_column("sifen_timbrados", sa.Column("rango_hasta", sa.Integer))
    op.add_column("sifen_timbrados", sa.Column("activo", sa.Boolean, server_default="true"))

    op.drop_column("sifen_timbrados", "punto_emision_inicio")
    op.drop_column("sifen_timbrados", "punto_emision_fin")
    op.drop_column("sifen_timbrados", "estado")

    op.alter_column("sifen_timbrados", "rango_desde", nullable=False)
    op.alter_column("sifen_timbrados", "rango_hasta", nullable=False)


def downgrade() -> None:
    op.add_column("sifen_timbrados", sa.Column("punto_emision_inicio", sa.Integer))
    op.add_column("sifen_timbrados", sa.Column("punto_emision_fin", sa.Integer))
    op.add_column("sifen_timbrados", sa.Column("estado", sa.String(20)))
    op.drop_column("sifen_timbrados", "activo")
    op.drop_column("sifen_timbrados", "rango_hasta")
    op.drop_column("sifen_timbrados", "rango_desde")
