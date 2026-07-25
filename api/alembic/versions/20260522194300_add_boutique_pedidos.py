"""add_boutique_pedidos_tables

Revision ID: 20260522194300
Revises: 20260519191915
Create Date: 2026-05-22 19:43:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "20260522194300"
down_revision: Union[str, None] = "20260519191915"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table("boutique_pedidos",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("company_id", sa.Uuid(), nullable=False),
        sa.Column("customer_id", sa.Uuid(), nullable=True),
        sa.Column("customer_data", sa.Text(), nullable=True),
        sa.Column("numero", sa.String(), nullable=False),
        sa.Column("fecha", sa.DateTime(), nullable=False),
        sa.Column("estado", sa.Enum("pendiente", "en_preparacion", "listo", "aprobado", "rechazado", "facturado", "cancelado", name="pedidoestado"), nullable=False),
        sa.Column("tipo_comprobante", sa.String(), nullable=True),
        sa.Column("direccion_entrega", sa.Text(), nullable=True),
        sa.Column("coordenadas", sa.String(), nullable=True),
        sa.Column("fecha_entrega_solicitada", sa.DateTime(), nullable=True),
        sa.Column("fecha_entrega_estimada", sa.DateTime(), nullable=True),
        sa.Column("subtotal", sa.Float(), nullable=True),
        sa.Column("total_iva", sa.Float(), nullable=True),
        sa.Column("total", sa.Float(), nullable=True),
        sa.Column("moneda", sa.String(), nullable=True),
        sa.Column("observaciones", sa.Text(), nullable=True),
        sa.Column("intelientregas_delivery_id", sa.String(), nullable=True),
        sa.Column("sale_id", sa.Uuid(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"], ),
        sa.ForeignKeyConstraint(["customer_id"], ["customers.id"], ),
        sa.ForeignKeyConstraint(["sale_id"], ["sales.id"], ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_boutique_pedidos_company_id"), "boutique_pedidos", ["company_id"])
    op.create_index(op.f("ix_boutique_pedidos_delivery_id"), "boutique_pedidos", ["intelientregas_delivery_id"])

    op.create_table("boutique_pedido_items",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("pedido_id", sa.Uuid(), nullable=False),
        sa.Column("producto_id", sa.Uuid(), nullable=True),
        sa.Column("producto_data", sa.Text(), nullable=True),
        sa.Column("cantidad", sa.Integer(), nullable=False),
        sa.Column("precio_unitario", sa.Float(), nullable=False),
        sa.Column("iva_tasa", sa.Float(), nullable=True),
        sa.Column("subtotal", sa.Float(), nullable=True),
        sa.ForeignKeyConstraint(["pedido_id"], ["boutique_pedidos.id"], ),
        sa.ForeignKeyConstraint(["producto_id"], ["products.id"], ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_boutique_pedido_items_pedido_id"), "boutique_pedido_items", ["pedido_id"])


def downgrade() -> None:
    op.drop_index(op.f("ix_boutique_pedido_items_pedido_id"), table_name="boutique_pedido_items")
    op.drop_table("boutique_pedido_items")
    op.drop_index(op.f("ix_boutique_pedidos_delivery_id"), table_name="boutique_pedidos")
    op.drop_index(op.f("ix_boutique_pedidos_company_id"), table_name="boutique_pedidos")
    op.drop_table("boutique_pedidos")
    op.execute("DROP TYPE IF EXISTS pedidoestado")
