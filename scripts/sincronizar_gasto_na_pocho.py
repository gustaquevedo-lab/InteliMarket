"""Sincronizar gasto de Comercial Ña Pocho a supplier_invoices para permitir compensación de NCs.
InteliMarket — Extra Supermercado

Gasto ID: 1ad7d077-0e0d-4d08-8b30-cbf4fe686cb1
Proveedor: COMERCIAL ÑA POCHO S.R.L. (7862ab6c-374d-41e3-be46-98de0737d08c)
Factura: 002-002-0040139
Timbrado: 17846179
Monto: 2.000.000 Gs.
NCs a compensar: 2 NCs por 1.248.300 + 751.700 = 2.000.000 Gs.
"""

import sys
import asyncio
from decimal import Decimal
import uuid

from api.src.db import async_session_factory
from sqlalchemy import text

EXPENSE_ID = uuid.UUID("1ad7d077-0e0d-4d08-8b30-cbf4fe686cb1")
SUPPLIER_ID = uuid.UUID("7862ab6c-374d-41e3-be46-98de0737d08c")
COMPANY_ID = uuid.UUID("00000000-0000-0000-0000-000000000010")


async def main():
    print("=" * 80)
    print("SINCRONIZANDO FACTURA DE GASTO A CUENTAS POR PAGAR (COMERCIAL ÑA POCHO S.R.L.)")
    print("=" * 80)

    async with async_session_factory() as session:
        # 1. Obtener datos del gasto
        res = await session.execute(text("""
            SELECT id, numero_factura, timbrado, monto, descripcion, fecha_gasto, gravado_10, gravado_5, exentas, iva_10, iva_5
            FROM expenses
            WHERE id = :id
        """), {"id": EXPENSE_ID})
        exp = res.fetchone()

        if not exp:
            print("❌ Gasto no encontrado.")
            return

        print(f"Gasto encontrado: {exp[1]} | Monto: {exp[3]:,.0f} Gs. | Fecha: {exp[5]}")

        # 2. Verificar si ya existe en supplier_invoices
        res_inv = await session.execute(text("""
            SELECT id, numero_factura, total, saldo_pendiente
            FROM supplier_invoices
            WHERE company_id = :cid AND supplier_id = :sid AND numero_factura = :num
        """), {"cid": COMPANY_ID, "sid": SUPPLIER_ID, "num": exp[1]})
        inv = res_inv.fetchone()

        new_inv_id = None
        if inv:
            print(f"⚠️ La factura ya existe en supplier_invoices con ID: {inv[0]} (Saldo: {inv[3]:,.0f} Gs.)")
            new_inv_id = inv[0]
        else:
            new_inv_id = uuid.uuid4()
            monto = Decimal(str(exp[3]))
            subtotal = Decimal(str(exp[6] or 0)) + Decimal(str(exp[7] or 0)) + Decimal(str(exp[8] or 0))
            if subtotal <= 0:
                subtotal = monto

            await session.execute(text("""
                INSERT INTO supplier_invoices (
                    id, company_id, supplier_id, numero_factura, timbrado,
                    fecha_emision, fecha_recepcion, fecha_vencimiento,
                    subtotal, descuento, iva_10, iva_5, total, saldo_pendiente,
                    moneda, tipo_cambio, condicion, tipo_comprobante, estado,
                    concepto, created_at, updated_at
                ) VALUES (
                    :id, :company_id, :supplier_id, :numero_factura, :timbrado,
                    :fecha_emision, :fecha_recepcion, :fecha_vencimiento,
                    :subtotal, :descuento, :iva_10, :iva_5, :total, :saldo_pendiente,
                    :moneda, :tipo_cambio, :condicion, :tipo_comprobante, :estado,
                    :concepto, NOW(), NOW()
                )
            """), {
                "id": new_inv_id,
                "company_id": COMPANY_ID,
                "supplier_id": SUPPLIER_ID,
                "numero_factura": exp[1],
                "timbrado": exp[2],
                "fecha_emision": exp[5],
                "fecha_recepcion": exp[5],
                "fecha_vencimiento": exp[5],
                "subtotal": subtotal,
                "descuento": Decimal("0"),
                "iva_10": Decimal(str(exp[9] or 0)),
                "iva_5": Decimal(str(exp[10] or 0)),
                "total": monto,
                "saldo_pendiente": monto,
                "moneda": "PYG",
                "tipo_cambio": Decimal("1"),
                "condicion": "credito",
                "tipo_comprobante": "gasto",
                "estado": "aprobada",
                "concepto": f"Insumo/Gasto: {exp[4]}"[:300],
            })
            print(f"✓ Creada factura en supplier_invoices con ID: {new_inv_id}")

        # 3. Vincular el gasto con el proveedor y la factura
        await session.execute(text("""
            UPDATE expenses
            SET supplier_id = :sid,
                supplier_invoice_id = :inv_id,
                tipo_comprobante = 'factura_credito',
                tipo_pago = 'credito'
            WHERE id = :id
        """), {"sid": SUPPLIER_ID, "inv_id": new_inv_id, "id": EXPENSE_ID})
        print(f"✓ Gasto {EXPENSE_ID} actualizado con supplier_id y supplier_invoice_id.")

        await session.commit()
        print("\n[ÉXITO] Factura sincronizada correctamente. Ahora figurará en la pantalla de proveedores.")


if __name__ == "__main__":
    asyncio.run(main())
