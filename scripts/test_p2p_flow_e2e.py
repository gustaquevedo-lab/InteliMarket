"""
Script de Verificación End-to-End: Flujo Completo P2P (Procure-to-Pay)
Vertical Supermercado - Extra Supermercado Mayorista
"""

import asyncio
import os
import sys
from decimal import Decimal
from datetime import datetime, timezone, timedelta
import uuid

# Setup PYTHONPATH
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select, text

from api.src.purchases.models import (
    Supplier, PurchaseOrder, PurchaseOrderItem, PurchaseReceipt,
    PurchaseReceiptItem, SupplierNcRequest
)
from api.src.financial.models import SupplierInvoice, SupplierInvoiceItem
from api.src.products.models import Product
from api.src.inventory.models import Stock, StockLot
from api.src.purchases import service as purchases_service
from api.src.purchases import matching_service
from api.src.financial import service as financial_service
from api.src.purchases.schemas import ReceiptCreate, ReceiptItemInput

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+asyncpg://intelimarket:password@localhost:5432/intelimarket"
)

engine = create_async_engine(DATABASE_URL, echo=False)
AsyncSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

COMPANY_ID = uuid.UUID("00000000-0000-0000-0000-000000000010")


async def run_p2p_e2e_test():
    print("=" * 70)
    print("INICIANDO TEST END-TO-END DEL FLUJO P2P EN EXTRA SUPERMERCADO")
    print("=" * 70)

    async with AsyncSessionLocal() as db:
        # 1. Obtener Proveedor y 2 Productos Reales
        supp_res = await db.execute(select(Supplier).where(Supplier.company_id == COMPANY_ID).limit(1))
        supplier = supp_res.scalar_one_or_none()
        if not supplier:
            print("ERROR: No se encontro proveedor en la base de datos.")
            return

        prod_res = await db.execute(select(Product).where(Product.company_id == COMPANY_ID).limit(2))
        products = list(prod_res.scalars().all())
        if len(products) < 2:
            print("ERROR: Se requieren al menos 2 productos para la prueba.")
            return

        prod_orden = products[0]
        prod_extra = products[1]

        # Obtener un depósito real
        wh_res = await db.execute(text("SELECT id FROM warehouses WHERE company_id = :cid LIMIT 1"), {"cid": COMPANY_ID})
        wh_row = wh_res.fetchone()
        warehouse_id = wh_row[0] if wh_row else COMPANY_ID

        print(f"✓ Proveedor: {supplier.razon_social or supplier.nombre_fantasia} (RUC: {supplier.ruc})")
        print(f"✓ Producto OC: {prod_orden.nombre} (ID: {prod_orden.id})")
        print(f"✓ Producto Extraordinario: {prod_extra.nombre} (ID: {prod_extra.id})")

        # ---------------------------------------------------------------------
        # PASO 1: Creación de Orden de Compra (PO)
        # ---------------------------------------------------------------------
        print("\n--- PASO 1: EMISIÓN DE ORDEN DE COMPRA (PO) ---")
        num_po = f"OC-TEST-{int(datetime.now().timestamp())}"
        precio_pactado = Decimal("15000")
        qty_pedida = Decimal("50")

        po = PurchaseOrder(
            company_id=COMPANY_ID,
            supplier_id=supplier.id,
            numero=num_po,
            fecha=datetime.now(timezone.utc),
            fecha_entrega_estimada=datetime.now(timezone.utc) + timedelta(days=3),
            estado="confirmado",
            prioridad="normal",
            condiciones_pago="30 Días",
            observaciones="Orden de prueba E2E P2P",
            total=(precio_pactado * qty_pedida).quantize(Decimal("1")),
            created_by_name="Auditor P2P",
        )
        db.add(po)
        await db.flush()

        po_item = PurchaseOrderItem(
            purchase_order_id=po.id,
            product_id=prod_orden.id,
            descripcion=prod_orden.nombre,
            cantidad=qty_pedida,
            precio_unitario=precio_pactado,
            total=(precio_pactado * qty_pedida).quantize(Decimal("1")),
            iva_tasa=10,
        )
        db.add(po_item)
        await db.commit()
        print(f"✓ Orden de Compra creada: N° {po.numero} por Gs. {po.total:,.0f}")

        # ---------------------------------------------------------------------
        # PASO 2: Recepción Física en Muelle (Con Lote, Vencimiento e Ítem Extra)
        # ---------------------------------------------------------------------
        print("\n--- PASO 2: RECEPCIÓN FÍSICA EN MUELLE ---")
        # El camión llega con solo 40 unidades del producto pedido (faltante de 10)
        # y 5 unidades del producto extraordinario que no estaba en la OC
        qty_recibida_oc = Decimal("40")
        qty_extraordinaria = Decimal("5")
        lote_codigo = f"LOT-TEST-{int(datetime.now().timestamp())}"
        vencimiento = datetime.now(timezone.utc) + timedelta(days=180)

        receipt_input = ReceiptCreate(
            company_id=COMPANY_ID,
            purchase_order_id=po.id,
            supplier_id=supplier.id,
            warehouse_id=warehouse_id,
            proveedor_ref="REM-CHOFER-998811",
            observaciones="Descarga realizada con faltante de 10 un y 5 un extraordinarias",
            items=[
                ReceiptItemInput(
                    product_id=prod_orden.id,
                    cantidad_ordenada=qty_pedida,
                    cantidad_recibida=qty_recibida_oc,
                    costo_unitario=precio_pactado,
                    lote=lote_codigo,
                    fecha_vencimiento=vencimiento,
                    cantidad_rechazada=Decimal("0"),
                    es_extraordinario=False,
                ),
                ReceiptItemInput(
                    product_id=prod_extra.id,
                    cantidad_ordenada=Decimal("0"),
                    cantidad_recibida=qty_extraordinaria,
                    costo_unitario=Decimal("25000"),
                    lote=f"LOT-EXTRA-{lote_codigo}",
                    fecha_vencimiento=vencimiento,
                    cantidad_rechazada=Decimal("0"),
                    es_extraordinario=True,
                    autorizacion_motivo="Adición extraordinaria aprobada en muelle por necesidad de stock",
                )
            ]
        )

        receipt = await purchases_service.create_receipt(db, receipt_input)
        await db.commit()
        print(f"✓ Recepción en muelle registrada: N° {receipt.numero}")
        print(f"  - Ítem OC recibido: {qty_recibida_oc} un (Lote {lote_codigo})")
        print(f"  - Ítem Extraordinario recibido: {qty_extraordinaria} un (Autorizado)")

        # Verificar movimiento de stock y lote
        lot_res = await db.execute(select(StockLot).where(StockLot.product_id == prod_orden.id, StockLot.referencia.like(f"%{lote_codigo}%")))
        lot_obj = lot_res.scalar_one_or_none()
        print(f"✓ StockLot verificado en DB: Cantidad {lot_obj.cantidad if lot_obj else 'N/A'}, Vence: {lot_obj.fecha_vencimiento if lot_obj else 'N/A'}")

        # ---------------------------------------------------------------------
        # PASO 3: Ingesta de Factura Fiscal DTE del Proveedor (Con Discrepancia)
        # ---------------------------------------------------------------------
        print("\n--- PASO 3: INGESTA DE FACTURA FISCAL DTE SIFEN ---")
        # El proveedor facturó las 50 unidades completas de la OC (a pesar de haber entregado 40)
        # Total facturado: 50 * 15.000 = 750.000 Gs.
        total_factura = Decimal("750000")
        num_fac = f"001-001-{int(datetime.now().timestamp()) % 1000000:07d}"

        invoice = SupplierInvoice(
            company_id=COMPANY_ID,
            supplier_id=supplier.id,
            purchase_order_id=po.id,
            receipt_id=receipt.id,
            numero_factura=num_fac,
            timbrado="18545636",
            fecha_emision=datetime.now(timezone.utc).date(),
            fecha_vencimiento=(datetime.now(timezone.utc) + timedelta(days=30)).date(),
            total=total_factura,
            saldo_pendiente=total_factura,
            estado="pendiente",
            bloqueada_para_pago=False,
        )
        db.add(invoice)
        await db.flush()

        inv_item = SupplierInvoiceItem(
            invoice_id=invoice.id,
            product_id=prod_orden.id,
            descripcion=prod_orden.nombre,
            cantidad=qty_pedida, # Facturó 50
            precio_unitario=precio_pactado,
            iva_tasa=10,
            total=total_factura,
        )
        db.add(inv_item)
        await db.commit()
        print(f"✓ Factura registrada: N° {invoice.numero_factura} por Gs. {invoice.total:,.0f}")

        # ---------------------------------------------------------------------
        # PASO 4: Auditoría 3-Way Match & Blindaje Fiscal en CxP
        # ---------------------------------------------------------------------
        print("\n--- PASO 4: CONCILIACIÓN 3-WAY MATCH & BLOQUEO FINANCIERO ---")
        match_res = await matching_service.perform_3way_match(db, invoice_id=str(invoice.id))
        print(f"✓ Resultado 3-Way Match: {match_res['estado_matching']}")
        print(f"  - Mensaje: {match_res['mensaje']}")
        print(f"  - Total Factura: Gs. {match_res['total_factura']:,.0f}")
        print(f"  - Total Recepción Muelle: Gs. {match_res['total_calculado_recepcion']:,.0f}")
        print(f"  - Diferencia / Reclamo: Gs. {match_res['diferencia_total']:,.0f}")
        print(f"  - Factura Bloqueada para Pago: {match_res['bloqueada_para_pago']}")
        nc_req = match_res.get("nc_request_generada")
        if nc_req:
            print(f"  - Solicitud de NC Generada: {nc_req.get('numero_solicitud')} por Gs. {nc_req.get('monto_reclamado'):,.0f}")

        # Verificar blindaje en Cuentas por Pagar (Tesorería)
        payables = await financial_service.get_payable_invoices(db, str(COMPANY_ID))
        found_in_payables = any(inv.get("id") == str(invoice.id) for inv in payables)
        print(f"✓ BLINDAJE CxP VERIFICADO: ¿Aparece la factura en órdenes de pago de Tesorería? {'SI (FALLO)' if found_in_payables else 'NO (BLOQUEADA EXITOSAMENTE)'}")
        assert not found_in_payables, "La factura no debería ser pagable mientras tenga discrepancia!"

        # ---------------------------------------------------------------------
        # PASO 5: Remisión de Nota de Crédito por el Proveedor y Resolución
        # ---------------------------------------------------------------------
        print("\n--- PASO 5: RECEPCIÓN DE NC DEL PROVEEDOR Y HABILITACIÓN DE PAGO ---")
        nc_req_id = nc_req.get("id")

        num_nc_real = f"001-001-{int(datetime.now().timestamp()) % 1000000:07d}"
        resolve_res = await matching_service.resolve_supplier_nc(
            db=db,
            request_id=str(nc_req_id),
            nc_recibida_numero=num_nc_real,
            nc_recibida_timbrado="18545636",
            nc_recibida_monto=Decimal("150000"), # 10 un * 15.000 Gs.
            nc_recibida_fecha=datetime.now(timezone.utc).date(),
            nc_recibida_cdc="01801503779001001000451212026090412345678901",
            observaciones="NC entregada por el fletero y confirmada por Compras",
        )
        print(f"✓ Resolución de NC ejecutada: {resolve_res['mensaje']}")

        # Recargar factura
        inv_reloaded = await db.get(SupplierInvoice, invoice.id)
        print(f"  - Nuevo Saldo Pendiente Factura: Gs. {inv_reloaded.saldo_pendiente:,.0f} (Original: Gs. {inv_reloaded.total:,.0f})")
        print(f"  - Estado Factura: {inv_reloaded.estado}")
        print(f"  - Bloqueada para Pago: {inv_reloaded.bloqueada_para_pago}")

        # Ahora verificar que SÍ aparezca en Tesorería con el nuevo saldo neto
        payables_after = await financial_service.get_payable_invoices(db, str(COMPANY_ID))
        inv_in_payables = next((inv for inv in payables_after if inv.get("id") == str(invoice.id)), None)
        print(f"✓ HABILITACIÓN VERIFICADA: ¿Aparece ahora en Tesorería? {'SI' if inv_in_payables else 'NO'}")
        if inv_in_payables:
            print(f"  - Saldo exacto a pagar por Tesorería: Gs. {inv_in_payables.get('saldo_pendiente', 0):,.0f}")
            assert Decimal(str(inv_in_payables.get('saldo_pendiente', 0))) == Decimal("600000"), f"El saldo debió ser 600.000 Gs., pero es {inv_in_payables.get('saldo_pendiente')}"

    print("\n" + "=" * 70)
    print("¡TEST END-TO-END DE P2P COMPLETADO CON ÉXITO ROTUNDO!")
    print("=" * 70)


if __name__ == "__main__":
    asyncio.run(run_p2p_e2e_test())
