"""add_balanza_notify_triggers

Revision ID: 20261012120000
Revises: 20261012100000
Create Date: 2026-10-12 12:00:00.000000

Triggers que avisan (pg_notify) al vigilante de precios de balanza (api/src/integrations/scales/watcher.py)
cuando cambia algo que puede alterar el precio mostrado en una balanza:
  - products: INSERT, o UPDATE de precio_venta / nombre / plu_balanza / activo en un producto con PLU
  - promotions: INSERT/DELETE, o UPDATE de cualquier columna salvo los contadores de uso
    (updated_at, usos_actuales y unidades_vendidas_promo -- esta ultima solo cuenta si la promo limita unidades,
    porque al agotarse el cupo la promo deja de aplicar)
No cambian ningun dato; solo emiten NOTIFY (se entrega al commit). Solo esquema public (el sandbox no transmite a balanzas).
"""
from typing import Sequence, Union
from alembic import op

revision: str = '20261012120000'
down_revision: Union[str, None] = '20261012100000'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
        CREATE OR REPLACE FUNCTION public.notify_balanza_precio() RETURNS trigger AS $fn$
        BEGIN
            IF NEW.plu_balanza IS NOT NULL OR (TG_OP = 'UPDATE' AND OLD.plu_balanza IS NOT NULL) THEN
                IF TG_OP = 'INSERT'
                   OR OLD.precio_venta IS DISTINCT FROM NEW.precio_venta
                   OR OLD.nombre IS DISTINCT FROM NEW.nombre
                   OR OLD.plu_balanza IS DISTINCT FROM NEW.plu_balanza
                   OR OLD.activo IS DISTINCT FROM NEW.activo THEN
                    PERFORM pg_notify('balanza_precio', NEW.id::text);
                END IF;
            END IF;
            RETURN NEW;
        END
        $fn$ LANGUAGE plpgsql
    """)
    op.execute("DROP TRIGGER IF EXISTS trg_notify_balanza_precio ON public.products")
    op.execute("""
        CREATE TRIGGER trg_notify_balanza_precio
        AFTER INSERT OR UPDATE ON public.products
        FOR EACH ROW EXECUTE FUNCTION public.notify_balanza_precio()
    """)

    op.execute("""
        CREATE OR REPLACE FUNCTION public.notify_balanza_promo() RETURNS trigger AS $fn$
        DECLARE
            cambio boolean;
        BEGIN
            IF TG_OP = 'INSERT' THEN
                cambio := true;
            ELSIF TG_OP = 'DELETE' THEN
                cambio := true;
            ELSE
                cambio := (to_jsonb(NEW) - ARRAY['updated_at', 'usos_actuales', 'unidades_vendidas_promo'])
                          IS DISTINCT FROM
                          (to_jsonb(OLD) - ARRAY['updated_at', 'usos_actuales', 'unidades_vendidas_promo']);
                IF NOT cambio AND COALESCE(NEW.limitar_unidades, false)
                   AND OLD.unidades_vendidas_promo IS DISTINCT FROM NEW.unidades_vendidas_promo THEN
                    cambio := true;
                END IF;
            END IF;
            IF cambio THEN
                PERFORM pg_notify('balanza_promo', COALESCE(NEW.id, OLD.id)::text);
            END IF;
            RETURN COALESCE(NEW, OLD);
        END
        $fn$ LANGUAGE plpgsql
    """)
    op.execute("DROP TRIGGER IF EXISTS trg_notify_balanza_promo ON public.promotions")
    op.execute("""
        CREATE TRIGGER trg_notify_balanza_promo
        AFTER INSERT OR UPDATE OR DELETE ON public.promotions
        FOR EACH ROW EXECUTE FUNCTION public.notify_balanza_promo()
    """)


def downgrade() -> None:
    op.execute("DROP TRIGGER IF EXISTS trg_notify_balanza_promo ON public.promotions")
    op.execute("DROP TRIGGER IF EXISTS trg_notify_balanza_precio ON public.products")
    op.execute("DROP FUNCTION IF EXISTS public.notify_balanza_promo()")
    op.execute("DROP FUNCTION IF EXISTS public.notify_balanza_precio()")
