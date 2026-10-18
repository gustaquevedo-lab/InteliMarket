"""
Script de Saneamiento y Normalización de Cuentas por Pagar - Etapa 1
InteliMarket - Vertical Supermercado

Objetivos:
1. Normalización de formatos en `supplier_invoices.numero_factura`:
   - Separar timbrado prefijado (ej. '17090459 - 001-001-0253420' -> timbrado: '17090459', numero: '001-001-0253420').
   - Normalizar facturas sin guiones (ej. '0010010282132' -> '001-001-0282132').
   - Normalizar facturas con 6 dígitos en el último bloque (ej. '001-001-017641' -> '001-001-0017641').
2. Extinción de polvo contable de redondeo (saldo_pendiente > 0 y <= 100 Gs.):
   - Ajustar saldo_pendiente = 0 y estado = 'pagada'.

Garantías:
- 100% REVERSIBLE: Crea tabla de respaldo `audit_saneamiento_supplier_invoices_20261008` y archivo JSON de manifiesto.
- Dry-Run por defecto: No escribe nada a menos que se invoque con --commit.
"""

import sys
import os
import re
import json
import argparse
from datetime import datetime
from decimal import Decimal
import asyncio
from sqlalchemy import text
from api.src.db import async_session_factory

fac_regex = re.compile(r'(\d{3}-\d{3}-\d{6,7})')

SNAPSHOT_TABLE = "audit_saneamiento_supplier_invoices_20261008"

def normalize_invoice_and_timbrado(raw_num: str, current_timb: str):
    raw_clean = (raw_num or "").strip()
    extracted_timb = None
    clean_num = raw_clean
    
    # 1. Caso 'TIMBRADO - XXX-XXX-XXXXXXX'
    if " - " in raw_clean:
        parts = raw_clean.split(" - ")
        if len(parts) == 2 and parts[0].strip().isdigit() and len(parts[0].strip()) >= 6:
            extracted_timb = parts[0].strip()
            num_part = parts[1].strip()
            m = fac_regex.search(num_part)
            if m:
                p = m.group(1).split("-")
                clean_num = f"{int(p[0]):03d}-{int(p[1]):03d}-{int(p[2]):07d}"
            else:
                clean_num = num_part
    # 2. Caso '0010010282132' (13 dígitos sin guiones)
    elif len(raw_clean) == 13 and raw_clean.isdigit():
        clean_num = f"{int(raw_clean[:3]):03d}-{int(raw_clean[3:6]):03d}-{int(raw_clean[6:]):07d}"
    # 3. Caso estándar o con 6 dígitos en el último bloque
    else:
        m = fac_regex.search(raw_clean)
        if m:
            p = m.group(1).split("-")
            clean_num = f"{int(p[0]):03d}-{int(p[1]):03d}-{int(p[2]):07d}"
            
    # Determinar si timbrado debe actualizarse
    final_timb = current_timb
    if (not current_timb or not str(current_timb).strip()) and extracted_timb:
        final_timb = extracted_timb
        
    return clean_num, final_timb, extracted_timb


async def run_saneamiento(commit: bool = False):
    timestamp_str = datetime.now().strftime("%Y%m%d_%H%M%S")
    manifest_dir = "datos/audit_logs"
    os.makedirs(manifest_dir, exist_ok=True)
    manifest_file = os.path.join(manifest_dir, f"saneamiento_step_1_{timestamp_str}.json")

    print("=" * 80)
    print(" SANEAMIENTO Y NORMALIZACIÓN DE CUENTAS POR PAGAR (ETAPA 1)")
    print(f" Modo: {'APLICAR EN PRODUCCIÓN (--commit)' if commit else 'SIMULACIÓN SEGURA (--dry-run)'}")
    print(f" Fecha/Hora: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 80)

    async with async_session_factory() as db:
        # Cargar todas las facturas
        res = await db.execute(text("""
            SELECT id, supplier_id, numero_factura, timbrado, total, saldo_pendiente, estado
            FROM supplier_invoices
            ORDER BY fecha_emision ASC, id ASC
        """))
        invoices = res.fetchall()
        print(f"Total facturas registradas en el sistema: {len(invoices)}")

        records_to_normalize = []
        dust_records = []
        all_changes = []

        for inv in invoices:
            iid, sid, num, timb, tot, saldo, est = inv
            raw_num = (num or "").strip()
            raw_timb = (timb or "").strip() if timb else None
            
            clean_num, final_timb, ext_timb = normalize_invoice_and_timbrado(raw_num, raw_timb)
            
            needs_num_update = (clean_num != raw_num)
            needs_timb_update = (final_timb != raw_timb and final_timb is not None)
            
            # Polvo contable (saldo <= 100 Gs.)
            is_dust = (saldo > 0 and saldo <= 100)
            
            if needs_num_update or needs_timb_update or is_dust:
                change = {
                    "id": str(iid),
                    "supplier_id": str(sid),
                    "numero_factura_prev": raw_num,
                    "numero_factura_new": clean_num,
                    "timbrado_prev": raw_timb,
                    "timbrado_new": final_timb,
                    "saldo_pendiente_prev": float(saldo),
                    "saldo_pendiente_new": 0.0 if is_dust else float(saldo),
                    "estado_prev": est,
                    "estado_new": "pagada" if is_dust else est,
                    "motivo": []
                }
                
                if needs_num_update:
                    change["motivo"].append(f"Normalizar numero: '{raw_num}' -> '{clean_num}'")
                if needs_timb_update:
                    change["motivo"].append(f"Rescatar timbrado: '{raw_timb}' -> '{final_timb}'")
                if is_dust:
                    change["motivo"].append(f"Extinguir polvo contable: saldo Gs. {saldo} -> 0")
                    dust_records.append(change)
                    
                change["motivo_str"] = " | ".join(change["motivo"])
                all_changes.append(change)
                if needs_num_update or needs_timb_update:
                    records_to_normalize.append(change)

        print("\n--- RESUMEN DEL IMPACTO ---")
        print(f"Facturas a normalizar (formato / timbrado): {len(records_to_normalize)}")
        print(f"Facturas con polvo contable a saldar (<= 100 Gs.): {len(dust_records)}")
        print(f"Total modificaciones a realizar: {len(all_changes)}")

        print("\nMuestra de los primeros 10 cambios:")
        for ch in all_changes[:10]:
            print(f"  ID: {ch['id'][:8]}.. | Motivo: {ch['motivo_str']}")
            print(f"     Prev: num='{ch['numero_factura_prev']}', timb='{ch['timbrado_prev']}', saldo={ch['saldo_pendiente_prev']}")
            print(f"     New : num='{ch['numero_factura_new']}', timb='{ch['timbrado_new']}', saldo={ch['saldo_pendiente_new']}")

        if not commit:
            print("\n" + "=" * 80)
            print("⚠️ SIMULACIÓN FINALIZADA SIN ESCRITURAS (--dry-run)")
            print("   Para aplicar estos cambios en la base de datos, ejecuta:")
            print("   PYTHONPATH=. .venv/bin/python3 api/saneamiento_cuentas_por_pagar_step_1.py --commit")
            print("=" * 80)
            return

        # APLICAR CAMBIOS EN BASE DE DATOS
        print("\n--- APLICANDO CAMBIOS EN BASE DE DATOS ---")
        
        # 1. Crear tabla de snapshot de auditoría
        await db.execute(text(f"""
            CREATE TABLE IF NOT EXISTS {SNAPSHOT_TABLE} (
                id UUID PRIMARY KEY,
                supplier_id UUID,
                numero_factura_prev VARCHAR(50),
                numero_factura_new VARCHAR(50),
                timbrado_prev VARCHAR(20),
                timbrado_new VARCHAR(20),
                saldo_pendiente_prev NUMERIC(15, 0),
                saldo_pendiente_new NUMERIC(15, 0),
                estado_prev VARCHAR(50),
                estado_new VARCHAR(50),
                motivo TEXT,
                creado_el TIMESTAMPTZ DEFAULT now()
            );
        """))
        print(f"✓ Tabla de respaldo verificada: {SNAPSHOT_TABLE}")

        # 2. Insertar registros en la tabla de snapshot y actualizar supplier_invoices
        update_stmt = text("""
            UPDATE supplier_invoices
            SET 
                numero_factura = :num_new,
                timbrado = :timb_new,
                saldo_pendiente = :saldo_new,
                estado = :estado_new
            WHERE id = :iid
        """)

        snapshot_stmt = text(f"""
            INSERT INTO {SNAPSHOT_TABLE} (
                id, supplier_id, numero_factura_prev, numero_factura_new,
                timbrado_prev, timbrado_new, saldo_pendiente_prev, saldo_pendiente_new,
                estado_prev, estado_new, motivo
            ) VALUES (
                :iid, :sid, :num_prev, :num_new,
                :timb_prev, :timb_new, :saldo_prev, :saldo_new,
                :est_prev, :est_new, :motivo
            )
            ON CONFLICT (id) DO UPDATE SET
                numero_factura_new = EXCLUDED.numero_factura_new,
                timbrado_new = EXCLUDED.timbrado_new,
                saldo_pendiente_new = EXCLUDED.saldo_pendiente_new,
                estado_new = EXCLUDED.estado_new,
                motivo = EXCLUDED.motivo,
                creado_el = now();
        """)

        count_updated = 0
        for ch in all_changes:
            params = {
                "iid": ch["id"],
                "sid": ch["supplier_id"],
                "num_prev": ch["numero_factura_prev"],
                "num_new": ch["numero_factura_new"],
                "timb_prev": ch["timbrado_prev"],
                "timb_new": ch["timbrado_new"],
                "saldo_prev": ch["saldo_pendiente_prev"],
                "saldo_new": ch["saldo_pendiente_new"],
                "est_prev": ch["estado_prev"],
                "est_new": ch["estado_new"],
                "motivo": ch["motivo_str"]
            }
            # Snapshot
            await db.execute(snapshot_stmt, params)
            # Update
            await db.execute(update_stmt, {
                "iid": ch["id"],
                "num_new": ch["numero_factura_new"],
                "timb_new": ch["timbrado_new"],
                "saldo_new": ch["saldo_pendiente_new"],
                "estado_new": ch["estado_new"]
            })
            count_updated += 1

        # 3. Guardar manifiesto JSON en disco
        manifest_data = {
            "timestamp": timestamp_str,
            "snapshot_table": SNAPSHOT_TABLE,
            "total_updated": count_updated,
            "changes": all_changes
        }
        with open(manifest_file, "w", encoding="utf-8") as f:
            json.dump(manifest_data, f, ensure_ascii=False, indent=2)
        print(f"✓ Manifiesto JSON de respaldo generado: {manifest_file}")

        # Commit final
        await db.commit()
        print("\n" + "=" * 80)
        print(f"✅ ¡SANEAMIENTO APLICADO CON ÉXITO! {count_updated} facturas actualizadas.")
        print(f"   Snapshot guardado en tabla: {SNAPSHOT_TABLE}")
        print(f"   Para revertir en cualquier momento, ejecuta:")
        print(f"   PYTHONPATH=. .venv/bin/python3 api/revert_saneamiento_cuentas_por_pagar_step_1.py --commit")
        print("=" * 80)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Saneamiento de Cuentas por Pagar (Etapa 1)")
    parser.add_argument("--commit", action="store_true", help="Aplica los cambios en la base de datos (por defecto solo simula)")
    parser.add_argument("--dry-run", action="store_true", help="Fuerza modo simulación")
    args = parser.parse_args()

    commit_flag = args.commit and not args.dry_run
    asyncio.run(run_saneamiento(commit=commit_flag))
