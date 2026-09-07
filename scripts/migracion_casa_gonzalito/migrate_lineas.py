"""Modulo de Metas de Venta: migra lineas de producto reales del legacy.

lineas (982 filas) -> product_lines. productos.ID_LINEA -> products.linea_id.
Confirmado: lineas.NOMBRE coincide exacto con objetivos.LINEA (BENEDICTINO,
MONSTER, ADES, DEL VALLE, POWERADE, CRUSH, etc), asi que esta es la clave
real de "linea de producto" a usar en todo el modulo de metas."""
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


with my.cursor() as cur:
    cur.execute("SELECT IDLINEAS, NOMBRE, INACTIVO FROM lineas")
    lineas_rows = cur.fetchall()

lineas_ins = []
for idl, nombre, inactivo in lineas_rows:
    nom = txt_keep(nombre, 150)
    if not nom:
        continue
    lid = uuid.uuid5(NS, f"linea:{idl}")
    lineas_ins.append((str(lid), COMPANY_ID, str(idl), nom, not bool(inactivo)))

print(f"Lineas a migrar: {len(lineas_ins)}")

with pg.cursor() as cur:
    cur.executemany(
        """INSERT INTO product_lines (id, company_id, codigo_legacy, nombre, activo)
           VALUES (%s, %s, %s, %s, %s)
           ON CONFLICT (id) DO UPDATE SET nombre = EXCLUDED.nombre, activo = EXCLUDED.activo""",
        lineas_ins,
    )
    print(f"product_lines upserted: {cur.rowcount}")
pg.commit()

valid_linea_ids = {idl for (idl, _n, _i) in lineas_rows}

with my.cursor() as cur:
    cur.execute("SELECT CODIGO, ID_LINEA FROM productos WHERE ID_LINEA IS NOT NULL AND ID_LINEA <> 0")
    prod_rows = cur.fetchall()

updates, saltados = [], 0
for codigo, id_linea in prod_rows:
    cod = txt_keep(codigo, 50)
    if not cod or id_linea not in valid_linea_ids:
        saltados += 1
        continue
    pid = uuid.uuid5(NS, f"prod:{cod}")
    lid = uuid.uuid5(NS, f"linea:{id_linea}")
    updates.append((str(lid), str(pid)))

print(f"Productos con linea a actualizar: {len(updates)} ({saltados} saltados: linea huerfana o sin codigo)")

with pg.cursor() as cur:
    cur.executemany(
        "UPDATE products SET linea_id = %s WHERE id = %s AND company_id = %s",
        [(lid, pid, COMPANY_ID) for (lid, pid) in updates],
    )
    print(f"products actualizados: {cur.rowcount}")
pg.commit()

with pg.cursor() as cur:
    cur.execute("SELECT count(*) FROM product_lines WHERE company_id = %s", (COMPANY_ID,))
    print("product_lines totales:", cur.fetchone())
    cur.execute("SELECT count(*) FROM products WHERE company_id = %s AND linea_id IS NOT NULL", (COMPANY_ID,))
    print("products con linea_id:", cur.fetchone())

pg.close()
my.close()
