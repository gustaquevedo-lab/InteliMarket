import asyncio
from decimal import Decimal
from sqlalchemy import text
from api.src.db import async_session_factory

async def audit():
    async with async_session_factory() as s:
        sid = 'a2f37cf3-caa5-42b5-84cd-270a549d5a73'
        
        print("="*80)
        print("AUDITORÍA PROFUNDA DE CUENTAS POR PAGAR — CASA GONZALITO S.R.L.")
        print("="*80)

        # 1. Facturas Activas con Saldo > 0
        invs_active = (await s.execute(text("""
            SELECT id, numero_factura, timbrado, fecha_emision, fecha_vencimiento,
                   total, saldo_pendiente, monto_retenido_nc, bloqueada_para_pago,
                   estado, notas, motivo_bloqueo
            FROM supplier_invoices
            WHERE supplier_id = :sid AND saldo_pendiente > 0 AND estado != 'cancelada'
            ORDER BY fecha_emision ASC
        """), {'sid': sid})).mappings().all()

        total_saldo_sistema = sum(i['saldo_pendiente'] for i in invs_active)
        total_nominal_activas = sum(i['total'] for i in invs_active)
        total_retenido_snc = sum(i['monto_retenido_nc'] or 0 for i in invs_active)

        print(f"\n1. SALDO GLOBAL EN SISTEMA:")
        print(f"   - Cantidad de facturas pendientes: {len(invs_active)}")
        print(f"   - Total nominal de facturas pendientes: ₲ {total_nominal_activas:,.0f}")
        print(f"   - Saldo pendiente registrado en sistema: ₲ {total_saldo_sistema:,.0f}")
        print(f"   - Retenciones SNC activas en facturas: ₲ {total_retenido_snc:,.0f}")

        # 2. Facturas duplicadas con saldo pendiente
        inv_by_num = {}
        for inv in invs_active:
            num = (inv['numero_factura'] or '').strip()
            inv_by_num.setdefault(num, []).append(inv)
        
        dups = {k: v for k, v in inv_by_num.items() if len(v) > 1}
        print(f"\n2. FACTURAS DUPLICADAS CON SALDO PENDIENTE: {len(dups)}")
        total_dup_amount = 0
        for num, v in dups.items():
            print(f"   FAC {num}: {len(v)} registros activos:")
            for item in v:
                print(f"      ID: {item['id']} | Total: ₲ {item['total']:,.0f} | Saldo: ₲ {item['saldo_pendiente']:,.0f} | Fecha: {item['fecha_emision']} | Est: {item['estado']}")
                total_dup_amount += item['saldo_pendiente']

        # 3. Facturas pre-neteadas injustificadas (saldo < total sin registro de pago o NC aplicada)
        print(f"\n3. CASOS DE PRE-NETEO (Saldo facial mutado sin comprobante ni aplicación formal):")
        netted_invs = []
        for inv in invs_active:
            if 0 < inv['saldo_pendiente'] < inv['total']:
                diff = inv['total'] - inv['saldo_pendiente']
                if diff > 10: # ignorar redondeos de 1 guaraní
                    # Verificar si existe aplicación formal registrada
                    apps_sum = (await s.execute(text("""
                        SELECT COALESCE(SUM(monto_aplicado), 0)
                        FROM supplier_credit_note_applications
                        WHERE invoice_id = :inv_id
                    """), {'inv_id': inv['id']})).scalar() or 0
                    if abs(diff - apps_sum) > 10:
                        netted_invs.append((inv, diff, apps_sum))
                        print(f"   [NETEO NO JUSTIFICADO] FAC {inv['numero_factura']} | Total Facial: ₲ {inv['total']:,.0f} | Saldo Mutado: ₲ {inv['saldo_pendiente']:,.0f} | Diferencia: ₲ {diff:,.0f} | Aplicado Formal: ₲ {apps_sum:,.0f} | Est: {inv['estado']}")
                    else:
                        print(f"   [COMPENSACIÓN FORMAL OK] FAC {inv['numero_factura']} | Total: ₲ {inv['total']:,.0f} | Saldo Exigible: ₲ {inv['saldo_pendiente']:,.0f} | NC Aplicada: ₲ {apps_sum:,.0f}")


        # 4. Notas de Crédito con saldo disponible > 0
        ncs_avail = (await s.execute(text("""
            SELECT id, numero, timbrado, monto, saldo_disponible, cancelado,
                   numero_factura_origen, fecha, observaciones
            FROM supplier_credit_notes
            WHERE supplier_id = :sid AND saldo_disponible > 0 AND cancelado = FALSE
            ORDER BY fecha ASC
        """), {'sid': sid})).mappings().all()

        total_nc_avail = sum(n['saldo_disponible'] for n in ncs_avail)
        print(f"\n4. NOTAS DE CRÉDITO ACTIVAS / DISPONIBLES: {len(ncs_avail)} comprobantes")
        print(f"   - Saldo Total Disponible en NCs: ₲ {total_nc_avail:,.0f}")
        for n in ncs_avail:
            print(f"   NC {n['numero']} | Timbrado: {n['timbrado']} | Fecha: {n['fecha']} | Monto: ₲ {n['monto']:,.0f} | Disp: ₲ {n['saldo_disponible']:,.0f} | Obs: {n['observaciones'][:70]}")

        # 5. Solicitudes de NC (SNC) Pendientes y Diagnóstico de Obsolecencia
        sncs = (await s.execute(text("""
            SELECT snc.id, snc.numero_solicitud, snc.tipo_motivo, snc.monto_reclamado,
                   snc.estado, snc.invoice_id, snc.observaciones, snc.created_at,
                   inv.numero_factura, inv.saldo_pendiente as fac_saldo, inv.total as fac_total,
                   inv.estado as fac_estado
            FROM supplier_nc_requests snc
            LEFT JOIN supplier_invoices inv ON inv.id = snc.invoice_id
            WHERE snc.supplier_id = :sid AND snc.estado NOT IN ('resuelta', 'cancelada', 'archivada')
            ORDER BY snc.created_at ASC
        """), {'sid': sid})).mappings().all()

        print(f"\n5. DIAGNÓSTICO DE SOLICITUDES DE NC (SNC PENDIENTES): {len(sncs)} reclamos")
        total_snc_reclamado = sum(s['monto_reclamado'] for s in sncs)
        print(f"   - Total Reclamado en SNCs: ₲ {total_snc_reclamado:,.0f}")
        
        sncs_on_paid_invoices = []
        sncs_matched_sifen = []
        sncs_legitimate_pending = []

        for snc in sncs:
            monto = snc['monto_reclamado']
            fac_saldo = snc['fac_saldo']
            fac_estado = snc['fac_estado']
            
            # Buscar si hay NC de SIFEN que calza con este monto
            matching_sifen_nc = [n for n in ncs_avail if abs(n['monto'] - monto) < 10]
            
            if fac_saldo == 0 or fac_estado == 'pagada':
                sncs_on_paid_invoices.append(snc)
                print(f"   [FANTASMA - FAC YA PAGADA] SNC {snc['numero_solicitud']} | Monto: ₲ {monto:,.0f} | FAC: {snc['numero_factura']} (Saldo 0, Pagada) | Obs: {snc['observaciones'][:60]}")
            elif matching_sifen_nc:
                nc_ref = matching_sifen_nc[0]
                sncs_matched_sifen.append((snc, nc_ref))
                print(f"   [YA EMITIDA POR PROVEEDOR EN SIFEN] SNC {snc['numero_solicitud']} | Monto: ₲ {monto:,.0f} | FAC: {snc['numero_factura']} ==> Calza con NC SIFEN {nc_ref['numero']} (₲ {nc_ref['monto']:,.0f})")
            else:
                sncs_legitimate_pending.append(snc)
                print(f"   [RECLAMO PENDIENTE REAL] SNC {snc['numero_solicitud']} | Monto: ₲ {monto:,.0f} | FAC: {snc['numero_factura']} (Saldo: ₲ {fac_saldo:,.0f}) | Obs: {snc['observaciones'][:60]}")

        total_snc_fantasma = sum(s['monto_reclamado'] for s in sncs_on_paid_invoices)
        total_snc_sifen = sum(s['monto_reclamado'] for s, _ in sncs_matched_sifen)
        total_snc_real = sum(s['monto_reclamado'] for s in sncs_legitimate_pending)

        print(f"\n   RESUMEN SNCs:")
        print(f"   - SNCs Fantasmas (sobre facturas pagadas/cerradas): ₲ {total_snc_fantasma:,.0f} ({len(sncs_on_paid_invoices)} SNCs)")
        print(f"   - SNCs ya emitidas por SIFEN pero no conciliadas: ₲ {total_snc_sifen:,.0f} ({len(sncs_matched_sifen)} SNCs)")
        print(f"   - SNCs legítimas aún pendientes de NC del proveedor: ₲ {total_snc_real:,.0f} ({len(sncs_legitimate_pending)} SNCs)")

        # 6. Cheques en Cartera / Entregados no cobrados
        chqs_active = (await s.execute(text("""
            SELECT id, numero, banco_emisor, monto, fecha_emision, fecha_pago,
                   diferido, estado, concepto, notas
            FROM cheques
            WHERE (supplier_id = :sid OR beneficiario ILIKE '%gonzalito%')
              AND estado IN ('emitido', 'entregado', 'en_cartera', 'pendiente')
            ORDER BY fecha_pago ASC
        """), {'sid': sid})).mappings().all()

        total_chqs = sum(c['monto'] for c in chqs_active)
        print(f"\n6. CHEQUES DIFERIDOS EMITIDOS (Compromisos en tránsito):")
        print(f"   - Cantidad de cheques en tránsito: {len(chqs_active)}")
        print(f"   - Total cheques en tránsito: ₲ {total_chqs:,.0f}")

        # 7. Conciliación y Deuda Neta Auditada
        print("\n" + "="*80)
        print("CONCILIACIÓN FINAL Y DEUDA REAL EXIGIBLE AUDITADA:")
        print("="*80)
        print(f"1. Saldo Bruto Pendiente de Facturas en Sistema:      ₲ {total_saldo_sistema:>14,.0f}")
        print(f"   (-) NCs disponibles recibidas por SIFEN:          - ₲ {total_nc_avail:>14,.0f}")
        saldo_neto_comprobantes = total_saldo_sistema - total_nc_avail
        print(f"   (=) Saldo Neto de Comprobantes Contables:          ₲ {saldo_neto_comprobantes:>14,.0f}")
        print(f"   (-) Cheques diferidos emitidos en tránsito:       - ₲ {total_chqs:>14,.0f}")
        saldo_neto_exigible = saldo_neto_comprobantes - total_chqs
        print(f"   (=) DEUDA NETA REAL EXIGIBLE A LA FECHA:           ₲ {saldo_neto_exigible:>14,.0f}")
        print(f"   (Información: Retenciones SNC legítimas pendientes: ₲ {total_snc_real:>14,.0f})")
        print("="*80)

if __name__ == '__main__':
    asyncio.run(audit())
