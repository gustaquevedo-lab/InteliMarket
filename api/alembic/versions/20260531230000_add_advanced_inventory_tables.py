"""Add Advanced Inventory tables (locations, picking, cycles, consignment, auto-replenish)

Revision ID: 20260531230000
Revises: 20260531220000
Create Date: 2026-05-31 23:00:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision: str = "20260531230000"
down_revision: Union[str, None] = "20260531220000"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Storage Locations
    op.create_table(
        "adv_storage_locations",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("warehouse_id", UUID(as_uuid=True), nullable=False),
        sa.Column("codigo", sa.String(50), nullable=False),
        sa.Column("pasillo", sa.String(50)),
        sa.Column("estante", sa.String(50)),
        sa.Column("posicion", sa.String(50)),
        sa.Column("capacidad_maxima", sa.Numeric(15, 3)),
        sa.Column("activo", sa.Boolean(), default=True),
        sa.Column("created_at", sa.DateTime(timezone=True)),
        sa.UniqueConstraint("company_id", "warehouse_id", "codigo", name="uq_location_code"),
    )

    # Picking Lists
    op.create_table(
        "adv_picking_lists",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("warehouse_id", UUID(as_uuid=True), nullable=False),
        sa.Column("numero", sa.String(30), nullable=False),
        sa.Column("referencia_tipo", sa.String(30)),
        sa.Column("referencia_id", UUID(as_uuid=True)),
        sa.Column("estado", sa.String(20), nullable=False, default="pendiente"),
        sa.Column("assigned_to", UUID(as_uuid=True)),
        sa.Column("notas", sa.Text()),
        sa.Column("total_items", sa.Integer(), default=0),
        sa.Column("picked_items", sa.Integer(), default=0),
        sa.Column("started_at", sa.DateTime(timezone=True)),
        sa.Column("completed_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True)),
    )
    op.create_table(
        "adv_picking_list_items",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("picking_list_id", UUID(as_uuid=True), sa.ForeignKey("adv_picking_lists.id", ondelete="CASCADE"), nullable=False),
        sa.Column("product_id", UUID(as_uuid=True), nullable=False),
        sa.Column("product_nombre", sa.String(200)),
        sa.Column("cantidad_solicitada", sa.Numeric(15, 3), nullable=False),
        sa.Column("cantidad_pickeada", sa.Numeric(15, 3), default=0),
        sa.Column("location_id", UUID(as_uuid=True)),
        sa.Column("lot_id", UUID(as_uuid=True)),
        sa.Column("estado", sa.String(20), default="pendiente"),
        sa.Column("notas", sa.Text()),
        sa.Column("created_at", sa.DateTime(timezone=True)),
    )

    # Cycle Counts
    op.create_table(
        "adv_cycle_counts",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("warehouse_id", UUID(as_uuid=True), nullable=False),
        sa.Column("numero", sa.String(30), nullable=False),
        sa.Column("tipo", sa.String(20), nullable=False, default="rotativo"),
        sa.Column("estado", sa.String(20), nullable=False, default="abierto"),
        sa.Column("conteo_total", sa.Integer(), default=0),
        sa.Column("conteo_completado", sa.Integer(), default=0),
        sa.Column("discrepancias", sa.Integer(), default=0),
        sa.Column("notas", sa.Text()),
        sa.Column("created_by", UUID(as_uuid=True)),
        sa.Column("completed_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True)),
    )
    op.create_table(
        "adv_cycle_count_items",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("cycle_count_id", UUID(as_uuid=True), sa.ForeignKey("adv_cycle_counts.id", ondelete="CASCADE"), nullable=False),
        sa.Column("product_id", UUID(as_uuid=True), nullable=False),
        sa.Column("product_nombre", sa.String(200)),
        sa.Column("location_id", UUID(as_uuid=True)),
        sa.Column("cantidad_sistema", sa.Numeric(15, 3), nullable=False, default=0),
        sa.Column("cantidad_fisica", sa.Numeric(15, 3)),
        sa.Column("diferencia", sa.Numeric(15, 3)),
        sa.Column("estado", sa.String(20), default="pendiente"),
        sa.Column("notas", sa.Text()),
        sa.Column("counted_by", UUID(as_uuid=True)),
        sa.Column("counted_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True)),
    )

    # Consignment
    op.create_table(
        "adv_consignment_stock",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("warehouse_id", UUID(as_uuid=True), nullable=False),
        sa.Column("product_id", UUID(as_uuid=True), nullable=False),
        sa.Column("supplier_id", UUID(as_uuid=True), nullable=False),
        sa.Column("supplier_nombre", sa.String(200)),
        sa.Column("cantidad", sa.Numeric(15, 3), nullable=False, default=0),
        sa.Column("costo_acordado", sa.Numeric(15, 2)),
        sa.Column("moneda", sa.String(3), default="PYG"),
        sa.Column("fecha_ingreso", sa.DateTime(timezone=True)),
        sa.Column("fecha_vencimiento", sa.DateTime(timezone=True)),
        sa.Column("notas", sa.Text()),
        sa.Column("activo", sa.Boolean(), default=True),
        sa.Column("created_at", sa.DateTime(timezone=True)),
    )
    op.create_table(
        "adv_consignment_movements",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("consignment_id", UUID(as_uuid=True), sa.ForeignKey("adv_consignment_stock.id", ondelete="CASCADE"), nullable=False),
        sa.Column("tipo", sa.String(20), nullable=False),
        sa.Column("cantidad", sa.Numeric(15, 3), nullable=False),
        sa.Column("referencia_tipo", sa.String(30)),
        sa.Column("referencia_id", UUID(as_uuid=True)),
        sa.Column("notas", sa.Text()),
        sa.Column("created_at", sa.DateTime(timezone=True)),
    )

    # Auto Replenish Rules
    op.create_table(
        "adv_auto_replenish_rules",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("product_id", UUID(as_uuid=True), nullable=False),
        sa.Column("warehouse_id", UUID(as_uuid=True), nullable=False),
        sa.Column("stock_minimo", sa.Numeric(15, 3), nullable=False),
        sa.Column("stock_seguridad", sa.Numeric(15, 3), default=0),
        sa.Column("cantidad_reorden", sa.Numeric(15, 3)),
        sa.Column("lead_time_dias", sa.Integer(), default=1),
        sa.Column("supplier_id", UUID(as_uuid=True)),
        sa.Column("activo", sa.Boolean(), default=True),
        sa.Column("ultima_alerta_at", sa.DateTime(timezone=True)),
        sa.Column("auto_generar_oc", sa.Boolean(), default=False),
        sa.Column("created_at", sa.DateTime(timezone=True)),
        sa.UniqueConstraint("company_id", "product_id", "warehouse_id", name="uq_replenish_rule"),
    )


def downgrade() -> None:
    op.drop_table("adv_auto_replenish_rules")
    op.drop_table("adv_consignment_movements")
    op.drop_table("adv_consignment_stock")
    op.drop_table("adv_cycle_count_items")
    op.drop_table("adv_cycle_counts")
    op.drop_table("adv_picking_list_items")
    op.drop_table("adv_picking_lists")
    op.drop_table("adv_storage_locations")
