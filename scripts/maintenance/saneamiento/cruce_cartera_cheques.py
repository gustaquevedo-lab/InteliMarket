#!/usr/bin/env python3
"""Cruce y Auditoría Forense: Cartera de Cheques Excel (Datos/cheques.xlsx) vs Base de Datos (public.cheques).

Realiza el cruce integral:
1. Valida los 149 cheques del Excel físico (Banco Continental / Interfisa, Vencimiento, Proveedor, Monto).
2. Cruza contra la tabla `public.cheques` del sistema.
3. Cruza contra la tabla `public.bank_transactions` (débitos bancarios reales).
4. Genera un reporte detallado con:
   - Cheques en BD y en Excel (Conciliados: cobrados vs diferidos pendientes).
   - Cheques en Excel que NO FIGURAN en el sistema (Faltantes por ingresar).
   - Cheques con diferencias de monto o beneficiario.
   - Estado de compensación bancaria.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import logging
import os
import sys
from datetime import datetime
from decimal import Decimal
from pathlib import Path

import asyncpg
import openpyxl

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("cruce_cheques")

DB_URL = os.getenv("DATABASE_URL", "postgresql://intelimarket:password@localhost:5432/intelimarket")
if DB_URL.startswith("postgresql+asyncpg://"):
    DB_URL = DB_URL.replace("postgresql+asyncpg://", "postgresql://")


async def cruzar_cheques(excel_path: str = "Datos/cheques.xlsx"):
    logger.info(f"Cargando archivo Excel: {excel_path}...")
    wb = openpyxl.load_workbook(excel_path, data_only=True)
    sheet = wb.active

    excel_cheques = []
    for r in range(2, sheet.max_row + 1):
        num = sheet.cell(r, 1).value
        banco = sheet.cell(r, 2).value
        vto = sheet.cell(r, 3).value
        orden = sheet.cell(r, 4).value
        monto = sheet.cell(r, 5).value
        obs = sheet.cell(r, 6).value

        if num and monto:
            num_clean = str(int(num) if isinstance(num, (int, float)) else num).strip()
            vto_str = vto.strftime("%Y-%m-%d") if hasattr(vto, "strftime") else (str(vto)[:10] if vto else None)
            monto_dec = Decimal(str(int(monto) if isinstance(monto, (int, float)) else monto))

            excel_cheques.append({
                "fila": r,
                "numero": num_clean,
                "banco": str(banco).strip() if banco else "CONTINENTAL",
                "vencimiento": vto_str,
                "orden": str(orden).strip() if orden else "",
                "monto": monto_dec,
                "obs": str(obs).strip() if obs else "",
            })

    logger.info(f"Cheques leídos del Excel: {len(excel_cheques)} filas")
    total_excel = sum(c["monto"] for c in excel_cheques)
    logger.info(f"Monto total en cartera Excel: Gs. {total_excel:,.0f}")

    logger.info("Conectando a base de datos PostgreSQL...")
    conn = await asyncpg.connect(DB_URL)

    try:
        # Cargar todos los cheques registrados en el sistema
        db_cheques = await conn.fetch("""
            SELECT 
                c.id, c.numero, c.banco_emisor, c.monto, c.fecha_pago, c.fecha_emision,
                c.estado, c.beneficiario, c.supplier_id, s.razon_social as supplier_nombre
            FROM public.cheques c
            LEFT JOIN public.suppliers s ON s.id = c.supplier_id;
        """)
        logger.info(f"Total cheques en BD: {len(db_cheques)}")

        # Indexar cheques de BD por número exacto y normalizado
        db_by_num: dict[str, list[dict]] = {}
        for c in db_cheques:
            n = str(c["numero"]).strip()
            db_by_num.setdefault(n, []).append(dict(c))
            n_clean = n.lstrip("0")
            if n_clean != n:
                db_by_num.setdefault(n_clean, []).append(dict(c))

        # Cargar transacciones bancarias para cotejo de débitos (por si el cheque fue cobrado en banco)
        bank_txs = await conn.fetch("""
            SELECT id, fecha, descripcion, referencia, monto, tipo, conciliado
            FROM public.bank_transactions
            WHERE tipo = 'debito' AND (descripcion ILIKE '%ch%' OR referencia IS NOT NULL);
        """)
        logger.info(f"Total débitos bancarios analizados: {len(bank_txs)}")

        bank_by_ref: dict[str, list[dict]] = {}
        for tx in bank_txs:
            ref = str(tx["referencia"] or "").strip()
            if ref:
                bank_by_ref.setdefault(ref, []).append(dict(tx))
                bank_by_ref.setdefault(ref.lstrip("0"), []).append(dict(tx))

        # 4. Cruce
        coincidencias_exactas = []
        diferencias_monto = []
        no_encontrados_en_bd = []

        for ec in excel_cheques:
            num = ec["numero"]
            num_clean = num.lstrip("0")
            matches = db_by_num.get(num) or db_by_num.get(num_clean)

            if matches:
                # Buscar si alguno tiene monto idéntico
                exact = next((m for m in matches if abs(m["monto"] - ec["monto"]) == 0), None)
                if exact:
                    coincidencias_exactas.append((ec, exact))
                else:
                    # Mismo número pero monto distinto
                    closest = min(matches, key=lambda m: abs(m["monto"] - ec["monto"]))
                    diferencias_monto.append((ec, closest))
            else:
                # Ver si figura en extracto bancario aunque no esté en cheques
                b_match = bank_by_ref.get(num) or bank_by_ref.get(num_clean)
                ec["debito_bancario_directo"] = b_match[0] if b_match else None
                no_encontrados_en_bd.append(ec)

        # 5. Generar Reporte de Cruce
        print("\n" + "=" * 80)
        print("📊 REPORTE DE CRUCE: CARTERA DE CHEQUES EXCEL VS SISTEMA INTELIMARKET")
        print("=" * 80)
        print(f"Total Cheques en Excel: {len(excel_cheques)} | Monto Total: Gs. {total_excel:,.0f}")
        print("-" * 80)

        # Bloque 1: Exactos
        print(f"\n1. COINCIDENCIAS EXACTAS (Registrados en BD con mismo N° y Monto): {len(coincidencias_exactas)}")
        monto_exactos = sum(ec["monto"] for ec, _ in coincidencias_exactas)
        print(f"   Monto Total: Gs. {monto_exactos:,.0f}")

        st_map: dict[str, int] = {}
        for _, m in coincidencias_exactas:
            st = m["estado"]
            st_map[st] = st_map.get(st, 0) + 1
        print(f"   Desglose por Estado en Sistema: {st_map}")

        # Bloque 2: Discrepancias de Monto
        print(f"\n2. DISCREPANCIAS DE MONTO (Mismo N° de Cheque pero Monto Diferente): {len(diferencias_monto)}")
        for ec, m in diferencias_monto:
            diff = ec["monto"] - m["monto"]
            print(f"   - Cheque N° {ec['numero']}: Excel=Gs. {ec['monto']:,.0f} | BD=Gs. {m['monto']:,.0f} (Diferencia: Gs. {diff:,.0f}) | Beneficiario BD: {m['beneficiario'] or m['supplier_nombre']} | Excel: {ec['orden']}")

        # Bloque 3: No Encontrados en BD
        print(f"\n3. CHEQUES NO REGISTRADOS EN EL SISTEMA (Faltantes en BD): {len(no_encontrados_en_bd)}")
        monto_no_encontrados = sum(ec["monto"] for ec in no_encontrados_en_bd)
        print(f"   Monto Total Faltante: Gs. {monto_no_encontrados:,.0f}")
        
        debitados_banco = [ec for ec in no_encontrados_en_bd if ec.get("debito_bancario_directo")]
        sin_debito_banco = [ec for ec in no_encontrados_en_bd if not ec.get("debito_bancario_directo")]

        print(f"   - Débitos ya registrados en extractos bancarios (pero sin ficha de cheque): {len(debitados_banco)} por Gs. {sum(x['monto'] for x in debitados_banco):,.0f}")
        print(f"   - Cheques diferidos emitidos que NO existen ni en cheques ni en extractos: {len(sin_debito_banco)} por Gs. {sum(x['monto'] for x in sin_debito_banco):,.0f}")

        print("\n   Detalle de Cheques Faltantes en Sistema:")
        for ec in no_encontrados_en_bd:
            b_info = " [DEBITADO EN EXTRACTO]" if ec.get("debito_bancario_directo") else ""
            obs_info = f" ({ec['obs']})" if ec["obs"] else ""
            print(f"   • Fila {ec['fila']}: N° {ec['numero']} | Vto: {ec['vencimiento']} | A la Orden: {ec['orden']:<35} | Gs. {ec['monto']:>12,.0f}{obs_info}{b_info}")

        print("\n" + "=" * 80)
        print("💡 PLAN DE ACCIÓN RECOMENDADO")
        print("=" * 80)
        print("A. Para los cheques pendientes coincidentes: verificar si la fecha de vencimiento o cobro coincide con la realidad bancaria.")
        print(f"B. Para los {len(no_encontrados_en_bd)} cheques faltantes por Gs. {monto_no_encontrados:,.0f}:")
        print("   Se pueden incorporar a public.cheques como cheques diferidos emitidos, vinculándolos a su respectivo proveedor.")
        print("=" * 80 + "\n")

    finally:
        await conn.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Cruce de Cheques Excel vs BD")
    parser.add_argument("--excel", default="Datos/cheques.xlsx", help="Ruta al archivo Excel")
    args = parser.parse_args()

    asyncio.run(cruzar_cheques(args.excel))
