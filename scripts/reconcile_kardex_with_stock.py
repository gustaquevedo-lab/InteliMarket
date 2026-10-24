"""Script para sanear inventory_movements eliminando los duplicados salida_venta_lote
y alineando el Kardex al 100% con el Stock real del sistema para todos los productos.
"""

import argparse
import asyncio
import logging
from sqlalchemy import text
from api.src.db import async_session_factory

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("reconcile_kardex")

async def run(dry_run: bool = True):
    log.info("Iniciando saneamiento de Kardex vs Stock (dry_run=%s)...", dry_run)
    async with async_session_factory() as db:
        # 1. Contar y auditar los registros duplicados de salida_venta_lote
        res_lote = await db.execute(text("""
            SELECT count(*), COALESCE(sum(cantidad), 0)
            FROM inventory_movements
            WHERE tipo = 'salida_venta_lote';
        """))
        cnt_lotes, sum_lotes = res_lote.first()
        log.info("Registros duplicados 'salida_venta_lote' en DB: %d (Total unidades: %d)", cnt_lotes, sum_lotes)

        # 2. Eliminar los duplicados si no es dry-run
        if not dry_run and cnt_lotes > 0:
            del_res = await db.execute(text("""
                DELETE FROM inventory_movements
                WHERE tipo = 'salida_venta_lote';
            """))
            log.info("Eliminados %d movimientos duplicados de 'salida_venta_lote'.", del_res.rowcount)
            await db.flush()

        # 3. Identificar productos con discrepancia entre stock.cantidad y SUM(inventory_movements)
        disc_query = text("""
            WITH mov_sum AS (
                SELECT product_id, warehouse_id, SUM(cantidad) as total_kardex
                FROM inventory_movements
                WHERE tipo != 'salida_venta_lote'
                GROUP BY product_id, warehouse_id
            ),
            first_dates AS (
                SELECT product_id, warehouse_id, MIN(created_at) as earliest_created
                FROM inventory_movements
                WHERE tipo != 'salida_venta_lote'
                GROUP BY product_id, warehouse_id
            )
            SELECT 
                s.product_id,
                s.warehouse_id,
                p.company_id,
                p.sku,
                p.nombre,
                s.cantidad as stock_qty,
                COALESCE(m.total_kardex, 0) as kardex_qty,
                (s.cantidad - COALESCE(m.total_kardex, 0)) as diff,
                COALESCE(s.costo_unitario, p.costo_promedio, p.ultimo_costo, 0) as costo_u,
                fd.earliest_created
            FROM stock s
            JOIN products p ON p.id = s.product_id
            LEFT JOIN mov_sum m ON m.product_id = s.product_id AND m.warehouse_id = s.warehouse_id
            LEFT JOIN first_dates fd ON fd.product_id = s.product_id AND fd.warehouse_id = s.warehouse_id
            WHERE s.cantidad != COALESCE(m.total_kardex, 0);
        """)

        res_disc = await db.execute(disc_query)
        discrepancies = res_disc.mappings().all()
        log.info("Productos que requieren calibración Kardex: %d", len(discrepancies))

        if not dry_run:
            insert_sql = text("""
                INSERT INTO inventory_movements (
                    id, company_id, warehouse_id, product_id, tipo,
                    cantidad, costo_unitario, referencia_type, motivo, created_at
                ) VALUES (
                    gen_random_uuid(), :comp_id, :wh_id, :prod_id, 'saldo_inicial',
                    :diff, :costo_u, 'calibracion_apertura',
                    'Alineación autoritativa de Kardex con Stock real (Apertura/Corte)',
                    COALESCE(:earliest_date - interval '1 second', '2025-01-01 00:00:00+00'::timestamptz)
                );
            """)

            batch_count = 0
            for row in discrepancies:
                await db.execute(insert_sql, {
                    "comp_id": row["company_id"],
                    "wh_id": row["warehouse_id"],
                    "prod_id": row["product_id"],
                    "diff": row["diff"],
                    "costo_u": row["costo_u"],
                    "earliest_date": row["earliest_created"],
                })
                batch_count += 1

            await db.commit()
            log.info("Insertados %d movimientos de calibración 'saldo_inicial'. Transacción consolidada.", batch_count)
        else:
            log.info("[DRY RUN] No se ejecutaron modificaciones en la base de datos.")

        # 4. Verificación final
        post_query = text("""
            WITH mov_sum AS (
                SELECT product_id, warehouse_id, SUM(cantidad) as total_kardex
                FROM inventory_movements
                WHERE tipo != 'salida_venta_lote'
                GROUP BY product_id, warehouse_id
            )
            SELECT 
                count(*) as total_rows,
                count(*) FILTER (WHERE s.cantidad = COALESCE(m.total_kardex, 0)) as matching_rows,
                count(*) FILTER (WHERE s.cantidad != COALESCE(m.total_kardex, 0)) as discrepant_rows
            FROM stock s
            LEFT JOIN mov_sum m ON m.product_id = s.product_id AND m.warehouse_id = s.warehouse_id;
        """)
        res_post = await db.execute(post_query)
        print("ESTADO:", res_post.mappings().all())

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--commit", action="store_true", help="Ejecutar y persistir cambios")
    args = parser.parse_args()
    asyncio.run(run(dry_run=not args.commit))
