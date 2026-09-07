#!/usr/bin/env python3
"""
Sync incremental — Casa Gonzalito (MySQL legacy "columbia", en vivo) -> Intelimarket (PostgreSQL)

A diferencia de etl.py (carga masiva única con COPY, pensada para full-reset), este script
corre repetidamente (cron cada 1h) contra la base MySQL EN VIVO del servidor legacy
(192.168.1.103) y hace upsert incremental. Usa los mismos UUIDs deterministas (uuid5) que
etl.py para que cada fila del legacy siempre mapee al mismo id en Postgres — así el upsert
es idempotente aunque una fila se re-procese.

Estrategia de detección de cambios (varía según si la tabla legacy tiene columna de auditoría):
  - Documentos inmutables una vez creados (ventas, notas de crédito, compras + sus ítems):
    incremental por ID autoincrement > último visto (guardado en sync_watermarks).
  - Entidades mutables CON columna de auditoría (productos.FECMOD, clientes.FECMOD,
    precios_ventas.FECMOD, existencia.FECHAMODIFICADO): incremental por timestamp > última corrida.
  - ctas_a_cobrar: NO tiene columna de auditoría, y CANCELADO/COBRO cambian después de creada
    la fila (cuando se cobra) -> no se puede hacer watermark por ID. Se recalcula el agregado
    completo (customer_accounts.saldo_actual) cada corrida escaneando toda la tabla — barato
    (~270k filas, un SELECT agregado en MySQL de segundos).
  - categoria / deposito / proveedor: sin columna de auditoría y volumen chico (<3k filas
    combinadas) -> resync completo cada corrida.

Uso:
    uv run python sync_incremental.py            # corrida normal
    uv run python sync_incremental.py --dry-run   # solo muestra qué sincronizaría, no escribe
    uv run python sync_incremental.py --once=<entidad>  # sincroniza solo una entidad (debug)

Variables de entorno (mismas que etl.py, MYSQL_HOST default apunta al legacy en vivo):
    MYSQL_HOST=192.168.1.103 MYSQL_USER=im_sync_ro MYSQL_PASSWORD=... MYSQL_DB=columbia
    PG_DSN=postgresql://intelimarket:intelimarket_dev@localhost:5432/intelimarket
"""

import json
import os
import sys
import time
import uuid
from datetime import datetime, date, timezone
from decimal import Decimal, InvalidOperation

import pymysql
import pymysql.cursors
import psycopg

# ----------------------------------------------------------------------------
# Configuración (default MYSQL_HOST = legacy EN VIVO, no la copia local de dev)
# ----------------------------------------------------------------------------
MYSQL = dict(
    host=os.getenv("MYSQL_HOST", "192.168.1.103"),
    port=int(os.getenv("MYSQL_PORT", "3306")),
    user=os.getenv("MYSQL_USER", "im_sync_ro"),
    password=os.getenv("MYSQL_PASSWORD", "SyncGonzalito2026ro"),
    database=os.getenv("MYSQL_DB", "columbia"),
    charset="latin1",
)
PG_DSN = os.getenv(
    "PG_DSN", "postgresql://intelimarket:intelimarket_dev@localhost:5432/intelimarket")

NS = uuid.UUID("c0a5a600-0000-4000-8000-000000000001")
COMPANY_ID = uuid.UUID("00000000-0000-0000-0000-000000000010")
PLACEHOLDER_PROD_ID = uuid.uuid5(NS, "prod:__DESCONOCIDO__")
PLACEHOLDER_SUP_ID = uuid.uuid5(NS, "prov:__DESCONOCIDO__")
DEFAULT_WH_ID = uuid.uuid5(NS, "wh:default")

PRICE_LEVELS = [("pl1", "Precio 1"), ("pl2", "Precio 2"), ("pl3", "Precio 3"),
                ("pl4", "Precio 4"), ("pl5", "Precio 5"), ("pl6", "Precio 6"),
                ("pl7", "Precio 7")]


def plist_id(slug):
    return uuid.uuid5(NS, f"pl:{slug}")


DRY_RUN = "--dry-run" in sys.argv
ONLY = next((a.split("=", 1)[1] for a in sys.argv if a.startswith("--once=")), None)


# ----------------------------------------------------------------------------
# Helpers (idénticos a etl.py)
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


def valid_venc_date(dt):
    """Descarta fechas de vencimiento con anio corrupto en el legacy (ej.
    '0107-12-01' visto en ctas_a_pagar) — un puñado de filas (11 de 106.815
    en AP, 104 de 272.141 en AR), pero sin este filtro distorsionan el
    bucket "+90 dias" del aging con moras de siglos que no son reales."""
    if dt is None or dt.year < 2000 or dt.year > 2100:
        return None
    return dt


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


def mysql_conn():
    return pymysql.connect(**MYSQL)


def pg_conn():
    return psycopg.connect(PG_DSN, autocommit=False)


# ----------------------------------------------------------------------------
# Watermarks
# ----------------------------------------------------------------------------
def ensure_watermark_table(pg):
    with pg.cursor() as cur:
        cur.execute("""
            CREATE TABLE IF NOT EXISTS sync_watermarks (
                entity TEXT PRIMARY KEY,
                last_id BIGINT DEFAULT 0,
                last_synced_at TIMESTAMPTZ,
                updated_at TIMESTAMPTZ DEFAULT now()
            )
        """)
    pg.commit()


def get_watermark(pg, entity):
    """Devuelve (last_id, last_synced_at) — last_synced_at siempre naive (sin tzinfo),
    porque se compara contra timestamps de MySQL (naive) y se usa como parámetro en
    consultas a MySQL. Postgres guarda TIMESTAMPTZ; se le saca el tzinfo al leer."""
    with pg.cursor() as cur:
        cur.execute("SELECT last_id, last_synced_at FROM sync_watermarks WHERE entity = %s",
                    (entity,))
        row = cur.fetchone()
        if row:
            ts = row[1]
            if ts is not None and ts.tzinfo is not None:
                ts = ts.astimezone(timezone.utc).replace(tzinfo=None)
            return row[0] or 0, ts
        return 0, None


def set_watermark(pg, entity, last_id=None, last_synced_at=None):
    if DRY_RUN:
        return
    with pg.cursor() as cur:
        cur.execute("""
            INSERT INTO sync_watermarks (entity, last_id, last_synced_at, updated_at)
            VALUES (%s, %s, %s, now())
            ON CONFLICT (entity) DO UPDATE SET
                last_id = COALESCE(EXCLUDED.last_id, sync_watermarks.last_id),
                last_synced_at = COALESCE(EXCLUDED.last_synced_at, sync_watermarks.last_synced_at),
                updated_at = now()
        """, (entity, last_id, last_synced_at))
    pg.commit()


# ----------------------------------------------------------------------------
# Upsert genérico (volúmenes chicos por corrida -> execute() fila por fila está bien)
# ----------------------------------------------------------------------------
def upsert(pg, table, cols, rows, conflict_col="id", update_cols=None):
    """rows: lista de tuplas en el orden de cols. update_cols: default = todas menos conflict_col."""
    rows = list(rows)
    if not rows:
        return 0
    if update_cols is None:
        update_cols = [c for c in cols if c != conflict_col]
    placeholders = ", ".join(["%s"] * len(cols))
    set_clause = ", ".join(f"{c} = EXCLUDED.{c}" for c in update_cols)
    sql = (f"INSERT INTO {table} ({', '.join(cols)}) VALUES ({placeholders}) "
           f"ON CONFLICT ({conflict_col}) DO UPDATE SET {set_clause}")
    if DRY_RUN:
        return len(rows)
    with pg.cursor() as cur:
        cur.executemany(sql, rows)
    pg.commit()
    return len(rows)


def log(msg):
    print(f"[{datetime.now().strftime('%H:%M:%S')}] {msg}", flush=True)


def legacy_id_set(my, table, id_col):
    """Set completo de IDs válidos de una tabla legacy — barato (una sola columna INT),
    se usa para filtrar huérfanos en las tablas de ítems (cuya cabecera puede haber sido
    cargada en una corrida anterior, no necesariamente en la corrida actual)."""
    with my.cursor() as cur:
        cur.execute(f"SELECT {id_col} FROM {table}")
        return {r[0] for r in cur.fetchall()}


def pg_id_set(pg, table):
    """Set completo de IDs (UUID) ya insertados en una tabla de Postgres —
    a diferencia de legacy_id_set(), esto refleja lo que REALMENTE quedo
    migrado (algunas filas del legacy se saltan por huerfanas, ej. ctas_a_cobrar
    de un cliente que no existe), no todo lo que existe del lado legacy."""
    with pg.cursor() as cur:
        cur.execute(f"SELECT id FROM {table}")
        return {r[0] for r in cur.fetchall()}


# ----------------------------------------------------------------------------
# Maestros chicos (resync completo cada corrida, volumen <3k filas combinadas)
# ----------------------------------------------------------------------------
def sync_categorias(pg, my):
    with my.cursor() as cur:
        cur.execute("SELECT ID_CATEGORIA, NOMBRE FROM categoria")
        rows = cur.fetchall()
    out = [(uuid.uuid5(NS, f"cat:{cid}"), COMPANY_ID, (txt(nombre) or f"CAT-{cid}")[:100],
            f"CAT{cid}", True) for (cid, nombre) in rows]
    n = upsert(pg, "product_categories", ["id", "company_id", "nombre", "codigo", "activo"], out)
    log(f"  categorias: {n} filas")
    return {str(cid): uuid.uuid5(NS, f"cat:{cid}") for (cid, _n) in rows}


def sync_depositos(pg, my):
    rows = [(DEFAULT_WH_ID, COMPANY_ID, "PRAL", "Depósito Principal", "principal", True)]
    valid = {DEFAULT_WH_ID}
    with my.cursor() as cur:
        cur.execute("SELECT ID_DEPOSITO, DESCRIPCION FROM deposito")
        for (did, desc) in cur.fetchall():
            if did is None:
                continue
            wid = uuid.uuid5(NS, f"wh:{did}")
            valid.add(wid)
            rows.append((wid, COMPANY_ID, f"D{str(did)[:8]}",
                         (txt(desc) or f"Depósito {did}")[:100], "principal", True))
    n = upsert(pg, "warehouses", ["id", "company_id", "codigo", "nombre", "tipo", "activo"], rows)
    log(f"  depositos: {n} filas")
    return valid


def wh_uuid(id_dep):
    return DEFAULT_WH_ID if id_dep in (None, 0, "0") else uuid.uuid5(NS, f"wh:{id_dep}")


def sync_proveedores(pg, my):
    code_map = {}
    with my.cursor() as cur:
        cur.execute("SELECT IDPROVEEDOR, CODIGO, NOMBRE, DIRECCION, ID_CIUDAD, "
                     "EMAIL, RUC, DV, INACTIVO, FECHA FROM proveedor")
        legacy_rows = cur.fetchall()
    rows = []
    for (idprov, codigo, nombre, direc, ciudad, email, ruc, dv, inactivo, fecha) in legacy_rows:
        sid = uuid.uuid5(NS, f"prov:{idprov}")
        cod = txt_keep(codigo, 20)
        if cod:
            code_map[cod] = sid
        rows.append((sid, COMPANY_ID, "juridica", ruc_dv(str(ruc) if ruc else None, dv),
                     (txt(nombre) or cod or "PROVEEDOR")[:255], txt(direc),
                     txt_keep(ciudad, 100), None, txt_keep(email, 255), not bool(inactivo)))
    rows.append((PLACEHOLDER_SUP_ID, COMPANY_ID, "juridica", None,
                 "PROVEEDOR SIN DATO (migración)", None, None, None, None, False))
    n = upsert(pg, "suppliers", ["id", "company_id", "tipo_persona", "ruc", "razon_social",
                                  "direccion", "ciudad", "telefono", "email", "activo"], rows)
    log(f"  proveedores: {n} filas")
    return code_map


# ----------------------------------------------------------------------------
# Entidades con FECMOD/FECHAMODIFICADO -> incremental por timestamp
# ----------------------------------------------------------------------------
def sync_productos(pg, my, cat_map):
    last_id, last_ts = get_watermark(pg, "productos")
    since = last_ts or datetime(2000, 1, 1)
    with my.cursor() as cur:
        cur.execute(
            "SELECT CODIGO, COD_BARRA, NOMBRE, ID_CATEGORIA, SERVICIO, INACTIVO, "
            "FECHA, FECMOD, PRECIOCOSTO FROM productos WHERE FECMOD > %s ORDER BY FECMOD", (since,))
        legacy_rows = cur.fetchall()
    if not legacy_rows:
        log("  productos: sin cambios")
        return set(), {}
    max_ts = since
    codigos, costos, rows = set(), {}, []
    for (codigo, cod_barra, nombre, id_cat, servicio, inactivo, fecha, fecmod, preciocosto) in legacy_rows:
        cod = txt_keep(codigo, 50)
        if not cod:
            continue
        codigos.add(cod)
        cat_id = cat_map.get(str(id_cat)) if id_cat else None
        costo = money(preciocosto) if preciocosto else 0
        costos[cod] = costo
        # products.costo_promedio/ultimo_costo nunca se escribian pese a leerse
        # aca — bug arrastrado del etl.py original (se armaba el dict "costos"
        # y se descartaba antes del INSERT). Backfill unico ya corrido para los
        # 11.358 productos existentes (ver backfill_costo.py); esto lo mantiene
        # al dia para altas/cambios de aca en mas.
        rows.append((uuid.uuid5(NS, f"prod:{cod}"), COMPANY_ID, cat_id, cod,
                     txt_keep(cod_barra, 50), (txt(nombre) or cod)[:200],
                     "servicio" if servicio == 1 else "producto",
                     not bool(inactivo), costo, costo))
        if fecmod and fecmod > max_ts:
            max_ts = fecmod
    n = upsert(pg, "products", ["id", "company_id", "category_id", "sku", "codigo_barra",
                                 "nombre", "tipo", "activo", "costo_promedio", "ultimo_costo"], rows)
    log(f"  productos: {n} filas actualizadas (FECMOD > {since})")
    set_watermark(pg, "productos", last_synced_at=max_ts)
    return codigos, costos


def sync_clientes(pg, my):
    last_id, last_ts = get_watermark(pg, "clientes")
    since = last_ts or datetime(2000, 1, 1)
    with my.cursor() as cur:
        cur.execute(
            "SELECT IDCLIENTES, RAZONSOCIAL, NOMBRE, APELLIDO, NRODOCUMENTO, RUC, DV, "
            "DIRECION, LOCALIDAD, TELEFONO1, EMAIL, LIMAUT, DIASCRED, INACTIVO, LISTA, FECMOD "
            "FROM clientes WHERE FECMOD > %s ORDER BY FECMOD", (since,))
        legacy_rows = cur.fetchall()
    if not legacy_rows:
        log("  clientes: sin cambios")
        return set()
    max_ts = since
    ids, rows = set(), []
    for (idcli, razon, nombre, apellido, nrodoc, ruc, dv, direc, localidad, tel, email,
         limaut, diascred, inactivo, lista, fecmod) in legacy_rows:
        idc = txt_keep(idcli, 15)
        if not idc:
            continue
        ids.add(idc)
        razon_social = txt(razon) or " ".join(p for p in (txt(nombre), txt(apellido)) if p) or idc
        pl = plist_id(PRICE_LEVELS[lista - 1][0]) if (lista and 1 <= lista <= 7) else None
        rows.append((uuid.uuid5(NS, f"cli:{idc}"), COMPANY_ID, "juridica" if txt(razon) else "fisica",
                     ruc_dv(ruc, dv), txt_keep(nrodoc, 20), razon_social[:255], txt(direc),
                     txt_keep(localidad, 100), txt_keep(tel, 20), txt_keep(email, 255), pl,
                     money(limaut), "credito" if (diascred or 0) > 0 else "contado",
                     not bool(inactivo)))
        if fecmod and fecmod > max_ts:
            max_ts = fecmod
    n = upsert(pg, "customers", ["id", "company_id", "tipo_persona", "ruc", "ci", "razon_social",
                                  "direccion", "ciudad", "telefono", "email", "price_list_id",
                                  "credito_limite", "pago_default", "activo"], rows)
    log(f"  clientes: {n} filas actualizadas (FECMOD > {since})")
    set_watermark(pg, "clientes", last_synced_at=max_ts)
    return ids


def sync_precios(pg, my):
    last_id, last_ts = get_watermark(pg, "precios")
    since = last_ts or datetime(2000, 1, 1)
    with my.cursor() as cur:
        cur.execute(
            "SELECT CODIGO, PRECIO1, PRECIO2, PRECIO3, PRECIO4, PRECIO5, PRECIO6, PRECIO7, "
            "FECMOD FROM precios_ventas WHERE FECMOD > %s ORDER BY FECMOD", (since,))
        legacy_rows = cur.fetchall()
    if not legacy_rows:
        log("  precios: sin cambios")
        return
    productos_validos = {txt_keep(c, 50) for c in legacy_id_set(my, "productos", "CODIGO")}
    max_ts = since
    rows = []
    for row in legacy_rows:
        cod, *precios, fecmod = row
        cod = txt_keep(cod, 50)
        if not cod or cod not in productos_validos:
            continue
        pid = uuid.uuid5(NS, f"prod:{cod}")
        for (slug, _n), precio in zip(PRICE_LEVELS, precios):
            precio = money(precio)
            if precio and precio > 0:
                rows.append((uuid.uuid5(NS, f"pp:{cod}:{slug}"), plist_id(slug), pid, precio,
                             "PYG", True))
        if fecmod and fecmod > max_ts:
            max_ts = fecmod
    n = upsert(pg, "price_list_items", ["id", "price_list_id", "product_id", "precio",
                                         "moneda", "activo"], rows)
    log(f"  precios: {n} filas actualizadas (FECMOD > {since})")
    set_watermark(pg, "precios", last_synced_at=max_ts)


def sync_stock(pg, my, valid_wh):
    last_id, last_ts = get_watermark(pg, "stock")
    since = last_ts or datetime(2000, 1, 1)
    with my.cursor() as cur:
        cur.execute(
            "SELECT ID_DEPOSITO, IDPRODUCTOS, EXISTENCIA, FECHAMODIFICADO FROM existencia "
            "WHERE FECHAMODIFICADO > %s ORDER BY FECHAMODIFICADO", (since,))
        legacy_rows = cur.fetchall()
    if not legacy_rows:
        log("  stock: sin cambios")
        return
    productos_validos = {txt_keep(c, 50) for c in legacy_id_set(my, "productos", "CODIGO")}
    max_ts = since
    seen, rows = set(), []
    for (id_dep, idprod, existencia, fechamod) in legacy_rows:
        cod = txt_keep(idprod, 50)
        if not cod or cod not in productos_validos:
            continue
        wh = wh_uuid(id_dep)
        if wh not in valid_wh:
            wh = DEFAULT_WH_ID
        pid = uuid.uuid5(NS, f"prod:{cod}")
        key = (wh, pid)
        if key in seen:
            continue
        seen.add(key)
        rows.append((uuid.uuid5(NS, f"stock:{id_dep}:{cod}"), wh, pid,
                     int(round(float(existencia or 0))), 0, datetime.now(timezone.utc)))
        if fechamod and fechamod > max_ts:
            max_ts = fechamod
    n = upsert(pg, "stock", ["id", "warehouse_id", "product_id", "cantidad",
                              "cantidad_reservada", "updated_at"], rows,
               update_cols=["warehouse_id", "product_id", "cantidad", "updated_at"])
    log(f"  stock: {n} filas actualizadas (FECHAMODIFICADO > {since})")
    set_watermark(pg, "stock", last_synced_at=max_ts)


# ----------------------------------------------------------------------------
# Documentos inmutables -> incremental por ID autoincrement
# ----------------------------------------------------------------------------
def sync_ventas(pg, my):
    last_id, _ = get_watermark(pg, "ventas")
    with my.cursor() as cur:
        cur.execute(
            "SELECT IDFACVENTAS, IDCLIENTE, NUMFAC, MONTO, FECHA, MODOPAGO, TIMBRADO, RENDIDO, IDVENDEDOR "
            "FROM fac_ventas WHERE IDFACVENTAS > %s ORDER BY IDFACVENTAS", (last_id,))
        legacy_rows = cur.fetchall()
    if not legacy_rows:
        log("  ventas: sin filas nuevas")
        return set(), last_id
    clientes_validos = {txt_keep(c, 15) for c in legacy_id_set(my, "clientes", "IDCLIENTES")}
    max_id, rows = last_id, []
    for (idfac, idcli, numfac, monto, fecha, modopago, timbrado, rendido, idvend) in legacy_rows:
        idc = txt_keep(idcli, 15)
        cust = uuid.uuid5(NS, f"cli:{idc}") if (idc and idc in clientes_validos) else None
        total = money(monto)
        obs = f"NUMFAC={money(numfac)} TIMB={txt_keep(timbrado) or ''}".strip()
        rows.append((uuid.uuid5(NS, f"fac:{idfac}"), COMPANY_ID, cust, str(idfac)[:20],
                     safe_dt(fecha) or datetime.now(), "factura",
                     "credito" if (modopago or 0) in (1, 2) else "contado", "PYG", "completado",
                     total, total, total if rendido else 0, 0 if rendido else total, obs[:500],
                     txt_keep(idvend, 10)))
        max_id = max(max_id, idfac)
    n = upsert(pg, "sales", ["id", "company_id", "customer_id", "numero", "fecha",
                              "tipo_comprobante", "condicion", "moneda", "estado", "subtotal",
                              "total", "total_pagado", "saldo", "observaciones", "vendedor_codigo"], rows)
    log(f"  ventas: {n} filas nuevas (IDFACVENTAS {last_id} -> {max_id})")
    set_watermark(pg, "ventas", last_id=max_id)
    return {idfac for (idfac, *_r) in legacy_rows}, max_id


def sync_items_ventas(pg, my):
    last_id, _ = get_watermark(pg, "item_ventas")
    with my.cursor() as cur:
        cur.execute(
            "SELECT ID, IDVENTAS, IDPRODUCTOS, CANTIDAD, PRECVENTA, SUBTOTAL, COSTOPROMEDIO, "
            "GRAV10, GRAV5, EXENTAS FROM item_ventas WHERE ID > %s ORDER BY ID", (last_id,))
        legacy_rows = cur.fetchall()
    if not legacy_rows:
        log("  item_ventas: sin filas nuevas")
        return last_id
    facturas_validas = legacy_id_set(my, "fac_ventas", "IDFACVENTAS")
    max_id, rows, saltados = last_id, [], 0
    for (iid, idv, idprod, cant, precv, subt, costo, g10, g5, ex) in legacy_rows:
        max_id = max(max_id, iid)
        if idv not in facturas_validas:
            saltados += 1
            continue
        cod = txt_keep(idprod, 50)
        pid = uuid.uuid5(NS, f"prod:{cod}") if cod else PLACEHOLDER_PROD_ID
        tasa = iva_tasa(g10, g5, ex)
        total = money(subt)
        rows.append((uuid.uuid5(NS, f"item:{iid}"), uuid.uuid5(NS, f"fac:{idv}"), pid, num3(cant),
                     money(precv), 0, tasa, iva_monto_incluido(total, tasa), total, money(costo)))
    n = upsert(pg, "sale_items", ["id", "sale_id", "product_id", "cantidad", "precio_unitario",
                                   "descuento_monto", "iva_tasa", "iva_monto", "total",
                                   "costo_unitario"], rows)
    log(f"  item_ventas: {n} filas nuevas (ID {last_id} -> {max_id}{', ' + str(saltados) + ' saltadas sin factura' if saltados else ''})")
    set_watermark(pg, "item_ventas", last_id=max_id)
    return max_id


def sync_notas(pg, my):
    last_id, _ = get_watermark(pg, "notas")
    with my.cursor() as cur:
        cur.execute(
            "SELECT IDNOTACREDITO, IDCLIENTE, NUMNOTACRED, MONTO, FECHA, CONCEPTO "
            "FROM notacredito WHERE IDNOTACREDITO > %s ORDER BY IDNOTACREDITO", (last_id,))
        legacy_rows = cur.fetchall()
    if not legacy_rows:
        log("  notas de crédito: sin filas nuevas")
        return last_id
    clientes_validos = {txt_keep(c, 15) for c in legacy_id_set(my, "clientes", "IDCLIENTES")}
    max_id, rows = last_id, []
    for (idnc, idcli, numnc, monto, fecha, concepto) in legacy_rows:
        max_id = max(max_id, idnc)
        idc = txt_keep(idcli, 15)
        cust = uuid.uuid5(NS, f"cli:{idc}") if (idc and idc in clientes_validos) else None
        total = -abs(money(monto))
        obs = f"NC {money(numnc)} {txt_keep(concepto) or ''}".strip()
        rows.append((uuid.uuid5(NS, f"nc:{idnc}"), COMPANY_ID, cust, f"NC{idnc}"[:20],
                     safe_dt(fecha) or datetime.now(), "notacredito", "contado", "PYG",
                     "completado", total, total, 0, 0, obs[:500]))
    n = upsert(pg, "sales", ["id", "company_id", "customer_id", "numero", "fecha",
                              "tipo_comprobante", "condicion", "moneda", "estado", "subtotal",
                              "total", "total_pagado", "saldo", "observaciones"], rows)
    log(f"  notas de crédito: {n} filas nuevas (IDNOTACREDITO {last_id} -> {max_id})")
    set_watermark(pg, "notas", last_id=max_id)
    return max_id


def sync_items_notas(pg, my):
    last_id, _ = get_watermark(pg, "item_notas")
    with my.cursor() as cur:
        cur.execute(
            "SELECT ID, IDNOTACREDITO, IDPRODUCTOS, CANTIDAD, PRECVENTA, SUBTOTAL, "
            "COSTOPROMEDIO, GRAV10, GRAV5, EXENTAS FROM itemnotacredito "
            "WHERE ID > %s ORDER BY ID", (last_id,))
        legacy_rows = cur.fetchall()
    if not legacy_rows:
        log("  item_notacredito: sin filas nuevas")
        return last_id
    notas_validas = legacy_id_set(my, "notacredito", "IDNOTACREDITO")
    max_id, rows, saltados = last_id, [], 0
    for (iid, idnc, idprod, cant, precv, subt, costo, g10, g5, ex) in legacy_rows:
        max_id = max(max_id, iid)
        if idnc not in notas_validas:
            saltados += 1
            continue
        cod = txt_keep(idprod, 50)
        pid = uuid.uuid5(NS, f"prod:{cod}") if cod else PLACEHOLDER_PROD_ID
        tasa = iva_tasa(g10, g5, ex)
        total = -abs(money(subt))
        rows.append((uuid.uuid5(NS, f"item_nc:{iid}"), uuid.uuid5(NS, f"nc:{idnc}"), pid,
                     num3(cant), money(precv), 0, tasa, iva_monto_incluido(total, tasa), total,
                     money(costo)))
    n = upsert(pg, "sale_items", ["id", "sale_id", "product_id", "cantidad", "precio_unitario",
                                   "descuento_monto", "iva_tasa", "iva_monto", "total",
                                   "costo_unitario"], rows)
    log(f"  item_notacredito: {n} filas nuevas (ID {last_id} -> {max_id}{', ' + str(saltados) + ' saltadas sin nota' if saltados else ''})")
    set_watermark(pg, "item_notas", last_id=max_id)
    return max_id


def sync_compras(pg, my, sup_code_map):
    last_id, _ = get_watermark(pg, "compras")
    with my.cursor() as cur:
        cur.execute(
            "SELECT IDFACCOMPRAS, IDCODPROV, NUMFAC, FECHA, TIMBRADO FROM fac_compras "
            "WHERE IDFACCOMPRAS > %s ORDER BY IDFACCOMPRAS", (last_id,))
        legacy_rows = cur.fetchall()
    if not legacy_rows:
        log("  compras: sin filas nuevas")
        return last_id
    max_id, rows = last_id, []
    for (idfc, idprov, numfac, fecha, timbrado) in legacy_rows:
        max_id = max(max_id, idfc)
        cod = txt_keep(idprov, 20)
        sid = sup_code_map.get(cod, PLACEHOLDER_SUP_ID) if cod else PLACEHOLDER_SUP_ID
        obs = f"FACT={txt_keep(numfac) or ''} TIMB={txt_keep(timbrado) or ''}".strip()
        rows.append((uuid.uuid5(NS, f"comp:{idfc}"), COMPANY_ID, sid, f"C{idfc}"[:20],
                     safe_dt(fecha) or datetime.now(), "recibido", "PYG", obs[:500]))
    n = upsert(pg, "purchase_orders", ["id", "company_id", "supplier_id", "numero", "fecha",
                                        "estado", "moneda", "observaciones"], rows)
    log(f"  compras: {n} filas nuevas (IDFACCOMPRAS {last_id} -> {max_id})")
    set_watermark(pg, "compras", last_id=max_id)
    return max_id


def sync_items_compras(pg, my):
    last_id, _ = get_watermark(pg, "item_compras")
    with my.cursor() as cur:
        cur.execute(
            "SELECT IDITEMCOMPRAS, IDFACCOMPRAS, IDPRODUCTO, CANTIDAD, PPRECIOCOSTO, SUBTOTAL, "
            "GRAV10, GRAV5, EXENTAS FROM item_compras WHERE IDITEMCOMPRAS > %s "
            "ORDER BY IDITEMCOMPRAS", (last_id,))
        legacy_rows = cur.fetchall()
    if not legacy_rows:
        log("  item_compras: sin filas nuevas")
        return last_id
    compras_validas = legacy_id_set(my, "fac_compras", "IDFACCOMPRAS")
    max_id, rows, saltados = last_id, [], 0
    for (iid, idfc, idprod, cant, pcosto, subt, g10, g5, ex) in legacy_rows:
        max_id = max(max_id, iid)
        if idfc not in compras_validas:
            saltados += 1
            continue
        cod = txt_keep(idprod, 50)
        pid = uuid.uuid5(NS, f"prod:{cod}") if cod else PLACEHOLDER_PROD_ID
        tasa = iva_tasa(g10, g5, ex)
        rows.append((uuid.uuid5(NS, f"item_comp:{iid}"), uuid.uuid5(NS, f"comp:{idfc}"), pid,
                     num3(cant), money(pcosto), tasa, money(subt)))
    n = upsert(pg, "purchase_order_items", ["id", "purchase_order_id", "product_id", "cantidad",
                                             "precio_unitario", "iva_tasa", "total"], rows)
    log(f"  item_compras: {n} filas nuevas (ID {last_id} -> {max_id}{', ' + str(saltados) + ' saltadas sin compra' if saltados else ''})")
    set_watermark(pg, "item_compras", last_id=max_id)
    return max_id


# ----------------------------------------------------------------------------
# ctas_a_cobrar -> sin columna de auditoría, se recalcula el agregado completo
# ----------------------------------------------------------------------------
def sync_cuentas(pg, my):
    with my.cursor() as cur:
        cur.execute("SELECT IDCLIENTES, MONTO, COBRO, CANCELADO FROM ctas_a_cobrar")
        legacy_rows = cur.fetchall()
    saldos = {}
    for (idcli, monto, cobro, cancelado) in legacy_rows:
        idc = txt_keep(idcli, 15)
        if not idc or cancelado:
            continue
        pend = money(monto) - money(cobro)
        if pend:
            saldos[idc] = saldos.get(idc, 0) + pend
    rows = [(uuid.uuid5(NS, f"cta:{idc}"), uuid.uuid5(NS, f"cli:{idc}"), "PYG", 0, saldo, 30, True)
            for idc, saldo in saldos.items()]
    n = upsert(pg, "customer_accounts", ["id", "customer_id", "moneda", "limite_credito",
                                          "saldo_actual", "dias_plazo", "activo"], rows)
    log(f"  cuentas por cobrar: {n} clientes con saldo (recálculo completo, {len(legacy_rows):,} filas legacy escaneadas)")


# ----------------------------------------------------------------------------
# Cuentas por cobrar/pagar A NIVEL DOCUMENTO (con vencimiento real)
#
# ctas_a_cobrar y ctas_a_pagar en el legacy tienen detalle documento a
# documento con fecha de vencimiento real (FECHA_VENCIMIENTO / FECHAVEN) —
# la migracion original solo las uso para armar el saldo agregado por
# cliente/proveedor (sync_cuentas arriba) y descarto el detalle, dejando
# accounts_receivable/supplier_invoices vacias pese a que el dato SI existe.
# Estas dos funciones migran el detalle real; el aging deja de ser "100%
# al dia" inventado y pasa a ser el vencimiento real del legacy.
# ----------------------------------------------------------------------------
def sync_ctas_a_cobrar_docs(pg, my):
    last_id, _ = get_watermark(pg, "ctas_a_cobrar_docs")
    with my.cursor() as cur:
        cur.execute(
            "SELECT IDCTA_A_COBRAR, IDCLIENTES, FECHA_VENCIMIENTO, NUMERO, MONTO, COBRO, "
            "CANCELADO, FECHA FROM ctas_a_cobrar WHERE IDCTA_A_COBRAR > %s ORDER BY IDCTA_A_COBRAR",
            (last_id,))
        legacy_rows = cur.fetchall()
    if not legacy_rows:
        log("  ctas_a_cobrar (detalle): sin filas nuevas")
        return last_id
    clientes_validos = {txt_keep(c, 15) for c in legacy_id_set(my, "clientes", "IDCLIENTES")}
    max_id, rows, saltados = last_id, [], 0
    for (iid, idcli, fechaven, numero, monto, cobro, cancelado, fecha) in legacy_rows:
        max_id = max(max_id, iid)
        idc = txt_keep(idcli, 15)
        if not idc or idc not in clientes_validos:
            saltados += 1
            continue
        m = money(monto)
        saldo = 0 if cancelado else max(0, m - money(cobro))
        fv_dt = valid_venc_date(safe_dt(fechaven))
        rows.append((uuid.uuid5(NS, f"ar:{iid}"), COMPANY_ID, uuid.uuid5(NS, f"cli:{idc}"),
                     txt_keep(str(int(numero)) if numero else None, 50),
                     safe_dt(fecha) or datetime.now(), fv_dt.date() if fv_dt else None,
                     "PYG", m, saldo, "factura", "pagado" if cancelado else "pendiente"))
    n = upsert(pg, "accounts_receivable", ["id", "company_id", "customer_id", "numero_documento",
                                            "fecha_emision", "fecha_vencimiento", "moneda",
                                            "monto_original", "saldo_pendiente", "tipo", "estado"], rows)
    log(f"  ctas_a_cobrar (detalle): {n} filas nuevas (ID {last_id} -> {max_id}"
        f"{', ' + str(saltados) + ' saltadas sin cliente' if saltados else ''})")
    set_watermark(pg, "ctas_a_cobrar_docs", last_id=max_id)
    return max_id


def sync_ctas_a_pagar_docs(pg, my):
    last_id, _ = get_watermark(pg, "ctas_a_pagar_docs")
    with my.cursor() as cur:
        cur.execute(
            "SELECT IDCTAS_A_PAGAR, IDPROVEEDOR, ID_FACCOMPRA, NUMFAC, FECHA, FECHAVEN, "
            "MONTO, PAGOS, CANCELADO FROM ctas_a_pagar WHERE IDCTAS_A_PAGAR > %s "
            "ORDER BY IDCTAS_A_PAGAR", (last_id,))
        legacy_rows = cur.fetchall()
    if not legacy_rows:
        log("  ctas_a_pagar (detalle): sin filas nuevas")
        return last_id
    proveedores_validos = {txt_keep(p, 20) for p in legacy_id_set(my, "proveedor", "IDPROVEEDOR")}
    compras_validas = legacy_id_set(my, "fac_compras", "IDFACCOMPRAS")
    max_id, rows = last_id, []
    for (iid, idprov, idfc, numfac, fecha, fechaven, monto, pagos, cancelado) in legacy_rows:
        max_id = max(max_id, iid)
        cod = txt_keep(idprov, 20)
        # Igual que sync_compras: proveedor desconocido -> placeholder, no se
        # descarta la factura (a diferencia de AR, donde una cuenta por
        # cobrar sin cliente real no aporta nada).
        sup_id = uuid.uuid5(NS, f"prov:{cod}") if cod and cod in proveedores_validos else PLACEHOLDER_SUP_ID
        m = money(monto)
        saldo = 0 if cancelado else max(0, m - money(pagos))
        fv_dt = valid_venc_date(safe_dt(fechaven))
        po_id = uuid.uuid5(NS, f"comp:{idfc}") if idfc and idfc in compras_validas else None
        rows.append((uuid.uuid5(NS, f"ap:{iid}"), COMPANY_ID, sup_id,
                     txt_keep(numfac, 50) or f"SD-{iid}",
                     (safe_dt(fecha) or datetime.now()).date(),
                     fv_dt.date() if fv_dt else (safe_dt(fecha) or datetime.now()).date(),
                     m, saldo, "PYG", po_id, "pagada" if cancelado else "pendiente"))
    n = upsert(pg, "supplier_invoices", ["id", "company_id", "supplier_id", "numero_factura",
                                          "fecha_emision", "fecha_vencimiento", "total",
                                          "saldo_pendiente", "moneda", "purchase_order_id", "estado"], rows)
    log(f"  ctas_a_pagar (detalle): {n} filas nuevas (ID {last_id} -> {max_id})")
    set_watermark(pg, "ctas_a_pagar_docs", last_id=max_id)
    return max_id


# ----------------------------------------------------------------------------
# Historial de pagos/cobros reales (recibo por recibo)
#
# cobros y pagos son el detalle transaccion a transaccion (con numero de
# recibo/comprobante) de lo efectivamente cobrado/pagado contra cada
# documento de ctas_a_cobrar/ctas_a_pagar. El saldo agregado ya es correcto
# desde el MONTO-COBRO/MONTO-PAGOS de esas tablas (sync_ctas_a_*_docs) —
# esto agrega el detalle de auditoria (quien pago que, cuando, con que
# comprobante), que antes no existia en Intelimarket para nada.
# ----------------------------------------------------------------------------
def sync_cobros(pg, my):
    last_id, _ = get_watermark(pg, "cobros")
    with my.cursor() as cur:
        cur.execute(
            "SELECT IDCOBROS, IDCTAACOBRAR, MONTO, FECHA, RECIBO FROM cobros "
            "WHERE IDCOBROS > %s ORDER BY IDCOBROS", (last_id,))
        legacy_rows = cur.fetchall()
    if not legacy_rows:
        log("  cobros: sin filas nuevas")
        return last_id
    # Contra Postgres, no contra el legacy: algunas filas de ctas_a_cobrar se
    # saltean al migrar (cliente huerfano) y esos cobros quedarian con un
    # receivable_id que no existe -> FK violation.
    ar_pg_ids = pg_id_set(pg, "accounts_receivable")
    max_id, rows, saltados = last_id, [], 0
    for (iid, idcta, monto, fecha, recibo) in legacy_rows:
        max_id = max(max_id, iid)
        ar_id = uuid.uuid5(NS, f"ar:{idcta}") if idcta else None
        if not ar_id or ar_id not in ar_pg_ids:
            saltados += 1
            continue
        rows.append((uuid.uuid5(NS, f"cobro:{iid}"), ar_id, "efectivo",
                     money(monto), "PYG", (safe_dt(fecha) or datetime.now()).date(),
                     txt_keep(recibo, 100)))
    n = upsert(pg, "accounts_receivable_payments", ["id", "receivable_id", "payment_method",
                                                      "monto", "moneda", "fecha_pago", "referencia"], rows)
    log(f"  cobros: {n} filas nuevas (ID {last_id} -> {max_id}"
        f"{', ' + str(saltados) + ' saltadas sin cuenta' if saltados else ''})")
    set_watermark(pg, "cobros", last_id=max_id)
    return max_id


def sync_pagos(pg, my):
    last_id, _ = get_watermark(pg, "pagos")
    with my.cursor() as cur:
        cur.execute(
            "SELECT IDPAGOS, IDCTAPAGAR, MONTO, FECHA, COMPROBANTE FROM pagos "
            "WHERE IDPAGOS > %s ORDER BY IDPAGOS", (last_id,))
        legacy_rows = cur.fetchall()
    if not legacy_rows:
        log("  pagos: sin filas nuevas")
        return last_id
    ap_pg_ids = pg_id_set(pg, "supplier_invoices")
    max_id, rows, saltados = last_id, [], 0
    for (iid, idcta, monto, fecha, comprobante) in legacy_rows:
        max_id = max(max_id, iid)
        ap_id = uuid.uuid5(NS, f"ap:{idcta}") if idcta else None
        if not ap_id or ap_id not in ap_pg_ids:
            saltados += 1
            continue
        rows.append((uuid.uuid5(NS, f"pago:{iid}"), ap_id, "efectivo",
                     money(monto), "PYG", (safe_dt(fecha) or datetime.now()).date(),
                     txt_keep(comprobante, 100), "confirmado"))
    n = upsert(pg, "supplier_invoice_payments", ["id", "invoice_id", "payment_method",
                                                   "monto", "moneda", "fecha_pago", "referencia", "estado"], rows)
    log(f"  pagos: {n} filas nuevas (ID {last_id} -> {max_id}"
        f"{', ' + str(saltados) + ' saltadas sin cuenta' if saltados else ''})")
    set_watermark(pg, "pagos", last_id=max_id)
    return max_id


# ----------------------------------------------------------------------------
# Liquidacion de caja por cobrador/ruta (NO es un cierre de POS)
#
# "cajas" en el legacy es una liquidacion diaria por cobrador/vendedor de
# ruta (907 cobradores distintos en la historia), no una caja registradora
# fisica con un usuario logueado. No entra en el modelo actual de
# cash_registers/cash_sessions de Intelimarket (pensado para POS, user_id
# obligatorio contra la tabla users real, que solo tiene el admin) — por
# eso tabla propia en vez de forzar el modelo existente. cajaautoriza trae
# el desglose del cierre (efectivo, anticipo, descuentos, etc.) por IDCAJA;
# si hay mas de una autorizacion para el mismo IDCAJA se toma la ultima.
# ----------------------------------------------------------------------------
def sync_cajas(pg, my):
    last_id, _ = get_watermark(pg, "cajas")
    with my.cursor() as cur:
        cur.execute(
            "SELECT IDCAJA, IDFUNCIONARIO, IDCOBRADOR, FECHA, CIERE, FECCIERE, "
            "ARENDIR, OBSERVACION, SNRO, USRCIERRE FROM cajas "
            "WHERE IDCAJA > %s ORDER BY IDCAJA", (last_id,))
        legacy_rows = cur.fetchall()
    if not legacy_rows:
        log("  cajas: sin filas nuevas")
        return last_id

    # Fetch completo de cajaautoriza (solo ~80K filas, barato) en vez de un
    # WHERE IDCAJA IN (...) con hasta 262K IDs en la primera corrida.
    autoriza_by_caja = {}
    with my.cursor() as cur:
        cur.execute(
            "SELECT ID, TOTAL, ANTICIPO, DESCUENTOS, OTROEGRESO, OTROINGRESO, "
            "PAGARES, EFECTIVO, USUARIO, IDCAJA FROM cajaautoriza ORDER BY ID"
        )
        for (aid, total, anticipo, descuentos, otroegreso, otroingreso,
             pagares, efectivo, usuario, idcaja) in cur.fetchall():
            autoriza_by_caja[idcaja] = (total, anticipo, descuentos, otroegreso,
                                         otroingreso, pagares, efectivo, usuario)

    max_id, rows = last_id, []
    for (idcaja, idfunc, idcobr, fecha, ciere, feccierre, arendir, obs, snro, usrcierre) in legacy_rows:
        max_id = max(max_id, idcaja)
        a = autoriza_by_caja.get(idcaja)
        total, anticipo, descuentos, otroegreso, otroingreso, pagares, efectivo, usr_autoriza = (
            a if a else (0, 0, 0, 0, 0, 0, 0, None))
        fc = safe_dt(feccierre)
        rows.append((
            uuid.uuid5(NS, f"caja:{idcaja}"), COMPANY_ID, txt_keep(snro, 20),
            txt_keep(idcobr, 20) or "SD", txt_keep(idfunc, 20),
            (safe_dt(fecha) or datetime.now()).date(), fc.date() if fc else None,
            bool(ciere), money(arendir), money(total), money(efectivo),
            money(anticipo), money(descuentos), money(otroegreso), money(otroingreso),
            money(pagares), txt(obs), txt_keep(usrcierre, 50) or txt_keep(usr_autoriza, 50),
        ))
    n = upsert(pg, "route_cash_settlements", [
        "id", "company_id", "codigo_legacy", "cobrador_codigo", "funcionario_codigo",
        "fecha", "fecha_cierre", "cerrado", "a_rendir", "total", "efectivo",
        "anticipo", "descuentos", "otro_egreso", "otro_ingreso", "pagares",
        "observaciones", "usuario_cierre",
    ], rows)
    log(f"  cajas: {n} filas nuevas (ID {last_id} -> {max_id})")
    set_watermark(pg, "cajas", last_id=max_id)
    return max_id


# ----------------------------------------------------------------------------
# Rutas de venta/reparto (rutas + zparruta + iten_rutas)
#
# rutas = definicion de ruta (zona, dias de la semana que corre). zparruta
# = que cliente pertenece a que ruta (CODICLIE + RUTA, donde RUTA se junta
# contra rutas.ID — NO el autoincrement IDRUTA). iten_rutas da el orden de
# visita planificado por ruta+cliente. sales_routes.user_id se relajo a
# NULL-able (ver migracion de schema) porque IDFUNCIONARIO no es un
# usuario real de la app — se guarda como texto en funcionario_codigo.
# ----------------------------------------------------------------------------
DIAS_BITMASK = [(1, 1), (2, 2), (4, 3), (8, 4), (16, 5), (32, 6), (64, 7)]


def decode_dias_semana(dias):
    if not dias:
        return []
    dias = int(dias)
    return [iso for bit, iso in DIAS_BITMASK if dias & bit]


def sync_rutas(pg, my):
    with my.cursor() as cur:
        cur.execute("SELECT ID, IDFUNCIONARIO, DIAS, DESCRIPCION, ZONA, IDRUTA FROM rutas WHERE ID > 0")
        legacy_rows = cur.fetchall()
    rows = []
    for (rid, idfunc, dias, descr, zona, idruta) in legacy_rows:
        rows.append((
            uuid.uuid5(NS, f"ruta:{rid}"), COMPANY_ID, (txt(descr) or f"Ruta {rid}")[:100],
            str(rid)[:20], txt_keep(idfunc, 20), json.dumps(decode_dias_semana(dias)),
            txt_keep(zona, 100), "activo",
        ))
    n = upsert(pg, "sales_routes", ["id", "company_id", "nombre", "codigo_legacy",
                                     "funcionario_codigo", "dias_semana", "zona", "estado"], rows)
    log(f"  rutas: {n} filas (resync completo, {len(legacy_rows)} en el legacy)")
    return {r[0] for r in legacy_rows}  # set de ID de ruta legacy validos


def sync_zparruta(pg, my, rutas_validas):
    clientes_validos = {txt_keep(c, 15) for c in legacy_id_set(my, "clientes", "IDCLIENTES")}
    with my.cursor() as cur:
        cur.execute("SELECT CODICLIE, RUTA FROM zparruta WHERE RUTA > 0")
        legacy_rows = cur.fetchall()
    orden_by_key = {}
    with my.cursor() as cur:
        cur.execute("SELECT IDRUTA, IDCLIENTE, ORDEN FROM iten_rutas")
        for (idruta, idcli, orden) in cur.fetchall():
            orden_by_key[(idruta, txt_keep(idcli, 15))] = orden

    rows, saltados = [], 0
    for (codiclie, ruta) in legacy_rows:
        cli = txt_keep(codiclie, 15)
        if not cli or cli not in clientes_validos or ruta not in rutas_validas:
            saltados += 1
            continue
        orden = orden_by_key.get((ruta, cli), 0)
        rows.append((
            uuid.uuid5(NS, f"rutacli:{ruta}:{cli}"), uuid.uuid5(NS, f"ruta:{ruta}"),
            uuid.uuid5(NS, f"cli:{cli}"), orden or 0,
        ))
    n = upsert(pg, "route_customers", ["id", "route_id", "customer_id", "orden_visita"], rows)
    log(f"  zparruta (clientes x ruta): {n} filas (resync completo"
        f"{', ' + str(saltados) + ' saltadas sin ruta/cliente valido' if saltados else ''})")


# ----------------------------------------------------------------------------
# Viajes de camion (rescamion) — historial de reparto, SIN enlace a clientes
# especificos (el legacy no lo registra a ese nivel, no se inventa).
# ----------------------------------------------------------------------------
def sync_rescamion(pg, my):
    last_id, _ = get_watermark(pg, "rescamion")
    with my.cursor() as cur:
        cur.execute(
            "SELECT Id_RESCAMION, IDCAMION, IDCHOFER, IDADJUDANTE, KILOMSALIDA, "
            "KILOMLLEGADA, FECHA FROM rescamion WHERE Id_RESCAMION > %s ORDER BY Id_RESCAMION",
            (last_id,))
        legacy_rows = cur.fetchall()
    if not legacy_rows:
        log("  rescamion: sin filas nuevas")
        return last_id

    camiones = {}
    with my.cursor() as cur:
        cur.execute("SELECT IDCAMIONES, MARCA, MODELO, CHAPA FROM camiones")
        for (cid, marca, modelo, chapa) in cur.fetchall():
            camiones[cid] = txt_keep(chapa, 20) or f"{txt(marca) or ''} {txt(modelo) or ''}".strip() or None
    choferes = {}
    with my.cursor() as cur:
        cur.execute("SELECT IDFUNCIONARIO, NOMBRE, APELLIDO FROM funcionarios")
        for (idf, nom, ape) in cur.fetchall():
            nombre = " ".join(p for p in (txt(nom), txt(ape)) if p)
            if nombre:
                choferes[txt_keep(idf, 10)] = nombre

    max_id, rows = last_id, []
    for (iid, idcamion, idchofer, idadjud, kmsal, kmlleg, fecha) in legacy_rows:
        max_id = max(max_id, iid)
        placa = camiones.get(idcamion)
        chofer_nombre = choferes.get(txt_keep(idchofer, 10))
        ayudante_nombre = choferes.get(txt_keep(idadjud, 10))
        km_txt = f"Km {kmsal}-{kmlleg}" if kmsal or kmlleg else None
        descr = " | ".join(p for p in (
            f"Ayudante: {ayudante_nombre}" if ayudante_nombre else None, km_txt,
        ) if p)
        fc = safe_dt(fecha) or datetime.now()
        rows.append((
            uuid.uuid5(NS, f"viaje:{iid}"), COMPANY_ID,
            f"Viaje {placa or idcamion or ''} {fc.date().isoformat()}"[:200],
            (txt(descr) or None), chofer_nombre, placa, fc, "completado" if kmlleg else "programado",
        ))
    n = upsert(pg, "routes", ["id", "company_id", "nombre", "descripcion", "driver_name",
                               "vehicle_plate", "fecha", "estado"], rows)
    log(f"  rescamion (viajes de camion): {n} filas nuevas (ID {last_id} -> {max_id})")
    set_watermark(pg, "rescamion", last_id=max_id)
    return max_id


# ----------------------------------------------------------------------------
# Contabilidad real (plan de cuentas + libro diario de partida doble)
#
# Confirmado con datos reales: plan_de_cuentas es un plan de cuentas de
# verdad (Activo/Pasivo/Patrimonio/Ingreso/Egreso con rubros/subrubros), y
# assiento/assiento1/assientohist son asientos contables reales (campo DH
# = Debe/Haber) generados automaticamente por cada venta/compra, con Debe
# = Haber. Vivo desde 2007 hasta hoy. SOLO se migran los datos crudos por
# ahora (sin pantallas/reportes todavia — eso es una decision aparte,
# dado el volumen ~3.26M lineas y que es un modulo nuevo, no una pantalla
# existente esperando datos).
#
# assiento/assiento1/assientohist tienen rangos de IDASIENTO solapados
# (parecen tablas rotativas/de respaldo del legacy, no particiones
# limpias) — se sincronizan las 3 por separado con upsert keyed por
# IDASIENTO (uuid5 determinista), que deduplica solo sin necesidad de
# entender la relacion exacta entre las 3.
# ----------------------------------------------------------------------------
def sync_plan_de_cuentas(pg, my):
    with my.cursor() as cur:
        cur.execute(
            "SELECT CODICUENT, CATEGORIA, TIPO, SECTOR, RUBROS, SUBRUBROS, INACTIVO "
            "FROM plan_de_cuentas"
        )
        legacy_rows = cur.fetchall()
    rows = []
    for (cod, categoria, tipo, sector, rubros, subrubros, inactivo) in legacy_rows:
        rows.append((
            uuid.uuid5(NS, f"cuenta:{cod}"), COMPANY_ID, str(cod),
            txt(categoria), txt(tipo), txt(sector), txt(rubros), txt(subrubros),
            not bool(inactivo),
        ))
    n = upsert(pg, "general_ledger_accounts", ["id", "company_id", "codigo_legacy",
                                                 "categoria", "tipo", "sector", "rubro",
                                                 "subrubro", "activo"], rows)
    log(f"  plan_de_cuentas: {n} filas (resync completo)")
    return {str(cod) for (cod, *_r) in legacy_rows}


def _sync_asiento_table(pg, my, table, cuentas_validas):
    watermark_key = table  # "assiento" | "assiento1" | "assientohist"
    last_id, _ = get_watermark(pg, watermark_key)
    with my.cursor() as cur:
        cur.execute(
            f"SELECT IDASIENTO, IDCODICUENT, NUMERDOC, FECHA, CONCEPTO, MONTO, DH "
            f"FROM {table} WHERE IDASIENTO > %s ORDER BY IDASIENTO", (last_id,))
        legacy_rows = cur.fetchall()
    if not legacy_rows:
        log(f"  {table}: sin filas nuevas")
        return last_id
    max_id, rows = last_id, []
    for (iid, idcuenta, numerdoc, fecha, concepto, monto, dh) in legacy_rows:
        max_id = max(max_id, iid)
        fc = safe_dt(fecha)
        if not fc:
            continue
        cod = str(idcuenta) if idcuenta else None
        account_id = uuid.uuid5(NS, f"cuenta:{cod}") if cod and cod in cuentas_validas else None
        rows.append((
            uuid.uuid5(NS, f"asiento:{iid}"), COMPANY_ID, account_id,
            txt_keep(numerdoc, 20), fc.date(), txt(concepto), money(monto),
            "debe" if dh == 0 else "haber", table,
        ))
    n = upsert(pg, "general_ledger_entries", ["id", "company_id", "account_id",
                                               "numero_documento", "fecha", "concepto",
                                               "monto", "tipo", "origen_legacy"], rows)
    log(f"  {table}: {n} filas nuevas (ID {last_id} -> {max_id})")
    set_watermark(pg, watermark_key, last_id=max_id)
    return max_id


def sync_asientos(pg, my):
    cuentas_validas = {txt_keep(c, 20) for c in legacy_id_set(my, "plan_de_cuentas", "CODICUENT")}
    for table in ("assientohist", "assiento", "assiento1"):
        _sync_asiento_table(pg, my, table, cuentas_validas)


# ----------------------------------------------------------------------------
# Detalle de movimientos de efectivo por caja (efectivo)
#
# route_cash_settlements.efectivo ya tiene el TOTAL correcto (via
# cajaautoriza). Esto es el detalle linea por linea detras de ese total —
# pedido explicito del usuario junto con vpedidos.
# ----------------------------------------------------------------------------
def sync_efectivo(pg, my):
    last_id, _ = get_watermark(pg, "efectivo")
    with my.cursor() as cur:
        cur.execute(
            "SELECT ID, IDCAJA, FECHA, MONTO, OBS, RECIBO, MONEDA FROM efectivo "
            "WHERE ID > %s ORDER BY ID", (last_id,))
        legacy_rows = cur.fetchall()
    if not legacy_rows:
        log("  efectivo: sin filas nuevas")
        return last_id
    cajas_pg_ids = pg_id_set(pg, "route_cash_settlements")
    max_id, rows, saltados = last_id, [], 0
    for (iid, idcaja, fecha, monto, obs, recibo, moneda) in legacy_rows:
        max_id = max(max_id, iid)
        caja_id = uuid.uuid5(NS, f"caja:{idcaja}") if idcaja else None
        if not caja_id or caja_id not in cajas_pg_ids:
            saltados += 1
            continue
        fc = safe_dt(fecha)
        if not fc:
            continue
        rows.append((
            uuid.uuid5(NS, f"efectivo:{iid}"), caja_id, fc.date(), money(monto),
            txt_keep(obs, 200), txt_keep(recibo, 20), txt_keep(moneda, 20),
        ))
    n = upsert(pg, "route_cash_settlement_movements", ["id", "settlement_id", "fecha",
                                                          "monto", "observaciones", "recibo", "moneda"], rows)
    log(f"  efectivo: {n} filas nuevas (ID {last_id} -> {max_id}"
        f"{', ' + str(saltados) + ' saltadas sin caja valida' if saltados else ''})")
    set_watermark(pg, "efectivo", last_id=max_id)
    return max_id


# ----------------------------------------------------------------------------
# Pedidos tomados por vendedores de ruta (vpedidos)
#
# App movil de toma de pedidos: cada linea es un item pedido por un
# vendedor a un cliente, con GPS y hora. Live hasta hoy (9,96M filas).
# ~34% de las filas son solo "marca de visita" sin producto (CODIPROD=-1,
# CAN=0) — se excluyen, no son pedidos. El resto (~6,59M lineas) se
# agrupa por cliente+vendedor+fecha en un pedido (no hay un ID de pedido
# explicito en el legacy a ese nivel — cada fila es una linea suelta).
# vendedor_id queda NULL (CODIFUNC no es un usuario real de la app, igual
# que en el resto de esta migracion) — el codigo se guarda en
# observaciones. Los totales de cada pedido se recalculan al final desde
# sus items, para que corridas incrementales que agregan mas lineas al
# mismo pedido (mismo cliente+vendedor+dia, otra hora del dia) no dejen
# el total desactualizado.
# ----------------------------------------------------------------------------
def sync_pedidos(pg, my):
    last_id, _ = get_watermark(pg, "pedidos")
    with my.cursor() as cur:
        cur.execute(
            "SELECT ID, CODICLIE, CODIFUNC, FECHA, CODIPROD, CAN, PRECIO, SUBTOTAL, "
            "DES, RUTA FROM vpedidos WHERE ID > %s AND CODIPROD != '-1' AND CAN > 0 "
            "ORDER BY ID", (last_id,))
        legacy_rows = cur.fetchall()
    if not legacy_rows:
        log("  vpedidos: sin filas nuevas")
        return last_id

    clientes_validos = {txt_keep(c, 15) for c in legacy_id_set(my, "clientes", "IDCLIENTES")}
    productos_validos = {txt_keep(c, 50) for c in legacy_id_set(my, "productos", "CODIGO")}

    max_id = last_id
    orders: dict[tuple, dict] = {}
    item_rows, saltados_cli, saltados_prod = [], 0, 0

    for (iid, codiclie, codifunc, fecha, codiprod, can, precio, subtotal, des, ruta) in legacy_rows:
        max_id = max(max_id, iid)
        cli = txt_keep(codiclie, 15)
        if not cli or cli not in clientes_validos:
            saltados_cli += 1
            continue
        prod = txt_keep(codiprod, 50)
        if not prod or prod not in productos_validos:
            saltados_prod += 1
            continue
        fc = safe_dt(fecha)
        if not fc:
            continue
        fecha_key = fc.date().isoformat()
        func = txt_keep(codifunc, 10) or "SD"
        key = (cli, func, fecha_key)
        order_id = uuid.uuid5(NS, f"pedido:{cli}:{func}:{fecha_key}")
        if key not in orders:
            orders[key] = {
                "order_id": order_id, "customer_id": uuid.uuid5(NS, f"cli:{cli}"),
                "fecha": fc, "vendedor_codigo": func, "ruta": ruta,
            }
        pid = uuid.uuid5(NS, f"prod:{prod}")
        total_linea = money(subtotal)
        item_rows.append((
            uuid.uuid5(NS, f"pedido_item:{iid}"), order_id, pid, num3(can),
            money(precio), Decimal(str(des)) if des else Decimal("0"), total_linea,
        ))

    order_rows = []
    for (cli, func, fecha_key), o in orders.items():
        order_rows.append((
            o["order_id"], COMPANY_ID, o["customer_id"],
            f"P{str(o['order_id']).replace('-', '')[:15]}", o["fecha"], "completado",
            "contado", f"Vendedor legacy: {o['vendedor_codigo']}" +
            (f" | Ruta: {o['ruta']}" if o["ruta"] else ""),
        ))
    upsert(pg, "sales_orders", ["id", "company_id", "customer_id", "numero", "fecha",
                                 "estado", "condicion", "observaciones"], order_rows,
           update_cols=["customer_id", "fecha", "observaciones"])
    upsert(pg, "sales_order_items", ["id", "order_id", "product_id", "cantidad",
                                      "precio_unitario", "descuento_pct", "total"], item_rows)

    if not DRY_RUN and order_rows:
        with pg.cursor() as cur:
            order_ids = [o[0] for o in order_rows]
            cur.execute(
                "UPDATE sales_orders so SET "
                "subtotal = agg.total, total = agg.total "
                "FROM (SELECT order_id, COALESCE(SUM(total), 0) as total "
                "      FROM sales_order_items WHERE order_id = ANY(%s) GROUP BY order_id) agg "
                "WHERE so.id = agg.order_id",
                (order_ids,),
            )
        pg.commit()

    log(f"  vpedidos: {len(order_rows)} pedidos ({len(item_rows)} lineas) "
        f"(ID {last_id} -> {max_id}, {saltados_cli} sin cliente valido, {saltados_prod} sin producto valido)")
    set_watermark(pg, "pedidos", last_id=max_id)
    return max_id


def sync_limite_credito(pg, my):
    """limite_de_credito en el legacy tiene varias filas por cliente (una por
    IDDIVISION: 1-5), pero solo IDDIVISION=4 es el limite de credito real en
    uso — confirmado leyendo Deudas/Index.asp del codigo fuente legacy, que
    arma la pantalla de deudas filtrando exactamente por esa division. Las
    demas divisiones dan siempre 0/vacio en los datos reales, no se usan.

    Escribe a las 3 tablas de limite de credito que hoy existen en Intelimarket
    (credit_accounts, customer_accounts.limite_credito, customer_credit_limits)
    — quedaron asi por evolucion del codigo en distintos momentos, no por
    diseño; mismo patron que accounts_receivable vs customer_accounts. El
    limite viene del legacy; saldo_utilizado se calcula desde el AR real ya
    migrado (accounts_receivable si tiene filas pendientes, si no
    customer_accounts.saldo_actual), no del PROMEDIO del legacy (que es un
    promedio historico viejo, no el saldo vivo)."""
    last_id, _ = get_watermark(pg, "limite_credito")
    with my.cursor() as cur:
        cur.execute(
            "SELECT IDLIMITE, IDCLIENTE, LIMITE_CREDITO, PLAZO FROM limite_de_credito "
            "WHERE IDDIVISION = 4 AND IDLIMITE > %s ORDER BY IDLIMITE", (last_id,))
        legacy_rows = cur.fetchall()
    if not legacy_rows:
        log("  limite_de_credito: sin filas nuevas")
        return last_id

    clientes_validos = {txt_keep(c, 15) for c in legacy_id_set(my, "clientes", "IDCLIENTES")}
    max_id, por_cliente, saltados = last_id, {}, 0
    for (iid, idcli, limite, plazo) in legacy_rows:
        max_id = max(max_id, iid)
        idc = txt_keep(idcli, 15)
        if not idc or idc not in clientes_validos:
            saltados += 1
            continue
        # Filas en orden ascendente de IDLIMITE -> la ultima por cliente pisa
        # a las anteriores (mismo patron "last write wins" que sales_orders).
        por_cliente[idc] = (money(limite), int(plazo) if plazo else 0)

    ca_rows = [(uuid.uuid5(NS, f"credit:{idc}"), COMPANY_ID, uuid.uuid5(NS, f"cli:{idc}"),
                lim, lim, 0, True) for idc, (lim, _plazo) in por_cliente.items()]
    upsert(pg, "credit_accounts",
           ["id", "company_id", "customer_id", "limite_credito", "saldo_disponible",
            "saldo_utilizado", "activo"], ca_rows,
           update_cols=["limite_credito", "activo"])

    ccl_rows = [(uuid.uuid5(NS, f"ccl:{idc}"), COMPANY_ID, uuid.uuid5(NS, f"cli:{idc}"),
                 lim, lim, 0, plazo) for idc, (lim, plazo) in por_cliente.items()]
    upsert(pg, "customer_credit_limits",
           ["id", "company_id", "customer_id", "limite_credito", "limite_disponible",
            "saldo_utilizado", "dias_credito"], ccl_rows,
           update_cols=["limite_credito", "limite_disponible", "dias_credito"])

    cust_ids = [str(uuid.uuid5(NS, f"cli:{idc}")) for idc in por_cliente]
    if not DRY_RUN and cust_ids:
        with pg.cursor() as cur:
            cur.execute(
                "UPDATE customer_accounts ca SET limite_credito = lc.limite_credito "
                "FROM credit_accounts lc WHERE lc.customer_id = ca.customer_id "
                "AND ca.customer_id = ANY(%s::uuid[])", (cust_ids,),
            )
            # customers.credito_limite (el campo que lee el listado de
            # clientes del frontend) nunca se sincronizaba desde aca —
            # quedaba con basura vieja de la migracion original (un "1"
            # literal en vez del monto real). Encontrado por el usuario:
            # "en el listado de clientes no veo sus limites de credito".
            cur.execute(
                "UPDATE customers c SET credito_limite = lc.limite_credito "
                "FROM credit_accounts lc WHERE lc.customer_id = c.id "
                "AND lc.limite_credito > 0 AND c.id = ANY(%s::uuid[])", (cust_ids,),
            )
            # saldo_utilizado/disponible en las tablas nuevas: AR real si tiene
            # pendiente, si no el agregado de customer_accounts — mismo criterio
            # CASE/EXISTS ya usado en financial/service.py para no duplicar.
            for tbl in ("credit_accounts", "customer_credit_limits"):
                cur.execute(f"""
                    UPDATE {tbl} t SET
                      saldo_utilizado = COALESCE(CASE
                        WHEN EXISTS (SELECT 1 FROM accounts_receivable ar
                                     WHERE ar.customer_id = t.customer_id AND ar.estado = 'pendiente')
                        THEN (SELECT SUM(ar.saldo_pendiente) FROM accounts_receivable ar
                              WHERE ar.customer_id = t.customer_id AND ar.estado = 'pendiente')
                        ELSE (SELECT ca.saldo_actual FROM customer_accounts ca
                              WHERE ca.customer_id = t.customer_id)
                      END, 0)
                    WHERE t.company_id = %s AND t.customer_id = ANY(%s::uuid[])
                """, (str(COMPANY_ID), cust_ids))
                disp_col = "limite_disponible" if tbl == "customer_credit_limits" else "saldo_disponible"
                cur.execute(f"""
                    UPDATE {tbl} SET {disp_col} = GREATEST(limite_credito - saldo_utilizado, 0)
                    WHERE company_id = %s AND customer_id = ANY(%s::uuid[])
                """, (str(COMPANY_ID), cust_ids))
        pg.commit()

    log(f"  limite_de_credito: {len(por_cliente)} clientes con limite real "
        f"(ID {last_id} -> {max_id}, {saltados} sin cliente valido)")
    set_watermark(pg, "limite_credito", last_id=max_id)
    return max_id


# ----------------------------------------------------------------------------
# Post-proceso: recalcular IVA solo de las ventas/notas/compras tocadas esta corrida
# ----------------------------------------------------------------------------
def recalcular_iva(pg, sale_ids, purchase_ids):
    if not sale_ids and not purchase_ids:
        return
    if DRY_RUN:
        log("  [dry-run] saltando recálculo de IVA")
        return
    with pg.cursor() as cur:
        if sale_ids:
            ids = [uuid.uuid5(NS, f"fac:{i}") for i in sale_ids] + \
                  [uuid.uuid5(NS, f"nc:{i}") for i in sale_ids]
            cur.execute("""
                WITH a AS (
                  SELECT sale_id,
                    SUM(CASE WHEN iva_tasa=10 THEN total ELSE 0 END) t10,
                    SUM(CASE WHEN iva_tasa=10 THEN iva_monto ELSE 0 END) i10,
                    SUM(CASE WHEN iva_tasa=5  THEN total ELSE 0 END) t5,
                    SUM(CASE WHEN iva_tasa=5  THEN iva_monto ELSE 0 END) i5,
                    SUM(CASE WHEN iva_tasa=0  THEN total ELSE 0 END) tex
                  FROM sale_items WHERE sale_id = ANY(%s) GROUP BY sale_id)
                UPDATE sales s SET
                  base_gravada_10 = a.t10 - a.i10, iva_10 = a.i10,
                  base_gravada_5  = a.t5  - a.i5,  iva_5  = a.i5,
                  base_exenta     = a.tex
                FROM a WHERE s.id = a.sale_id
            """, (ids,))
        if purchase_ids:
            ids = [uuid.uuid5(NS, f"comp:{i}") for i in purchase_ids]
            cur.execute("""
                WITH a AS (
                  SELECT purchase_order_id,
                    SUM(total) tot,
                    SUM(CASE WHEN iva_tasa=10 THEN round(total*10/110.0) ELSE 0 END) i10,
                    SUM(CASE WHEN iva_tasa=5  THEN round(total*5/105.0)  ELSE 0 END) i5
                  FROM purchase_order_items WHERE purchase_order_id = ANY(%s)
                  GROUP BY purchase_order_id)
                UPDATE purchase_orders p SET
                  subtotal = a.tot, total = a.tot, iva_10 = a.i10, iva_5 = a.i5
                FROM a WHERE p.id = a.purchase_order_id
            """, (ids,))
    pg.commit()
    log("  IVA de cabeceras recalculado")


# ----------------------------------------------------------------------------
# Main
# ----------------------------------------------------------------------------
def main():
    t0 = time.time()
    log("=" * 64)
    log(f"Sync incremental Casa Gonzalito → Intelimarket{' [DRY RUN]' if DRY_RUN else ''}")
    log(f"Legacy: {MYSQL['user']}@{MYSQL['host']}/{MYSQL['database']}")
    log("=" * 64)

    pg, my = pg_conn(), mysql_conn()
    ensure_watermark_table(pg)

    entities = {
        "categorias": lambda: sync_categorias(pg, my),
        "depositos": lambda: sync_depositos(pg, my),
        "proveedores": lambda: sync_proveedores(pg, my),
        "productos": None,   # necesita cat_map, se arma abajo
        "clientes": lambda: sync_clientes(pg, my),
        "precios": None,     # necesita codigos, se arma abajo
        "stock": None,       # necesita valid_wh, se arma abajo
        "ventas": None,      # necesita cli_ids
        "cuentas": lambda: sync_cuentas(pg, my),
        "cuentas_docs": None,  # ar + ap, se arman abajo
        "pagos_cobros": None,  # historial de pagos/cobros, se arma abajo
        "cajas": lambda: sync_cajas(pg, my),
        "rutas": None,  # rutas + zparruta, se arma abajo
        "rescamion": lambda: sync_rescamion(pg, my),
        "contabilidad": None,  # plan de cuentas + asientos, se arma abajo
        "efectivo": lambda: sync_efectivo(pg, my),
        "pedidos_ruta": lambda: sync_pedidos(pg, my),
        "limite_credito": lambda: sync_limite_credito(pg, my),
    }
    if ONLY and ONLY not in entities:
        log(f"ERROR: entidad desconocida '{ONLY}'. Opciones: {', '.join(entities)}")
        sys.exit(1)

    log("\n[1] Maestros chicos (resync completo)")
    cat_map = sync_categorias(pg, my) if not ONLY or ONLY == "categorias" else {}
    valid_wh = sync_depositos(pg, my) if not ONLY or ONLY == "depositos" else {DEFAULT_WH_ID}
    sup_map = sync_proveedores(pg, my) if not ONLY or ONLY == "proveedores" else {}

    log("\n[2] Entidades mutables (incremental por FECMOD/FECHAMODIFICADO)")
    codigos = clientes = set()
    if not ONLY or ONLY == "productos":
        codigos, _costos = sync_productos(pg, my, cat_map)
    if not ONLY or ONLY == "clientes":
        clientes = sync_clientes(pg, my)
    if not ONLY or ONLY == "precios":
        sync_precios(pg, my)
    if not ONLY or ONLY == "stock":
        sync_stock(pg, my, valid_wh)

    log("\n[3] Documentos (incremental por ID autoincrement)")
    sale_ids, purchase_ids = set(), set()
    if not ONLY or ONLY == "ventas":
        facturas, _ = sync_ventas(pg, my)
        sale_ids |= facturas
        sync_items_ventas(pg, my)
    if not ONLY or ONLY == "notas":
        notas_ids = set()
        max_id = sync_notas(pg, my)
        sync_items_notas(pg, my)
    if not ONLY or ONLY == "compras":
        sync_compras(pg, my, sup_map)
        sync_items_compras(pg, my)

    log("\n[4] Cuentas por cobrar (recálculo completo — sin columna de auditoría en legacy)")
    if not ONLY or ONLY == "cuentas":
        sync_cuentas(pg, my)

    log("\n[4b] Cuentas por cobrar/pagar a nivel documento (con vencimiento real)")
    if not ONLY or ONLY == "cuentas_docs":
        sync_ctas_a_cobrar_docs(pg, my)
        sync_ctas_a_pagar_docs(pg, my)

    log("\n[4c] Historial de pagos/cobros (detalle de recibos/comprobantes)")
    if not ONLY or ONLY == "pagos_cobros":
        sync_cobros(pg, my)
        sync_pagos(pg, my)

    log("\n[4d] Liquidacion de caja por cobrador/ruta")
    if not ONLY or ONLY == "cajas":
        sync_cajas(pg, my)

    log("\n[4e] Rutas de venta/reparto")
    if not ONLY or ONLY == "rutas":
        rutas_validas = sync_rutas(pg, my)
        sync_zparruta(pg, my, rutas_validas)
    if not ONLY or ONLY == "rescamion":
        sync_rescamion(pg, my)

    log("\n[4f] Contabilidad (plan de cuentas + libro diario)")
    if not ONLY or ONLY == "contabilidad":
        sync_plan_de_cuentas(pg, my)
        sync_asientos(pg, my)

    log("\n[4g] Efectivo por caja + pedidos de vendedores de ruta")
    if not ONLY or ONLY == "efectivo":
        sync_efectivo(pg, my)
    if not ONLY or ONLY == "pedidos_ruta":
        sync_pedidos(pg, my)

    log("\n[4h] Limite de credito por cliente")
    if not ONLY or ONLY == "limite_credito":
        sync_limite_credito(pg, my)

    log("\n[5] Post-proceso")
    recalcular_iva(pg, sale_ids, set())

    my.close()
    pg.close()
    log("=" * 64)
    log(f"✓ Sync completo en {time.time()-t0:,.1f}s")
    log("=" * 64)


if __name__ == "__main__":
    main()
