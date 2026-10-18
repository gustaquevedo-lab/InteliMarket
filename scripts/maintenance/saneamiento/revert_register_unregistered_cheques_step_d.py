"""
Script de Reversión de Cheques Incorporados (Paso D)
Permite eliminar de forma quirúrgica los cheques registrados en el Paso D
usando el archivo de manifiesto JSON generado durante la carga.

Acciones:
1. Desvincula 'bank_transactions.cheque_id' para los cheques del lote.
2. Elimina los cheques insertados en la tabla 'cheques'.
3. Elimina las bitácoras asociadas en 'cheque_historial'.
4. Ejecución en transacción atómica con ROLLBACK ante cualquier error.
"""
import os
import sys
import json
import uuid
import asyncio
from sqlalchemy import select, delete, text
from api.src.db import async_session_factory
from api.src.financial.models import BankTransaction
from api.src.cheques.models import Cheque, ChequeHistorial


async def revert_registered_cheques(manifest_path: str, commit: bool = False):
    if not os.path.exists(manifest_path):
        print(f"❌ No se encontró el manifiesto: {manifest_path}")
        return False

    with open(manifest_path, "r", encoding="utf-8") as f:
        manifest = json.load(f)

    batch_id = manifest.get("batch_id")
    executed_at = manifest.get("executed_at")
    cheque_ids = manifest.get("all_inserted_cheque_ids", [])

    print("="*80)
    print(f" REVERSIÓN DE CHEQUES INCORPORADOS: {batch_id}")
    print(f" Fecha original: {executed_at}")
    print(f" Total de cheques a eliminar: {len(cheque_ids)}")
    print(f" Modo: {'APLICAR REVERSIÓN (COMMIT)' if commit else 'SIMULACIÓN (DRY-RUN)'}")
    print("="*80)

    if not cheque_ids:
        print("⚠️ No hay IDs de cheques en el manifiesto.")
        return False

    uuids = [uuid.UUID(uid) for uid in cheque_ids]

    async with async_session_factory() as session:
        # 1. Desvincular bank_transactions
        res_unlinked = await session.execute(
            text("UPDATE bank_transactions SET cheque_id = NULL, conciliado = False WHERE cheque_id = ANY(:uids)"),
            {"uids": uuids}
        )
        print(f"🔗 Transacciones bancarias desvinculadas: {res_unlinked.rowcount}")

        # 2. Eliminar historial
        res_del_hist = await session.execute(
            delete(ChequeHistorial).where(ChequeHistorial.cheque_id.in_(uuids))
        )
        print(f"🗑️ Registros de historial eliminados: {res_del_hist.rowcount}")

        # 3. Eliminar cheques
        res_del_ch = await session.execute(
            delete(Cheque).where(Cheque.id.in_(uuids))
        )
        print(f"🗑️ Cheques eliminados: {res_del_ch.rowcount}")

        if commit:
            await session.commit()
            print("\n✅ ¡Reversión completada exitosamente! Todos los cheques del lote fueron eliminados.")
            return True
        else:
            await session.rollback()
            print("\n⚠️ Simulación finalizada sin cambios (rollback). Use --commit para aplicar.")
            return True


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Uso: python api/revert_register_unregistered_cheques_step_d.py <ruta_al_manifiesto.json> [--commit]")
        sys.exit(1)

    m_path = sys.argv[1]
    is_commit = "--commit" in sys.argv
    asyncio.run(revert_registered_cheques(m_path, commit=is_commit))
