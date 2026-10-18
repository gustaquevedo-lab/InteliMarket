"""
Script de Reversión de Calibración de Saldos Bancarios
Permite revertir con 100% de precisión la calibración de saldos de las cuentas bancarias,
usando el manifiesto JSON de auditoría.
"""
import os
import sys
import json
import uuid
from decimal import Decimal
import asyncio
from sqlalchemy import select
from api.src.db import async_session_factory
from api.src.financial.models import BankAccount


async def revert_calibration(manifest_path: str, commit: bool = False):
    if not os.path.exists(manifest_path):
        print(f"❌ No se encontró el manifiesto: {manifest_path}")
        return False

    with open(manifest_path, "r", encoding="utf-8") as f:
        manifest = json.load(f)

    batch_id = manifest.get("batch_id")
    executed_at = manifest.get("executed_at")
    accounts = manifest.get("accounts", [])

    print("="*80)
    print(f" REVERSIÓN DE CALIBRACIÓN DE SALDOS: {batch_id}")
    print(f" Fecha original: {executed_at}")
    print(f" Cuentas a restaurar: {len(accounts)}")
    print(f" Modo: {'APLICAR REVERSIÓN (COMMIT)' if commit else 'SIMULACIÓN (DRY-RUN)'}")
    print("="*80)

    async with async_session_factory() as session:
        for a_info in accounts:
            acc_id = uuid.UUID(a_info["account_id"])
            res = await session.execute(select(BankAccount).where(BankAccount.id == acc_id))
            acc = res.scalar_one_or_none()
            if not acc:
                continue

            prev_saldo = Decimal(str(a_info["previous_saldo_actual"]))
            prev_verif = a_info.get("previous_saldo_verificado", False)

            print(f"🏦 Cuenta {acc.numero_cuenta} ({acc.banco} - {acc.tipo}):")
            print(f"   Saldo actual: Gs. {acc.saldo_actual:,.2f} -> Restaurando a: Gs. {prev_saldo:,.2f}")
            acc.saldo_actual = prev_saldo
            acc.saldo_verificado_manualmente = prev_verif
            session.add(acc)

        if commit:
            await session.commit()
            print("\n✅ ¡Reversión completada exitosamente! Los saldos volvieron al estado anterior.")
            return True
        else:
            await session.rollback()
            print("\n⚠️ Simulación finalizada sin cambios (rollback). Use --commit para aplicar.")
            return True


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Uso: python api/revert_calibrate_bank_balances.py <ruta_al_manifiesto.json> [--commit]")
        sys.exit(1)

    m_path = sys.argv[1]
    is_commit = "--commit" in sys.argv
    asyncio.run(revert_calibration(m_path, commit=is_commit))
