"""Add Supermercado Fase 3 tables (Pricing, ESL, Promos, Dynamic Markdown)

Revision ID: 20260601290000
Revises: 20260601280000
Create Date: 2026-06-02 04:00:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision: str = "20260601290000"
down_revision: Union[str, None] = "20260601280000"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ============================================================
    # PRICE ZONES
    # ============================================================
    op.create_table(
        "supermer_price_zones",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("nombre", sa.String(100), nullable=False),
        sa.Column("descripcion", sa.Text()),
        sa.Column("tipo", sa.String(20), nullable=False),
        sa.Column("activa", sa.Boolean(), server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )

    # ============================================================
    # COMPETITOR PRICES
    # ============================================================
    op.create_table(
        "supermer_competitor_prices",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("producto_id", UUID(as_uuid=True), nullable=False),
        sa.Column("competidor", sa.String(100), nullable=False),
        sa.Column("precio", sa.Numeric(12, 2), nullable=False),
        sa.Column("fecha_captura", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("fuente", sa.String(20), server_default="manual"),
        sa.Column("diferencia_pct", sa.Numeric(5, 2)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Index("ix_competitor_price_producto", "company_id", "producto_id", "competidor"),
    )

    # ============================================================
    # PRICE AUDIT LOGS
    # ============================================================
    op.create_table(
        "supermer_price_audit_logs",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("producto_id", UUID(as_uuid=True), nullable=False),
        sa.Column("precio_anterior", sa.Numeric(12, 2)),
        sa.Column("precio_nuevo", sa.Numeric(12, 2)),
        sa.Column("diferencia_pct", sa.Numeric(5, 2)),
        sa.Column("motivo", sa.String(200), nullable=False),
        sa.Column("cambiado_por", UUID(as_uuid=True), nullable=False),
        sa.Column("cambiado_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("requiere_aprobacion", sa.Boolean(), server_default="false"),
        sa.Column("aprobado_por", UUID(as_uuid=True)),
        sa.Column("aprobado_at", sa.DateTime(timezone=True)),
        sa.Column("estado", sa.String(20), server_default="aplicado"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )

    # ============================================================
    # PSYCHOLOGICAL PRICE RULES
    # ============================================================
    op.create_table(
        "supermer_psychological_rules",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("nombre", sa.String(100), nullable=False),
        sa.Column("tipo_redondeo", sa.String(20), nullable=False),
        sa.Column("limite_superior", sa.Numeric(12, 2)),
        sa.Column("activa", sa.Boolean(), server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )

    # ============================================================
    # ESL ZONES
    # ============================================================
    op.create_table(
        "supermer_esl_zones",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("nombre", sa.String(100), nullable=False),
        sa.Column("descripcion", sa.Text()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )

    # ============================================================
    # ESL DEVICES
    # ============================================================
    op.create_table(
        "supermer_esl_devices",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("codigo_dispositivo", sa.String(50), nullable=False),
        sa.Column("producto_id", UUID(as_uuid=True)),
        sa.Column("precio_actual", sa.Numeric(12, 2)),
        sa.Column("ubicacion", sa.String(100)),
        sa.Column("zona_id", UUID(as_uuid=True)),
        sa.Column("estado", sa.String(20), server_default="online"),
        sa.Column("bateria_pct", sa.Integer()),
        sa.Column("ultima_sync", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )

    # ============================================================
    # ESL PRICE SYNCS
    # ============================================================
    op.create_table(
        "supermer_esl_price_syncs",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("esl_device_id", UUID(as_uuid=True), nullable=False),
        sa.Column("producto_id", UUID(as_uuid=True), nullable=False),
        sa.Column("precio_anterior", sa.Numeric(12, 2)),
        sa.Column("precio_nuevo", sa.Numeric(12, 2)),
        sa.Column("estado", sa.String(20), server_default="pendiente"),
        sa.Column("intentos", sa.Integer(), server_default="0"),
        sa.Column("error_msg", sa.Text()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("completado_at", sa.DateTime(timezone=True)),
    )

    # ============================================================
    # PROMO CALENDAR
    # ============================================================
    op.create_table(
        "supermer_promo_calendar",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("nombre", sa.String(200), nullable=False),
        sa.Column("descripcion", sa.Text()),
        sa.Column("fecha_inicio", sa.Date(), nullable=False),
        sa.Column("fecha_fin", sa.Date(), nullable=False),
        sa.Column("tipo", sa.String(30), nullable=False),
        sa.Column("presupuesto_asignado", sa.Numeric(14, 2)),
        sa.Column("estado", sa.String(20), server_default="planificado"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Index("ix_promo_calendar_fechas", "company_id", "fecha_inicio", "fecha_fin"),
    )

    # ============================================================
    # PROMO BUDGETS
    # ============================================================
    op.create_table(
        "supermer_promo_budgets",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("promo_id", UUID(as_uuid=True), nullable=False),
        sa.Column("categoria", sa.String(50), nullable=False),
        sa.Column("presupuesto_planificado", sa.Numeric(14, 2)),
        sa.Column("gasto_real", sa.Numeric(14, 2)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )

    # ============================================================
    # PROMO EFFECTIVENESS
    # ============================================================
    op.create_table(
        "supermer_promo_effectiveness",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("promo_id", UUID(as_uuid=True), nullable=False),
        sa.Column("producto_id", UUID(as_uuid=True)),
        sa.Column("ventas_durante", sa.Numeric(14, 2)),
        sa.Column("ventas_antes", sa.Numeric(14, 2)),
        sa.Column("ventas_despues", sa.Numeric(14, 2)),
        sa.Column("lift_pct", sa.Numeric(5, 2)),
        sa.Column("margen_incremental", sa.Numeric(14, 2)),
        sa.Column("canibalizacion_pct", sa.Numeric(5, 2)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )

    # ============================================================
    # DYNAMIC MARKDOWN RULES
    # ============================================================
    op.create_table(
        "supermer_dynamic_markdown_rules",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("producto_id", UUID(as_uuid=True)),
        sa.Column("categoria", sa.String(50)),
        sa.Column("estrategia", sa.String(20), nullable=False),
        sa.Column("descuento_maximo_pct", sa.Numeric(5, 2), nullable=False),
        sa.Column("descuento_minimo_pct", sa.Numeric(5, 2)),
        sa.Column("horas_limite", sa.Integer()),
        sa.Column("activa", sa.Boolean(), server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Index("ix_dynamic_markdown_producto", "company_id", "producto_id"),
    )

    # ============================================================
    # MARKDOWN RECOMMENDATIONS
    # ============================================================
    op.create_table(
        "supermer_markdown_recommendations",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("producto_id", UUID(as_uuid=True), nullable=False),
        sa.Column("precio_original", sa.Numeric(12, 2), nullable=False),
        sa.Column("descuento_recomendado_pct", sa.Numeric(5, 2), nullable=False),
        sa.Column("precio_recomendado", sa.Numeric(12, 2), nullable=False),
        sa.Column("motivo", sa.String(100)),
        sa.Column("score_urgencia", sa.Integer()),
        sa.Column("aplicada", sa.Boolean(), server_default="false"),
        sa.Column("aplicada_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )


def downgrade() -> None:
    op.drop_table("supermer_markdown_recommendations")
    op.drop_table("supermer_dynamic_markdown_rules")
    op.drop_table("supermer_promo_effectiveness")
    op.drop_table("supermer_promo_budgets")
    op.drop_table("supermer_promo_calendar")
    op.drop_table("supermer_esl_price_syncs")
    op.drop_table("supermer_esl_devices")
    op.drop_table("supermer_esl_zones")
    op.drop_table("supermer_psychological_rules")
    op.drop_table("supermer_price_audit_logs")
    op.drop_table("supermer_competitor_prices")
    op.drop_table("supermer_price_zones")
