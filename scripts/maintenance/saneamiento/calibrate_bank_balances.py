"""
Script de Calibración Contable de Saldos Bancarios Oficiales (Cierre Septiembre 2026)
Ajusta los saldos de las 5 cuentas bancarias en 'bank_accounts' al saldo oficial exacto
de los extractos bancarios de Continental e Interfisa al 30 de septiembre de 2026,
marcando las cuentas como verificadas manualmente con trazabilidad completa.

Garantías:
1. Batch ID único por ejecución.
2. Manifiesto JSON en 'Datos/audit_logs/batch_calibrate_bank_balances_<batch_id>.json'.
3. Script complementario 'api/revert_calibrate_bank_balances.py'.
4. Regenera automáticamente el Flujo de Caja Proyectado a 30 días partiendo del saldo real verificado.
"""
import os
import sys
import json
import uuid
from datetime import datetime, timezone
from decimal import Decimal
import asyncio
from sqlalchemy import select
from api.src.db import async_session_factory
from api.src.financial.models import BankAccount
from api.src.financial.service import generate_projection

OFFICIAL_CLOSING_SEPT_2026 = {
    '382364779308': Decimal('4570880.00'),       # Continental Corriente
    '38250039706001': Decimal('8497854.00'),     # Continental Ahorro
    '38250039706208': Decimal('8772272.00'),     # Continental Ahorro PIX
    '259058910': Decimal('505978.00'),          # Interfisa Corriente
    '259026699': Decimal('31987135.00'),        # Interfisa Ahorro
}

def decimal_default(obj):
    if isinstance(obj, Decimal):
        return float(obj)
    if isinstance(obj, datetime):
        return obj.isoformat()
    raise TypeError(f"Type {type(obj)} not serializable")


async def calibrate_balances(commit: bool = False):
    batch_id = str(uuid.uuid4())
    now_utc = datetime.now(timezone.utc)
    now_iso = now_utc.isoformat()
    company_id = "00000000-0000-0000-0000-000000000010"

    datos_dir = "/home/intellihouse/intelimarket/Datos"
    if not os.path.exists(datos_dir):
        datos_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "Datos")

    log_dir = os.path.join(datos_dir, "audit_logs")
    os.makedirs(log_dir, exist_ok=True)
    manifest_file = os.path.join(log_dir, f"batch_calibrate_bank_balances_{batch_id}.json")

    print("="*80)
    print(f" CALIBRACIÓN CONTABLE DE SALDOS BANCARIOS [{'PRODUCCIÓN REAL' if commit else 'MODO SIMULACIÓN (DRY-RUN)'}]")
    print(f" Batch ID: {batch_id}")
    print(f" Manifiesto: {manifest_file}")
    print("="*80)

    async with async_session_factory() as session:
        res = await session.execute(select(BankAccount).where(BankAccount.activo == True))
        accounts = res.scalars().all()

        accounts_data = []
        for a in accounts:
            num = a.numero_cuenta
            oficial = OFFICIAL_CLOSING_SEPT_2026.get(num)
            if oficial is None:
                continue

            prev_saldo = a.saldo_actual or Decimal("0")
            delta = oficial - prev_saldo
            prev_verif = a.saldo_verificado_manualmente

            print(f"\n🏦 Cuenta {a.numero_cuenta} ({a.banco} - {a.tipo}):")
            print(f"   Saldo actual BD:      Gs. {prev_saldo:>14,.2f}")
            print(f"   Extracto Oficial:     Gs. {oficial:>14,.2f}")
            print(f"   Ajuste Contable:      Gs. {delta:>14,.2f}")

            a.saldo_actual = oficial
            a.saldo_verificado_manualmente = True
            a.saldo_verificado_at = now_utc
            session.add(a)

            accounts_data.append({
                "account_id": str(a.id),
                "numero_cuenta": num,
                "banco": a.banco,
                "tipo": a.tipo,
                "previous_saldo_actual": float(prev_saldo),
                "calibrated_saldo_actual": float(oficial),
                "delta": float(delta),
                "previous_saldo_verificado": prev_verif,
            })

        # Manifiesto
        manifest_data = {
            "batch_id": batch_id,
            "executed_at": now_iso,
            "company_id": company_id,
            "accounts": accounts_data,
        }

        with open(manifest_file, "w", encoding="utf-8") as mf:
            json.dump(manifest_data, mf, indent=2, default=decimal_default)

        # Regenerar flujo de caja proyectado
        if commit:
            await session.commit()
            print("\n💾 Confirmando calibración en base de datos (COMMIT)...")
            
            # Regenerar Cash Flow con los saldos oficiales
            print("🔄 Regenerando Cash Flow Projections a 30 días...")
            await generate_projection(session, company_id, dias=30)
            await session.commit()
            print("✅ ¡Calibración y proyecciones completadas exitosamente en producción!")
            print(f"ℹ️ Para revertir esta calibración:")
            print(f"   python api/revert_calibrate_bank_balances.py {manifest_file} --commit")
        else:
            await session.rollback()
            print("\n⚠️ Simulación finalizada sin cambios (rollback). Use --commit para aplicar.")


if __name__ == "__main__":
    do_commit = "--commit" in sys.argv
    asyncio.run(calibrate_balances(commit=do_commit))
