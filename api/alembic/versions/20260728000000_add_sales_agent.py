"""add sales_agent tables

Revision ID: 20260728000000
Revises: 20260727000000
Create Date: 2026-07-28 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20260728000000"
down_revision: Union[str, None] = "20260727000000"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "sales_agent_runs",
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
    op.create_index("ix_sales_agent_runs_company_id", "sales_agent_runs", ["company_id"])

    op.create_table(
        "sales_recommendations",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", sa.dialects.postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("run_id", sa.dialects.postgresql.UUID(as_uuid=True), sa.ForeignKey("sales_agent_runs.id"), nullable=False),
        sa.Column("tipo", sa.String(30), nullable=False),
        sa.Column("titulo", sa.String(200), nullable=False),
        sa.Column("descripcion", sa.Text(), nullable=False),
        sa.Column("entidad_relacionada", sa.String(200)),
        sa.Column("monto_relacionado", sa.String(120)),
        sa.Column("requested_by", sa.String(20), server_default="ai_agent"),
        sa.Column("approved_by", sa.dialects.postgresql.UUID(as_uuid=True)),
        sa.Column("status", sa.String(20), server_default="pending"),
        sa.Column("comments", sa.Text()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
    )
    op.create_index("ix_sales_recommendations_company_id", "sales_recommendations", ["company_id"])
    op.create_index("ix_sales_recommendations_run_id", "sales_recommendations", ["run_id"])


def downgrade() -> None:
    op.drop_index("ix_sales_recommendations_run_id", table_name="sales_recommendations")
    op.drop_index("ix_sales_recommendations_company_id", table_name="sales_recommendations")
    op.drop_table("sales_recommendations")
    op.drop_index("ix_sales_agent_runs_company_id", table_name="sales_agent_runs")
    op.drop_table("sales_agent_runs")
