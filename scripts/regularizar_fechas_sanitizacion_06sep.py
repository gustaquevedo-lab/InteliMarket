"""Script de remediación para alinear fecha_emision y fecha_vencimiento en accounts_receivable,
y created_at en credit_movements, con la fecha real de la venta (sales.fecha) para todos los
comprobantes afectados por la sanitización del 06/09/2026.

Uso:
  python scripts/regularizar_fechas_sanitizacion_06sep.py --dry-run
  python scripts/regularizar_fechas_sanitizacion_06sep.py --apply
"""

import sys
import asyncio
import argparse
from datetime import timedelta
from sqlalchemy import text

from api.src.db import async_session_factory


async def regularize(apply_changes: bool = False):
    async with async_session_factory() as db:
        print("=" * 80)
        print("REGULARIZACIÓN DE FECHAS: COMPROBANTES AFECTADOS POR SANITIZACIÓN 06/09/2026")
        print(f"Modo: {'APLICAR CAMBIOS EN BASE DE DATOS' if apply_changes else 'DRY RUN (Solo lectura)'}")
        print("=" * 80)

        # 1. Obtener cuentas por cobrar creadas durante la corrida del 06/09/2026
        q_ar = text("""
            SELECT 
                ar.id,
                ar.numero_documento,
                ar.fecha_emision AS ar_fecha_emision,
                ar.fecha_vencimiento AS ar_fecha_vencimiento,
                ar.monto_original,
                s.id AS sale_id,
                s.numero AS sale_numero,
                s.fecha AS sale_fecha,
                COALESCE(c.razon_social, c.nombre_fantasia, c.ruc, 'Cliente') AS cliente_nombre,
                c.ruc AS cliente_ruc
            FROM accounts_receivable ar
            JOIN sales s ON s.id = ar.sale_id
            LEFT JOIN customers c ON c.id = ar.customer_id
            WHERE ar.created_at >= '2026-09-06 09:50:00-03' 
              AND ar.created_at <= '2026-09-06 10:00:00-03'
            ORDER BY s.fecha ASC
        """)
        res_ar = await db.execute(q_ar)
        rows_ar = res_ar.fetchall()

        print(f"\n1. Cuentas por Cobrar encontradas para regularizar: {len(rows_ar)}")

        # 2. Obtener movimientos de crédito generados en esa misma regularización
        q_cm = text("""
            SELECT 
                cm.id,
                cm.created_at AS cm_created_at,
                cm.observaciones,
                cm.monto,
                s.id AS sale_id,
                s.numero AS sale_numero,
                s.fecha AS sale_fecha,
                COALESCE(c.razon_social, c.nombre_fantasia, c.ruc, 'Cliente') AS cliente_nombre
            FROM credit_movements cm
            JOIN sales s ON s.id = cm.referencia_id
            LEFT JOIN customers c ON c.id = cm.customer_id
            WHERE cm.observaciones LIKE 'Regularizacion venta%'
            ORDER BY s.fecha ASC
        """)
        res_cm = await db.execute(q_cm)
        rows_cm = res_cm.fetchall()

        print(f"2. Movimientos de Crédito encontrados para regularizar: {len(rows_cm)}")

        if not rows_ar and not rows_cm:
            print("\nNo se encontraron registros pendientes de regularización.")
            return

        # Previsualización de comprobantes clave (incluyendo PINAZO)
        print("\n--- Previsualización de Comprobantes a Regularizar (Muestra) ---")
        pinazo_encontrados = 0
        for r in rows_ar:
            nueva_venc = (r.sale_fecha.date() + timedelta(days=30))
            is_pinazo = "PINAZO" in (r.cliente_nombre or "").upper() or r.sale_numero in ("001-015-0000455", "001-015-0000478")
            if is_pinazo:
                pinazo_encontrados += 1
                print(f"  [PINAZO] Doc: {r.numero_documento} | Cliente: {r.cliente_nombre}")
                print(f"           Fecha Actual AR: {r.ar_fecha_emision} -> Nueva Fecha: {r.sale_fecha}")
                print(f"           Vencimiento Actual: {r.ar_fecha_vencimiento} -> Nuevo Vencimiento: {nueva_venc}")

        print(f"\nTotal comprobantes de PINAZO previsualizados: {pinazo_encontrados}")

        if apply_changes:
            print("\n>> Aplicando actualización de fechas en accounts_receivable...")
            q_upd_ar = text("""
                UPDATE accounts_receivable ar
                SET 
                    fecha_emision = s.fecha,
                    fecha_vencimiento = (s.fecha AT TIME ZONE 'America/Asuncion')::date + interval '30 days',
                    updated_at = NOW()
                FROM sales s
                WHERE ar.sale_id = s.id
                  AND ar.created_at >= '2026-09-06 09:50:00-03' 
                  AND ar.created_at <= '2026-09-06 10:00:00-03'
            """)
            res_upd_ar = await db.execute(q_upd_ar)
            print(f"   Filas actualizadas en accounts_receivable: {res_upd_ar.rowcount}")

            print(">> Aplicando actualización de fechas en credit_movements...")
            q_upd_cm = text("""
                UPDATE credit_movements cm
                SET 
                    created_at = s.fecha
                FROM sales s
                WHERE cm.referencia_id = s.id
                  AND cm.observaciones LIKE 'Regularizacion venta%'
            """)
            res_upd_cm = await db.execute(q_upd_cm)
            print(f"   Filas actualizadas en credit_movements: {res_upd_cm.rowcount}")

            await db.commit()
            print("\n" + "=" * 80)
            print("REGULARIZACIÓN COMPLETADA CON ÉXITO Y TRANSACCIÓN CONFIRMADA.")
            print("=" * 80)
        else:
            print("\n" + "=" * 80)
            print("MODO DRY-RUN FINALIZADO -- NINGÚN DATO FUE MODIFICADO.")
            print("Para aplicar los cambios en base de datos, ejecute con --apply")
            print("=" * 80)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Regularizar fechas sanitizacion 06/09")
    parser.add_argument("--apply", action="store_true", help="Aplicar cambios en la base de datos")
    args = parser.parse_args()

    asyncio.run(regularize(apply_changes=args.apply))
