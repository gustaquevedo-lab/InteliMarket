import asyncio
import asyncpg
import pymysql

async def check():
    conn = await asyncpg.connect('postgresql://intelimarket:intelimarket_dev@localhost:5432/intelimarket')
    
    total_sales = await conn.fetchval('SELECT count(*) FROM sales;')
    sales_with_cdc = await conn.fetchval('SELECT count(*) FROM sales WHERE cdc IS NOT NULL;')
    sales_with_factura = await conn.fetchval('SELECT count(*) FROM sales WHERE factura_numero IS NOT NULL;')
    sales_sifen_aprobado = await conn.fetchval("SELECT count(*) FROM sales WHERE sifen_estado = 'aprobado';")
    
    total_nc = await conn.fetchval('SELECT count(*) FROM credit_notes;')
    nc_with_cdc = await conn.fetchval('SELECT count(*) FROM credit_notes WHERE cdc IS NOT NULL;')
    nc_sifen_aprobado = await conn.fetchval("SELECT count(*) FROM credit_notes WHERE sifen_estado = 'aprobado';")
    
    timbrados = await conn.fetch('SELECT * FROM sifen_timbrados;')
    
    latest_inv = await conn.fetchrow('SELECT numero, factura_numero, cdc, fecha, total, sifen_estado FROM sales WHERE cdc IS NOT NULL ORDER BY fecha DESC LIMIT 1;')
    dates_inv = await conn.fetchrow('SELECT min(fecha) as min_f, max(fecha) as max_f FROM sales WHERE cdc IS NOT NULL;')
    dates_nc = await conn.fetchrow('SELECT min(fecha) as min_f, max(fecha) as max_f FROM credit_notes WHERE cdc IS NOT NULL;')
    
    # Check MySQL connection & last records in MySQL
    try:
        my_conn = pymysql.connect(host='127.0.0.1', user='etl', password='etl', database='columbia')
        with my_conn.cursor() as cur:
            cur.execute('SELECT count(*) as cnt, max(FECHA) as max_f FROM fac_ventas;')
            my_sales = cur.fetchone()
            cur.execute("SELECT count(*) as cnt, max(FECHAFIRMA) as max_fe FROM feenvios WHERE CDC IS NOT NULL AND CDC != '0';")
            my_fe = cur.fetchone()
            cur.execute('SELECT count(*) as cnt, max(FECHA) as max_f FROM notacredito;')
            my_nc = cur.fetchone()
        my_conn.close()
        mysql_status = f"Conectado a MySQL (columbia).\n   -> Ventas en Legacy: {my_sales[0]:,} (Última fecha: {my_sales[1]})\n   -> Documentos FE en Legacy: {my_fe[0]:,} (Última firma: {my_fe[1]})\n   -> Notas de Crédito en Legacy: {my_nc[0]:,} (Última fecha: {my_nc[1]})"
    except Exception as me:
        mysql_status = f"MySQL Error/Offline: {me}"

    print("=== RESUMEN SIFEN POSTGRESQL (minisforum-ia) ===")
    print(f"Total Ventas en PostgreSQL: {total_sales:,}")
    print(f"Facturas Electrónicas con CDC: {sales_with_cdc:,}")
    print(f"Facturas con Número Legal: {sales_with_factura:,}")
    print(f"Facturas SIFEN Aprobadas: {sales_sifen_aprobado:,}")
    if dates_inv:
        print(f"Rango Fechas Facturas SIFEN: {dates_inv['min_f']} -> {dates_inv['max_f']}")
    print("--------------------------------")
    print(f"Total Notas de Crédito en PostgreSQL: {total_nc:,}")
    print(f"Notas de Crédito con CDC: {nc_with_cdc:,}")
    print(f"NC SIFEN Aprobadas: {nc_sifen_aprobado:,}")
    if dates_nc:
        print(f"Rango Fechas NC SIFEN: {dates_nc['min_f']} -> {dates_nc['max_f']}")
    print("--------------------------------")
    print(f"Timbrados SIFEN registrados: {len(timbrados)}")
    for t in timbrados:
        print(f"  - Timbrado: {t['numero']}, Tipo: {t['tipo_comprobante']}, Rango: {t['rango_desde']}..{t['rango_hasta']}, Activo: {t['activo']}, Vigencia: {t['fecha_inicio']} -> {t['fecha_fin']}")
    if latest_inv:
        print("--------------------------------")
        print(f"Muestra Última Factura SIFEN: {latest_inv['factura_numero']} | CDC: {latest_inv['cdc']} | Total: Gs. {latest_inv['total']:,} | Fecha: {latest_inv['fecha']}")
    print("================================")
    print("Estado MySQL Legacy (FoxPro / Columbia):")
    print("   " + mysql_status)
    
    await conn.close()

if __name__ == '__main__':
    asyncio.run(check())
