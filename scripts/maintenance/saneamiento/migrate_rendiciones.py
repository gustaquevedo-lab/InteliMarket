"""Migración para Fondos Fijos, Rendición de Cuentas y Soporte Fiscal/Activos Fijos"""
import asyncio
import os
import asyncpg


MIGRATION_SQL = """
-- 1. Tabla petty_cash_rendiciones en public
CREATE TABLE IF NOT EXISTS public.petty_cash_rendiciones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL,
    fund_id UUID NOT NULL REFERENCES public.petty_cash_funds(id),
    numero_rendicion VARCHAR(50) NOT NULL,
    custodio_id UUID NOT NULL,
    custodio_nombre VARCHAR(100) NOT NULL,
    auditado_por_id UUID,
    auditado_por_nombre VARCHAR(100),
    estado VARCHAR(30) NOT NULL DEFAULT 'borrador',
    monto_fondo_autorizado NUMERIC(15, 0) NOT NULL,
    efectivo_remanente_contado NUMERIC(15, 0) NOT NULL DEFAULT 0,
    total_comprobantes_presentados NUMERIC(15, 0) NOT NULL DEFAULT 0,
    total_comprobantes_aprobados NUMERIC(15, 0) NOT NULL DEFAULT 0,
    total_comprobantes_rechazados NUMERIC(15, 0) NOT NULL DEFAULT 0,
    diferencia_arqueo NUMERIC(15, 0) NOT NULL DEFAULT 0,
    total_gravado_10 NUMERIC(15, 0) DEFAULT 0,
    total_gravado_5 NUMERIC(15, 0) DEFAULT 0,
    total_exentas NUMERIC(15, 0) DEFAULT 0,
    total_iva_10 NUMERIC(15, 0) DEFAULT 0,
    total_iva_5 NUMERIC(15, 0) DEFAULT 0,
    total_inversion_activos NUMERIC(15, 0) DEFAULT 0,
    total_gasto_operativo NUMERIC(15, 0) DEFAULT 0,
    monto_repuesto NUMERIC(15, 0) DEFAULT 0,
    medio_reposicion VARCHAR(30),
    caja_boveda_id UUID,
    cash_movement_id UUID,
    bank_account_id UUID,
    bank_transaction_id UUID,
    comprobante_pago_ref VARCHAR(100),
    asiento_contable_id UUID,
    fecha_presentacion TIMESTAMPTZ,
    fecha_aprobacion TIMESTAMPTZ,
    fecha_pago TIMESTAMPTZ,
    observaciones_custodio TEXT,
    observaciones_tesoreria TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_petty_cash_rendiciones_company_id ON public.petty_cash_rendiciones(company_id);
CREATE INDEX IF NOT EXISTS ix_petty_cash_rendiciones_fund_id ON public.petty_cash_rendiciones(fund_id);
CREATE INDEX IF NOT EXISTS ix_petty_cash_rendiciones_numero ON public.petty_cash_rendiciones(numero_rendicion);
CREATE INDEX IF NOT EXISTS ix_petty_cash_rendiciones_estado ON public.petty_cash_rendiciones(estado);

-- 2. Campos en petty_cash_funds
ALTER TABLE public.petty_cash_funds
    ADD COLUMN IF NOT EXISTS cost_center_id UUID REFERENCES public.cost_centers(id),
    ADD COLUMN IF NOT EXISTS monto_maximo_por_gasto NUMERIC(15, 0) DEFAULT 500000;

-- 3. Campos en expenses
ALTER TABLE public.expenses
    ADD COLUMN IF NOT EXISTS rendicion_id UUID REFERENCES public.petty_cash_rendiciones(id),
    ADD COLUMN IF NOT EXISTS ruc VARCHAR(20),
    ADD COLUMN IF NOT EXISTS timbrado VARCHAR(20),
    ADD COLUMN IF NOT EXISTS numero_factura VARCHAR(50),
    ADD COLUMN IF NOT EXISTS tipo_comprobante VARCHAR(30) DEFAULT 'FACTURA_CONTADO',
    ADD COLUMN IF NOT EXISTS gravado_10 NUMERIC(15, 0) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS gravado_5 NUMERIC(15, 0) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS exentas NUMERIC(15, 0) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS iva_10 NUMERIC(15, 0) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS iva_5 NUMERIC(15, 0) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS es_inversion BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS fixed_asset_id UUID REFERENCES public.fixed_assets(id),
    ADD COLUMN IF NOT EXISTS vida_util_meses INTEGER,
    ADD COLUMN IF NOT EXISTS categoria_activo VARCHAR(100),
    ADD COLUMN IF NOT EXISTS auditoria_estado VARCHAR(20) DEFAULT 'pendiente',
    ADD COLUMN IF NOT EXISTS auditoria_motivo TEXT;

CREATE INDEX IF NOT EXISTS ix_expenses_rendicion_id ON public.expenses(rendicion_id);
CREATE INDEX IF NOT EXISTS ix_expenses_ruc ON public.expenses(ruc);
CREATE INDEX IF NOT EXISTS ix_expenses_numero_factura ON public.expenses(numero_factura);

-- 4. Índice antifraude único para evitar facturas duplicadas
CREATE UNIQUE INDEX IF NOT EXISTS uq_expense_factura_fiscal 
ON public.expenses (company_id, ruc, timbrado, numero_factura) 
WHERE anulado = FALSE AND ruc IS NOT NULL AND numero_factura IS NOT NULL;
"""


async def main():
    db_url = os.getenv("DATABASE_URL", "postgresql://intelimarket:password@localhost:5432/intelimarket")
    # Limpiar prefijo asyncpg si viene de sqlalchemy
    raw_url = db_url.replace("postgresql+asyncpg://", "postgresql://")
    conn = await asyncpg.connect(raw_url)
    print("Conectado a PostgreSQL...")
    await conn.execute(MIGRATION_SQL)
    print("Migración de Rendiciones de Fondo Fijo aplicada con éxito.")
    await conn.close()


if __name__ == "__main__":
    asyncio.run(main())
