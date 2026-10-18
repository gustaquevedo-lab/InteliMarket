#!/usr/bin/env python3
"""Saneamiento Cuentas por Pagar (Etapa 2) - Reasignación de Proveedores Desconocidos y Normalización de Notas de Crédito SIFEN.

Diagnóstico:
- 97 documentos ingresados vía IMAP quedaron asignados a registros huérfanos de 'Proveedor Desconocido'.
- Entre ellos hay 49 Notas de Crédito (tipo 05) que fueron registradas erróneamente como facturas por pagar.
- 47 facturas legítimas (tipo 01) cuyos proveedores ya existen en el sistema.
- 1 nota de remisión (tipo 07) que no genera deuda.
- 284 proveedores huérfanos 'Proveedor Desconocido' con RUC 'N/A'.

Uso:
  python api/saneamiento_cuentas_por_pagar_step_2.py --dry-run
  python api/saneamiento_cuentas_por_pagar_step_2.py --commit
"""

from __future__ import annotations

import argparse
import asyncio
import json
import logging
import os
import sys
import uuid
from datetime import datetime, timezone
from decimal import Decimal
from pathlib import Path

import asyncpg

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("saneamiento_step_2")

COMPANY_ID = uuid.UUID("00000000-0000-0000-0000-000000000010")
DB_URL = os.getenv("DATABASE_URL", "postgresql://intelimarket:password@localhost:5432/intelimarket")
# Asegurar driver asyncpg plano si viene con postgresql+asyncpg
if DB_URL.startswith("postgresql+asyncpg://"):
    DB_URL = DB_URL.replace("postgresql+asyncpg://", "postgresql://")


async def run_saneamiento(commit: bool = False):
    logger.info("Conectando a PostgreSQL...")
    conn = await asyncpg.connect(DB_URL)

    try:
        # 1. Obtener los 97 documentos de Proveedor Desconocido
        invoices = await conn.fetch("""
            SELECT 
                si.id, si.company_id, si.supplier_id, si.numero_factura, si.timbrado, 
                si.cdc, si.fecha_emision, si.fecha_recepcion, si.fecha_vencimiento,
                si.subtotal, si.descuento, si.iva_10, si.iva_5, si.total, si.saldo_pendiente,
                si.moneda, si.tipo_cambio, si.condicion, si.tipo_comprobante, si.estado,
                si.concepto, si.notas, si.created_at, si.xml_sifen_url
            FROM public.supplier_invoices si
            JOIN public.suppliers s ON s.id = si.supplier_id
            WHERE s.razon_social = 'Proveedor Desconocido'
            ORDER BY si.created_at ASC;
        """)

        logger.info(f"Facturas/Documentos encontrados con 'Proveedor Desconocido': {len(invoices)}")
        if not invoices:
            logger.info("No hay facturas con Proveedor Desconocido. Nada que sanear.")
            return

        # 2. Cargar proveedores reales existentes
        real_suppliers = await conn.fetch("""
            SELECT id, razon_social, ruc, nombre_fantasia
            FROM public.suppliers
            WHERE razon_social != 'Proveedor Desconocido' AND ruc IS NOT NULL AND ruc != 'N/A';
        """)

        sup_map: dict[str, dict] = {}
        for s in real_suppliers:
            raw_ruc = (s["ruc"] or "").strip()
            clean = raw_ruc.replace("-", "").lstrip("0")
            sup_map[clean] = dict(s)
            if "-" in raw_ruc:
                base = raw_ruc.split("-")[0].strip().lstrip("0")
                if base not in sup_map:
                    sup_map[base] = dict(s)
            else:
                sup_map[raw_ruc.lstrip("0")] = dict(s)

        # 3. Clasificar cada documento
        facturas_to_reassign = []
        ncs_to_convert = []
        remisiones_to_delete = []

        missing_rucs = set()

        for inv in invoices:
            cdc = inv["cdc"] or ""
            t_doc = cdc[:2] if len(cdc) >= 2 else "01"
            ruc_num = cdc[2:10].lstrip("0") if len(cdc) >= 10 else ""
            dv = cdc[10:11] if len(cdc) >= 11 else ""
            clean_full = (ruc_num + dv).lstrip("0")

            target_sup = sup_map.get(clean_full) or sup_map.get(ruc_num)

            # Caso especial conocido de SVM Group
            if not target_sup and ruc_num == "80130116":
                target_sup = {
                    "id": None,  # se creará
                    "razon_social": "SVM GROUP SOCIEDAD ANONIMA",
                    "ruc": "80130116-5",
                    "nombre_fantasia": "SVM GROUP",
                    "is_new": True,
                }

            if not target_sup:
                missing_rucs.add(f"{ruc_num}-{dv}")
                continue

            inv_dict = dict(inv)
            inv_dict["target_sup"] = target_sup
            inv_dict["ruc_completo"] = f"{ruc_num}-{dv}"

            if t_doc == "05":
                ncs_to_convert.append(inv_dict)
            elif t_doc == "07":
                remisiones_to_delete.append(inv_dict)
            else:
                facturas_to_reassign.append(inv_dict)

        logger.info(f"Clasificación:")
        logger.info(f"  - Facturas a reasignar a proveedor real: {len(facturas_to_reassign)} por Gs. {sum(Decimal(str(x['total'])) for x in facturas_to_reassign):,}")
        logger.info(f"  - Notas de Crédito a convertir a supplier_credit_notes: {len(ncs_to_convert)} por Gs. {sum(Decimal(str(x['total'])) for x in ncs_to_convert):,}")
        logger.info(f"  - Notas de Remisión a remover de facturas: {len(remisiones_to_delete)}")
        if missing_rucs:
            logger.warning(f"RUCs sin match: {missing_rucs}")

        if not commit:
            logger.info("=== MODO DRY-RUN COMPLETADO (No se aplicaron cambios). Ejecutar con --commit para aplicar. ===")
            return

        logger.info("Iniciando transacción de saneamiento...")
        async with conn.transaction():
            # A. Crear tablas de auditoría previa si no existen
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS public.audit_saneamiento_supplier_invoices_20261017 (
                    audit_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    invoice_id UUID NOT NULL,
                    old_supplier_id UUID,
                    new_supplier_id UUID,
                    action VARCHAR(50) NOT NULL,
                    document_type VARCHAR(10),
                    cdc VARCHAR(50),
                    numero_factura VARCHAR(50),
                    total NUMERIC(15, 0),
                    old_data JSONB NOT NULL,
                    created_at TIMESTAMPTZ DEFAULT NOW()
                );

                CREATE TABLE IF NOT EXISTS public.audit_saneamiento_pruned_suppliers_20261017 (
                    audit_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    supplier_id UUID NOT NULL,
                    razon_social VARCHAR(255),
                    ruc VARCHAR(50),
                    notas TEXT,
                    created_at TIMESTAMPTZ,
                    pruned_at TIMESTAMPTZ DEFAULT NOW()
                );
            """)

            # B. Si SVM GROUP no existe, crearlo
            svm_res = await conn.fetchrow("""
                SELECT id FROM public.suppliers WHERE ruc LIKE '80130116%' AND company_id = $1 LIMIT 1;
            """, COMPANY_ID)
            if svm_res:
                svm_id = svm_res["id"]
            else:
                svm_id = await conn.fetchval("""
                    INSERT INTO public.suppliers (company_id, ruc, razon_social, nombre_fantasia, activo, tipo_proveedor, moneda_default, notas)
                    VALUES ($1, '80130116-5', 'SVM GROUP SOCIEDAD ANONIMA', 'SVM GROUP', true, 'nacional', 'PYG', 'Auto-creado durante saneamiento DTE SIFEN')
                    RETURNING id;
                """, COMPANY_ID)
                logger.info(f"Creado proveedor SVM GROUP SOCIEDAD ANONIMA con ID {svm_id}")

            # C. Reasignar Facturas Reales (tipo 01)
            for inv in facturas_to_reassign:
                tgt = inv["target_sup"]
                sup_id = svm_id if tgt.get("is_new") else tgt["id"]
                razon = tgt["razon_social"]

                # Respaldar en auditoría
                await conn.execute("""
                    INSERT INTO public.audit_saneamiento_supplier_invoices_20261017 
                    (invoice_id, old_supplier_id, new_supplier_id, action, document_type, cdc, numero_factura, total, old_data)
                    VALUES ($1, $2, $3, 'reassign_supplier', '01', $4, $5, $6, $7);
                """, inv["id"], inv["supplier_id"], sup_id, inv["cdc"], inv["numero_factura"], inv["total"], json.dumps({k: v for k, v in inv.items() if k != "target_sup"}, default=str))

                # Actualizar factura
                concepto = f"Factura SIFEN {inv['numero_factura']} de {razon}"
                await conn.execute("""
                    UPDATE public.supplier_invoices
                    SET supplier_id = $1, concepto = $2, updated_at = NOW()
                    WHERE id = $3;
                """, sup_id, concepto, inv["id"])

            logger.info(f"✓ Reasignadas {len(facturas_to_reassign)} facturas a sus proveedores legítimos.")

            # D. Convertir Notas de Crédito (tipo 05) a supplier_credit_notes
            for nc_inv in ncs_to_convert:
                tgt = nc_inv["target_sup"]
                sup_id = svm_id if tgt.get("is_new") else tgt["id"]

                # Respaldar en auditoría
                await conn.execute("""
                    INSERT INTO public.audit_saneamiento_supplier_invoices_20261017 
                    (invoice_id, old_supplier_id, new_supplier_id, action, document_type, cdc, numero_factura, total, old_data)
                    VALUES ($1, $2, $3, 'convert_to_credit_note', '05', $4, $5, $6, $7);
                """, nc_inv["id"], nc_inv["supplier_id"], sup_id, nc_inv["cdc"], nc_inv["numero_factura"], nc_inv["total"], json.dumps({k: v for k, v in nc_inv.items() if k != "target_sup"}, default=str))

                # Insertar en supplier_credit_notes
                await conn.execute("""
                    INSERT INTO public.supplier_credit_notes (
                        company_id, supplier_id, numero, timbrado, fecha, 
                        monto, saldo_disponible, moneda, motivo, observaciones, 
                        cancelado, impacto_contable, motivo_categoria, fecha_recepcion, created_at
                    ) VALUES (
                        $1, $2, $3, $4, $5,
                        $6, $6, $7, 'Nota de crédito electrónica SIFEN', $8,
                        false, 'devolucion_credito', 'devolucion', $9, NOW()
                    );
                """, COMPANY_ID, sup_id, nc_inv["numero_factura"] or "S/N", nc_inv["timbrado"], nc_inv["fecha_emision"], nc_inv["total"], nc_inv["moneda"] or "PYG", f"Auto-migrado desde DTE SIFEN. CDC: {nc_inv['cdc']} | {nc_inv['notas'] or ''}", nc_inv["fecha_recepcion"])

                # Eliminar items y factura errónea
                await conn.execute("DELETE FROM public.supplier_invoice_items WHERE invoice_id = $1;", nc_inv["id"])
                await conn.execute("DELETE FROM public.supplier_invoices WHERE id = $1;", nc_inv["id"])

            logger.info(f"✓ Convertidas {len(ncs_to_convert)} notas de crédito a supplier_credit_notes.")

            # E. Eliminar Nota de Remisión (tipo 07)
            for rem in remisiones_to_delete:
                await conn.execute("""
                    INSERT INTO public.audit_saneamiento_supplier_invoices_20261017 
                    (invoice_id, old_supplier_id, new_supplier_id, action, document_type, cdc, numero_factura, total, old_data)
                    VALUES ($1, $2, NULL, 'remove_remision', '07', $3, $4, $5, $6);
                """, rem["id"], rem["supplier_id"], rem["cdc"], rem["numero_factura"], rem["total"], json.dumps({k: v for k, v in rem.items() if k != "target_sup"}, default=str))
                await conn.execute("DELETE FROM public.supplier_invoice_items WHERE invoice_id = $1;", rem["id"])
                await conn.execute("DELETE FROM public.supplier_invoices WHERE id = $1;", rem["id"])

            logger.info(f"✓ Removidas {len(remisiones_to_delete)} notas de remisión de facturas.")

            # F. Limpiar los 284 proveedores huérfanos 'Proveedor Desconocido'
            # Reasignar primero cualquier producto que apunte a estos proveedores huérfanos
            await conn.execute("""
                UPDATE public.products p
                SET supplier_id = '19232411-7f71-499c-9602-e087479682c6'
                FROM public.suppliers s
                WHERE s.id = p.supplier_id 
                  AND s.razon_social = 'Proveedor Desconocido' 
                  AND s.notas ILIKE '%DISTRIBUIDORA SANTA MARIA%';
            """)
            await conn.execute("""
                UPDATE public.products p
                SET supplier_id = NULL
                FROM public.suppliers s
                WHERE s.id = p.supplier_id 
                  AND s.razon_social = 'Proveedor Desconocido';
            """)

            pruned_sups = await conn.fetch("""
                SELECT s.id, s.razon_social, s.ruc, s.notas, s.created_at
                FROM public.suppliers s
                LEFT JOIN public.supplier_invoices si ON si.supplier_id = s.id
                LEFT JOIN public.supplier_credit_notes scn ON scn.supplier_id = s.id
                LEFT JOIN public.cheques ch ON ch.supplier_id = s.id
                WHERE s.razon_social = 'Proveedor Desconocido'
                  AND si.id IS NULL 
                  AND scn.id IS NULL 
                  AND ch.id IS NULL;
            """)

            for ps in pruned_sups:
                await conn.execute("""
                    INSERT INTO public.audit_saneamiento_pruned_suppliers_20261017
                    (supplier_id, razon_social, ruc, notas, created_at)
                    VALUES ($1, $2, $3, $4, $5);
                """, ps["id"], ps["razon_social"], ps["ruc"], ps["notas"], ps["created_at"])
                await conn.execute("DELETE FROM public.suppliers WHERE id = $1;", ps["id"])

            logger.info(f"✓ Purgados {len(pruned_sups)} proveedores huérfanos 'Proveedor Desconocido'.")

        logger.info("=== SANEAMIENTO COMPLETADO EXITOSAMENTE CON TRANSACCIÓN CONFIRMADA ===")

    finally:
        await conn.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Saneamiento de Cuentas por Pagar Etapa 2")
    parser.add_argument("--commit", action="store_true", help="Aplica los cambios en la base de datos")
    parser.add_argument("--dry-run", action="store_true", help="Simula sin modificar la base de datos")
    args = parser.parse_args()

    if not args.commit and not args.dry_run:
        print("Debe especificar --dry-run o --commit")
        sys.exit(1)

    asyncio.run(run_saneamiento(commit=args.commit))
