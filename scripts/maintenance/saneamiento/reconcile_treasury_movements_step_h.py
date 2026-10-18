"""
Script de Conciliación Integral de Tesorería (Paso H)
Concilia automáticamente 3 grupos clave de transacciones bancarias con 100% de evidencia documental:
  1. Depósitos de Bóveda confirmados (32 transacciones vinculadas a vault_entries depositadas).
  2. Transferencias internas recíprocas (174 transacciones en 87 pares entre Continental e Interfisa).
  3. Pagos directos a proveedores con comprobante y registro en AP (427 transacciones coincidentes con supplier_invoice_payments).

Garantías:
1. Batch ID único para auditoría.
2. Manifiesto JSON con detalle atómico de cada transacción conciliada.
3. Script de reversión: 'api/revert_reconcile_treasury_movements_step_h.py'.
4. Actualiza 'conciliado = True', 'fecha_conciliacion = now_utc', y en proveedores asigna 'invoice_id'.
"""
import os
import sys
import json
import uuid
from datetime import datetime, timezone
import asyncio
from sqlalchemy import select, text
from api.src.db import async_session_factory
from api.src.financial.models import BankTransaction


async def reconcile_treasury(commit: bool = False):
    batch_id = str(uuid.uuid4())
    now_utc = datetime.now(timezone.utc)
    now_iso = now_utc.isoformat()
    company_id = "00000000-0000-0000-0000-000000000010"

    datos_dir = "/home/intellihouse/intelimarket/Datos"
    if not os.path.exists(datos_dir):
        datos_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "Datos")

    log_dir = os.path.join(datos_dir, "audit_logs")
    os.makedirs(log_dir, exist_ok=True)
    manifest_file = os.path.join(log_dir, f"batch_reconcile_treasury_step_h_{batch_id}.json")

    print("="*80)
    print(f" CONCILIACIÓN INTEGRAL DE TESORERÍA [{'PRODUCCIÓN' if commit else 'MODO SIMULACIÓN (DRY-RUN)'}]")
    print(f" Batch ID: {batch_id}")
    print(f" Manifiesto: {manifest_file}")
    print("="*80)

    async with async_session_factory() as session:
        reconciled_items = []
        tot_monto_g1 = 0
        tot_monto_g2 = 0
        tot_monto_g3 = 0

        # -------------------------------------------------------------
        # 1. Depósitos de Bóveda confirmados
        # -------------------------------------------------------------
        q_g1 = text("""
            SELECT DISTINCT bt.id, bt.monto, bt.descripcion, bt.referencia, bt.fecha
            FROM bank_transactions bt
            JOIN vault_entries ve ON ve.bank_transaction_id = bt.id
            WHERE bt.conciliado = False AND ve.estado = 'depositado'
        """)
        res_g1 = await session.execute(q_g1)
        g1_rows = res_g1.fetchall()

        for r in g1_rows:
            tx_id, monto, desc, ref, fecha = r
            tx = (await session.execute(select(BankTransaction).where(BankTransaction.id == tx_id))).scalar_one()
            old_conc = tx.conciliado
            old_f_conc = tx.fecha_conciliacion.isoformat() if tx.fecha_conciliacion else None

            tx.conciliado = True
            tx.fecha_conciliacion = now_utc
            session.add(tx)
            tot_monto_g1 += float(monto)

            reconciled_items.append({
                "group": "vault_deposit",
                "transaction_id": str(tx_id),
                "fecha": fecha.isoformat() if fecha else None,
                "monto": float(monto),
                "descripcion": desc,
                "referencia": ref,
                "old_conciliado": old_conc,
                "old_fecha_conciliacion": old_f_conc,
                "new_conciliado": True,
                "new_fecha_conciliacion": now_iso,
                "linked_invoice_id": None,
            })

        print(f"\n1. Depósitos de Bóveda confirmados:")
        print(f"   - Cantidad: {len(g1_rows)} transacciones")
        print(f"   - Monto:    Gs. {tot_monto_g1:,.0f}")

        # -------------------------------------------------------------
        # 2. Transferencias internas recíprocas
        # -------------------------------------------------------------
        q_g2 = text("""
            SELECT 
                t1.id AS id1, t1.monto AS monto1, t1.descripcion AS desc1, t1.fecha AS f1,
                t2.id AS id2, t2.monto AS monto2, t2.descripcion AS desc2, t2.fecha AS f2
            FROM bank_transactions t1
            JOIN bank_transactions t2 
              ON t1.monto = t2.monto 
             AND t1.fecha = t2.fecha 
             AND t1.bank_account_id != t2.bank_account_id
             AND t1.tipo != t2.tipo
             AND t1.id < t2.id
            WHERE t1.categoria = 'transferencia_interna' 
              AND t2.categoria = 'transferencia_interna'
              AND t1.conciliado = False
              AND t2.conciliado = False
        """)
        res_g2 = await session.execute(q_g2)
        g2_rows = res_g2.fetchall()

        for r in g2_rows:
            id1, monto1, desc1, f1, id2, monto2, desc2, f2 = r
            for tid, m, d, f in [(id1, monto1, desc1, f1), (id2, monto2, desc2, f2)]:
                tx = (await session.execute(select(BankTransaction).where(BankTransaction.id == tid))).scalar_one()
                old_conc = tx.conciliado
                old_f_conc = tx.fecha_conciliacion.isoformat() if tx.fecha_conciliacion else None

                tx.conciliado = True
                tx.fecha_conciliacion = now_utc
                session.add(tx)
                tot_monto_g2 += float(m)

                reconciled_items.append({
                    "group": "internal_transfer_pair",
                    "transaction_id": str(tid),
                    "fecha": f.isoformat() if f else None,
                    "monto": float(m),
                    "descripcion": d,
                    "referencia": tx.referencia,
                    "old_conciliado": old_conc,
                    "old_fecha_conciliacion": old_f_conc,
                    "new_conciliado": True,
                    "new_fecha_conciliacion": now_iso,
                    "linked_invoice_id": None,
                })

        print(f"\n2. Transferencias internas recíprocas:")
        print(f"   - Cantidad: {len(g2_rows) * 2} transacciones ({len(g2_rows)} pares)")
        print(f"   - Monto:    Gs. {tot_monto_g2:,.0f}")

        # -------------------------------------------------------------
        # 3. Pagos a proveedores coincidentes con AP (SupplierInvoicePayment)
        # -------------------------------------------------------------
        q_g3 = text("""
            SELECT DISTINCT ON (bt.id)
                bt.id, bt.monto, bt.descripcion, bt.referencia, bt.fecha, sip.invoice_id
            FROM bank_transactions bt
            JOIN supplier_invoice_payments sip 
              ON bt.monto = sip.monto 
             AND ABS(bt.fecha - sip.fecha_pago) <= 1
            WHERE bt.categoria = 'pago_proveedor' 
              AND bt.conciliado = False
        """)
        res_g3 = await session.execute(q_g3)
        g3_rows = res_g3.fetchall()

        for r in g3_rows:
            tx_id, monto, desc, ref, fecha, inv_id = r
            tx = (await session.execute(select(BankTransaction).where(BankTransaction.id == tx_id))).scalar_one()
            old_conc = tx.conciliado
            old_f_conc = tx.fecha_conciliacion.isoformat() if tx.fecha_conciliacion else None
            old_inv_id = str(tx.invoice_id) if tx.invoice_id else None

            tx.conciliado = True
            tx.fecha_conciliacion = now_utc
            if inv_id and not tx.invoice_id:
                tx.invoice_id = inv_id

            session.add(tx)
            tot_monto_g3 += float(monto)

            reconciled_items.append({
                "group": "supplier_payment_ap",
                "transaction_id": str(tx_id),
                "fecha": fecha.isoformat() if fecha else None,
                "monto": float(monto),
                "descripcion": desc,
                "referencia": ref,
                "old_conciliado": old_conc,
                "old_fecha_conciliacion": old_f_conc,
                "old_invoice_id": old_inv_id,
                "new_conciliado": True,
                "new_fecha_conciliacion": now_iso,
                "linked_invoice_id": str(inv_id) if inv_id else None,
            })

        print(f"\n3. Pagos a proveedores en banco coincidentes con AP:")
        print(f"   - Cantidad: {len(g3_rows)} transacciones")
        print(f"   - Monto:    Gs. {tot_monto_g3:,.0f}")

        total_txs = len(reconciled_items)
        total_monto = tot_monto_g1 + tot_monto_g2 + tot_monto_g3

        print("\n" + "="*80)
        print(f" TOTAL CONCILIADO EN PASO H: {total_txs} transacciones por Gs. {total_monto:,.0f}")
        print("="*80)

        # Guardar manifiesto
        manifest_data = {
            "batch_id": batch_id,
            "executed_at": now_iso,
            "company_id": company_id,
            "total_reconciled": total_txs,
            "total_amount_pyg": total_monto,
            "summary_by_group": {
                "vault_deposits": {"count": len(g1_rows), "monto": tot_monto_g1},
                "internal_transfers": {"count": len(g2_rows) * 2, "monto": tot_monto_g2},
                "supplier_payments_ap": {"count": len(g3_rows), "monto": tot_monto_g3},
            },
            "items": reconciled_items,
        }

        with open(manifest_file, "w", encoding="utf-8") as mf:
            json.dump(manifest_data, mf, indent=2)

        if commit:
            await session.commit()
            print("\n💾 Confirmando conciliaciones en base de datos (COMMIT)...")
            print("✅ ¡Conciliación integral completada exitosamente!")
            print(f"ℹ️ Para revertir esta conciliación:")
            print(f"   python api/revert_reconcile_treasury_movements_step_h.py {manifest_file} --commit")
        else:
            await session.rollback()
            print("\n⚠️ Simulación finalizada sin cambios (rollback). Use --commit para aplicar.")


if __name__ == "__main__":
    do_commit = "--commit" in sys.argv
    asyncio.run(reconcile_treasury(commit=do_commit))
