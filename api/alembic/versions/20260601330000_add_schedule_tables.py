"""add schedule tables (sch_ prefix)

Revision ID: 20260601330000
Revises: 20260601320000
Create Date: 2026-06-04 14:30:00.000000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "20260601330000"
down_revision = "20260601320000"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "sch_shift_templates",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("branch_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("nombre", sa.String(100), nullable=False),
        sa.Column("area", sa.String(50), nullable=False),
        sa.Column("rol", sa.String(50), nullable=True),
        sa.Column("hora_inicio", sa.Time, nullable=False),
        sa.Column("hora_fin", sa.Time, nullable=False),
        sa.Column("days_of_week", postgresql.JSON, nullable=True),
        sa.Column("quantity_required", sa.Integer, server_default="1"),
        sa.Column("min_break_minutes", sa.Integer, server_default="60"),
        sa.Column("is_night_shift", sa.Boolean, server_default="false"),
        sa.Column("is_holiday", sa.Boolean, server_default="false"),
        sa.Column("activo", sa.Boolean, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_table(
        "sch_shift_plans",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("branch_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("template_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("sch_shift_templates.id"), nullable=True),
        sa.Column("employee_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("employee_name", sa.String(200), nullable=True),
        sa.Column("area", sa.String(50), nullable=False),
        sa.Column("rol", sa.String(50), nullable=True),
        sa.Column("fecha", sa.Date, nullable=False, index=True),
        sa.Column("hora_inicio", sa.Time, nullable=False),
        sa.Column("hora_fin", sa.Time, nullable=False),
        sa.Column("is_night_shift", sa.Boolean, server_default="false"),
        sa.Column("is_holiday", sa.Boolean, server_default="false"),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column("status", sa.String(20), server_default="planned"),
        sa.Column("conflict_detected", sa.Boolean, server_default="false"),
        sa.Column("conflict_detail", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_table(
        "sch_time_clock_entries",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("branch_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("employee_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("plan_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("sch_shift_plans.id"), nullable=True),
        sa.Column("tipo", sa.String(20), nullable=False),
        sa.Column("timestamp", sa.DateTime(timezone=True), nullable=False, index=True),
        sa.Column("source", sa.String(20), server_default="web"),
        sa.Column("latitude", sa.String(30), nullable=True),
        sa.Column("longitude", sa.String(30), nullable=True),
        sa.Column("device_id", sa.String(100), nullable=True),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column("verified", sa.Boolean, server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_table(
        "sch_shift_swaps",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("plan_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("sch_shift_plans.id"), nullable=False),
        sa.Column("requester_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("receiver_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("reason", sa.Text, nullable=True),
        sa.Column("status", sa.String(20), server_default="pending"),
        sa.Column("approved_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("approved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_table(
        "sch_shift_cost_configs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("tipo_hora", sa.String(30), nullable=False),
        sa.Column("factor_pct", sa.Float, nullable=False),
        sa.Column("descripcion", sa.String(200), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade():
    op.drop_table("sch_shift_cost_configs")
    op.drop_table("sch_shift_swaps")
    op.drop_table("sch_time_clock_entries")
    op.drop_table("sch_shift_plans")
    op.drop_table("sch_shift_templates")
