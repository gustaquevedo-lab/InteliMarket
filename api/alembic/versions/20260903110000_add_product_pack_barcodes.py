"""Add product_pack_barcodes

Revision ID: 20260903110000
Revises: 20260903020000
Create Date: 2026-09-03 11:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '20260903110000'
down_revision = '20260903020000'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'product_pack_barcodes',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('product_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('products.id'), nullable=False),
        sa.Column('company_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('codigo_barra', sa.String(length=50), nullable=False),
        sa.Column('etiqueta', sa.String(length=60), nullable=False),
        sa.Column('unidades_por_paquete', sa.Numeric(10, 3), nullable=False),
        sa.Column('activo', sa.Boolean(), server_default='true'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
    )
    op.create_index('ix_product_pack_barcodes_product_id', 'product_pack_barcodes', ['product_id'])
    op.create_index('ix_product_pack_barcodes_company_id', 'product_pack_barcodes', ['company_id'])
    op.create_index('ix_product_pack_barcodes_codigo_barra', 'product_pack_barcodes', ['codigo_barra'])
    op.create_unique_constraint(
        'uq_pack_barcode_company_codigo', 'product_pack_barcodes', ['company_id', 'codigo_barra']
    )


def downgrade():
    op.drop_table('product_pack_barcodes')
