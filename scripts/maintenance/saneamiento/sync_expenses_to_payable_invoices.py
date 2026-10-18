import asyncio
from decimal import Decimal
from datetime import date
from sqlalchemy import select
from api.src.db import async_session_factory
from api.src.petty_cash.models import Expense
from api.src.financial.models import SupplierInvoice

async def main():
    async with async_session_factory() as db:
        res = await db.execute(
            select(Expense).where(
                Expense.supplier_id != None,
                Expense.supplier_invoice_id == None,
                Expense.fecha_pago == None,
                Expense.anulado == False,
                Expense.es_anticipo_sueldo == False
            )
        )
        expenses = res.scalars().all()
        print(f"Total gastos a sincronizar con Cuentas por Pagar: {len(expenses)}")

        for exp in expenses:
            num_clean = (exp.numero_factura or f"CP-{str(exp.id)[:8].upper()}").strip()
            timb_clean = (exp.timbrado or "").strip() or None

            check_q = select(SupplierInvoice).where(
                SupplierInvoice.company_id == exp.company_id,
                SupplierInvoice.supplier_id == exp.supplier_id,
                SupplierInvoice.numero_factura == num_clean
            )
            if timb_clean:
                check_q = check_q.where(SupplierInvoice.timbrado == timb_clean)
            existing_inv = (await db.execute(check_q)).scalar_one_or_none()

            if existing_inv:
                exp.supplier_invoice_id = existing_inv.id
                print(f"✓ Vinculado a factura comercial existente: {existing_inv.numero_factura} (ID: {existing_inv.id})")
            else:
                subtotal = (exp.gravado_10 or Decimal("0")) + (exp.gravado_5 or Decimal("0")) + (exp.exentas or Decimal("0"))
                new_inv = SupplierInvoice(
                    company_id=exp.company_id,
                    supplier_id=exp.supplier_id,
                    numero_factura=num_clean,
                    timbrado=timb_clean,
                    fecha_emision=exp.fecha_gasto or date.today(),
                    fecha_recepcion=exp.fecha_gasto or date.today(),
                    fecha_vencimiento=exp.fecha_gasto or date.today(),
                    subtotal=subtotal if subtotal > 0 else exp.monto,
                    descuento=Decimal("0"),
                    iva_10=exp.iva_10 or Decimal("0"),
                    iva_5=exp.iva_5 or Decimal("0"),
                    total=exp.monto,
                    saldo_pendiente=exp.monto,
                    moneda="PYG",
                    tipo_cambio=Decimal("1"),
                    condicion="credito",
                    tipo_comprobante="gasto",
                    estado="aprobada",
                    concepto=f"Insumo/Gasto: {exp.descripcion}"[:300],
                    created_by=exp.registrado_por,
                )
                db.add(new_inv)
                await db.flush()
                exp.supplier_invoice_id = new_inv.id
                print(f"✓ Creada nueva factura a pagar para proveedor {exp.proveedor}: {new_inv.numero_factura} por ₲ {new_inv.total:,.0f} (ID: {new_inv.id})")

        await db.commit()
        print("Sincronización completada exitosamente.")

if __name__ == "__main__":
    asyncio.run(main())
