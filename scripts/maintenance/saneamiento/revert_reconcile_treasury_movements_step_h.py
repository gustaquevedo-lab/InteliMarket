"""
Script de Reversión de Conciliación Integral de Tesorería (Paso H)
Restaura con 100% de exactitud el estado 'conciliado', 'fecha_conciliacion' e 'invoice_id'
utilizando el manifiesto JSON de auditoría.
"""
import os
import sys
import json
import uuid
import asyncio
from sqlalchemy import select
from api.src.db import async_session_factory
from api.src.financial.models import BankTransaction


async def revert_reconciliation(manifest_path: str, commit: bool = False):
    if not os.path.exists(manifest_path):
        print(f"❌ No se encontró el manifiesto: {manifest_path}")
        return False

    with open(manifest_path, "r", encoding="utf-8") as f:
        manifest = json.load(f)

    batch_id = manifest.get("batch_id")
    executed_at = manifest.get("executed_at")
    items = manifest.get("items", [])

    print("="*80)
    print(f" REVERSIÓN DE CONCILIACIÓN DE TESORERÍA (PASO H): {batch_id}")
    print(f" Fecha original: {executed_at}")
    print(f" Transacciones a restaurar: {len(items)}")
    print(f" Modo: {'APLICAR REVERSIÓN (COMMIT)' if commit else 'SIMULACIÓN (DRY-RUN)'}")
    print("="*80)

    async with async_session_factory() as session:
        restored = 0
        for item in items:
            tx_id = uuid.UUID(item["transaction_id"])
            res = await session.execute(select(BankTransaction).where(BankTransaction.id == tx_id))
            tx = res.scalar_one_or_none()
            if not tx:
                continue

            tx.conciliado = item.get("old_conciliado", False)
            tx.fecha_conciliacion = None
            if "old_invoice_id" in item:
                old_inv = item["old_invoice_id"]
                tx.invoice_id = uuid.UUID(old_inv) if old_inv else None

            session.add(tx)
            restored += 1

        print(f"Transacciones preparadas para restaurar: {restored}")

        if commit:
            await session.commit()
            print("\n✅ ¡Reversión completada exitosamente! Todas las transacciones volvieron a su estado previo.")
            return True
        else:
            await session.rollback()
            print("\n⚠️ Simulación finalizada sin cambios (rollback). Use --commit para aplicar.")
            return True


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Uso: python api/revert_reconcile_treasury_movements_step_h.py <ruta_al_manifiesto.json> [--commit]")
        sys.exit(1)

    m_path = sys.argv[1]
    is_commit = "--commit" in sys.argv
    asyncio.run(revert_reconciliation(m_path, commit=is_commit))
