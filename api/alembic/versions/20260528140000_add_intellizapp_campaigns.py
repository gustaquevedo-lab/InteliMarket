"""add intellizapp campaigns

Revision ID: 20260528140000
Revises: 20260526000000_add_dist_supplier_agreements_and_fields.py
Create Date: 2026-05-28 14:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "20260528140000"
down_revision: str | None = "20260526000000"
branch_labels: str | None = None
depends_on: str | None = None


def upgrade() -> None:
    op.create_table(
        "whatsapp_campaigns",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.func.gen_random_uuid()),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("description", sa.Text()),
        sa.Column("tipo", sa.String(30), nullable=False, server_default="promotion"),
        sa.Column("segment_filters", postgresql.JSONB()),
        sa.Column("template_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("message_template", sa.Text()),
        sa.Column("scheduled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("sent_at", sa.DateTime(timezone=True)),
        sa.Column("completed_at", sa.DateTime(timezone=True)),
        sa.Column("status", sa.String(20), nullable=False, server_default="draft", index=True),
        sa.Column("total_recipients", sa.Integer(), server_default="0"),
        sa.Column("sent_count", sa.Integer(), server_default="0"),
        sa.Column("delivered_count", sa.Integer(), server_default="0"),
        sa.Column("read_count", sa.Integer(), server_default="0"),
        sa.Column("replied_count", sa.Integer(), server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["tenant_id"], ["public.tenants.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["template_id"], ["public.whatsapp_templates.id"], ondelete="SET NULL"),
        schema="public",
    )
    op.create_index("ix_whatsapp_campaigns_tenant_status", "whatsapp_campaigns", ["tenant_id", "status"], schema="public")
    op.create_index("ix_whatsapp_campaigns_scheduled", "whatsapp_campaigns", ["scheduled_at"], schema="public")

    op.create_table(
        "whatsapp_campaign_recipients",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.func.gen_random_uuid()),
        sa.Column("campaign_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("customer_id", postgresql.UUID(as_uuid=True), nullable=True, index=True),
        sa.Column("contact_phone", sa.String(30), nullable=False),
        sa.Column("contact_name", sa.String(200)),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending", index=True),
        sa.Column("error_message", sa.Text()),
        sa.Column("sent_at", sa.DateTime(timezone=True)),
        sa.Column("delivered_at", sa.DateTime(timezone=True)),
        sa.Column("read_at", sa.DateTime(timezone=True)),
        sa.Column("replied_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["campaign_id"], ["public.whatsapp_campaigns.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["tenant_id"], ["public.tenants.id"], ondelete="CASCADE"),
        schema="public",
    )
    op.create_index("ix_wa_campaign_recipients_campaign_status", "whatsapp_campaign_recipients", ["campaign_id", "status"], schema="public")
    op.create_index("ix_wa_campaign_recipients_phone", "whatsapp_campaign_recipients", ["contact_phone"], schema="public")

    op.create_table(
        "whatsapp_automation_rules",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.func.gen_random_uuid()),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("trigger_event", sa.String(30), nullable=False, index=True),
        sa.Column("conditions", postgresql.JSONB()),
        sa.Column("template_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("message_template", sa.Text()),
        sa.Column("delay_minutes", sa.Integer(), server_default="0"),
        sa.Column("active", sa.Boolean(), server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["tenant_id"], ["public.tenants.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["template_id"], ["public.whatsapp_templates.id"], ondelete="SET NULL"),
        schema="public",
    )
    op.create_index("ix_wa_automation_rules_tenant_event", "whatsapp_automation_rules", ["tenant_id", "trigger_event"], schema="public")


def downgrade() -> None:
    op.drop_table("whatsapp_automation_rules", schema="public")
    op.drop_table("whatsapp_campaign_recipients", schema="public")
    op.drop_table("whatsapp_campaigns", schema="public")
