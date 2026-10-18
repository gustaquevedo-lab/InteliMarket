import asyncio
import uuid
from decimal import Decimal
from datetime import date
from sqlalchemy import select
from api.src.db import async_session_factory
from api.src.purchases.models import PurchaseReceipt, PurchaseReceiptItem, PurchaseOrder, Supplier
from api.src.financial.models import SupplierInvoice, SupplierInvoiceItem

MILLITO_ID = uuid.UUID('09e02b61-03da-4c77-996d-afd14db45294')

TARGET_RECEIPTS = [
    {
        'receipt_id': uuid.UUID('73b4ac42-11da-4c60-8bd3-075638334345'),
        'po_id': uuid.UUID('d24f5b55-26e2-4fe5-875d-c433673a85f4'),
        'numero': 'REC-20261010-004852',
        'monto_esperado': Decimal('294000'),
        'fecha': date(2026, 10, 10),
    },
    {
        'receipt_id': uuid.UUID('80f82676-6f5d-4968-8ae4-fbfcb2df6c0a'),
        'po_id': uuid.UUID('3394b981-d27a-4dda-b918-a95d9096b77c'),
        'numero': 'REC-20261013-004873',
        'monto_esperado': Decimal('214500'),
        'fecha': date(2026, 10, 13),
    },
    {
        'receipt_id': uuid.UUID('ff1e2ba7-968c-404b-bba6-7716162ecf06'),
        'po_id': uuid.UUID('61ab124d-8288-45dd-8979-89d7f371bb65'),
        'numero': 'REC-20261014-004888',
        'monto_esperado': Decimal('181500'),
        'fecha': date(2026, 10, 14),
    },
    {
        'receipt_id': uuid.UUID('5903fcf3-222a-4c7a-9aa2-e2e308236c09'),
        'po_id': uuid.UUID('229ed674-e63f-46ac-9d00-433f0a204c07'),
        'numero': 'REC-20261015-004915',
        'monto_esperado': Decimal('128000'),
        'fecha': date(2026, 10, 15),
    },
]

async def remediate():
    async with async_session_factory() as db:
        print("=== INICIANDO REMEDIACIÓN FACTURAS PROVEEDOR MILLITO ===")
        
        # Verificar proveedor
        sup_res = await db.execute(select(Supplier).where(Supplier.id == MILLITO_ID))
        sup = sup_res.scalar_one_or_none()
        if not sup:
            print(f"ERROR: Proveedor {MILLITO_ID} no encontrado.")
            return

        print(f"Proveedor: {sup.razon_social} (ID: {sup.id})")

        created_invoices = []

        for target in TARGET_RECEIPTS:
            r_id = target['receipt_id']
            # Verificar si ya existe factura con este receipt_id
            ex_res = await db.execute(
                select(SupplierInvoice).where(SupplierInvoice.receipt_id == r_id)
            )
            ex_inv = ex_res.scalar_one_or_none()
            if ex_inv:
                print(f"Factura ya existe para {target['numero']}: {ex_inv.numero_factura} (ID: {ex_inv.id})")
                continue

            # Obtener recepción y PO
            r_res = await db.execute(select(PurchaseReceipt).where(PurchaseReceipt.id == r_id))
            receipt = r_res.scalar_one_or_none()
            if not receipt:
                print(f"ERROR: Recepción {r_id} no encontrada.")
                continue

            po_res = await db.execute(select(PurchaseOrder).where(PurchaseOrder.id == receipt.purchase_order_id))
            po = po_res.scalar_one_or_none()
            if not po:
                print(f"ERROR: OC {receipt.purchase_order_id} no encontrada.")
                continue

            # Obtener ítems de la recepción
            items_res = await db.execute(
                select(PurchaseReceiptItem).where(PurchaseReceiptItem.receipt_id == r_id)
            )
            items = list(items_res.scalars().all())
            total = sum((i.cantidad_recibida * i.costo_unitario) for i in items) if items else receipt.total

            if total != target['monto_esperado']:
                print(f"AVISO: Total calculado ({total}) difiere de esperado ({target['monto_esperado']}) para {receipt.numero}")

            # Calcular IVA 10%
            iva_10 = (total / Decimal("11")).quantize(Decimal("1"))
            subtotal = total - iva_10

            invoice = SupplierInvoice(
                company_id=receipt.company_id,
                supplier_id=receipt.supplier_id or MILLITO_ID,
                numero_factura=f"AUTO-{receipt.numero}",
                timbrado=None,
                cdc=None,
                fecha_emision=target['fecha'],
                fecha_recepcion=target['fecha'],
                fecha_vencimiento=target['fecha'],
                subtotal=subtotal,
                descuento=Decimal("0"),
                iva_10=iva_10,
                iva_5=Decimal("0"),
                total=total,
                saldo_pendiente=total,
                moneda="PYG",
                tipo_cambio=Decimal("1"),
                total_brl=None,
                saldo_pendiente_brl=None,
                purchase_order_id=po.id,
                receipt_id=receipt.id,
                condicion="contado",
                tipo_comprobante="factura",
                estado="pendiente",
                concepto=f"Recepción {receipt.numero} - OC {po.numero} - Verdeos Millito",
                notas=receipt.observaciones,
                bloqueada_para_pago=False,
                created_by=receipt.user_id,
            )
            db.add(invoice)
            await db.flush()

            # Añadir ítems detallados
            for itm in items:
                db.add(SupplierInvoiceItem(
                    invoice_id=invoice.id,
                    product_id=itm.product_id,
                    cantidad=itm.cantidad_recibida,
                    precio_unitario=itm.costo_unitario,
                    descuento=Decimal("0"),
                    iva_tasa=Decimal("10"),
                    total=(itm.cantidad_recibida * itm.costo_unitario).quantize(Decimal("1")),
                    descripcion=f"Verdeos Lote {itm.product_id}",
                ))

            await db.flush()
            created_invoices.append(invoice)
            print(f"✓ Creada factura: {invoice.numero_factura} | Total: ₲ {invoice.total:,} | Saldo: ₲ {invoice.saldo_pendiente:,} (ID: {invoice.id})")

        await db.commit()
        print(f"\n=== PROCESO COMPLETADO EXITOSAMENTE. Facturas creadas: {len(created_invoices)} ===")

if __name__ == "__main__":
    asyncio.run(remediate())
