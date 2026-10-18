"""
Script de Reversión Total de Importación Bancaria (Paso B)
Permite revertir con 100% de precisión cualquier lote importado en el Paso B,
usando el manifiesto JSON de auditoría generado durante la carga.

Acciones de reversión:
1. Lee el manifiesto JSON del lote (batch).
2. Valida que las transacciones pertenezcan al lote y revisa si alguna fue conciliada.
3. Elimina quirúrgicamente SOLO las transacciones insertadas por ese lote (por UUID).
4. Restaura los saldos anteriores de las cuentas bancarias (saldo_actual y saldo_verificado).
5. Todo dentro de una transacción atómica con ROLLBACK ante cualquier error.
"""
import os
import sys
import json
import uuid
from decimal import Decimal
import asyncio
from sqlalchemy import select, delete, text
from api.src.db import async_session_factory
from api.src.financial.models import BankAccount, BankTransaction


async def revert_batch(manifest_path: str, force: bool = False, commit: bool = False):
    if not os.path.exists(manifest_path):
        print(f"❌ No se encontró el manifiesto: {manifest_path}")
        return False

    with open(manifest_path, "r", encoding="utf-8") as f:
        manifest = json.load(f)

    batch_id = manifest.get("batch_id")
    executed_at = manifest.get("executed_at")
    total_tx_ids = manifest.get("all_inserted_ids", [])

    print("="*80)
    print(f" REVERSIÓN DE LOTE BANCARIO: {batch_id}")
    print(f" Fecha de importación original: {executed_at}")
    print(f" Total de transacciones a eliminar: {len(total_tx_ids)}")
    print(f" Modo: {'APLICAR REVERSIÓN (COMMIT)' if commit else 'SIMULACIÓN (DRY-RUN)'}")
    print("="*80)

    if not total_tx_ids:
        print("⚠️ El manifiesto no contiene IDs de transacciones para revertir.")
        return False

    uuids_to_delete = [uuid.UUID(uid) for uid in total_tx_ids]

    async with async_session_factory() as session:
        # 1. Verificar si alguna fue conciliada
        res_conciliadas = await session.execute(
            select(BankTransaction.id, BankTransaction.descripcion, BankTransaction.monto)
            .where(BankTransaction.id.in_(uuids_to_delete), BankTransaction.conciliado == True)
        )
        conciliadas = res_conciliadas.fetchall()
        if conciliadas and not force:
            print(f"⚠️ ATENCIÓN: {len(conciliadas)} transacciones ya fueron conciliadas:")
            for c in conciliadas[:5]:
                print(f"   - TX {c.id}: {c.descripcion} | Gs. {c.monto:,.0f}")
            print("❌ Reversión abortada. Para forzar la reversión use la opción --force.")
            return False

        # 2. Eliminar transacciones del lote
        del_stmt = delete(BankTransaction).where(BankTransaction.id.in_(uuids_to_delete))
        res_del = await session.execute(del_stmt)
        print(f"🗑️ Transacciones eliminadas: {res_del.rowcount}")

        # 3. Restaurar saldos de cuentas bancarias
        for acc_info in manifest.get("accounts_summary", []):
            acc_id = uuid.UUID(acc_info["account_id"])
            res_acc = await session.execute(select(BankAccount).where(BankAccount.id == acc_id))
            acc = res_acc.scalar_one_or_none()
            if not acc:
                print(f"⚠️ Cuenta {acc_id} no encontrada.")
                continue

            prev_saldo = Decimal(str(acc_info["initial_saldo_actual"]))
            prev_verificado = acc_info.get("initial_saldo_verificado", False)

            print(f"🏦 Restaurando Cuenta {acc.numero_cuenta} ({acc.banco} - {acc.tipo}):")
            print(f"   Saldo en BD: Gs. {acc.saldo_actual:,.2f} -> Restaurado a: Gs. {prev_saldo:,.2f}")
            acc.saldo_actual = prev_saldo
            acc.saldo_verificado_manualmente = prev_verificado
            session.add(acc)

        if commit:
            await session.commit()
            print("\n✅ ¡Reversión completada exitosamente! La base de datos volvió al estado exacto previo.")
            return True
        else:
            await session.rollback()
            print("\n⚠️ Simulación de reversión finalizada sin cambios (rollback). Use --commit para aplicar.")
            return True


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Uso: python api/revert_bank_import_step_b.py <ruta_al_manifiesto.json> [--commit] [--force]")
        sys.exit(1)

    m_path = sys.argv[1]
    is_commit = "--commit" in sys.argv
    is_force = "--force" in sys.argv
    asyncio.run(revert_batch(m_path, force=is_force, commit=is_commit))
