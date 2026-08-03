"""Modulo de Metas de Venta: migra objetivos legacy (30.776 filas, 2009->hoy)
como referencia read-only para calibrar el forecast estadistico — NO se usan
como metas reales (son a nivel empresa, sin desglose por vendedor)."""
import sys
import uuid
sys.path.insert(0, ".")
import pymysql
import psycopg

COMPANY_ID = "00000000-0000-0000-0000-000000000010"

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
    cur.execute("SELECT ID, LINEA, TIPO, CANTIDAD, CICLO FROM objetivos")
    rows = cur.fetchall()

ins = []
for idobj, linea, tipo, cantidad, ciclo in rows:
    cic = txt_keep(ciclo, 6)
    if not cic:
        continue
    ins.append((COMPANY_ID, idobj, txt_keep(linea, 150), txt_keep(tipo, 20), float(cantidad or 0), cic))

print(f"objetivos a migrar: {len(ins)}")

with pg.cursor() as cur:
    cur.executemany(
        """INSERT INTO legacy_objetivos_reference
           (company_id, codigo_legacy, linea_nombre, tipo, cantidad, ciclo)
           VALUES (%s, %s, %s, %s, %s, %s)
           ON CONFLICT (company_id, codigo_legacy) DO UPDATE SET
             linea_nombre = EXCLUDED.linea_nombre, tipo = EXCLUDED.tipo,
             cantidad = EXCLUDED.cantidad, ciclo = EXCLUDED.ciclo""",
        ins,
    )
    print(f"legacy_objetivos_reference upserted: {cur.rowcount}")
pg.commit()

with pg.cursor() as cur:
    cur.execute("SELECT count(*), min(ciclo), max(ciclo) FROM legacy_objetivos_reference WHERE company_id = %s", (COMPANY_ID,))
    print(cur.fetchone())

pg.close()
my.close()
