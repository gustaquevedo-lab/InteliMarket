import asyncio
from decimal import Decimal
from collections import defaultdict
from sqlalchemy import text
from api.src.db import async_session_factory

async def audit_global():
    print("=" * 100)
    print("AUDITORÍA GLOBAL DE CUENTAS POR PAGAR — TODOS LOS PROVEEDORES")
    print("=" * 100)

    async with async_session_factory() as s:
        # 1. Facturas pendientes globales
        invs_res = await s.execute(text("""
            SELECT i.id, i.company_id, i.supplier_id, i.numero_factura, i.timbrado,
                   i.fecha_emision, i.total, i.saldo_pendiente, i.estado,
                   i.bloqueada_para_pago, i.requiere_nc, i.monto_retenido_nc,
                   p.razon_social, p.ruc
            FROM supplier_invoices i
            JOIN suppliers p ON p.id = i.supplier_id
            WHERE i.estado NOT IN ('cancelada', 'pagada') AND i.saldo_pendiente > 0
            ORDER BY p.razon_social ASC, i.fecha_emision ASC
        """))
        active_invs = invs_res.mappings().all()

        total_nominal = sum(i['total'] for i in active_invs)
        total_saldo = sum(i['saldo_pendiente'] for i in active_invs)
        total_retenciones = sum(i['monto_retenido_nc'] or 0 for i in active_invs)

        print(f"\n1. PANORAMA GLOBAL DE FACTURAS ACTIVAS:")
        print(f"   - Total facturas pendientes en sistema: {len(active_invs)}")
        print(f"   - Importe nominal total: ₲ {total_nominal:,.0f}")
        print(f"   - Saldo pendiente total registrado: ₲ {total_saldo:,.0f}")
        print(f"   - Retenciones SNC activas: ₲ {total_retenciones:,.0f}")

        # Agrupar por proveedor
        invs_by_sup = defaultdict(list)
        for inv in active_invs:
            invs_by_sup[inv['supplier_id']].append(inv)

        print(f"   - Proveedores con deuda activa: {len(invs_by_sup)}")

        # 2. Facturas Duplicadas Activas (mismo proveedor y mismo numero_factura)
        print(f"\n2. FACTURAS DUPLICADAS CON SALDO PENDIENTE:")
        dup_cases = []
        for sid, invs in invs_by_sup.items():
            by_num = defaultdict(list)
            for inv in invs:
                num = (inv['numero_factura'] or '').strip()
                if num:
                    by_num[num].append(inv)
            for num, group in by_num.items():
                if len(group) > 1:
                    dup_cases.append((group[0]['razon_social'], num, group))

        if not dup_cases:
            print("   ✓ 0 facturas duplicadas activas en todo el sistema.")
        else:
            print(f"   ⚠️ SE DETECTARON {len(dup_cases)} NÚMEROS DE FACTURA DUPLICADOS:")
            for sup_name, num, group in dup_cases:
                print(f"   - {sup_name} | FAC {num} ({len(group)} registros):")
                for item in group:
                    print(f"       ID: {item['id']} | Total: ₲ {item['total']:,.0f} | Saldo: ₲ {item['saldo_pendiente']:,.0f} | Fecha: {item['fecha_emision']} | Est: {item['estado']}")

        # 3. Casos de Pre-Neteo / Saldo Mutado sin Justificación Contable
        print(f"\n3. AUDITORÍA DE PRE-NETEO (Saldo < Total sin respaldo contable):")
        # Traer todas las aplicaciones de NC y pagos para facturas activas
        active_inv_ids = [i['id'] for i in active_invs]
        
        apps_res = await s.execute(text("""
            SELECT invoice_id, COALESCE(SUM(monto_aplicado), 0) as total_nc_aplicado
            FROM supplier_credit_note_applications
            GROUP BY invoice_id
        """))
        apps_map = {r['invoice_id']: r['total_nc_aplicado'] for r in apps_res.mappings()}

        disb_res = await s.execute(text("""
            SELECT invoice_id, COALESCE(SUM(monto), 0) as total_pagado
            FROM supplier_invoice_payments
            GROUP BY invoice_id
        """))
        disb_map = {r['invoice_id']: r['total_pagado'] for r in disb_res.mappings()}

        unjustified_netting = []
        for inv in active_invs:
            if 0 < inv['saldo_pendiente'] < inv['total']:
                diff = inv['total'] - inv['saldo_pendiente']
                if diff > 10:  # Tolerancia mínima 10 Gs
                    nc_app = apps_map.get(inv['id'], Decimal("0"))
                    pagos = disb_map.get(inv['id'], Decimal("0"))
                    justificado = nc_app + pagos
                    discrepancia = diff - justificado
                    if abs(discrepancia) > 10:
                        unjustified_netting.append((inv, diff, justificado, discrepancia))

        if not unjustified_netting:
            print("   ✓ 0 facturas con pre-neteo injustificado. Todos los saldos parciales tienen respaldo contable.")
        else:
            print(f"   ⚠️ SE DETECTARON {len(unjustified_netting)} FACTURAS CON SALDO MUTADO SIN RESPALDO:")
            for inv, diff, just, disc in unjustified_netting:
                print(f"   - {inv['razon_social']} | FAC {inv['numero_factura']} | Total: ₲ {inv['total']:,.0f} | Saldo: ₲ {inv['saldo_pendiente']:,.0f} | Diferencia: ₲ {diff:,.0f} | Respaldo (NCs+Pagos): ₲ {just:,.0f} | Desfasaje: ₲ {disc:,.0f}")

        # 4. Solicitudes de NC (SNCs) Fantasmas (Facturas pagadas o con saldo 0)
        print(f"\n4. AUDITORÍA DE SOLICITUDES DE NC (SNCs) HUÉRFANAS O FANTASMAS:")
        snc_res = await s.execute(text("""
            SELECT snc.id, snc.numero_solicitud, snc.monto_reclamado, snc.estado,
                   snc.invoice_id, snc.created_at, snc.observaciones,
                   i.numero_factura, i.saldo_pendiente as fac_saldo, i.total as fac_total,
                   i.estado as fac_estado, p.razon_social
            FROM supplier_nc_requests snc
            JOIN suppliers p ON p.id = snc.supplier_id
            LEFT JOIN supplier_invoices i ON i.id = snc.invoice_id
            WHERE snc.estado NOT IN ('resuelta', 'cancelada', 'archivada')
            ORDER BY snc.created_at ASC
        """))
        all_sncs = snc_res.mappings().all()

        ghost_sncs = []
        active_legit_sncs = []
        for snc in all_sncs:
            if not snc['invoice_id']:
                continue
            fac_saldo = snc['fac_saldo'] or Decimal("0")
            fac_estado = snc['fac_estado'] or ""
            if fac_saldo <= 0 or fac_estado in ('pagada', 'cancelada'):
                ghost_sncs.append(snc)
            else:
                active_legit_sncs.append(snc)

        if not ghost_sncs:
            print(f"   ✓ 0 SNCs fantasmas sobre facturas pagadas/cerradas.")
        else:
            total_ghost = sum(s['monto_reclamado'] for s in ghost_sncs)
            print(f"   ⚠️ SE DETECTARON {len(ghost_sncs)} SNCs FANTASMAS (₲ {total_ghost:,.0f}):")
            for s_item in ghost_sncs:
                print(f"   - {s_item['razon_social']} | SNC: {s_item['numero_solicitud']} | Monto: ₲ {s_item['monto_reclamado']:,.0f} | FAC: {s_item['numero_factura']} (Saldo: ₲ {s_item['fac_saldo'] or 0:,.0f}, Estado: {s_item['fac_estado']})")

        print(f"   - SNCs legítimas activas en espera de NC: {len(active_legit_sncs)} (Total: ₲ {sum(s['monto_reclamado'] for s in active_legit_sncs):,.0f})")

        # 5. Notas de Crédito Disponibles vs SNCs Abiertas (Cruce SIFEN desvinculado)
        print(f"\n5. CRUCE DE NOTAS DE CRÉDITO SIFEN CON SALDO DISPONIBLE VS SNCs ABIERTAS:")
        ncs_res = await s.execute(text("""
            SELECT c.id, c.numero, c.timbrado, c.monto, c.saldo_disponible, c.fecha,
                   c.numero_factura_origen, c.supplier_id, p.razon_social
            FROM supplier_credit_notes c
            JOIN suppliers p ON p.id = c.supplier_id
            WHERE c.saldo_disponible > 0 AND c.cancelado = FALSE
            ORDER BY p.razon_social ASC, c.fecha ASC
        """))
        available_ncs = ncs_res.mappings().all()
        print(f"   - Total NCs con saldo disponible en sistema: {len(available_ncs)} (₲ {sum(n['saldo_disponible'] for n in available_ncs):,.0f})")

        unlinked_matches = []
        for nc in available_ncs:
            # Buscar si hay alguna SNC abierta del mismo proveedor con monto idéntico
            matching_sncs = [
                s for s in active_legit_sncs
                if s['razon_social'] == nc['razon_social'] and abs(s['monto_reclamado'] - nc['monto']) <= 10
            ]
            if matching_sncs:
                unlinked_matches.append((nc, matching_sncs[0]))

        if not unlinked_matches:
            print("   ✓ 0 NCs de SIFEN desvinculadas de SNCs abiertas.")
        else:
            print(f"   ⚠️ SE DETECTARON {len(unlinked_matches)} NCs SIFEN QUE COINCIDEN CON SNCs PENDIENTES:")
            for nc, snc in unlinked_matches:
                print(f"   - {nc['razon_social']} | NC: {nc['numero']} (₲ {nc['monto']:,.0f}) coincide con {snc['numero_solicitud']} de FAC {snc['numero_factura']}")

        # 6. Notas de Crédito de Prueba o Ficticias (timbrados 12345678, etc.)
        dummy_ncs = [n for n in available_ncs if n['timbrado'] in ('12345678', '00000000', '11111111') or n['numero'] in ('0000123', '0000124', '0000125')]
        if dummy_ncs:
            print(f"\n6. ⚠️ NCs DE PRUEBA DETECTADAS CON SALDO DISPONIBLE: {len(dummy_ncs)}")
            for d in dummy_ncs:
                print(f"   - {d['razon_social']} | NC {d['numero']} | Timbrado: {d['timbrado']} | Monto: ₲ {d['monto']:,.0f}")
        else:
            print(f"\n6. ✓ 0 NCs con timbrados de prueba en monedero activo.")

        # 7. Resumen de salud general
        print("\n" + "=" * 100)
        print("RESUMEN DE SALUD CONTABLE GLOBAL:")
        print(f"   - Facturas Duplicadas:          {len(dup_cases)}")
        print(f"   - Pre-neteos Injustificados:    {len(unjustified_netting)}")
        print(f"   - SNCs Fantasmas:               {len(ghost_sncs)}")
        print(f"   - NCs SIFEN sin vincular a SNC: {len(unlinked_matches)}")
        print(f"   - NCs de prueba activas:        {len(dummy_ncs)}")
        print("=" * 100)

if __name__ == '__main__':
    asyncio.run(audit_global())
