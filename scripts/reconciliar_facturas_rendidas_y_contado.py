"""Script de saneamiento y reconciliación de facturas con condición contado o gastos ya rendidos en Fondo Fijo.
No afecta los saldos de caja actuales ni genera desembolsos nuevos.
"""
import asyncio
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from datetime import date
from decimal import Decimal
from sqlalchemy import text, select
from api.src.db import async_session_factory
from api.src.financial.models import SupplierInvoice, SupplierInvoicePayment
from api.src.petty_cash.models import Expense, PettyCashRendicion

async def run_reconciliation(dry_run: bool = True):
    print(f"=== INICIANDO RECONCILIACIÓN (dry_run={dry_run}) ===")
    async with async_session_factory() as db:
        # 1. Facturas vinculadas a gastos ya rendidos/aprobados
        q_rendidos = text("""
            SELECT si.id as invoice_id, si.numero_factura, s.razon_social, si.total, si.saldo_pendiente,
                   e.id as expense_id, e.fund_id, e.fecha_gasto, e.descripcion, e.rendicion_id,
                   r.numero_rendicion, r.custodio_nombre
            FROM supplier_invoices si
            JOIN suppliers s ON s.id = si.supplier_id
            JOIN expenses e ON (e.numero_factura = si.numero_factura AND e.monto = si.total)
            LEFT JOIN petty_cash_rendiciones r ON r.id = e.rendicion_id
            WHERE si.saldo_pendiente > 0 
              AND (e.rendicion_id IS NOT NULL OR e.fund_id IS NOT NULL OR e.estado IN ('aprobado', 'pagado'))
            ORDER BY si.fecha_emision ASC
        """)
        res_rend = await db.execute(q_rendidos)
        rendidos = res_rend.fetchall()
        print(f"\n[1] Facturas con gastos ya rendidos/aprobados: {len(rendidos)}")

        for r in rendidos:
            m = dict(r._mapping)
            print(f" -> {m['razon_social']} | Fac: {m['numero_factura']} | Saldo: {m['saldo_pendiente']} | Rendición: {m['numero_rendicion']} ({m['custodio_nombre']})")
            if not dry_run:
                inv = await db.get(SupplierInvoice, m["invoice_id"])
                exp = await db.get(Expense, m["expense_id"])
                if inv:
                    inv.saldo_pendiente = Decimal("0")
                    inv.estado = "pagada"
                if exp:
                    exp.supplier_invoice_id = m["invoice_id"]
                
                # Registrar pago histórico
                pago = SupplierInvoicePayment(
                    invoice_id=m["invoice_id"],
                    payment_method="fondo_fijo" if m["fund_id"] else "efectivo",
                    monto=m["total"],
                    moneda="PYG",
                    fecha_pago=m["fecha_gasto"] or date.today(),
                    referencia=f"Reconciliación: Rendición {m['numero_rendicion'] or 'Fondo Fijo'} - {m['descripcion'] or ''}"[:250],
                    petty_cash_fund_id=m["fund_id"],
                    estado="conciliado"
                )
                db.add(pago)

        # 2. Facturas de 2026 con condicion = 'contado' que siguen con saldo pendiente
        # (excluimos Casa Gonzalito que tiene acuerdo de cuenta corriente con OPs específicas)
        q_contado = text("""
            SELECT si.id as invoice_id, si.numero_factura, s.razon_social, si.total, si.saldo_pendiente,
                   si.fecha_emision, si.concepto
            FROM supplier_invoices si
            JOIN suppliers s ON s.id = si.supplier_id
            WHERE si.condicion = 'contado' 
              AND si.saldo_pendiente > 0
              AND si.fecha_emision >= '2026-01-01'
              AND s.razon_social NOT ILIKE '%GONZALITO%'
            ORDER BY si.fecha_emision ASC
        """)
        res_contado = await db.execute(q_contado)
        contados = res_contado.fetchall()
        print(f"\n[2] Facturas contado 2026 sin rendición pero saldo > 0: {len(contados)}")

        # Filtrar las que ya procesamos en el paso 1
        processed_ids = {r[0] for r in rendidos}
        contados_restantes = [r for r in contados if r[0] not in processed_ids]
        print(f" -> Restantes a regularizar: {len(contados_restantes)}")

        for r in contados_restantes:
            m = dict(r._mapping)
            print(f" -> {m['razon_social']} | Fac: {m['numero_factura']} | Saldo: {m['saldo_pendiente']} | Concepto: {m['concepto']}")
            if not dry_run:
                inv = await db.get(SupplierInvoice, m["invoice_id"])
                if inv:
                    inv.saldo_pendiente = Decimal("0")
                    inv.estado = "pagada"
                
                pago = SupplierInvoicePayment(
                    invoice_id=m["invoice_id"],
                    payment_method="contado",
                    monto=m["total"],
                    moneda="PYG",
                    fecha_pago=m["fecha_emision"] or date.today(),
                    referencia=f"Regularización Factura Contado: {m['concepto'] or ''}"[:250],
                    estado="conciliado"
                )
                db.add(pago)

        if not dry_run:
            await db.commit()
            print("\n>>> CAMBIOS PERSISTIDOS CON ÉXITO EN LA BASE DE DATOS. <<<")
        else:
            print("\n[DRY RUN] Ningún cambio fue persistido.")

if __name__ == "__main__":
    import sys
    dry = "--apply" not in sys.argv
    asyncio.run(run_reconciliation(dry_run=dry))
