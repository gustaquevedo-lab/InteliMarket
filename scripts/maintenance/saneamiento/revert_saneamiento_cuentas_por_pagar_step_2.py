#!/usr/bin/env python3
"""Reversión de Saneamiento Cuentas por Pagar (Etapa 2).

Restaura desde `public.audit_saneamiento_supplier_invoices_20261017` y `public.audit_saneamiento_pruned_suppliers_20261017`.

Uso:
  python api/revert_saneamiento_cuentas_por_pagar_step_2.py --dry-run
  python api/revert_saneamiento_cuentas_por_pagar_step_2.py --commit
"""

from __future__ import annotations

import argparse
import asyncio
import json
import logging
import os
import sys
import uuid
from decimal import Decimal

import asyncpg

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("revert_saneamiento_step_2")

DB_URL = os.getenv("DATABASE_URL", "postgresql://intelimarket:password@localhost:5432/intelimarket")
if DB_URL.startswith("postgresql+asyncpg://"):
    DB_URL = DB_URL.replace("postgresql+asyncpg://", "postgresql://")


async def run_reversion(commit: bool = False):
    conn = await asyncpg.connect(DB_URL)
    try:
        # Verificar auditoría
        audit_invs = await conn.fetch("SELECT * FROM public.audit_saneamiento_supplier_invoices_20261017 ORDER BY created_at DESC;")
        audit_sups = await conn.fetch("SELECT * FROM public.audit_saneamiento_pruned_suppliers_20261017 ORDER BY pruned_at DESC;")

        logger.info(f"Registros a revertir en facturas/NCs: {len(audit_invs)}")
        logger.info(f"Proveedores a restaurar: {len(audit_sups)}")

        if not audit_invs and not audit_sups:
            logger.info("No hay registros de auditoría para revertir.")
            return

        if not commit:
            logger.info("=== DRY-RUN DE REVERSIÓN COMPLETADO ===")
            return

        async with conn.transaction():
            # 1. Restaurar proveedores huérfanos
            for s in audit_sups:
                await conn.execute("""
                    INSERT INTO public.suppliers (id, company_id, razon_social, ruc, notas, created_at, activo)
                    VALUES ($1, '00000000-0000-0000-0000-000000000010', $2, $3, $4, $5, true)
                    ON CONFLICT (id) DO NOTHING;
                """, s["supplier_id"], s["razon_social"], s["ruc"], s["notas"], s["created_at"])
            logger.info(f"✓ Restaurados {len(audit_sups)} proveedores.")

            # 2. Revertir facturas y NCs
            for a in audit_invs:
                action = a["action"]
                old = json.loads(a["old_data"])

                if action == "reassign_supplier":
                    await conn.execute("""
                        UPDATE public.supplier_invoices
                        SET supplier_id = $1, concepto = $2, updated_at = NOW()
                        WHERE id = $3;
                    """, a["old_supplier_id"], old.get("concepto"), a["invoice_id"])

                elif action == "convert_to_credit_note":
                    # Eliminar la NC de supplier_credit_notes
                    await conn.execute("""
                        DELETE FROM public.supplier_credit_notes
                        WHERE supplier_id = $1 AND numero = $2;
                    """, a["new_supplier_id"], a["numero_factura"])

                    # Recrear la factura original
                    await conn.execute("""
                        INSERT INTO public.supplier_invoices (
                            id, company_id, supplier_id, numero_factura, timbrado, cdc,
                            fecha_emision, fecha_recepcion, fecha_vencimiento, subtotal,
                            descuento, iva_10, iva_5, total, saldo_pendiente, moneda,
                            tipo_cambio, condicion, tipo_comprobante, estado, concepto, notas, created_at
                        ) VALUES (
                            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
                            $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23
                        ) ON CONFLICT (id) DO UPDATE SET supplier_id = EXCLUDED.supplier_id;
                    """, 
                    uuid.UUID(old["id"]), uuid.UUID(old["company_id"]), uuid.UUID(old["supplier_id"]),
                    old["numero_factura"], old["timbrado"], old["cdc"],
                    old["fecha_emision"], old["fecha_recepcion"], old["fecha_vencimiento"],
                    Decimal(str(old.get("subtotal") or 0)), Decimal(str(old.get("descuento") or 0)),
                    Decimal(str(old.get("iva_10") or 0)), Decimal(str(old.get("iva_5") or 0)),
                    Decimal(str(old.get("total") or 0)), Decimal(str(old.get("saldo_pendiente") or 0)),
                    old.get("moneda", "PYG"), Decimal(str(old.get("tipo_cambio") or 1)),
                    old.get("condicion", "credito"), old.get("tipo_comprobante", "factura"),
                    old.get("estado", "pendiente"), old.get("concepto"), old.get("notas"),
                    old.get("created_at")
                    )

            logger.info("✓ Reversión finalizada exitosamente.")

    finally:
        await conn.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--commit", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    asyncio.run(run_reversion(commit=args.commit))
