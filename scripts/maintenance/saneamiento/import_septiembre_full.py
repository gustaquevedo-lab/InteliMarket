"""
Script de Inserción Atómica y Deduplicada de Transacciones Bancarias — Septiembre 2026.
InteliMarket - Vertical Supermercado

Inserta exclusivamente las transacciones nuevas detectadas en los extractos de 'Datos/'
sin pisar ni duplicar registros existentes, generando un manifiesto atómico reversible con UUID.

Modo de uso:
- Simulación: PYTHONPATH=. .venv/bin/python api/import_septiembre_full.py
- Aplicar:    PYTHONPATH=. .venv/bin/python api/import_septiembre_full.py --commit
"""
import os
import re
import json
import uuid
import argparse
import openpyxl
from datetime import date, datetime
from decimal import Decimal
import asyncio
from sqlalchemy import select, and_
from api.src.db import async_session_factory
from api.src.financial.models import BankAccount, BankTransaction
from api.src.financial import statement_import


def normalizar_cuenta_tipo(acc: BankAccount) -> str:
    blob = f"{acc.titular or ''} {acc.numero_cuenta or ''} {acc.alias or ''} {acc.banco or ''}".upper()
    if "PIX" in blob or "PLUGPAY" in blob or (acc.numero_cuenta and "38250039706208" in acc.numero_cuenta):
        return "ahorro_pix"
    t = (acc.tipo or "").lower()
    if "ahorro" in t:
        return "ahorro"
    return "cuenta_corriente"


def make_tx_key(acc_id, t_fecha, t_tipo, t_monto, t_desc, t_ref):
    desc_clean = re.sub(r"\s+", " ", (t_desc or "").strip().upper())
    ref_clean = re.sub(r"\s+", " ", (t_ref or "").strip().upper())
    monto_val = Decimal(str(t_monto)).quantize(Decimal("1"))
    return (str(acc_id), str(t_fecha), str(t_tipo).lower(), monto_val, ref_clean, desc_clean)


async def run_import(datos_dir: str, commit: bool = False):
    batch_uuid = str(uuid.uuid4())
    print("=" * 85)
    print(f" 🚀 INSERCIÓN ATÓMICA DE EXTRACTOS BANCARIOS — SETIEMBRE 2026")
    print(f"    Batch UUID: {batch_uuid}")
    print(f"    Modo: {'APLICAR EN PRODUCCIÓN (--commit)' if commit else 'SIMULACIÓN SEGURA (DRY-RUN)'}")
    print("=" * 85)

    async with async_session_factory() as session:
        res_acc = await session.execute(select(BankAccount).where(BankAccount.activo == True))
        accounts = list(res_acc.scalars().all())

        account_map = {}
        for acc in accounts:
            tipo_norm = normalizar_cuenta_tipo(acc)
            banco_key = "CONTINENTAL" if "CONTINENTAL" in acc.banco.upper() else "INTERFISA"
            account_map[(banco_key, tipo_norm)] = acc

        statement_files = [
            ("CONTINENTAL", 9, 2026, os.path.join(datos_dir, "CONTINENTAL MES DE SEPTIEMBRE 2026.xlsx")),
            ("INTERFISA", 9, 2026, os.path.join(datos_dir, "INTERFISA MES DE SEPTIEMBRE 2026.xlsx")),
        ]

        inserted_ids = []
        breakdown_by_account = {}

        for banco_prefix, mes, anio, filepath in statement_files:
            if not os.path.exists(filepath):
                continue

            with open(filepath, "rb") as f:
                file_bytes = f.read()

            wb = openpyxl.load_workbook(filepath, data_only=True, read_only=True)
            for sheet_name in wb.sheetnames:
                tipo = statement_import._classify_sheet(sheet_name, sheet_name)
                if not tipo:
                    continue

                target_acc = account_map.get((banco_prefix, tipo))
                if not target_acc:
                    continue

                try:
                    parsed = statement_import.parse_statement(file_bytes, mes, anio, target_acc.banco, tipo)
                except Exception as e:
                    print(f"  ❌ Error parseando {sheet_name}: {e}")
                    continue

                txs = parsed["transacciones"]
                existing_res = await session.execute(
                    select(BankTransaction)
                    .where(
                        and_(
                            BankTransaction.bank_account_id == target_acc.id,
                            BankTransaction.fecha >= date(2026, 9, 1),
                            BankTransaction.fecha <= date(2026, 9, 30)
                        )
                    )
                )
                existing_txs = list(existing_res.scalars().all())
                existing_keys = {
                    make_tx_key(t.bank_account_id, t.fecha, t.tipo, t.monto, t.descripcion, t.referencia)
                    for t in existing_txs
                }

                new_tx_objects = []
                for t in txs:
                    key = make_tx_key(target_acc.id, t["fecha"], t["tipo"], t["monto"], t["descripcion"], t["referencia"])
                    if key not in existing_keys:
                        new_id = uuid.uuid4()
                        desc_str = (t["descripcion"] or "")[:300]
                        ref_str = (str(t["referencia"]) or "")[:100] if t["referencia"] is not None else None
                        
                        tx_obj = BankTransaction(
                            id=new_id,
                            company_id=target_acc.company_id,
                            bank_account_id=target_acc.id,
                            fecha=t["fecha"],
                            tipo=t["tipo"],
                            monto=t["monto"],
                            moneda="PYG",
                            descripcion=desc_str,
                            referencia=ref_str,
                            conciliado=False,
                            categoria="otros"
                        )
                        new_tx_objects.append(tx_obj)
                        inserted_ids.append(str(new_id))
                        # Actualizar existing_keys por si el extracto repite líneas idénticas en la misma hoja
                        existing_keys.add(key)

                acc_label = f"{target_acc.banco} ({target_acc.numero_cuenta})"
                breakdown_by_account[acc_label] = len(new_tx_objects)
                print(f"  📌 {acc_label} — Hoja [{sheet_name}]: {len(new_tx_objects)} transacciones nuevas preparadas.")

                if commit and new_tx_objects:
                    session.add_all(new_tx_objects)

        print("\n" + "-" * 85)
        print(f" 📊 TOTAL DE TRANSACCIONES NUEVAS A INCORPORAR: {len(inserted_ids)}")
        print("-" * 85)

        if not commit:
            print("\n[DRY-RUN] Simulación completa. No se insertó ningún registro.")
            print("Para aplicar los cambios en la base de datos, ejecute con: --commit")
            return

        # Aplicar commit
        await session.commit()
        print(f"✅ COMMIT APLICADO: Se insertaron exitosamente {len(inserted_ids)} transacciones en la base de datos.")

        # Guardar manifiesto de auditoría
        manifest_filename = f"batch_import_sept_full_{batch_uuid}.json"
        manifest_path = os.path.join(datos_dir, "audit_logs", manifest_filename)
        os.makedirs(os.path.dirname(manifest_path), exist_ok=True)

        manifest_data = {
            "batch_id": batch_uuid,
            "executed_at": datetime.now().isoformat(),
            "total_inserted": len(inserted_ids),
            "by_account": breakdown_by_account,
            "inserted_transaction_ids": inserted_ids,
            "revert_command": f"python api/revert_import_septiembre.py {manifest_path} --commit"
        }

        with open(manifest_path, "w", encoding="utf-8") as f:
            json.dump(manifest_data, f, indent=2, ensure_ascii=False)

        print(f"📁 Manifiesto atómico guardado en: {manifest_path}")
        print(f"🔄 Comando de reversión disponible: {manifest_data['revert_command']}")
        print("=" * 85)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Inserción atómica de transacciones de septiembre 2026.")
    parser.add_argument("--commit", action="store_true", help="Aplica la inserción en la base de datos")
    args = parser.parse_args()

    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    datos_dir = os.path.join(base_dir, "Datos")
    asyncio.run(run_import(datos_dir, commit=args.commit))
