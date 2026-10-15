"""Caja de Ruta y Tesorería — route_sessions, route_liquidations, route_liquidation_items, bank_deposits

Revision ID: 20261014120000
Revises: 20261013110000
Create Date: 2026-10-14 12:00:00
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "20261014120000"
down_revision = "20261013110000"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "route_sessions",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("cobrador_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("route_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("fecha", sa.Date(), nullable=False),
        sa.Column("estado", sa.String(20), nullable=False, server_default="abierta"),
        sa.Column("fondo_inicial", sa.Numeric(18, 0), nullable=False, server_default="0"),
        sa.Column("fondo_sobrante", sa.Numeric(18, 0), nullable=True),
        sa.Column("opened_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("closed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("company_id", "cobrador_id", "fecha", name="uq_route_session_cobrador_fecha"),
    )
    op.create_index("ix_route_sessions_company_fecha", "route_sessions", ["company_id", "fecha"])

    op.create_table(
        "route_liquidations",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("route_session_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("efectivo_declarado", sa.Numeric(18, 0), nullable=False, server_default="0"),
        sa.Column("cheques_declarado", sa.Numeric(18, 0), nullable=False, server_default="0"),
        sa.Column("pagares_declarado", sa.Numeric(18, 0), nullable=False, server_default="0"),
        sa.Column("nc_aplicadas", sa.Numeric(18, 0), nullable=False, server_default="0"),
        sa.Column("descuentos_autorizados", sa.Numeric(18, 0), nullable=False, server_default="0"),
        sa.Column("efectivo_esperado", sa.Numeric(18, 0), nullable=False, server_default="0"),
        sa.Column("total_cobrado_ar", sa.Numeric(18, 0), nullable=False, server_default="0"),
        sa.Column("estado", sa.String(20), nullable=False, server_default="pendiente"),
        sa.Column("supervisor_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("observaciones", sa.Text(), nullable=True),
        sa.Column("fecha_autorizacion", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["route_session_id"], ["route_sessions.id"]),
    )

    op.create_table(
        "route_liquidation_items",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("liquidation_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("tipo", sa.String(10), nullable=False),
        sa.Column("numero", sa.String(50), nullable=False),
        sa.Column("banco", sa.String(100), nullable=True),
        sa.Column("monto", sa.Numeric(18, 0), nullable=False),
        sa.Column("customer_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("vencimiento", sa.Date(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["liquidation_id"], ["route_liquidations.id"], ondelete="CASCADE"),
    )

    op.create_table(
        "bank_deposits",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("fecha", sa.Date(), nullable=False),
        sa.Column("bank_name", sa.String(150), nullable=False),
        sa.Column("account_number", sa.String(50), nullable=False),
        sa.Column("monto_efectivo", sa.Numeric(18, 0), nullable=False, server_default="0"),
        sa.Column("monto_cheques", sa.Numeric(18, 0), nullable=False, server_default="0"),
        sa.Column("referencia", sa.String(100), nullable=True),
        sa.Column("route_liquidation_ids", postgresql.JSONB(), nullable=False, server_default="[]"),
        sa.Column("cash_session_ids", postgresql.JSONB(), nullable=False, server_default="[]"),
        sa.Column("observaciones", sa.Text(), nullable=True),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_bank_deposits_company_fecha", "bank_deposits", ["company_id", "fecha"])


def downgrade():
    op.drop_index("ix_bank_deposits_company_fecha", table_name="bank_deposits")
    op.drop_table("bank_deposits")
    op.drop_table("route_liquidation_items")
    op.drop_table("route_liquidations")
    op.drop_index("ix_route_sessions_company_fecha", table_name="route_sessions")
    op.drop_table("route_sessions")
