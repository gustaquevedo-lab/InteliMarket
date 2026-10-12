"""
Script de Calibración Oficial de Saldos Bancarios al 30/09/2026.
InteliMarket - Vertical Supermercado

Alinea los saldos maestros de las 5 cuentas bancarias en la tabla 'bank_accounts'
a sus balances de cierre certificados según los extractos oficiales al 30 de septiembre de 2026.

Saldos Oficiales de Cierre al 30/09/2026:
- Banco Continental Cta. Corriente (382364779308):  Gs. 50.816.460
- Banco Continental Ahorro Dinelco (38250039706001): Gs.  1.674.199
- Banco Continental Ahorro PlugPay (38250039706208): Gs.  4.736.671
- Banco Interfisa Cta. Corriente (259058910):       Gs.  9.140.355
- Banco Interfisa Caja de Ahorro (259026699):       Gs.  7.506.319
---------------------------------------------------------------------
TOTAL DISPONIBLE EN BANCOS AL 30/09/2026:          Gs. 73.874.004

Modo de uso:
- Simulación: PYTHONPATH=. .venv/bin/python api/calibrate_bank_balances_sept_full.py
- Aplicar:    PYTHONPATH=. .venv/bin/python api/calibrate_bank_balances_sept_full.py --commit
"""
import os
import sys
import json
import uuid
import argparse
from datetime import datetime, timezone
from decimal import Decimal
import asyncio
from sqlalchemy import select
from api.src.db import async_session_factory
from api.src.financial.models import BankAccount


OFFICIAL_CLOSING_BALANCES = {
    "382364779308": Decimal("50816460"),   # Continental Cte
    "38250039706001": Decimal("1674199"),  # Continental Dinelco (Ahorro)
    "38250039706208": Decimal("4736671"),  # Continental PlugPay (Ahorro PIX)
    "259058910": Decimal("9140355"),       # Interfisa Cte
    "259026699": Decimal("7506319"),       # Interfisa Ahorro
}


async def calibrate_balances(commit: bool = False):
    batch_id = str(uuid.uuid4())
    now_utc = datetime.now(timezone.utc)
    now_iso = now_utc.isoformat()

    datos_dir = "/home/intellihouse/intelimarket/Datos"
    if not os.path.exists(datos_dir):
        datos_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "Datos")

    log_dir = os.path.join(datos_dir, "audit_logs")
    os.makedirs(log_dir, exist_ok=True)
    manifest_file = os.path.join(log_dir, f"batch_calibrate_bank_balances_{batch_id}.json")

    print("=" * 85)
    print(f" ⚖️ CALIBRACIÓN OFICIAL DE SALDOS BANCARIOS AL 30/09/2026")
    print(f"    Batch UUID: {batch_id}")
    print(f"    Modo: {'APLICAR EN PRODUCCIÓN (--commit)' if commit else 'SIMULACIÓN SEGURA (DRY-RUN)'}")
    print("=" * 85)

    async with async_session_factory() as session:
        accounts_manifest = []
        tot_prev = Decimal("0")
        tot_calibrated = Decimal("0")

        for num_cuenta, target_saldo in OFFICIAL_CLOSING_BALANCES.items():
            res = await session.execute(select(BankAccount).where(BankAccount.numero_cuenta == num_cuenta))
            acc = res.scalar_one_or_none()
            if not acc:
                print(f"⚠️ No se encontró la cuenta con número: {num_cuenta}")
                continue

            prev_saldo = acc.saldo_actual
            delta = target_saldo - prev_saldo
            tot_prev += prev_saldo
            tot_calibrated += target_saldo

            print(f"🏦 {acc.banco} ({acc.numero_cuenta}) [{acc.tipo}]:")
            print(f"   • Saldo Actual en BD:  Gs. {prev_saldo:,.0f}")
            print(f"   • Saldo Cierre Oficial: Gs. {target_saldo:,.0f}")
            print(f"   • Ajuste Contable:      Gs. {delta:,.0f}")

            accounts_manifest.append({
                "account_id": str(acc.id),
                "numero_cuenta": acc.numero_cuenta,
                "banco": acc.banco,
                "tipo": acc.tipo,
                "previous_saldo_actual": float(prev_saldo),
                "calibrated_saldo_actual": float(target_saldo),
                "delta": float(delta),
                "previous_saldo_verificado": bool(acc.saldo_verificado_manualmente),
            })

            if commit:
                acc.saldo_actual = target_saldo
                acc.saldo_verificado_manualmente = True
                acc.saldo_verificado_at = now_utc
                session.add(acc)

        print("\n" + "-" * 85)
        print(f" 📊 RESUMEN LÍQUIDO DISPONIBLE EN BANCOS AL 30/09/2026:")
        print(f"    - Saldo Anterior Consolidado: Gs. {tot_prev:,.0f}")
        print(f"    - Saldo Calibrado Oficial:    Gs. {tot_calibrated:,.0f}")
        print(f"    - Ajuste Neto Contable:       Gs. {(tot_calibrated - tot_prev):,.0f}")
        print("-" * 85)

        if not commit:
            print("\n[DRY-RUN] Simulación completa. No se modificó ningún registro.")
            print("Para aplicar los cambios en la base de datos, ejecute con: --commit")
            return

        await session.commit()
        print("✅ COMMIT APLICADO: Cuentas calibradas con éxito a sus saldos oficiales al 30/09/2026.")

        manifest_data = {
            "batch_id": batch_id,
            "executed_at": now_iso,
            "company_id": "00000000-0000-0000-0000-000000000010",
            "total_previo": float(tot_prev),
            "total_calibrado": float(tot_calibrated),
            "accounts": accounts_manifest,
            "revert_command": f"python api/revert_calibrate_bank_balances_sept_full.py {manifest_file} --commit"
        }

        with open(manifest_file, "w", encoding="utf-8") as f:
            json.dump(manifest_data, f, indent=2, ensure_ascii=False)

        print(f"📁 Manifiesto guardado en: {manifest_file}")
        print(f"🔄 Comando de reversión disponible: {manifest_data['revert_command']}")
        print("=" * 85)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Calibración oficial de saldos bancarios al 30/09/2026.")
    parser.add_argument("--commit", action="store_true", help="Aplica la calibración en la BD")
    args = parser.parse_args()

    asyncio.run(calibrate_balances(commit=args.commit))
