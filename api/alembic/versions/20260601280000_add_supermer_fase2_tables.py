"""Add Supermercado Fase 2 tables (DSD, Inventory, Replenishment, Returns)

Revision ID: 20260601280000
Revises: 20260601270000
Create Date: 2026-06-02 03:00:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSON

revision: str = "20260601280000"
down_revision: Union[str, None] = "20260601270000"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ============================================================
    # DSD RECEIVING
    # ============================================================

    op.create_table(
        "supermer_dsd_schedules",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("proveedor_id", UUID(as_uuid=True), nullable=False),
        sa.Column("numero_oc", sa.String(50), nullable=False),
        sa.Column("fecha_programada", sa.Date(), nullable=False, index=True),
        sa.Column("ventana_inicio", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ventana_fin", sa.DateTime(timezone=True), nullable=False),
        sa.Column("muelle", sa.String(20)),
        sa.Column("tipo_carga", sa.String(20), nullable=False, server_default="seco"),
        sa.Column("transportista", sa.String(100)),
        sa.Column("patente", sa.String(20)),
        sa.Column("conductor", sa.String(100)),
        sa.Column("conductor_telefono", sa.String(20)),
        sa.Column("total_bultos_estimado", sa.Integer()),
        sa.Column("total_peso_estimado_kg", sa.Numeric(8, 2)),
        sa.Column("estado", sa.String(20), nullable=False, server_default="programada"),
        sa.Column("notas", sa.Text()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Index("ix_dsd_schedule_fecha_proveedor", "company_id", "fecha_programada", "proveedor_id"),
    )

    op.create_table(
        "supermer_dsd_receivings",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("schedule_id", UUID(as_uuid=True), nullable=False),
        sa.Column("proveedor_id", UUID(as_uuid=True), nullable=False),
        sa.Column("numero_oc", sa.String(50), nullable=False),
        sa.Column("numero_remito", sa.String(50)),
        sa.Column("fecha_recepcion", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("recibido_por", UUID(as_uuid=True), nullable=False),
        sa.Column("total_bultos_recibidos", sa.Integer()),
        sa.Column("total_bultos_rechazados", sa.Integer(), server_default="0"),
        sa.Column("temp_ambiente_descarga", sa.Numeric(4, 1)),
        sa.Column("temp_check_method", sa.String(20), server_default="manual"),
        sa.Column("hora_inicio", sa.DateTime(timezone=True)),
        sa.Column("hora_fin", sa.DateTime(timezone=True)),
        sa.Column("estado", sa.String(20), server_default="en_curso"),
        sa.Column("observaciones", sa.Text()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Index("ix_dsd_receiving_fecha", "company_id", "fecha_recepcion"),
    )

    op.create_table(
        "supermer_dsd_receiving_items",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("receiving_id", UUID(as_uuid=True), nullable=False),
        sa.Column("producto_id", UUID(as_uuid=True), nullable=False),
        sa.Column("cantidad_solicitada", sa.Numeric(12, 3), nullable=False),
        sa.Column("cantidad_recibida", sa.Numeric(12, 3), nullable=False),
        sa.Column("cantidad_aceptada", sa.Numeric(12, 3)),
        sa.Column("temperatura_producto", sa.Numeric(4, 1)),
        sa.Column("temp_conforme", sa.Boolean()),
        sa.Column("lote", sa.String(50)),
        sa.Column("fecha_vencimiento", sa.Date()),
        sa.Column("condicion_visual", sa.String(50)),
        sa.Column("inspeccion_conforme", sa.Boolean(), server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )

    op.create_table(
        "supermer_dsd_rejections",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("receiving_id", UUID(as_uuid=True), nullable=False),
        sa.Column("item_id", UUID(as_uuid=True), nullable=False),
        sa.Column("producto_id", UUID(as_uuid=True), nullable=False),
        sa.Column("cantidad_rechazada", sa.Numeric(12, 3), nullable=False),
        sa.Column("motivo", sa.String(50), nullable=False),
        sa.Column("detalle", sa.Text()),
        sa.Column("foto_evidencia_url", sa.String(500)),
        sa.Column("genera_nota_credito", sa.Boolean(), server_default="true"),
        sa.Column("nota_credito_numero", sa.String(50)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("resuelto", sa.Boolean(), server_default="false"),
        sa.Column("resuelto_at", sa.DateTime(timezone=True)),
    )

    # ============================================================
    # PHYSICAL INVENTORY
    # ============================================================

    op.create_table(
        "supermer_count_sessions",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("codigo", sa.String(20), nullable=False),
        sa.Column("area", sa.String(50), nullable=False),
        sa.Column("ubicacion", sa.String(100)),
        sa.Column("tipo", sa.String(20), server_default="ciclico"),
        sa.Column("abc_category", sa.String(5)),
        sa.Column("contador_principal", UUID(as_uuid=True)),
        sa.Column("contador_verificador", UUID(as_uuid=True)),
        sa.Column("fecha_inicio", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("fecha_fin", sa.DateTime(timezone=True)),
        sa.Column("estado", sa.String(20), server_default="abierta"),
        sa.Column("total_items_sistema", sa.Integer(), server_default="0"),
        sa.Column("total_items_contados", sa.Integer(), server_default="0"),
        sa.Column("total_discrepancias", sa.Integer(), server_default="0"),
        sa.Column("valor_discrepancia_total", sa.Numeric(14, 2), server_default="0"),
        sa.Column("requiere_doble_conteo", sa.Boolean(), server_default="false"),
        sa.Column("notas", sa.Text()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Index("ix_count_session_area", "company_id", "area", "estado"),
    )

    op.create_table(
        "supermer_count_items",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("session_id", UUID(as_uuid=True), nullable=False),
        sa.Column("producto_id", UUID(as_uuid=True), nullable=False),
        sa.Column("codigo_barra", sa.String(50)),
        sa.Column("cantidad_sistema", sa.Numeric(12, 3), nullable=False),
        sa.Column("cantidad_contada", sa.Numeric(12, 3)),
        sa.Column("cantidad_verificada", sa.Numeric(12, 3)),
        sa.Column("diferencia", sa.Numeric(12, 3)),
        sa.Column("costo_promedio", sa.Numeric(12, 2)),
        sa.Column("valor_diferencia", sa.Numeric(14, 2)),
        sa.Column("lote", sa.String(50)),
        sa.Column("fecha_vencimiento", sa.Date()),
        sa.Column("conforme", sa.Boolean()),
        sa.Column("requiere_ajuste", sa.Boolean(), server_default="false"),
        sa.Column("contado_por", UUID(as_uuid=True)),
        sa.Column("verificado_por", UUID(as_uuid=True)),
        sa.Column("contado_at", sa.DateTime(timezone=True)),
        sa.Column("verificado_at", sa.DateTime(timezone=True)),
        sa.Column("foto_evidencia_url", sa.String(500)),
        sa.Column("observaciones", sa.Text()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Index("ix_count_item_session", "session_id", "producto_id"),
    )

    op.create_table(
        "supermer_count_adjustments",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("session_id", UUID(as_uuid=True), nullable=False),
        sa.Column("count_item_id", UUID(as_uuid=True), nullable=False),
        sa.Column("producto_id", UUID(as_uuid=True), nullable=False),
        sa.Column("tipo", sa.String(20), nullable=False),
        sa.Column("cantidad_ajuste", sa.Numeric(12, 3), nullable=False),
        sa.Column("costo_unitario", sa.Numeric(12, 2)),
        sa.Column("valor_ajuste", sa.Numeric(14, 2)),
        sa.Column("motivo", sa.String(200)),
        sa.Column("aprobado_por", UUID(as_uuid=True)),
        sa.Column("aprobado_at", sa.DateTime(timezone=True)),
        sa.Column("estado", sa.String(20), server_default="pendiente"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )

    # ============================================================
    # REPLENISHMENT
    # ============================================================

    op.create_table(
        "supermer_replenishment_rules",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("producto_id", UUID(as_uuid=True), nullable=False, unique=True),
        sa.Column("proveedor_preferente_id", UUID(as_uuid=True)),
        sa.Column("proveedor_secundario_id", UUID(as_uuid=True)),
        sa.Column("lead_time_dias", sa.Integer(), nullable=False),
        sa.Column("stock_seguridad_dias", sa.Integer(), server_default="3"),
        sa.Column("stock_seguridad_unidades", sa.Numeric(12, 3)),
        sa.Column("lote_economico", sa.Numeric(12, 3)),
        sa.Column("multiplo_pedido", sa.Numeric(12, 3)),
        sa.Column("cantidad_minima_pedido", sa.Numeric(12, 3)),
        sa.Column("punto_pedido", sa.Numeric(12, 3)),
        sa.Column("metodo_pronostico", sa.String(20), server_default="promedio"),
        sa.Column("dias_historial", sa.Integer(), server_default="90"),
        sa.Column("activa", sa.Boolean(), server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Index("ix_replenishment_rule_producto", "company_id", "producto_id"),
    )

    op.create_table(
        "supermer_replenishment_suggestions",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("producto_id", UUID(as_uuid=True), nullable=False),
        sa.Column("proveedor_id", UUID(as_uuid=True)),
        sa.Column("regla_id", UUID(as_uuid=True)),
        sa.Column("fecha_generacion", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("stock_actual", sa.Numeric(12, 3), nullable=False),
        sa.Column("stock_pendiente_recibir", sa.Numeric(12, 3), server_default="0"),
        sa.Column("demanda_diaria_avg", sa.Numeric(12, 3)),
        sa.Column("demanda_pronosticada", sa.Numeric(12, 3)),
        sa.Column("punto_pedido", sa.Numeric(12, 3)),
        sa.Column("cantidad_sugerida", sa.Numeric(12, 3), nullable=False),
        sa.Column("costo_unitario_estimado", sa.Numeric(12, 2)),
        sa.Column("costo_total_estimado", sa.Numeric(14, 2)),
        sa.Column("oc_generada", sa.Boolean(), server_default="false"),
        sa.Column("oc_numero", sa.String(50)),
        sa.Column("estado", sa.String(20), server_default="pendiente"),
        sa.Column("revisado_por", UUID(as_uuid=True)),
        sa.Column("revisado_at", sa.DateTime(timezone=True)),
        sa.Column("notas", sa.Text()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Index("ix_replenishment_suggestion_estado", "company_id", "estado"),
    )

    op.create_table(
        "supermer_crossdock_orders",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("producto_id", UUID(as_uuid=True), nullable=False),
        sa.Column("proveedor_id", UUID(as_uuid=True)),
        sa.Column("receiving_item_id", UUID(as_uuid=True)),
        sa.Column("cantidad", sa.Numeric(12, 3), nullable=False),
        sa.Column("fecha_crossdock", sa.Date(), nullable=False),
        sa.Column("destino", sa.String(50), server_default="gondola"),
        sa.Column("asignado_a", UUID(as_uuid=True)),
        sa.Column("estado", sa.String(20), server_default="pendiente"),
        sa.Column("completado_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )

    # ============================================================
    # SUPPLIER RETURNS & BACKHAUL
    # ============================================================

    op.create_table(
        "supermer_supplier_returns",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("proveedor_id", UUID(as_uuid=True), nullable=False),
        sa.Column("codigo", sa.String(30), nullable=False),
        sa.Column("tipo", sa.String(30), server_default="devolucion"),
        sa.Column("fecha_creacion", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("fecha_estimada_retiro", sa.Date()),
        sa.Column("total_items", sa.Integer(), server_default="0"),
        sa.Column("valor_total_estimado", sa.Numeric(14, 2)),
        sa.Column("nota_credito_numero", sa.String(50)),
        sa.Column("nota_credito_monto", sa.Numeric(14, 2)),
        sa.Column("estado", sa.String(20), server_default="pendiente"),
        sa.Column("autorizado_por", UUID(as_uuid=True)),
        sa.Column("autorizado_at", sa.DateTime(timezone=True)),
        sa.Column("completado_por", UUID(as_uuid=True)),
        sa.Column("completado_at", sa.DateTime(timezone=True)),
        sa.Column("observaciones", sa.Text()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Index("ix_supplier_return_proveedor", "company_id", "proveedor_id", "estado"),
    )

    op.create_table(
        "supermer_supplier_return_items",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("return_id", UUID(as_uuid=True), nullable=False),
        sa.Column("producto_id", UUID(as_uuid=True), nullable=False),
        sa.Column("cantidad", sa.Numeric(12, 3), nullable=False),
        sa.Column("costo_promedio", sa.Numeric(12, 2)),
        sa.Column("valor_unitario", sa.Numeric(12, 2)),
        sa.Column("valor_total", sa.Numeric(14, 2)),
        sa.Column("motivo", sa.String(30), nullable=False),
        sa.Column("lote", sa.String(50)),
        sa.Column("fecha_vencimiento", sa.Date()),
        sa.Column("detalle", sa.Text()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )

    op.create_table(
        "supermer_return_authorizations",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("return_id", UUID(as_uuid=True), nullable=False),
        sa.Column("proveedor_id", UUID(as_uuid=True), nullable=False),
        sa.Column("numero_autorizacion", sa.String(50), nullable=False),
        sa.Column("fecha_autorizacion", sa.Date(), nullable=False),
        sa.Column("valido_hasta", sa.Date()),
        sa.Column("autorizado_por_proveedor", sa.String(100)),
        sa.Column("nota_credito_numero", sa.String(50)),
        sa.Column("nota_credito_monto", sa.Numeric(14, 2)),
        sa.Column("observaciones", sa.Text()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )

    op.create_table(
        "supermer_backhaul_schedules",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("proveedor_id", UUID(as_uuid=True), nullable=False),
        sa.Column("return_ids", JSON),
        sa.Column("fecha_programada", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ventana_inicio", sa.DateTime(timezone=True)),
        sa.Column("ventana_fin", sa.DateTime(timezone=True)),
        sa.Column("transportista", sa.String(100)),
        sa.Column("patente", sa.String(20)),
        sa.Column("conductor", sa.String(100)),
        sa.Column("total_bultos", sa.Integer()),
        sa.Column("peso_estimado_kg", sa.Numeric(8, 2)),
        sa.Column("destino_direccion", sa.String(200)),
        sa.Column("estado", sa.String(20), server_default="pendiente"),
        sa.Column("notas_logisticas", sa.Text()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )


def downgrade() -> None:
    op.drop_table("supermer_backhaul_schedules")
    op.drop_table("supermer_return_authorizations")
    op.drop_table("supermer_supplier_return_items")
    op.drop_table("supermer_supplier_returns")
    op.drop_table("supermer_crossdock_orders")
    op.drop_table("supermer_replenishment_suggestions")
    op.drop_table("supermer_replenishment_rules")
    op.drop_table("supermer_count_adjustments")
    op.drop_table("supermer_count_items")
    op.drop_table("supermer_count_sessions")
    op.drop_table("supermer_dsd_rejections")
    op.drop_table("supermer_dsd_receiving_items")
    op.drop_table("supermer_dsd_receivings")
    op.drop_table("supermer_dsd_schedules")
