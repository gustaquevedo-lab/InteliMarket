"""Add fleet management tables for InteliEntregas (merge branches).

Revision ID: 20260531000000
Revises: ('20260529000000', '20260530_add_tracking_tables')
Create Date: 2026-05-31 00:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB


revision: str = "20260531000000"
down_revision: Union[str, Sequence[str], None] = ("20260529000000", "20260530_add_tracking_tables")
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── Vehicle Maintenance ──
    op.create_table(
        "intelientregas_vehicle_maintenance",
        sa.Column("id", UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("tenant_id", UUID(as_uuid=True), nullable=False),
        sa.Column("vehicle_id", UUID(as_uuid=True), sa.ForeignKey("public.intelientregas_vehicles.id"), nullable=False),
        sa.Column("tipo", sa.Enum("oil_change", "tires", "brakes", "battery", "transmission",
                                   "suspension", "electrical", "ac", "general_service",
                                   "itv", "insurance", "other", name="maintenancetype"), nullable=False),
        sa.Column("descripcion", sa.Text()),
        sa.Column("status", sa.Enum("scheduled", "in_progress", "completed", "cancelled",
                                     name="maintenancestatus"), nullable=False,
                  server_default="scheduled"),
        sa.Column("scheduled_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("costo", sa.Float(), server_default="0"),
        sa.Column("proveedor", sa.String(200)),
        sa.Column("notas", sa.Text()),
        sa.Column("odometro_km", sa.Integer()),
        sa.Column("proximo_vencimiento_km", sa.Integer()),
        sa.Column("proximo_vencimiento_fecha", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        schema="public",
    )
    op.create_index("ix_vehicle_maintenance_tenant", "intelientregas_vehicle_maintenance",
                     ["tenant_id"], schema="public")
    op.create_index("ix_vehicle_maintenance_vehicle", "intelientregas_vehicle_maintenance",
                     ["vehicle_id"], schema="public")
    op.create_index("ix_vehicle_maintenance_status", "intelientregas_vehicle_maintenance",
                     ["status"], schema="public")

    # ── Vehicle Fuel Entries ──
    op.create_table(
        "intelientregas_vehicle_fuel",
        sa.Column("id", UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("tenant_id", UUID(as_uuid=True), nullable=False),
        sa.Column("vehicle_id", UUID(as_uuid=True), sa.ForeignKey("public.intelientregas_vehicles.id"), nullable=False),
        sa.Column("driver_id", UUID(as_uuid=True), sa.ForeignKey("public.intelientregas_drivers.id"), nullable=True),
        sa.Column("fecha", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("tipo", sa.Enum("gasoline", "diesel", "ethanol", "electric", "hybrid", "gnv",
                                   name="fueltype"), nullable=False,
                  server_default="diesel"),
        sa.Column("litros", sa.Float(), nullable=False),
        sa.Column("costo_por_litro", sa.Float(), server_default="0"),
        sa.Column("costo_total", sa.Float(), server_default="0"),
        sa.Column("odometro_km", sa.Integer()),
        sa.Column("proveedor", sa.String(200)),
        sa.Column("comprobante_url", sa.Text()),
        sa.Column("notas", sa.Text()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        schema="public",
    )
    op.create_index("ix_vehicle_fuel_tenant", "intelientregas_vehicle_fuel",
                     ["tenant_id"], schema="public")
    op.create_index("ix_vehicle_fuel_vehicle", "intelientregas_vehicle_fuel",
                     ["vehicle_id"], schema="public")

    # ── Vehicle Expenses ──
    op.create_table(
        "intelientregas_vehicle_expenses",
        sa.Column("id", UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("tenant_id", UUID(as_uuid=True), nullable=False),
        sa.Column("vehicle_id", UUID(as_uuid=True), sa.ForeignKey("public.intelientregas_vehicles.id"), nullable=False),
        sa.Column("categoria", sa.String(50), nullable=False),
        sa.Column("descripcion", sa.Text()),
        sa.Column("monto", sa.Float(), server_default="0"),
        sa.Column("fecha", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("comprobante_url", sa.Text()),
        sa.Column("proveedor", sa.String(200)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        schema="public",
    )
    op.create_index("ix_vehicle_expenses_tenant", "intelientregas_vehicle_expenses",
                     ["tenant_id"], schema="public")
    op.create_index("ix_vehicle_expenses_vehicle", "intelientregas_vehicle_expenses",
                     ["vehicle_id"], schema="public")

    # ── Checklist Items ──
    op.create_table(
        "intelientregas_checklist_items",
        sa.Column("id", UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("tenant_id", UUID(as_uuid=True), nullable=False),
        sa.Column("nombre", sa.String(200), nullable=False),
        sa.Column("categoria", sa.Enum("pre_trip", "post_trip", "weekly", "monthly",
                                        name="checklistcategory"), nullable=False,
                  server_default="pre_trip"),
        sa.Column("obligatorio", sa.Boolean(), server_default="true"),
        sa.Column("activo", sa.Boolean(), server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        schema="public",
    )
    op.create_index("ix_checklist_items_tenant", "intelientregas_checklist_items",
                     ["tenant_id"], schema="public")
    op.create_index("ix_checklist_items_categoria", "intelientregas_checklist_items",
                     ["categoria"], schema="public")

    # ── Checklist Logs ──
    op.create_table(
        "intelientregas_checklist_logs",
        sa.Column("id", UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("tenant_id", UUID(as_uuid=True), nullable=False),
        sa.Column("vehicle_id", UUID(as_uuid=True), sa.ForeignKey("public.intelientregas_vehicles.id"), nullable=False),
        sa.Column("driver_id", UUID(as_uuid=True), sa.ForeignKey("public.intelientregas_drivers.id"), nullable=False),
        sa.Column("results", JSONB(), comment='{"item_id": true/false, ...}'),
        sa.Column("observaciones", sa.Text()),
        sa.Column("aprobado", sa.Boolean(), server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        schema="public",
    )
    op.create_index("ix_checklist_logs_tenant", "intelientregas_checklist_logs",
                     ["tenant_id"], schema="public")
    op.create_index("ix_checklist_logs_vehicle", "intelientregas_checklist_logs",
                     ["vehicle_id"], schema="public")
    op.create_index("ix_checklist_logs_driver", "intelientregas_checklist_logs",
                     ["driver_id"], schema="public")


def downgrade() -> None:
    op.drop_table("intelientregas_checklist_logs", schema="public")
    op.drop_table("intelientregas_checklist_items", schema="public")
    op.drop_table("intelientregas_vehicle_expenses", schema="public")
    op.drop_table("intelientregas_vehicle_fuel", schema="public")
    op.drop_table("intelientregas_vehicle_maintenance", schema="public")

    # Drop custom enum types
    op.execute("DROP TYPE IF EXISTS maintenancetype")
    op.execute("DROP TYPE IF EXISTS maintenancestatus")
    op.execute("DROP TYPE IF EXISTS fueltype")
    op.execute("DROP TYPE IF EXISTS checklistcategory")
