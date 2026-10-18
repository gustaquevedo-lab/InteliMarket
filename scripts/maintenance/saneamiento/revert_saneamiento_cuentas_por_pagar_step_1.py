"""
Script de Reversión de Saneamiento de Cuentas por Pagar - Etapa 1
InteliMarket - Vertical Supermercado

Permite revertir con 100% de fidelidad y precisión todos los cambios
aplicados por `api/saneamiento_cuentas_por_pagar_step_1.py`.

Restaura:
- `numero_factura` a su valor original exacto previo.
- `timbrado` a su valor original exacto previo.
- `saldo_pendiente` a su valor original exacto previo.
- `estado` a su valor original exacto previo.

Modo de uso:
- Simulación: PYTHONPATH=. .venv/bin/python3 api/revert_saneamiento_cuentas_por_pagar_step_1.py --dry-run
- Aplicar:    PYTHONPATH=. .venv/bin/python3 api/revert_saneamiento_cuentas_por_pagar_step_1.py --commit
"""

import sys
import os
import argparse
from datetime import datetime
import asyncio
from sqlalchemy import text
from api.src.db import async_session_factory

SNAPSHOT_TABLE = "audit_saneamiento_supplier_invoices_20261008"

async def run_reversion(commit: bool = False):
    print("=" * 80)
    print(" REVERSIÓN TOTAL DE SANEAMIENTO (ETAPA 1)")
    print(f" Modo: {'APLICAR REVERSIÓN EN PRODUCCIÓN (--commit)' if commit else 'SIMULACIÓN SEGURA (--dry-run)'}")
    print(f" Fecha/Hora: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 80)

    async with async_session_factory() as db:
        # Verificar que la tabla de snapshot exista
        res = await db.execute(text(f"""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = '{SNAPSHOT_TABLE}'
            );
        """))
        exists = res.scalar()
        if not exists:
            print(f"❌ Error: No se encontró la tabla de respaldo `{SNAPSHOT_TABLE}`. No hay cambios que revertir.")
            return

        # Cargar los registros guardados en el snapshot
        res = await db.execute(text(f"""
            SELECT 
                id, supplier_id, 
                numero_factura_prev, numero_factura_new,
                timbrado_prev, timbrado_new,
                saldo_pendiente_prev, saldo_pendiente_new,
                estado_prev, estado_new, motivo
            FROM {SNAPSHOT_TABLE}
            ORDER BY id ASC
        """))
        backup_rows = res.fetchall()
        print(f"Total registros respaldados en `{SNAPSHOT_TABLE}`: {len(backup_rows)}")

        if not backup_rows:
            print("⚠️ No hay filas registradas en el snapshot.")
            return

        print("\nMuestra de registros a restaurar:")
        for r in backup_rows[:10]:
            print(f"  ID: {str(r[0])[:8]}.. | Restaurando: num='{r[3]}' -> '{r[2]}', timb='{r[5]}' -> '{r[4]}', saldo={r[7]} -> {r[6]}, estado='{r[9]}' -> '{r[8]}'")

        if not commit:
            print("\n" + "=" * 80)
            print("⚠️ SIMULACIÓN DE REVERSIÓN FINALIZADA SIN ESCRITURAS (--dry-run)")
            print("   Para ejecutar la reversión real y restaurar el estado previo, ejecuta:")
            print("   PYTHONPATH=. .venv/bin/python3 api/revert_saneamiento_cuentas_por_pagar_step_1.py --commit")
            print("=" * 80)
            return

        # Aplicar reversión
        print("\n--- RESTAURANDO VALORES ORIGINALES EN supplier_invoices ---")
        revert_stmt = text("""
            UPDATE supplier_invoices
            SET 
                numero_factura = :num_prev,
                timbrado = :timb_prev,
                saldo_pendiente = :saldo_prev,
                estado = :est_prev
            WHERE id = :iid
        """)

        reverted_count = 0
        for r in backup_rows:
            await db.execute(revert_stmt, {
                "iid": r[0],
                "num_prev": r[2],
                "timb_prev": r[4],
                "saldo_prev": r[6],
                "est_prev": r[8]
            })
            reverted_count += 1

        await db.commit()
        print("\n" + "=" * 80)
        print(f"✅ ¡REVERSIÓN COMPLETADA CON ÉXITO! {reverted_count} facturas restauradas a su estado exacto original.")
        print(f"   La tabla de snapshot `{SNAPSHOT_TABLE}` se mantiene intacta como evidencia histórica.")
        print("=" * 80)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Reversión de Saneamiento de Cuentas por Pagar (Etapa 1)")
    parser.add_argument("--commit", action="store_true", help="Aplica la reversión en la base de datos (por defecto solo simula)")
    parser.add_argument("--dry-run", action="store_true", help="Fuerza modo simulación")
    args = parser.parse_args()

    commit_flag = args.commit and not args.dry_run
    asyncio.run(run_reversion(commit=commit_flag))
