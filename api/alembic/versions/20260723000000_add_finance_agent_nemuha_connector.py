"""add finance_agent and nemuha_connector tables

Revision ID: 20260723000000
Revises: 20260609000000
Create Date: 2026-07-23 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20260723000000"
down_revision: Union[str, None] = "20260609000000"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── nemuha_connector ────────────────────────────────────────────────────
    op.create_table(
        "nemuha_sync_runs",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True), server_default=sa.func.gen_random_uuid(), primary_key=True),
        sa.Column("company_id", sa.dialects.postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("finished_at", sa.DateTime(timezone=True)),
        sa.Column("status", sa.String(20), server_default="running"),
        sa.Column("since_date", sa.DateTime(timezone=True)),
        sa.Column("rows_synced", sa.JSON()),
        sa.Column("errors", sa.JSON()),
    )
    op.create_index("ix_nemuha_sync_runs_company_id", "nemuha_sync_runs", ["company_id"])

    op.create_table(
        "nemuha_record_map",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True), server_default=sa.func.gen_random_uuid(), primary_key=True),
        sa.Column("company_id", sa.dialects.postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("source_table", sa.String(60), nullable=False),
        sa.Column("source_pk", sa.Integer(), nullable=False),
        sa.Column("target_table", sa.String(60), nullable=False),
        sa.Column("target_id", sa.dialects.postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
    )
    op.create_index("ix_nemuha_record_map_company_id", "nemuha_record_map", ["company_id"])
    op.create_index("ix_nemuha_record_map_source_table", "nemuha_record_map", ["source_table"])
    op.create_index("ix_nemuha_record_map_source_pk", "nemuha_record_map", ["source_pk"])
    op.create_unique_constraint(
        "uq_nemuha_record_map_source",
        "nemuha_record_map",
        ["company_id", "source_table", "source_pk"],
    )

    # ── finance_agent ───────────────────────────────────────────────────────
    op.create_table(
        "finance_agent_runs",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", sa.dialects.postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("finished_at", sa.DateTime(timezone=True)),
        sa.Column("model", sa.String(60)),
        sa.Column("status", sa.String(20), server_default="running"),
        sa.Column("diagnostico", sa.Text()),
        sa.Column("contexto", sa.JSON()),
        sa.Column("respuesta_cruda", sa.JSON()),
        sa.Column("error_message", sa.Text()),
    )
    op.create_index("ix_finance_agent_runs_company_id", "finance_agent_runs", ["company_id"])

    op.create_table(
        "finance_recommendations",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", sa.dialects.postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("run_id", sa.dialects.postgresql.UUID(as_uuid=True), sa.ForeignKey("finance_agent_runs.id"), nullable=False),
        sa.Column("tipo", sa.String(30), nullable=False),
        sa.Column("titulo", sa.String(200), nullable=False),
        sa.Column("descripcion", sa.Text(), nullable=False),
        sa.Column("entidad_relacionada", sa.String(200)),
        sa.Column("monto_relacionado", sa.String(30)),
        sa.Column("requested_by", sa.String(20), server_default="ai_agent"),
        sa.Column("approved_by", sa.dialects.postgresql.UUID(as_uuid=True)),
        sa.Column("status", sa.String(20), server_default="pending"),
        sa.Column("comments", sa.Text()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
    )
    op.create_index("ix_finance_recommendations_company_id", "finance_recommendations", ["company_id"])
    op.create_index("ix_finance_recommendations_run_id", "finance_recommendations", ["run_id"])


def downgrade() -> None:
    op.drop_index("ix_finance_recommendations_run_id", table_name="finance_recommendations")
    op.drop_index("ix_finance_recommendations_company_id", table_name="finance_recommendations")
    op.drop_table("finance_recommendations")
    op.drop_index("ix_finance_agent_runs_company_id", table_name="finance_agent_runs")
    op.drop_table("finance_agent_runs")

    op.drop_constraint("uq_nemuha_record_map_source", "nemuha_record_map", type_="unique")
    op.drop_index("ix_nemuha_record_map_source_pk", table_name="nemuha_record_map")
    op.drop_index("ix_nemuha_record_map_source_table", table_name="nemuha_record_map")
    op.drop_index("ix_nemuha_record_map_company_id", table_name="nemuha_record_map")
    op.drop_table("nemuha_record_map")
    op.drop_index("ix_nemuha_sync_runs_company_id", table_name="nemuha_sync_runs")
    op.drop_table("nemuha_sync_runs")
