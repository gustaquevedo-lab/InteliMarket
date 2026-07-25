"""Add Cold Chain IoT tables (sensors, readings, alerts, compliance logs)

Revision ID: 20260601250000
Revises: 20260601240000
Create Date: 2026-06-02 00:30:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision: str = "20260601250000"
down_revision: Union[str, None] = "20260601240000"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Cold Chain Sensors
    op.create_table(
        "cc_sensors",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("container_id", UUID(as_uuid=True), nullable=True),
        sa.Column("vehicle_id", UUID(as_uuid=True), nullable=True),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("mac_address", sa.String(20), nullable=True, unique=True),
        sa.Column("sensor_type", sa.String(20), server_default=sa.text("'dht22'")),
        sa.Column("location_type", sa.String(20), server_default=sa.text("'warehouse'")),
        sa.Column("location_name", sa.String(100), nullable=True),
        sa.Column("lat", sa.Numeric(10, 7), nullable=True),
        sa.Column("lng", sa.Numeric(10, 7), nullable=True),
        sa.Column("min_temp", sa.Numeric(5, 2), server_default=sa.text("-2.0")),
        sa.Column("max_temp", sa.Numeric(5, 2), server_default=sa.text("8.0")),
        sa.Column("max_humidity", sa.Numeric(5, 2), nullable=True),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true")),
        sa.Column("last_temperature", sa.Numeric(5, 2), nullable=True),
        sa.Column("last_humidity", sa.Numeric(5, 2), nullable=True),
        sa.Column("last_reading_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("battery_level", sa.Integer(), nullable=True),
        sa.Column("signal_strength", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # Sensor Readings (time-series)
    op.create_table(
        "cc_sensor_readings",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("sensor_id", UUID(as_uuid=True), sa.ForeignKey("cc_sensors.id"), nullable=False, index=True),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("temperature", sa.Numeric(5, 2), nullable=False),
        sa.Column("humidity", sa.Numeric(5, 2), nullable=True),
        sa.Column("battery", sa.Integer(), nullable=True),
        sa.Column("signal_strength", sa.Integer(), nullable=True),
        sa.Column("read_at", sa.DateTime(timezone=True), nullable=False, index=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # Cold Chain Alerts
    op.create_table(
        "cc_cold_chain_alerts",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("sensor_id", UUID(as_uuid=True), sa.ForeignKey("cc_sensors.id"), nullable=False, index=True),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("alert_type", sa.String(30), nullable=False),
        sa.Column("severity", sa.String(20), server_default=sa.text("'warning'")),
        sa.Column("temperature", sa.Numeric(5, 2), nullable=True),
        sa.Column("threshold_min", sa.Numeric(5, 2), nullable=True),
        sa.Column("threshold_max", sa.Numeric(5, 2), nullable=True),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("is_resolved", sa.Boolean(), server_default=sa.text("false")),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("resolved_by", UUID(as_uuid=True), nullable=True),
        sa.Column("whatsapp_notified", sa.Boolean(), server_default=sa.text("false")),
        sa.Column("whatsapp_notified_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # Compliance Logs (DINALFA)
    op.create_table(
        "cc_compliance_logs",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("sensor_id", UUID(as_uuid=True), sa.ForeignKey("cc_sensors.id"), nullable=True),
        sa.Column("container_id", UUID(as_uuid=True), nullable=True),
        sa.Column("product_id", UUID(as_uuid=True), nullable=True),
        sa.Column("product_name", sa.String(200), nullable=True),
        sa.Column("batch_number", sa.String(100), nullable=True),
        sa.Column("start_time", sa.DateTime(timezone=True), nullable=False),
        sa.Column("end_time", sa.DateTime(timezone=True), nullable=True),
        sa.Column("min_temp", sa.Numeric(5, 2), nullable=True),
        sa.Column("max_temp", sa.Numeric(5, 2), nullable=True),
        sa.Column("avg_temp", sa.Numeric(5, 2), nullable=True),
        sa.Column("temp_violations", sa.Integer(), server_default=sa.text("0")),
        sa.Column("total_readings", sa.Integer(), server_default=sa.text("0")),
        sa.Column("compliant", sa.Boolean(), server_default=sa.text("true")),
        sa.Column("report_generated", sa.Boolean(), server_default=sa.text("false")),
        sa.Column("report_url", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("cc_compliance_logs")
    op.drop_table("cc_cold_chain_alerts")
    op.drop_table("cc_sensor_readings")
    op.drop_table("cc_sensors")
