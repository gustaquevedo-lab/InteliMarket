"""Seed for Integrated Finance - withholding, accounting, collections, scores"""
import asyncio
import asyncpg
from datetime import date, datetime, timedelta
from uuid import uuid4
from scripts.seed_data import (
    DB, CID,
    IF_WH1, IF_PLAN1, IF_PER1, IF_ENT1, IF_COLL1,
    CUST01, CUST03, CUST05,
    P001,
    SUPP01,
    SALE001,
    USER_OP1, USER_SA,
)


async def seed():
    conn = await asyncpg.connect(DB)
    try:
        # Helper: upsert account plan by codigo and return its actual ID
        async def _ensure_account(codigo, nombre, tipo, nivel):
            row = await conn.fetchrow(
                "SELECT id FROM account_plans WHERE company_id=$1 AND codigo=$2", CID, codigo)
            if row:
                return row['id']
            new_id = uuid4()
            await conn.execute("""
                INSERT INTO account_plans (id, company_id, codigo, nombre, tipo, nivel, acepta_asientos, activo)
                VALUES ($1, $2, $3, $4, $5, $6, TRUE, TRUE)
            """, new_id, CID, codigo, nombre, tipo, nivel)
            return new_id

        IF_PLAN1 = await _ensure_account("1.01.01", "Caja", "activo", 3)
        ap_pasivo = await _ensure_account("2.01.01", "Proveedores", "pasivo", 3)
        ap_ingreso = await _ensure_account("4.01.01", "Ventas", "ingreso", 3)

        # 1 withholding config — renta 10%
        await conn.execute("""
            INSERT INTO withholding_configs (id, company_id, supplier_id, tipo, activo, tasa, regimen)
            VALUES ($1, $2, $3, 'renta', TRUE, 10.00, 'general')
            ON CONFLICT (company_id, supplier_id, tipo) DO NOTHING
        """, IF_WH1, CID, SUPP01)

        # 1 withholding document — supplier SUPP01
        wh_doc_id = uuid4()
        await conn.execute("""
            INSERT INTO withholding_documents (id, company_id, supplier_id, invoice_id, tipo, numero_documento, periodo_fiscal, base_imponible, tasa, monto_retenido, moneda, estado)
            VALUES ($1, $2, $3, $4, 'renta', 'RET-2026-001', '2026-06', 10000000, 10.00, 1000000, 'PYG', 'emitido')
            ON CONFLICT (company_id, numero_documento) DO NOTHING
        """, wh_doc_id, CID, SUPP01, uuid4())

        # 1 accounting period — June 2026
        await conn.execute("""
            INSERT INTO accounting_periods (id, company_id, anio, mes, fecha_inicio, fecha_fin, estado)
            VALUES ($1, $2, 2026, 6, '2026-06-01', '2026-06-30', 'abierto')
            ON CONFLICT (id) DO NOTHING
        """, IF_PER1, CID)

        # 3 accounting entries (debe + haber) referencing SALE001
        await conn.execute("""
            INSERT INTO accounting_entries (id, company_id, period_id, account_id, fecha, tipo, monto, concepto, referencia_tipo, referencia_id, asiento_numero, created_by)
            VALUES ($1, $2, $3, $4, '2026-06-01', 'debe', 45000, 'Venta contado SALE001', 'sale', $5, 'AS-2026-0001', $6)
            ON CONFLICT (id) DO NOTHING
        """, IF_ENT1, CID, IF_PER1, IF_PLAN1, SALE001, USER_SA)
        await conn.execute("""
            INSERT INTO accounting_entries (id, company_id, period_id, account_id, fecha, tipo, monto, concepto, referencia_tipo, referencia_id, asiento_numero, created_by)
            VALUES ($1, $2, $3, $4, '2026-06-01', 'haber', 40909, 'Venta contado SALE001 base', 'sale', $5, 'AS-2026-0001', $6)
            ON CONFLICT (id) DO NOTHING
        """, uuid4(), CID, IF_PER1, ap_ingreso, SALE001, USER_SA)
        await conn.execute("""
            INSERT INTO accounting_entries (id, company_id, period_id, account_id, fecha, tipo, monto, concepto, referencia_tipo, referencia_id, asiento_numero, created_by)
            VALUES ($1, $2, $3, $4, '2026-06-01', 'haber', 4091, 'IVA venta SALE001', 'sale', $5, 'AS-2026-0001', $6)
            ON CONFLICT (id) DO NOTHING
        """, uuid4(), CID, IF_PER1, IF_PLAN1, SALE001, USER_SA)

        # 1 collection action — customer CUST03, llamada sin_respuesta
        await conn.execute("""
            INSERT INTO collection_actions (id, company_id, customer_id, tipo, fecha, resultado, created_by)
            VALUES ($1, $2, $3, 'llamada', '2026-06-01', 'sin_respuesta', $4)
            ON CONFLICT (id) DO NOTHING
        """, IF_COLL1, CID, CUST03, USER_OP1)

        # 1 customer score — CUST01, 85, bajo_riesgo
        cs_id = uuid4()
        await conn.execute("""
            INSERT INTO customer_scores (id, company_id, customer_id, score, pago_puntual, antiguedad_dias, total_compras, total_pagos)
            VALUES ($1, $2, $3, 85, 98.5, 365, 15000000, 14800000)
            ON CONFLICT (company_id, customer_id) DO NOTHING
        """, cs_id, CID, CUST01)

        print("✅ Integrated Finance seeded")
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(seed())
