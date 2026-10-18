"""
Script de Importación Trazable y Reversible de Extractos Bancarios (Paso B)
Incorpora las transacciones bancarias de Agosto y Septiembre 2026 de Banco Continental
e Interfisa con idempotencia, trazabilidad de auditoría y capacidad de reversión instantánea.

Medidas de seguridad financiera:
1. Genera un Batch ID único por ejecución.
2. Guarda un manifiesto JSON en 'Datos/audit_logs/batch_<batch_id>.json' con cada UUID insertado.
3. Descarta automáticamente transacciones duplicadas (idempotente).
4. Registra los saldos antes y después de cada cuenta.
5. Incluye script complementario 'api/revert_bank_import_step_b.py' para rollback quirúrgico 100% confiable.
"""
import os
import sys
import json
import uuid
import openpyxl
from datetime import datetime, timezone
from decimal import Decimal
import asyncio
from sqlalchemy import select, text
from api.src.db import async_session_factory
from api.src.financial.models import BankAccount, BankTransaction
from api.src.financial import statement_import


def decimal_default(obj):
    if isinstance(obj, Decimal):
        return float(obj)
    if isinstance(obj, (datetime,)):
        return obj.isoformat()
    raise TypeError(f"Object of type {type(obj)} is not JSON serializable")


async def run_import_step_b(commit: bool = False):
    batch_id = str(uuid.uuid4())
    now_iso = datetime.now(timezone.utc).isoformat()
    company_id = "00000000-0000-0000-0000-000000000010"

    datos_dir = "/home/intellihouse/intelimarket/Datos"
    if not os.path.exists(datos_dir):
        datos_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "Datos")

    log_dir = os.path.join(datos_dir, "audit_logs")
    os.makedirs(log_dir, exist_ok=True)
    manifest_file = os.path.join(log_dir, f"batch_step_b_{batch_id}.json")

    print("="*80)
    print(f" PASO B: IMPORTACIÓN DE EXTRACTOS BANCARIOS [{'PRODUCCIÓN REAL' if commit else 'MODO SIMULACIÓN (DRY-RUN)'}]")
    print(f" Batch ID: {batch_id}")
    print(f" Manifiesto de auditoría: {manifest_file}")
    print("="*80)

    # Cuentas bancarias a procesar en orden
    statement_jobs = [
        # (Banco, Mes, Año, Archivo)
        ("CONTINENTAL", 8, 2026, os.path.join(datos_dir, "CONTINENTAL MES DE AGOSTO 2026.xlsx")),
        ("INTERFISA", 8, 2026, os.path.join(datos_dir, "INTERFISA MES DE AGOSTO 2026.xlsx")),
        ("CONTINENTAL", 9, 2026, os.path.join(datos_dir, "CONTINENTAL MES DE SEPTIEMBRE 2026.xlsx")),
        ("INTERFISA", 9, 2026, os.path.join(datos_dir, "INTERFISA MES DE SEPTIEMBRE 2026.xlsx")),
    ]

    async with async_session_factory() as session:
        # Cargar cuentas bancarias
        res_acc = await session.execute(select(BankAccount))
        accounts = list(res_acc.scalars().all())
        acc_map = {}
        for a in accounts:
            tipo_norm = statement_import.account_tipo_normalizado(a.tipo, a.titular, a.numero_cuenta)
            acc_map[(a.banco.upper(), tipo_norm)] = a

        # Snapshot inicial de saldos para el manifiesto
        accounts_audit = {}
        for a in accounts:
            accounts_audit[a.id] = {
                "account_id": str(a.id),
                "numero_cuenta": a.numero_cuenta,
                "banco": a.banco,
                "tipo": a.tipo,
                "initial_saldo_actual": float(a.saldo_actual or 0),
                "initial_saldo_verificado": bool(a.saldo_verificado_manualmente),
                "inserted_ids": [],
                "count_inserted": 0,
                "count_skipped": 0,
                "sum_debitos": Decimal("0"),
                "sum_creditos": Decimal("0"),
                "final_saldo_actual": float(a.saldo_actual or 0),
            }

        all_inserted_ids = []
        total_nuevas_global = 0
        total_duplicadas_global = 0

        for banco_prefix, mes, anio, filepath in statement_jobs:
            if not os.path.exists(filepath):
                print(f"⚠️ Archivo no encontrado: {filepath}")
                continue

            print(f"\n📂 Procesando archivo: {os.path.basename(filepath)} ({mes}/{anio})")
            with open(filepath, "rb") as f:
                file_bytes = f.read()

            wb = openpyxl.load_workbook(filepath, data_only=True, read_only=True)
            for sheet_name in wb.sheetnames:
                tipo = statement_import._classify_sheet(sheet_name, sheet_name)
                if not tipo:
                    continue

                target_acc = None
                for (b_name, a_tipo), acc in acc_map.items():
                    if banco_prefix in b_name and a_tipo == tipo:
                        target_acc = acc
                        break

                if not target_acc:
                    print(f"  - Hoja [{sheet_name}] ({tipo}): ⚠️ No se encontró BankAccount para {banco_prefix} - {tipo}")
                    continue

                try:
                    parsed = statement_import.parse_statement(file_bytes, mes, anio, target_acc.banco, tipo)
                except Exception as e:
                    print(f"  - Hoja [{sheet_name}]: Error al parsear: {e}")
                    continue

                txs = parsed["transacciones"]
                if not txs:
                    print(f"  - Hoja [{sheet_name}] -> Cuenta {target_acc.numero_cuenta} ({target_acc.banco} - {tipo}): 0 transacciones.")
                    continue

                # Cargar transacciones ya existentes para no duplicar
                existing = await session.execute(
                    select(BankTransaction.fecha, BankTransaction.tipo, BankTransaction.monto, BankTransaction.descripcion, BankTransaction.referencia)
                    .where(BankTransaction.bank_account_id == target_acc.id)
                )
                existing_keys = {(row.fecha, row.tipo, row.monto, row.descripcion or "", row.referencia or "") for row in existing.all()}

                nuevas_hoja = 0
                duplicadas_hoja = 0
                acc_stat = accounts_audit[target_acc.id]

                for t in txs:
                    key = (t["fecha"], t["tipo"], t["monto"], t["descripcion"] or "", t["referencia"] or "")
                    if key in existing_keys:
                        duplicadas_hoja += 1
                        acc_stat["count_skipped"] += 1
                        continue

                    tx_id = uuid.uuid4()
                    new_tx = BankTransaction(
                        id=tx_id,
                        company_id=uuid.UUID(company_id),
                        bank_account_id=target_acc.id,
                        fecha=t["fecha"],
                        tipo=t["tipo"],
                        monto=t["monto"],
                        moneda=target_acc.moneda or "PYG",
                        descripcion=t["descripcion"],
                        referencia=t["referencia"],
                        categoria="otros",
                        conciliado=False,
                    )
                    session.add(new_tx)

                    # Trazabilidad
                    tx_id_str = str(tx_id)
                    all_inserted_ids.append(tx_id_str)
                    acc_stat["inserted_ids"].append(tx_id_str)
                    acc_stat["count_inserted"] += 1
                    existing_keys.add(key)

                    # Impacto en saldo
                    if t["tipo"] == "credito":
                        acc_stat["sum_creditos"] += t["monto"]
                        target_acc.saldo_actual = (target_acc.saldo_actual or Decimal("0")) + t["monto"]
                    else:
                        acc_stat["sum_debitos"] += t["monto"]
                        target_acc.saldo_actual = (target_acc.saldo_actual or Decimal("0")) - t["monto"]

                    nuevas_hoja += 1

                total_nuevas_global += nuevas_hoja
                total_duplicadas_global += duplicadas_hoja

                if nuevas_hoja > 0:
                    target_acc.saldo_verificado_manualmente = False
                    session.add(target_acc)

                acc_stat["final_saldo_actual"] = float(target_acc.saldo_actual or 0)
                print(f"  - Hoja [{sheet_name}] -> Cuenta {target_acc.numero_cuenta} ({target_acc.banco} - {target_acc.tipo}):")
                print(f"      Nuevas insertadas: {nuevas_hoja} | Omitidas (ya existían): {duplicadas_hoja} | Saldo acumulado: Gs. {target_acc.saldo_actual:,.2f}")

        # Guardar manifiesto de auditoría
        manifest_data = {
            "batch_id": batch_id,
            "executed_at": now_iso,
            "company_id": company_id,
            "total_inserted": len(all_inserted_ids),
            "total_skipped": total_duplicadas_global,
            "all_inserted_ids": all_inserted_ids,
            "accounts_summary": list(accounts_audit.values()),
        }

        with open(manifest_file, "w", encoding="utf-8") as mf:
            json.dump(manifest_data, mf, indent=2, default=decimal_default)

        print("\n" + "="*80)
        print(" RESUMEN GENERAL DEL PASO B:")
        print("="*80)
        print(f" 📦 Total transacciones bancarias nuevas: {total_nuevas_global}")
        print(f" ⏭️ Total transacciones omitidas por duplicación: {total_duplicadas_global}")
        print(f" 📄 Manifiesto persistido en: {manifest_file}")

        for acc_id, st in accounts_audit.items():
            if st["count_inserted"] > 0:
                print(f"\n 🏦 Cuenta {st['numero_cuenta']} ({st['banco']} - {st['tipo']}):")
                print(f"    - Movimientos agregados: {st['count_inserted']} (Débitos: Gs. {st['sum_debitos']:,.0f} | Créditos: Gs. {st['sum_creditos']:,.0f})")
                print(f"    - Saldo Anterior: Gs. {st['initial_saldo_actual']:,.2f} -> Saldo Nuevo: Gs. {st['final_saldo_actual']:,.2f}")

        if commit:
            print("\n💾 Confirmando cambios en la base de datos (COMMIT)...")
            await session.commit()
            print("✅ ¡Éxito! Importación Paso B completada y registrada.")
            print(f"ℹ️ En caso de requerir reversión completa, ejecute:")
            print(f"   python api/revert_bank_import_step_b.py {manifest_file} --commit")
        else:
            print("\n⚠️ Modo simulación: Se hizo rollback, la base de datos NO fue modificada.")
            await session.rollback()
            print(f"ℹ️ Manifiesto de simulación generado para inspección en: {manifest_file}")


if __name__ == "__main__":
    do_commit = "--commit" in sys.argv
    asyncio.run(run_import_step_b(commit=do_commit))
