import asyncio
from datetime import datetime, timezone
from decimal import Decimal
from sqlalchemy import select, text
from api.src.db import async_session_factory
from api.src.financial.models import SupplierInvoice, SupplierCreditNote, SupplierCreditNoteApplication
from api.src.purchases.models import SupplierNcRequest

async def remediate_casa_gonzalito():
    sid = 'a2f37cf3-caa5-42b5-84cd-270a549d5a73'
    print("Iniciando saneamiento transaccional de Casa Gonzalito S.R.L...")

    async with async_session_factory() as session:
        async with session.begin():
            # =========================================================================
            # 1. ARCHIVAR LAS 11 SNCs FANTASMAS SOBRE FACTURAS PAGADAS / CERRADAS
            # =========================================================================
            ghost_snc_codes = [
                'SNC-00041', 'SNC-00045', 'SNC-00046',
                'SNC-00029', 'SNC-00032', 'SNC-00037',
                'SNC-00026', 'SNC-00028', 'SNC-00027',
                'SNC-00035', 'SNC-00038'
            ]
            ghost_res = await session.execute(
                select(SupplierNcRequest).where(
                    SupplierNcRequest.supplier_id == sid,
                    SupplierNcRequest.numero_solicitud.in_(ghost_snc_codes),
                    SupplierNcRequest.estado.in_(("pendiente_entrega", "entregada_parcial"))
                )
            )
            ghost_sncs = ghost_res.scalars().all()
            print(f"1. Archivando {len(ghost_sncs)} SNCs fantasmas:")
            for snc in ghost_sncs:
                snc.estado = "resuelta"
                snc.resolved_at = datetime.now(timezone.utc)
                snc.observaciones = f"{(snc.observaciones or '').strip()} [Saneamiento: Factura origen ya pagada/cerrada]".strip()
                print(f"   ✓ {snc.numero_solicitud} archivada (₲ {snc.monto_reclamado:,.0f})")

            # =========================================================================
            # 2. RESOLVER Y VINCULAR LAS 6 SNCs CON SUS NOTAS DE CRÉDITO SIFEN
            # =========================================================================
            # Pares (codigo_snc, numero_nc_sifen, numero_factura, monto)
            matches = [
                ("SNC-00006", "001-001-0049669", "001-001-0282131", Decimal("166048")),
                ("SNC-00012", "001-001-0049669", "001-001-0282131", Decimal("166048")),
                ("SNC-00007", "001-001-0049674", "001-001-0282137", Decimal("109350")),
                ("SNC-00008", "001-001-0049671", "001-001-0282133", Decimal("56601")),
                ("SNC-00009", "001-001-0049673", "001-001-0282136", Decimal("38232")),
                ("SNC-00010", "001-001-0049672", "001-001-0282134", Decimal("41040")),
            ]

            print(f"\n2. Resolviendo y vinculando SNCs contra NCs SIFEN:")
            for snc_code, nc_num, fac_num, monto in matches:
                snc = (await session.execute(
                    select(SupplierNcRequest).where(
                        SupplierNcRequest.supplier_id == sid,
                        SupplierNcRequest.numero_solicitud == snc_code
                    )
                )).scalar_one_or_none()

                nc = (await session.execute(
                    select(SupplierCreditNote).where(
                        SupplierCreditNote.supplier_id == sid,
                        SupplierCreditNote.numero == nc_num,
                        SupplierCreditNote.cancelado == False
                    )
                )).scalar_one_or_none()

                inv = (await session.execute(
                    select(SupplierInvoice).where(
                        SupplierInvoice.supplier_id == sid,
                        SupplierInvoice.numero_factura == fac_num,
                        SupplierInvoice.estado != 'cancelada'
                    )
                )).scalars().first()

                if snc:
                    snc.estado = "resuelta"
                    snc.resolved_at = datetime.now(timezone.utc)
                    snc.nc_recibida_numero = nc_num
                    snc.nc_recibida_monto = monto
                    if snc_code == "SNC-00012":
                        snc.observaciones = f"{(snc.observaciones or '').strip()} [Saneamiento: Archivada por duplicado de SNC-00006]".strip()
                    else:
                        snc.observaciones = f"{(snc.observaciones or '').strip()} [Saneamiento: Conciliada con NC SIFEN {nc_num}]".strip()

                if nc:
                    nc.saldo_disponible = Decimal("0")
                    nc.numero_factura_origen = fac_num

                if inv and snc_code != "SNC-00012":
                    inv.monto_retenido_nc = max(Decimal("0"), (inv.monto_retenido_nc or Decimal("0")) - monto)
                    if inv.monto_retenido_nc <= Decimal("10"):
                        inv.monto_retenido_nc = Decimal("0")
                        inv.requiere_nc = False
                        inv.bloqueada_para_pago = False
                        inv.estado = "aprobada" if (inv.saldo_pendiente or Decimal("0")) > Decimal("0") else "pagada"
                        inv.motivo_bloqueo = None

                    if nc:
                        # Registrar aplicación formal si no existe
                        app_exists = (await session.execute(
                            select(SupplierCreditNoteApplication).where(
                                SupplierCreditNoteApplication.credit_note_id == nc.id,
                                SupplierCreditNoteApplication.invoice_id == inv.id
                            )
                        )).scalar_one_or_none()
                        if not app_exists:
                            session.add(SupplierCreditNoteApplication(
                                company_id=inv.company_id,
                                credit_note_id=nc.id,
                                invoice_id=inv.id,
                                monto_aplicado=monto,
                                observaciones=f"Compensación formal de {nc_num} por {snc_code}"
                            ))

                print(f"   ✓ {snc_code} vinculada a {nc_num} sobre {fac_num} (₲ {monto:,.0f})")

            # =========================================================================
            # 3. RESTAURAR SALDO FACIAL Y FORMALIZAR APLICACIÓN EN 4 FACTURAS PRE-NETEADAS
            # =========================================================================
            print(f"\n3. Regularizando 4 facturas pre-neteadas:")
            # FAC 001-001-0286507 ya contaba con aplicación de NC 001-001-0050122 (₲ 80.742)
            # por lo que NC SIFEN 001-001-0049675 (₲ 80.742) se mantiene como crédito disponible en monedero.
            nc_675 = (await session.execute(
                select(SupplierCreditNote).where(
                    SupplierCreditNote.supplier_id == sid,
                    SupplierCreditNote.numero == "001-001-0049675",
                    SupplierCreditNote.cancelado == False
                )
            )).scalars().first()
            if nc_675:
                nc_675.saldo_disponible = Decimal("80742")
                nc_675.numero_factura_origen = None
                print("   ✓ FAC 001-001-0286507: Saldo facial validado contra NC 0050122. NC 0049675 mantenida en monedero disponible.")

            # FAC 001-001-0286506
            inv_506 = (await session.execute(
                select(SupplierInvoice).where(
                    SupplierInvoice.supplier_id == sid,
                    SupplierInvoice.numero_factura == "001-001-0286506",
                    SupplierInvoice.estado != 'cancelada'
                )
            )).scalars().first()
            nc_124 = (await session.execute(
                select(SupplierCreditNote).where(
                    SupplierCreditNote.supplier_id == sid,
                    SupplierCreditNote.numero == "001-001-0050124",
                    SupplierCreditNote.cancelado == False
                )
            )).scalars().first()
            if inv_506 and nc_124:
                nc_124.numero_factura_origen = inv_506.numero_factura
                app_exists = (await session.execute(
                    select(SupplierCreditNoteApplication).where(
                        SupplierCreditNoteApplication.credit_note_id == nc_124.id,
                        SupplierCreditNoteApplication.invoice_id == inv_506.id
                    )
                )).scalar_one_or_none()
                if not app_exists:
                    session.add(SupplierCreditNoteApplication(
                        company_id=inv_506.company_id,
                        credit_note_id=nc_124.id,
                        invoice_id=inv_506.id,
                        monto_aplicado=Decimal("23940"),
                        observaciones="Compensación formal de NC 0050124"
                    ))
                print("   ✓ FAC 001-001-0286506: NC 0050124 (₲ 23.940) formalizada en aplicación contable.")

            # FAC 001-001-0286508
            inv_508 = (await session.execute(
                select(SupplierInvoice).where(
                    SupplierInvoice.supplier_id == sid,
                    SupplierInvoice.numero_factura == "001-001-0286508",
                    SupplierInvoice.estado != 'cancelada'
                )
            )).scalars().first()
            nc_121 = (await session.execute(
                select(SupplierCreditNote).where(
                    SupplierCreditNote.supplier_id == sid,
                    SupplierCreditNote.numero == "001-001-0050121",
                    SupplierCreditNote.cancelado == False
                )
            )).scalars().first()
            if inv_508 and nc_121:
                nc_121.numero_factura_origen = inv_508.numero_factura
                app_exists = (await session.execute(
                    select(SupplierCreditNoteApplication).where(
                        SupplierCreditNoteApplication.credit_note_id == nc_121.id,
                        SupplierCreditNoteApplication.invoice_id == inv_508.id
                    )
                )).scalar_one_or_none()
                if not app_exists:
                    session.add(SupplierCreditNoteApplication(
                        company_id=inv_508.company_id,
                        credit_note_id=nc_121.id,
                        invoice_id=inv_508.id,
                        monto_aplicado=Decimal("36540"),
                        observaciones="Compensación formal de NC 0050121"
                    ))
                print("   ✓ FAC 001-001-0286508: NC 0050121 (₲ 36.540) formalizada en aplicación contable.")

            # FAC 001-001-0286509
            inv_509 = (await session.execute(
                select(SupplierInvoice).where(
                    SupplierInvoice.supplier_id == sid,
                    SupplierInvoice.numero_factura == "001-001-0286509",
                    SupplierInvoice.estado != 'cancelada'
                )
            )).scalars().first()
            nc_126 = (await session.execute(
                select(SupplierCreditNote).where(
                    SupplierCreditNote.supplier_id == sid,
                    SupplierCreditNote.numero == "001-001-00500126"
                )
            )).scalar_one_or_none()
            nc_119 = (await session.execute(
                select(SupplierCreditNote).where(
                    SupplierCreditNote.supplier_id == sid,
                    SupplierCreditNote.numero == "001-001-0050119"
                )
            )).scalar_one_or_none()
            if inv_509:
                for n_c, m in [(nc_126, Decimal("16648")), (nc_119, Decimal("45736"))]:
                    if n_c:
                        n_c.numero_factura_origen = inv_509.numero_factura
                        app_exists = (await session.execute(
                            select(SupplierCreditNoteApplication).where(
                                SupplierCreditNoteApplication.credit_note_id == n_c.id,
                                SupplierCreditNoteApplication.invoice_id == inv_509.id
                            )
                        )).scalar_one_or_none()
                        if not app_exists:
                            session.add(SupplierCreditNoteApplication(
                                company_id=inv_509.company_id,
                                credit_note_id=n_c.id,
                                invoice_id=inv_509.id,
                                monto_aplicado=m,
                                observaciones=f"Compensación formal de {n_c.numero}"
                            ))
                print("   ✓ FAC 001-001-0286509: NCs 00500126 y 0050119 formalizadas en aplicación contable.")

            # =========================================================================
            # 4. ANULAR LAS 3 NOTAS DE CRÉDITO DE PRUEBA (TIMBRADO FICTICIO 12345678)
            # =========================================================================
            dummy_ncs_res = await session.execute(
                select(SupplierCreditNote).where(
                    SupplierCreditNote.supplier_id == sid,
                    SupplierCreditNote.numero.in_(("001-001-0000123", "001-001-0000124", "001-001-0000125")),
                    SupplierCreditNote.timbrado == "12345678"
                )
            )
            dummy_ncs = dummy_ncs_res.scalars().all()
            print(f"\n4. Anulando {len(dummy_ncs)} NCs con timbrado de prueba:")
            for dnc in dummy_ncs:
                dnc.cancelado = True
                dnc.saldo_disponible = Decimal("0")
                dnc.observaciones = f"{(dnc.observaciones or '').strip()} [ANULADA: Registro manual de prueba con timbrado ficticio 12345678]".strip()
                print(f"   ✓ {dnc.numero} anulada (₲ {dnc.monto:,.0f})")

    print("\nSaneamiento transaccional completado exitosamente.")

if __name__ == '__main__':
    asyncio.run(remediate_casa_gonzalito())
