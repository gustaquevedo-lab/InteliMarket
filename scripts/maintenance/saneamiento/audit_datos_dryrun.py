"""
Script de Auditoría y Contraste Dry-Run (Solo Lectura)
Contrasta los archivos de la carpeta 'Datos/' contra la base de datos PostgreSQL
sin realizar NINGUNA modificación ni inserción.
"""
import os
import re
import difflib
import openpyxl
from datetime import date, datetime
from decimal import Decimal
import asyncio
from sqlalchemy import select, func, text
from api.src.db import async_session_factory
from api.src.financial.models import BankAccount, BankTransaction
from api.src.financial import statement_import
from api.src.cheques.models import Cheque


def clean_name(s: str) -> str:
    if not s:
        return ""
    s = s.upper()
    for noise in ["S.A.C.E.I.", "S.A.C.I.", "S.A.", "S.R.L.", "E.A.S.", "SOCIEDAD ANONIMA", "SA", "SRL", "EAS", ".", ",", "-", "/"]:
        s = s.replace(noise, " ")
    s = re.sub(r"\s+", " ", s).strip()
    return s


def string_similarity(a: str, b: str) -> float:
    ca = clean_name(a)
    cb = clean_name(b)
    if not ca or not cb:
        return 0.0
    if ca == cb or ca in cb or cb in ca:
        return 1.0
    return difflib.SequenceMatcher(None, ca, cb).ratio()


async def audit_bank_statements(session, datos_dir: str):
    print("\n" + "="*80)
    print(" 1. AUDITORÍA DE EXTRACTOS BANCARIOS (AGOSTO Y SEPTIEMBRE 2026)")
    print("="*80)

    res = await session.execute(select(BankAccount))
    accounts = list(res.scalars().all())
    account_map = {}
    for acc in accounts:
        key = (acc.banco.upper(), statement_import.account_tipo_normalizado(acc.tipo, acc.titular, acc.numero_cuenta))
        account_map[key] = acc

    statement_files = [
        ("CONTINENTAL", 8, 2026, os.path.join(datos_dir, "CONTINENTAL MES DE AGOSTO 2026.xlsx")),
        ("CONTINENTAL", 9, 2026, os.path.join(datos_dir, "CONTINENTAL MES DE SEPTIEMBRE 2026.xlsx")),
        ("INTERFISA", 8, 2026, os.path.join(datos_dir, "INTERFISA MES DE AGOSTO 2026.xlsx")),
        ("INTERFISA", 9, 2026, os.path.join(datos_dir, "INTERFISA MES DE SEPTIEMBRE 2026.xlsx")),
    ]

    total_nuevas_global = 0
    total_duplicadas_global = 0

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

            target_acc = None
            for (b_name, a_tipo), acc in account_map.items():
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

            existing = await session.execute(
                select(BankTransaction.fecha, BankTransaction.tipo, BankTransaction.monto, BankTransaction.descripcion, BankTransaction.referencia)
                .where(BankTransaction.bank_account_id == target_acc.id)
            )
            existing_keys = {(row.fecha, row.tipo, row.monto, row.descripcion or "", row.referencia or "") for row in existing.all()}

            duplicadas = 0
            nuevas = 0
            monto_nuevas_debito = Decimal("0")
            monto_nuevas_credito = Decimal("0")

            for t in txs:
                key = (t["fecha"], t["tipo"], t["monto"], t["descripcion"] or "", t["referencia"] or "")
                if key in existing_keys:
                    duplicadas += 1
                else:
                    nuevas += 1
                    if t["tipo"] == "debito":
                        monto_nuevas_debito += t["monto"]
                    else:
                        monto_nuevas_credito += t["monto"]

            total_nuevas_global += nuevas
            total_duplicadas_global += duplicadas

            status_icon = "✅ 100% al día" if nuevas == 0 else f"ℹ️ {nuevas} pendientes de incorporar"
            print(f"  - Hoja [{sheet_name}] -> Cuenta {target_acc.numero_cuenta} ({target_acc.banco} - {target_acc.tipo}):")
            print(f"      Total en Excel: {len(txs)} txs | Ya en BD: {duplicadas} | Nuevas: {nuevas} | {status_icon}")
            if nuevas > 0:
                print(f"      Volumen pendiente: Débitos Gs. {monto_nuevas_debito:,.0f} | Créditos Gs. {monto_nuevas_credito:,.0f}")

    print(f"\n📊 Balance Extractos Bancarios: {total_duplicadas_global} ya registradas en BD | {total_nuevas_global} pendientes de incorporar.")


async def audit_cheques_a_plazo(session, datos_dir: str):
    print("\n" + "="*80)
    print(" 2. AUDITORÍA DEL LIBRO MAESTRO DE CHEQUES A PLAZO 2026")
    print("="*80)

    filepath = os.path.join(datos_dir, "CHEQUES A PLAZO EXTRA PARAGUAY.xlsx")
    if not os.path.exists(filepath):
        print(f"⚠️ Archivo no encontrado: {filepath}")
        return

    wb = openpyxl.load_workbook(filepath, data_only=True)
    ws = wb["26"]

    excel_cheques = []
    for row_idx, r in enumerate(ws.iter_rows(values_only=True), start=1):
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
                excel_cheques.append({
                    "row_idx": row_idx,
                    "numero": num,
                    "banco": banco,
                    "fecha_emision": femision,
                    "fecha_vencimiento": fvenc,
                    "beneficiario": beneficiario,
                    "monto": monto,
                })

    print(f"📄 Cheques válidos leídos en Excel 2026: {len(excel_cheques)} cheques")
    monto_total_excel = sum(c["monto"] for c in excel_cheques)
    print(f"   Monto Total en Excel: Gs. {monto_total_excel:,.0f}")

    res = await session.execute(select(Cheque))
    db_cheques = list(res.scalars().all())
    print(f"🗄️ Cheques totales en Base de Datos: {len(db_cheques)}")

    by_confiable_number = {}
    sinteticos = []
    
    for c in db_cheques:
        if c.numero_confiable and c.numero and not c.numero.startswith("BACKFILL-"):
            by_confiable_number[c.numero] = c
        else:
            sinteticos.append(c)

    print(f"   - Con número real confiable: {len(by_confiable_number)}")
    print(f"   - Sintéticos pendientes de enriquecer (BACKFILL): {len(sinteticos)}")

    matches_exactos = []
    matches_monto_unico = []
    matches_ya_cargados = []
    excel_sin_match = []
    sinteticos_usados = set()

    for exc in excel_cheques:
        num = exc["numero"]
        if num in by_confiable_number:
            matches_ya_cargados.append((exc, by_confiable_number[num]))
            continue

        candidatos = [
            s for s in sinteticos
            if s.id not in sinteticos_usados and s.monto == exc["monto"]
        ]

        if not candidatos:
            excel_sin_match.append(exc)
            continue

        best_match = None
        best_score = 0.0

        for cand in candidatos:
            sim = string_similarity(cand.beneficiario or "", exc["beneficiario"])
            dias_diff = abs((cand.fecha_emision - exc["fecha_emision"]).days) if (cand.fecha_emision and exc["fecha_emision"]) else 999
            
            score = sim
            if dias_diff <= 7:
                score += 0.5
            elif dias_diff <= 30:
                score += 0.2

            if score > best_score:
                best_score = score
                best_match = cand

        if best_match and best_score >= 1.0:
            matches_exactos.append((exc, best_match))
            sinteticos_usados.add(best_match.id)
        elif len(candidatos) == 1 and best_score >= 0.5:
            matches_monto_unico.append((exc, candidatos[0]))
            sinteticos_usados.add(candidatos[0].id)
        else:
            excel_sin_match.append(exc)

    print("\n" + "-"*60)
    print(" RESULTADOS DEL CRUCE DE CHEQUES:")
    print("-" * 60)
    print(f" ✅ Ya registrados previamente con número real: {len(matches_ya_cargados)}")
    print(f" 🎯 Matches exactos para ENRIQUECER (Monto + Proveedor + Fecha): {len(matches_exactos)}")
    print(f" 🔍 Matches por Monto Único / Similitud alta: {len(matches_monto_unico)}")
    print(f" 🆕 Cheques en Excel no vinculados a sintéticos en BD: {len(excel_sin_match)}")
    
    total_enriquecibles = len(matches_exactos) + len(matches_monto_unico)
    monto_enriquecible = sum(exc["monto"] for exc, _ in matches_exactos + matches_monto_unico)
    print(f"\n💡 POTENCIAL DE ENRIQUECIMIENTO SEGURO:")
    print(f"   Se pueden transformar {total_enriquecibles} cheques sintéticos (Gs. {monto_enriquecible:,.0f})")
    print(f"   en cheques REALES con su vencimiento diferido y trazabilidad, SIN PISAR NINGÚN REGISTRO.")

    print("\n📋 Muestra de Enriquecimientos Propuestos (Primeros 5):")
    for idx, (exc, cand) in enumerate((matches_exactos + matches_monto_unico)[:5], 1):
        print(f"  {idx}. BD: [{cand.numero}] Gs. {cand.monto:,.0f} ({cand.beneficiario}) [Emisión BD: {cand.fecha_emision}]")
        print(f"     -> ENRIQUECER A: Cheque Nº {exc['numero']} | Vence: {exc['fecha_vencimiento']} | Banco: {exc['banco']} | Prov: {exc['beneficiario']}")

    if excel_sin_match:
        monto_no_match = sum(c["monto"] for c in excel_sin_match)
        print(f"\n📌 Cheques en Excel que no tienen contraparte en la BD ({len(excel_sin_match)} cheques, Gs. {monto_no_match:,.0f}):")
        for exc in excel_sin_match[:5]:
            print(f"   - Nº {exc['numero']} | {exc['banco']} | Vence: {exc['fecha_vencimiento']} | {exc['beneficiario']} | Gs. {exc['monto']:,.0f}")
        if len(excel_sin_match) > 5:
            print(f"   ... y {len(excel_sin_match) - 5} más.")


async def main():
    datos_dir = "/home/intellihouse/intelimarket/Datos"
    if not os.path.exists(datos_dir):
        datos_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "Datos")

    async with async_session_factory() as session:
        await audit_bank_statements(session, datos_dir)
        await audit_cheques_a_plazo(session, datos_dir)


if __name__ == "__main__":
    asyncio.run(main())
