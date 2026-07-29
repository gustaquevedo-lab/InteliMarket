"""Backfill unico: products.costo_promedio nunca se escribio (bug en etl.py
y sync_incremental.py — el valor se leia de la legacy pero se descartaba
antes de llegar al INSERT/UPSERT). Trae PRECIOCOSTO real desde productos
del legacy y lo carga en los 11.358 productos ya migrados."""
import sys
import uuid
sys.path.insert(0, ".")
import pymysql
import psycopg

NS = uuid.UUID("c0a5a600-0000-4000-8000-000000000001")

my = pymysql.connect(host="192.168.1.103", user="im_sync_ro", password="SyncGonzalito2026ro",
                      database="columbia", charset="latin1")
pg = psycopg.connect("postgresql://intelimarket:intelimarket_dev@localhost:5432/intelimarket")


def txt_keep(v, maxlen=None):
    if v is None:
        return None
    s = str(v).strip()
    if not s:
        return None
    return s[:maxlen] if maxlen else s


with my.cursor() as cur:
    cur.execute("SELECT CODIGO, PRECIOCOSTO FROM productos WHERE PRECIOCOSTO IS NOT NULL AND PRECIOCOSTO > 0")
    rows = cur.fetchall()

updates = []
for codigo, costo in rows:
    cod = txt_keep(codigo, 50)
    if not cod:
        continue
    pid = uuid.uuid5(NS, f"prod:{cod}")
    updates.append((float(costo), str(pid)))

print(f"Filas con PRECIOCOSTO real en legacy: {len(updates)}")

with pg.cursor() as cur:
    cur.executemany(
        "UPDATE products SET costo_promedio = %s, ultimo_costo = %s WHERE id = %s AND company_id = '00000000-0000-0000-0000-000000000010'",
        [(v, v, pid) for (v, pid) in updates],
    )
    print(f"Filas actualizadas en Postgres: {cur.rowcount}")
pg.commit()

with pg.cursor() as cur:
    cur.execute("SELECT count(*), count(*) FILTER (WHERE costo_promedio > 0) FROM products WHERE company_id = '00000000-0000-0000-0000-000000000010'")
    print("total productos, con costo_promedio>0:", cur.fetchone())

pg.close()
my.close()
