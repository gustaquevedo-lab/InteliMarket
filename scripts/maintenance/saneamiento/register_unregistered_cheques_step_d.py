"""
Script de Incorporación de Cheques a Proveedores con Enlace a Proveedor 360 (Paso D)
Registra los 476 cheques del Libro Maestro 2026 que no estaban en la base de datos,
identificando a los proveedores correspondientes para alimentar los KPIs de Proveedor 360.

Garantías:
1. Mapea 'beneficiario' a 'supplier_id' usando diccionario de alias y similitud difusa.
2. Vincula los 419 cheques ya debitados en banco directamente a sus transacciones con estado 'cobrado'.
3. Registra los 30 cheques futuros con estado 'pendiente' y su fecha de vencimiento real para el Semáforo de Tesorería.
4. Genera manifiesto JSON en 'Datos/audit_logs/batch_register_unregistered_cheques_<batch_id>.json'.
5. Incluye script de reversión 'api/revert_register_unregistered_cheques_step_d.py'.
"""
import os
import sys
import json
import uuid
import re
import difflib
import openpyxl
from datetime import datetime, timezone, date
from decimal import Decimal
import asyncio
from sqlalchemy import select, text
from api.src.db import async_session_factory
from api.src.financial.models import BankAccount, BankTransaction
from api.src.cheques.models import Cheque, ChequeHistorial
from api.src.purchases.models import Supplier


def clean_name(s: str) -> str:
    if not s: return ''
    s = s.upper()
    for noise in ['S.A.C.E.I.', 'S.A.C.I.', 'S.A.', 'S.R.L.', 'E.A.S.', 'SOCIEDAD ANONIMA', 'SA', 'SRL', 'EAS', '.', ',', '-', '/', '(', ')', '"', "'", '1/3', '2/3', '3/3', '1/2', '2/2']:
        s = s.replace(noise, ' ')
    return re.sub(r'\s+', ' ', s).strip()


CUSTOM_ALIASES = {
    'PECHUGON': 'DISTRIBUIDORA SAN GABRIEL DEL PARAGUAY S.A.',
    'PECHUGÓN': 'DISTRIBUIDORA SAN GABRIEL DEL PARAGUAY S.A.',
    'SAN GABRIEL': 'DISTRIBUIDORA SAN GABRIEL DEL PARAGUAY S.A.',
    'CARNES MONGES': 'CARNE PEDRO JUAN CABALLERO',
    'CARNES AMAMBAY': 'DISTRIBUIDORA DE CARNE AMAMBAY',
    'SP PLASTICOS': 'PLASTICO SP MAYORISTA',
    'SP PLÁSTICOS': 'PLASTICO SP MAYORISTA',
    'PINGUINO': 'PINGUINO IMPORTADORA Y EXPORTADORA S.R.L.',
    'PINGÜINO': 'PINGUINO IMPORTADORA Y EXPORTADORA S.R.L.',
    'PAPA IVAR': 'PAPA IVAR COMPANY SRL',
    'VERDULERIA C Y G': 'VERDULERÍA C Y G ',
    'MOLINO DE ARROZ LA ESPANOLA': 'MOLINO DE ARROCEROS LA ESPAÑOLA S.A',
    'MO. ARROCEROS LA ESPANOLA': 'MOLINO DE ARROCEROS LA ESPAÑOLA S.A',
    'MO. DE ARROZ KRIS-TAL': 'MOLINOS DE ARROZ KRIS-TAL SRL',
    'DIST. SANTA MARIA': 'DISTRIBUIDORA SANTA MARIA E.A.S.',
    'SANTA MARIA EAS': 'DISTRIBUIDORA SANTA MARIA E.A.S.',
    'DIST. DANIELITO': 'DISTRIBUIDORA DANIELITO ',
    'PROVEEDORES DE CARNE PJC': 'PROVEEDOR DE CARNES PEDRO JUAN ',
    'PROVEEDOR DE CARNES PJC': 'PROVEEDOR DE CARNES PEDRO JUAN ',
    'DIST. FENIX': 'DISTRIBUIDORA FENIX ',
    'KUATIAPO': 'KUATIAPO S.A.',
    'EL TORO': 'DISTRIBUIDORA EL TORO',
    'REAL SUL': 'REAL SUL IND. COM. DE ALIMENTOS LTDA.',
    'AQUIDABAN': 'DIST. AQUIDABAN S.R.L.',
    'MONACO': 'MONACO IMPORT EXPORT  SRL',
}


def json_serial(obj):
    if isinstance(obj, (datetime, date)):
        return obj.isoformat()
    if isinstance(obj, Decimal):
        return float(obj)
    if isinstance(obj, uuid.UUID):
        return str(obj)
    raise TypeError(f"Type {type(obj)} not serializable")


async def run_step_d(commit: bool = False):
    batch_id = str(uuid.uuid4())
    now_utc = datetime.now(timezone.utc)
    now_iso = now_utc.isoformat()
    company_id = uuid.UUID("00000000-0000-0000-0000-000000000010")
    today = date(2026, 9, 24)

    datos_dir = "/home/intellihouse/intelimarket/Datos"
    if not os.path.exists(datos_dir):
        datos_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "Datos")

    log_dir = os.path.join(datos_dir, "audit_logs")
    os.makedirs(log_dir, exist_ok=True)
    manifest_file = os.path.join(log_dir, f"batch_register_unregistered_cheques_{batch_id}.json")

    print("="*80)
    print(f" PASO D: ALTA Y ENLACE DE CHEQUES A PROVEEDOR 360 [{'PRODUCCIÓN REAL' if commit else 'MODO SIMULACIÓN (DRY-RUN)'}]")
    print(f" Batch ID: {batch_id}")
    print(f" Manifiesto de auditoría: {manifest_file}")
    print("="*80)

    # 1. Leer Excel
    wb = openpyxl.load_workbook(os.path.join(datos_dir, "CHEQUES A PLAZO EXTRA PARAGUAY.xlsx"), data_only=True)
    ws = wb['26']
    excel_cheques = []
    for r in ws.iter_rows(values_only=True):
        if len(r) > 8 and isinstance(r[3], (int, float)) and r[3] > 1000:
            num = str(int(r[3]))
            banco = str(r[4]).strip().upper() if r[4] else 'CONTINENTAL'
            femision = r[5].date() if isinstance(r[5], datetime) else (r[5] if isinstance(r[5], date) else None)
            fvenc = r[6].date() if isinstance(r[6], datetime) else (r[6] if isinstance(r[6], date) else None)
            beneficiario = str(r[7]).strip() if r[7] else ''
            monto = None
            for val in r[8:]:
                if isinstance(val, (int, float)) and val > 0:
                    monto = Decimal(str(int(val)))
                    break
            if monto:
                excel_cheques.append({
                    'numero': num, 'banco': banco, 'emision': femision,
                    'vencimiento': fvenc, 'beneficiario': beneficiario, 'monto': monto
                })

    async with async_session_factory() as session:
        # 2. Cargar proveedores y armar índice
        res_sup = await session.execute(select(Supplier.id, Supplier.razon_social, Supplier.nombre_fantasia))
        suppliers = res_sup.all()
        sup_by_clean = {}
        for s in suppliers:
            c_rz = clean_name(s[1])
            sup_by_clean[c_rz] = (s[0], s[1])
            if s[2]:
                c_nf = clean_name(s[2])
                sup_by_clean[c_nf] = (s[0], s[1])

        # 3. Cargar cuentas bancarias
        res_acc = await session.execute(select(BankAccount))
        accounts = list(res_acc.scalars().all())
        acc_continental_cte = next((a for a in accounts if "CONTINENTAL" in a.banco.upper() and "corriente" in a.tipo.lower()), None)
        acc_interfisa_cte = next((a for a in accounts if "INTERFISA" in a.banco.upper() and "corriente" in a.tipo.lower()), None)

        # 4. Cargar cheques ya existentes en BD
        res_ch_exist = await session.execute(select(Cheque.numero).where(Cheque.numero_confiable == True))
        already_in_db = {r[0] for r in res_ch_exist.fetchall()}

        # 5. Cargar transacciones bancarias para cruce inmediato
        res_tx = await session.execute(select(BankTransaction).where(BankTransaction.referencia.is_not(None)))
        txs_by_ref = {}
        for tx in res_tx.scalars().all():
            txs_by_ref[str(tx.referencia).strip()] = tx

        # 6. Procesar los que no están en BD
        not_in_db = [c for c in excel_cheques if c['numero'] not in already_in_db]
        print(f"📄 Cheques válidos a incorporar: {len(not_in_db)}")

        all_inserted_cheque_ids = []
        registered_records = []
        count_cobrados = 0
        count_futuros = 0
        count_vencidos_historicos = 0
        count_mapped_suppliers = 0

        for c in not_in_db:
            ch_id = uuid.uuid4()
            b = c['beneficiario']
            cb = clean_name(b)

            # Resolver supplier_id
            matched_sup_id = None
            matched_sup_name = None

            # 1. Alias
            target_alias = None
            for k, v in CUSTOM_ALIASES.items():
                if k in cb:
                    target_alias = clean_name(v)
                    break

            if target_alias and target_alias in sup_by_clean:
                matched_sup_id, matched_sup_name = sup_by_clean[target_alias]
            elif cb in sup_by_clean:
                matched_sup_id, matched_sup_name = sup_by_clean[cb]
            else:
                best_s = None
                best_score = 0.0
                for s_clean, (sid, srz) in sup_by_clean.items():
                    if s_clean and (cb in s_clean or s_clean in cb or difflib.SequenceMatcher(None, cb, s_clean).ratio() >= 0.75):
                        best_s = (sid, srz)
                        best_score = 0.8
                        break
                if best_s:
                    matched_sup_id, matched_sup_name = best_s

            if matched_sup_id:
                count_mapped_suppliers += 1

            # Determinar cuenta bancaria
            banco_emisor = "BANCO CONTINENTAL" if "CONTINENTAL" in c['banco'] else ("BANCO INTERFISA" if "INTERFISA" in c['banco'] else c['banco'])
            target_account = acc_continental_cte if "CONTINENTAL" in banco_emisor else acc_interfisa_cte
            bank_account_id = target_account.id if target_account else None

            # Determinar estado
            tx_match = txs_by_ref.get(c['numero'])
            if tx_match and tx_match.tipo in ('credito', 'debito'):
                estado = "cobrado"
                fecha_pago = tx_match.fecha
                tx_match.conciliado = True
                tx_match.fecha_conciliacion = now_utc
                tx_match.cheque_id = ch_id
                session.add(tx_match)
                count_cobrados += 1
                tipo_categoria = "cobrado_banco"
            elif c['vencimiento'] and c['vencimiento'] < today:
                estado = "pendiente"
                fecha_pago = c['vencimiento']
                count_vencidos_historicos += 1
                tipo_categoria = "vencido_historico"
            else:
                estado = "pendiente"
                fecha_pago = c['vencimiento'] or c['emision']
                count_futuros += 1
                tipo_categoria = "futuro_por_vencer"

            new_cheque = Cheque(
                id=ch_id,
                company_id=company_id,
                numero=c['numero'],
                numero_confiable=True,
                banco_emisor=banco_emisor,
                bank_account_id=bank_account_id,
                beneficiario=c['beneficiario'],
                supplier_id=matched_sup_id,
                monto=c['monto'],
                moneda="PYG",
                fecha_emision=c['emision'] or c['vencimiento'] or today,
                fecha_pago=fecha_pago,
                diferido=True,
                estado=estado,
                concepto=f"Cheque a plazo Libro Maestro 2026 ({tipo_categoria})",
                notas=f"Alta Paso D. Proveedor: {matched_sup_name or 'Sin Vincular'}. Categoría: {tipo_categoria}.",
                created_at=now_utc,
            )
            session.add(new_cheque)

            hist = ChequeHistorial(
                cheque_id=ch_id,
                estado_anterior=None,
                estado_nuevo=estado,
                user_id=None,
                user_nombre="Sistema (Paso D - Alta con Proveedor 360)",
                notas=f"Cheque Nº {c['numero']} registrado con proveedor {matched_sup_name or c['beneficiario']} ({tipo_categoria}).",
                created_at=now_utc,
            )
            session.add(hist)

            all_inserted_cheque_ids.append(str(ch_id))
            registered_records.append({
                "cheque_id": str(ch_id),
                "numero": c['numero'],
                "monto": float(c['monto']),
                "beneficiario": c['beneficiario'],
                "supplier_id": str(matched_sup_id) if matched_sup_id else None,
                "supplier_name": matched_sup_name,
                "estado": estado,
                "fecha_emision": c['emision'].isoformat() if c['emision'] else None,
                "fecha_vencimiento": c['vencimiento'].isoformat() if c['vencimiento'] else None,
                "fecha_pago": fecha_pago.isoformat() if fecha_pago else None,
                "categoria": tipo_categoria,
            })

        # Manifiesto
        manifest_data = {
            "batch_id": batch_id,
            "executed_at": now_iso,
            "total_inserted": len(all_inserted_cheque_ids),
            "mapped_suppliers_count": count_mapped_suppliers,
            "count_cobrados": count_cobrados,
            "count_futuros": count_futuros,
            "count_vencidos_historicos": count_vencidos_historicos,
            "all_inserted_cheque_ids": all_inserted_cheque_ids,
            "records": registered_records,
        }

        with open(manifest_file, "w", encoding="utf-8") as mf:
            json.dump(manifest_data, mf, indent=2, default=json_serial)

        print("\n" + "="*80)
        print(" RESUMEN DEL PASO D:")
        print("="*80)
        print(f" 📥 Total Cheques Incorporados: {len(all_inserted_cheque_ids)}")
        print(f" 🤝 Proveedores Vinculados con éxito: {count_mapped_suppliers} ({count_mapped_suppliers/len(all_inserted_cheque_ids)*100:.1f}%)")
        print(f" 🏦 Cobrados en banco (conciliados de inmediato): {count_cobrados}")
        print(f" ⏳ Futuros / Por Vencer (Compromisos vivos de Tesorería): {count_futuros}")
        print(f" ⚠️ Vencidos Históricos: {count_vencidos_historicos}")
        print(f" 📄 Manifiesto persistido en: {manifest_file}")

        if commit:
            print("\n💾 Confirmando cambios en la base de datos (COMMIT)...")
            await session.commit()
            print("✅ ¡Paso D completado exitosamente en producción!")
            print(f"ℹ️ Para revertir esta carga:")
            print(f"   python api/revert_register_unregistered_cheques_step_d.py {manifest_file} --commit")
        else:
            print("\n⚠️ Modo simulación: Se hizo rollback, la base de datos NO fue modificada.")
            await session.rollback()


if __name__ == "__main__":
    do_commit = "--commit" in sys.argv
    asyncio.run(run_step_d(commit=do_commit))
