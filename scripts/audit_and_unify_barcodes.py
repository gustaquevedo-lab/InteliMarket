import asyncio
from uuid import UUID
from sqlalchemy import text
from api.src.db import async_session_factory
from api.src.nemuha_connector.service import _legacy_connect
import pymysql.cursors

async def run(dry_run=True):
    # 1. Conectar a legacy Nemuha para obtener datos maestros
    leg_conn = _legacy_connect()
    leg_products = {}
    with leg_conn.cursor(pymysql.cursors.DictCursor) as cur:
        cur.execute("""
            SELECT p.ID_PRODUTO, p.DS_PRODUTO, p.VL_PRECO_VENDA_VAREJO, p.BO_ATIVO,
                   coalesce(sum(e.QTD_PRODUTO), 0) as estoque_leg
            FROM est_produto p
            LEFT JOIN est_existencia e ON e.ID_PRODUTO = p.ID_PRODUTO
            GROUP BY p.ID_PRODUTO, p.DS_PRODUTO, p.VL_PRECO_VENDA_VAREJO, p.BO_ATIVO
        """)
        for r in cur.fetchall():
            leg_products[str(r["ID_PRODUTO"])] = r

    async with async_session_factory() as db:
        cid = UUID("00000000-0000-0000-0000-000000000010")

        # 2. Obtener grupos con códigos duplicados o variantes de cero inicial
        q = text("""
            WITH norm AS (
                SELECT id, sku, codigo_barra, nombre, precio_venta, activo,
                       ltrim(codigo_barra, '0') as cb_norm
                FROM products
                WHERE codigo_barra IS NOT NULL AND codigo_barra != '' AND activo = true
            )
            SELECT n1.cb_norm, array_agg(n1.id) as ids, array_agg(n1.sku) as skus,
                   array_agg(n1.codigo_barra) as cbs, array_agg(n1.nombre) as noms,
                   array_agg(n1.precio_venta) as precos
            FROM norm n1
            WHERE n1.cb_norm != ''
            GROUP BY n1.cb_norm
            HAVING count(DISTINCT n1.id) > 1
        """)
        res = await db.execute(q)
        groups = res.fetchall()
        print(f"Total grupos de duplicados encontrados: {len(groups)}\n")

        unified_count = 0
        ghost_count = 0

        for g in groups:
            cb_norm, ids, skus, cbs, noms, precos = g
            candidates = []
            for p_id, sku, cb, nom, pr in zip(ids, skus, cbs, noms, precos):
                # Verificar ventas y stock en PostgreSQL
                sq = await db.execute(text("SELECT coalesce(sum(cantidad), 0) FROM stock WHERE product_id = :pid"), {"pid": p_id})
                stk = sq.scalar() or 0
                slq = await db.execute(text("SELECT count(*) FROM sale_items WHERE product_id = :pid"), {"pid": p_id})
                sales_cnt = slq.scalar() or 0

                leg = leg_products.get(sku, {})
                leg_activo = leg.get("BO_ATIVO", 0)
                leg_stk = leg.get("estoque_leg", 0)
                leg_pr = leg.get("VL_PRECO_VENDA_VAREJO", 0)

                candidates.append({
                    "id": p_id,
                    "sku": sku,
                    "cb": cb,
                    "nombre": nom,
                    "precio": float(pr or 0),
                    "stk_pg": stk,
                    "sales_pg": sales_cnt,
                    "leg_activo": leg_activo,
                    "leg_stk": leg_stk,
                    "leg_pr": float(leg_pr or 0)
                })

            # Clasificar candidatos: el canónico es el que tiene más ventas, más stock, está activo y no es fantasma
            candidates.sort(key=lambda c: (
                c["sales_pg"] > 0,
                c["sales_pg"],
                c["stk_pg"] > 0,
                c["stk_pg"],
                c["leg_activo"] == 1,
                c["precio"] > 0,
                not c["nombre"].startswith("Producto legacy")
            ), reverse=True)

            canonical = candidates[0]
            duplicates = candidates[1:]

            # Si son productos de balanza (2000xxx) totalmente diferentes (ej: Manzana Pink vs Carbón Ramonita), no unificar
            if cb_norm.startswith("2000") and len(canonical["nombre"]) > 4:
                # Comprobar si los nombres difieren por completo
                is_diff_dept = any(
                    abs(len(canonical["nombre"]) - len(d["nombre"])) > 5 and
                    not any(w in d["nombre"].lower() for w in canonical["nombre"].lower().split() if len(w) > 3)
                    for d in duplicates
                )
                if is_diff_dept:
                    print(f"[SKIP BALANZA CONFLICT] Barcode {cb_norm}: {canonical['nombre']} vs {[d['nombre'] for d in duplicates]}")
                    continue

            print(f"=== Barcode Norm: {cb_norm} ===")
            print(f"  [CANONICAL]: SKU {canonical['sku']} | CB {canonical['cb']} | {canonical['nombre']} | Precio: {canonical['precio']} | Ventas: {canonical['sales_pg']} | Stock: {canonical['stk_pg']}")
            
            for d in duplicates:
                print(f"  [DUPLICADO]: SKU {d['sku']} | CB {d['cb']} | {d['nombre']} | Precio: {d['precio']} | Ventas: {d['sales_pg']} | Stock: {d['stk_pg']}")
                is_ghost = d["nombre"].startswith("Producto legacy") or d["precio"] == 0
                if is_ghost:
                    ghost_count += 1
                unified_count += 1

                if not dry_run:
                    # 1. Desactivar duplicado en products y desvincular código de barra principal para evitar colisiones
                    await db.execute(text("""
                        UPDATE products
                        SET activo = false,
                            codigo_barra = 'DUP_' || sku || '_' || coalesce(codigo_barra, ''),
                            updated_at = now()
                        WHERE id = :dup_id
                    """), {"dup_id": d["id"]})

                    # 2. Migrar stock residual si el duplicado tenía stock
                    if d["stk_pg"] > 0:
                        await db.execute(text("""
                            UPDATE stock
                            SET product_id = :can_id
                            WHERE product_id = :dup_id
                        """), {"can_id": canonical["id"], "dup_id": d["id"]})

                    # 3. Registrar el código alternativo en product_pack_barcodes si no coincide con el canónico
                    alt_code = d["cb"].strip()
                    can_code = canonical["cb"].strip() if canonical["cb"] else ""
                    if alt_code and alt_code != can_code:
                        # Comprobar si ya existe
                        ex = await db.execute(text("""
                            SELECT id FROM product_pack_barcodes
                            WHERE company_id = :cid AND codigo_barra = :cb
                        """), {"cid": cid, "cb": alt_code})
                        if not ex.scalar_one_or_none():
                            await db.execute(text("""
                                INSERT INTO product_pack_barcodes (
                                    id, product_id, company_id, codigo_barra, etiqueta,
                                    unidades_por_paquete, activo, created_at, updated_at
                                ) VALUES (
                                    gen_random_uuid(), :pid, :cid, :cb, 'Código alternativo EAN/UPC',
                                    1.000, true, now(), now()
                                )
                            """), {"pid": canonical["id"], "cid": cid, "cb": alt_code})

                    # 4. Asegurar que la variante sin cero inicial o con cero inicial también esté como pack barcode si aplica
                    alt_cb_norm = cb_norm.strip()
                    if alt_cb_norm and alt_cb_norm != can_code and alt_cb_norm != alt_code:
                        ex2 = await db.execute(text("""
                            SELECT id FROM product_pack_barcodes
                            WHERE company_id = :cid AND codigo_barra = :cb
                        """), {"cid": cid, "cb": alt_cb_norm})
                        if not ex2.scalar_one_or_none():
                            await db.execute(text("""
                                INSERT INTO product_pack_barcodes (
                                    id, product_id, company_id, codigo_barra, etiqueta,
                                    unidades_por_paquete, activo, created_at, updated_at
                                ) VALUES (
                                    gen_random_uuid(), :pid, :cid, :cb, 'Código alternativo normalizado',
                                    1.000, true, now(), now()
                                )
                            """), {"pid": canonical["id"], "cid": cid, "cb": alt_cb_norm})

            print()

        if not dry_run:
            await db.commit()
            print(f"EJECUCIÓN COMPLETADA:")
            print(f"  - Productos duplicados/fantasma resueltos: {unified_count}")
            print(f"  - De los cuales eran fantasmas a Gs 0: {ghost_count}")
        else:
            print(f"DRY RUN FINALIZADO: Se unificarían {unified_count} duplicados ({ghost_count} fantasmas).")

if __name__ == "__main__":
    import sys
    dry = "--execute" not in sys.argv
    asyncio.run(run(dry_run=dry))
