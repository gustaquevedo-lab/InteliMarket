"""
Script de verificación y auditoría del Umbral Mensual de Compras (80% Ventas Mes Anterior).
Ejecuta validaciones sin mutar permanentemente la base de datos (con rollback).
"""

import asyncio
from datetime import datetime, date, timezone
from decimal import Decimal
from zoneinfo import ZoneInfo
import uuid

from api.src.db import async_session_factory
from api.src.purchases.service import (
    get_monthly_purchase_threshold,
    confirm_purchase_order,
    request_po_authorization,
)
from api.src.purchases.models import PurchaseOrder, PurchaseOrderItem, PurchaseOrderHistory
from sqlalchemy import select, text


async def run_audit():
    print("=" * 70)
    print("AUDITORÍA DE REGLA: UMBRAL DE COMPRAS (80% VENTAS MES ANTERIOR)")
    print("=" * 70)

    COMPANY_ID = "00000000-0000-0000-0000-000000000010"

    async with async_session_factory() as db:
        # 1. Probar cálculo de umbral mensual
        threshold = await get_monthly_purchase_threshold(db, COMPANY_ID)
        print("\n[1] DATOS DEL UMBRAL MENSUAL (Zona Horaria: America/Asuncion):")
        print(f"  * Mes Anterior:         {threshold['mes_anterior_label']}")
        print(f"  * Mes Actual:           {threshold['mes_actual_label']}")
        print(f"  * Ventas Mes Anterior:  ₲ {threshold['ventas_mes_anterior']:,}")
        print(f"  * Umbral Compras (80%): ₲ {threshold['umbral_compras']:,}")
        print(f"  * Compras Mes Actual:   ₲ {threshold['compras_mes_actual']:,}")
        print(f"  * Saldo Disponible:     ₲ {threshold['disponible']:,}")
        print(f"  * % Consumido:          {threshold['porcentaje_consumido']}%")
        print(f"  * Estado:               {'EXCEDIDO' if threshold['excedido'] else 'DENTRO DEL UMBRAL'}")

        assert threshold["umbral_compras"] == round(threshold["ventas_mes_anterior"] * 0.8), "El umbral debe ser exactamente el 80%"
        print("  ✓ Cálculo matemático del 80% verificado correctamente.")

        # 2. Obtener un proveedor existente para las pruebas
        res_supp = await db.execute(text("SELECT id FROM suppliers LIMIT 1"))
        supplier_id = res_supp.scalar()
        if not supplier_id:
            print("  ⚠️ No se encontró proveedor para pruebas.")
            return

        # Obtener un producto existente
        res_prod = await db.execute(text("SELECT id FROM products LIMIT 1"))
        product_id = res_prod.scalar()
        if not product_id:
            print("  ⚠️ No se encontró producto para pruebas.")
            return

        # 3. Test Caso A: Orden DENTRO del umbral confirmada por Gerente (is_admin=False)
        print("\n[2] TEST CASO A: Orden que NO excede el umbral (Confirmada por Gerente)")
        test_po_a = PurchaseOrder(
            company_id=uuid.UUID(COMPANY_ID),
            supplier_id=supplier_id,
            numero=f"TEST-A-{uuid.uuid4().hex[:6]}",
            estado="borrador",
            moneda="PYG",
            subtotal=Decimal("10000"),
            total=Decimal("10000"),
        )
        db.add(test_po_a)
        await db.flush()

        test_item_a = PurchaseOrderItem(
            purchase_order_id=test_po_a.id,
            product_id=product_id,
            cantidad=Decimal("1"),
            precio_unitario=Decimal("10000"),
            total=Decimal("10000"),
        )
        db.add(test_item_a)
        await db.flush()

        # Gerente intenta confirmar (is_admin=False)
        order_res_a, err_a, needs_auth_a = await confirm_purchase_order(
            db, str(test_po_a.id), user_id="00000000-0000-0000-0000-000000000002", user_name="Gerente Test", is_admin=False
        )
        assert err_a is None, f"No debería fallar si entra en el disponible: {err_a}"
        assert order_res_a.estado == "confirmado", "La orden debería quedar confirmada"
        print(f"  ✓ Orden {test_po_a.numero} (₲ 10.000) confirmada exitosamente por Gerente sin trámite adicional.")

        # 4. Test Caso B: Orden que EXCEDE el umbral intentada por Gerente (is_admin=False)
        # Monto gigante que garantice superar el disponible (₲ 2.000.000.000)
        print("\n[3] TEST CASO B: Orden que EXCEDE el 80% (Gerente intenta confirmar)")
        monto_exceso = Decimal("2000000000")
        test_po_b = PurchaseOrder(
            company_id=uuid.UUID(COMPANY_ID),
            supplier_id=supplier_id,
            numero=f"TEST-B-{uuid.uuid4().hex[:6]}",
            estado="borrador",
            moneda="PYG",
            subtotal=monto_exceso,
            total=monto_exceso,
        )
        db.add(test_po_b)
        await db.flush()

        test_item_b = PurchaseOrderItem(
            purchase_order_id=test_po_b.id,
            product_id=product_id,
            cantidad=Decimal("1"),
            precio_unitario=monto_exceso,
            total=monto_exceso,
        )
        db.add(test_item_b)
        await db.flush()

        order_res_b, err_b, needs_auth_b = await confirm_purchase_order(
            db, str(test_po_b.id), user_id="00000000-0000-0000-0000-000000000002", user_name="Gerente Test", is_admin=False
        )
        assert needs_auth_b is True, "Debe marcar que requiere autorización"
        assert order_res_b.estado == "pendiente_autorizacion", "La orden debe transicionar a 'pendiente_autorizacion'"
        print(f"  ✓ Gerente bloqueado correctamente: {err_b}")
        print(f"  ✓ Estado de la orden transicionó a '{order_res_b.estado}'.")

        # 5. Test Caso C: Gerente intenta re-confirmar orden en 'pendiente_autorizacion'
        print("\n[4] TEST CASO C: Gerente intenta confirmar orden que ya está en 'pendiente_autorizacion'")
        order_res_c, err_c, needs_auth_c = await confirm_purchase_order(
            db, str(test_po_b.id), user_id="00000000-0000-0000-0000-000000000002", user_name="Gerente Test", is_admin=False
        )
        assert order_res_c is None, "Gerente no puede confirmar orden pendiente de autorización"
        assert needs_auth_c is True, "Debe rechazar requiriendo autorización de administración"
        print(f"  ✓ Bloqueo confirmado: {err_c}")

        # 6. Test Caso D: Administrador autoriza y confirma orden que excede el umbral (is_admin=True)
        print("\n[5] TEST CASO D: Administrador autoriza y confirma orden en 'pendiente_autorizacion'")
        admin_uid = "00000000-0000-0000-0000-000000000001"
        order_res_d, err_d, needs_auth_d = await confirm_purchase_order(
            db, str(test_po_b.id), user_id=admin_uid, user_name="Admin Director", is_admin=True
        )
        assert err_d is None, f"Admin no debería fallar: {err_d}"
        assert order_res_d.estado == "confirmado", "La orden debe quedar confirmada"
        assert str(order_res_d.aprobado_por) == admin_uid, "Debe registrar a admin en aprobado_por"
        assert order_res_d.fecha_aprobacion is not None, "Debe registrar fecha_aprobacion"
        print(f"  ✓ Orden autorizada y confirmada por Administración exitosamente!")
        print(f"  * Aprobado por:    {order_res_d.aprobado_por}")
        print(f"  * Fecha aprobación: {order_res_d.fecha_aprobacion}")

        # Revertir cambios de prueba para dejar la base de datos impecable
        await db.rollback()
        print("\n✓ Rollback completado. La base de datos no fue alterada con registros de prueba.")
        print("=" * 70)
        print("TODAS LAS VERIFICACIONES DEL UMBRAL DE COMPRAS PASARON EXITOSAMENTE (100%)")
        print("=" * 70)


if __name__ == "__main__":
    asyncio.run(run_audit())
