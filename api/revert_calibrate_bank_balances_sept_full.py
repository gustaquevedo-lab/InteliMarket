"""
Script de Reversión de Calibración de Saldos Bancarios — Septiembre 2026.
InteliMarket - Vertical Supermercado

Restaura los saldos previos de las 5 cuentas bancarias utilizando el archivo
de manifiesto JSON de auditoría generado por `api/calibrate_bank_balances_sept_full.py`.

Modo de uso:
- Simulación: PYTHONPATH=. .venv/bin/python api/revert_calibrate_bank_balances_sept_full.py <MANIFIESTO.json>
- Aplicar:    PYTHONPATH=. .venv/bin/python api/revert_calibrate_bank_balances_sept_full.py <MANIFIESTO.json> --commit
"""
import os
import sys
import json
import uuid
import argparse
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

    print("=" * 80)
    print(f" REVERSIÓN DE CALIBRACIÓN DE SALDOS: {batch_id}")
    print(f" Fecha original: {executed_at}")
    print(f" Cuentas a restaurar: {len(accounts)}")
    print(f" Modo: {'APLICAR REVERSIÓN (COMMIT)' if commit else 'SIMULACIÓN (DRY-RUN)'}")
    print("=" * 80)

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
            print(f"   Saldo actual: Gs. {acc.saldo_actual:,.0f} -> Restaurando a: Gs. {prev_saldo:,.0f}")
            acc.saldo_actual = prev_saldo
            acc.saldo_verificado_manualmente = prev_verif
            session.add(acc)

        if commit:
            await session.commit()
            print("\n✅ ¡Reversión completada exitosamente! Los saldos volvieron al estado anterior.")
            return True
        else:
            await session.rollback()
            print("\n⚠️ Simulación finalizada sin cambios. Use --commit para aplicar de forma permanente.")
            return True


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Reversión de calibración de saldos bancarios.")
    parser.add_argument("manifest", help="Ruta al archivo manifiesto JSON")
    parser.add_argument("--commit", action="store_true", help="Aplica la reversión en la BD")
    args = parser.parse_args()

    asyncio.run(revert_calibration(args.manifest, commit=args.commit))
