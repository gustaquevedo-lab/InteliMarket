#!/usr/bin/env python3
"""
Consolida físicamente las líneas de ítems duplicadas en supermer_supplier_return_items
para todas las devoluciones a proveedor en estado no completado (pendiente, autorizado, rechazado).
"""

import sys
import asyncio
import asyncpg
from decimal import Decimal

DB_URI = "postgresql://intelimarket:password@127.0.0.1:5432/intelimarket"

async def main():
    conn = await asyncpg.connect(DB_URI)
    tr = conn.transaction()
    await tr.start()

    try:
        # 1. Obtener todas las devoluciones no completadas
        returns = await conn.fetch("""
            SELECT id, codigo, estado, total_items, valor_total_estimado
            FROM supermer_supplier_returns
            WHERE estado != 'completado'
            ORDER BY fecha_creacion ASC;
        """)
        print(f"Total devoluciones no completadas encontradas: {len(returns)}")

        total_returns_affected = 0
        total_items_eliminated = 0

        for r in returns:
            ret_id = r["id"]
            codigo = r["codigo"]
            estado = r["estado"]

            # Obtener todos los ítems de esta devolución
            items = await conn.fetch("""
                SELECT id, producto_id, factura_id, factura_numero, cantidad,
                       costo_promedio, valor_unitario, valor_total, motivo,
                       lote, fecha_vencimiento, detalle
                FROM supermer_supplier_return_items
                WHERE return_id = $1
                ORDER BY created_at ASC;
            """, ret_id)

            # Agrupar por producto_id
            groups = {}
            for row in items:
                prod_id = row["producto_id"]
                cant = Decimal(str(row["cantidad"] or 0))
                val_u = Decimal(str(row["valor_unitario"] or row["costo_promedio"] or 0))
                val_tot = Decimal(str(row["valor_total"] or (cant * val_u)))

                if prod_id not in groups:
                    groups[prod_id] = []
                groups[prod_id].append({
                    "id": row["id"],
                    "factura_id": row["factura_id"],
                    "factura_numero": row["factura_numero"],
                    "cantidad": cant,
                    "costo_promedio": val_u,
                    "valor_unitario": val_u,
                    "valor_total": val_tot,
                    "motivo": row["motivo"],
                    "lote": row["lote"],
                    "fecha_vencimiento": row["fecha_vencimiento"],
                    "detalle": row["detalle"],
                })

            # Detectar si hay duplicados
            has_duplicates = any(len(g) > 1 for g in groups.values())
            if not has_duplicates:
                continue

            print(f"\n--> Procesando devolución {codigo} ({ret_id}) en estado '{estado}'...")
            total_returns_affected += 1
            new_total_val = Decimal(0)
            new_total_count = len(groups)

            for prod_id, prod_items in groups.items():
                if len(prod_items) == 1:
                    new_total_val += prod_items[0]["valor_total"]
                    continue

                primary = prod_items[0]
                duplicates = prod_items[1:]

                sum_cant = primary["cantidad"]
                sum_tot = primary["valor_total"]
                lotes = [primary["lote"]]
                vtos = [primary["fecha_vencimiento"]]
                fac_nums = [primary["factura_numero"]]
                detalles = [primary["detalle"]]

                for d in duplicates:
                    sum_cant += d["cantidad"]
                    sum_tot += d["valor_total"]
                    if d["lote"]:
                        lotes.append(d["lote"])
                    if d["fecha_vencimiento"]:
                        vtos.append(d["fecha_vencimiento"])
                    if d["factura_numero"]:
                        fac_nums.append(d["factura_numero"])
                    if d["detalle"]:
                        detalles.append(d["detalle"])

                new_unit = (sum_tot / sum_cant) if sum_cant > 0 else primary["valor_unitario"]
                unique_lotes = ", ".join(filter(None, set(lotes))) or None
                unique_vtos = next(filter(None, vtos), None)
                unique_facs = ", ".join(filter(None, set(fac_nums))) or None
                unique_dets = " | ".join(filter(None, set(detalles))) or None

                # Actualizar el ítem primario
                await conn.execute("""
                    UPDATE supermer_supplier_return_items
                    SET cantidad = $1,
                        valor_unitario = $2,
                        costo_promedio = $3,
                        valor_total = $4,
                        lote = $5,
                        fecha_vencimiento = $6,
                        factura_numero = $7,
                        detalle = $8
                    WHERE id = $9;
                """, sum_cant, new_unit, new_unit, sum_tot,
                    unique_lotes, unique_vtos, unique_facs, unique_dets,
                    primary["id"]
                )

                # Eliminar los ítems duplicados
                dup_ids = [d["id"] for d in duplicates]
                await conn.execute("""
                    DELETE FROM supermer_supplier_return_items
                    WHERE id = ANY($1::uuid[]);
                """, dup_ids)

                total_items_eliminated += len(dup_ids)
                new_total_val += sum_tot
                print(f"    Producto {prod_id}: unificados {len(prod_items)} registros en 1. Cant: {sum_cant}, Total: {sum_tot}")

            # Actualizar cabecera de la devolución
            await conn.execute("""
                UPDATE supermer_supplier_returns
                SET total_items = $1,
                    valor_total_estimado = $2
                WHERE id = $3;
            """, new_total_count, new_total_val, ret_id)
            print(f"    Cabecera {codigo} actualizada: {new_total_count} ítems únicos, Total Gs. {new_total_val}")

        await tr.commit()
        print(f"\n✓ Operación completada con éxito:")
        print(f"  Devoluciones unificadas: {total_returns_affected}")
        print(f"  Registros duplicados eliminados: {total_items_eliminated}")

    except Exception as e:
        await tr.rollback()
        print(f"ERROR: {e}")
        sys.exit(1)
    finally:
        await conn.close()

if __name__ == "__main__":
    asyncio.run(main())
