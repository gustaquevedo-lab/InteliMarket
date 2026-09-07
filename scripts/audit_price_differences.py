import asyncio
import pymysql
from api.src.config import settings
from api.src.db import async_session_factory
from sqlalchemy import text

async def audit_all_price_differences():
    print("=== AUDITORIA COMPLETA DE PRECIOS: MYSQL vs POSTGRESQL ===")
    
    # 1. Conectar a MySQL y leer todos los precios activos
    conn = pymysql.connect(
        host=settings.nemuha_mysql_host or '127.0.0.1',
        port=settings.nemuha_mysql_port or 3306,
        user=settings.nemuha_mysql_user or 'root',
        password=settings.nemuha_mysql_password or '',
        database=settings.nemuha_mysql_database or 'comercial_extra_py',
        cursorclass=pymysql.cursors.DictCursor
    )
    
    mysql_prods = {}
    with conn.cursor() as cur:
        cur.execute("""
            SELECT ID_PRODUTO, DS_PRODUTO, VL_PRECO_VENDA_VAREJO, VL_PRECO_VENDA_ATACADO, BO_ATIVO, DT_MODIFICACAO
            FROM est_produto;
        """)
        for r in cur.fetchall():
            mysql_prods[str(r['ID_PRODUTO']).strip()] = r
            
    conn.close()
    print(f"Total productos leídos de MySQL: {len(mysql_prods)}")

    # 2. Leer productos de PostgreSQL
    async with async_session_factory() as db:
        res = await db.execute(text("""
            SELECT id, sku, codigo_barra, nombre, precio_venta, activo, updated_at
            FROM products;
        """))
        pg_prods = res.mappings().fetchall()
        print(f"Total productos leídos de PostgreSQL: {len(pg_prods)}")

    # 3. Comparar precios
    diffs = []
    matches = 0
    not_in_mysql = 0
    pg_zero_price = 0

    for pg in pg_prods:
        sku = str(pg['sku']).strip() if pg['sku'] else None
        if not sku or sku not in mysql_prods:
            not_in_mysql += 1
            continue
            
        my = mysql_prods[sku]
        my_p_varejo = float(my['VL_PRECO_VENDA_VAREJO'] or 0)
        pg_p_venta = float(pg['precio_venta'] or 0)
        
        if pg_p_venta == 0 and my_p_varejo > 0:
            pg_zero_price += 1

        if abs(pg_p_venta - my_p_varejo) > 0.01:
            diffs.append({
                'sku': sku,
                'barcode': pg['codigo_barra'],
                'nombre_pg': pg['nombre'],
                'nombre_my': my['DS_PRODUTO'],
                'pg_precio': pg_p_venta,
                'my_precio': my_p_varejo,
                'diff': pg_p_venta - my_p_varejo,
                'my_dt_mod': str(my['DT_MODIFICACAO']),
                'pg_updated_at': str(pg['updated_at']),
                'activo_pg': pg['activo'],
                'activo_my': my['BO_ATIVO']
            })
        else:
            matches += 1

    print(f"\nResultados de comparación:")
    print(f" - Precios idénticos: {matches}")
    print(f" - Productos con precio diferente: {len(diffs)}")
    print(f" - Productos en PG con precio = 0 (pero > 0 en MySQL): {pg_zero_price}")
    print(f" - Productos sin SKU o no encontrados en MySQL: {not_in_mysql}")

    # Mostrar top 20 diferencias
    print("\n--- MUESTRA DE 25 PRODUCTOS CON PRECIOS DIFERENTES ---")
    for d in diffs[:25]:
        print(f"SKU {d['sku']:<8} | Barcode: {str(d['barcode']):<14} | PG: {d['pg_precio']:>9.0f} Gs | Legacy: {d['my_precio']:>9.0f} Gs | Dif: {d['diff']:>+9.0f} Gs | Modif Legacy: {d['my_dt_mod']} | {d['nombre_pg'][:35]}")

    # Agrupar por fecha de modificación en Legacy
    mod_recent = sum(1 for d in diffs if d['my_dt_mod'] and d['my_dt_mod'] >= '2026-07-25')
    print(f"\nDe los {len(diffs)} productos con diferencia:")
    print(f" - Modificados en Legacy después del 25-Jul-2026 (post importación inicial): {mod_recent}")

if __name__ == '__main__':
    asyncio.run(audit_all_price_differences())
