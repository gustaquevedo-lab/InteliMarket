import asyncio
import pymysql
import uuid
from decimal import Decimal
from api.src.config import settings
from api.src.db import async_session_factory
from sqlalchemy import text

COMPANY_ID = "00000000-0000-0000-0000-000000000010"

async def sync_all_tiered_prices():
    print("=== 1. LEYENDO ESCALAS DESDE MYSQL ===")
    conn = pymysql.connect(
        host=settings.nemuha_mysql_host or '127.0.0.1',
        port=settings.nemuha_mysql_port or 3306,
        user=settings.nemuha_mysql_user or 'root',
        password=settings.nemuha_mysql_password or '',
        database=settings.nemuha_mysql_database or 'comercial_extra_py',
        cursorclass=pymysql.cursors.DictCursor
    )

    with conn.cursor() as cur:
        cur.execute("""
            SELECT ID_PRODUTO, QTD_PRODUTO, VL_PRECO_VENDA_VAREJO, VL_PRECO_VENDA_ATACADO
            FROM ven_preco_quantidade_produto
            WHERE QTD_PRODUTO >= 2;
        """)
        escalas_mysql = cur.fetchall()
        print(f"Total escalas leídas de MySQL: {len(escalas_mysql)}")
    conn.close()

    # 2. Mapear SKU -> Product ID en Postgres
    async with async_session_factory() as db:
        res_prods = await db.execute(text("SELECT id, sku, precio_venta FROM products WHERE sku IS NOT NULL;"))
        sku_to_prod = {}
        for r in res_prods.fetchall():
            sku_to_prod[str(r[1]).strip()] = (r[0], r[2])

        print(f"Total productos mapeados en Postgres: {len(sku_to_prod)}")

        inserted = 0
        updated = 0
        cid = uuid.UUID(COMPANY_ID)

        # Cargar todas las escalas existentes en Postgres en memoria para velocidad y deduplicación
        res_existing = await db.execute(text("""
            SELECT id, product_id, min_qty, precio_unitario 
            FROM sp_tiered_prices 
            WHERE company_id = :cid AND price_list_id IS NULL;
        """), {"cid": cid})
        
        # Mapear (product_id, min_qty) -> list[id]
        existing_map = {}
        for r in res_existing.fetchall():
            key = (r[1], int(r[2]))
            existing_map.setdefault(key, []).append(r[0])

        for esc in escalas_mysql:
            sku_str = str(esc['ID_PRODUTO']).strip()
            if sku_str not in sku_to_prod:
                continue

            pid, precio_base = sku_to_prod[sku_str]
            min_qty = int(esc['QTD_PRODUTO'])
            
            precio_escala = Decimal(str(esc['VL_PRECO_VENDA_VAREJO']))
            if precio_escala <= 0:
                precio_escala = Decimal(str(esc['VL_PRECO_VENDA_ATACADO']))

            if precio_escala <= 0 or precio_escala >= (precio_base or Decimal("99999999")):
                continue

            key = (pid, min_qty)
            if key in existing_map:
                # Actualizar el primer ID y borrar duplicados extras si los hay
                first_id = existing_map[key][0]
                await db.execute(
                    text("UPDATE sp_tiered_prices SET precio_unitario = :p, activo = true, updated_at = NOW() WHERE id = :id;"),
                    {"p": precio_escala, "id": first_id}
                )
                if len(existing_map[key]) > 1:
                    for extra_id in existing_map[key][1:]:
                        await db.execute(text("DELETE FROM sp_tiered_prices WHERE id = :id;"), {"id": extra_id})
                updated += 1
            else:
                new_id = uuid.uuid4()
                await db.execute(
                    text("""
                        INSERT INTO sp_tiered_prices (id, company_id, product_id, min_qty, precio_unitario, activo, created_at, updated_at)
                        VALUES (:id, :cid, :pid, :mq, :p, true, NOW(), NOW());
                    """),
                    {"id": new_id, "cid": cid, "pid": pid, "mq": min_qty, "p": precio_escala}
                )
                existing_map[key] = [new_id]
                inserted += 1

        await db.commit()
        print(f"=== SINCRONIZACION EXITOSA: {inserted} nuevas insertadas, {updated} actualizadas/deduplicadas ===")

        # Verificar el producto Coca Cola 250ml
        res_coca = await db.execute(text("""
            SELECT p.codigo_barra, p.nombre, p.precio_venta, tp.min_qty, tp.precio_unitario, tp.activo
            FROM products p
            JOIN sp_tiered_prices tp ON p.id = tp.product_id
            WHERE p.codigo_barra = '7840058001887'
            ORDER BY tp.min_qty ASC;
        """))
        print("\n=== ESCALAS EN VIVO PARA 7840058001887 ===")
        for r in res_coca.fetchall():
            print(f"Barra: {r[0]} | {r[1]} | PrecioBase: {r[2]} | MinQty: {r[3]} | PrecioEscala: {r[4]} | Activo: {r[5]}")

asyncio.run(sync_all_tiered_prices())
