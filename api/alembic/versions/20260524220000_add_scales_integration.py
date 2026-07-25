"""add scale integration tables (configs, weight logs, PLU syncs, label templates)

Revision ID: 20260524220000
Revises: 20260524200000
Create Date: 2026-05-24 22:00:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "20260524220000"
down_revision: Union[str, None] = "20260524200000"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── Scale Configs ──────────────────────────────────────
    op.create_table(
        "scale_configs",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("company_id", sa.UUID(), nullable=False, index=True),
        sa.Column("nombre", sa.String(100), nullable=False),
        sa.Column("marca", sa.String(30), nullable=False),
        sa.Column("modelo", sa.String(100)),
        sa.Column("protocolo", sa.String(30), nullable=False),
        sa.Column("conexion", sa.String(20), nullable=False),
        sa.Column("puerto_com", sa.String(20)),
        sa.Column("baudrate", sa.Integer(), server_default="9600"),
        sa.Column("data_bits", sa.Integer(), server_default="8"),
        sa.Column("paridad", sa.String(10), server_default="N"),
        sa.Column("stop_bits", sa.String(5), server_default="1"),
        sa.Column("handshaking", sa.String(20)),
        sa.Column("host", sa.String(255)),
        sa.Column("puerto_tcp", sa.Integer(), server_default="9000"),
        sa.Column("timeout_segundos", sa.Integer(), server_default="5"),
        sa.Column("vendor_id", sa.String(10)),
        sa.Column("product_id", sa.String(10)),
        sa.Column("ruta_carga", sa.String(500)),
        sa.Column("sync_automatico", sa.Boolean(), server_default=sa.text("false")),
        sa.Column("etiqueta_formato", sa.String(50), server_default="40x30"),
        sa.Column("etiqueta_cabecera", sa.String(200)),
        sa.Column("activa", sa.Boolean(), server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Index("ix_scale_configs_company", "company_id"),
    )

    # ── Scale Weight Logs ──────────────────────────────────
    op.create_table(
        "scale_weight_logs",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("company_id", sa.UUID(), nullable=False, index=True),
        sa.Column("scale_id", sa.UUID(), sa.ForeignKey("scale_configs.id"), nullable=False),
        sa.Column("peso_bruto", sa.Numeric(10, 3), nullable=False),
        sa.Column("peso_neto", sa.Numeric(10, 3)),
        sa.Column("tara", sa.Numeric(10, 3), server_default="0"),
        sa.Column("unidad", sa.String(10), server_default="kg"),
        sa.Column("estable", sa.Boolean(), server_default=sa.text("true")),
        sa.Column("producto_id", sa.UUID(), sa.ForeignKey("products.id")),
        sa.Column("origen", sa.String(50)),
        sa.Column("fecha", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("metadata", postgresql.JSONB),
        sa.Index("ix_scale_weight_logs_scale", "scale_id"),
        sa.Index("ix_scale_weight_logs_fecha", "fecha"),
    )

    # ── PLU Syncs ──────────────────────────────────────────
    op.create_table(
        "scale_plu_syncs",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("company_id", sa.UUID(), nullable=False, index=True),
        sa.Column("scale_id", sa.UUID(), sa.ForeignKey("scale_configs.id"), nullable=False),
        sa.Column("total_productos", sa.Integer(), nullable=False),
        sa.Column("exitosos", sa.Integer(), nullable=False),
        sa.Column("fallidos", sa.Integer(), server_default="0"),
        sa.Column("modo", sa.String(20), server_default="incremental"),
        sa.Column("archivo_generado", sa.String(500)),
        sa.Column("resultado", postgresql.JSONB),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Index("ix_scale_plu_syncs_scale", "scale_id"),
    )

    # ── Label Templates ────────────────────────────────────
    op.create_table(
        "scale_label_templates",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("company_id", sa.UUID(), nullable=False, index=True),
        sa.Column("nombre", sa.String(100), nullable=False),
        sa.Column("ancho_mm", sa.Integer(), server_default="40"),
        sa.Column("alto_mm", sa.Integer(), server_default="30"),
        sa.Column("campos", postgresql.JSONB(), nullable=False),
        sa.Column("incluir_barcode", sa.Boolean(), server_default=sa.text("true")),
        sa.Column("incluir_precio", sa.Boolean(), server_default=sa.text("true")),
        sa.Column("incluir_peso", sa.Boolean(), server_default=sa.text("true")),
        sa.Column("incluir_info_nutricional", sa.Boolean(), server_default=sa.text("false")),
        sa.Column("incluir_logo", sa.Boolean(), server_default=sa.text("false")),
        sa.Column("activo", sa.Boolean(), server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Index("ix_scale_label_templates_company", "company_id"),
    )


def downgrade() -> None:
    op.drop_table("scale_label_templates")
    op.drop_table("scale_plu_syncs")
    op.drop_table("scale_weight_logs")
    op.drop_table("scale_configs")
