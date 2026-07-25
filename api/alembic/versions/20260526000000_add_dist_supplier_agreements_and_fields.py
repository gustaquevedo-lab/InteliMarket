"""add supplier agreements, PO approvals, product cost fields, container reconciliation

Revision ID: 20260526000000
Revises: 20260525060000
Create Date: 2026-05-26 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "20260526000000"
down_revision: Union[str, None] = "20260525060000"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Product cost fields
    op.add_column("products", sa.Column("costo_promedio", sa.Numeric(15, 2), server_default="0"))
    op.add_column("products", sa.Column("ultimo_costo", sa.Numeric(15, 2), server_default="0"))
    op.add_column("products", sa.Column("costo_landed", sa.Numeric(15, 2), server_default="0"))
    op.add_column("products", sa.Column("precio_venta", sa.Numeric(15, 2), server_default="0"))

    # Supplier agreements
    op.create_table(
        "dist_supplier_agreements",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.func.gen_random_uuid(), primary_key=True),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("supplier_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("numero", sa.String(30), nullable=False),
        sa.Column("nombre", sa.String(200), nullable=False),
        sa.Column("tipo", sa.String(30), nullable=False, server_default="compra"),
        sa.Column("fecha_inicio", sa.Date(), nullable=False),
        sa.Column("fecha_fin", sa.Date(), nullable=False),
        sa.Column("renovacion_automatica", sa.Boolean(), server_default="false"),
        sa.Column("descuento_general_pct", sa.Numeric(5, 2), server_default="0"),
        sa.Column("bono_volumen_pct", sa.Numeric(5, 2), server_default="0"),
        sa.Column("dias_credito", sa.Integer(), server_default="0"),
        sa.Column("moneda", sa.String(3), server_default="PYG"),
        sa.Column("estado", sa.String(20), nullable=False, server_default="borrador"),
        sa.Column("condiciones", sa.Text()),
        sa.Column("archivo_url", sa.Text()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
    )
    op.create_table(
        "dist_supplier_agreement_items",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.func.gen_random_uuid(), primary_key=True),
        sa.Column("agreement_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("dist_supplier_agreements.id"), nullable=False, index=True),
        sa.Column("product_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("precio_especial", sa.Numeric(15, 2)),
        sa.Column("descuento_pct", sa.Numeric(5, 2), server_default="0"),
        sa.Column("cantidad_minima", sa.Numeric(12, 3), server_default="0"),
        sa.Column("bono_pct", sa.Numeric(5, 2), server_default="0"),
        sa.Column("precio_lista_referencia", sa.Numeric(15, 2)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # PO approval config
    op.create_table(
        "dist_po_approval_configs",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.func.gen_random_uuid(), primary_key=True),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False, index=True, unique=True),
        sa.Column("requiere_aprobacion", sa.Boolean(), server_default="true"),
        sa.Column("monto_maximo_sin_aprobacion", sa.Numeric(15, 2), server_default="0"),
        sa.Column("niveles_aprobacion", sa.Integer(), server_default="1"),
        sa.Column("aprobadores_nivel1", postgresql.JSON),
        sa.Column("aprobadores_nivel2", postgresql.JSON),
        sa.Column("monto_maximo_nivel1", sa.Numeric(15, 2), server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
    )
    op.create_table(
        "dist_po_approvals",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.func.gen_random_uuid(), primary_key=True),
        sa.Column("purchase_order_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("nivel", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("estado", sa.String(20), nullable=False, server_default="pendiente"),
        sa.Column("aprobador_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("fecha_decision", sa.DateTime(timezone=True)),
        sa.Column("motivo_rechazo", sa.Text()),
        sa.Column("comentarios", sa.Text()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
    )

    # Container reconciliation fields
    op.add_column("import_containers", sa.Column("purchase_order_id", postgresql.UUID(as_uuid=True), index=True))
    op.add_column("import_items", sa.Column("purchase_order_item_id", postgresql.UUID(as_uuid=True), index=True))


def downgrade() -> None:
    op.drop_column("import_items", "purchase_order_item_id")
    op.drop_column("import_containers", "purchase_order_id")
    op.drop_table("dist_po_approvals")
    op.drop_table("dist_po_approval_configs")
    op.drop_table("dist_supplier_agreement_items")
    op.drop_table("dist_supplier_agreements")
    op.drop_column("products", "precio_venta")
    op.drop_column("products", "costo_landed")
    op.drop_column("products", "ultimo_costo")
    op.drop_column("products", "costo_promedio")
