"""Script de Sinceramiento Auditado de Stock para Productos Pesables / Fraccionarios.
InteliMarket — Extra Supermercado

Detecta y regulariza el stock fantasma acumulado por el truncamiento int(cantidad) en ventas históricas.
Modo de uso:
    python scripts/sincerar_stock_pesables_historico.py --dry-run
    python scripts/sincerar_stock_pesables_historico.py --apply
"""

import sys
import asyncio
from decimal import Decimal
from datetime import datetime, timezone
import argparse

from api.src.db import async_session_factory
from sqlalchemy import text


COMPANY_ID = "00000000-0000-0000-0000-000000000010"


async def sincerar_stock(dry_run: bool = True):
    print("=" * 80)
    print(f"SINCERAMIENTO DE STOCK PESABLES / FRACCIONARIOS — EXTRA SUPERMERCADO")
    print(f"Modo: {'DRY-RUN (Simulación sin cambios)' if dry_run else 'APLICAR EN PRODUCCIÓN'}")
    print("=" * 80)

    async with async_session_factory() as db:
        # 1. Encontrar todos los productos con ventas decimales y calcular el desfase exacto:
        # total_vendido en sale_items vs total_descontado en inventory_movements (tipo='salida_venta')
        q = text("""
            WITH ventas AS (
                SELECT 
                    si.product_id,
                    SUM(si.cantidad) as total_vendido_real,
                    COUNT(si.id) as tickets_total,
                    SUM(CASE WHEN si.cantidad != FLOOR(si.cantidad) THEN 1 ELSE 0 END) as tickets_decimales
                FROM sale_items si
                JOIN sales s ON s.id = si.sale_id
                WHERE s.company_id = :cid
                  AND s.estado NOT IN ('anulada', 'cancelada')
                GROUP BY si.product_id
                HAVING SUM(CASE WHEN si.cantidad != FLOOR(si.cantidad) THEN 1 ELSE 0 END) > 0
            ),
            salidas_kardex AS (
                SELECT 
                    im.product_id,
                    ABS(SUM(im.cantidad)) as total_descontado_kardex
                FROM inventory_movements im
                WHERE im.company_id = :cid
                  AND (
                    (im.tipo = 'salida_venta' AND im.referencia_type = 'sale')
                    OR (im.tipo = 'correccion_sistema' AND im.motivo ILIKE 'Sinceramiento auditado%')
                  )
                GROUP BY im.product_id
            )
            SELECT 
                p.id as product_id,
                p.sku,
                p.nombre,
                p.unidad_medida,
                COALESCE(stk.cantidad, 0) as stock_actual,
                stk.warehouse_id,
                v.total_vendido_real,
                v.tickets_total,
                v.tickets_decimales,
                COALESCE(sk.total_descontado_kardex, 0) as total_descontado_kardex,
                GREATEST(v.total_vendido_real - COALESCE(sk.total_descontado_kardex, 0), 0) as desfase_no_descontado
            FROM ventas v
            JOIN products p ON p.id = v.product_id
            LEFT JOIN salidas_kardex sk ON sk.product_id = v.product_id
            LEFT JOIN stock stk ON stk.product_id = v.product_id
            WHERE (v.total_vendido_real - COALESCE(sk.total_descontado_kardex, 0)) >= 0.005
            ORDER BY (v.total_vendido_real - COALESCE(sk.total_descontado_kardex, 0)) DESC
        """)

        res = await db.execute(q, {"cid": COMPANY_ID})
        rows = res.fetchall()

        total_prods = len(rows)
        print(f"\nProductos encontrados con desfase por truncamiento decimal: {total_prods}")

        total_desfase_acumulado = Decimal("0")
        prods_to_update = []

        for r in rows:
            desfase = Decimal(str(r.desfase_no_descontado)).quantize(Decimal("0.001"))
            stock_actual = Decimal(str(r.stock_actual)).quantize(Decimal("0.001"))
            nuevo_stock = (stock_actual - desfase).quantize(Decimal("0.001"))
            total_desfase_acumulado += desfase

            prods_to_update.append({
                "product_id": r.product_id,
                "sku": r.sku,
                "nombre": r.nombre,
                "unidad": r.unidad_medida,
                "warehouse_id": r.warehouse_id,
                "stock_actual": stock_actual,
                "desfase": desfase,
                "nuevo_stock": nuevo_stock,
                "vendido_real": Decimal(str(r.total_vendido_real)).quantize(Decimal("0.001")),
                "descontado_kardex": Decimal(str(r.total_descontado_kardex)).quantize(Decimal("0.001")),
            })

        print("\nTOP 20 PRODUCTOS CON MAYOR AJUSTE:")
        print(f"{'SKU':<8} | {'NOMBRE':<32} | {'STOCK SIS':<10} | {'DESFASE':<10} | {'STOCK REAL':<10} | {'UNIDAD'}")
        print("-" * 85)
        for p in prods_to_update[:20]:
            print(f"{p['sku']:<8} | {p['nombre'][:32]:<32} | {p['stock_actual']:<10.3f} | -{p['desfase']:<9.3f} | {p['nuevo_stock']:<10.3f} | {p['unidad']}")

        # Mostrar específicamente los 3 de Kokue Poty
        print("\nDETALLE DE KOKUE POTY (SOLICITADOS POR EL USUARIO):")
        for p in prods_to_update:
            if p["sku"] in ("126617", "126618", "126549"):
                print(f" -> SKU {p['sku']} ({p['nombre']}): Stock Sistema {p['stock_actual']} -> Descontar {p['desfase']} -> Stock Sincerado: {p['nuevo_stock']} {p['unidad']}")

        print("-" * 85)
        print(f"Total productos a corregir: {len(prods_to_update)}")

        if dry_run:
            print("\n[INFO] Ejecución en DRY-RUN finalizada. No se modificó ningún dato en la base de datos.")
            print("Para aplicar los cambios reales, ejecute con: --apply")
            return

        print("\n[EJECUCIÓN] Aplicando correcciones en la base de datos...")
        count_updated = 0

        for p in prods_to_update:
            wh_id = p["warehouse_id"]
            if not wh_id:
                # Si no tiene warehouse asignado, buscar el depósito central
                wh_res = await db.execute(text("SELECT id FROM warehouses WHERE company_id = :cid LIMIT 1"), {"cid": COMPANY_ID})
                wh_id = wh_res.scalar()

            # 1. Actualizar stock
            await db.execute(text("""
                UPDATE stock 
                SET cantidad = :nuevo_stock, updated_at = NOW()
                WHERE product_id = :pid
            """), {
                "nuevo_stock": p["nuevo_stock"],
                "pid": p["product_id"],
            })

            # 2. Insertar movimiento de auditoría en Kardex
            await db.execute(text("""
                INSERT INTO inventory_movements (
                    id, company_id, warehouse_id, product_id, tipo, cantidad,
                    costo_unitario, referencia_type, referencia_id, motivo, created_at
                ) VALUES (
                    gen_random_uuid(), :cid, :wh_id, :pid, 'correccion_sistema', :cant,
                    0, 'auditoria_stock_decimal', NULL, :motivo, NOW()
                )
            """), {
                "cid": COMPANY_ID,
                "wh_id": wh_id,
                "pid": p["product_id"],
                "cant": -p["desfase"],
                "motivo": f"Sinceramiento auditado: deduccion de fracciones decimales no rebajadas por truncamiento int() ({p['desfase']} {p['unidad']})"
            })

            # 3. Regularizar lotes si existen
            rem_lot = p["desfase"]
            lots_res = await db.execute(text("""
                SELECT id, cantidad, cantidad_disponible 
                FROM stock_lots 
                WHERE product_id = :pid AND cantidad_disponible > 0
                ORDER BY fecha_ingreso ASC
            """), {"pid": p["product_id"]})
            lots = lots_res.fetchall()
            for lot in lots:
                if rem_lot <= Decimal("0"):
                    break
                disp = Decimal(str(lot.cantidad_disponible))
                ded = min(disp, rem_lot)
                await db.execute(text("""
                    UPDATE stock_lots
                    SET cantidad_disponible = cantidad_disponible - :ded,
                        cantidad = GREATEST(0, cantidad - :ded)
                    WHERE id = :lid
                """), {"ded": ded, "lid": lot.id})
                rem_lot -= ded

            count_updated += 1

        await db.commit()
        print(f"\n[ÉXITO] Se sinceró el stock de {count_updated} productos pesables en la base de datos.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Sinceramiento de stock para pesables.")
    parser.add_argument("--apply", action="store_true", help="Aplica los cambios en la base de datos.")
    parser.add_argument("--dry-run", action="store_true", default=True, help="Modo simulación (por defecto).")
    args = parser.parse_args()

    is_dry_run = not args.apply
    asyncio.run(sincerar_stock(dry_run=is_dry_run))
