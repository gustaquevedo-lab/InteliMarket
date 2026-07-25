"""Add Marketing Automation tables (segments, campaigns, alerts, offers, surveys)

Revision ID: 20260531190000
Revises: 20260531160000
Create Date: 2026-05-31 19:00:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB

revision: str = "20260531190000"
down_revision: Union[str, None] = "20260531160000"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Customer Segments
    op.create_table(
        "marketing_segments",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("nombre", sa.String(200), nullable=False),
        sa.Column("descripcion", sa.Text()),
        sa.Column("filters", JSONB(), nullable=False, default=dict),
        sa.Column("estimated_count", sa.Integer(), default=0),
        sa.Column("last_calculated_at", sa.DateTime(timezone=True)),
        sa.Column("activo", sa.Boolean(), default=True),
        sa.Column("created_at", sa.DateTime(timezone=True)),
        sa.Column("updated_at", sa.DateTime(timezone=True)),
    )
    # Campaigns
    op.create_table(
        "marketing_campaigns",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("segment_id", UUID(as_uuid=True), sa.ForeignKey("marketing_segments.id"), nullable=True),
        sa.Column("nombre", sa.String(200), nullable=False),
        sa.Column("descripcion", sa.Text()),
        sa.Column("canal", sa.String(20), nullable=False),
        sa.Column("tipo", sa.String(30), nullable=False, default="promocion"),
        sa.Column("contenido", sa.Text()),
        sa.Column("template_id", UUID(as_uuid=True)),
        sa.Column("scheduled_at", sa.DateTime(timezone=True)),
        sa.Column("sent_at", sa.DateTime(timezone=True)),
        sa.Column("completed_at", sa.DateTime(timezone=True)),
        sa.Column("estado", sa.String(20), default="borrador"),
        sa.Column("total_recipients", sa.Integer(), default=0),
        sa.Column("sent_count", sa.Integer(), default=0),
        sa.Column("delivered_count", sa.Integer(), default=0),
        sa.Column("opened_count", sa.Integer(), default=0),
        sa.Column("clicked_count", sa.Integer(), default=0),
        sa.Column("converted_count", sa.Integer(), default=0),
        sa.Column("created_by", UUID(as_uuid=True)),
        sa.Column("created_at", sa.DateTime(timezone=True)),
        sa.Column("updated_at", sa.DateTime(timezone=True)),
    )
    # Campaign Recipients
    op.create_table(
        "marketing_campaign_recipients",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("campaign_id", UUID(as_uuid=True), sa.ForeignKey("marketing_campaigns.id", ondelete="CASCADE"), nullable=False),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("customer_id", UUID(as_uuid=True), nullable=False),
        sa.Column("customer_nombre", sa.String(200)),
        sa.Column("customer_telefono", sa.String(50)),
        sa.Column("customer_email", sa.String(255)),
        sa.Column("estado", sa.String(20), default="pendiente"),
        sa.Column("error_message", sa.Text()),
        sa.Column("sent_at", sa.DateTime(timezone=True)),
        sa.Column("opened_at", sa.DateTime(timezone=True)),
        sa.Column("clicked_at", sa.DateTime(timezone=True)),
        sa.Column("converted_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True)),
    )
    # Stock Alerts
    op.create_table(
        "marketing_stock_alerts",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("customer_id", UUID(as_uuid=True), nullable=False),
        sa.Column("product_id", UUID(as_uuid=True), nullable=False),
        sa.Column("activo", sa.Boolean(), default=True),
        sa.Column("notify_whatsapp", sa.Boolean(), default=True),
        sa.Column("notify_email", sa.Boolean(), default=False),
        sa.Column("last_notified_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True)),
        sa.UniqueConstraint("company_id", "customer_id", "product_id", name="uq_stock_alert_customer_product"),
    )
    # Customer Offers
    op.create_table(
        "marketing_customer_offers",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("customer_id", UUID(as_uuid=True), nullable=False),
        sa.Column("campaign_id", UUID(as_uuid=True), sa.ForeignKey("marketing_campaigns.id"), nullable=True),
        sa.Column("product_id", UUID(as_uuid=True)),
        sa.Column("titulo", sa.String(200), nullable=False),
        sa.Column("descripcion", sa.Text()),
        sa.Column("tipo", sa.String(20), nullable=False),
        sa.Column("valor", sa.Numeric(15, 2)),
        sa.Column("codigo_cupon", sa.String(50)),
        sa.Column("valido_desde", sa.DateTime(timezone=True)),
        sa.Column("valido_hasta", sa.DateTime(timezone=True)),
        sa.Column("usado", sa.Boolean(), default=False),
        sa.Column("usado_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True)),
    )
    # Surveys
    op.create_table(
        "marketing_surveys",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("nombre", sa.String(200), nullable=False),
        sa.Column("preguntas", JSONB(), nullable=False),
        sa.Column("activo", sa.Boolean(), default=True),
        sa.Column("created_at", sa.DateTime(timezone=True)),
        sa.Column("updated_at", sa.DateTime(timezone=True)),
    )
    op.create_table(
        "marketing_survey_responses",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("survey_id", UUID(as_uuid=True), sa.ForeignKey("marketing_surveys.id", ondelete="CASCADE"), nullable=False),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("customer_id", UUID(as_uuid=True), nullable=False),
        sa.Column("campaign_id", UUID(as_uuid=True)),
        sa.Column("respuestas", JSONB(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True)),
    )


def downgrade() -> None:
    op.drop_table("marketing_survey_responses")
    op.drop_table("marketing_surveys")
    op.drop_table("marketing_customer_offers")
    op.drop_table("marketing_stock_alerts")
    op.drop_table("marketing_campaign_recipients")
    op.drop_table("marketing_campaigns")
    op.drop_table("marketing_segments")
