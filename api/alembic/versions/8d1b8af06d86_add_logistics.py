"""add_logistics

Revision ID: 8d1b8af06d86
Revises: 08b26510b7d5
Create Date: 2026-05-05 10:23:54.917664
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '8d1b8af06d86'
down_revision: Union[str, None] = '08b26510b7d5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "deliveries",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True), server_default=sa.func.gen_random_uuid(), primary_key=True),
        sa.Column("company_id", sa.dialects.postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("sale_id", sa.dialects.postgresql.UUID(as_uuid=True)),
        sa.Column("customer_id", sa.dialects.postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("branch_id", sa.dialects.postgresql.UUID(as_uuid=True)),
        sa.Column("driver_name", sa.String(200)),
        sa.Column("vehicle_plate", sa.String(20)),
        sa.Column("direccion_entrega", sa.String(500), nullable=False),
        sa.Column("coordenadas", sa.String(100)),
        sa.Column("estado", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("fecha_programada", sa.DateTime(timezone=True)),
        sa.Column("fecha_salida", sa.DateTime(timezone=True)),
        sa.Column("fecha_entrega", sa.DateTime(timezone=True)),
        sa.Column("observaciones", sa.Text()),
        sa.Column("tracking_notes", sa.Text()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
    )
    op.create_index("ix_deliveries_company_id", "deliveries", ["company_id"])
    op.create_index("ix_deliveries_sale_id", "deliveries", ["sale_id"])
    op.create_index("ix_deliveries_customer_id", "deliveries", ["customer_id"])

    op.create_table(
        "routes",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True), server_default=sa.func.gen_random_uuid(), primary_key=True),
        sa.Column("company_id", sa.dialects.postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("nombre", sa.String(200), nullable=False),
        sa.Column("descripcion", sa.Text()),
        sa.Column("driver_name", sa.String(200)),
        sa.Column("vehicle_plate", sa.String(20)),
        sa.Column("fecha", sa.DateTime(timezone=True), nullable=False),
        sa.Column("estado", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("total_deliveries", sa.Integer(), server_default="0"),
        sa.Column("completed_deliveries", sa.Integer(), server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
    )
    op.create_index("ix_routes_company_id", "routes", ["company_id"])

    op.create_table(
        "route_stops",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True), server_default=sa.func.gen_random_uuid(), primary_key=True),
        sa.Column("route_id", sa.dialects.postgresql.UUID(as_uuid=True), sa.ForeignKey("routes.id"), nullable=False),
        sa.Column("delivery_id", sa.dialects.postgresql.UUID(as_uuid=True), sa.ForeignKey("deliveries.id"), nullable=False, unique=True),
        sa.Column("orden", sa.Integer(), nullable=False),
        sa.Column("estado", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("fecha_llegada", sa.DateTime(timezone=True)),
        sa.Column("observaciones", sa.Text()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_route_stops_route_id", "route_stops", ["route_id"])


def downgrade() -> None:
    op.drop_index("ix_route_stops_route_id", table_name="route_stops")
    op.drop_table("route_stops")
    op.drop_index("ix_routes_company_id", table_name="routes")
    op.drop_table("routes")
    op.drop_index("ix_deliveries_customer_id", table_name="deliveries")
    op.drop_index("ix_deliveries_sale_id", table_name="deliveries")
    op.drop_index("ix_deliveries_company_id", table_name="deliveries")
    op.drop_table("deliveries")
