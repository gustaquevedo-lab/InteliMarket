"""
Script de saneamiento definitivo de facturas duplicadas de proveedores en InteliMarket.
Identifica los pares/grupos duplicados activos por (company_id, supplier_id, numero_factura).
Conserva el registro canónico (el que tenga pagos, recibo o mayor antigüedad) y cancela
el duplicado fantasma, enriqueciendo el canónico si el duplicado tenía CDC/timbrado/XML.
"""

import asyncio
import sys
from decimal import Decimal
from sqlalchemy import text
from api.src.db import async_session_factory
from collections import defaultdict

async def run_remediation(apply_changes: bool = False):
    print(f"=== INICIANDO SANEAMIENTO DE FACTURAS DUPLICADAS (apply={apply_changes}) ===")
    
    async with async_session_factory() as session:
        # 1. Buscar grupos de facturas duplicadas activas (estado no cancelado)
        q = text('''
            SELECT si.company_id, si.supplier_id, s.razon_social, si.numero_factura, count(*) as qty
            FROM supplier_invoices si
            JOIN suppliers s ON s.id = si.supplier_id
            WHERE si.numero_factura IS NOT NULL AND si.numero_factura != ''
              AND si.estado NOT IN ('cancelada', 'cancelado', 'anulada')
            GROUP BY si.company_id, si.supplier_id, s.razon_social, si.numero_factura
            HAVING count(*) > 1
            ORDER BY s.razon_social, si.numero_factura;
        ''')
        res = await session.execute(q)
        groups = [dict(r._mapping) for r in res.fetchall()]
        print(f"Total grupos duplicados encontrados: {len(groups)}")

        total_cleaned = 0
        total_monto_anulado = Decimal("0")

        for g in groups:
            cid = g['company_id']
            sup_id = g['supplier_id']
            num_fac = g['numero_factura']
            sup_nom = g['razon_social']

            # Obtener todas las facturas del grupo con conteo de pagos
            inv_q = text('''
                SELECT si.id, si.numero_factura, si.timbrado, si.cdc, si.xml_sifen_url,
                       si.total, si.saldo_pendiente, si.estado, si.created_at,
                       si.receipt_id, si.purchase_order_id, si.notas, si.concepto,
                       (SELECT count(*) FROM supplier_invoice_payments p WHERE p.invoice_id = si.id) as payment_count
                FROM supplier_invoices si
                WHERE si.company_id = :cid AND si.supplier_id = :sup_id AND si.numero_factura = :num_fac
                  AND si.estado NOT IN ('cancelada', 'cancelado', 'anulada')
                ORDER BY payment_count DESC, 
                         (si.receipt_id IS NOT NULL) DESC, 
                         (si.cdc IS NOT NULL) DESC,
                         si.created_at ASC;
            ''')
            inv_res = await session.execute(inv_q, {"cid": cid, "sup_id": sup_id, "num_fac": num_fac})
            invs = [dict(r._mapping) for r in inv_res.fetchall()]

            if len(invs) <= 1:
                continue

            # El primero según el ordenamiento es el canónico:
            # 1. Prioriza el que tiene pagos reales vinculados
            # 2. Prioriza el que tiene muelle/recepción vinculada
            # 3. Prioriza el que tiene CDC fiscal
            # 4. Prioriza el más antiguo
            canon = invs[0]
            duplicates = invs[1:]

            print(f"\nGRUPO: {sup_nom} | Fac: {num_fac}")
            print(f"  [CANÓNICO] ID: {canon['id']} | Tot: {canon['total']} | Saldo: {canon['saldo_pendiente']} | Est: {canon['estado']} | Pagos: {canon['payment_count']} | Rec: {canon['receipt_id']}")

            canon_needs_update = False
            update_fields = {}

            for dup in duplicates:
                print(f"  [DUPLICADO A ANULAR] ID: {dup['id']} | Tot: {dup['total']} | Saldo: {dup['saldo_pendiente']} | Est: {dup['estado']} | Pagos: {dup['payment_count']} | Rec: {dup['receipt_id']}")
                
                # Si el duplicado tiene pagos pero el canónico no, o ambos tienen pagos:
                if dup['payment_count'] > 0:
                    if canon['payment_count'] == 0:
                        print(f"     ADVERTENCIA: El duplicado tiene {dup['payment_count']} pagos y el canónico 0. Invertir roles!")
                        # Invertir roles
                        canon, dup = dup, canon
                    else:
                        print(f"     Moviendo pagos del duplicado {dup['id']} al canónico {canon['id']}...")
                        if apply_changes:
                            await session.execute(text('''
                                UPDATE supplier_invoice_payments
                                SET invoice_id = :canon_id
                                WHERE invoice_id = :dup_id
                            '''), {"canon_id": canon['id'], "dup_id": dup['id']})

                if apply_changes:
                    # Re-vincular cualquier asignación de orden de pago o crédito
                    await session.execute(text('''
                        UPDATE supplier_payment_order_allocations
                        SET invoice_id = :canon_id
                        WHERE invoice_id = :dup_id
                    '''), {"canon_id": canon['id'], "dup_id": dup['id']})
                    await session.execute(text('''
                        UPDATE supplier_credit_note_applications
                        SET invoice_id = :canon_id
                        WHERE invoice_id = :dup_id
                    '''), {"canon_id": canon['id'], "dup_id": dup['id']})
                    await session.execute(text('''
                        UPDATE payment_run_items
                        SET invoice_id = :canon_id
                        WHERE invoice_id = :dup_id
                    '''), {"canon_id": canon['id'], "dup_id": dup['id']})
                    await session.execute(text('''
                        UPDATE supplier_nc_requests
                        SET invoice_id = :canon_id
                        WHERE invoice_id = :dup_id
                    '''), {"canon_id": canon['id'], "dup_id": dup['id']})

                # Si el duplicado tiene CDC fiscal y el canónico no, enriquecer el canónico
                if dup['cdc'] and not canon['cdc']:
                    update_fields['cdc'] = dup['cdc']
                    canon_needs_update = True
                if dup['timbrado'] and not canon['timbrado']:
                    update_fields['timbrado'] = dup['timbrado']
                    canon_needs_update = True
                if dup['xml_sifen_url'] and not canon['xml_sifen_url']:
                    update_fields['xml_sifen_url'] = dup['xml_sifen_url']
                    canon_needs_update = True
                if dup['receipt_id'] and not canon['receipt_id']:
                    update_fields['receipt_id'] = dup['receipt_id']
                    canon_needs_update = True
                if dup['purchase_order_id'] and not canon['purchase_order_id']:
                    update_fields['purchase_order_id'] = dup['purchase_order_id']
                    canon_needs_update = True

                # Anular / cancelar el duplicado
                if apply_changes:
                    cancel_note = f"[CANCELADO AUTOMÁTICAMENTE: Duplicado de {canon['id']}]. {dup['notas'] or ''}".strip()
                    await session.execute(text('''
                        UPDATE supplier_invoices
                        SET estado = 'cancelada',
                            saldo_pendiente = 0,
                            notas = :cancel_note,
                            updated_at = now()
                        WHERE id = :dup_id
                    '''), {"dup_id": dup['id'], "cancel_note": cancel_note})

                total_cleaned += 1
                total_monto_anulado += Decimal(str(dup['saldo_pendiente'] or 0))

            if apply_changes and canon_needs_update:
                set_clauses = [f"{k} = :{k}" for k in update_fields.keys()]
                update_fields['canon_id'] = canon['id']
                await session.execute(text(f'''
                    UPDATE supplier_invoices
                    SET {', '.join(set_clauses)}, updated_at = now()
                    WHERE id = :canon_id
                '''), update_fields)

        if apply_changes:
            await session.commit()
            print(f"\n✓ SANEAMIENTO COMPLETADO Y CONFIRMADO EN BD.")
        else:
            print(f"\n--- SIMULACIÓN FINALIZADA (DRY-RUN). No se modificó la BD. ---")

        print(f"Total registros duplicados saneados: {total_cleaned}")
        print(f"Monto total de deuda ficticia duplicada anulada: {total_monto_anulado:,.0f} Gs.")

if __name__ == "__main__":
    apply = "--apply" in sys.argv
    asyncio.run(run_remediation(apply_changes=apply))
