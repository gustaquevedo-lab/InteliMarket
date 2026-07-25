"""Seed for SIFEN Avanzado - DGR vehicles, e-Kuatia, CDC, IVA book, DGR reports"""
import asyncio
import json
import asyncpg
from datetime import date, datetime, timedelta
from uuid import uuid4
from scripts.seed_data import (
    DB, CID,
    DGR_VEH1, EKU_DOC1, CDC_LOG1, IVA_CFG1, DGR_RPT1,
    SALE001,
)


async def seed():
    conn = await asyncpg.connect(DB)
    try:
        # 1 DGR vehicle — Toyota Hilux 2024
        await conn.execute("""
            INSERT INTO dgr_vehicles (id, company_id, patente, marca, modelo, anio, tipo, activo)
            VALUES ($1, $2, 'ABC-1234', 'Toyota', 'Hilux', 2024, 'camioneta', TRUE)
            ON CONFLICT (id) DO NOTHING
        """, DGR_VEH1, CID)

        # 1 e-Kuatia document — nota de crédito
        md = {"cuit": "80012345-6", "status": "pendiente"}
        await conn.execute("""
            INSERT INTO ekuatia_documents (id, company_id, tipo_documento, nombre_original, validez_legal, metadata)
            VALUES ($1, $2, 'nota_credito_electronica', 'Nota_Credito_80012345-6.pdf', FALSE, $3)
            ON CONFLICT (id) DO NOTHING
        """, EKU_DOC1, CID, json.dumps(md))

        # 1 CDC validation log
        await conn.execute("""
            INSERT INTO cdc_validation_logs (id, company_id, sale_id, cdc, valido, response_data)
            VALUES ($1, $2, $3, '001-001-0000100-20260601-123456', TRUE, $4)
            ON CONFLICT (id) DO NOTHING
        """, CDC_LOG1, CID, SALE001, json.dumps({"validation_detail": "OK"}))

        # 1 IVA book config — mensual, general
        await conn.execute("""
            INSERT INTO iva_book_configs (id, company_id, regimen, periodicidad)
            VALUES ($1, $2, 'general', 'mensual')
            ON CONFLICT (id) DO NOTHING
        """, IVA_CFG1, CID)

        # 1 DGR report — periodo 2026-05, generado
        await conn.execute("""
            INSERT INTO dgr_report_generated (id, company_id, periodo, tipo, cantidad_vehiculos, monto_total_impuesto)
            VALUES ($1, $2, '2026-05', 'generado', 5, 12500000)
            ON CONFLICT (id) DO NOTHING
        """, DGR_RPT1, CID)

        print("✅ SIFEN Avanzado seeded")
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(seed())
