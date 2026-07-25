"""Add Supplier Portal tables (supplier_portal_users, supplier_portal_documents)

Revision ID: 20260531160000
Revises: 20260531140000
Create Date: 2026-05-31 16:00:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision: str = "20260531160000"
down_revision: Union[str, None] = "20260531140000"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "supplier_portal_users",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("supplier_id", UUID(as_uuid=True), sa.ForeignKey("suppliers.id", ondelete="CASCADE"), nullable=False),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("nombre", sa.String(200), nullable=False),
        sa.Column("telefono", sa.String(50)),
        sa.Column("cargo", sa.String(100)),
        sa.Column("activo", sa.Boolean(), default=True),
        sa.Column("last_login", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True)),
        sa.Column("updated_at", sa.DateTime(timezone=True)),
        sa.UniqueConstraint("email", "company_id", name="uq_supplier_user_email_company"),
    )
    op.create_table(
        "supplier_portal_documents",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("supplier_user_id", UUID(as_uuid=True), sa.ForeignKey("supplier_portal_users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("supplier_id", UUID(as_uuid=True), nullable=False),
        sa.Column("company_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("tipo", sa.String(30), nullable=False),
        sa.Column("nombre", sa.String(200), nullable=False),
        sa.Column("descripcion", sa.Text()),
        sa.Column("filename", sa.String(255), nullable=False),
        sa.Column("file_url", sa.String(500), nullable=False),
        sa.Column("file_size", sa.Integer()),
        sa.Column("purchase_order_id", UUID(as_uuid=True)),
        sa.Column("estado", sa.String(20), default="pendiente"),
        sa.Column("rechazado_motivo", sa.Text()),
        sa.Column("created_at", sa.DateTime(timezone=True)),
        sa.Column("updated_at", sa.DateTime(timezone=True)),
    )


def downgrade() -> None:
    op.drop_table("supplier_portal_documents")
    op.drop_table("supplier_portal_users")
