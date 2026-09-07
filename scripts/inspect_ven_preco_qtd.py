import pymysql
from api.src.config import settings

conn = pymysql.connect(
    host=settings.nemuha_mysql_host or '127.0.0.1',
    port=settings.nemuha_mysql_port or 3306,
    user=settings.nemuha_mysql_user or 'root',
    password=settings.nemuha_mysql_password or '',
    database=settings.nemuha_mysql_database or 'comercial_extra_py',
    cursorclass=pymysql.cursors.DictCursor
)

with conn.cursor() as cur:
    cur.execute("DESCRIBE ven_preco_quantidade_produto;")
    cols = cur.fetchall()
    print("=== COLUMNAS DE ven_preco_quantidade_produto ===")
    for c in cols:
        print(f"{c['Field']} ({c['Type']})")

    cur.execute("""
        SELECT vp.*, ep.DS_PRODUTO, ep.CD_PRODUTO
        FROM ven_preco_quantidade_produto vp
        JOIN est_produto ep ON vp.ID_PRODUTO = ep.ID_PRODUTO
        LIMIT 10;
    """)
    samples = cur.fetchall()
    print("\n=== MUESTRA DE ven_preco_quantidade_produto ===")
    for s in samples:
        print(s)

conn.close()
