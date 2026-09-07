import pymysql
import asyncio
from api.src.config import settings
from api.src.db import async_session_factory
from sqlalchemy import text

# 1. Contar en MySQL est_produto con precio mayorista
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
        SELECT COUNT(*) as total_atacado
        FROM est_produto 
        WHERE VL_PRECO_VENDA_ATACADO > 0 AND QTD_PARA_PRECO_ATACADO > 0;
    """)
    total_mysql_atacado = cur.fetchone()['total_atacado']
    print(f"=== MYSQL: Productos con precio atacado en est_produto: {total_mysql_atacado} ===")

    # Tabla ven_preco_quantidade_produto
    cur.execute("SELECT COUNT(*) as total_escalas FROM ven_preco_quantidade_produto;")
    total_mysql_escalas = cur.fetchone()['total_escalas']
    print(f"=== MYSQL: Registros en ven_preco_quantidade_produto: {total_mysql_escalas} ===")

    # Ver 10 ejemplos de est_produto
    cur.execute("""
        SELECT ID_PRODUTO, DS_PRODUTO, CD_BARRAS_ORIGINAL, VL_PRECO_VENDA_VAREJO, VL_PRECO_VENDA_ATACADO, QTD_PARA_PRECO_ATACADO
        FROM est_produto 
        WHERE VL_PRECO_VENDA_ATACADO > 0 AND QTD_PARA_PRECO_ATACADO > 0
        LIMIT 10;

    """)
    ejemplos_mysql = cur.fetchall()
    print("\n=== EJEMPLOS EN MYSQL ===")
    for e in ejemplos_mysql:
        print(f"ID: {e['ID_PRODUTO']} | Barra: {e['CD_BARRAS_ORIGINAL']} | {e['DS_PRODUTO']} | Varejo: {e['VL_PRECO_VENDA_VAREJO']} | Atacado: {e['VL_PRECO_VENDA_ATACADO']} (Min: {e['QTD_PARA_PRECO_ATACADO']})")

conn.close()

# 2. Consultar en Postgres si esos códigos de barra tienen su escala en sp_tiered_prices
async def verify_postgres_samples():
    barcodes = [e['CD_BARRAS_ORIGINAL'] for e in ejemplos_mysql if e['CD_BARRAS_ORIGINAL']]
    async with async_session_factory() as db:
        res = await db.execute(text("""
            SELECT p.codigo_barra, p.nombre, p.precio_base, tp.min_qty, tp.precio_unitario, tp.activo
            FROM products p
            LEFT JOIN sp_tiered_prices tp ON p.id = tp.product_id AND tp.activo = true
            WHERE p.codigo_barra = ANY(:bcs)
        """), {"bcs": barcodes})
        print("\n=== ESTADO DE ESOS MISMOS PRODUCTOS EN POSTGRES ===")
        for r in res.fetchall():
            print(f"Barra: {r[0]} | {r[1]} | PrecioBase: {r[2]} | MinEscala: {r[3]} | PrecioEscala: {r[4]} | Activo: {r[5]}")

asyncio.run(verify_postgres_samples())
