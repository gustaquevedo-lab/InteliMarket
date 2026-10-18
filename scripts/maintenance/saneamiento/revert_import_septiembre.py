"""
Script de Reversión Quirúrgica de Importación de Transacciones Bancarias — Septiembre 2026.
InteliMarket - Vertical Supermercado

Permite eliminar de forma atómica y segura exactamente las transacciones insertadas
por `api/import_septiembre_full.py`, utilizando el archivo de manifiesto JSON generado.

Modo de uso:
- Simulación: PYTHONPATH=. .venv/bin/python api/revert_import_septiembre.py <MANIFIESTO.json>
- Aplicar:    PYTHONPATH=. .venv/bin/python api/revert_import_septiembre.py <MANIFIESTO.json> --commit
"""
import os
import sys
import json
import uuid
import argparse
import asyncio
from datetime import datetime
from sqlalchemy import select, delete
from api.src.db import async_session_factory
from api.src.financial.models import BankTransaction


async def revert_imported_transactions(manifest_path: str, commit: bool = False):
    if not os.path.exists(manifest_path):
        print(f"❌ No se encontró el manifiesto: {manifest_path}")
        return False

    with open(manifest_path, "r", encoding="utf-8") as f:
        manifest = json.load(f)

    batch_id = manifest.get("batch_id")
    executed_at = manifest.get("executed_at")
    tx_ids_raw = manifest.get("inserted_transaction_ids", [])

    print("=" * 80)
    print(f" REVERSIÓN DE IMPORTACIÓN DE TRANSACCIONES: {batch_id}")
    print(f" Fecha original: {executed_at}")
    print(f" Total de transacciones a revertir: {len(tx_ids_raw)}")
    print(f" Modo: {'APLICAR REVERSIÓN (COMMIT)' if commit else 'SIMULACIÓN (DRY-RUN)'}")
    print("=" * 80)

    if not tx_ids_raw:
        print("⚠️ No hay IDs de transacciones en el manifiesto.")
        return False

    tx_uuids = [uuid.UUID(tid) for tid in tx_ids_raw]

    async with async_session_factory() as session:
        # 1. Contar cuántas existen actualmente
        res = await session.execute(
            select(BankTransaction.id, BankTransaction.bank_account_id, BankTransaction.monto, BankTransaction.tipo)
            .where(BankTransaction.id.in_(tx_uuids))
        )
        existing = list(res.all())
        print(f"🔍 Encontradas en BD para eliminación: {len(existing)} de {len(tx_uuids)}")

        if not commit:
            print("\n[DRY-RUN] No se realizó ninguna eliminación.")
            print("Para aplicar de forma permanente, ejecute agregando el flag: --commit")
            return True

        # 2. Eliminar en lote
        await session.execute(
            delete(BankTransaction).where(BankTransaction.id.in_(tx_uuids))
        )
        await session.commit()
        print(f"\n✅ ÉXITO: Se eliminaron permanentemente {len(existing)} transacciones asociadas al lote {batch_id}.")
        return True


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Reversión de lote de importación bancaria.")
    parser.add_argument("manifest", help="Ruta al archivo manifiesto JSON")
    parser.add_argument("--commit", action="store_true", help="Aplica la eliminación en la base de datos")
    args = parser.parse_args()

    asyncio.run(revert_imported_transactions(args.manifest, commit=args.commit))
