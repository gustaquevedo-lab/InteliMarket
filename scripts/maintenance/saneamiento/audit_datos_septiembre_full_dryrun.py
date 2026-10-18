"""
Script de Auditoría y Diagnóstico Dry-Run 100% Solo Lectura — Septiembre 2026 Completo.
Contrasta los archivos de extractos bancarios de 'Datos/' (Continental e Interfisa)
y el libro de cheques a plazo contra la base de datos de InteliMarket.
No realiza NINGUNA inserción, modificación ni eliminación en la base de datos.
"""
import os
import re
import json
import difflib
import openpyxl
from datetime import date, datetime
from decimal import Decimal
import asyncio
from sqlalchemy import select, func, and_
from api.src.db import async_session_factory
from api.src.financial.models import BankAccount, BankTransaction
from api.src.financial import statement_import
from api.src.cheques.models import Cheque


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


async def run_dryrun(datos_dir: str):
    print("=" * 85)
    print(" 🔍 INFORME DE DIAGNÓSTICO DRY-RUN (SOLO LECTURA) — SETIEMBRE 2026 COMPLETO")
    print("    Extra Supermercado Mayorista — Grupo Santa Teresa E.A.S.")
    print("=" * 85)

    async with async_session_factory() as session:
        # 1. Obtener cuentas bancarias de la BD
        res_acc = await session.execute(select(BankAccount).where(BankAccount.activo == True))
        accounts = list(res_acc.scalars().all())

        account_map = {}
        for acc in accounts:
            tipo_norm = normalizar_cuenta_tipo(acc)
            banco_key = "CONTINENTAL" if "CONTINENTAL" in acc.banco.upper() else "INTERFISA"
            account_map[(banco_key, tipo_norm)] = acc
            print(f"🏦 Cuenta BD: {acc.banco} | Cta: {acc.numero_cuenta} | Tipo: {acc.tipo} ({tipo_norm}) | Saldo Actual: Gs. {acc.saldo_actual:,.0f}")

        statement_files = [
            ("CONTINENTAL", 9, 2026, os.path.join(datos_dir, "CONTINENTAL MES DE SEPTIEMBRE 2026.xlsx")),
            ("INTERFISA", 9, 2026, os.path.join(datos_dir, "INTERFISA MES DE SEPTIEMBRE 2026.xlsx")),
        ]

        total_en_excel_global = 0
        total_en_bd_global = 0
        total_nuevas_global = 0
        cuentas_reporte = []

        print("\n" + "-" * 85)
        print(" 1. ANÁLISIS DE EXTRACTOS BANCARIOS (EXCEL VS BASE DE DATOS)")
        print("-" * 85)

        for banco_prefix, mes, anio, filepath in statement_files:
            if not os.path.exists(filepath):
                print(f"⚠️ Archivo no encontrado: {filepath}")
                continue

            print(f"\n📂 Analizando archivo: {os.path.basename(filepath)} ({mes}/{anio})")
            with open(filepath, "rb") as f:
                file_bytes = f.read()

            wb = openpyxl.load_workbook(filepath, data_only=True, read_only=True)
            for sheet_name in wb.sheetnames:
                tipo = statement_import._classify_sheet(sheet_name, sheet_name)
                if not tipo:
                    continue

                target_acc = account_map.get((banco_prefix, tipo))
                if not target_acc:
                    print(f"  - Hoja [{sheet_name}] ({tipo}): ⚠️ No se encontró BankAccount para {banco_prefix} - {tipo}")
                    continue

                try:
                    parsed = statement_import.parse_statement(file_bytes, mes, anio, target_acc.banco, tipo)
                except Exception as e:
                    print(f"  - Hoja [{sheet_name}]: Error al parsear: {e}")
                    continue

                txs = parsed["transacciones"]
                saldo_ant = parsed.get("saldo_anterior")
                saldo_cierre = parsed.get("saldo_cierre")

                # Obtener movimientos existentes en BD para esa cuenta en septiembre 2026
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

                nuevas = []
                duplicadas = 0
                monto_debito_nuevas = Decimal("0")
                monto_credito_nuevas = Decimal("0")

                for t in txs:
                    key = make_tx_key(target_acc.id, t["fecha"], t["tipo"], t["monto"], t["descripcion"], t["referencia"])
                    if key in existing_keys:
                        duplicadas += 1
                    else:
                        nuevas.append(t)
                        if t["tipo"] == "debito":
                            monto_debito_nuevas += t["monto"]
                        else:
                            monto_credito_nuevas += t["monto"]

                total_en_excel_global += len(txs)
                total_en_bd_global += duplicadas
                total_nuevas_global += len(nuevas)

                ajuste_saldo = (Decimal(str(saldo_cierre)) if saldo_cierre is not None else Decimal("0")) - target_acc.saldo_actual

                cuenta_info = {
                    "banco": target_acc.banco,
                    "numero_cuenta": target_acc.numero_cuenta,
                    "tipo": target_acc.tipo,
                    "hoja": sheet_name,
                    "total_excel": len(txs),
                    "en_bd": duplicadas,
                    "nuevas": len(nuevas),
                    "debito_nuevas": float(monto_debito_nuevas),
                    "credito_nuevas": float(monto_credito_nuevas),
                    "saldo_anterior_excel": float(saldo_ant) if saldo_ant is not None else None,
                    "saldo_cierre_excel": float(saldo_cierre) if saldo_cierre is not None else None,
                    "saldo_actual_bd": float(target_acc.saldo_actual),
                    "ajuste_contable": float(ajuste_saldo),
                }
                cuentas_reporte.append(cuenta_info)

                saldo_cierre_str = f"Gs. {saldo_cierre:,.0f}" if saldo_cierre is not None else "No detectado en fila totales"
                print(f"  📌 {target_acc.banco} ({target_acc.numero_cuenta}) — Hoja [{sheet_name}]:")
                print(f"      • Total en Excel: {len(txs)} txs | Ya en BD: {duplicadas} | NUEVAS a incorporar: {len(nuevas)}")
                if len(nuevas) > 0:
                    fechas_nuevas = sorted(list({t['fecha'].strftime('%d/%m') for t in nuevas}))
                    print(f"      • Rango fechas nuevas: {fechas_nuevas[0]} a {fechas_nuevas[-1]} ({len(fechas_nuevas)} días)")
                    print(f"      • Volumen nuevo: Débitos: Gs. {monto_debito_nuevas:,.0f} | Créditos: Gs. {monto_credito_nuevas:,.0f}")
                print(f"      • Saldo Cierre en Extracto (30/09): {saldo_cierre_str} | Saldo Actual en BD: Gs. {target_acc.saldo_actual:,.0f}")
                print(f"      • Ajuste requerido de calibración: Gs. {ajuste_saldo:,.0f}")

        print("\n" + "=" * 85)
        print(f" 📊 BALANCE GENERAL EXTRACTOS:")
        print(f"    - Total transacciones analizadas en Excel: {total_en_excel_global:,}")
        print(f"    - Ya registradas y verificadas en BD:     {total_en_bd_global:,}")
        print(f"    - PENDIENTES DE INCORPORAR (Nuevas):       {total_nuevas_global:,}")
        print("=" * 85)

        # 2. Análisis del Libro Maestro de Cheques
        print("\n" + "-" * 85)
        print(" 2. CRUCE CON LIBRO MAESTRO DE CHEQUES A PLAZO 2026")
        print("-" * 85)
        cheques_file = os.path.join(datos_dir, "CHEQUES A PLAZO EXTRA PARAGUAY.xlsx")
        if os.path.exists(cheques_file):
            wb_ch = openpyxl.load_workbook(cheques_file, data_only=True)
            ws_ch = wb_ch["26"]
            ch_excel = []
            for row_idx, r in enumerate(ws_ch.iter_rows(values_only=True), start=1):
                if len(r) > 8 and isinstance(r[3], (int, float)) and r[3] > 1000:
                    num = str(int(r[3]))
                    banco = str(r[4]).strip().upper() if r[4] else "CONTINENTAL"
                    femision = r[5].date() if isinstance(r[5], datetime) else (r[5] if isinstance(r[5], date) else None)
                    fvenc = r[6].date() if isinstance(r[6], datetime) else (r[6] if isinstance(r[6], date) else None)
                    beneficiario = str(r[7]).strip() if r[7] else ""
                    monto = None
                    for val in r[8:]:
                        if isinstance(val, (int, float)) and val > 0:
                            monto = Decimal(str(int(val)))
                            break
                    if monto:
                        ch_excel.append({
                            "numero": num,
                            "banco": banco,
                            "emision": femision,
                            "vencimiento": fvenc,
                            "beneficiario": beneficiario,
                            "monto": monto
                        })
            
            print(f"  📄 Cheques leídos en Libro Maestro 2026: {len(ch_excel)} cheques por Gs. {sum(c['monto'] for c in ch_excel):,.0f}")

            # Cheques en BD
            res_ch_db = await session.execute(select(Cheque))
            db_cheques = list(res_ch_db.scalars().all())
            print(f"  🗄️ Cheques totales en BD: {len(db_cheques)} (Con número real: {len([c for c in db_cheques if c.numero_confiable])})")
        else:
            print("  ⚠️ Archivo CHEQUES A PLAZO no encontrado.")

        # Guardar reporte JSON
        out_json_path = os.path.join(datos_dir, "audit_logs", "dryrun_report_septiembre_full.json")
        os.makedirs(os.path.dirname(out_json_path), exist_ok=True)
        with open(out_json_path, "w", encoding="utf-8") as f:
            json.dump({
                "timestamp": datetime.now().isoformat(),
                "total_excel": total_en_excel_global,
                "total_en_bd": total_en_bd_global,
                "total_nuevas": total_nuevas_global,
                "cuentas": cuentas_reporte
            }, f, indent=2, ensure_ascii=False)
        print(f"\n💾 Reporte estructurado guardado en: {out_json_path}")
        print("=" * 85)


if __name__ == "__main__":
    import sys
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    datos_dir = os.path.join(base_dir, "Datos")
    asyncio.run(run_dryrun(datos_dir))
