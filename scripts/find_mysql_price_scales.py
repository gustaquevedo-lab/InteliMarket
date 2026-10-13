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
    # Buscar tablas con columnas de precio o atacado
    cur.execute("""
        SELECT TABLE_NAME, COLUMN_NAME 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = 'comercial_extra_py' 
          AND (COLUMN_NAME LIKE '%ATACADO%' OR COLUMN_NAME LIKE '%ESCALA%' OR COLUMN_NAME LIKE '%QTD%' OR COLUMN_NAME LIKE '%PRECO%')
        ORDER BY TABLE_NAME;
    """)
    cols = cur.fetchall()
    print("=== TABLAS Y COLUMNAS DE PRECIO/ATACADO EN MYSQL ===")
    seen_tables = set()
    for c in cols:
        t = c['TABLE_NAME']
        if t not in seen_tables:
            seen_tables.add(t)
            print(f"Tabla: {t}")
        print(f"   -> {c['COLUMN_NAME']}")

conn.close()
