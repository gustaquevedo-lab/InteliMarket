"""Add Demand Forecast tables (config, predictions, overrides, anomalies, purchase suggestions, accuracy)

Revision ID: 20260601210000
Revises: 20260601200000
Create Date: 2026-06-01 21:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision: str = "20260601210000"
down_revision: Union[str, None] = "20260601200000"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Forecast Config
    op.create_table(
        "df_forecast_configs",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("model_type", sa.String(30), server_default="exponential_smoothing"),
        sa.Column("horizon_days", sa.Integer(), server_default="90"),
        sa.Column("seasonality_period", sa.Integer(), server_default="7"),
        sa.Column("confidence_level", sa.Numeric(5, 2), server_default="95.00"),
        sa.Column("min_history_days", sa.Integer(), server_default="60"),
        sa.Column("anomaly_threshold", sa.Numeric(5, 2), server_default="2.50"),
        sa.Column("reorder_weeks", sa.Integer(), server_default="2"),
        sa.Column("safety_stock_days", sa.Integer(), server_default="7"),
        sa.Column("default_markup_pct", sa.Numeric(5, 2), server_default="15.00"),
        sa.Column("activo", sa.Boolean(), server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # Forecast Predictions
    op.create_table(
        "df_forecast_predictions",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("product_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("customer_id", UUID(as_uuid=True), nullable=True, index=True),
        sa.Column("zone", sa.String(100), nullable=True, index=True),
        sa.Column("forecast_date", sa.Date(), nullable=False, index=True),
        sa.Column("predicted_qty", sa.Numeric(15, 2), nullable=False),
        sa.Column("confidence_lower", sa.Numeric(15, 2), nullable=True),
        sa.Column("confidence_upper", sa.Numeric(15, 2), nullable=True),
        sa.Column("confidence_score", sa.Numeric(5, 2), nullable=True),
        sa.Column("model_used", sa.String(30), nullable=True),
        sa.Column("factors", sa.JSON(), nullable=True),
        sa.Column("is_override", sa.Boolean(), server_default="false"),
        sa.Column("original_prediction", sa.Numeric(15, 2), nullable=True),
        sa.Column("override_reason", sa.Text(), nullable=True),
        sa.Column("overridden_by", UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # Forecast Overrides
    op.create_table(
        "df_forecast_overrides",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("product_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("customer_id", UUID(as_uuid=True), nullable=True),
        sa.Column("zone", sa.String(100), nullable=True),
        sa.Column("forecast_date", sa.Date(), nullable=False),
        sa.Column("original_qty", sa.Numeric(15, 2), nullable=False),
        sa.Column("adjusted_qty", sa.Numeric(15, 2), nullable=False),
        sa.Column("reason", sa.Text(), nullable=False),
        sa.Column("created_by", UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # Anomaly Detections
    op.create_table(
        "df_anomaly_detections",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("product_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("customer_id", UUID(as_uuid=True), nullable=True),
        sa.Column("zone", sa.String(100), nullable=True),
        sa.Column("tipo", sa.String(30), nullable=False),
        sa.Column("severity", sa.String(20), server_default="info"),
        sa.Column("detected_date", sa.Date(), nullable=False),
        sa.Column("expected_value", sa.Numeric(15, 2), nullable=True),
        sa.Column("actual_value", sa.Numeric(15, 2), nullable=True),
        sa.Column("deviation_pct", sa.Numeric(10, 2), nullable=True),
        sa.Column("z_score", sa.Numeric(10, 2), nullable=True),
        sa.Column("details", sa.JSON(), nullable=True),
        sa.Column("reviewed", sa.Boolean(), server_default="false"),
        sa.Column("reviewed_by", UUID(as_uuid=True), nullable=True),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # Purchase Suggestions
    op.create_table(
        "df_purchase_suggestions",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("product_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("supplier_id", UUID(as_uuid=True), nullable=True, index=True),
        sa.Column("suggested_qty", sa.Numeric(15, 2), nullable=False),
        sa.Column("suggested_date", sa.Date(), nullable=False),
        sa.Column("expected_price", sa.Numeric(15, 2), nullable=True),
        sa.Column("expected_total", sa.Numeric(15, 2), nullable=True),
        sa.Column("confidence_score", sa.Numeric(5, 2), nullable=True),
        sa.Column("forecast_demand", sa.Numeric(15, 2), nullable=True),
        sa.Column("current_stock", sa.Numeric(15, 2), nullable=True),
        sa.Column("stock_after_lead", sa.Numeric(15, 2), nullable=True),
        sa.Column("lead_time_days", sa.Integer(), nullable=True),
        sa.Column("status", sa.String(20), server_default="pending"),
        sa.Column("converted_order_id", UUID(as_uuid=True), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # Forecast Accuracy
    op.create_table(
        "df_forecast_accuracy",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("product_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("customer_id", UUID(as_uuid=True), nullable=True),
        sa.Column("zone", sa.String(100), nullable=True),
        sa.Column("forecast_date", sa.Date(), nullable=False),
        sa.Column("predicted_qty", sa.Numeric(15, 2), nullable=False),
        sa.Column("actual_qty", sa.Numeric(15, 2), nullable=True),
        sa.Column("error_absolute", sa.Numeric(15, 2), nullable=True),
        sa.Column("error_pct", sa.Numeric(10, 2), nullable=True),
        sa.Column("error_squared", sa.Numeric(15, 2), nullable=True),
        sa.Column("modelo", sa.String(30), nullable=True),
        sa.Column("recorded_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("df_forecast_accuracy")
    op.drop_table("df_purchase_suggestions")
    op.drop_table("df_anomaly_detections")
    op.drop_table("df_forecast_overrides")
    op.drop_table("df_forecast_predictions")
    op.drop_table("df_forecast_configs")
