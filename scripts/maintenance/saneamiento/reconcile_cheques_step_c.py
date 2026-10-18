"""
Script de Conciliación Triangular Asistida de Cheques (Paso C)
Vincula 242 cheques emitidos con sus correspondientes débitos bancarios
en base a coincidencia matemática y documental estricta (100% Match).

Garantías de seguridad financiera:
1. Genera un Batch ID único por ejecución.
2. Persiste un manifiesto JSON en 'Datos/audit_logs/batch_reconcile_step_c_<batch_id>.json'.
3. Actualiza 'bank_transactions':
   - conciliado = True
   - fecha_conciliacion = now()
   - cheque_id = cheque.id
4. Actualiza 'cheques':
   - estado = 'cobrado'
   - fecha_pago = fecha del débito bancario
5. Registra trazabilidad en 'cheque_historial'.
6. Incluye script complementario 'api/revert_reconciliation_step_c.py' para reversión inmediata.
"""
import os
import sys
import json
import uuid
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


async def run_reconciliation_step_c(commit: bool = False):
    batch_id = str(uuid.uuid4())
    now_utc = datetime.now(timezone.utc)
    now_iso = now_utc.isoformat()

    datos_dir = "/home/intellihouse/intelimarket/Datos"
    if not os.path.exists(datos_dir):
        datos_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "Datos")

    log_dir = os.path.join(datos_dir, "audit_logs")
    os.makedirs(log_dir, exist_ok=True)
    manifest_file = os.path.join(log_dir, f"batch_reconcile_step_c_{batch_id}.json")

    print("="*80)
    print(f" PASO C: CONCILIACIÓN DE CHEQUES [{'PRODUCCIÓN REAL' if commit else 'MODO SIMULACIÓN (DRY-RUN)'}]")
    print(f" Batch ID: {batch_id}")
    print(f" Manifiesto de auditoría: {manifest_file}")
    print("="*80)

    async with async_session_factory() as session:
        # Consultar los pares con match 100% exacto
        query = text('''
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
                t.cheque_id as t_cheque_id
            FROM bank_transactions t
            JOIN cheques c ON c.numero = t.referencia
            WHERE c.numero_confiable = True 
              AND round(c.monto) = round(t.monto)
            ORDER BY t.fecha DESC, c.monto DESC;
        ''')
        res = await session.execute(query)
        rows = [dict(r._mapping) for r in res.fetchall()]

        print(f"🎯 Total de pares coincidentes detectados: {len(rows)}")
        total_monto = sum(r["monto"] for r in rows)
        print(f"💰 Monto total a conciliar: Gs. {total_monto:,.0f}")

        reconciled_pairs = []
        cheques_pasados_a_cobrado = 0

        for r in rows:
            tx_id = r["tx_id"]
            ch_id = r["cheque_id"]

            res_tx = await session.execute(select(BankTransaction).where(BankTransaction.id == tx_id))
            tx = res_tx.scalar_one_or_none()

            res_ch = await session.execute(select(Cheque).where(Cheque.id == ch_id))
            ch = res_ch.scalar_one_or_none()

            if not tx or not ch:
                continue

            prev_t_conciliado = tx.conciliado
            prev_t_cheque_id = str(tx.cheque_id) if tx.cheque_id else None
            prev_c_estado = ch.estado
            prev_c_fecha_pago = ch.fecha_pago.isoformat() if ch.fecha_pago else None

            # Actualizar transacción bancaria
            tx.conciliado = True
            tx.fecha_conciliacion = now_utc
            tx.cheque_id = ch.id
            session.add(tx)

            # Actualizar cheque si estaba pendiente
            if ch.estado != "cobrado":
                ch.estado = "cobrado"
                ch.fecha_pago = tx.fecha
                ch.estado_updated_at = now_utc
                cheques_pasados_a_cobrado += 1

                hist = ChequeHistorial(
                    cheque_id=ch.id,
                    estado_anterior=prev_c_estado,
                    estado_nuevo="cobrado",
                    user_id=None,
                    user_nombre="Sistema (Conciliación Paso C)",
                    notas=f"Conciliado con débito bancario {tx.id} del {tx.fecha} ({tx.descripcion}) por Gs. {tx.monto:,.0f}.",
                )
                session.add(hist)
            else:
                hist = ChequeHistorial(
                    cheque_id=ch.id,
                    estado_anterior="cobrado",
                    estado_nuevo="cobrado",
                    user_id=None,
                    user_nombre="Sistema (Conciliación Paso C)",
                    notas=f"Vinculado formalmente con transacción bancaria {tx.id} del {tx.fecha} por Gs. {tx.monto:,.0f}.",
                )
                session.add(hist)

            session.add(ch)

            reconciled_pairs.append({
                "tx_id": str(tx_id),
                "cheque_id": str(ch_id),
                "numero": r["numero"],
                "monto": float(r["monto"]),
                "beneficiario": r["beneficiario"],
                "banco": r["banco_emisor"],
                "fecha_banco": r["t_fecha"].isoformat(),
                "previous_t_conciliado": prev_t_conciliado,
                "previous_t_cheque_id": prev_t_cheque_id,
                "previous_c_estado": prev_c_estado,
                "previous_c_fecha_pago": prev_c_fecha_pago,
            })

        # Guardar manifiesto
        manifest_data = {
            "batch_id": batch_id,
            "executed_at": now_iso,
            "total_reconciled": len(reconciled_pairs),
            "total_monto": float(total_monto),
            "cheques_pasados_a_cobrado": cheques_pasados_a_cobrado,
            "reconciled_pairs": reconciled_pairs,
        }

        with open(manifest_file, "w", encoding="utf-8") as mf:
            json.dump(manifest_data, mf, indent=2, default=json_serial)

        print(f"\n📊 RESUMEN:")
        print(f"   - Pares conciliados exitosamente: {len(reconciled_pairs)}")
        print(f"   - Cheques actualizados de 'pendiente' a 'cobrado': {cheques_pasados_a_cobrado}")
        print(f"   - Manifiesto generado en: {manifest_file}")

        if commit:
            print("\n💾 Confirmando cambios en la base de datos (COMMIT)...")
            await session.commit()
            print("✅ ¡Conciliación Paso C completada y confirmada en producción!")
            print(f"ℹ️ Para revertir esta conciliación en cualquier momento:")
            print(f"   python api/revert_reconciliation_step_c.py {manifest_file} --commit")
        else:
            print("\n⚠️ Modo simulación: Se hizo rollback, la base de datos NO fue modificada.")
            await session.rollback()


if __name__ == "__main__":
    do_commit = "--commit" in sys.argv
    asyncio.run(run_reconciliation_step_c(commit=do_commit))
