"""add capacitacion tables (tr_ prefix)

Revision ID: 20260601350000
Revises: 20260601340000
Create Date: 2026-06-04 15:30:00.000000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "20260601350000"
down_revision = "20260601340000"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "tr_courses",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("category", sa.String(50), nullable=True),
        sa.Column("area", sa.String(50), nullable=True),
        sa.Column("position", sa.String(50), nullable=True),
        sa.Column("estimated_minutes", sa.Integer, server_default="0"),
        sa.Column("is_mandatory", sa.Boolean, server_default="false"),
        sa.Column("is_active", sa.Boolean, server_default="true"),
        sa.Column("is_preloaded", sa.Boolean, server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_table(
        "tr_modules",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("course_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tr_courses.id"), nullable=False, index=True),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("content_type", sa.String(20), nullable=False),
        sa.Column("content_url", sa.String(500), nullable=True),
        sa.Column("content_text", sa.Text, nullable=True),
        sa.Column("order_index", sa.Integer, server_default="0"),
        sa.Column("estimated_minutes", sa.Integer, server_default="0"),
        sa.Column("passing_score", sa.Integer, nullable=True),
        sa.Column("max_score", sa.Integer, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_table(
        "tr_assignments",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("employee_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("employee_name", sa.String(200), nullable=True),
        sa.Column("course_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tr_courses.id"), nullable=False),
        sa.Column("assigned_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("assigned_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("due_date", sa.Date, nullable=True),
        sa.Column("status", sa.String(20), server_default="assigned"),
        sa.Column("progress_pct", sa.Float, server_default="0"),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_table(
        "tr_module_progress",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("assignment_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tr_assignments.id"), nullable=False, index=True),
        sa.Column("module_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tr_modules.id"), nullable=False),
        sa.Column("status", sa.String(20), server_default="pending"),
        sa.Column("score", sa.Float, nullable=True),
        sa.Column("max_score", sa.Float, nullable=True),
        sa.Column("attempts", sa.Integer, server_default="0"),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_table(
        "tr_certificates",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("employee_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("employee_name", sa.String(200), nullable=True),
        sa.Column("course_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tr_courses.id"), nullable=False),
        sa.Column("assignment_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tr_assignments.id"), nullable=True),
        sa.Column("issued_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("expires_at", sa.Date, nullable=True),
        sa.Column("score", sa.Float, nullable=True),
        sa.Column("is_valid", sa.Boolean, server_default="true"),
        sa.Column("recertified_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade():
    op.drop_table("tr_certificates")
    op.drop_table("tr_module_progress")
    op.drop_table("tr_assignments")
    op.drop_table("tr_modules")
    op.drop_table("tr_courses")
