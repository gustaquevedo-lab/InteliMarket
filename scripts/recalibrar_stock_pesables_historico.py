"""Script de Recalibración Auditada de Stock Pesable.
InteliMarket — Extra Supermercado

Revierte la deducción en exceso de ventas históricas del sistema legacy (2025/principios 2026)
aplicada el 2026-10-28, preservando intacta la deducción real de fracciones decimales no
rebajadas por truncamiento int() en el POS de InteliMarket.

Modo de uso:
    python scripts/recalibrar_stock_pesables_historico.py --dry-run
    python scripts/recalibrar_stock_pesables_historico.py --apply
"""

import sys
import asyncio
from decimal import Decimal
import argparse

from api.src.db import async_session_factory
from sqlalchemy import text


COMPANY_ID = "00000000-0000-0000-0000-000000000010"


async def recalibrar_stock(dry_run: bool = True):
    print("=" * 85)
    print("RECALIBRACIÓN AUDITADA DE STOCK PESABLES — EXTRA SUPERMERCADO")
    print(f"Modo: {'DRY-RUN (Simulación sin cambios)' if dry_run else 'APLICAR EN PRODUCCIÓN'}")
    print("=" * 85)

    async with async_session_factory() as db:
        # Verificar si ya se aplicó previamente para garantizar idempotencia total
        check_applied = await db.execute(text("""
            SELECT COUNT(*) 
            FROM inventory_movements 
            WHERE company_id = :cid 
              AND tipo = 'correccion_sistema' 
              AND referencia_type = 'recalibracion_stock_decimal'
        """), {"cid": COMPANY_ID})
        applied_count = check_applied.scalar() or 0

        if applied_count > 0 and not dry_run:
            print(f"\n[ALERTA] Ya existen {applied_count} movimientos de 'recalibracion_stock_decimal' en la BD.")
            print("El script es idempotente y solo procesará SKUs pendientes de ajuste.")

        q = text("""
            WITH ticket_sales AS (
                SELECT 
                    si.product_id,
                    SUM(si.cantidad - FLOOR(si.cantidad)) as fraccion_real
                FROM sale_items si
                JOIN sales s ON s.id = si.sale_id
                WHERE s.company_id = :cid
                  AND s.tipo_comprobante = 'ticket'
                  AND s.estado NOT IN ('anulada', 'cancelada')
                  AND s.created_at < '2026-10-28 10:00:00'
                GROUP BY si.product_id
            ),
            prev_correction AS (
                SELECT 
                    im.product_id,
                    ABS(SUM(im.cantidad)) as total_restado_previo
                FROM inventory_movements im
                WHERE im.company_id = :cid
                  AND im.tipo = 'correccion_sistema' 
                  AND im.referencia_type = 'auditoria_stock_decimal'
                GROUP BY im.product_id
            ),
            already_recalibrated AS (
                SELECT 
                    im.product_id,
                    SUM(im.cantidad) as total_restituido
                FROM inventory_movements im
                WHERE im.company_id = :cid
                  AND im.tipo = 'correccion_sistema' 
                  AND im.referencia_type = 'recalibracion_stock_decimal'
                GROUP BY im.product_id
            )
            SELECT 
                p.id as product_id,
                p.sku,
                p.nombre,
                p.unidad_medida,
                stk.warehouse_id,
                COALESCE(stk.cantidad, 0) as stock_actual,
                pc.total_restado_previo,
                COALESCE(ts.fraccion_real, 0) as fraccion_real_debida,
                COALESCE(ar.total_restituido, 0) as ya_restituido,
                (pc.total_restado_previo - COALESCE(ts.fraccion_real, 0) - COALESCE(ar.total_restituido, 0)) as exceso_a_restituir
            FROM prev_correction pc
            JOIN products p ON p.id = pc.product_id
            JOIN stock stk ON stk.product_id = pc.product_id
            LEFT JOIN ticket_sales ts ON ts.product_id = pc.product_id
            LEFT JOIN already_recalibrated ar ON ar.product_id = pc.product_id
            WHERE (pc.total_restado_previo - COALESCE(ts.fraccion_real, 0) - COALESCE(ar.total_restituido, 0)) > 0.005
            ORDER BY (pc.total_restado_previo - COALESCE(ts.fraccion_real, 0) - COALESCE(ar.total_restituido, 0)) DESC;
        """)

        res = await db.execute(q, {"cid": COMPANY_ID})
        rows = res.fetchall()

        total_prods = len(rows)
        print(f"\nProductos que requieren restitución de exceso histórico: {total_prods}")

        if total_prods == 0:
            print("[INFO] Todos los productos ya están debidamente calibrados. No hay excesos pendientes.")
            return

        total_restituir = Decimal("0")
        prods_to_update = []

        for r in rows:
            exceso = Decimal(str(r.exceso_a_restituir)).quantize(Decimal("0.001"))
            stock_actual = Decimal(str(r.stock_actual)).quantize(Decimal("0.001"))
            stock_recalibrado = (stock_actual + exceso).quantize(Decimal("0.001"))
            total_restituir += exceso

            prods_to_update.append({
                "product_id": r.product_id,
                "sku": r.sku,
                "nombre": r.nombre,
                "unidad": r.unidad_medida or "KG",
                "warehouse_id": r.warehouse_id,
                "stock_actual": stock_actual,
                "exceso": exceso,
                "stock_recalibrado": stock_recalibrado,
                "total_restado_previo": Decimal(str(r.total_restado_previo)).quantize(Decimal("0.001")),
                "fraccion_real_debida": Decimal(str(r.fraccion_real_debida)).quantize(Decimal("0.001")),
            })

        print("\nTOP 25 PRODUCTOS CON MAYOR RESTITUCIÓN DE STOCK:")
        print(f"{'SKU':<8} | {'NOMBRE':<32} | {'STOCK HOY':<11} | {'RESTITUIR':<11} | {'STOCK FINAL':<11} | {'UNIDAD'}")
        print("-" * 90)
        for p in prods_to_update[:25]:
            print(f"{p['sku']:<8} | {p['nombre'][:32]:<32} | {p['stock_actual']:<11.3f} | +{p['exceso']:<10.3f} | {p['stock_recalibrado']:<11.3f} | {p['unidad']}")

        print("-" * 90)
        print(f"Total productos a recalibrar: {len(prods_to_update)}")
        print(f"Volumen total a restituir: {total_restituir:,.3f} KG")

        # Comprobar Kokue Poty para asegurar que no se toque
        kokue_in_list = [p for p in prods_to_update if p["sku"] in ("126617", "126618", "126549")]
        if kokue_in_list:
            print("\n[ALERTA] Kokue Poty apareció en la lista (no esperado):", kokue_in_list)
        else:
            print("\n[VERIFICACIÓN] Kokue Poty (126617, 126618, 126549) tiene exceso 0 y permanece intacto.")

        if dry_run:
            print("\n[INFO] Ejecución en DRY-RUN finalizada. No se modificó ningún dato en la base de datos.")
            print("Para aplicar los cambios reales en producción, ejecute con: --apply")
            return

        print("\n[EJECUCIÓN] Aplicando recalibración y movimientos de Kardex en producción...")
        count_updated = 0

        for p in prods_to_update:
            wh_id = p["warehouse_id"]
            if not wh_id:
                wh_res = await db.execute(text("SELECT id FROM warehouses WHERE company_id = :cid LIMIT 1"), {"cid": COMPANY_ID})
                wh_id = wh_res.scalar()

            # 1. Actualizar stock físico autoritativo
            await db.execute(text("""
                UPDATE stock 
                SET cantidad = :nuevo_stock, updated_at = NOW()
                WHERE product_id = :pid
            """), {
                "nuevo_stock": p["stock_recalibrado"],
                "pid": p["product_id"],
            })

            # 2. Insertar movimiento de auditoría en Kardex
            await db.execute(text("""
                INSERT INTO inventory_movements (
                    id, company_id, warehouse_id, product_id, tipo, cantidad,
                    costo_unitario, referencia_type, referencia_id, motivo, created_at
                ) VALUES (
                    gen_random_uuid(), :cid, :wh_id, :pid, 'correccion_sistema', :cant,
                    0, 'recalibracion_stock_decimal', NULL, :motivo, NOW()
                )
            """), {
                "cid": COMPANY_ID,
                "wh_id": wh_id,
                "pid": p["product_id"],
                "cant": p["exceso"],
                "motivo": f"Recalibracion auditada: restitucion de ventas historicas legacy descontadas indebidamente el 2026-10-28 (+{p['exceso']} {p['unidad']})"
            })

            count_updated += 1

        await db.commit()
        print(f"\n[ÉXITO] Se recalibró exitosamente el stock de {count_updated} productos pesables.")
        print(f"Volumen neto restituido a inventario: +{total_restituir:,.3f} KG.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Recalibración de stock para pesables.")
    parser.add_argument("--apply", action="store_true", help="Aplica los cambios en la base de datos.")
    parser.add_argument("--dry-run", action="store_true", default=True, help="Modo simulación (por defecto).")
    args = parser.parse_args()

    is_dry_run = not args.apply
    asyncio.run(recalibrar_stock(dry_run=is_dry_run))
