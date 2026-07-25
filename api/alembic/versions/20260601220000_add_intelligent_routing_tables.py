"""Add Intelligent Routing tables (route optimizations, vehicle load configs, load results, reroute requests, ETA predictions, efficiency metrics)

Revision ID: 20260601220000
Revises: 20260601210000
Create Date: 2026-06-01 22:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision: str = "20260601220000"
down_revision: Union[str, None] = "20260601210000"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Route Optimizations (TSP results)
    op.create_table(
        "ir_route_optimizations",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("driver_id", UUID(as_uuid=True), nullable=True, index=True),
        sa.Column("vehicle_id", UUID(as_uuid=True), nullable=True),
        sa.Column("date", sa.Date(), nullable=False, index=True),
        sa.Column("total_stops", sa.Integer(), server_default="0"),
        sa.Column("total_distance_km", sa.Numeric(10, 2), nullable=True),
        sa.Column("total_duration_min", sa.Numeric(10, 2), nullable=True),
        sa.Column("optimized_distance_km", sa.Numeric(10, 2), nullable=True),
        sa.Column("optimized_duration_min", sa.Numeric(10, 2), nullable=True),
        sa.Column("saving_distance_pct", sa.Numeric(5, 2), nullable=True),
        sa.Column("saving_duration_pct", sa.Numeric(5, 2), nullable=True),
        sa.Column("algorithm", sa.String(30), server_default="nearest_neighbor_2opt"),
        sa.Column("constraints_applied", sa.JSON(), nullable=True),
        sa.Column("stops_order", sa.JSON(), nullable=True),
        sa.Column("status", sa.String(20), server_default="completed"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # Vehicle Load Configs
    op.create_table(
        "ir_vehicle_load_configs",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("vehicle_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("max_volume_m3", sa.Numeric(10, 2), nullable=True),
        sa.Column("max_weight_kg", sa.Numeric(10, 2), nullable=True),
        sa.Column("max_pallets", sa.Integer(), nullable=True),
        sa.Column("temperature_min", sa.Numeric(5, 2), nullable=True),
        sa.Column("temperature_max", sa.Numeric(5, 2), nullable=True),
        sa.Column("has_refrigeration", sa.Boolean(), server_default="false"),
        sa.Column("preferred_order", sa.String(20), server_default="lifo"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # Load Optimization Results
    op.create_table(
        "ir_load_optimization_results",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("vehicle_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("route_optimization_id", UUID(as_uuid=True), sa.ForeignKey("ir_route_optimizations.id"), nullable=True),
        sa.Column("total_volume_m3", sa.Numeric(10, 2), nullable=True),
        sa.Column("total_weight_kg", sa.Numeric(10, 2), nullable=True),
        sa.Column("total_pallets", sa.Integer(), nullable=True),
        sa.Column("utilization_volume_pct", sa.Numeric(5, 2), nullable=True),
        sa.Column("utilization_weight_pct", sa.Numeric(5, 2), nullable=True),
        sa.Column("load_order", sa.JSON(), nullable=True),
        sa.Column("temperature_zones", sa.JSON(), nullable=True),
        sa.Column("constraints_satisfied", sa.Boolean(), server_default="true"),
        sa.Column("warnings", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # Dynamic Reroute Requests
    op.create_table(
        "ir_dynamic_reroute_requests",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("driver_id", UUID(as_uuid=True), nullable=True),
        sa.Column("route_optimization_id", UUID(as_uuid=True), sa.ForeignKey("ir_route_optimizations.id"), nullable=True),
        sa.Column("reason", sa.String(30), nullable=False),
        sa.Column("new_stop_id", UUID(as_uuid=True), nullable=True),
        sa.Column("cancel_stop_id", UUID(as_uuid=True), nullable=True),
        sa.Column("original_order", sa.JSON(), nullable=True),
        sa.Column("optimized_order", sa.JSON(), nullable=True),
        sa.Column("extra_distance_km", sa.Numeric(10, 2), nullable=True),
        sa.Column("extra_duration_min", sa.Numeric(10, 2), nullable=True),
        sa.Column("status", sa.String(20), server_default="pending"),
        sa.Column("resolved_by", UUID(as_uuid=True), nullable=True),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # ETA Predictions
    op.create_table(
        "ir_eta_predictions",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("origin_lat", sa.Numeric(10, 7), nullable=False),
        sa.Column("origin_lng", sa.Numeric(10, 7), nullable=False),
        sa.Column("dest_lat", sa.Numeric(10, 7), nullable=False),
        sa.Column("dest_lng", sa.Numeric(10, 7), nullable=False),
        sa.Column("distance_km", sa.Numeric(10, 2), nullable=False),
        sa.Column("base_duration_min", sa.Numeric(10, 2), nullable=False),
        sa.Column("traffic_factor", sa.Numeric(5, 2), server_default="1.0"),
        sa.Column("zone_factor", sa.Numeric(5, 2), server_default="1.0"),
        sa.Column("time_factor", sa.Numeric(5, 2), server_default="1.0"),
        sa.Column("predicted_duration_min", sa.Numeric(10, 2), nullable=False),
        sa.Column("confidence_score", sa.Numeric(5, 2), nullable=True),
        sa.Column("zone", sa.String(100), nullable=True),
        sa.Column("hora_dia", sa.Time(), nullable=True),
        sa.Column("dia_semana", sa.Integer(), nullable=True),
        sa.Column("actual_duration_min", sa.Numeric(10, 2), nullable=True),
        sa.Column("error_min", sa.Numeric(10, 2), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # Route Efficiency Metrics
    op.create_table(
        "ir_route_efficiency_metrics",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("driver_id", UUID(as_uuid=True), nullable=True, index=True),
        sa.Column("vehicle_id", UUID(as_uuid=True), nullable=True),
        sa.Column("date", sa.Date(), nullable=False, index=True),
        sa.Column("total_stops", sa.Integer(), server_default="0"),
        sa.Column("completed_stops", sa.Integer(), server_default="0"),
        sa.Column("total_distance_km", sa.Numeric(10, 2), nullable=True),
        sa.Column("optimal_distance_km", sa.Numeric(10, 2), nullable=True),
        sa.Column("distance_efficiency_pct", sa.Numeric(5, 2), nullable=True),
        sa.Column("total_duration_min", sa.Numeric(10, 2), nullable=True),
        sa.Column("optimal_duration_min", sa.Numeric(10, 2), nullable=True),
        sa.Column("duration_efficiency_pct", sa.Numeric(5, 2), nullable=True),
        sa.Column("deliveries_per_hour", sa.Numeric(5, 2), nullable=True),
        sa.Column("avg_stop_duration_min", sa.Numeric(5, 2), nullable=True),
        sa.Column("total_volume_m3", sa.Numeric(10, 2), nullable=True),
        sa.Column("total_weight_kg", sa.Numeric(10, 2), nullable=True),
        sa.Column("load_utilization_pct", sa.Numeric(5, 2), nullable=True),
        sa.Column("eta_accuracy_pct", sa.Numeric(5, 2), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("ir_route_efficiency_metrics")
    op.drop_table("ir_eta_predictions")
    op.drop_table("ir_dynamic_reroute_requests")
    op.drop_table("ir_load_optimization_results")
    op.drop_table("ir_vehicle_load_configs")
    op.drop_table("ir_route_optimizations")
