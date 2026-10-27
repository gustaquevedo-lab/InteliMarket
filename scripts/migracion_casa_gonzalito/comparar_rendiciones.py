#!/usr/bin/env python3
"""
Compara, por cobrador+dia (= una route_session de IM), el ARENDIR del legacy (suma de sus cajas)
contra el monto a rendir que calcula InteliMarket con api/src/ruta_caja/service.py (close_session ->
efectivo_esperado). SOLO LECTURA: el legacy se lee por rangos de PK/indice, y el calculo de IM corre
en una transaccion que SIEMPRE se revierte (close_session hace commit() pero va sobre un SAVEPOINT
dentro de esa transaccion externa).

Uso (en la VM, desde ~/intelimarket):
    .venv/bin/python scripts/migracion_casa_gonzalito/comparar_rendiciones.py --desde 2026-07-16 --hasta 2026-07-22 [--detalle]
Variables: MYSQL_HOST/MYSQL_USER/MYSQL_PASSWORD (como el sync; default legacy en vivo),
PG_SEARCH_PATH + DB_SEARCH_PATH (opcionales, para apuntar a un schema de prueba).
"""
import argparse
import asyncio
import sys
import uuid
from collections import Counter, defaultdict
from datetime import date, datetime, timedelta
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path[:0] = [str(HERE), str(HERE.parents[1])]

import sync_incremental as si  # noqa: E402  (helpers y mapeos del sync: _primer_idcaja, NS, etc.)
from sqlalchemy import text  # noqa: E402
from sqlalchemy.ext.asyncio import AsyncSession  # noqa: E402

from api.src.db import engine  # noqa: E402
from api.src.ruta_caja.service import close_session  # noqa: E402


def legacy_grupos(my, desde, hasta):
    lo = si._primer_idcaja(my, desde)
    hi = si._primer_idcaja(my, hasta + timedelta(days=1)) + 600
    cajas = []
    for (idc, cobr, fecha, ciere, ar) in si._rango(
            my, "SELECT IDCAJA, IDCOBRADOR, FECHA, CIERE, ARENDIR FROM cajas WHERE IDCAJA BETWEEN %s AND %s", lo, hi):
        f = si.safe_dt(fecha)
        if f and desde <= f.date() <= hasta:
            cajas.append(dict(id=idc, cobr=(si.txt(cobr) or ""), fecha=f.date(), ciere=bool(ciere), ar=si.money(ar)))
    if not cajas:
        return {}, [], {}
    lo, hi = min(c["id"] for c in cajas), max(c["id"] for c in cajas)
    facs = defaultdict(list)
    for (idf, idc) in si._rango(my, "SELECT IDFACVENTAS, ID_CAJA FROM fac_ventas WHERE ID_CAJA BETWEEN %s AND %s", lo, hi):
        facs[idc].append(idf)
    cobros = Counter()
    for (idc, m) in si._rango(my, "SELECT ID_CAJAS, MONTO FROM cobros WHERE ID_CAJAS BETWEEN %s AND %s", lo, hi):
        cobros[idc] += si.money(m)
    grupos, sin_cobr = defaultdict(list), []
    for c in cajas:
        c["facs"], c["cobros"] = facs.get(c["id"], []), cobros.get(c["id"], 0)
        if c["cobr"]:
            grupos[(c["cobr"], c["fecha"])].append(c)
        else:
            sin_cobr.append(c)
    return dict(grupos), sin_cobr, facs


def total_facturas(pg, facs_ids):
    """Total facturado de esas facturas segun IM (sales.total; ya migradas por el sync)."""
    ids = [uuid.uuid5(si.NS, f"fac:{f}") for f in facs_ids]
    tot = 0
    for ch in si._chunks(ids):
        with pg.cursor() as cur:
            cur.execute("SELECT COALESCE(SUM(total), 0) FROM sales WHERE id = ANY(%s)", (ch,))
            tot += int(cur.fetchone()[0])
    return tot


async def im_calcula(sid):
    """efectivo_esperado / total_cobrado_ar segun ruta_caja.close_session, en transaccion revertida."""
    async with engine.connect() as conn:
        trans = await conn.begin()
        try:
            db = AsyncSession(bind=conn, join_transaction_mode="create_savepoint", expire_on_commit=False)
            await db.execute(text("UPDATE route_sessions SET estado = 'abierta' WHERE id = :i"), {"i": sid})
            liq = await close_session(db, str(sid), 0, 0, 0, 0, 0, [])
            return int(liq.efectivo_esperado), int(liq.total_cobrado_ar), None
        except Exception as e:  # el error mismo es un hallazgo
            msg = str(getattr(e, "orig", e)).strip().splitlines()[0][:140]
            return None, None, f"{type(e).__name__}: {msg}"
        finally:
            await trans.rollback()


async def contar_liquidaciones():
    async with engine.connect() as conn:
        return (await conn.execute(text("SELECT count(*) FROM route_liquidations"))).scalar()


async def main_async(args):
    desde, hasta = date.fromisoformat(args.desde), date.fromisoformat(args.hasta)
    my, pg = si.mysql_conn(), si.pg_conn()
    resolve = si.make_func_resolver(pg, my)
    grupos, sin_cobr, _ = legacy_grupos(my, desde, hasta)
    print(f"Legacy {desde}..{hasta}: {sum(len(g) for g in grupos.values())} cajas con cobrador -> "
          f"{len(grupos)} cobrador-dias; {len(sin_cobr)} cargas sin cobrador (Gs. "
          f"{sum(c['ar'] for c in sin_cobr):,}, no existen en IM)")
    liq_antes = await contar_liquidaciones()
    with pg.cursor() as cur:
        cur.execute("SELECT id FROM route_sessions WHERE fecha BETWEEN %s AND %s", (desde, hasta))
        sesiones_im = {r[0] for r in cur.fetchall()}

    filas, causas = [], Counter()
    for (cobr, fecha), cs in sorted(grupos.items(), key=lambda kv: (kv[0][1], kv[0][0])):
        ar = sum(c["ar"] for c in cs)
        facturado = total_facturas(pg, [f for c in cs for f in c["facs"]])
        sid = uuid.uuid5(si.NS, f"rsesion:{cobr}:{fecha.isoformat()}")
        if sid not in sesiones_im:
            im, causa = None, "SIN_SESION_IM: la caja no esta como route_session (no sincronizada)"
        else:
            im, _tot, err = await im_calcula(sid)
            if err:
                causa = f"IM_NO_CALCULA: {err}"
            elif im == ar:
                causa = "IGUAL"
            elif ar == facturado and ar > 0:
                causa = "CONCEPTO: ARENDIR legacy = total facturado de la carga; IM = efectivo cobrado en AR"
            else:
                causa = "OTRA: diferencia sin explicar por facturado/cobros"
        causas[causa.split(":")[0]] += 1
        filas.append((fecha, cobr, [c["id"] for c in cs], ar, facturado, sum(c["cobros"] for c in cs), im, causa))

    iguales = sum(1 for f in filas if f[7] == "IGUAL")
    print(f"\nRESUMEN: {len(filas)} cobrador-dias | iguales: {iguales} | distintos: {len(filas) - iguales}")
    for k, v in causas.most_common():
        ej = next(f for f in filas if f[7].split(':')[0] == k)
        print(f"  {k}: {v}   ej: caja(s) {ej[2]} cobrador {ej[1]} {ej[0]} ARENDIR={ej[3]:,} facturado={ej[4]:,} "
              f"IM={ej[6]}  -> {ej[7]}")
    con_multi = sum(1 for f in filas if len(f[2]) > 1)
    print(f"  (nota) {con_multi} cobrador-dias reunen >1 caja legacy: IM tiene una sola sesion por cobrador+dia")
    ar0 = sum(1 for f in filas if f[3] == 0)
    print(f"  (nota) {ar0} cobrador-dias con ARENDIR=0 (cajas de cobranza/deposito, sin carga de reparto)")
    igual_fact = sum(1 for f in filas if f[3] == f[4])
    print(f"  (nota) ARENDIR legacy == total facturado de la(s) carga(s) en {igual_fact}/{len(filas)} cobrador-dias; "
          f"ruta_caja.efectivo_esperado se define como cobros de AR (receivable_payments), otro concepto")
    if args.detalle:
        print("\nfecha       cobrador cajas                 ARENDIR     facturado   cobros     IM_esperado  causa")
        for (fecha, cobr, ids, ar, fa, cob, im, causa) in filas:
            print(f"{fecha} {cobr:>8} {','.join(map(str, ids))[:20]:<20} {ar:>12,} {fa:>12,} {cob:>10,} "
                  f"{'-' if im is None else format(im, ','):>12}  {causa[:90]}")
    liq_despues = await contar_liquidaciones()
    print(f"\nSolo lectura verificada: route_liquidations antes={liq_antes} despues={liq_despues}")
    my.close()
    pg.close()
    await engine.dispose()


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--desde", required=True)
    ap.add_argument("--hasta", required=True)
    ap.add_argument("--detalle", action="store_true")
    asyncio.run(main_async(ap.parse_args()))
