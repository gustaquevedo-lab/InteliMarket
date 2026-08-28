"""Add cupones sorteo, clientes fidelizacion and ticket items tables

Revision ID: 20260827120000
Revises: 20260826150000
Create Date: 2026-08-27 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '20260827120000'
down_revision = '20260826150000'
branch_labels = None
depends_on = None


def upgrade():
    # 1. Tabla cupones_clientes
    op.create_table(
        'cupones_clientes',
        sa.Column('id', postgresql.UUID(as_uuid=True), server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('company_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('documento', sa.String(length=30), nullable=False),
        sa.Column('nombre', sa.String(length=255), nullable=False),
        sa.Column('telefono', sa.String(length=50), nullable=True),
        sa.Column('direccion', sa.Text(), nullable=True),
        sa.Column('barrio', sa.String(length=100), nullable=True),
        sa.Column('ciudad', sa.String(length=100), server_default='Pedro Juan Caballero', nullable=False),
        sa.Column('ticket_promedio', sa.Numeric(precision=15, scale=2), server_default='0', nullable=False),
        sa.Column('total_gastado', sa.Numeric(precision=15, scale=2), server_default='0', nullable=False),
        sa.Column('cantidad_compras', sa.Integer(), server_default='0', nullable=False),
        sa.Column('ultimo_consumo', sa.DateTime(timezone=True), nullable=True),
        sa.Column('segmentos', sa.Text(), nullable=True),
        sa.Column('ia_analisis', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('activo', sa.Boolean(), server_default='true', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('company_id', 'documento', name='uq_cupones_clientes_company_doc')
    )
    op.create_index('ix_cupones_clientes_company_id', 'cupones_clientes', ['company_id'])
    op.create_index('ix_cupones_clientes_documento', 'cupones_clientes', ['documento'])
    op.create_index('ix_cupones_clientes_telefono', 'cupones_clientes', ['telefono'])
    op.create_index('ix_cupones_clientes_barrio', 'cupones_clientes', ['barrio'])

    # 2. Tabla cupon_tickets
    op.create_table(
        'cupon_tickets',
        sa.Column('id', postgresql.UUID(as_uuid=True), server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('company_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('cliente_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('sale_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('nro_ticket', sa.String(length=100), nullable=False),
        sa.Column('cantidad', sa.Integer(), server_default='1', nullable=False),
        sa.Column('monto_compra', sa.Numeric(precision=15, scale=2), server_default='0', nullable=False),
        sa.Column('fecha_compra', sa.DateTime(timezone=True), nullable=True),
        sa.Column('fecha_captura', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('usuario_nombre', sa.String(length=150), nullable=True),
        sa.Column('sincronizado', sa.Boolean(), server_default='false', nullable=False),
        sa.Column('whatsapp_enviado', sa.Boolean(), server_default='false', nullable=False),
        sa.Column('whatsapp_status', sa.String(length=50), server_default='pendiente', nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['cliente_id'], ['cupones_clientes.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_cupon_tickets_company_id', 'cupon_tickets', ['company_id'])
    op.create_index('ix_cupon_tickets_cliente_id', 'cupon_tickets', ['cliente_id'])
    op.create_index('ix_cupon_tickets_nro_ticket', 'cupon_tickets', ['nro_ticket'])
    op.create_index('ix_cupon_tickets_fecha_captura', 'cupon_tickets', ['fecha_captura'])

    # 3. Tabla cupon_ticket_items
    op.create_table(
        'cupon_ticket_items',
        sa.Column('id', postgresql.UUID(as_uuid=True), server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('ticket_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('producto_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('descripcion', sa.String(length=300), nullable=False),
        sa.Column('cantidad', sa.Numeric(precision=12, scale=3), server_default='1', nullable=False),
        sa.Column('precio_unitario', sa.Numeric(precision=15, scale=2), server_default='0', nullable=False),
        sa.Column('total', sa.Numeric(precision=15, scale=2), server_default='0', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['ticket_id'], ['cupon_tickets.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_cupon_ticket_items_ticket_id', 'cupon_ticket_items', ['ticket_id'])


def downgrade():
    op.drop_table('cupon_ticket_items')
    op.drop_table('cupon_tickets')
    op.drop_table('cupones_clientes')
