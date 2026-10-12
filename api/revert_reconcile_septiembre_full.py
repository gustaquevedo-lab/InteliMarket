"""
Script de Reversión Atómica de Conciliación 360° — Septiembre 2026.
InteliMarket - Vertical Supermercado

Restaura el estado previo de las transacciones y cheques conciliados
mediante el archivo de manifiesto JSON generado por `api/reconcile_septiembre_full_step_c.py`.

Modo de uso:
- Simulación: PYTHONPATH=. .venv/bin/python api/revert_reconcile_septiembre_full.py <MANIFIESTO.json>
- Aplicar:    PYTHONPATH=. .venv/bin/python api/revert_reconcile_septiembre_full.py <MANIFIESTO.json> --commit
"""
import os
import sys
import json
import uuid
import argparse
import asyncio
from datetime import datetime
from sqlalchemy import select
from api.src.db import async_session_factory
from api.src.financial.models import BankTransaction
from api.src.cheques.models import Cheque


async def revert_reconciliation(manifest_path: str, commit: bool = False):
    if not os.path.exists(manifest_path):
        print(f"❌ No se encontró el manifiesto: {manifest_path}")
        return False

    with open(manifest_path, "r", encoding="utf-8") as f:
        manifest = json.load(f)

    batch_id = manifest.get("batch_id")
    executed_at = manifest.get("executed_at")
    items = manifest.get("reconciled_items", [])

    print("=" * 80)
    print(f" REVERSIÓN DE CONCILIACIÓN 360°: {batch_id}")
    print(f" Fecha original: {executed_at}")
    print(f" Total de items a restaurar: {len(items)}")
    print(f" Modo: {'APLICAR REVERSIÓN (COMMIT)' if commit else 'SIMULACIÓN (DRY-RUN)'}")
    print("=" * 80)

    if not items:
        print("⚠️ No hay items registrados en el manifiesto.")
        return False

    async with async_session_factory() as session:
        restored_txs = 0
        restored_cheques = 0

        for item in items:
            tx_id = uuid.UUID(item["transaction_id"])
            res_tx = await session.execute(select(BankTransaction).where(BankTransaction.id == tx_id))
            tx = res_tx.scalar_one_or_none()
            if tx:
                tx.conciliado = item.get("old_conciliado", False)
                tx.fecha_conciliacion = None
                tx.cheque_id = None
                if "old_categoria" in item:
                    tx.categoria = item["old_categoria"]
                session.add(tx)
                restored_txs += 1

            if item.get("cheque_id"):
                ch_id = uuid.UUID(item["cheque_id"])
                res_ch = await session.execute(select(Cheque).where(Cheque.id == ch_id))
                ch = res_ch.scalar_one_or_none()
                if ch:
                    ch.estado = item.get("old_cheque_estado", "pendiente")
                    ch.fecha_pago = item.get("old_cheque_fecha_pago")
                    session.add(ch)
                    restored_cheques += 1

        if not commit:
            print(f"\n[DRY-RUN] Se restaurarían {restored_txs} transacciones y {restored_cheques} cheques.")
            print("Para aplicar los cambios de reversión, ejecute con: --commit")
            return True

        await session.commit()
        print(f"✅ ÉXITO: Se restauraron {restored_txs} transacciones y {restored_cheques} cheques en la BD.")
        return True


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Reversión de conciliación bancaria 360°.")
    parser.add_argument("manifest", help="Ruta al archivo manifiesto JSON")
    parser.add_argument("--commit", action="store_true", help="Aplica la reversión en la BD")
    args = parser.parse_args()

    asyncio.run(revert_reconciliation(args.manifest, commit=args.commit))
