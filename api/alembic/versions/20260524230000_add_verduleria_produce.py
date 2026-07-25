"""add verdulería produce management (receive batches, freshness audits, supplier scorecards, enhanced forecast)

Revision ID: 20260524230000
Revises: 20260524220000
Create Date: 2026-05-24 23:00:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "20260524230000"
down_revision: Union[str, None] = "20260524220000"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── Receive batches (recepción con calidad) ─────────────
    op.create_table(
        "supermer_receive_batches",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("company_id", sa.UUID(), nullable=False, index=True),
        sa.Column("producto_id", sa.UUID(), sa.ForeignKey("products.id"), nullable=False),
        sa.Column("proveedor_id", sa.UUID(), sa.ForeignKey("suppliers.id")),
        sa.Column("cantidad_recibida", sa.Numeric(12, 3), nullable=False),
        sa.Column("cantidad_aceptada", sa.Numeric(12, 3)),
        sa.Column("calidad", sa.String(20), nullable=False, server_default="estandar"),
        sa.Column("precio_unitario", sa.Numeric(12, 2)),
        sa.Column("fecha_recepcion", sa.Date(), nullable=False, server_default=sa.func.current_date()),
        sa.Column("fecha_vencimiento_estimada", sa.Date()),
        sa.Column("lote_proveedor", sa.String(100)),
        sa.Column("lote_codigo_interno", sa.String(50)),
        sa.Column("nota_calidad", sa.Text()),
        sa.Column("rechazo_motivo", sa.String(200)),
        sa.Column("registrado_por", sa.UUID(), sa.ForeignKey("users.id")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Index("ix_supermer_receive_company", "company_id"),
        sa.Index("ix_supermer_receive_producto", "producto_id"),
        sa.Index("ix_supermer_receive_proveedor", "proveedor_id"),
        sa.Index("ix_supermer_receive_fecha", "fecha_recepcion"),
    )

    # ── Freshness audits (auditoría diaria de frescura) ─────
    op.create_table(
        "supermer_freshness_audits",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("company_id", sa.UUID(), nullable=False, index=True),
        sa.Column("producto_id", sa.UUID(), sa.ForeignKey("products.id"), nullable=False),
        sa.Column("batch_id", sa.UUID(), sa.ForeignKey("supermer_receive_batches.id")),
        sa.Column("calidad_actual", sa.String(10), nullable=False),
        sa.Column("firmeza", sa.Integer()),
        sa.Column("color", sa.Integer()),
        sa.Column("aspecto_general", sa.Integer()),
        sa.Column("notas", sa.Text()),
        sa.Column("audited_by", sa.UUID(), sa.ForeignKey("users.id")),
        sa.Column("audited_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("triggered_markdown", sa.Boolean(), server_default=sa.text("false")),
        sa.Index("ix_supermer_freshness_producto", "producto_id"),
        sa.Index("ix_supermer_freshness_fecha", "audited_at"),
    )

    # ── Supplier scorecards ────────────────────────────────
    op.create_table(
        "supermer_supplier_scorecards",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("company_id", sa.UUID(), nullable=False, index=True),
        sa.Column("proveedor_id", sa.UUID(), sa.ForeignKey("suppliers.id"), nullable=False),
        sa.Column("producto_id", sa.UUID(), sa.ForeignKey("products.id"), nullable=False),
        sa.Column("total_recibido", sa.Numeric(12, 3), server_default="0"),
        sa.Column("calidad_promedio", sa.String(20)),
        sa.Column("merma_porcentaje", sa.Numeric(5, 2), server_default="0"),
        sa.Column("rechazos", sa.Integer(), server_default="0"),
        sa.Column("entregas_puntuales", sa.Integer(), server_default="0"),
        sa.Column("total_entregas", sa.Integer(), server_default="0"),
        sa.Column("precio_promedio", sa.Numeric(12, 2)),
        sa.Column("puntaje_general", sa.Numeric(5, 2)),
        sa.Column("recomendacion", sa.String(20), server_default="preferido"),
        sa.Column("periodo_inicio", sa.Date()),
        sa.Column("periodo_fin", sa.Date()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Index("ix_supermer_scorecard_proveedor_producto", "proveedor_id", "producto_id"),
    )

    # ── Add receive_batch_id to existing markdown_logs ──────
    op.add_column("supermer_markdown_logs",
        sa.Column("receive_batch_id", sa.UUID(), sa.ForeignKey("supermer_receive_batches.id"))
    )

    # ── Add seasonality fields to existing purchase_forecasts ──
    op.add_column("supermer_purchase_forecasts",
        sa.Column("estacionalidad_factor", sa.Numeric(5, 2), server_default="1.0")
    )
    op.add_column("supermer_purchase_forecasts",
        sa.Column("venta_semana_anterior", sa.Numeric(12, 3))
    )
    op.add_column("supermer_purchase_forecasts",
        sa.Column("venta_misma_semana_anio_anterior", sa.Numeric(12, 3))
    )
    op.add_column("supermer_purchase_forecasts",
        sa.Column("precio_promedio_semana", sa.Numeric(12, 2))
    )
    op.add_column("supermer_purchase_forecasts",
        sa.Column("calidad_promedio_recepcion", sa.String(20))
    )
    op.add_column("supermer_purchase_forecasts",
        sa.Column("dias_ultima_lluvia", sa.Integer())
    )
    op.add_column("supermer_purchase_forecasts",
        sa.Column("temperatura_promedio_c", sa.Numeric(4, 1))
    )


def downgrade() -> None:
    op.drop_column("supermer_purchase_forecasts", "temperatura_promedio_c")
    op.drop_column("supermer_purchase_forecasts", "dias_ultima_lluvia")
    op.drop_column("supermer_purchase_forecasts", "calidad_promedio_recepcion")
    op.drop_column("supermer_purchase_forecasts", "precio_promedio_semana")
    op.drop_column("supermer_purchase_forecasts", "venta_misma_semana_anio_anterior")
    op.drop_column("supermer_purchase_forecasts", "venta_semana_anterior")
    op.drop_column("supermer_purchase_forecasts", "estacionalidad_factor")
    op.drop_column("supermer_markdown_logs", "receive_batch_id")
    op.drop_table("supermer_supplier_scorecards")
    op.drop_table("supermer_freshness_audits")
    op.drop_table("supermer_receive_batches")
