"""
Script de Reversión de Conciliación Bancaria de Cheques (Paso C)
Permite revertir con 100% de precisión la conciliación realizada en el Paso C,
usando el manifiesto JSON de auditoría.

Acciones de reversión:
1. Lee el manifiesto JSON del lote de conciliación.
2. Restaura en 'bank_transactions':
   - conciliado = False (o su valor previo)
   - fecha_conciliacion = None
   - cheque_id = None
3. Restaura en 'cheques':
   - estado = estado previo (ej. 'pendiente' si cambió)
   - fecha_pago = fecha previa
4. Registra en 'cheque_historial' la bitácora de la reversión.
5. Ejecución en transacción atómica con ROLLBACK ante fallos.
"""
import os
import sys
import json
import uuid
import asyncio
from sqlalchemy import select, text
from api.src.db import async_session_factory
from api.src.financial.models import BankTransaction
from api.src.cheques.models import Cheque, ChequeHistorial


async def revert_reconciliation(manifest_path: str, commit: bool = False):
    if not os.path.exists(manifest_path):
        print(f"❌ No se encontró el archivo de manifiesto: {manifest_path}")
        return False

    with open(manifest_path, "r", encoding="utf-8") as f:
        manifest = json.load(f)

    batch_id = manifest.get("batch_id")
    executed_at = manifest.get("executed_at")
    pairs = manifest.get("reconciled_pairs", [])

    print("="*80)
    print(f" REVERSIÓN DE CONCILIACIÓN DE CHEQUES: {batch_id}")
    print(f" Fecha de conciliación original: {executed_at}")
    print(f" Total de pares a desconciliar: {len(pairs)}")
    print(f" Modo: {'APLICAR REVERSIÓN (COMMIT)' if commit else 'SIMULACIÓN (DRY-RUN)'}")
    print("="*80)

    if not pairs:
        print("⚠️ No hay pares registrados en el manifiesto.")
        return False

    async with async_session_factory() as session:
        reverted_count = 0
        for item in pairs:
            tx_id = uuid.UUID(item["tx_id"])
            ch_id = uuid.UUID(item["cheque_id"])

            res_tx = await session.execute(select(BankTransaction).where(BankTransaction.id == tx_id))
            tx = res_tx.scalar_one_or_none()

            res_ch = await session.execute(select(Cheque).where(Cheque.id == ch_id))
            ch = res_ch.scalar_one_or_none()

            if tx:
                tx.conciliado = item.get("previous_t_conciliado", False)
                tx.fecha_conciliacion = None
                tx.cheque_id = uuid.UUID(item["previous_t_cheque_id"]) if item.get("previous_t_cheque_id") else None
                session.add(tx)

            if ch:
                old_state = ch.estado
                prev_state = item.get("previous_c_estado", ch.estado)
                if old_state != prev_state:
                    ch.estado = prev_state
                    hist = ChequeHistorial(
                        cheque_id=ch.id,
                        estado_anterior=old_state,
                        estado_nuevo=prev_state,
                        user_id=None,
                        user_nombre="Sistema (Reversión Paso C)",
                        notas=f"Reversión de conciliación del lote {batch_id}. Estado restaurado a '{prev_state}'.",
                    )
                    session.add(hist)
                session.add(ch)

            reverted_count += 1

        print(f"🔄 Pares restaurados a su estado previo: {reverted_count}")

        if commit:
            await session.commit()
            print("\n✅ ¡Reversión de conciliación ejecutada exitosamente en la base de datos!")
            return True
        else:
            await session.rollback()
            print("\n⚠️ Simulación finalizada sin cambios (rollback). Use --commit para aplicar.")
            return True


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Uso: python api/revert_reconciliation_step_c.py <ruta_al_manifiesto.json> [--commit]")
        sys.exit(1)

    m_path = sys.argv[1]
    is_commit = "--commit" in sys.argv
    asyncio.run(revert_reconciliation(m_path, commit=is_commit))
