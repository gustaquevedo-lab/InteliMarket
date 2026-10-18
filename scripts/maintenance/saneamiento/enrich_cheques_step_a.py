"""
Script de Enriquecimiento Quirúrgico de Cheques (Paso A)
Enriquece los cheques sintéticos (BACKFILL-*) que coinciden unívocamente con el
Libro Maestro de Cheques a Plazo 2026 en 'Datos/CHEQUES A PLAZO EXTRA PARAGUAY.xlsx'.

Reglas estrictas de seguridad:
- NO borra ningún registro.
- NO inserta duplicados ni pagos extras a proveedores.
- Actualiza in-place:
    * numero = número real de cheque
    * numero_confiable = True
    * diferido = True
    * fecha_pago = fecha de vencimiento diferido real
    * banco_emisor = banco emisor real (CONTINENTAL / INTERFISA)
    * bank_account_id = cuenta bancaria asociada según banco
- Registra trazabilidad inmutable en 'cheque_historial'.
"""
import os
import re
import difflib
import openpyxl
from datetime import date, datetime
from decimal import Decimal
import asyncio
from sqlalchemy import select, text
from api.src.db import async_session_factory
from api.src.financial.models import BankAccount
from api.src.cheques.models import Cheque, ChequeHistorial


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


async def enrich_cheques(commit: bool = False):
    datos_dir = "/home/intellihouse/intelimarket/Datos"
    if not os.path.exists(datos_dir):
        datos_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "Datos")

    filepath = os.path.join(datos_dir, "CHEQUES A PLAZO EXTRA PARAGUAY.xlsx")
    if not os.path.exists(filepath):
        print(f"❌ Archivo no encontrado: {filepath}")
        return

    print("="*80)
    print(f" PASO A: ENRIQUECIMIENTO DE CHEQUES SINTÉTICOS [{'PRODUCCIÓN REAL' if commit else 'MODO SIMULACIÓN (DRY-RUN)'}]")
    print("="*80)

    # 1. Leer Excel de Cheques
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

    print(f"📄 Cheques cargados del Excel 2026: {len(excel_cheques)} registros.")

    async with async_session_factory() as session:
        # Cargar cuentas bancarias
        res_acc = await session.execute(select(BankAccount))
        accounts = list(res_acc.scalars().all())
        acc_continental_cte = next((a for a in accounts if "CONTINENTAL" in a.banco.upper() and "corriente" in a.tipo.lower()), None)
        acc_interfisa_cte = next((a for a in accounts if "INTERFISA" in a.banco.upper() and "corriente" in a.tipo.lower()), None)

        print(f"🏦 Cuenta Continental CTE: {acc_continental_cte.id if acc_continental_cte else 'No hallada'}")
        print(f"🏦 Cuenta Interfisa CTE: {acc_interfisa_cte.id if acc_interfisa_cte else 'No hallada'}")

        # Cargar todos los cheques de la BD
        res_cheques = await session.execute(select(Cheque))
        db_cheques = list(res_cheques.scalars().all())

        by_confiable_number = {}
        sinteticos = []
        for c in db_cheques:
            if c.numero_confiable and c.numero and not c.numero.startswith("BACKFILL-"):
                by_confiable_number[c.numero] = c
            else:
                sinteticos.append(c)

        print(f"🗄️ Cheques en BD: {len(db_cheques)} ({len(by_confiable_number)} confiables, {len(sinteticos)} sintéticos).")

        # Cruce
        matches = []
        sinteticos_usados = set()

        for exc in excel_cheques:
            num = exc["numero"]
            if num in by_confiable_number:
                continue

            candidatos = [
                s for s in sinteticos
                if s.id not in sinteticos_usados and s.monto == exc["monto"]
            ]

            if not candidatos:
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
                matches.append((exc, best_match, "Match exacto (Monto + Prov + Fecha)"))
                sinteticos_usados.add(best_match.id)
            elif len(candidatos) == 1 and best_score >= 0.5:
                matches.append((exc, candidatos[0], "Match monto único y similitud"))
                sinteticos_usados.add(candidatos[0].id)

        print(f"\n🎯 Total de cheques sintéticos a enriquecer: {len(matches)}")
        total_monto = sum(exc["monto"] for exc, _, _ in matches)
        print(f"💰 Monto total enriquecido: Gs. {total_monto:,.0f}")

        # Aplicar enriquecimiento
        enriquecidos_count = 0
        for exc, cand, motivo in matches:
            old_num = cand.numero
            cand.numero = exc["numero"]
            cand.numero_confiable = True
            cand.diferido = True
            cand.banco_emisor = "BANCO CONTINENTAL" if "CONTINENTAL" in exc["banco"] else ("BANCO INTERFISA" if "INTERFISA" in exc["banco"] else exc["banco"])
            if exc["fecha_vencimiento"]:
                cand.fecha_pago = exc["fecha_vencimiento"]
            
            # Asignar cuenta bancaria corriente
            if "CONTINENTAL" in cand.banco_emisor.upper() and acc_continental_cte:
                cand.bank_account_id = acc_continental_cte.id
            elif "INTERFISA" in cand.banco_emisor.upper() and acc_interfisa_cte:
                cand.bank_account_id = acc_interfisa_cte.id

            cand.notas = (cand.notas or "") + f" | Enriquecido con Cheque Nº {exc['numero']} (Vence: {exc['fecha_vencimiento']}) desde Libro Maestro 2026."

            # Registrar en historial
            hist = ChequeHistorial(
                cheque_id=cand.id,
                estado_anterior=cand.estado,
                estado_nuevo=cand.estado,
                user_id=None,
                user_nombre="Sistema (Paso A - Libro Maestro 2026)",
                notas=f"Enriquecimiento seguro: Nº sintético {old_num} reemplazado por Nº real {exc['numero']} ({cand.banco_emisor}). Vencimiento diferido: {exc['fecha_vencimiento']}. Motivo: {motivo}.",
            )
            session.add(hist)
            session.add(cand)
            enriquecidos_count += 1

        if commit:
            print("\n💾 Confirmando cambios en la base de datos (COMMIT)...")
            await session.commit()
            print(f"✅ ¡Éxito! Se enriquecieron {enriquecidos_count} cheques en producción.")
        else:
            print("\n⚠️ Modo simulación: Se hizo rollback, la base de datos NO fue modificada.")
            await session.rollback()


if __name__ == "__main__":
    import sys
    do_commit = "--commit" in sys.argv
    asyncio.run(enrich_cheques(commit=do_commit))
