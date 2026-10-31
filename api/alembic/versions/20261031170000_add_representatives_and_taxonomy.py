"""Add representatives, brands, sections, and taxonomy fields

Revision ID: 20261031170000
Revises: 20261028100000
Create Date: 2026-10-31 17:00:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = '20261031170000'
down_revision: Union[str, None] = '20261028100000'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Crear tabla representatives
    op.create_table(
        'representatives',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('company_id', postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column('nombre', sa.String(length=150), nullable=False),
        sa.Column('contacto', sa.String(length=200), nullable=True),
        sa.Column('telefono', sa.String(length=50), nullable=True),
        sa.Column('activo', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
    )

    # 2. Crear tabla supplier_representatives
    op.create_table(
        'supplier_representatives',
        sa.Column('supplier_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('suppliers.id', ondelete='CASCADE'), nullable=False),
        sa.Column('representative_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('representatives.id', ondelete='CASCADE'), nullable=False),
        sa.Column('es_principal', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.PrimaryKeyConstraint('supplier_id', 'representative_id', name='pk_supplier_representatives'),
    )
    op.create_index('ix_supplier_representatives_representative_id', 'supplier_representatives', ['representative_id'])

    # 3. Crear tabla product_sections
    op.create_table(
        'product_sections',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('company_id', postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column('nombre', sa.String(length=100), nullable=False),
        sa.Column('orden', sa.Integer(), nullable=False, server_default=sa.text('0')),
        sa.Column('activo', sa.Boolean(), nullable=False, server_default=sa.text('true')),
    )

    # 4. Crear tabla product_brands
    op.create_table(
        'product_brands',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('company_id', postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column('nombre', sa.String(length=120), nullable=False),
        sa.Column('representative_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('representatives.id', ondelete='SET NULL'), nullable=True),
        sa.Column('activo', sa.Boolean(), nullable=False, server_default=sa.text('true')),
    )
    op.create_index('ix_product_brands_representative_id', 'product_brands', ['representative_id'])

    # 5. Agregar section_id en product_categories
    op.add_column(
        'product_categories',
        sa.Column('section_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('product_sections.id', ondelete='SET NULL'), nullable=True),
    )
    op.create_index('ix_product_categories_section_id', 'product_categories', ['section_id'])

    # 6. Agregar representative_id, brand_id, tipo_variante en products
    op.add_column(
        'products',
        sa.Column('representative_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('representatives.id', ondelete='SET NULL'), nullable=True),
    )
    op.create_index('ix_products_representative_id', 'products', ['representative_id'])

    op.add_column(
        'products',
        sa.Column('brand_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('product_brands.id', ondelete='SET NULL'), nullable=True),
    )
    op.create_index('ix_products_brand_id', 'products', ['brand_id'])

    op.add_column(
        'products',
        sa.Column('tipo_variante', sa.String(length=100), nullable=True),
    )

    # 7. Sembrar datos iniciales
    company_id = '00000000-0000-0000-0000-000000000010'

    secciones = [
        "Bebidas",
        "Almacén / Despensa",
        "Lácteos y Quesería",
        "Carnicería",
        "Verdulería y Frutería",
        "Panadería y Confitería",
        "Limpieza y Lavandería",
        "Perfumería y Cuidado Personal",
        "Bazar y Hogar",
        "Mascotas",
    ]
    for orden, nombre in enumerate(secciones, start=1):
        escaped_nombre = nombre.replace("'", "''")
        op.execute(
            f"""
            INSERT INTO product_sections (company_id, nombre, orden, activo)
            SELECT '{company_id}'::uuid, '{escaped_nombre}', {orden}, true
            WHERE NOT EXISTS (
                SELECT 1 FROM product_sections 
                WHERE company_id = '{company_id}'::uuid AND nombre = '{escaped_nombre}'
            );
            """
        )

    representantes = [
        "PARESA",
        "CERVEPAR",
        "UNILEVER",
        "BEBIDAS DEL PARAGUAY",
        "VIERCI",
        "CHORTITZER (TREBOL)",
        "LACTOLANDA",
        "TROVATO",
        "IRIS",
        "REAL SUL",
    ]
    for nombre in representantes:
        escaped_nombre = nombre.replace("'", "''")
        op.execute(
            f"""
            INSERT INTO representatives (company_id, nombre, activo)
            SELECT '{company_id}'::uuid, '{escaped_nombre}', true
            WHERE NOT EXISTS (
                SELECT 1 FROM representatives 
                WHERE company_id = '{company_id}'::uuid AND nombre = '{escaped_nombre}'
            );
            """
        )


def downgrade() -> None:
    # 1. Revertir columnas de products
    op.drop_column('products', 'tipo_variante')
    op.drop_index('ix_products_brand_id', table_name='products')
    op.drop_column('products', 'brand_id')
    op.drop_index('ix_products_representative_id', table_name='products')
    op.drop_column('products', 'representative_id')

    # 2. Revertir columna de product_categories
    op.drop_index('ix_product_categories_section_id', table_name='product_categories')
    op.drop_column('product_categories', 'section_id')

    # 3. Eliminar tablas creadas
    op.drop_index('ix_product_brands_representative_id', table_name='product_brands')
    op.drop_table('product_brands')

    op.drop_table('product_sections')

    op.drop_index('ix_supplier_representatives_representative_id', table_name='supplier_representatives')
    op.drop_table('supplier_representatives')

    op.drop_table('representatives')
