"""Modulo de Metas de Venta: importa el roster real de vendedores + gerente
comercial desde funcionarios (legacy), clasificados por cargo real:
- 'Vendedor - PARESA' -> rama paresa
- 'Vendedor - Malta' / 'Vendedor - TREBOL L. RAATZ y otros' / 'VENDEDORES SANTA ROSA' -> rama mix
- 'Gerente de Ventas' -> rol gerente_comercial (Gabriel Ramirez, unico)
Sin supervisor asignado todavia — se arma en vivo desde el modulo."""
import sys
import uuid
sys.path.insert(0, ".")
import pymysql
import psycopg

NS = uuid.UUID("c0a5a600-0000-4000-8000-000000000001")
COMPANY_ID = "00000000-0000-0000-0000-000000000010"

MIX_CARGOS = ("Vendedor - Malta", "Vendedor - TREBOL L. RAATZ y otros", "VENDEDORES SANTA ROSA")
PARESA_CARGOS = ("Vendedor - PARESA",)
GERENTE_CARGOS = ("Gerente de Ventas",)

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


placeholders = ",".join(["%s"] * (len(MIX_CARGOS) + len(PARESA_CARGOS) + len(GERENTE_CARGOS)))
with my.cursor() as cur:
    cur.execute(f"""
        SELECT f.IDFUNCIONARIO, f.NOMBRE, f.APELLIDO, f.CI_NUMERO, c.CARGO
        FROM funcionarios f JOIN cargo_funcionarios c ON c.IDCARGO = f.IDCARGO
        WHERE c.CARGO IN ({placeholders}) AND f.ACTIVO = 1
    """, MIX_CARGOS + PARESA_CARGOS + GERENTE_CARGOS)
    rows = cur.fetchall()

ins = []
for idfunc, nombre, apellido, ci, cargo in rows:
    cod = txt_keep(idfunc, 10)
    if not cod:
        continue
    nombre_completo = f"{txt_keep(nombre) or ''} {txt_keep(apellido) or ''}".strip()
    if cargo in GERENTE_CARGOS:
        rama, rol = None, "gerente_comercial"
    elif cargo in PARESA_CARGOS:
        rama, rol = "paresa", "vendedor"
    else:
        rama, rol = "mix", "vendedor"
    rid = uuid.uuid5(NS, f"salesrep:{cod}")
    ins.append((str(rid), COMPANY_ID, cod, nombre_completo, txt_keep(ci, 20), rama, rol))

print(f"sales_reps a importar: {len(ins)}")
print("  paresa:", sum(1 for r in ins if r[5] == "paresa"))
print("  mix:", sum(1 for r in ins if r[5] == "mix"))
print("  gerente_comercial:", sum(1 for r in ins if r[6] == "gerente_comercial"))

with pg.cursor() as cur:
    cur.executemany(
        """INSERT INTO sales_reps (id, company_id, funcionario_codigo, nombre, cedula, rama, rol, activo)
           VALUES (%s, %s, %s, %s, %s, %s, %s, true)
           ON CONFLICT (id) DO UPDATE SET nombre = EXCLUDED.nombre, cedula = EXCLUDED.cedula,
             rama = EXCLUDED.rama, rol = EXCLUDED.rol, activo = true, updated_at = now()""",
        ins,
    )
    print(f"sales_reps upserted: {cur.rowcount}")
pg.commit()

with pg.cursor() as cur:
    cur.execute("SELECT rol, rama, count(*) FROM sales_reps WHERE company_id = %s GROUP BY rol, rama ORDER BY 1,2", (COMPANY_ID,))
    for r in cur.fetchall():
        print(r)
    cur.execute("SELECT count(*) FROM sales_reps WHERE company_id = %s AND cedula IS NULL", (COMPANY_ID,))
    print("sin cedula (no se podra crear login):", cur.fetchone())

pg.close()
my.close()
