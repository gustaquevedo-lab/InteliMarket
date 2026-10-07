#!/usr/bin/env python3
# Reconciliador de precios -> balanzas Balmak Edge.
#
# El envio "al cambiar el precio" (hooks en products/promotions/markdown) es
# dispara-y-olvida: si la balanza esta apagada, ocupada o rechaza la conexion,
# el cambio se pierde (de noche falla el 100%). Este script compara, por balanza,
# el precio/nombre que tiene el sistema contra lo ULTIMO transmitido con exito
# (tabla scale_plu_state) y empuja solo lo que difiere, en pocas conexiones.
# Si la balanza esta offline no pasa nada: reintenta en la proxima corrida y,
# al volver, hace una carga completa (por si perdio/le pisaron datos).
#
# Uso (cron cada 5 min):  python scripts/reconcile_balanzas.py
#       --full     fuerza carga completa a todas las balanzas
#       --dry-run  solo informa diferencias, no transmite
#       --scale X  limita a balanzas cuyo nombre contenga X
import argparse
import asyncio
import logging
from collections import defaultdict
from decimal import Decimal

from sqlalchemy import select, text

from api.src.db import async_session_factory
from api.src.integrations.scales.drivers import DRIVER_REGISTRY
from api.src.integrations.scales.models import ScaleConfig
from api.src.integrations.scales.service import _build_driver_config, _product_to_plu_dict
from api.src.products.models import Product

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("reconcile_balanzas")

CHUNK = 500


def _deseados(productos: list[Product], scoped: list[str]):
    """PLU -> producto. Excluye PLU ambiguos (dos productos activos con el mismo PLU) y precio <= 0."""
    por_plu: dict[int, list[Product]] = defaultdict(list)
    for p in productos:
        if scoped and str(p.categoria_id) not in scoped:
            continue
        por_plu[int(p.plu_balanza)].append(p)
    deseados, conflictos = {}, []
    for plu, ps in por_plu.items():
        if len(ps) > 1:
            conflictos.append((plu, [x.nombre for x in ps]))
            continue
        if (ps[0].precio_venta or 0) <= 0:
            continue
        deseados[plu] = ps[0]
    return deseados, conflictos


async def reconciliar_balanza(db, s: ScaleConfig, full: bool, dry: bool) -> str:
    sid = str(s.id)
    r = await db.execute(select(Product).where(
        Product.company_id == s.company_id, Product.plu_balanza.isnot(None), Product.activo == True))  # noqa: E712
    deseados, conflictos = _deseados(list(r.scalars().all()), s.categorias_ids or [])
    for plu, nombres in conflictos:
        log.warning("[%s] PLU %s ambiguo (se omite): %s", s.nombre, plu, nombres)

    estado = {row[0]: (row[1], row[2]) for row in (await db.execute(
        text("SELECT plu, precio, nombre FROM scale_plu_state WHERE scale_id = :s"), {"s": sid})).all()}
    pend = (await db.execute(
        text("SELECT pendiente_completo FROM scale_sync_status WHERE scale_id = :s"), {"s": sid})).scalar()
    completo = full or bool(pend) or not estado

    a_enviar = [
        p for plu, p in deseados.items()
        if completo or estado.get(plu) != (Decimal(str(p.precio_venta)).quantize(Decimal("0.01")), p.nombre)
    ]
    if not a_enviar:
        return f"{s.nombre}: al dia ({len(deseados)} PLU)"
    if dry:
        return f"{s.nombre}: [dry-run] {len(a_enviar)} por enviar{' (completo)' if completo else ''}"

    driver = DRIVER_REGISTRY[s.protocolo](_build_driver_config(s))
    enviados = 0
    try:
        for i in range(0, len(a_enviar), CHUNK):
            lote = a_enviar[i:i + CHUNK]
            res = await driver.sync_plu([_product_to_plu_dict(p) for p in lote])
            if res.exitosos != len(lote):
                raise RuntimeError(f"la balanza acepto {res.exitosos}/{len(lote)}: {res.errores[:2]}")
            for p in lote:
                await db.execute(text("""
                    INSERT INTO scale_plu_state (scale_id, plu, product_id, precio, nombre, pushed_at)
                    VALUES (:s, :plu, :pid, :precio, :nombre, NOW())
                    ON CONFLICT (scale_id, plu) DO UPDATE SET product_id = :pid, precio = :precio,
                        nombre = :nombre, pushed_at = NOW()"""),
                    {"s": sid, "plu": int(p.plu_balanza), "pid": str(p.id),
                     "precio": Decimal(str(p.precio_venta)).quantize(Decimal("0.01")), "nombre": p.nombre})
            await db.commit()
            enviados += len(lote)
    except Exception as e:  # noqa: BLE001 -- offline/ocupada: reintenta en la proxima corrida
        await db.rollback()
        await db.execute(text("""
            INSERT INTO scale_sync_status (scale_id, last_error, last_error_at, pendiente_completo)
            VALUES (:s, :e, NOW(), TRUE)
            ON CONFLICT (scale_id) DO UPDATE SET last_error = :e, last_error_at = NOW(), pendiente_completo = TRUE"""),
            {"s": sid, "e": str(e)[:500]})
        await db.commit()
        return f"{s.nombre}: SIN CONEXION/ERROR tras {enviados}/{len(a_enviar)} ({e}) -> reintenta luego"

    await db.execute(text("""
        INSERT INTO scale_sync_status (scale_id, last_ok_at, last_error, pendiente_completo)
        VALUES (:s, NOW(), NULL, FALSE)
        ON CONFLICT (scale_id) DO UPDATE SET last_ok_at = NOW(), last_error = NULL, pendiente_completo = FALSE"""),
        {"s": sid})
    await db.commit()
    return f"{s.nombre}: OK, {enviados} PLU transmitidos{' (carga completa)' if completo else ''}"


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--full", action="store_true")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--scale", help="solo balanzas cuyo nombre contenga este texto")
    args = ap.parse_args()
    async with async_session_factory() as db:
        scales = (await db.execute(select(ScaleConfig).where(
            ScaleConfig.activa == True, ScaleConfig.sync_automatico == True,  # noqa: E712
            ScaleConfig.host.isnot(None), ScaleConfig.protocolo.in_(["balmak_etiquetadora", "balmak_sdl"])
        ).order_by(ScaleConfig.nombre))).scalars().all()
        for s in scales:
            if args.scale and args.scale.lower() not in s.nombre.lower():
                continue
            log.info(await reconciliar_balanza(db, s, args.full, args.dry_run))


if __name__ == "__main__":
    asyncio.run(main())
