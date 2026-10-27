#!/usr/bin/env python3
"""
Compara, POR CAJA/SALIDA (una route_session de IM = una cajas.IDCAJA del legacy), la rendicion que calcula
InteliMarket (api/src/ruta_caja: movimientos_sesion + calcular_rendicion, con lo ya sincronizado en Postgres)
contra la MISMA formula alimentada con los datos del legacy (sync_incremental.leer_cajas_legacy) y contra lo que la
caja realmente entrego en el legacy (efectivo + cheques). SOLO LECTURA (el legacy se lee por rangos de PK/indice).

Uso (en la VM, desde ~/intelimarket):
    .venv/bin/python scripts/migracion_casa_gonzalito/comparar_rendiciones.py --desde 2026-10-20 --hasta 2026-10-27 [--detalle]
Variables: MYSQL_HOST/MYSQL_USER/MYSQL_PASSWORD (como el sync; default legacy en vivo).
"""
import argparse
import asyncio
import sys
import uuid
from collections import Counter
from datetime import date, timedelta
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path[:0] = [str(HERE), str(HERE.parents[1])]

import sync_incremental as si  # noqa: E402
from api.src.db import engine  # noqa: E402
from api.src.ruta_caja.models import RouteSession  # noqa: E402
from api.src.ruta_caja.rendicion import COMPONENTES, calcular_rendicion  # noqa: E402
from api.src.ruta_caja.service import movimientos_sesion  # noqa: E402
from sqlalchemy.ext.asyncio import AsyncSession  # noqa: E402


def cajas_cerradas(my, desde, hasta):
    lo = si._primer_idcaja(my, desde)
    hi = si._primer_idcaja(my, hasta + timedelta(days=1)) + 600
    out = []
    for (idc, cobr, fecha, ciere, ar) in si._rango(
            my, "SELECT IDCAJA, IDCOBRADOR, FECHA, CIERE, ARENDIR FROM cajas WHERE IDCAJA BETWEEN %s AND %s", lo, hi):
        f = si.safe_dt(fecha)
        if f and desde <= f.date() <= hasta and ciere:
            out.append(dict(id=idc, cobr=(si.txt(cobr) or ""), fecha=f.date(), ar=si.money(ar)))
    return out


async def calcula_im(db, sid):
    ses = await db.get(RouteSession, sid)
    if not ses:
        return None
    return calcular_rendicion(await movimientos_sesion(db, ses))


def explica(l, im):
    return ", ".join(f"{k}: legacy {l[k]:,} / IM {im[k]:,}" for k in COMPONENTES if l[k] != im[k])


async def main_async(args):
    desde, hasta = date.fromisoformat(args.desde), date.fromisoformat(args.hasta)
    my = si.mysql_conn()
    cajas = cajas_cerradas(my, desde, hasta)
    sin_cobr = [c for c in cajas if not c["cobr"]]
    cajas = [c for c in cajas if c["cobr"]]
    print(f"Legacy {desde}..{hasta}: {len(cajas)} cajas cerradas con cobrador (+{len(sin_cobr)} sin cobrador, no se importan)")
    leg = {}
    ids = sorted(c["id"] for c in cajas)
    for i in range(0, len(ids), 400):
        leg.update(si.leer_cajas_legacy(my, ids[i], ids[min(i + 399, len(ids) - 1)]))
    filas, causas = [], Counter()
    async with engine.connect() as conn:
        db = AsyncSession(bind=conn, expire_on_commit=False)
        for c in sorted(cajas, key=lambda c: c["id"]):
            d = leg.get(c["id"]) or dict(mov={}, efectivo=0, cheques=0, faltante=0)
            l = calcular_rendicion(d["mov"])
            im = await calcula_im(db, uuid.uuid5(si.NS, f"rsesion:caja:{c['id']}"))
            entregado = d["efectivo"] + d["cheques"]
            if im is None:
                causa = "SIN_SESION_IM: caja no sincronizada como route_session"
            elif im["total"] == l["total"] and all(im[k] == l[k] for k in COMPONENTES):
                causa = "IGUAL"
            else:
                causa = "DIFIERE: " + explica(l, im)
            causas[causa.split(":")[0]] += 1
            dif = l["total"] - entregado
            if dif == 0:
                real = "exacta"
            elif dif == d["faltante"]:
                real = "faltante/sobrante registrado en cta_cte_funcionarios"
            else:
                real = "SIN EXPLICAR"
            filas.append((c, l, im, entregado, dif, real, causa))
        await db.close()
    n = len(filas)
    print(f"\nIM vs formula con datos del legacy: iguales {causas['IGUAL']}/{n} ({100 * causas['IGUAL'] // max(n, 1)}%)")
    for k, v in causas.items():
        if k != "IGUAL":
            ej = next(f for f in filas if f[6].startswith(k))
            print(f"  {k}: {v}  ej: caja {ej[0]['id']} {ej[0]['fecha']} -> {ej[6]}")
    real = Counter(f[5] for f in filas)
    print(f"Formula vs lo que la caja entrego en el legacy (efectivo+cheques): " +
          "; ".join(f"{k}: {v}" for k, v in real.most_common()))
    for f in filas:
        if f[5] == "SIN EXPLICAR":
            print(f"  SIN EXPLICAR caja {f[0]['id']} {f[0]['fecha']}: formula {f[1]['total']:,} entregado {f[3]:,} dif {f[4]:,} {f[1]}")
    if args.detalle:
        print("\ncaja     fecha       formula_legacy  formula_IM  entregado  dif  causa")
        for (c, l, im, ent, dif, real_, causa) in filas:
            print(f"{c['id']} {c['fecha']} {l['total']:>14,} {('-' if im is None else format(im['total'], ',')):>12} "
                  f"{ent:>12,} {dif:>10,}  {real_[:20]} | {causa[:60]}")
    my.close()
    await engine.dispose()


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--desde", required=True)
    ap.add_argument("--hasta", required=True)
    ap.add_argument("--detalle", action="store_true")
    asyncio.run(main_async(ap.parse_args()))
