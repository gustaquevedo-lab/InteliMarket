"""Add B2B Client App tables (client_users, carts, orders, favorites, addresses)

Revision ID: 20260531140000
Revises: 20260531000001
Create Date: 2026-05-31 14:00:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


revision: str = "20260531140000"
down_revision: Union[str, Sequence[str], None] = "20260531000001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table("client_users",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("customer_id", UUID(as_uuid=True), sa.ForeignKey("customers.id", ondelete="CASCADE"), nullable=False),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("nombre", sa.String(200), nullable=False),
        sa.Column("telefono", sa.String(50)),
        sa.Column("activo", sa.Boolean(), default=True),
        sa.Column("last_login", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True)),
        sa.Column("updated_at", sa.DateTime(timezone=True)),
    )

    op.create_table("client_devices",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("client_user_id", UUID(as_uuid=True), sa.ForeignKey("client_users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("push_token", sa.String(500)),
        sa.Column("platform", sa.String(20)),
        sa.Column("last_seen_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True)),
    )

    op.create_table("client_carts",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("client_user_id", UUID(as_uuid=True), sa.ForeignKey("client_users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False),
        sa.Column("activo", sa.Boolean(), default=True),
        sa.Column("created_at", sa.DateTime(timezone=True)),
        sa.Column("updated_at", sa.DateTime(timezone=True)),
    )

    op.create_table("client_cart_items",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("cart_id", UUID(as_uuid=True), sa.ForeignKey("client_carts.id", ondelete="CASCADE"), nullable=False),
        sa.Column("product_id", UUID(as_uuid=True), nullable=False),
        sa.Column("variant_id", UUID(as_uuid=True), nullable=True),
        sa.Column("descripcion", sa.String(300)),
        sa.Column("cantidad", sa.Numeric(10, 3), default=1),
        sa.Column("precio_unitario", sa.Numeric(15, 2), default=0),
        sa.Column("iva_tasa", sa.Numeric(5, 2), default=10),
        sa.Column("created_at", sa.DateTime(timezone=True)),
    )

    op.create_table("client_orders",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("client_user_id", UUID(as_uuid=True), sa.ForeignKey("client_users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("customer_id", UUID(as_uuid=True), sa.ForeignKey("customers.id"), nullable=False),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("numero", sa.String(20)),
        sa.Column("estado", sa.String(20), default="pendiente"),
        sa.Column("condicion", sa.String(20), default="contado"),
        sa.Column("subtotal", sa.Numeric(15, 2), default=0),
        sa.Column("descuento_total", sa.Numeric(15, 2), default=0),
        sa.Column("total", sa.Numeric(15, 2), default=0),
        sa.Column("saldo", sa.Numeric(15, 2), default=0),
        sa.Column("direccion_entrega", sa.Text),
        sa.Column("latitud", sa.Numeric(10, 7)),
        sa.Column("longitud", sa.Numeric(10, 7)),
        sa.Column("observaciones", sa.Text),
        sa.Column("delivery_id", UUID(as_uuid=True), nullable=True),
        sa.Column("sale_id", UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True)),
        sa.Column("updated_at", sa.DateTime(timezone=True)),
    )

    op.create_table("client_order_items",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("order_id", UUID(as_uuid=True), sa.ForeignKey("client_orders.id", ondelete="CASCADE"), nullable=False),
        sa.Column("product_id", UUID(as_uuid=True), nullable=False),
        sa.Column("variant_id", UUID(as_uuid=True), nullable=True),
        sa.Column("descripcion", sa.String(300)),
        sa.Column("cantidad", sa.Numeric(10, 3)),
        sa.Column("precio_unitario", sa.Numeric(15, 2)),
        sa.Column("descuento_pct", sa.Numeric(5, 2), default=0),
        sa.Column("descuento_monto", sa.Numeric(15, 2), default=0),
        sa.Column("iva_tasa", sa.Numeric(5, 2), default=10),
        sa.Column("iva_monto", sa.Numeric(15, 2), default=0),
        sa.Column("total", sa.Numeric(15, 2), default=0),
        sa.Column("created_at", sa.DateTime(timezone=True)),
    )

    op.create_table("client_favorites",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("client_user_id", UUID(as_uuid=True), sa.ForeignKey("client_users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("product_id", UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True)),
        sa.UniqueConstraint("client_user_id", "product_id", name="uq_client_favorite_product"),
    )

    op.create_table("client_addresses",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("client_user_id", UUID(as_uuid=True), sa.ForeignKey("client_users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("nombre", sa.String(100)),
        sa.Column("direccion", sa.String(300), nullable=False),
        sa.Column("ciudad", sa.String(100)),
        sa.Column("latitud", sa.Numeric(10, 7)),
        sa.Column("longitud", sa.Numeric(10, 7)),
        sa.Column("es_default", sa.Boolean(), default=False),
        sa.Column("created_at", sa.DateTime(timezone=True)),
    )


def downgrade() -> None:
    op.drop_table("client_addresses")
    op.drop_table("client_favorites")
    op.drop_table("client_order_items")
    op.drop_table("client_orders")
    op.drop_table("client_cart_items")
    op.drop_table("client_carts")
    op.drop_table("client_devices")
    op.drop_table("client_users")
