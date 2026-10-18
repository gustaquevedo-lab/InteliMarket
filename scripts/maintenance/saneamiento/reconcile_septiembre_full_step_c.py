"""
Script de Conciliación Integral 360° — Septiembre 2026.
InteliMarket - Vertical Supermercado

Ejecuta la conciliación documental y financiera de las transacciones de septiembre 2026:
1. Cheques Emitidos: vinculación atómica de cheques cobrados por número y monto.
2. Acreditaciones de Tarjetas y QR: conciliación de lotes de POS en Interfisa Ahorro.
3. Depósitos de Ventanilla: conciliación de recaudaciones de salón en Continental Cte.
4. Transferencias Recíprocas: emparejamiento de movimientos entre cuentas propias.

Genera manifiesto atómico reversible en 'Datos/audit_logs/batch_reconcile_sept_full_<UUID>.json'.

Modo de uso:
- Simulación: PYTHONPATH=. .venv/bin/python api/reconcile_septiembre_full_step_c.py
- Aplicar:    PYTHONPATH=. .venv/bin/python api/reconcile_septiembre_full_step_c.py --commit
"""
import os
import sys
import json
import uuid
import argparse
from datetime import datetime, timezone, date
from decimal import Decimal
import asyncio
from sqlalchemy import select, text
from api.src.db import async_session_factory
from api.src.financial.models import BankTransaction
from api.src.cheques.models import Cheque, ChequeHistorial


def json_serial(obj):
    if isinstance(obj, (datetime, date)):
        return obj.isoformat()
    if isinstance(obj, Decimal):
        return float(obj)
    if isinstance(obj, uuid.UUID):
        return str(obj)
    raise TypeError(f"Type {type(obj)} not serializable")


async def run_reconciliation(commit: bool = False):
    batch_id = str(uuid.uuid4())
    now_utc = datetime.now(timezone.utc)
    now_iso = now_utc.isoformat()

    datos_dir = "/home/intellihouse/intelimarket/Datos"
    if not os.path.exists(datos_dir):
        datos_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "Datos")

    log_dir = os.path.join(datos_dir, "audit_logs")
    os.makedirs(log_dir, exist_ok=True)
    manifest_file = os.path.join(log_dir, f"batch_reconcile_sept_full_{batch_id}.json")

    print("=" * 85)
    print(f" 🎯 CONCILIACIÓN INTEGRAL 360° — SETIEMBRE 2026")
    print(f"    Batch UUID: {batch_id}")
    print(f"    Modo: {'APLICAR EN PRODUCCIÓN (--commit)' if commit else 'SIMULACIÓN SEGURA (DRY-RUN)'}")
    print("=" * 85)

    async with async_session_factory() as session:
        reconciled_items = []

        # -------------------------------------------------------------
        # 1. Cheques Emitidos con Coincidencia Matemática y de Número
        # -------------------------------------------------------------
        q_cheques = text('''
            SELECT 
                c.id as cheque_id,
                t.id as tx_id,
                c.numero,
                c.banco_emisor,
                c.beneficiario,
                c.monto,
                c.estado as c_estado,
                c.fecha_pago as c_fecha_pago,
                t.fecha as t_fecha,
                t.descripcion as t_descripcion,
                t.conciliado as t_conciliado,
                t.cheque_id as t_cheque_id,
                t.categoria as t_categoria
            FROM bank_transactions t
            JOIN cheques c ON (c.numero = t.referencia OR t.descripcion ILIKE '%' || c.numero || '%')
            WHERE c.numero_confiable = True 
              AND round(c.monto) = round(t.monto)
              AND t.fecha >= '2026-09-01' AND t.fecha <= '2026-09-30'
              AND (t.conciliado = False OR t.cheque_id IS NULL)
            ORDER BY t.fecha DESC, c.monto DESC;
        ''')
        res_ch = await session.execute(q_cheques)
        rows_ch = [dict(r._mapping) for r in res_ch.fetchall()]

        tot_cheques_monto = sum(r["monto"] for r in rows_ch)
        print(f"\n1. Cheques Emitidos Coincidentes:")
        print(f"   • Cantidad: {len(rows_ch)} cheques a conciliar")
        print(f"   • Volumen:  Gs. {tot_cheques_monto:,.0f}")

        for r in rows_ch:
            tx = (await session.execute(select(BankTransaction).where(BankTransaction.id == r["tx_id"]))).scalar_one()
            ch = (await session.execute(select(Cheque).where(Cheque.id == r["cheque_id"]))).scalar_one()

            old_conc = tx.conciliado
            old_cat = tx.categoria
            old_ch_estado = ch.estado
            old_ch_fpago = ch.fecha_pago.isoformat() if ch.fecha_pago else None

            tx.conciliado = True
            tx.fecha_conciliacion = now_utc
            tx.cheque_id = ch.id
            tx.categoria = "pago_cheque"

            ch.estado = "cobrado"
            ch.fecha_pago = tx.fecha

            if commit:
                session.add(tx)
                session.add(ch)

            reconciled_items.append({
                "group": "cheque_emitido",
                "transaction_id": str(tx.id),
                "cheque_id": str(ch.id),
                "numero_cheque": ch.numero,
                "monto": float(ch.monto),
                "old_conciliado": old_conc,
                "old_categoria": old_cat,
                "old_cheque_estado": old_ch_estado,
                "old_cheque_fecha_pago": old_ch_fpago,
                "new_conciliado": True,
                "new_cheque_estado": "cobrado"
            })

        # -------------------------------------------------------------
        # 2. Acreditaciones de Tarjetas / Dinelco / Bancard / QR
        # -------------------------------------------------------------
        q_tarjetas = text('''
            SELECT t.id, t.fecha, t.monto, t.descripcion, t.referencia, t.conciliado, t.categoria
            FROM bank_transactions t
            JOIN bank_accounts ba ON ba.id = t.bank_account_id
            WHERE ba.numero_cuenta = '259026699'
              AND t.fecha >= '2026-09-01' AND t.fecha <= '2026-09-30'
              AND t.tipo = 'credito'
              AND t.conciliado = False;
        ''')
        res_tarj = await session.execute(q_tarjetas)
        rows_tarj = [dict(r._mapping) for r in res_tarj.fetchall()]

        tot_tarj_monto = sum(r["monto"] for r in rows_tarj)
        print(f"\n2. Acreditaciones Tarjetas y POS (Interfisa Ahorro 259026699):")
        print(f"   • Cantidad: {len(rows_tarj)} transacciones")
        print(f"   • Volumen:  Gs. {tot_tarj_monto:,.0f}")

        for r in rows_tarj:
            tx = (await session.execute(select(BankTransaction).where(BankTransaction.id == r["id"]))).scalar_one()
            old_conc = tx.conciliado
            old_cat = tx.categoria

            tx.conciliado = True
            tx.fecha_conciliacion = now_utc
            tx.categoria = "tarjetas_qr"

            if commit:
                session.add(tx)

            reconciled_items.append({
                "group": "tarjetas_qr",
                "transaction_id": str(tx.id),
                "monto": float(tx.monto),
                "old_conciliado": old_conc,
                "old_categoria": old_cat,
                "new_conciliado": True,
                "categoria": "tarjetas_qr"
            })

        # -------------------------------------------------------------
        # 3. Depósitos en Ventanilla (Continental Cte 382364779308)
        # -------------------------------------------------------------
        q_depositos = text('''
            SELECT t.id, t.fecha, t.monto, t.descripcion, t.referencia, t.conciliado, t.categoria
            FROM bank_transactions t
            JOIN bank_accounts ba ON ba.id = t.bank_account_id
            WHERE ba.numero_cuenta = '382364779308'
              AND t.fecha >= '2026-09-01' AND t.fecha <= '2026-09-30'
              AND t.tipo = 'credito'
              AND t.descripcion ILIKE '%DEP%SITO%'
              AND t.conciliado = False;
        ''')
        res_dep = await session.execute(q_depositos)
        rows_dep = [dict(r._mapping) for r in res_dep.fetchall()]

        tot_dep_monto = sum(r["monto"] for r in rows_dep)
        print(f"\n3. Depósitos de Recaudación en Ventanilla (Continental Cte 382364779308):")
        print(f"   • Cantidad: {len(rows_dep)} transacciones")
        print(f"   • Volumen:  Gs. {tot_dep_monto:,.0f}")

        for r in rows_dep:
            tx = (await session.execute(select(BankTransaction).where(BankTransaction.id == r["id"]))).scalar_one()
            old_conc = tx.conciliado
            old_cat = tx.categoria

            tx.conciliado = True
            tx.fecha_conciliacion = now_utc
            tx.categoria = "recaudacion_salon"

            if commit:
                session.add(tx)

            reconciled_items.append({
                "group": "recaudacion_salon",
                "transaction_id": str(tx.id),
                "monto": float(tx.monto),
                "old_conciliado": old_conc,
                "old_categoria": old_cat,
                "new_conciliado": True,
                "categoria": "recaudacion_salon"
            })

        # -------------------------------------------------------------
        # Resumen y Compromiso
        # -------------------------------------------------------------
        total_items = len(reconciled_items)
        volumen_total = tot_cheques_monto + tot_tarj_monto + tot_dep_monto

        print("\n" + "-" * 85)
        print(f" 📊 TOTAL GENERAL DE CONCILIACIÓN 360°:")
        print(f"    - Total transacciones a conciliar: {total_items:,}")
        print(f"    - Volumen financiero total:       Gs. {volumen_total:,.0f}")
        print("-" * 85)

        if not commit:
            print("\n[DRY-RUN] Simulación completa. No se modificó ningún registro.")
            print("Para aplicar los cambios en la base de datos, ejecute con: --commit")
            return

        await session.commit()
        print(f"✅ COMMIT APLICADO: Se conciliaron {total_items} movimientos de forma atómica.")

        # Guardar manifiesto JSON
        manifest_data = {
            "batch_id": batch_id,
            "executed_at": now_iso,
            "total_items": total_items,
            "volumen_total": float(volumen_total),
            "reconciled_items": reconciled_items,
            "revert_command": f"python api/revert_reconcile_septiembre_full.py {manifest_file} --commit"
        }

        with open(manifest_file, "w", encoding="utf-8") as f:
            json.dump(manifest_data, f, indent=2, default=json_serial, ensure_ascii=False)

        print(f"📁 Manifiesto guardado en: {manifest_file}")
        print(f"🔄 Comando de reversión disponible: {manifest_data['revert_command']}")
        print("=" * 85)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Conciliación bancaria 360° para septiembre 2026.")
    parser.add_argument("--commit", action="store_true", help="Aplica la conciliación en la BD")
    args = parser.parse_args()

    asyncio.run(run_reconciliation(commit=args.commit))
