"""consola de plataforma: incidencias, latidos, auditoria, verificaciones

Revision ID: 20260922100000
Revises: 20260921180000
Create Date: 2026-09-22 10:00:00
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "20260922100000"
down_revision: Union[str, Sequence[str], None] = "20260921180000"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

TS = sa.DateTime(timezone=True)


def upgrade() -> None:
    op.create_table(
        "mon_issues",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("environment", sa.String(12), nullable=False, server_default="production"),
        sa.Column("fingerprint", sa.String(64), nullable=False),
        sa.Column("source", sa.String(16), nullable=False),
        sa.Column("level", sa.String(10), nullable=False, server_default="error"),
        sa.Column("title", sa.String(300), nullable=False),
        sa.Column("culprit", sa.String(300)),
        sa.Column("provider", sa.String(40)),
        sa.Column("status", sa.String(12), nullable=False, server_default="unresolved"),
        sa.Column("first_seen", TS, nullable=False, server_default=sa.func.now()),
        sa.Column("last_seen", TS, nullable=False, server_default=sa.func.now()),
        sa.Column("occurrences", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("regressions", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("first_release", sa.String(60)),
        sa.Column("last_release", sa.String(60)),
        sa.Column("resolved_at", TS),
        sa.Column("resolved_release", sa.String(60)),
        sa.Column("resolved_by", sa.String(120)),
        sa.Column("ignored_until", TS),
        sa.Column("last_alert_at", TS),
        sa.Column("spike_alert_at", TS),
        sa.Column("note", sa.Text()),
        sa.Column("dims", postgresql.JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.UniqueConstraint("environment", "fingerprint", name="uq_mon_issue_fp"),
    )
    op.create_index("ix_mon_issues_status_last", "mon_issues", ["status", "last_seen"])
    op.create_index("ix_mon_issues_source", "mon_issues", ["source"])
    op.create_index("ix_mon_issues_provider", "mon_issues", ["provider"])

    op.create_table(
        "mon_events",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("issue_id", sa.UUID(), sa.ForeignKey("mon_issues.id", ondelete="CASCADE"), nullable=False),
        sa.Column("ts", TS, nullable=False, server_default=sa.func.now()),
        sa.Column("level", sa.String(10), nullable=False, server_default="error"),
        sa.Column("message", sa.Text()),
        sa.Column("stack", sa.Text()),
        sa.Column("request_id", sa.String(16)),
        sa.Column("route", sa.String(300)),
        sa.Column("http_method", sa.String(8)),
        sa.Column("http_status", sa.Integer()),
        sa.Column("duration_ms", sa.Integer()),
        sa.Column("user_id", sa.String(40)),
        sa.Column("user_name", sa.String(120)),
        sa.Column("rol", sa.String(40)),
        sa.Column("hostname", sa.String(80)),
        sa.Column("punto_emision", sa.String(10)),
        sa.Column("release", sa.String(60)),
        sa.Column("app_version", sa.String(40)),
        sa.Column("url", sa.String(500)),
        sa.Column("client_ip", sa.String(45)),
        sa.Column("user_agent", sa.String(300)),
        sa.Column("breadcrumbs", postgresql.JSONB()),
        sa.Column("extra", postgresql.JSONB()),
    )
    op.create_index("ix_mon_events_issue_ts", "mon_events", ["issue_id", "ts"])
    op.create_index("ix_mon_events_ts", "mon_events", ["ts"])

    op.create_table(
        "mon_issue_hourly",
        sa.Column("issue_id", sa.UUID(), sa.ForeignKey("mon_issues.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("bucket", TS, primary_key=True),
        sa.Column("count", sa.Integer(), nullable=False, server_default="0"),
    )

    op.create_table(
        "mon_heartbeats",
        sa.Column("key", sa.String(120), primary_key=True),
        sa.Column("kind", sa.String(10), nullable=False, server_default="web"),
        sa.Column("environment", sa.String(12), nullable=False, server_default="production"),
        sa.Column("hostname", sa.String(80)),
        sa.Column("punto_emision", sa.String(10)),
        sa.Column("user_name", sa.String(120)),
        sa.Column("rol", sa.String(40)),
        sa.Column("release", sa.String(60)),
        sa.Column("app_version", sa.String(40)),
        sa.Column("electron_version", sa.String(40)),
        sa.Column("capabilities", postgresql.JSONB()),
        sa.Column("url", sa.String(500)),
        sa.Column("client_ip", sa.String(45)),
        sa.Column("user_agent", sa.String(300)),
        sa.Column("first_seen", TS, server_default=sa.func.now()),
        sa.Column("last_seen", TS, server_default=sa.func.now()),
        sa.Column("meta", postgresql.JSONB()),
    )

    op.create_table(
        "platform_audit",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("ts", TS, nullable=False, server_default=sa.func.now()),
        sa.Column("actor_id", sa.String(40)),
        sa.Column("actor_name", sa.String(120)),
        sa.Column("action", sa.String(60), nullable=False),
        sa.Column("target_type", sa.String(40)),
        sa.Column("target_id", sa.String(80)),
        sa.Column("target_label", sa.String(160)),
        sa.Column("company_id", sa.UUID()),
        sa.Column("before", postgresql.JSONB()),
        sa.Column("after", postgresql.JSONB()),
        sa.Column("client_ip", sa.String(45)),
    )
    op.create_index("ix_platform_audit_ts", "platform_audit", ["ts"])

    op.create_table(
        "integration_checks",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("ts", TS, nullable=False, server_default=sa.func.now()),
        sa.Column("company_id", sa.UUID()),
        sa.Column("provider", sa.String(40), nullable=False),
        sa.Column("environment", sa.String(12)),
        sa.Column("ok", sa.Boolean(), nullable=False),
        sa.Column("latency_ms", sa.Integer()),
        sa.Column("detail", sa.Text()),
        sa.Column("actor", sa.String(120)),
        sa.Column("meta", postgresql.JSONB()),
    )
    op.create_index("ix_integration_checks_prov_ts", "integration_checks", ["provider", "ts"])

    op.create_table(
        "platform_settings",
        sa.Column("key", sa.String(60), primary_key=True),
        sa.Column("value", postgresql.JSONB()),
        sa.Column("updated_at", TS, server_default=sa.func.now()),
    )


def downgrade() -> None:
    for t in ("platform_settings", "integration_checks", "platform_audit", "mon_heartbeats",
              "mon_issue_hourly", "mon_events", "mon_issues"):
        op.drop_table(t)
