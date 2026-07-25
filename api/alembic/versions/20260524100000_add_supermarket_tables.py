"""add supermarket tables (production, perishables, waste, forecasting)

Revision ID: 20260524100000
Revises: 20260524000000
Create Date: 2026-05-24 10:00:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "20260524100000"
down_revision: Union[str, None] = "20260524000000"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Supermarket recipes (BOM)
    op.create_table(
        "supermer_recipes",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("company_id", sa.UUID(), nullable=False, index=True),
        sa.Column("area", sa.String(20), nullable=False),
        sa.Column("nombre", sa.String(200), nullable=False),
        sa.Column("descripcion", sa.Text()),
        sa.Column("producto_terminado_id", sa.UUID(), sa.ForeignKey("products.id"), nullable=False),
        sa.Column("cantidad_esperada", sa.Numeric(12, 3), nullable=False),
        sa.Column("unidad_medida", sa.String(10), server_default="UN"),
        sa.Column("rendimiento_esperado", sa.Numeric(5, 2), server_default="100"),
        sa.Column("activa", sa.Boolean(), server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Index("ix_supermer_recipes_company_area", "company_id", "area"),
    )

    # Recipe items (inputs)
    op.create_table(
        "supermer_recipe_items",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("receta_id", sa.UUID(), sa.ForeignKey("supermer_recipes.id"), nullable=False),
        sa.Column("producto_id", sa.UUID(), sa.ForeignKey("products.id"), nullable=False),
        sa.Column("cantidad", sa.Numeric(12, 3), nullable=False),
        sa.Column("unidad_medida", sa.String(10), server_default="UN"),
        sa.Column("es_opcional", sa.Boolean(), server_default=sa.text("false")),
        sa.Index("ix_supermer_recipe_items_receta", "receta_id"),
    )

    # Production orders
    op.create_table(
        "supermer_production_orders",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("company_id", sa.UUID(), nullable=False, index=True),
        sa.Column("receta_id", sa.UUID(), sa.ForeignKey("supermer_recipes.id")),
        sa.Column("area", sa.String(20), nullable=False),
        sa.Column("cantidad_objetivo", sa.Numeric(12, 3), nullable=False),
        sa.Column("estado", sa.String(20), nullable=False, server_default="planificada"),
        sa.Column("fecha_inicio", sa.DateTime(timezone=True)),
        sa.Column("fecha_fin", sa.DateTime(timezone=True)),
        sa.Column("fecha_vencimiento", sa.Date()),
        sa.Column("responsable_id", sa.UUID(), sa.ForeignKey("users.id")),
        sa.Column("notas", sa.Text()),
        sa.Column("insumos_usados", postgresql.JSONB()),
        sa.Column("producto_obtenido", sa.Numeric(12, 3)),
        sa.Column("rendimiento_real", sa.Numeric(5, 2)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Index("ix_supermer_orders_company_area", "company_id", "area"),
        sa.Index("ix_supermer_orders_estado", "estado"),
    )

    # Production batches (lot tracking)
    op.create_table(
        "supermer_production_batches",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("company_id", sa.UUID(), nullable=False, index=True),
        sa.Column("orden_id", sa.UUID(), sa.ForeignKey("supermer_production_orders.id")),
        sa.Column("producto_id", sa.UUID(), sa.ForeignKey("products.id"), nullable=False),
        sa.Column("cantidad_obtenida", sa.Numeric(12, 3), nullable=False),
        sa.Column("fecha_produccion", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("fecha_vencimiento", sa.Date(), nullable=False),
        sa.Column("lote_codigo", sa.String(50)),
        sa.Column("costo_unitario", sa.Numeric(12, 2)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Index("ix_supermer_batches_producto", "producto_id"),
        sa.Index("ix_supermer_batches_vencimiento", "fecha_vencimiento"),
    )

    # Waste/merma logs
    op.create_table(
        "supermer_waste_logs",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("company_id", sa.UUID(), nullable=False, index=True),
        sa.Column("area", sa.String(20), nullable=False),
        sa.Column("producto_id", sa.UUID(), sa.ForeignKey("products.id"), nullable=False),
        sa.Column("cantidad", sa.Numeric(12, 3), nullable=False),
        sa.Column("costo_unitario", sa.Numeric(12, 2)),
        sa.Column("costo_total", sa.Numeric(12, 2)),
        sa.Column("tipo_merma", sa.String(20), nullable=False),
        sa.Column("motivo", sa.Text()),
        sa.Column("fecha", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("registrado_por", sa.UUID(), sa.ForeignKey("users.id")),
        sa.Index("ix_supermer_waste_company_area", "company_id", "area"),
        sa.Index("ix_supermer_waste_fecha", "fecha"),
    )

    # Perishable product configs
    op.create_table(
        "supermer_perishable_configs",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("company_id", sa.UUID(), nullable=False, index=True),
        sa.Column("producto_id", sa.UUID(), sa.ForeignKey("products.id"), nullable=False, unique=True),
        sa.Column("vida_util_dias", sa.Integer(), nullable=False),
        sa.Column("requiere_markdown", sa.Boolean(), server_default=sa.text("true")),
        sa.Column("categoria_perecedera", sa.String(20), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Index("ix_supermer_perishable_company", "company_id"),
    )

    # Markdown logs
    op.create_table(
        "supermer_markdown_logs",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("company_id", sa.UUID(), nullable=False, index=True),
        sa.Column("producto_id", sa.UUID(), sa.ForeignKey("products.id"), nullable=False),
        sa.Column("lote_id", sa.UUID(), sa.ForeignKey("supermer_production_batches.id")),
        sa.Column("descuento_porcentaje", sa.Numeric(5, 2), nullable=False),
        sa.Column("precio_original", sa.Numeric(12, 2), nullable=False),
        sa.Column("precio_markdown", sa.Numeric(12, 2), nullable=False),
        sa.Column("fecha_inicio", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("fecha_fin", sa.DateTime(timezone=True)),
        sa.Column("activo", sa.Boolean(), server_default=sa.text("true")),
        sa.Column("creado_por", sa.UUID(), sa.ForeignKey("users.id")),
        sa.Column("motivo", sa.String(200)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Index("ix_supermer_markdown_producto", "producto_id"),
        sa.Index("ix_supermer_markdown_activo", "activo"),
    )

    # Purchase forecasts
    op.create_table(
        "supermer_purchase_forecasts",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("company_id", sa.UUID(), nullable=False, index=True),
        sa.Column("producto_id", sa.UUID(), sa.ForeignKey("products.id"), nullable=False),
        sa.Column("fecha_pronosticada", sa.Date(), nullable=False),
        sa.Column("cantidad_pronosticada", sa.Numeric(12, 3), nullable=False),
        sa.Column("confianza", sa.Numeric(5, 2)),
        sa.Column("fecha_generacion", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("periodo_used", sa.Integer(), server_default="90"),
        sa.Index("ix_supermer_forecast_producto_fecha", "producto_id", "fecha_pronosticada"),
    )

    # Purchase suggestions
    op.create_table(
        "supermer_purchase_suggestions",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("company_id", sa.UUID(), nullable=False, index=True),
        sa.Column("producto_id", sa.UUID(), sa.ForeignKey("products.id"), nullable=False),
        sa.Column("proveedor_id", sa.UUID(), sa.ForeignKey("suppliers.id")),
        sa.Column("cantidad_sugerida", sa.Numeric(12, 3), nullable=False),
        sa.Column("cantidad_stock_actual", sa.Numeric(12, 3), server_default="0"),
        sa.Column("cantidad_pendiente_recibir", sa.Numeric(12, 3), server_default="0"),
        sa.Column("cantidad_pronosticada", sa.Numeric(12, 3)),
        sa.Column("lead_time_dias", sa.Integer()),
        sa.Column("fecha_sugerida_pedido", sa.Date()),
        sa.Column("fecha_sugerida_llegada", sa.Date()),
        sa.Column("precio_estimado", sa.Numeric(12, 2)),
        sa.Column("costo_estimado_total", sa.Numeric(12, 2)),
        sa.Column("estado", sa.String(20), nullable=False, server_default="pendiente"),
        sa.Column("notas", sa.Text()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Index("ix_supermer_suggestions_estado", "estado"),
        sa.Index("ix_supermer_suggestions_company", "company_id"),
    )


def downgrade() -> None:
    op.drop_table("supermer_purchase_suggestions")
    op.drop_table("supermer_purchase_forecasts")
    op.drop_table("supermer_markdown_logs")
    op.drop_table("supermer_perishable_configs")
    op.drop_table("supermer_waste_logs")
    op.drop_table("supermer_production_batches")
    op.drop_table("supermer_production_orders")
    op.drop_table("supermer_recipe_items")
    op.drop_table("supermer_recipes")
