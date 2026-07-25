"""Add E-commerce Web tables (customers, carts, orders, payments)

Revision ID: 20260531220000
Revises: 20260531190000
Create Date: 2026-05-31 22:00:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSON

revision: str = "20260531220000"
down_revision: Union[str, None] = "20260531190000"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # E-commerce Customers (web auth)
    op.create_table(
        "ecommerce_customers",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("customer_id", UUID(as_uuid=True), nullable=False),
        sa.Column("email", sa.String(255), nullable=False, unique=True),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("nombre", sa.String(200), nullable=False),
        sa.Column("telefono", sa.String(50)),
        sa.Column("direccion_envio", sa.Text()),
        sa.Column("activo", sa.Boolean(), default=True),
        sa.Column("created_at", sa.DateTime(timezone=True)),
        sa.Column("last_login_at", sa.DateTime(timezone=True)),
    )

    # Carts
    op.create_table(
        "ecommerce_carts",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("customer_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("moneda", sa.String(3), default="PYG"),
        sa.Column("created_at", sa.DateTime(timezone=True)),
        sa.Column("updated_at", sa.DateTime(timezone=True)),
    )

    # Cart Items
    op.create_table(
        "ecommerce_cart_items",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("cart_id", UUID(as_uuid=True), sa.ForeignKey("ecommerce_carts.id", ondelete="CASCADE"), nullable=False),
        sa.Column("product_id", UUID(as_uuid=True), nullable=False),
        sa.Column("product_nombre", sa.String(200)),
        sa.Column("cantidad", sa.Numeric(15, 3), nullable=False, default=1),
        sa.Column("precio_unitario", sa.Numeric(15, 2), nullable=False),
        sa.Column("moneda", sa.String(3), default="PYG"),
        sa.Column("created_at", sa.DateTime(timezone=True)),
    )

    # Orders
    op.create_table(
        "ecommerce_orders",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("customer_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("numero", sa.String(20)),
        sa.Column("estado", sa.String(20), nullable=False, default="pendiente"),
        sa.Column("moneda", sa.String(3), default="PYG"),
        sa.Column("subtotal", sa.Numeric(15, 2), nullable=False, default=0),
        sa.Column("descuento", sa.Numeric(15, 2), default=0),
        sa.Column("total", sa.Numeric(15, 2), nullable=False, default=0),
        sa.Column("metodo_pago", sa.String(50)),
        sa.Column("pago_estado", sa.String(20), default="pendiente"),
        sa.Column("direccion_envio", sa.Text()),
        sa.Column("notas", sa.Text()),
        sa.Column("sales_order_id", UUID(as_uuid=True)),
        sa.Column("invoice_id", UUID(as_uuid=True)),
        sa.Column("created_at", sa.DateTime(timezone=True)),
        sa.Column("updated_at", sa.DateTime(timezone=True)),
    )

    # Order Items
    op.create_table(
        "ecommerce_order_items",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("order_id", UUID(as_uuid=True), sa.ForeignKey("ecommerce_orders.id", ondelete="CASCADE"), nullable=False),
        sa.Column("product_id", UUID(as_uuid=True), nullable=False),
        sa.Column("product_nombre", sa.String(200)),
        sa.Column("cantidad", sa.Numeric(15, 3), nullable=False),
        sa.Column("precio_unitario", sa.Numeric(15, 2), nullable=False),
        sa.Column("subtotal", sa.Numeric(15, 2), nullable=False),
        sa.Column("moneda", sa.String(3), default="PYG"),
        sa.Column("created_at", sa.DateTime(timezone=True)),
    )

    # Payments
    op.create_table(
        "ecommerce_payments",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("order_id", UUID(as_uuid=True), sa.ForeignKey("ecommerce_orders.id"), nullable=False),
        sa.Column("metodo", sa.String(50), nullable=False),
        sa.Column("monto", sa.Numeric(15, 2), nullable=False),
        sa.Column("moneda", sa.String(3), default="PYG"),
        sa.Column("estado", sa.String(20), default="pendiente"),
        sa.Column("referencia_externa", sa.String(255)),
        sa.Column("metadata", JSON()),
        sa.Column("created_at", sa.DateTime(timezone=True)),
        sa.Column("updated_at", sa.DateTime(timezone=True)),
    )


def downgrade() -> None:
    op.drop_table("ecommerce_payments")
    op.drop_table("ecommerce_order_items")
    op.drop_table("ecommerce_orders")
    op.drop_table("ecommerce_cart_items")
    op.drop_table("ecommerce_carts")
    op.drop_table("ecommerce_customers")
