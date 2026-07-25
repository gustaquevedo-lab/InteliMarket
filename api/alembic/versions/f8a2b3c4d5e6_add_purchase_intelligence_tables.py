"""add purchase intelligence tables (requisitions, forecasting, contracts, budgets, evaluations)

Revision ID: f8a2b3c4d5e6
Revises: e7a9c1b2d3f4
Create Date: 2026-05-07 06:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "f8a2b3c4d5e6"
down_revision: Union[str, None] = "e7a9c1b2d3f4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Enhance purchase_orders with intelligence fields
    op.add_column("purchase_orders", sa.Column("tipo_compra", sa.String(20), server_default="local"))
    op.add_column("purchase_orders", sa.Column("prioridad", sa.String(20), server_default="normal"))
    op.add_column("purchase_orders", sa.Column("condiciones_pago", sa.Text()))
    op.add_column("purchase_orders", sa.Column("dias_validez", sa.Integer(), server_default="30"))
    op.add_column("purchase_orders", sa.Column("shipping_cost", sa.Numeric(15, 0), server_default="0"))
    op.add_column("purchase_orders", sa.Column("insurance_cost", sa.Numeric(15, 0), server_default="0"))
    op.add_column("purchase_orders", sa.Column("customs_cost", sa.Numeric(15, 0), server_default="0"))
    op.add_column("purchase_orders", sa.Column("otros_costos", sa.Numeric(15, 0), server_default="0"))
    op.add_column("purchase_orders", sa.Column("costo_landed_total", sa.Numeric(15, 0), server_default="0"))
    op.add_column("purchase_orders", sa.Column("fecha_envio", sa.DateTime(timezone=True)))
    op.add_column("purchase_orders", sa.Column("fecha_confirmacion_proveedor", sa.DateTime(timezone=True)))
    op.add_column("purchase_orders", sa.Column("aprobado_por", postgresql.UUID(as_uuid=True)))
    op.add_column("purchase_orders", sa.Column("fecha_aprobacion", sa.DateTime(timezone=True)))
    op.add_column("purchase_orders", sa.Column("rechazado_motivo", sa.Text()))
    op.add_column("purchase_orders", sa.Column("sugerencia_id", postgresql.UUID(as_uuid=True)))
    op.add_column("purchase_orders", sa.Column("seguimiento_numero", sa.String(50)))
    op.add_column("purchase_orders", sa.Column("created_by_name", sa.String(100)))
    op.add_column("purchase_orders", sa.Column("updated_by_name", sa.String(100)))
    op.create_index("ix_purchase_orders_estado", "purchase_orders", ["estado"])
    op.create_index("ix_purchase_orders_supplier_id", "purchase_orders", ["supplier_id"])
    op.create_index("ix_purchase_orders_fecha", "purchase_orders", ["fecha"])

    # Enhance purchase_order_items
    op.add_column("purchase_order_items", sa.Column("costo_unitario_estimado", sa.Numeric(15, 0)))
    op.add_column("purchase_order_items", sa.Column("fecha_entrega_esperada", sa.Date()))
    op.add_column("purchase_order_items", sa.Column("fecha_entrega_real", sa.Date()))
    op.add_column("purchase_order_items", sa.Column("warehouse_id", postgresql.UUID(as_uuid=True)))

    # Enhance suppliers
    op.add_column("suppliers", sa.Column("tipo_proveedor", sa.String(30), server_default="nacional"))
    op.add_column("suppliers", sa.Column("grupo", sa.String(50)))
    op.add_column("suppliers", sa.Column("categoria_ids", postgresql.ARRAY(sa.UUID())))
    op.add_column("suppliers", sa.Column("moneda_default", sa.String(3), server_default="PYG"))
    op.add_column("suppliers", sa.Column("plazo_entrega_promedio", sa.Integer(), server_default="0"))
    op.add_column("suppliers", sa.Column("rating", sa.Numeric(2, 1), server_default="0"))
    op.add_column("suppliers", sa.Column("notas", sa.Text()))
    op.add_column("suppliers", sa.Column("contacto_nombre", sa.String(100)))
    op.add_column("suppliers", sa.Column("contacto_telefono", sa.String(20)))
    op.add_column("suppliers", sa.Column("contacto_email", sa.String(255)))
    op.add_column("suppliers", sa.Column("banco", sa.String(100)))
    op.add_column("suppliers", sa.Column("cuenta_bancaria", sa.String(50)))
    op.add_column("suppliers", sa.Column("tipo_contribuyente", sa.String(30)))
    op.add_column("suppliers", sa.Column("retencion_irp", sa.Boolean(), server_default="false"))
    op.add_column("suppliers", sa.Column("retencion_iva", sa.Boolean(), server_default="false"))

    # Purchase Requisitions
    op.create_table(
        "purchase_requisitions",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.func.gen_random_uuid(), primary_key=True),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("numero", sa.String(20), nullable=False, unique=True),
        sa.Column("fecha", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("fecha_necesidad", sa.Date()),
        sa.Column("departamento", sa.String(100)),
        sa.Column("solicitante_id", postgresql.UUID(as_uuid=True)),
        sa.Column("solicitante_nombre", sa.String(100)),
        sa.Column("estado", sa.String(30), nullable=False, server_default="borrador"),
        sa.Column("prioridad", sa.String(20), server_default="normal"),
        sa.Column("moneda", sa.String(3), server_default="PYG"),
        sa.Column("subtotal", sa.Numeric(15, 0)),
        sa.Column("total", sa.Numeric(15, 0)),
        sa.Column("motivo", sa.Text()),
        sa.Column("observaciones", sa.Text()),
        sa.Column("aprobado_por", postgresql.UUID(as_uuid=True)),
        sa.Column("fecha_aprobacion", sa.DateTime(timezone=True)),
        sa.Column("rechazado_motivo", sa.Text()),
        sa.Column("purchase_order_id", postgresql.UUID(as_uuid=True)),
        sa.Column("user_id", postgresql.UUID(as_uuid=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_purchase_requisitions_company_id", "purchase_requisitions", ["company_id"])
    op.create_index("ix_purchase_requisitions_estado", "purchase_requisitions", ["estado"])

    op.create_table(
        "purchase_requisition_items",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.func.gen_random_uuid(), primary_key=True),
        sa.Column("requisition_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("product_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("variant_id", postgresql.UUID(as_uuid=True)),
        sa.Column("descripcion", sa.String(300)),
        sa.Column("cantidad_solicitada", sa.Numeric(10, 3), nullable=False),
        sa.Column("cantidad_aprobada", sa.Numeric(10, 3)),
        sa.Column("precio_estimado", sa.Numeric(15, 0)),
        sa.Column("total_estimado", sa.Numeric(15, 0)),
        sa.Column("observaciones", sa.Text()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_foreign_key("fk_req_items_req", "purchase_requisition_items", "purchase_requisitions", ["requisition_id"], ["id"])

    # Supplier Contracts (frame agreements)
    op.create_table(
        "supplier_contracts",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.func.gen_random_uuid(), primary_key=True),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("supplier_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("numero", sa.String(30), nullable=False, unique=True),
        sa.Column("nombre", sa.String(200)),
        sa.Column("fecha_inicio", sa.Date()),
        sa.Column("fecha_fin", sa.Date()),
        sa.Column("moneda", sa.String(3), server_default="PYG"),
        sa.Column("tipo_cambio_fijo", sa.Numeric(10, 2)),
        sa.Column("condiciones_pago", sa.Text()),
        sa.Column("plazo_entrega_dias", sa.Integer()),
        sa.Column("monto_minimo_mensual", sa.Numeric(15, 0)),
        sa.Column("monto_maximo_mensual", sa.Numeric(15, 0)),
        sa.Column("activo", sa.Boolean(), server_default="true"),
        sa.Column("observaciones", sa.Text()),
        sa.Column("user_id", postgresql.UUID(as_uuid=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_supplier_contracts_company_id", "supplier_contracts", ["company_id"])
    op.create_index("ix_supplier_contracts_supplier_id", "supplier_contracts", ["supplier_id"])

    op.create_table(
        "supplier_contract_items",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.func.gen_random_uuid(), primary_key=True),
        sa.Column("contract_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("product_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("variant_id", postgresql.UUID(as_uuid=True)),
        sa.Column("precio_acordado", sa.Numeric(15, 0), nullable=False),
        sa.Column("moneda", sa.String(3), server_default="PYG"),
        sa.Column("cantidad_minima", sa.Numeric(10, 3)),
        sa.Column("descuento_pct", sa.Numeric(5, 2)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_foreign_key("fk_contract_items_contract", "supplier_contract_items", "supplier_contracts", ["contract_id"], ["id"])

    # Supplier Evaluations
    op.create_table(
        "supplier_evaluations",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.func.gen_random_uuid(), primary_key=True),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("supplier_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("fecha", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("periodo", sa.String(10)),
        sa.Column("puntaje_calidad", sa.Numeric(3, 1)),
        sa.Column("puntaje_entrega", sa.Numeric(3, 1)),
        sa.Column("puntaje_precio", sa.Numeric(3, 1)),
        sa.Column("puntaje_atencion", sa.Numeric(3, 1)),
        sa.Column("puntaje_total", sa.Numeric(3, 1)),
        sa.Column("ordenes_completadas", sa.Integer()),
        sa.Column("ordenes_totales", sa.Integer()),
        sa.Column("entregas_a_tiempo", sa.Integer()),
        sa.Column("entregas_totales", sa.Integer()),
        sa.Column("comentarios", sa.Text()),
        sa.Column("user_id", postgresql.UUID(as_uuid=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_supplier_evaluations_supplier_id", "supplier_evaluations", ["supplier_id"])

    # Supplier Price History
    op.create_table(
        "supplier_price_history",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.func.gen_random_uuid(), primary_key=True),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("supplier_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("product_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("precio", sa.Numeric(15, 0), nullable=False),
        sa.Column("moneda", sa.String(3), server_default="PYG"),
        sa.Column("fecha", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("purchase_order_id", postgresql.UUID(as_uuid=True)),
        sa.Column("notas", sa.String(200)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_supplier_price_history_supplier", "supplier_price_history", ["supplier_id", "product_id"])

    # Forecast Rules (auto-replenishment config)
    op.create_table(
        "forecast_rules",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.func.gen_random_uuid(), primary_key=True),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("nombre", sa.String(100), nullable=False),
        sa.Column("activo", sa.Boolean(), server_default="true"),
        sa.Column("tipo", sa.String(30), nullable=False),
        sa.Column("product_id", postgresql.UUID(as_uuid=True)),
        sa.Column("categoria_id", postgresql.UUID(as_uuid=True)),
        sa.Column("metodo", sa.String(30), server_default="promedio_movil"),
        sa.Column("dias_historial", sa.Integer(), server_default="90"),
        sa.Column("dias_proyeccion", sa.Integer(), server_default="30"),
        sa.Column("nivel_servicio", sa.Numeric(3, 1), server_default="95"),
        sa.Column("lead_time_dias", sa.Integer(), server_default="7"),
        sa.Column("lead_time_variacion", sa.Integer(), server_default="2"),
        sa.Column("stock_seguridad_dias", sa.Integer(), server_default="7"),
        sa.Column("multiplo_pedido", sa.Numeric(10, 3), server_default="1"),
        sa.Column("minimo_pedido", sa.Numeric(10, 3)),
        sa.Column("maximo_pedido", sa.Numeric(10, 3)),
        sa.Column("stock_maximo", sa.Numeric(10, 3)),
        sa.Column("stock_minimo", sa.Numeric(10, 3)),
        sa.Column("proveedor_preferido_id", postgresql.UUID(as_uuid=True)),
        sa.Column("ultima_ejecucion", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_forecast_rules_company_id", "forecast_rules", ["company_id"])

    # Forecast Projections (calculated)
    op.create_table(
        "forecast_projections",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.func.gen_random_uuid(), primary_key=True),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("rule_id", postgresql.UUID(as_uuid=True)),
        sa.Column("product_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("fecha_proyeccion", sa.Date(), nullable=False),
        sa.Column("demanda_pronosticada", sa.Numeric(15, 0)),
        sa.Column("demanda_real", sa.Numeric(15, 0)),
        sa.Column("confianza", sa.Numeric(3, 1)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_forecast_projections_product", "forecast_projections", ["company_id", "product_id", "fecha_proyeccion"])

    # Purchase Suggestions (auto-generated)
    op.create_table(
        "purchase_suggestions",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.func.gen_random_uuid(), primary_key=True),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("product_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("variant_id", postgresql.UUID(as_uuid=True)),
        sa.Column("supplier_id", postgresql.UUID(as_uuid=True)),
        sa.Column("cantidad_sugerida", sa.Numeric(10, 3), nullable=False),
        sa.Column("precio_estimado", sa.Numeric(15, 0)),
        sa.Column("total_estimado", sa.Numeric(15, 0)),
        sa.Column("moneda", sa.String(3), server_default="PYG"),
        sa.Column("motivo", sa.String(50), nullable=False),
        sa.Column("detalle", sa.Text()),
        sa.Column("urgencia", sa.String(20), server_default="media"),
        sa.Column("confianza", sa.Numeric(3, 1)),
        sa.Column("stock_actual", sa.Numeric(10, 3)),
        sa.Column("stock_seguridad", sa.Numeric(10, 3)),
        sa.Column("demanda_diaria_promedio", sa.Numeric(15, 0)),
        sa.Column("dias_cobertura", sa.Integer()),
        sa.Column("lead_time_dias", sa.Integer()),
        sa.Column("estado", sa.String(20), server_default="pendiente"),
        sa.Column("purchase_order_id", postgresql.UUID(as_uuid=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_purchase_suggestions_company", "purchase_suggestions", ["company_id", "estado"])
    op.create_index("ix_purchase_suggestions_product", "purchase_suggestions", ["product_id"])

    # Purchase Budgets
    op.create_table(
        "purchase_budgets",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.func.gen_random_uuid(), primary_key=True),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("nombre", sa.String(100), nullable=False),
        sa.Column("anio", sa.Integer(), nullable=False),
        sa.Column("mes", sa.Integer()),
        sa.Column("tipo", sa.String(30), server_default="mensual"),
        sa.Column("moneda", sa.String(3), server_default="PYG"),
        sa.Column("monto_presupuestado", sa.Numeric(15, 0), nullable=False),
        sa.Column("monto_ejecutado", sa.Numeric(15, 0), server_default="0"),
        sa.Column("monto_disponible", sa.Numeric(15, 0)),
        sa.Column("categoria_id", postgresql.UUID(as_uuid=True)),
        sa.Column("departamento", sa.String(100)),
        sa.Column("activo", sa.Boolean(), server_default="true"),
        sa.Column("observaciones", sa.Text()),
        sa.Column("user_id", postgresql.UUID(as_uuid=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_purchase_budgets_company", "purchase_budgets", ["company_id", "anio"])

    # Purchase Order History / Tracking
    op.create_table(
        "purchase_order_history",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.func.gen_random_uuid(), primary_key=True),
        sa.Column("purchase_order_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("estado_anterior", sa.String(30)),
        sa.Column("estado_nuevo", sa.String(30), nullable=False),
        sa.Column("cambiado_por", postgresql.UUID(as_uuid=True)),
        sa.Column("cambiado_por_nombre", sa.String(100)),
        sa.Column("observaciones", sa.Text()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_po_history_po", "purchase_order_history", ["purchase_order_id"])


def downgrade() -> None:
    op.drop_table("purchase_order_history")
    op.drop_table("purchase_budgets")
    op.drop_table("purchase_suggestions")
    op.drop_table("forecast_projections")
    op.drop_table("forecast_rules")
    op.drop_table("supplier_price_history")
    op.drop_table("supplier_evaluations")
    op.drop_table("supplier_contract_items")
    op.drop_table("supplier_contracts")
    op.drop_table("purchase_requisition_items")
    op.drop_table("purchase_requisitions")

    for col in ["tipo_contribuyente", "cuenta_bancaria", "banco", "contacto_email", "contacto_telefono", "contacto_nombre", "notas", "rating", "plazo_entrega_promedio", "moneda_default", "categoria_ids", "grupo", "tipo_proveedor"]:
        op.drop_column("suppliers", col)
    for col in ["warehouse_id", "fecha_entrega_real", "fecha_entrega_esperada", "costo_unitario_estimado"]:
        op.drop_column("purchase_order_items", col)
    for col in ["updated_by_name", "created_by_name", "seguimiento_numero", "sugerencia_id", "rechazado_motivo", "fecha_aprobacion", "aprobado_por", "fecha_confirmacion_proveedor", "fecha_envio", "costo_landed_total", "otros_costos", "customs_cost", "insurance_cost", "shipping_cost", "dias_validez", "condiciones_pago", "prioridad", "tipo_compra"]:
        op.drop_column("purchase_orders", col)
