"""Backfill: sales.vendedor_codigo nunca se migro (sync_ventas() no lo
tenia en su SELECT/INSERT). Sin esto no se puede calcular venta real por
vendedor para el modulo de metas — trae fac_ventas.IDVENDEDOR completo
(1.963.175 de 1.963.187 facturas, 2012->hoy) y lo carga en Postgres."""
import sys
import uuid
sys.path.insert(0, ".")
import pymysql
import psycopg

NS = uuid.UUID("c0a5a600-0000-4000-8000-000000000001")
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


BATCH = 50000
offset = 0
total_updated = 0
while True:
    with my.cursor() as cur:
        cur.execute(
            "SELECT IDFACVENTAS, IDVENDEDOR FROM fac_ventas WHERE IDVENDEDOR IS NOT NULL AND IDVENDEDOR <> '' "
            "ORDER BY IDFACVENTAS LIMIT %s OFFSET %s", (BATCH, offset)
        )
        rows = cur.fetchall()
    if not rows:
        break

    updates = []
    for idfac, idvend in rows:
        vend = txt_keep(idvend, 10)
        if not vend:
            continue
        sid = str(uuid.uuid5(NS, f"fac:{idfac}"))
        updates.append((vend, sid))

    with pg.cursor() as cur:
        cur.executemany(
            "UPDATE sales SET vendedor_codigo = %s WHERE id = %s AND company_id = '00000000-0000-0000-0000-000000000010'",
            updates,
        )
    pg.commit()
    total_updated += len(updates)
    offset += BATCH
    print(f"  offset {offset}: {total_updated} acumulado")

print(f"TOTAL actualizado: {total_updated}")

with pg.cursor() as cur:
    cur.execute("SELECT count(*), count(*) FILTER (WHERE vendedor_codigo IS NOT NULL) FROM sales WHERE company_id = %s AND tipo_comprobante = 'factura'", (COMPANY_ID,))
    print("facturas totales, con vendedor_codigo:", cur.fetchone())

pg.close()
my.close()
