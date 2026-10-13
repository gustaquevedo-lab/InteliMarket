"""create fiscal_config, timbrado_usage, notas_credito_debito — these tables
never existed in prod even though the models/service/router have existed for
a while; the whole fiscal module (config, NC/ND, usage tracking) has been
non-functional against production since it was written. Discovered while
wiring the autoimpresor invoice-numbering flow for Extra Supermercado.

Revision ID: 20260809000000
Revises: 20260808000000
Create Date: 2026-08-09 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlalchemy.dialects.postgresql


revision: str = "20260809000000"
down_revision: Union[str, None] = "20260808000000"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "fiscal_config",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("company_id", sa.dialects.postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("modo_emision", sa.String(20), nullable=False, server_default="sifen"),
        sa.Column("timbrado_id", sa.dialects.postgresql.UUID(as_uuid=True), sa.ForeignKey("sifen_timbrados.id")),
        sa.Column("punto_emision", sa.String(10), server_default="001"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_fiscal_config_company_id", "fiscal_config", ["company_id"])

    op.create_table(
        "timbrado_usage",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("timbrado_id", sa.dialects.postgresql.UUID(as_uuid=True), sa.ForeignKey("sifen_timbrados.id"), nullable=False),
        sa.Column("company_id", sa.dialects.postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("numero_utilizado", sa.Integer, nullable=False),
        sa.Column("sale_id", sa.dialects.postgresql.UUID(as_uuid=True)),
        sa.Column("tipo_documento", sa.String(20), nullable=False),
        sa.Column("used_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_timbrado_usage_timbrado_id", "timbrado_usage", ["timbrado_id"])
    op.create_index("ix_timbrado_usage_company_id", "timbrado_usage", ["company_id"])

    op.create_table(
        "notas_credito_debito",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("company_id", sa.dialects.postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("sale_id", sa.dialects.postgresql.UUID(as_uuid=True), sa.ForeignKey("sales.id"), nullable=False),
        sa.Column("tipo", sa.String(20), nullable=False),
        sa.Column("numero", sa.String(20), nullable=False),
        sa.Column("cdc", sa.String(44)),
        sa.Column("timbrado_numero", sa.String(20)),
        sa.Column("numero_preimpreso", sa.String(20)),
        sa.Column("motivo", sa.Text, nullable=False),
        sa.Column("subtotal", sa.Numeric(15, 0), nullable=False),
        sa.Column("descuento_total", sa.Numeric(15, 0), server_default="0"),
        sa.Column("base_gravada_10", sa.Numeric(15, 0), server_default="0"),
        sa.Column("base_gravada_5", sa.Numeric(15, 0), server_default="0"),
        sa.Column("base_exenta", sa.Numeric(15, 0), server_default="0"),
        sa.Column("iva_10", sa.Numeric(15, 0), server_default="0"),
        sa.Column("iva_5", sa.Numeric(15, 0), server_default="0"),
        sa.Column("total", sa.Numeric(15, 0), nullable=False),
        sa.Column("sifen_estado", sa.String(20)),
        sa.Column("sifen_xml_sent", sa.Text),
        sa.Column("sifen_xml_response", sa.Text),
        sa.Column("estado", sa.String(20), nullable=False, server_default="pendiente"),
        sa.Column("user_id", sa.dialects.postgresql.UUID(as_uuid=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_notas_credito_debito_company_id", "notas_credito_debito", ["company_id"])
    op.create_index("ix_notas_credito_debito_sale_id", "notas_credito_debito", ["sale_id"])


def downgrade() -> None:
    op.drop_table("notas_credito_debito")
    op.drop_table("timbrado_usage")
    op.drop_table("fiscal_config")
