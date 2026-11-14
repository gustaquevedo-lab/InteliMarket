"""sync internal_requisitions and supermer_equipment columns

Revision ID: 20261114130000
Revises: 20261114110000
Create Date: 2026-11-14 13:00:00.000000
"""
from typing import Sequence, Union
from alembic import op

revision: str = '20261114130000'
down_revision: Union[str, None] = '20261114110000'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
        DO $$
        BEGIN
            -- 1. internal_requisitions columns
            IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'internal_requisitions') THEN
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'internal_requisitions' AND column_name = 'solicitado_por') THEN
                    ALTER TABLE internal_requisitions ADD COLUMN solicitado_por VARCHAR(150);
                    UPDATE internal_requisitions SET solicitado_por = solicitante_nombre WHERE solicitado_por IS NULL AND solicitante_nombre IS NOT NULL;
                    UPDATE internal_requisitions SET solicitado_por = 'OPERADOR' WHERE solicitado_por IS NULL;
                    ALTER TABLE internal_requisitions ALTER COLUMN solicitado_por SET NOT NULL;
                END IF;

                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'internal_requisitions' AND column_name = 'observaciones') THEN
                    ALTER TABLE internal_requisitions ADD COLUMN observaciones TEXT;
                END IF;

                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'internal_requisitions' AND column_name = 'numero_factura') THEN
                    ALTER TABLE internal_requisitions ADD COLUMN numero_factura VARCHAR(50);
                END IF;

                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'internal_requisitions' AND column_name = 'aprobado_at') THEN
                    ALTER TABLE internal_requisitions ADD COLUMN aprobado_at TIMESTAMP WITH TIME ZONE;
                END IF;
            END IF;

            -- 2. supermer_equipment prioridad column check
            IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'supermer_equipment') THEN
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'supermer_equipment' AND column_name = 'prioridad') THEN
                    ALTER TABLE supermer_equipment ADD COLUMN prioridad VARCHAR(10) DEFAULT 'media';
                END IF;
            END IF;
        END $$;
    """)


def downgrade() -> None:
    pass
