"""Backfill unico: sales.fecha siempre quedo con hora 00:00:00 — la migracion
(etl.py y sync_incremental.py) solo trajo FECHA de fac_ventas, descartando
la columna HORA (datetime real con la hora exacta de cada venta, poblada
en el 100% de las filas del legacy). Esto rompe cualquier reporte por hora
del dia (ej. "Ventas por Hora" en el dashboard Gerencial, que mostraba
el 100% concentrado en la hora 0). Trae HORA real y reemplaza el
componente de hora en sales.fecha, sin tocar la fecha (dia) ya migrada."""
import sys
import uuid
sys.path.insert(0, ".")
import pymysql
import psycopg

NS = uuid.UUID("c0a5a600-0000-4000-8000-000000000001")

my = pymysql.connect(host="192.168.1.103", user="im_sync_ro", password="SyncGonzalito2026ro",
                      database="columbia", charset="latin1")
pg = psycopg.connect("postgresql://intelimarket:intelimarket_dev@localhost:5432/intelimarket")

BATCH = 20000

with my.cursor() as cur:
    cur.execute(
        "SELECT IDFACVENTAS, HORA FROM fac_ventas "
        "WHERE HORA IS NOT NULL AND HORA != '0000-00-00 00:00:00'"
    )
    rows = cur.fetchall()

print(f"Filas con HORA real en legacy: {len(rows)}")

updates = [(hora, str(uuid.uuid5(NS, f"fac:{idfac}"))) for (idfac, hora) in rows]

total_updated = 0
with pg.cursor() as cur:
    for i in range(0, len(updates), BATCH):
        batch = updates[i:i + BATCH]
        cur.executemany(
            "UPDATE sales SET fecha = %s WHERE id = %s AND company_id = '00000000-0000-0000-0000-000000000010'",
            batch,
        )
        total_updated += cur.rowcount
        pg.commit()
        print(f"  {i + len(batch)}/{len(updates)} procesadas, {total_updated} actualizadas hasta ahora")

with pg.cursor() as cur:
    cur.execute(
        "SELECT count(*), count(*) FILTER (WHERE EXTRACT(HOUR FROM fecha) > 0 OR EXTRACT(MINUTE FROM fecha) > 0) "
        "FROM sales WHERE company_id = '00000000-0000-0000-0000-000000000010'"
    )
    print("total ventas, con hora real:", cur.fetchone())

pg.close()
my.close()
