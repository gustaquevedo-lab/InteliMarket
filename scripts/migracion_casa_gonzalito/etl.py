#!/usr/bin/env python3
"""
ETL de migración — Casa Gonzalito (MySQL legacy "columbia") -> Intelimarket (PostgreSQL)
v2 — migración completa (cierre por integridad).

Lee la copia local de MySQL y carga masivamente a Postgres con COPY. Reconstruye
relaciones con UUIDs deterministas (uuid5) desde las llaves de negocio del legacy.

Orden de carga (respeta FKs de db/schema.sql):
  companies
  -> product_categories -> products -> product_prices -> customers -> suppliers
  -> warehouses -> stock -> customer_accounts
  -> sales (ventas) -> sale_items
  -> sales (notas de crédito, negativas) -> sale_items (nc)
  -> purchase_orders -> purchase_order_items
  -> [post] recálculo de IVA en cabeceras (ventas + compras)

Uso (en el Minisforum):
    uv run python etl.py --reset      # recrea el esquema y migra todo
"""

import os
import sys
import time
import uuid
from datetime import datetime, date
from decimal import Decimal, InvalidOperation

import pymysql
import pymysql.cursors
import psycopg


# ----------------------------------------------------------------------------
# Configuración
# ----------------------------------------------------------------------------
MYSQL = dict(
    host=os.getenv("MYSQL_HOST", "127.0.0.1"),
    port=int(os.getenv("MYSQL_PORT", "3306")),
    user=os.getenv("MYSQL_USER", "etl"),
    password=os.getenv("MYSQL_PASSWORD", "etl"),
    database=os.getenv("MYSQL_DB", "columbia"),
    charset="latin1",
)
PG_DSN = os.getenv(
    "PG_DSN", "postgresql://intelimarket:intelimarket_dev@localhost:5432/intelimarket")
SCHEMA_SQL = os.getenv("SCHEMA_SQL", os.path.expanduser("~/intelimarket/db/schema.sql"))

EMPRESA = dict(
    ruc=os.getenv("CG_RUC", "80012345-6"),
    razon_social="CASA GONZALITO S.R.L.",
    nombre_fantasia="Casa Gonzalito",
    regimen_tributario="general",
    iva_condition="gravado",
)

NS = uuid.UUID("c0a5a600-0000-4000-8000-000000000001")
# La app tiene el company_id hardcodeado en auth/middleware.py a este valor.
# Migramos Casa Gonzalito bajo ese id para que la UI muestre los datos sin tocar la app.
COMPANY_ID = uuid.UUID("00000000-0000-0000-0000-000000000010")
PLACEHOLDER_PROD_ID = uuid.uuid5(NS, "prod:__DESCONOCIDO__")
PLACEHOLDER_SUP_ID = uuid.uuid5(NS, "prov:__DESCONOCIDO__")
DEFAULT_WH_ID = uuid.uuid5(NS, "wh:default")

# Los 7 niveles de precio del legacy (PRECIO1..PRECIO7) + el sugerido.
# clientes.LISTA (1..7) indica qué nivel usa cada cliente.
PRICE_LEVELS = [("pl1", "Precio 1"), ("pl2", "Precio 2"), ("pl3", "Precio 3"),
                ("pl4", "Precio 4"), ("pl5", "Precio 5"), ("pl6", "Precio 6"),
                ("pl7", "Precio 7")]
PRICE_SUG = ("plsug", "Precio Sugerido")
ALL_LISTS = PRICE_LEVELS + [PRICE_SUG]


def plist_id(slug):
    return uuid.uuid5(NS, f"pl:{slug}")

BATCH_LOG = 500_000


# ----------------------------------------------------------------------------
# Helpers
# ----------------------------------------------------------------------------
def txt(v):
    if v is None:
        return None
    s = str(v).strip()
    return None if s in ("", "0") else s


def txt_keep(v, maxlen=None):
    if v is None:
        return None
    s = str(v).strip()
    if s == "":
        return None
    return s[:maxlen] if maxlen else s


def money(v):
    if v is None:
        return 0
    try:
        return int(round(float(v)))
    except (ValueError, TypeError, InvalidOperation):
        return 0


def num3(v):
    if v is None:
        return Decimal("0")
    try:
        return Decimal(str(v)).quantize(Decimal("0.001"))
    except (ValueError, TypeError, InvalidOperation):
        return Decimal("0")


def safe_dt(v):
    if v is None:
        return None
    if isinstance(v, datetime):
        return v
    if isinstance(v, date):
        return datetime(v.year, v.month, v.day)
    s = str(v).strip()
    if not s or s.startswith("0000"):
        return None
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d"):
        try:
            return datetime.strptime(s[:19] if " " in s else s, fmt)
        except ValueError:
            continue
    return None


def ruc_dv(ruc, dv):
    r = txt(ruc)
    if not r:
        return None
    d = txt(dv)
    return (f"{r}-{d}" if d else r)[:15]


def iva_tasa(grav10, grav5, exentas):
    if grav10 and float(grav10) > 0:
        return Decimal("10")
    if grav5 and float(grav5) > 0:
        return Decimal("5")
    return Decimal("0")


def iva_monto_incluido(total, tasa):
    t = float(tasa)
    return int(round(total * t / (100 + t))) if t else 0


# ----------------------------------------------------------------------------
# Conexiones
# ----------------------------------------------------------------------------
def mysql_conn():
    return pymysql.connect(**MYSQL)


def mysql_stream():
    return pymysql.connect(**MYSQL, cursorclass=pymysql.cursors.SSCursor)


def pg_conn():
    return psycopg.connect(PG_DSN, autocommit=False)


# ----------------------------------------------------------------------------
# Setup
# ----------------------------------------------------------------------------
def reset_schema(pg):
    print("  → recreando public y aplicando db/schema.sql …")
    with pg.cursor() as cur:
        cur.execute("DROP SCHEMA public CASCADE; CREATE SCHEMA public;")
        with open(SCHEMA_SQL, "r", encoding="utf-8") as f:
            cur.execute(f.read())
    pg.commit()
    print("  ✓ esquema aplicado")


def crear_base(pg):
    with pg.cursor() as cur:
        cur.execute(
            """INSERT INTO companies (id, ruc, razon_social, nombre_fantasia,
                    regimen_tributario, iva_condition)
               VALUES (%s,%s,%s,%s,%s,%s) ON CONFLICT (id) DO NOTHING""",
            (COMPANY_ID, EMPRESA["ruc"], EMPRESA["razon_social"],
             EMPRESA["nombre_fantasia"], EMPRESA["regimen_tributario"],
             EMPRESA["iva_condition"]))
        for slug, nombre in ALL_LISTS:
            cur.execute(
                """INSERT INTO price_lists (id, company_id, nombre, tipo, activo)
                   VALUES (%s,%s,%s,'general',true) ON CONFLICT (id) DO NOTHING""",
                (plist_id(slug), COMPANY_ID, nombre))
    pg.commit()
    print(f"  ✓ empresa + {len(ALL_LISTS)} listas de precio ({COMPANY_ID})")


# ----------------------------------------------------------------------------
# COPY genérico
# ----------------------------------------------------------------------------
def copy_rows(pg, sql, rows_iter, label):
    t0, n = time.time(), 0
    with pg.cursor() as cur:
        with cur.copy(sql) as cp:
            for row in rows_iter:
                cp.write_row(row)
                n += 1
                if n % BATCH_LOG == 0:
                    print(f"      {label}: {n:,} …")
    pg.commit()
    print(f"  ✓ {label}: {n:,} filas en {time.time()-t0:,.1f}s")
    return n


# ----------------------------------------------------------------------------
# Maps auxiliares (chicos, en memoria)
# ----------------------------------------------------------------------------
def map_impuesto(my):
    """IDIMPUESTO -> tasa (10/5/0)."""
    m = {}
    with my.cursor() as cur:
        cur.execute("SELECT IDIMPUESTO, IMPUESTO FROM impuesto")
        for idimp, tasa in cur.fetchall():
            t = int(tasa or 0)
            m[idimp] = t if t in (0, 5, 10) else 10
    return m


def map_precios(my):
    """CODIGO -> [precio1..precio7, sugerido] (última vigencia gana)."""
    m = {}
    with my.cursor() as cur:
        cur.execute("SELECT CODIGO, PRECIO1, PRECIO2, PRECIO3, PRECIO4, PRECIO5, "
                    "PRECIO6, PRECIO7, PRECIOSUG FROM precios_ventas "
                    "ORDER BY FECHA_VIGENCIA")
        for row in cur.fetchall():
            c = txt_keep(row[0], 50)
            if c:
                m[c] = [money(x) for x in row[1:]]  # 8 valores
    return m


# ----------------------------------------------------------------------------
# Maestros
# ----------------------------------------------------------------------------
def load_categorias(pg, my):
    with my.cursor() as cur:
        cur.execute("SELECT ID_CATEGORIA, NOMBRE FROM categoria")
        cats = cur.fetchall()
    cat_map = {str(cid): uuid.uuid5(NS, f"cat:{cid}") for (cid, _n) in cats}

    def gen():
        for (cid, nombre) in cats:
            yield (uuid.uuid5(NS, f"cat:{cid}"), COMPANY_ID,
                   (txt(nombre) or f"CAT-{cid}")[:100], f"CAT{cid}", True, datetime.now())

    sql = ("COPY product_categories (id, company_id, nombre, codigo, activo, created_at) "
           "FROM STDIN")
    return cat_map, copy_rows(pg, sql, gen(), "categorias")


def load_productos(pg, my, cat_map, imp_map):
    """Devuelve (set de CODIGOs, dict CODIGO->costo_promedio)."""
    codigos = set()
    costos = {}

    def gen():
        with mysql_stream() as sc:
            cur = sc.cursor()
            cur.execute("SELECT CODIGO, COD_BARRA, NOMBRE, ID_CATEGORIA, IDIMPUESTO, "
                        "SERVICIO, INACTIVO, FECHA, PRECIOPROMEDIO FROM productos")
            for (codigo, cod_barra, nombre, id_cat, idimp, servicio,
                 inactivo, fecha, preciop) in cur:
                cod = txt_keep(codigo, 50)
                if not cod:
                    continue
                codigos.add(cod)
                costos[cod] = money(preciop)
                cat_id = cat_map.get(str(id_cat)) if id_cat else None
                tasa = Decimal(str(imp_map.get(idimp, 10)))
                yield (uuid.uuid5(NS, f"prod:{cod}"), COMPANY_ID, cat_id, cod,
                       txt_keep(cod_barra, 50), (txt(nombre) or cod)[:200],
                       "servicio" if servicio == 1 else "producto", "UN", tasa,
                       0, not bool(inactivo), safe_dt(fecha) or datetime.now())
        yield (PLACEHOLDER_PROD_ID, COMPANY_ID, None, "__MIGRADO_SD__", None,
               "PRODUCTO SIN DATO (migración)", "producto", "UN", Decimal("10"),
               0, False, datetime.now())

    sql = ("COPY products (id, company_id, category_id, sku, codigo_barra, nombre, "
           "tipo, unidad_medida, iva_tasa, stock_minimo, activo, created_at) FROM STDIN")
    total = copy_rows(pg, sql, gen(), "productos")
    return codigos, costos, total


def load_precios(pg, my, codigos, precio_map):
    """Un product_price por cada nivel de precio (>0) de cada producto."""
    def gen():
        for cod, precios in precio_map.items():
            if cod not in codigos:
                continue
            pid = uuid.uuid5(NS, f"prod:{cod}")
            for (slug, _n), precio in zip(ALL_LISTS, precios):
                if precio and precio > 0:
                    yield (uuid.uuid5(NS, f"pp:{cod}:{slug}"), plist_id(slug),
                           pid, precio, "PYG", True, datetime.now())

    sql = ("COPY price_list_items (id, price_list_id, product_id, precio, moneda, "
           "activo, created_at) FROM STDIN")
    return copy_rows(pg, sql, gen(), "precios de venta (todos los niveles)")


def load_clientes(pg, my):
    ids = set()

    def gen():
        with mysql_stream() as sc:
            cur = sc.cursor()
            cur.execute("SELECT IDCLIENTES, RAZONSOCIAL, NOMBRE, APELLIDO, NRODOCUMENTO, "
                        "RUC, DV, DIRECION, LOCALIDAD, TELEFONO1, EMAIL, LIMAUT, "
                        "DIASCRED, INACTIVO, FECHA, LISTA FROM clientes")
            for (idcli, razon, nombre, apellido, nrodoc, ruc, dv, direc,
                 localidad, tel, email, limaut, diascred, inactivo, fecha, lista) in cur:
                idc = txt_keep(idcli, 15)
                if not idc:
                    continue
                ids.add(idc)
                razon_social = txt(razon) or " ".join(
                    p for p in (txt(nombre), txt(apellido)) if p) or idc
                # LISTA 1..7 -> lista de precios correspondiente
                pl = plist_id(PRICE_LEVELS[lista - 1][0]) if (lista and 1 <= lista <= 7) else None
                yield (uuid.uuid5(NS, f"cli:{idc}"), COMPANY_ID,
                       "juridica" if txt(razon) else "fisica",
                       ruc_dv(ruc, dv), txt_keep(nrodoc, 20), razon_social[:255],
                       txt(direc), txt_keep(localidad, 100), txt_keep(tel, 20),
                       txt_keep(email, 255), pl, money(limaut),
                       "credito" if (diascred or 0) > 0 else "contado",
                       not bool(inactivo), safe_dt(fecha) or datetime.now())

    sql = ("COPY customers (id, company_id, tipo_persona, ruc, ci, razon_social, "
           "direccion, ciudad, telefono, email, price_list_id, credito_limite, "
           "pago_default, activo, created_at) FROM STDIN")
    total = copy_rows(pg, sql, gen(), "clientes")
    return ids, total


def load_proveedores(pg, my):
    """Devuelve dict CODIGO->supplier_uuid (para las compras)."""
    code_map = {}

    def gen():
        with mysql_stream() as sc:
            cur = sc.cursor()
            cur.execute("SELECT IDPROVEEDOR, CODIGO, NOMBRE, DIRECCION, ID_CIUDAD, "
                        "EMAIL, RUC, DV, INACTIVO, FECHA FROM proveedor")
            for (idprov, codigo, nombre, direc, ciudad, email, ruc, dv,
                 inactivo, fecha) in cur:
                sid = uuid.uuid5(NS, f"prov:{idprov}")
                cod = txt_keep(codigo, 20)
                if cod:
                    code_map[cod] = sid
                yield (sid, COMPANY_ID, "juridica",
                       ruc_dv(str(ruc) if ruc else None, dv),
                       (txt(nombre) or cod or "PROVEEDOR")[:255], txt(direc),
                       txt_keep(ciudad, 100), None, txt_keep(email, 255),
                       not bool(inactivo), safe_dt(fecha) or datetime.now())
        yield (PLACEHOLDER_SUP_ID, COMPANY_ID, "juridica", None,
               "PROVEEDOR SIN DATO (migración)", None, None, None, None,
               False, datetime.now())

    sql = ("COPY suppliers (id, company_id, tipo_persona, ruc, razon_social, "
           "direccion, ciudad, telefono, email, activo, created_at) FROM STDIN")
    copy_rows(pg, sql, gen(), "proveedores")
    return code_map


# ----------------------------------------------------------------------------
# Almacenes / stock / cuentas
# ----------------------------------------------------------------------------
def load_warehouses(pg, my):
    rows = [(DEFAULT_WH_ID, COMPANY_ID, "PRAL", "Depósito Principal", "principal", True)]
    valid = {DEFAULT_WH_ID}
    try:
        with my.cursor() as cur:
            cur.execute("SELECT ID_DEPOSITO, DESCRIPCION FROM deposito")
            for (did, desc) in cur.fetchall():
                if did is None:
                    continue
                wid = uuid.uuid5(NS, f"wh:{did}")
                valid.add(wid)
                rows.append((wid, COMPANY_ID, f"D{str(did)[:8]}",
                             (txt(desc) or f"Depósito {did}")[:100], "principal", True))
    except Exception as e:
        print(f"      (aviso deposito: {e})")
    copy_rows(pg, "COPY warehouses (id, company_id, codigo, nombre, tipo, activo) FROM STDIN",
              iter(rows), "almacenes")
    return valid


def wh_uuid(id_dep):
    return DEFAULT_WH_ID if id_dep in (None, 0, "0") else uuid.uuid5(NS, f"wh:{id_dep}")


def load_stock(pg, my, codigos, costos, valid_wh):
    seen = set()

    def gen():
        with mysql_stream() as sc:
            cur = sc.cursor()
            cur.execute("SELECT ID_DEPOSITO, IDPRODUCTOS, EXISTENCIA FROM existencia")
            for (id_dep, idprod, existencia) in cur:
                cod = txt_keep(idprod, 50)
                if not cod or cod not in codigos:
                    continue
                wh = wh_uuid(id_dep)
                if wh not in valid_wh:
                    wh = DEFAULT_WH_ID
                pid = uuid.uuid5(NS, f"prod:{cod}")
                if (wh, pid) in seen:
                    continue
                seen.add((wh, pid))
                yield (uuid.uuid5(NS, f"stock:{id_dep}:{cod}"), wh, pid,
                       int(round(float(existencia or 0))), 0, costos.get(cod) or None,
                       datetime.now())

    sql = ("COPY stock (id, warehouse_id, product_id, cantidad, cantidad_reservada, "
           "costo_unitario, updated_at) FROM STDIN")
    return copy_rows(pg, sql, gen(), "stock")


def load_cuentas(pg, my, cli_ids):
    print("  → agregando saldos de cuenta corriente …")
    saldos = {}
    with mysql_stream() as sc:
        cur = sc.cursor()
        cur.execute("SELECT IDCLIENTES, MONTO, COBRO, CANCELADO FROM ctas_a_cobrar")
        for (idcli, monto, cobro, cancelado) in cur:
            idc = txt_keep(idcli, 15)
            if not idc or idc not in cli_ids or cancelado:
                continue
            pend = money(monto) - money(cobro)
            if pend:
                saldos[idc] = saldos.get(idc, 0) + pend

    def gen():
        for idc, saldo in saldos.items():
            yield (uuid.uuid5(NS, f"cta:{idc}"), uuid.uuid5(NS, f"cli:{idc}"),
                   "PYG", 0, saldo, 30, True, datetime.now())

    sql = ("COPY customer_accounts (id, customer_id, moneda, limite_credito, "
           "saldo_actual, dias_plazo, activo, created_at) FROM STDIN")
    return copy_rows(pg, sql, gen(), "cuentas corrientes")


# ----------------------------------------------------------------------------
# Ventas + ítems
# ----------------------------------------------------------------------------
def load_ventas(pg, my, cli_ids):
    facturas = set()

    def gen():
        with mysql_stream() as sc:
            cur = sc.cursor()
            cur.execute("SELECT IDFACVENTAS, IDCLIENTE, NUMFAC, MONTO, FECHA, "
                        "MODOPAGO, TIMBRADO, RENDIDO FROM fac_ventas")
            for (idfac, idcli, numfac, monto, fecha, modopago, timbrado, rendido) in cur:
                facturas.add(idfac)
                idc = txt_keep(idcli, 15)
                cust = uuid.uuid5(NS, f"cli:{idc}") if (idc and idc in cli_ids) else None
                total = money(monto)
                obs = f"NUMFAC={money(numfac)} TIMB={txt_keep(timbrado) or ''}".strip()
                yield (uuid.uuid5(NS, f"fac:{idfac}"), COMPANY_ID, cust,
                       str(idfac)[:20], safe_dt(fecha) or datetime.now(), "factura",
                       "credito" if (modopago or 0) in (1, 2) else "contado",
                       "PYG", "completado", total, total,
                       total if rendido else 0, 0 if rendido else total,
                       obs[:500], datetime.now())

    sql = ("COPY sales (id, company_id, customer_id, numero, fecha, tipo_comprobante, "
           "condicion, moneda, estado, subtotal, total, total_pagado, saldo, "
           "observaciones, created_at) FROM STDIN")
    total = copy_rows(pg, sql, gen(), "ventas (cabecera)")
    return facturas, total


def load_items(pg, my, facturas, codigos):
    saltados = [0]

    def gen():
        with mysql_stream() as sc:
            cur = sc.cursor()
            cur.execute("SELECT ID, IDVENTAS, IDPRODUCTOS, CANTIDAD, PRECVENTA, SUBTOTAL, "
                        "COSTOPROMEDIO, GRAV10, GRAV5, EXENTAS FROM item_ventas")
            for (iid, idv, idprod, cant, precv, subt, costo, g10, g5, ex) in cur:
                if idv not in facturas:
                    saltados[0] += 1
                    continue
                cod = txt_keep(idprod, 50)
                pid = uuid.uuid5(NS, f"prod:{cod}") if (cod and cod in codigos) else PLACEHOLDER_PROD_ID
                tasa = iva_tasa(g10, g5, ex)
                total = money(subt)
                # uuid5 determinista (antes uuid4 aleatorio) — mismo esquema que
                # sync_incremental.py::sync_items_ventas. Con uuid4 dos corridas
                # de este script insertaban cada vez ~11.6M filas nuevas sin
                # deduplicar nada (nunca colisionaban), duplicando sale_items.
                yield (uuid.uuid5(NS, f"item:{iid}"), uuid.uuid5(NS, f"fac:{idv}"), pid, num3(cant),
                       money(precv), 0, tasa, iva_monto_incluido(total, tasa),
                       total, money(costo), datetime.now())

    sql = ("COPY sale_items (id, sale_id, product_id, cantidad, precio_unitario, "
           "descuento_monto, iva_tasa, iva_monto, total, costo_unitario, created_at) "
           "FROM STDIN")
    total = copy_rows(pg, sql, gen(), "ítems de venta")
    if saltados[0]:
        print(f"      (ítems saltados sin factura: {saltados[0]:,})")
    return total


# ----------------------------------------------------------------------------
# Notas de crédito (como ventas negativas)
# ----------------------------------------------------------------------------
def load_notas(pg, my, cli_ids):
    notas = set()

    def gen():
        with mysql_stream() as sc:
            cur = sc.cursor()
            cur.execute("SELECT IDNOTACREDITO, IDCLIENTE, NUMNOTACRED, MONTO, FECHA, "
                        "CONCEPTO FROM notacredito")
            for (idnc, idcli, numnc, monto, fecha, concepto) in cur:
                notas.add(idnc)
                idc = txt_keep(idcli, 15)
                cust = uuid.uuid5(NS, f"cli:{idc}") if (idc and idc in cli_ids) else None
                total = -abs(money(monto))  # negativa: reduce facturación neta
                obs = f"NC {money(numnc)} {txt_keep(concepto) or ''}".strip()
                yield (uuid.uuid5(NS, f"nc:{idnc}"), COMPANY_ID, cust,
                       f"NC{idnc}"[:20], safe_dt(fecha) or datetime.now(), "notacredito",
                       "contado", "PYG", "completado", total, total, 0, 0,
                       obs[:500], datetime.now())

    sql = ("COPY sales (id, company_id, customer_id, numero, fecha, tipo_comprobante, "
           "condicion, moneda, estado, subtotal, total, total_pagado, saldo, "
           "observaciones, created_at) FROM STDIN")
    total = copy_rows(pg, sql, gen(), "notas de crédito (cabecera)")
    return notas, total


def load_items_nc(pg, my, notas, codigos):
    saltados = [0]

    def gen():
        with mysql_stream() as sc:
            cur = sc.cursor()
            cur.execute("SELECT ID, IDNOTACREDITO, IDPRODUCTOS, CANTIDAD, PRECVENTA, "
                        "SUBTOTAL, COSTOPROMEDIO, GRAV10, GRAV5, EXENTAS "
                        "FROM itemnotacredito")
            for (iid, idnc, idprod, cant, precv, subt, costo, g10, g5, ex) in cur:
                if idnc not in notas:
                    saltados[0] += 1
                    continue
                cod = txt_keep(idprod, 50)
                pid = uuid.uuid5(NS, f"prod:{cod}") if (cod and cod in codigos) else PLACEHOLDER_PROD_ID
                tasa = iva_tasa(g10, g5, ex)
                total = -abs(money(subt))
                # uuid5 determinista (antes uuid4 aleatorio) — mismo esquema que
                # sync_incremental.py::sync_items_notas.
                yield (uuid.uuid5(NS, f"item_nc:{iid}"), uuid.uuid5(NS, f"nc:{idnc}"), pid, num3(cant),
                       money(precv), 0, tasa, iva_monto_incluido(total, tasa),
                       total, money(costo), datetime.now())

    sql = ("COPY sale_items (id, sale_id, product_id, cantidad, precio_unitario, "
           "descuento_monto, iva_tasa, iva_monto, total, costo_unitario, created_at) "
           "FROM STDIN")
    total = copy_rows(pg, sql, gen(), "ítems nota de crédito")
    if saltados[0]:
        print(f"      (ítems NC saltados sin nota: {saltados[0]:,})")
    return total


# ----------------------------------------------------------------------------
# Compras + ítems
# ----------------------------------------------------------------------------
def load_compras(pg, my, sup_code_map):
    compras = set()

    def gen():
        with mysql_stream() as sc:
            cur = sc.cursor()
            cur.execute("SELECT IDFACCOMPRAS, IDCODPROV, NUMFAC, FECHA, TIMBRADO "
                        "FROM fac_compras")
            for (idfc, idprov, numfac, fecha, timbrado) in cur:
                compras.add(idfc)
                cod = txt_keep(idprov, 20)
                sid = sup_code_map.get(cod, PLACEHOLDER_SUP_ID) if cod else PLACEHOLDER_SUP_ID
                obs = f"FACT={txt_keep(numfac) or ''} TIMB={txt_keep(timbrado) or ''}".strip()
                yield (uuid.uuid5(NS, f"comp:{idfc}"), COMPANY_ID, sid,
                       f"C{idfc}"[:20], safe_dt(fecha) or datetime.now(), "recibido",
                       "PYG", obs[:500], datetime.now())

    sql = ("COPY purchase_orders (id, company_id, supplier_id, numero, fecha, estado, "
           "moneda, observaciones, created_at) FROM STDIN")
    total = copy_rows(pg, sql, gen(), "compras (cabecera)")
    return compras, total


def load_items_compras(pg, my, compras, codigos):
    saltados = [0]

    def gen():
        with mysql_stream() as sc:
            cur = sc.cursor()
            cur.execute("SELECT IDITEMCOMPRAS, IDFACCOMPRAS, IDPRODUCTO, CANTIDAD, PPRECIOCOSTO, "
                        "SUBTOTAL, GRAV10, GRAV5, EXENTAS FROM item_compras")
            for (iid, idfc, idprod, cant, pcosto, subt, g10, g5, ex) in cur:
                if idfc not in compras:
                    saltados[0] += 1
                    continue
                cod = txt_keep(idprod, 50)
                pid = uuid.uuid5(NS, f"prod:{cod}") if (cod and cod in codigos) else PLACEHOLDER_PROD_ID
                tasa = iva_tasa(g10, g5, ex)
                # uuid5 determinista (antes uuid4 aleatorio) — mismo esquema que
                # sync_incremental.py::sync_items_compras.
                yield (uuid.uuid5(NS, f"item_comp:{iid}"), uuid.uuid5(NS, f"comp:{idfc}"), pid, num3(cant),
                       money(pcosto), tasa, money(subt), datetime.now())

    sql = ("COPY purchase_order_items (id, purchase_order_id, product_id, cantidad, "
           "precio_unitario, iva_tasa, total, created_at) FROM STDIN")
    total = copy_rows(pg, sql, gen(), "ítems de compra")
    if saltados[0]:
        print(f"      (ítems compra saltados sin cabecera: {saltados[0]:,})")
    return total


# ----------------------------------------------------------------------------
# Post-proceso: recálculo de IVA en cabeceras
# ----------------------------------------------------------------------------
def recalcular_iva(pg):
    print("\n[post] recalculando IVA de cabeceras desde los ítems …")
    with pg.cursor() as cur:
        print("  → ventas / notas de crédito …")
        cur.execute("""
            WITH a AS (
              SELECT sale_id,
                SUM(CASE WHEN iva_tasa=10 THEN total ELSE 0 END) t10,
                SUM(CASE WHEN iva_tasa=10 THEN iva_monto ELSE 0 END) i10,
                SUM(CASE WHEN iva_tasa=5  THEN total ELSE 0 END) t5,
                SUM(CASE WHEN iva_tasa=5  THEN iva_monto ELSE 0 END) i5,
                SUM(CASE WHEN iva_tasa=0  THEN total ELSE 0 END) tex
              FROM sale_items GROUP BY sale_id)
            UPDATE sales s SET
              base_gravada_10 = a.t10 - a.i10, iva_10 = a.i10,
              base_gravada_5  = a.t5  - a.i5,  iva_5  = a.i5,
              base_exenta     = a.tex
            FROM a WHERE s.id = a.sale_id
        """)
        print("  → compras (subtotal / total / iva) …")
        cur.execute("""
            WITH a AS (
              SELECT purchase_order_id,
                SUM(total) tot,
                SUM(CASE WHEN iva_tasa=10 THEN round(total*10/110.0) ELSE 0 END) i10,
                SUM(CASE WHEN iva_tasa=5  THEN round(total*5/105.0)  ELSE 0 END) i5
              FROM purchase_order_items GROUP BY purchase_order_id)
            UPDATE purchase_orders p SET
              subtotal = a.tot, total = a.tot, iva_10 = a.i10, iva_5 = a.i5
            FROM a WHERE p.id = a.purchase_order_id
        """)
    pg.commit()
    print("  ✓ IVA de cabeceras recalculado")


# ----------------------------------------------------------------------------
# Main
# ----------------------------------------------------------------------------
def main():
    reset = "--reset" in sys.argv
    t0 = time.time()
    print("=" * 64)
    print("ETL Casa Gonzalito → Intelimarket  (v2 — migración completa)")
    print("=" * 64)

    pg, my = pg_conn(), mysql_conn()
    if reset:
        reset_schema(pg)
    crear_base(pg)

    imp_map = map_impuesto(my)
    precio_map = map_precios(my)

    print("\n[1] Maestros")
    cat_map, _ = load_categorias(pg, my)
    codigos, costos, _ = load_productos(pg, my, cat_map, imp_map)
    load_precios(pg, my, codigos, precio_map)
    cli_ids, _ = load_clientes(pg, my)
    sup_map = load_proveedores(pg, my)

    print("\n[2] Almacenes y saldos")
    valid_wh = load_warehouses(pg, my)
    load_stock(pg, my, codigos, costos, valid_wh)
    load_cuentas(pg, my, cli_ids)

    print("\n[3] Ventas")
    facturas, _ = load_ventas(pg, my, cli_ids)
    load_items(pg, my, facturas, codigos)

    print("\n[4] Notas de crédito")
    notas, _ = load_notas(pg, my, cli_ids)
    load_items_nc(pg, my, notas, codigos)

    print("\n[5] Compras")
    compras, _ = load_compras(pg, my, sup_map)
    load_items_compras(pg, my, compras, codigos)

    recalcular_iva(pg)

    my.close()
    pg.close()
    print("\n" + "=" * 64)
    print(f"✓ MIGRACIÓN COMPLETA en {(time.time()-t0)/60:,.1f} min")
    print("=" * 64)


if __name__ == "__main__":
    main()
