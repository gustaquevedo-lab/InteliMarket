"""add quotes, discounts, sales_orders, returns, commissions tables

Revision ID: e7a9c1b2d3f4
Revises: dc217bbb50fc
Create Date: 2026-05-07 06:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "e7a9c1b2d3f4"
down_revision: Union[str, None] = "dc217bbb50fc"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Quotes / Cotizaciones
    op.create_table(
        "quotes",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.func.gen_random_uuid(), primary_key=True),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("customer_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("branch_id", postgresql.UUID(as_uuid=True)),
        sa.Column("numero", sa.String(20), nullable=False, unique=True),
        sa.Column("fecha", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("valido_hasta", sa.Date()),
        sa.Column("estado", sa.String(20), server_default="vigente"),
        sa.Column("moneda", sa.String(3), server_default="PYG"),
        sa.Column("tipo_cambio", sa.Numeric(10, 2), server_default="1"),
        sa.Column("subtotal", sa.Numeric(15, 0)),
        sa.Column("descuento_total", sa.Numeric(15, 0), server_default="0"),
        sa.Column("base_gravada_10", sa.Numeric(15, 0), server_default="0"),
        sa.Column("base_gravada_5", sa.Numeric(15, 0), server_default="0"),
        sa.Column("base_exenta", sa.Numeric(15, 0), server_default="0"),
        sa.Column("iva_10", sa.Numeric(15, 0), server_default="0"),
        sa.Column("iva_5", sa.Numeric(15, 0), server_default="0"),
        sa.Column("total", sa.Numeric(15, 0)),
        sa.Column("observaciones", sa.Text()),
        sa.Column("condiciones_pago", sa.Text()),
        sa.Column("user_id", postgresql.UUID(as_uuid=True)),
        sa.Column("sale_id", postgresql.UUID(as_uuid=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_quotes_company_id", "quotes", ["company_id"])
    op.create_index("ix_quotes_customer_id", "quotes", ["customer_id"])
    op.create_index("ix_quotes_estado", "quotes", ["estado"])

    op.create_table(
        "quote_items",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.func.gen_random_uuid(), primary_key=True),
        sa.Column("quote_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("product_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("variant_id", postgresql.UUID(as_uuid=True)),
        sa.Column("descripcion", sa.String(300)),
        sa.Column("cantidad", sa.Numeric(10, 3), nullable=False),
        sa.Column("precio_unitario", sa.Numeric(15, 0), nullable=False),
        sa.Column("descuento_pct", sa.Numeric(5, 2), server_default="0"),
        sa.Column("iva_tasa", sa.Numeric(5, 2), server_default="10"),
        sa.Column("iva_monto", sa.Numeric(15, 0), server_default="0"),
        sa.Column("total", sa.Numeric(15, 0), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_foreign_key("fk_quote_items_quote", "quote_items", "quotes", ["quote_id"], ["id"])

    # Discounts / Promociones
    op.create_table(
        "discounts",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.func.gen_random_uuid(), primary_key=True),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("nombre", sa.String(100), nullable=False),
        sa.Column("descripcion", sa.Text()),
        sa.Column("tipo", sa.String(20), nullable=False),
        sa.Column("valor", sa.Numeric(15, 0)),
        sa.Column("aplica_a", sa.String(20), nullable=False),
        sa.Column("producto_ids", postgresql.ARRAY(sa.UUID())),
        sa.Column("categoria_ids", postgresql.ARRAY(sa.UUID())),
        sa.Column("monto_minimo", sa.Numeric(15, 0)),
        sa.Column("cantidad_minima", sa.Numeric(10, 0)),
        sa.Column("maximo_aplicaciones", sa.Numeric(10, 0)),
        sa.Column("aplicaciones_usadas", sa.Numeric(10, 0), server_default="0"),
        sa.Column("valido_desde", sa.Date()),
        sa.Column("valido_hasta", sa.Date()),
        sa.Column("activo", sa.Boolean(), server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_discounts_company_id", "discounts", ["company_id"])

    # Sales Orders / Pedidos de Venta
    op.create_table(
        "sales_orders",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.func.gen_random_uuid(), primary_key=True),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("branch_id", postgresql.UUID(as_uuid=True)),
        sa.Column("customer_id", postgresql.UUID(as_uuid=True)),
        sa.Column("numero", sa.String(20), nullable=False, unique=True),
        sa.Column("fecha", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("fecha_entrega_solicitada", sa.Date()),
        sa.Column("fecha_entrega_estimada", sa.Date()),
        sa.Column("estado", sa.String(30), nullable=False, server_default="borrador"),
        sa.Column("prioridad", sa.String(20), server_default="normal"),
        sa.Column("moneda", sa.String(3), server_default="PYG"),
        sa.Column("tipo_cambio", sa.Numeric(10, 2), server_default="1"),
        sa.Column("condicion", sa.String(20), server_default="contado"),
        sa.Column("subtotal", sa.Numeric(15, 0)),
        sa.Column("descuento_total", sa.Numeric(15, 0), server_default="0"),
        sa.Column("base_gravada_10", sa.Numeric(15, 0), server_default="0"),
        sa.Column("base_gravada_5", sa.Numeric(15, 0), server_default="0"),
        sa.Column("base_exenta", sa.Numeric(15, 0), server_default="0"),
        sa.Column("iva_10", sa.Numeric(15, 0), server_default="0"),
        sa.Column("iva_5", sa.Numeric(15, 0), server_default="0"),
        sa.Column("total", sa.Numeric(15, 0)),
        sa.Column("observaciones", sa.Text()),
        sa.Column("direccion_entrega", sa.Text()),
        sa.Column("vendedor_id", postgresql.UUID(as_uuid=True)),
        sa.Column("aprobado_por", postgresql.UUID(as_uuid=True)),
        sa.Column("fecha_aprobacion", sa.DateTime(timezone=True)),
        sa.Column("rechazado_motivo", sa.Text()),
        sa.Column("user_id", postgresql.UUID(as_uuid=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_sales_orders_company_id", "sales_orders", ["company_id"])
    op.create_index("ix_sales_orders_estado", "sales_orders", ["estado"])
    op.create_index("ix_sales_orders_customer_id", "sales_orders", ["customer_id"])

    op.create_table(
        "sales_order_items",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.func.gen_random_uuid(), primary_key=True),
        sa.Column("order_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("product_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("variant_id", postgresql.UUID(as_uuid=True)),
        sa.Column("descripcion", sa.String(300)),
        sa.Column("cantidad", sa.Numeric(10, 3), nullable=False),
        sa.Column("cantidad_pendiente", sa.Numeric(10, 3)),
        sa.Column("cantidad_facturada", sa.Numeric(10, 3), server_default="0"),
        sa.Column("cantidad_entregada", sa.Numeric(10, 3), server_default="0"),
        sa.Column("precio_unitario", sa.Numeric(15, 0), nullable=False),
        sa.Column("descuento_pct", sa.Numeric(5, 2), server_default="0"),
        sa.Column("iva_tasa", sa.Numeric(5, 2), server_default="10"),
        sa.Column("iva_monto", sa.Numeric(15, 0), server_default="0"),
        sa.Column("total", sa.Numeric(15, 0), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_foreign_key("fk_order_items_order", "sales_order_items", "sales_orders", ["order_id"], ["id"])

    # Returns / Devoluciones
    op.create_table(
        "returns",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.func.gen_random_uuid(), primary_key=True),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("branch_id", postgresql.UUID(as_uuid=True)),
        sa.Column("sale_id", postgresql.UUID(as_uuid=True)),
        sa.Column("customer_id", postgresql.UUID(as_uuid=True)),
        sa.Column("numero", sa.String(20), nullable=False, unique=True),
        sa.Column("fecha", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("tipo", sa.String(20), nullable=False),
        sa.Column("motivo", sa.String(50), nullable=False),
        sa.Column("motivo_detalle", sa.Text()),
        sa.Column("estado", sa.String(20), server_default="pendiente"),
        sa.Column("moneda", sa.String(3), server_default="PYG"),
        sa.Column("tipo_cambio", sa.Numeric(10, 2), server_default="1"),
        sa.Column("subtotal", sa.Numeric(15, 0)),
        sa.Column("iva_10", sa.Numeric(15, 0), server_default="0"),
        sa.Column("iva_5", sa.Numeric(15, 0), server_default="0"),
        sa.Column("total", sa.Numeric(15, 0)),
        sa.Column("nota_credito_id", postgresql.UUID(as_uuid=True)),
        sa.Column("warehouse_id", postgresql.UUID(as_uuid=True)),
        sa.Column("observaciones", sa.Text()),
        sa.Column("user_id", postgresql.UUID(as_uuid=True)),
        sa.Column("aprobado_por", postgresql.UUID(as_uuid=True)),
        sa.Column("fecha_aprobacion", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_returns_company_id", "returns", ["company_id"])
    op.create_index("ix_returns_sale_id", "returns", ["sale_id"])
    op.create_index("ix_returns_estado", "returns", ["estado"])

    op.create_table(
        "return_items",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.func.gen_random_uuid(), primary_key=True),
        sa.Column("return_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("sale_item_id", postgresql.UUID(as_uuid=True)),
        sa.Column("product_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("variant_id", postgresql.UUID(as_uuid=True)),
        sa.Column("descripcion", sa.String(300)),
        sa.Column("cantidad", sa.Numeric(10, 3), nullable=False),
        sa.Column("precio_unitario", sa.Numeric(15, 0), nullable=False),
        sa.Column("iva_tasa", sa.Numeric(5, 2), server_default="10"),
        sa.Column("iva_monto", sa.Numeric(15, 0), server_default="0"),
        sa.Column("total", sa.Numeric(15, 0), nullable=False),
        sa.Column("motivo_detalle", sa.Text()),
        sa.Column("condicion", sa.String(30), server_default="buen_estado"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_foreign_key("fk_return_items_return", "return_items", "returns", ["return_id"], ["id"])

    # Accounts Receivable / Cuentas por Cobrar
    op.create_table(
        "accounts_receivable",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.func.gen_random_uuid(), primary_key=True),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("customer_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("sale_id", postgresql.UUID(as_uuid=True)),
        sa.Column("numero_documento", sa.String(50)),
        sa.Column("fecha_emision", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("fecha_vencimiento", sa.Date()),
        sa.Column("moneda", sa.String(3), server_default="PYG"),
        sa.Column("monto_original", sa.Numeric(15, 0), nullable=False),
        sa.Column("saldo_pendiente", sa.Numeric(15, 0), nullable=False),
        sa.Column("tipo", sa.String(30), server_default="factura"),
        sa.Column("estado", sa.String(20), server_default="pendiente"),
        sa.Column("dias_mora", sa.Numeric(6, 0), server_default="0"),
        sa.Column("ultimo_pago", sa.DateTime(timezone=True)),
        sa.Column("notas_cobranza", sa.Text()),
        sa.Column("user_id", postgresql.UUID(as_uuid=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_accounts_receivable_company_id", "accounts_receivable", ["company_id"])
    op.create_index("ix_accounts_receivable_customer_id", "accounts_receivable", ["customer_id"])
    op.create_index("ix_accounts_receivable_estado", "accounts_receivable", ["estado"])
    op.create_index("ix_accounts_receivable_fecha_vencimiento", "accounts_receivable", ["fecha_vencimiento"])

    # Commission Rules / Reglas de Comisiones
    op.create_table(
        "commission_rules",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.func.gen_random_uuid(), primary_key=True),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("nombre", sa.String(100), nullable=False),
        sa.Column("tipo", sa.String(30), nullable=False),
        sa.Column("vendedor_id", postgresql.UUID(as_uuid=True)),
        sa.Column("porcentaje", sa.Numeric(5, 2), nullable=False),
        sa.Column("aplica_a", sa.String(20), server_default="total"),
        sa.Column("categoria_ids", postgresql.ARRAY(sa.UUID())),
        sa.Column("producto_ids", postgresql.ARRAY(sa.UUID())),
        sa.Column("monto_minimo", sa.Numeric(15, 0)),
        sa.Column("monto_maximo", sa.Numeric(15, 0)),
        sa.Column("valido_desde", sa.Date()),
        sa.Column("valido_hasta", sa.Date()),
        sa.Column("activo", sa.Boolean(), server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_commission_rules_company_id", "commission_rules", ["company_id"])

    op.create_table(
        "sales_commissions",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.func.gen_random_uuid(), primary_key=True),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("rule_id", postgresql.UUID(as_uuid=True)),
        sa.Column("sale_id", postgresql.UUID(as_uuid=True)),
        sa.Column("vendedor_id", postgresql.UUID(as_uuid=True)),
        sa.Column("base_calculo", sa.Numeric(15, 0), nullable=False),
        sa.Column("porcentaje", sa.Numeric(5, 2), nullable=False),
        sa.Column("monto_comision", sa.Numeric(15, 0), nullable=False),
        sa.Column("moneda", sa.String(3), server_default="PYG"),
        sa.Column("estado", sa.String(20), server_default="calculada"),
        sa.Column("fecha_pago", sa.Date()),
        sa.Column("notas", sa.Text()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_sales_commissions_company_id", "sales_commissions", ["company_id"])
    op.create_index("ix_sales_commissions_vendedor_id", "sales_commissions", ["vendedor_id"])
    op.create_index("ix_sales_commissions_sale_id", "sales_commissions", ["sale_id"])


def downgrade() -> None:
    op.drop_table("sales_commissions")
    op.drop_table("commission_rules")
    op.drop_table("accounts_receivable")
    op.drop_table("return_items")
    op.drop_table("returns")
    op.drop_table("sales_order_items")
    op.drop_table("sales_orders")
    op.drop_table("discounts")
    op.drop_table("quote_items")
    op.drop_table("quotes")
