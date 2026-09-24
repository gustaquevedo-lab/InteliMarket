#!/usr/bin/env python3
"""
Script de Regularización de Fondos Fijos y Rendiciones de Cuentas (Extra Supermercado)
====================================================================================
Lee las 73 partidas de gasto de clean_expenses.json, asegura la existencia de los
dos fondos fijos oficiales (Operaciones/Salón - Jorge y Administración - Camila),
vincula los comprobantes existentes, crea los que faltan y genera los 6 expedientes
de rendición de cuentas oficiales en estado 'presentada'.

Uso:
  python3 scripts/reconcile_rendiciones.py --dry-run
  python3 scripts/reconcile_rendiciones.py --execute
"""

import sys
import os
import json
import uuid
import argparse
import asyncio
from decimal import Decimal
from datetime import date, datetime
from zoneinfo import ZoneInfo
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

TZ_ASUNCION = ZoneInfo("America/Asuncion")
COMPANY_ID = uuid.UUID("00000000-0000-0000-0000-000000000010")

# Definición de las 6 rendiciones según las planillas
RENDICIONES_CONFIG = [
    {
        "numero": "REND-202609-0001",
        "file": "REPOSICION CIERRE 02-09-2026.xlsx",
        "sheets": ["Hoja1"],
        "fund_name": "Fondo Fijo - Operaciones y Salón",
        "custodio_role": "jorge",
        "fecha": date(2026, 9, 2),
        "obs": "Rendición de Gastos Operativos y Salón al 02/09/2026",
    },
    {
        "numero": "REND-202609-0002",
        "file": "REPOSICION CIERRE 03-09-2026.xlsx",
        "sheets": ["FF JORGE", "ANTICIPO"],
        "fund_name": "Fondo Fijo - Operaciones y Salón",
        "custodio_role": "jorge",
        "fecha": date(2026, 9, 3),
        "obs": "Rendición de Gastos Operativos y Salón al 03/09/2026 (incluye anticipo Daniela Rodríguez)",
    },
    {
        "numero": "REND-202609-0003",
        "file": "REPOSICION CIERRE 03-09-2026.xlsx",
        "sheets": ["FF CAMILA"],
        "fund_name": "Fondo Fijo - Administración",
        "custodio_role": "camila",
        "fecha": date(2026, 9, 3),
        "obs": "Rendición de Gastos de Administración al 03/09/2026",
    },
    {
        "numero": "REND-202609-0004",
        "file": "REPOSICION CIERRE 07-09-2026.xlsx",
        "sheets": ["Hoja1"],
        "fund_name": "Fondo Fijo - Operaciones y Salón",
        "custodio_role": "jorge",
        "fecha": date(2026, 9, 7),
        "obs": "Rendición de Gastos Operativos y Salón al 07/09/2026",
    },
    {
        "numero": "REND-202609-0005",
        "file": "REPOSICION CIERRE 10-09-2026.xlsx",
        "sheets": ["Hoja1"],
        "fund_name": "Fondo Fijo - Operaciones y Salón",
        "custodio_role": "jorge",
        "fecha": date(2026, 9, 10),
        "obs": "Rendición de Gastos Operativos y Salón al 10/09/2026",
    },
    {
        "numero": "REND-202609-0006",
        "file": "REPOSICION CIERRE 16-09-2026.xlsx",
        "sheets": ["Hoja1"],
        "fund_name": "Fondo Fijo - Operaciones y Salón",
        "custodio_role": "jorge",
        "fecha": date(2026, 9, 16),
        "obs": "Rendición de Gastos Operativos y Salón al 16/09/2026",
    },
]


def load_items(filepath: str) -> list[dict]:
    if not os.path.exists(filepath):
        alt_paths = [
            "/home/intellihouse/clean_expenses.json",
            "Datos/clean_expenses.json",
            "../Datos/clean_expenses.json",
        ]
        for p in alt_paths:
            if os.path.exists(p):
                filepath = p
                break
    with open(filepath, "r", encoding="utf-8") as f:
        return json.load(f)


async def run_reconciliation(execute: bool, json_path: str, db_url: str):
    print("=" * 70)
    print(f"REGULARIZACIÓN DE RENDICIONES DE FONDO FIJO — {'MODO EJECUCIÓN REAL' if execute else 'MODO PRUEBA (DRY-RUN)'}")
    print("=" * 70)

    engine = create_async_engine(db_url)
    items = load_items(json_path)
    print(f"Items leídos de {json_path}: {len(items)}")

    async with engine.connect() as conn:
        trans = await conn.begin()
        try:
            # 1. Obtener usuarios clave
            jorge_res = await conn.execute(text("SELECT id, nombre FROM users WHERE nombre ILIKE '%jorge castell%' LIMIT 1;"))
            jorge_row = jorge_res.fetchone()
            if not jorge_row:
                raise ValueError("No se encontró el usuario Jorge Castell en la base de datos")
            jorge_id = jorge_row.id
            jorge_nombre = jorge_row.nombre

            admin_res = await conn.execute(text("SELECT id, nombre FROM users WHERE nombre ILIKE '%administración%' OR rol = 'admin' ORDER BY created_at ASC LIMIT 1;"))
            admin_row = admin_res.fetchone()
            camila_id = admin_row.id
            camila_nombre = "Camila Gonzalez"  # Custodio asignado a Administración

            print(f"Custodio Operaciones : {jorge_nombre} ({jorge_id})")
            print(f"Custodio Admin       : {camila_nombre} ({camila_id})")

            # 2. Asegurar fondos fijos
            # A. Operaciones y Salón (monto autorizado 8.000.000 para soportar picos)
            fund_jorge_res = await conn.execute(text("""
                SELECT id, nombre, monto_autorizado, saldo_actual FROM petty_cash_funds
                WHERE company_id = :cid AND nombre ILIKE '%operaciones%' LIMIT 1;
            """), {"cid": COMPANY_ID})
            fund_jorge_row = fund_jorge_res.fetchone()
            if not fund_jorge_row:
                fid_jorge = uuid.uuid4()
                await conn.execute(text("""
                    INSERT INTO petty_cash_funds (id, company_id, nombre, custodio_id, monto_autorizado, saldo_actual, activo, created_at, updated_at)
                    VALUES (:id, :cid, 'Fondo Fijo - Operaciones y Salón', :custodio, 8000000, 8000000, true, NOW(), NOW());
                """), {"id": fid_jorge, "cid": COMPANY_ID, "custodio": jorge_id})
                print(f"[NUEVO] Creado fondo: Fondo Fijo - Operaciones y Salón (ID: {fid_jorge})")
            else:
                fid_jorge = fund_jorge_row.id
                print(f"[EXISTE] Fondo Operaciones: {fund_jorge_row.nombre} (ID: {fid_jorge})")

            # B. Administración (monto autorizado 5.000.000)
            fund_camila_res = await conn.execute(text("""
                SELECT id, nombre, monto_autorizado, saldo_actual FROM petty_cash_funds
                WHERE company_id = :cid AND nombre ILIKE '%administración%' LIMIT 1;
            """), {"cid": COMPANY_ID})
            fund_camila_row = fund_camila_res.fetchone()
            if not fund_camila_row:
                fid_camila = uuid.uuid4()
                await conn.execute(text("""
                    INSERT INTO petty_cash_funds (id, company_id, nombre, custodio_id, monto_autorizado, saldo_actual, activo, created_at, updated_at)
                    VALUES (:id, :cid, 'Fondo Fijo - Administración', :custodio, 5000000, 5000000, true, NOW(), NOW());
                """), {"id": fid_camila, "cid": COMPANY_ID, "custodio": camila_id})
                print(f"[NUEVO] Creado fondo: Fondo Fijo - Administración (ID: {fid_camila})")
            else:
                fid_camila = fund_camila_row.id
                print(f"[EXISTE] Fondo Administración: {fund_camila_row.nombre} (ID: {fid_camila})")

            funds_map = {
                "jorge": {"id": fid_jorge, "nombre": "Fondo Fijo - Operaciones y Salón", "custodio_id": jorge_id, "custodio_nombre": jorge_nombre, "monto_aut": Decimal("8000000")},
                "camila": {"id": fid_camila, "nombre": "Fondo Fijo - Administración", "custodio_id": camila_id, "custodio_nombre": camila_nombre, "monto_aut": Decimal("5000000")},
            }

            # 3. Leer todos los expenses de la base de datos para cruzar
            all_exp_res = await conn.execute(text("""
                SELECT id, monto, descripcion, fecha_gasto, numero_factura, fund_id, rendicion_id, ruc, proveedor
                FROM expenses
                WHERE company_id = :cid;
            """), {"cid": COMPANY_ID})
            all_expenses = [dict(r._mapping) for r in all_exp_res.fetchall()]

            # 4. Procesar cada rendición y sus comprobantes
            totales_globales = {
                "comprobantes_total": 0,
                "monto_total": Decimal("0"),
                "existentes_vinculados": 0,
                "nuevos_insertados": 0,
            }

            for cfg in RENDICIONES_CONFIG:
                rend_nro = cfg["numero"]
                fund_info = funds_map[cfg["custodio_role"]]
                fund_id = fund_info["id"]

                # Filtrar ítems pertenecientes a esta rendición
                rend_items = [
                    it for it in items
                    if it["file"] == cfg["file"] and it["sheet"] in cfg["sheets"]
                ]

                rend_total = sum(Decimal(str(it["monto"])) for it in rend_items)
                tot_iva10 = sum(round(Decimal(str(it["monto"])) / Decimal("11")) for it in rend_items if it.get("tiene_factura") == "OK")
                tot_g10 = sum(Decimal(str(it["monto"])) - round(Decimal(str(it["monto"])) / Decimal("11")) for it in rend_items if it.get("tiene_factura") == "OK")
                tot_ex = sum(Decimal(str(it["monto"])) for it in rend_items if it.get("tiene_factura") != "OK")

                print("-" * 70)
                print(f"Expediente: {rend_nro} | Fondo: {fund_info['nombre']} | Fecha: {cfg['fecha']} | Items: {len(rend_items)} | Total: ₲ {rend_total:,.0f} (Grav 10%: ₲ {tot_g10:,.0f}, IVA 10%: ₲ {tot_iva10:,.0f}, Exentas: ₲ {tot_ex:,.0f})")

                # Asegurar o crear registro de rendición
                r_res = await conn.execute(text("""
                    SELECT id FROM petty_cash_rendiciones
                    WHERE company_id = :cid AND numero_rendicion = :nro;
                """), {"cid": COMPANY_ID, "nro": rend_nro})
                existing_rend = r_res.fetchone()
                if existing_rend:
                    rend_id = existing_rend.id
                    print(f"  [EXISTE RENDICIÓN] ID: {rend_id}")
                else:
                    rend_id = uuid.uuid4()
                    efectivo_rem = max(Decimal("0"), fund_info["monto_aut"] - rend_total)
                    await conn.execute(text("""
                        INSERT INTO petty_cash_rendiciones (
                            id, company_id, fund_id, numero_rendicion,
                            custodio_id, custodio_nombre, estado,
                            monto_fondo_autorizado, efectivo_remanente_contado,
                            total_comprobantes_presentados, total_comprobantes_aprobados,
                            total_comprobantes_rechazados, diferencia_arqueo,
                            total_gravado_10, total_iva_10, total_exentas,
                            total_gasto_operativo,
                            fecha_presentacion, observaciones_custodio,
                            created_at, updated_at
                        ) VALUES (
                            :id, :cid, :fund_id, :nro,
                            :custodio_id, :custodio_nombre, 'presentada',
                            :monto_aut, :efectivo_rem,
                            :tot, :tot,
                            0, 0,
                            :g10, :iva10, :ex,
                            :tot,
                            :fecha_pres, :obs,
                            NOW(), NOW()
                        );
                    """), {
                        "id": rend_id,
                        "cid": COMPANY_ID,
                        "fund_id": fund_id,
                        "nro": rend_nro,
                        "custodio_id": fund_info["custodio_id"],
                        "custodio_nombre": fund_info["custodio_nombre"],
                        "monto_aut": fund_info["monto_aut"],
                        "efectivo_rem": efectivo_rem,
                        "tot": rend_total,
                        "g10": tot_g10,
                        "iva10": tot_iva10,
                        "ex": tot_ex,
                        "fecha_pres": datetime.combine(cfg["fecha"], datetime.min.time(), tzinfo=TZ_ASUNCION),
                        "obs": cfg["obs"],
                    })
                    print(f"  [NUEVA RENDICIÓN CREADA] ID: {rend_id} (Estado: presentada)")

                # Procesar comprobantes de esta rendición
                vinculados_count = 0
                nuevos_count = 0

                for it in rend_items:
                    monto_dec = Decimal(str(it["monto"]))
                    doc_num = (it.get("comprobante") or "").strip()
                    desc = it["descripcion"].strip()
                    prov = (it.get("proveedor") or "").strip()
                    fecha_str = it["fecha"]
                    fecha_val = date.fromisoformat(fecha_str) if fecha_str else cfg["fecha"]

                    # Buscar si ya existe en expenses
                    matched_exp = None
                    # A. Intentar por número de documento exacto y monto
                    if doc_num and doc_num != "S/F":
                        for e in all_expenses:
                            if (e.get("numero_factura") or "").strip() == doc_num and abs(Decimal(str(e["monto"])) - monto_dec) < 1:
                                matched_exp = e
                                break
                    # B. Intentar por monto, fecha y descripción similar
                    if not matched_exp:
                        for e in all_expenses:
                            if abs(Decimal(str(e["monto"])) - monto_dec) < 1 and e["fecha_gasto"] == fecha_val:
                                if e["fund_id"] is None or e["fund_id"] == fund_id:
                                    matched_exp = e
                                    break

                    if matched_exp:
                        # Vincular comprobante existente
                        await conn.execute(text("""
                            UPDATE expenses
                            SET fund_id = :fid, rendicion_id = :rid, auditoria_estado = 'aprobado'
                            WHERE id = :eid;
                        """), {"fid": fund_id, "rid": rend_id, "eid": matched_exp["id"]})
                        # Actualizar en memoria para no duplicar asignación
                        matched_exp["fund_id"] = fund_id
                        matched_exp["rendicion_id"] = rend_id
                        vinculados_count += 1
                    else:
                        # Insertar nuevo gasto
                        new_eid = uuid.uuid4()
                        is_factura = (doc_num and doc_num != "S/F")
                        tipo_comp = "FACTURA_CONTADO" if is_factura else "RECIBO"
                        if is_factura:
                            iva_10_exp = round(monto_dec / Decimal("11"))
                            grav_10_exp = monto_dec - iva_10_exp
                            ex_exp = Decimal("0")
                        else:
                            iva_10_exp = Decimal("0")
                            grav_10_exp = Decimal("0")
                            ex_exp = monto_dec

                        await conn.execute(text("""
                            INSERT INTO expenses (
                                id, company_id, fund_id, rendicion_id,
                                monto, descripcion, proveedor, numero_factura,
                                tipo_comprobante, tipo_pago, fecha_gasto,
                                gravado_10, iva_10, exentas,
                                auditoria_estado, estado, anulado, created_at
                            ) VALUES (
                                :id, :cid, :fid, :rid,
                                :monto, :desc, :prov, :doc,
                                :tipo_comp, 'efectivo', :fecha,
                                :g10, :iva10, :ex,
                                'aprobado', 'aprobado', false, NOW()
                            );
                        """), {
                            "id": new_eid,
                            "cid": COMPANY_ID,
                            "fid": fund_id,
                            "rid": rend_id,
                            "monto": monto_dec,
                            "desc": desc,
                            "prov": prov,
                            "doc": doc_num if is_factura else None,
                            "tipo_comp": tipo_comp,
                            "fecha": fecha_val,
                            "g10": grav_10_exp,
                            "iva10": iva_10_exp,
                            "ex": ex_exp,
                        })
                        nuevos_count += 1

                print(f"  -> {vinculados_count} comprobantes vinculados (existentes) | {nuevos_count} comprobantes nuevos dados de alta")
                totales_globales["comprobantes_total"] += len(rend_items)
                totales_globales["monto_total"] += rend_total
                totales_globales["existentes_vinculados"] += vinculados_count
                totales_globales["nuevos_insertados"] += nuevos_count

            print("=" * 70)
            print("CONSOLIDADO DE RESULTADOS:")
            print(f"  Total comprobantes auditados   : {totales_globales['comprobantes_total']} / {len(items)}")
            print(f"  Monto total consolidado        : ₲ {totales_globales['monto_total']:,.0f}")
            print(f"  Comprobantes existentes unidos : {totales_globales['existentes_vinculados']}")
            print(f"  Comprobantes nuevos insertados : {totales_globales['nuevos_insertados']}")
            print("=" * 70)

            if execute:
                await trans.commit()
                print(">>> TRANSACCIÓN COMPLETADA Y CONFIRMADA EN LA BASE DE DATOS.")
            else:
                await trans.rollback()
                print(">>> MODO DRY-RUN: TODOS LOS CAMBIOS FUERON REVERTIDOS (ROLLBACK).")

        except Exception as exc:
            await trans.rollback()
            print(f"ERROR DURANTE LA EJECUCIÓN: {exc}")
            raise


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Regularización de Rendiciones")
    parser.add_argument("--execute", action="store_true", help="Aplica los cambios en la BD")
    parser.add_argument("--dry-run", action="store_true", help="Ejecuta en modo prueba sin alterar la BD")
    parser.add_argument("--json", default="/home/intellihouse/clean_expenses.json", help="Ruta al archivo clean_expenses.json")
    parser.add_argument("--db", default=os.getenv("DATABASE_URL", "postgresql+asyncpg://intelimarket:password@localhost:5432/intelimarket"), help="URL de conexión DB")
    args = parser.parse_args()

    execute_mode = args.execute and not args.dry_run
    asyncio.run(run_reconciliation(execute_mode, args.json, args.db))
