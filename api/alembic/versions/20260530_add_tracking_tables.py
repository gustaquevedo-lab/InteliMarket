"""Add tracking tables: seller profiles, GPS tracking, route instances, geofence zones, alerts, metrics.

Revision ID: 20260530_add_tracking_tables
Revises: 20260526000000
Create Date: 2026-05-30 14:00:00
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSON

revision: str = "20260530_add_tracking_tables"
down_revision: Union[str, None] = "20260526000000"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── Seller Profiles ──
    op.create_table(
        "track_seller_profiles",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", UUID(as_uuid=True), nullable=False, unique=True, index=True),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("photo_url", sa.String(500)),
        sa.Column("phone_battery_level", sa.Integer(), server_default="100"),
        sa.Column("phone_updated_at", sa.DateTime(timezone=True)),
        sa.Column("status", sa.String(20), nullable=False, server_default="offline"),
        sa.Column("last_lat", sa.Numeric(10, 7)),
        sa.Column("last_lng", sa.Numeric(10, 7)),
        sa.Column("last_location_updated", sa.DateTime(timezone=True)),
        sa.Column("last_speed_kmh", sa.Numeric(6, 2), server_default="0"),
        sa.Column("is_active", sa.Boolean(), server_default="true"),
        sa.Column("telefono", sa.String(30)),
        sa.Column("zona_asignada", sa.String(100)),
        sa.Column("codigo_vendedor", sa.String(20)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # ── GPS Tracking Points ──
    op.create_table(
        "track_gps_points",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("seller_id", UUID(as_uuid=True), sa.ForeignKey("track_seller_profiles.id"), nullable=False, index=True),
        sa.Column("lat", sa.Numeric(10, 7), nullable=False),
        sa.Column("lng", sa.Numeric(10, 7), nullable=False),
        sa.Column("battery_level", sa.Integer()),
        sa.Column("speed_kmh", sa.Numeric(6, 2)),
        sa.Column("accuracy_meters", sa.Integer()),
        sa.Column("altitude_meters", sa.Numeric(8, 2)),
        sa.Column("recorded_at", sa.DateTime(timezone=True), nullable=False, index=True),
        sa.Column("received_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # ── Route Instances ──
    op.create_table(
        "track_route_instances",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("route_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("seller_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("fecha", sa.DateTime(timezone=True), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="planned"),
        sa.Column("started_at", sa.DateTime(timezone=True)),
        sa.Column("ended_at", sa.DateTime(timezone=True)),
        sa.Column("total_traveled_km", sa.Numeric(8, 2), server_default="0"),
        sa.Column("notas", sa.String(500)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # ── Route Stops / Visits ──
    op.create_table(
        "track_route_stops",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("instance_id", UUID(as_uuid=True), sa.ForeignKey("track_route_instances.id"), nullable=False, index=True),
        sa.Column("customer_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("planned_order", sa.Integer(), server_default="0"),
        sa.Column("planned_arrival", sa.DateTime(timezone=True)),
        sa.Column("actual_arrival", sa.DateTime(timezone=True)),
        sa.Column("actual_departure", sa.DateTime(timezone=True)),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("result", sa.String(30)),
        sa.Column("no_answer_count", sa.Integer(), server_default="0"),
        sa.Column("order_amount", sa.Numeric(15, 2), server_default="0"),
        sa.Column("products_count", sa.Integer(), server_default="0"),
        sa.Column("payment_collected", sa.Numeric(15, 2), server_default="0"),
        sa.Column("checkin_lat", sa.Numeric(10, 7)),
        sa.Column("checkin_lng", sa.Numeric(10, 7)),
        sa.Column("checkout_lat", sa.Numeric(10, 7)),
        sa.Column("checkout_lng", sa.Numeric(10, 7)),
        sa.Column("distance_from_customer_meters", sa.Integer()),
        sa.Column("customer_rating", sa.Integer()),
        sa.Column("notas", sa.String(1000)),
        sa.Column("fotos_url", JSON),
        sa.Column("firma_url", sa.String(500)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # ── Geofence Zones ──
    op.create_table(
        "track_geofence_zones",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("nombre", sa.String(100), nullable=False),
        sa.Column("descripcion", sa.String(500)),
        sa.Column("zone_type", sa.String(20), nullable=False, server_default="restricted"),
        sa.Column("geometry_type", sa.String(20), nullable=False, server_default="polygon"),
        sa.Column("coordinates", JSON, nullable=False),
        sa.Column("color", sa.String(7), server_default="#ef4444"),
        sa.Column("active_start_time", sa.String(5), server_default="00:00"),
        sa.Column("active_end_time", sa.String(5), server_default="23:59"),
        sa.Column("active_days", JSON),
        sa.Column("alert_on_entry", sa.Boolean(), server_default="true"),
        sa.Column("alert_on_exit", sa.Boolean(), server_default="false"),
        sa.Column("notify_supervisor", sa.Boolean(), server_default="true"),
        sa.Column("severity", sa.String(10), server_default="medium"),
        sa.Column("is_active", sa.Boolean(), server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # ── Geofence Alerts ──
    op.create_table(
        "track_geofence_alerts",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("zone_id", UUID(as_uuid=True), sa.ForeignKey("track_geofence_zones.id"), nullable=False, index=True),
        sa.Column("seller_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("gps_point_id", UUID(as_uuid=True), sa.ForeignKey("track_gps_points.id")),
        sa.Column("event_type", sa.String(20), nullable=False),
        sa.Column("lat", sa.Numeric(10, 7)),
        sa.Column("lng", sa.Numeric(10, 7)),
        sa.Column("detected_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("acknowledged_at", sa.DateTime(timezone=True)),
        sa.Column("resolved_at", sa.DateTime(timezone=True)),
        sa.Column("status", sa.String(20), nullable=False, server_default="active"),
        sa.Column("acknowledged_by", UUID(as_uuid=True)),
        sa.Column("notas", sa.String(500)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # ── Seller Performance Metrics ──
    op.create_table(
        "track_seller_metrics",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("seller_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("period_type", sa.String(10), nullable=False),
        sa.Column("period_start", sa.DateTime(timezone=True), nullable=False),
        sa.Column("period_end", sa.DateTime(timezone=True), nullable=False),
        sa.Column("total_visits", sa.Integer(), server_default="0"),
        sa.Column("completed_visits", sa.Integer(), server_default="0"),
        sa.Column("missed_visits", sa.Integer(), server_default="0"),
        sa.Column("no_answer_count", sa.Integer(), server_default="0"),
        sa.Column("total_orders", sa.Integer(), server_default="0"),
        sa.Column("total_amount", sa.Numeric(15, 2), server_default="0"),
        sa.Column("total_payment_collected", sa.Numeric(15, 2), server_default="0"),
        sa.Column("total_traveled_km", sa.Numeric(8, 2), server_default="0"),
        sa.Column("total_work_hours", sa.Numeric(6, 2), server_default="0"),
        sa.Column("productive_hours", sa.Numeric(6, 2), server_default="0"),
        sa.Column("orders_per_hour", sa.Numeric(8, 2), server_default="0"),
        sa.Column("amount_per_hour", sa.Numeric(12, 2), server_default="0"),
        sa.Column("visits_per_hour", sa.Numeric(8, 2), server_default="0"),
        sa.Column("avg_visit_duration_minutes", sa.Integer(), server_default="0"),
        sa.Column("avg_travel_between_visits_minutes", sa.Integer(), server_default="0"),
        sa.Column("avg_customer_rating", sa.Numeric(3, 2), server_default="0"),
        sa.Column("performance_score", sa.Integer()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("track_seller_metrics")
    op.drop_table("track_geofence_alerts")
    op.drop_table("track_geofence_zones")
    op.drop_table("track_route_stops")
    op.drop_table("track_route_instances")
    op.drop_table("track_gps_points")
    op.drop_table("track_seller_profiles")
