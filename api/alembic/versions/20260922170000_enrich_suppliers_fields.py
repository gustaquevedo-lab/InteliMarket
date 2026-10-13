"""enrich suppliers fields: tipo_provision, rubro, pais, limite_credito, banco, retenciones

Revision ID: 20260922170000
Revises: 20260922140000
Create Date: 2026-09-22 17:00:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = "20260922170000"
down_revision: Union[str, None] = "20260922140000"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Columnas enriquecidas para gestión profesional de proveedores en retail y supermercado
    conn = op.get_bind()
    
    # 1. tipo_provision (bienes vs servicios vs mixto)
    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name='suppliers' AND column_name='tipo_provision'
            ) THEN
                ALTER TABLE suppliers ADD COLUMN tipo_provision VARCHAR(30) DEFAULT 'bienes';
            END IF;
        END $$;
    """)

    # 2. rubro
    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name='suppliers' AND column_name='rubro'
            ) THEN
                ALTER TABLE suppliers ADD COLUMN rubro VARCHAR(100);
            END IF;
        END $$;
    """)

    # 3. pais
    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name='suppliers' AND column_name='pais'
            ) THEN
                ALTER TABLE suppliers ADD COLUMN pais VARCHAR(50) DEFAULT 'Paraguay';
            END IF;
        END $$;
    """)

    # 4. limite_credito
    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name='suppliers' AND column_name='limite_credito'
            ) THEN
                ALTER TABLE suppliers ADD COLUMN limite_credito NUMERIC(14, 2) DEFAULT 0;
            END IF;
        END $$;
    """)

    # 5. dia_visita
    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name='suppliers' AND column_name='dia_visita'
            ) THEN
                ALTER TABLE suppliers ADD COLUMN dia_visita VARCHAR(50);
            END IF;
        END $$;
    """)

    # 6. frecuencia_entrega
    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name='suppliers' AND column_name='frecuencia_entrega'
            ) THEN
                ALTER TABLE suppliers ADD COLUMN frecuencia_entrega VARCHAR(50);
            END IF;
        END $$;
    """)

    # 7. titular_cuenta_bancaria
    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name='suppliers' AND column_name='titular_cuenta_bancaria'
            ) THEN
                ALTER TABLE suppliers ADD COLUMN titular_cuenta_bancaria VARCHAR(200);
            END IF;
        END $$;
    """)

    # 8. tipo_cuenta_bancaria
    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name='suppliers' AND column_name='tipo_cuenta_bancaria'
            ) THEN
                ALTER TABLE suppliers ADD COLUMN tipo_cuenta_bancaria VARCHAR(50);
            END IF;
        END $$;
    """)

    # 9. identificacion_bancaria
    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name='suppliers' AND column_name='identificacion_bancaria'
            ) THEN
                ALTER TABLE suppliers ADD COLUMN identificacion_bancaria VARCHAR(50);
            END IF;
        END $$;
    """)

    # 10. porcentaje_retencion_iva
    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name='suppliers' AND column_name='porcentaje_retencion_iva'
            ) THEN
                ALTER TABLE suppliers ADD COLUMN porcentaje_retencion_iva INTEGER DEFAULT 30;
            END IF;
        END $$;
    """)

    # 11. agente_retencion
    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name='suppliers' AND column_name='agente_retencion'
            ) THEN
                ALTER TABLE suppliers ADD COLUMN agente_retencion BOOLEAN DEFAULT false;
            END IF;
        END $$;
    """)


def downgrade() -> None:
    pass
