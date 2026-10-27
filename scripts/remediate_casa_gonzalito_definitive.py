"""Script de remediación definitiva, canónica e integral de cuentas por pagar para Casa Gonzalito S.R.L.

Corrige de raíz:
1. Las facturas amputadas/pre-neteadas, restaurando sus valores faciales canónicos de SIFEN.
2. La vinculación de recepciones de muelle huérfanas a sus facturas correspondientes.
3. La eliminación/anulación de facturas duplicadas erróneas (0010010282138o).
4. El renombramiento de facturas ficticias AUTO-REC- a sus números reales de proveedor.
5. La vinculación formal de las 6 NCs de SIFEN con sus facturas origen reales (extraídas de gCamDEAsoc).
6. La inserción de la factura de compra 001-001-0284057 para calzar la NC 001-001-0049676 (₲ 11.760.000) por duraznos devueltos.
"""

from __future__ import annotations

import asyncio
import uuid
from datetime import date, datetime, timezone
from decimal import Decimal

from sqlalchemy import select, text
from api.src.db import async_session_factory
from api.src.financial.models import (
    SupplierInvoice, SupplierInvoiceItem,
    SupplierCreditNote, SupplierCreditNoteApplication
)
from api.src.purchases.models import SupplierNcRequest, PurchaseReceipt

SID = 'a2f37cf3-caa5-42b5-84cd-270a549d5a73'
CID = uuid.UUID('00000000-0000-0000-0000-000000000010')


async def run_remediation():
    print("="*80)
    print("INICIANDO REMEDIACIÓN INTEGRAL Y DEFINITIVA — CASA GONZALITO S.R.L.")
    print("="*80)

    async with async_session_factory() as session:
        async with session.begin():
            # =========================================================================
            # 1. CASO 001-001-0283721 (Factura SIFEN ₲ 1.613.586 y NC ₲ 471.600)
            # =========================================================================
            print("\n1. Regularizando Factura 001-001-0283721...")
            # Factura SIFEN legítima que fue cancelada por duplicado
            fac_sifen_3721 = (await session.execute(
                select(SupplierInvoice).where(
                    SupplierInvoice.id == uuid.UUID('8ca71830-10dc-49e0-b8cd-6d70e107ac9f')
                )
            )).scalar_one_or_none()

            # Factura muelle que tenía monto pre-neteado
            fac_muelle_3721 = (await session.execute(
                select(SupplierInvoice).where(
                    SupplierInvoice.id == uuid.UUID('e0a150ef-aa4f-4356-b7b7-8cc997ecec70')
                )
            )).scalar_one_or_none()

            # NC SIFEN 0049666
            nc_49666 = (await session.execute(
                select(SupplierCreditNote).where(
                    SupplierCreditNote.supplier_id == SID,
                    SupplierCreditNote.numero == '001-001-0049666'
                )
            )).scalar_one_or_none()

            if fac_sifen_3721 and nc_49666:
                # Cancelar y renombrar la factura amputada de muelle para liberar el número único
                if fac_muelle_3721:
                    fac_muelle_3721.numero_factura = f"DUP-{fac_muelle_3721.numero_factura}"
                    fac_muelle_3721.estado = 'cancelada'
                    fac_muelle_3721.saldo_pendiente = Decimal('0')
                    fac_muelle_3721.notas = '[SANEAMIENTO: Cancelada por reemplazo de factura canónica SIFEN 8ca71830]'
                    await session.flush()


                # Restaurar la factura canónica SIFEN
                fac_sifen_3721.estado = 'aprobada'
                fac_sifen_3721.total = Decimal('1613586')
                fac_sifen_3721.saldo_pendiente = Decimal('1613586') - Decimal('471600')  # 1.141.986
                fac_sifen_3721.receipt_id = uuid.UUID('cc7f3a45-3e5b-400e-9ea9-d4e4d7c41d26')
                fac_sifen_3721.notas = 'Factura canónica SIFEN restaurada. Compensada formalmente con NC 001-001-0049666.'

                # Vincular y cerrar la NC
                nc_49666.numero_factura_origen = '001-001-0283721'
                nc_49666.saldo_disponible = Decimal('0')

                # Registrar aplicación formal
                app_exists = (await session.execute(
                    select(SupplierCreditNoteApplication).where(
                        SupplierCreditNoteApplication.credit_note_id == nc_49666.id,
                        SupplierCreditNoteApplication.invoice_id == fac_sifen_3721.id
                    )
                )).scalar_one_or_none()
                if not app_exists:
                    session.add(SupplierCreditNoteApplication(
                        company_id=CID,
                        credit_note_id=nc_49666.id,
                        invoice_id=fac_sifen_3721.id,
                        monto_aplicado=Decimal('471600'),
                        observaciones='Compensación formal de NC SIFEN 001-001-0049666 referenciada por CDC'
                    ))
                print(f"   ✓ FAC 001-001-0283721 restaurada con Total ₲ {fac_sifen_3721.total:,.0f} y Saldo ₲ {fac_sifen_3721.saldo_pendiente:,.0f}. NC 0049666 aplicada.")

            # =========================================================================
            # 2. CASO 001-001-0282132 (Factura SIFEN ₲ 41.687.470 y NC ₲ 11.346.300)
            # =========================================================================
            print("\n2. Regularizando Factura 001-001-0282132...")
            fac_sifen_2132 = (await session.execute(
                select(SupplierInvoice).where(
                    SupplierInvoice.id == uuid.UUID('ee9db93c-cb58-4287-8f38-cfb9f04bb795')
                )
            )).scalar_one_or_none()

            fac_muelle_2132 = (await session.execute(
                select(SupplierInvoice).where(
                    SupplierInvoice.id == uuid.UUID('421a5692-dc11-4bb3-933b-4b778f3acc63')
                )
            )).scalar_one_or_none()

            nc_49670 = (await session.execute(
                select(SupplierCreditNote).where(
                    SupplierCreditNote.supplier_id == SID,
                    SupplierCreditNote.numero == '001-001-0049670'
                )
            )).scalar_one_or_none()

            if fac_sifen_2132 and nc_49670:
                if fac_muelle_2132:
                    fac_muelle_2132.numero_factura = f"DUP-{fac_muelle_2132.numero_factura}"
                    fac_muelle_2132.estado = 'cancelada'
                    fac_muelle_2132.saldo_pendiente = Decimal('0')
                    fac_muelle_2132.notas = '[SANEAMIENTO: Cancelada por reemplazo de factura canónica SIFEN ee9db93c]'
                    await session.flush()


                fac_sifen_2132.estado = 'aprobada'
                fac_sifen_2132.total = Decimal('41687470')
                fac_sifen_2132.saldo_pendiente = Decimal('41687470') - Decimal('11346300')  # 30.341.170
                fac_sifen_2132.receipt_id = uuid.UUID('21b4ae66-49f5-453b-8650-5fe07d56ac05')
                fac_sifen_2132.monto_retenido_nc = Decimal('0')
                fac_sifen_2132.bloqueada_para_pago = False
                fac_sifen_2132.requiere_nc = False
                fac_sifen_2132.notas = 'Factura canónica SIFEN restaurada. Compensada formalmente con NC 001-001-0049670.'

                nc_49670.numero_factura_origen = '001-001-0282132'
                nc_49670.saldo_disponible = Decimal('0')

                app_exists = (await session.execute(
                    select(SupplierCreditNoteApplication).where(
                        SupplierCreditNoteApplication.credit_note_id == nc_49670.id,
                        SupplierCreditNoteApplication.invoice_id == fac_sifen_2132.id
                    )
                )).scalar_one_or_none()
                if not app_exists:
                    session.add(SupplierCreditNoteApplication(
                        company_id=CID,
                        credit_note_id=nc_49670.id,
                        invoice_id=fac_sifen_2132.id,
                        monto_aplicado=Decimal('11346300'),
                        observaciones='Compensación formal de NC SIFEN 001-001-0049670 referenciada por CDC'
                    ))

                # Resolver SNC-00011
                snc_11 = (await session.execute(
                    select(SupplierNcRequest).where(
                        SupplierNcRequest.supplier_id == SID,
                        SupplierNcRequest.numero_solicitud == 'SNC-00011'
                    )
                )).scalar_one_or_none()
                if snc_11:
                    snc_11.estado = 'resuelta'
                    snc_11.resolved_at = datetime.now(timezone.utc)
                    snc_11.nc_recibida_numero = '001-001-0049670'
                    snc_11.nc_recibida_monto = Decimal('11346300')
                    snc_11.observaciones = f"{(snc_11.observaciones or '').strip()} [Saneamiento: Conciliada con NC SIFEN 001-001-0049670]".strip()

                print(f"   ✓ FAC 001-001-0282132 restaurada con Total ₲ {fac_sifen_2132.total:,.0f} y Saldo ₲ {fac_sifen_2132.saldo_pendiente:,.0f}. NC 0049670 aplicada.")

            # =========================================================================
            # 3. CASO 001-001-0282138 (Factura SIFEN ₲ 932.782 y NC ₲ 80.742)
            # =========================================================================
            print("\n3. Regularizando Factura 001-001-0282138...")
            fac_sifen_2138 = (await session.execute(
                select(SupplierInvoice).where(
                    SupplierInvoice.id == uuid.UUID('45662c88-3644-4a92-9b6e-eb7f5012c7e7')
                )
            )).scalar_one_or_none()

            fac_typo_2138 = (await session.execute(
                select(SupplierInvoice).where(
                    SupplierInvoice.id == uuid.UUID('b92fee17-5543-4c55-afb2-f8bcec077f6b')
                )
            )).scalar_one_or_none()

            nc_49675 = (await session.execute(
                select(SupplierCreditNote).where(
                    SupplierCreditNote.supplier_id == SID,
                    SupplierCreditNote.numero == '001-001-0049675'
                )
            )).scalar_one_or_none()

            if fac_sifen_2138 and nc_49675:
                # Cancelar duplicado tipográfico
                if fac_typo_2138:
                    fac_typo_2138.estado = 'cancelada'
                    fac_typo_2138.saldo_pendiente = Decimal('0')
                    fac_typo_2138.notas = '[SANEAMIENTO: Cancelada por duplicado tipográfico con letra o de 45662c88]'

                fac_sifen_2138.receipt_id = uuid.UUID('a0102ae0-dc91-498a-9d30-3083b36f052b')
                fac_sifen_2138.saldo_pendiente = Decimal('932782') - Decimal('80742')  # 852.040
                fac_sifen_2138.estado = 'aprobada'

                nc_49675.numero_factura_origen = '001-001-0282138'
                nc_49675.saldo_disponible = Decimal('0')

                app_exists = (await session.execute(
                    select(SupplierCreditNoteApplication).where(
                        SupplierCreditNoteApplication.credit_note_id == nc_49675.id,
                        SupplierCreditNoteApplication.invoice_id == fac_sifen_2138.id
                    )
                )).scalar_one_or_none()
                if not app_exists:
                    session.add(SupplierCreditNoteApplication(
                        company_id=CID,
                        credit_note_id=nc_49675.id,
                        invoice_id=fac_sifen_2138.id,
                        monto_aplicado=Decimal('80742'),
                        observaciones='Compensación formal de NC SIFEN 001-001-0049675 referenciada por CDC'
                    ))
                print(f"   ✓ FAC 001-001-0282138 vinculada a recepción muelle. NC 0049675 aplicada. Saldo: ₲ {fac_sifen_2138.saldo_pendiente:,.0f}.")

            # =========================================================================
            # 4. CASO 001-001-0284042 (Factura SIFEN ₲ 3.540.744 y NC ₲ 103.536)
            # =========================================================================
            print("\n4. Regularizando Factura 001-001-0284042...")
            fac_4042 = (await session.execute(
                select(SupplierInvoice).where(
                    SupplierInvoice.id == uuid.UUID('b60d7610-b642-4eb6-9c68-37436097a5ca')
                )
            )).scalar_one_or_none()

            nc_49668 = (await session.execute(
                select(SupplierCreditNote).where(
                    SupplierCreditNote.supplier_id == SID,
                    SupplierCreditNote.numero == '001-001-0049668'
                )
            )).scalar_one_or_none()

            if fac_4042 and nc_49668:
                fac_4042.saldo_pendiente = Decimal('3540744') - Decimal('103536')  # 3.437.208
                fac_4042.monto_retenido_nc = Decimal('0')
                fac_4042.bloqueada_para_pago = False
                fac_4042.requiere_nc = False
                fac_4042.estado = 'aprobada'

                nc_49668.numero_factura_origen = '001-001-0284042'
                nc_49668.saldo_disponible = Decimal('0')

                app_exists = (await session.execute(
                    select(SupplierCreditNoteApplication).where(
                        SupplierCreditNoteApplication.credit_note_id == nc_49668.id,
                        SupplierCreditNoteApplication.invoice_id == fac_4042.id
                    )
                )).scalar_one_or_none()
                if not app_exists:
                    session.add(SupplierCreditNoteApplication(
                        company_id=CID,
                        credit_note_id=nc_49668.id,
                        invoice_id=fac_4042.id,
                        monto_aplicado=Decimal('103536'),
                        observaciones='Compensación formal de NC SIFEN 001-001-0049668 referenciada por CDC'
                    ))

                # Resolver SNC-00056
                snc_56 = (await session.execute(
                    select(SupplierNcRequest).where(
                        SupplierNcRequest.supplier_id == SID,
                        SupplierNcRequest.numero_solicitud == 'SNC-00056'
                    )
                )).scalar_one_or_none()
                if snc_56:
                    snc_56.estado = 'resuelta'
                    snc_56.resolved_at = datetime.now(timezone.utc)
                    snc_56.nc_recibida_numero = '001-001-0049668'
                    snc_56.nc_recibida_monto = Decimal('103536')
                    snc_56.observaciones = f"{(snc_56.observaciones or '').strip()} [Saneamiento: Conciliada con NC SIFEN 001-001-0049668]".strip()

                print(f"   ✓ FAC 001-001-0284042 liberada y compensada con NC 0049668. Saldo exigible: ₲ {fac_4042.saldo_pendiente:,.0f}.")

            # =========================================================================
            # 5. RENOMBRAR LAS 4 FACTURAS AUTO-REC- A SUS NÚMEROS REALES DE PROVEEDOR
            # =========================================================================
            print("\n5. Renombrando 4 facturas AUTO-REC- a sus comprobantes reales de proveedor...")
            # Factura 79dba5e6 -> 001-001-0280542
            fac_auto_542 = (await session.execute(
                select(SupplierInvoice).where(
                    SupplierInvoice.id == uuid.UUID('79dba5e6-c362-4252-a0ea-6dc93c24f30d')
                )
            )).scalar_one_or_none()
            if fac_auto_542:
                fac_auto_542.numero_factura = '001-001-0280542'
                fac_auto_542.concepto = 'Factura 001-001-0280542 - Recepción REC-20260926-004792'
                fac_auto_542.estado = 'aprobada'
                print("   ✓ AUTO-REC-20260926-004792 renombrada a 001-001-0280542 (₲ 122.465)")

            # Factura 64e13734 -> 001-001-0280450
            fac_auto_450 = (await session.execute(
                select(SupplierInvoice).where(
                    SupplierInvoice.id == uuid.UUID('64e13734-e63b-4970-a270-61cfc8fbc49a')
                )
            )).scalar_one_or_none()
            if fac_auto_450:
                fac_auto_450.numero_factura = '001-001-0280450'
                fac_auto_450.concepto = 'Factura 001-001-0280450 - Recepción REC-20260926-004791'
                fac_auto_450.estado = 'aprobada'
                print("   ✓ AUTO-REC-20260926-004791 renombrada a 001-001-0280450 (₲ 6.992.880)")

            # Factura 8584664f -> REM-20260926-004794
            fac_auto_rem = (await session.execute(
                select(SupplierInvoice).where(
                    SupplierInvoice.id == uuid.UUID('8584664f-39aa-45a3-af18-e9441ec9696d')
                )
            )).scalar_one_or_none()
            if fac_auto_rem:
                fac_auto_rem.numero_factura = 'REM-20260926-004794'
                fac_auto_rem.concepto = 'Remisión de mercadería REM-20260926-004794 - Recepción REC-20260926-004794'
                fac_auto_rem.estado = 'aprobada'
                print("   ✓ AUTO-REC-20260926-004794 renombrada a REM-20260926-004794 (₲ 556.729)")

            # Factura dabfd089 -> 001-001-0280543 y aplicar NC 001-001-0049239
            fac_auto_543 = (await session.execute(
                select(SupplierInvoice).where(
                    SupplierInvoice.id == uuid.UUID('dabfd089-7c2e-4a59-8d28-41d990017a3f')
                )
            )).scalar_one_or_none()

            # Cancelar duplicado manual ficticio de NC 001-001-0049239
            nc_manual_dup = (await session.execute(
                select(SupplierCreditNote).where(
                    SupplierCreditNote.id == uuid.UUID('dc37aaf3-865b-4b29-ad05-b4891b385503')
                )
            )).scalar_one_or_none()
            if nc_manual_dup:
                nc_manual_dup.cancelado = True
                nc_manual_dup.saldo_disponible = Decimal('0')
                nc_manual_dup.observaciones = f"{(nc_manual_dup.observaciones or '').strip()} [ANULADA: Duplicado manual con timbrado falso de SIFEN f86b8166]".strip()

            nc_49239 = (await session.execute(
                select(SupplierCreditNote).where(
                    SupplierCreditNote.id == uuid.UUID('f86b8166-97ec-451c-8eef-d7d1340ff860')
                )
            )).scalar_one_or_none()


            if fac_auto_543:
                fac_auto_543.numero_factura = '001-001-0280543'
                fac_auto_543.concepto = 'Factura 001-001-0280543 - Recepción REC-20260926-004795'
                fac_auto_543.estado = 'aprobada'
                if nc_49239:
                    fac_auto_543.saldo_pendiente = Decimal('1202656') - Decimal('77990')  # 1.124.666
                    nc_49239.numero_factura_origen = '001-001-0280543'
                    nc_49239.saldo_disponible = Decimal('0')

                    app_exists = (await session.execute(
                        select(SupplierCreditNoteApplication).where(
                            SupplierCreditNoteApplication.credit_note_id == nc_49239.id,
                            SupplierCreditNoteApplication.invoice_id == fac_auto_543.id
                        )
                    )).scalar_one_or_none()
                    if not app_exists:
                        session.add(SupplierCreditNoteApplication(
                            company_id=CID,
                            credit_note_id=nc_49239.id,
                            invoice_id=fac_auto_543.id,
                            monto_aplicado=Decimal('77990'),
                            observaciones='Compensación formal de NC SIFEN 001-001-0049239 referenciada por CDC'
                        ))
                print(f"   ✓ AUTO-REC-20260926-004795 renombrada a 001-001-0280543. NC 0049239 aplicada. Saldo: ₲ {fac_auto_543.saldo_pendiente:,.0f}.")

            # =========================================================================
            # 6. CASO 001-001-0284057 Y NC 001-001-0049676 (₲ 11.760.000)
            # =========================================================================
            print("\n6. Regularizando compra y devolución TOPS DURAZNO (₲ 11.760.000)...")
            nc_49676 = (await session.execute(
                select(SupplierCreditNote).where(
                    SupplierCreditNote.supplier_id == SID,
                    SupplierCreditNote.numero == '001-001-0049676'
                )
            )).scalar_one_or_none()

            # Verificar si ya existe la factura
            fac_4057 = (await session.execute(
                select(SupplierInvoice).where(
                    SupplierInvoice.supplier_id == SID,
                    SupplierInvoice.numero_factura == '001-001-0284057'
                )
            )).scalars().first()

            if not fac_4057:
                fac_id = uuid.uuid4()
                fac_4057 = SupplierInvoice(
                    id=fac_id,
                    company_id=CID,
                    supplier_id=uuid.UUID(SID),
                    numero_factura='001-001-0284057',
                    timbrado='17090459',
                    cdc='01800054270001001028405722026100810255283670',
                    fecha_emision=date(2026, 10, 8),
                    fecha_recepcion=date(2026, 10, 8),
                    fecha_vencimiento=date(2026, 11, 7),
                    subtotal=Decimal('10690909'),
                    descuento=Decimal('0'),
                    iva_10=Decimal('1069091'),
                    iva_5=Decimal('0'),
                    total=Decimal('11760000'),
                    saldo_pendiente=Decimal('0'),  # Pagada/Compensada 100% por devolución
                    moneda='PYG',
                    tipo_cambio=Decimal('1.0'),
                    condicion='credito',
                    tipo_comprobante='factura',
                    estado='pagada',
                    concepto='Compra TOPS DURAZNO EN ALMIBAR 12X820GR LATA (Compensada 100% por Devolución NC 001-001-0049676)',
                    notas='Registrada formalmente tras auditoría SIFEN para compensación de devolución 1200 latas',
                    monto_retenido_nc=Decimal('0'),
                    requiere_nc=False,
                    bloqueada_para_pago=False,
                    created_at=datetime(2026, 10, 8, 12, 0, 0, tzinfo=timezone.utc),
                    updated_at=datetime.now(timezone.utc)
                )
                session.add(fac_4057)
                await session.flush()

                # Agregar ítem detallado
                session.add(SupplierInvoiceItem(
                    id=uuid.uuid4(),
                    invoice_id=fac_4057.id,
                    product_id=None,
                    cantidad=Decimal('1200'),
                    precio_unitario=Decimal('9800'),
                    descuento=Decimal('0'),
                    iva_tasa=Decimal('10'),
                    total=Decimal('11760000'),
                    descripcion='TOPS DURAZNO EN ALMIBAR 12X820GR LATA'
                ))

            if nc_49676 and fac_4057:
                nc_49676.numero_factura_origen = '001-001-0284057'
                nc_49676.saldo_disponible = Decimal('0')

                app_exists = (await session.execute(
                    select(SupplierCreditNoteApplication).where(
                        SupplierCreditNoteApplication.credit_note_id == nc_49676.id,
                        SupplierCreditNoteApplication.invoice_id == fac_4057.id
                    )
                )).scalar_one_or_none()
                if not app_exists:
                    session.add(SupplierCreditNoteApplication(
                        company_id=CID,
                        credit_note_id=nc_49676.id,
                        invoice_id=fac_4057.id,
                        monto_aplicado=Decimal('11760000'),
                        observaciones='Compensación 100% de devolución de mercadería NC SIFEN 001-001-0049676'
                    ))
                print(f"   ✓ Compra 001-001-0284057 y NC 001-001-0049676 compensadas mutuamente (₲ 11.760.000). Saldo exigible: ₲ 0.")

    print("\n" + "="*80)
    print("REMEDIACIÓN DEFINITIVA DE CASA GONZALITO COMPLETADA EXITOSAMENTE")
    print("="*80)

if __name__ == '__main__':
    asyncio.run(run_remediation())
