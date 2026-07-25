"""add forecast avanzado tables (sm_ prefix)

Revision ID: 20260601380000
Revises: 20260601370000
Create Date: 2026-06-04 17:00:00.000000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "20260601380000"
down_revision = "20260601370000"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "sm_holiday_calendar",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("holiday_date", sa.Date, nullable=False, index=True),
        sa.Column("category", sa.String(50), nullable=False),
        sa.Column("impact_weight", sa.Float, server_default="1.0"),
        sa.Column("repeat_yearly", sa.Boolean, server_default="true"),
        sa.Column("affected_categories", postgresql.JSON, nullable=True),
        sa.Column("lift_multiplier", sa.Float, server_default="1.0"),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_table(
        "sm_external_factors",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("factor_type", sa.String(30), nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("factor_date", sa.Date, nullable=False, index=True),
        sa.Column("value", sa.Float, server_default="0"),
        sa.Column("affected_categories", postgresql.JSON, nullable=True),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_table(
        "sm_forecast_model_configs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("target_type", sa.String(30), nullable=False),
        sa.Column("target_id", sa.String(100), nullable=False),
        sa.Column("target_name", sa.String(200), nullable=True),
        sa.Column("base_daily_sales", sa.Float, server_default="0"),
        sa.Column("dow_coefficients", postgresql.JSON, nullable=True),
        sa.Column("holiday_coefficient", sa.Float, server_default="1.0"),
        sa.Column("weather_coefficient", sa.Float, server_default="0.01"),
        sa.Column("promo_lift_by_type", postgresql.JSON, nullable=True),
        sa.Column("seasonality_factors", postgresql.JSON, nullable=True),
        sa.Column("last_calibrated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("calibration_samples", sa.Integer, server_default="0"),
        sa.Column("mape_score", sa.Float, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_table(
        "sm_forecast_results",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("target_type", sa.String(30), nullable=False),
        sa.Column("target_id", sa.String(100), nullable=False),
        sa.Column("target_name", sa.String(200), nullable=True),
        sa.Column("forecast_date", sa.Date, nullable=False, index=True),
        sa.Column("baseline", sa.Float, server_default="0"),
        sa.Column("adjusted_forecast", sa.Float, server_default="0"),
        sa.Column("lower_bound", sa.Float, server_default="0"),
        sa.Column("upper_bound", sa.Float, server_default="0"),
        sa.Column("factor_decomposition", postgresql.JSON, nullable=True),
        sa.Column("confidence_level", sa.Float, server_default="0.95"),
        sa.Column("is_revised", sa.Boolean, server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade():
    op.drop_table("sm_forecast_results")
    op.drop_table("sm_forecast_model_configs")
    op.drop_table("sm_external_factors")
    op.drop_table("sm_holiday_calendar")
