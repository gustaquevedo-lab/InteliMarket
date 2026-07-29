"""fix purchases drift — tablas nunca migradas al esquema que el codigo espera

Todo el modulo de compras (purchases/service.py, router.py) referencia
purchase_order_id/cantidad_recibida/warehouse_id/proveedor_ref/estado en
codigo Python y SQL crudo, pero las tablas reales tenian order_id/cantidad
y les faltaban columnas enteras (nunca se corrio una migracion para esto).
Las 4 tablas estaban vacias (0 filas), sin riesgo de perder datos.

Revision ID: 20260731000000
Revises: 20260730000000
Create Date: 2026-07-31 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20260731000000"
down_revision: Union[str, None] = "20260729000000"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # purchase_orders: faltaban campos de moneda/impuestos/entrega que el modelo ya declara
    op.add_column("purchase_orders", sa.Column("fecha_entrega_estimada", sa.Date()))
    op.add_column("purchase_orders", sa.Column("moneda", sa.String(3), server_default="PYG"))
    op.add_column("purchase_orders", sa.Column("tipo_cambio", sa.Numeric(10, 2), server_default="1"))
    op.add_column("purchase_orders", sa.Column("subtotal", sa.Numeric(15, 0)))
    op.add_column("purchase_orders", sa.Column("descuento_total", sa.Numeric(15, 0), server_default="0"))
    op.add_column("purchase_orders", sa.Column("iva_10", sa.Numeric(15, 0), server_default="0"))
    op.add_column("purchase_orders", sa.Column("iva_5", sa.Numeric(15, 0), server_default="0"))

    # purchase_order_items: order_id -> purchase_order_id (el codigo entero usa este nombre)
    op.alter_column("purchase_order_items", "order_id", new_column_name="purchase_order_id")
    op.add_column("purchase_order_items", sa.Column("variant_id", sa.dialects.postgresql.UUID(as_uuid=True)))
    op.add_column("purchase_order_items", sa.Column("descripcion", sa.String(300)))
    op.add_column("purchase_order_items", sa.Column("cantidad_recibida", sa.Numeric(10, 3), server_default="0"))
    op.add_column("purchase_order_items", sa.Column("descuento_pct", sa.Numeric(5, 2), server_default="0"))
    op.add_column("purchase_order_items", sa.Column("iva_tasa", sa.Numeric(5, 2)))

    # purchase_receipts: order_id -> purchase_order_id; faltaban warehouse_id/proveedor_ref/estado
    op.alter_column("purchase_receipts", "order_id", new_column_name="purchase_order_id")
    op.add_column("purchase_receipts", sa.Column("warehouse_id", sa.dialects.postgresql.UUID(as_uuid=True)))
    op.add_column("purchase_receipts", sa.Column("proveedor_ref", sa.String(50)))
    op.add_column("purchase_receipts", sa.Column("estado", sa.String(20), server_default="completado"))

    # purchase_receipt_items: cantidad -> cantidad_recibida; faltaban cantidad_ordenada/variant_id/batch_id
    op.alter_column("purchase_receipt_items", "cantidad", new_column_name="cantidad_recibida")
    op.add_column("purchase_receipt_items", sa.Column("cantidad_ordenada", sa.Numeric(10, 3)))
    op.add_column("purchase_receipt_items", sa.Column("variant_id", sa.dialects.postgresql.UUID(as_uuid=True)))
    op.add_column("purchase_receipt_items", sa.Column("batch_id", sa.dialects.postgresql.UUID(as_uuid=True)))


def downgrade() -> None:
    op.drop_column("purchase_receipt_items", "batch_id")
    op.drop_column("purchase_receipt_items", "variant_id")
    op.drop_column("purchase_receipt_items", "cantidad_ordenada")
    op.alter_column("purchase_receipt_items", "cantidad_recibida", new_column_name="cantidad")

    op.drop_column("purchase_receipts", "estado")
    op.drop_column("purchase_receipts", "proveedor_ref")
    op.drop_column("purchase_receipts", "warehouse_id")
    op.alter_column("purchase_receipts", "purchase_order_id", new_column_name="order_id")

    op.drop_column("purchase_order_items", "iva_tasa")
    op.drop_column("purchase_order_items", "descuento_pct")
    op.drop_column("purchase_order_items", "cantidad_recibida")
    op.drop_column("purchase_order_items", "descripcion")
    op.drop_column("purchase_order_items", "variant_id")
    op.alter_column("purchase_order_items", "purchase_order_id", new_column_name="order_id")

    op.drop_column("purchase_orders", "iva_5")
    op.drop_column("purchase_orders", "iva_10")
    op.drop_column("purchase_orders", "descuento_total")
    op.drop_column("purchase_orders", "subtotal")
    op.drop_column("purchase_orders", "tipo_cambio")
    op.drop_column("purchase_orders", "moneda")
    op.drop_column("purchase_orders", "fecha_entrega_estimada")
