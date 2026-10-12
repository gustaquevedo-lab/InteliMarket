"""Reconciliador de precios -> balanzas Balmak Edge (logica compartida).

Lo usan el vigilante en tiempo real (watcher.py, dentro del API) y el cron de respaldo
(scripts/reconcile_balanzas.py). Compara, por balanza, el precio/nombre EFECTIVO de cada
producto con PLU (lo que cobra la caja hoy, ver calcular_precios_balanza) contra lo ultimo
transmitido con exito (tabla scale_plu_state) y empuja solo la diferencia. Si la balanza esta
apagada marca pendiente_completo y, al volver, recibe el catalogo completo.
"""
import json
import logging
from collections import defaultdict
from dataclasses import dataclass
from decimal import Decimal
from typing import Optional

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.integrations.scales.drivers import DRIVER_REGISTRY
from api.src.integrations.scales.models import ScaleConfig
from api.src.integrations.scales.service import _build_driver_config, _product_to_plu_dict, calcular_precios_balanza
from api.src.products.models import Product

log = logging.getLogger("reconciler_balanzas")

CHUNK = 500
CENT = Decimal("0.01")


@dataclass
class Resultado:
    scale_id: str
    nombre: str
    estado: str  # al_dia | ok | error | omitida | dry_run
    enviados: int = 0
    detalle: str = ""

    def __str__(self) -> str:
        return f"{self.nombre}: {self.detalle}"


MAX_DETALLE = 100


def _detalle_cambios(a_enviar: list[Product], estado: dict, precios: dict) -> list[dict]:
    """Que cambia respecto de lo ultimo transmitido (para el registro visible en /escalas)."""
    out = []
    for p in a_enviar:
        antes = estado.get(int(p.plu_balanza))
        ahora = precios[p.id].quantize(CENT)
        if antes is None or antes[0] != ahora or antes[1] != p.nombre:
            out.append({"plu": int(p.plu_balanza), "nombre": p.nombre,
                        "antes": float(antes[0]) if antes else None, "ahora": float(ahora)})
        if len(out) >= MAX_DETALLE:
            break
    return out


async def _registrar_ok(db: AsyncSession, sid: str, origen: str, completo: bool, total: int, detalle: list[dict]) -> None:
    await db.execute(text("""
        INSERT INTO scale_sync_log (scale_id, origen, tipo, estado, total, detalle)
        VALUES (:s, :o, :t, 'ok', :n, CAST(:d AS jsonb))"""),
        {"s": sid, "o": origen, "t": "completa" if completo else "cambios", "n": total, "d": json.dumps(detalle)})
    await db.execute(text("DELETE FROM scale_sync_log WHERE created_at < now() - interval '30 days'"))


async def _registrar_error(db: AsyncSession, sid: str, origen: str, pendientes: int, detalle: list[dict], error: str) -> None:
    """Un error repetido (balanza apagada toda la noche) no genera una fila por intento: se cuenta en la misma."""
    ultimo = (await db.execute(text(
        "SELECT id, estado FROM scale_sync_log WHERE scale_id = :s ORDER BY id DESC LIMIT 1"), {"s": sid})).first()
    if ultimo and ultimo[1] == "error":
        await db.execute(text("""
            UPDATE scale_sync_log SET repeticiones = repeticiones + 1, ultimo_intento = now(), error = :e,
                   total = :n, detalle = CAST(:d AS jsonb), origen = :o WHERE id = :id"""),
            {"id": ultimo[0], "e": error[:500], "n": pendientes, "d": json.dumps(detalle), "o": origen})
    else:
        await db.execute(text("""
            INSERT INTO scale_sync_log (scale_id, origen, tipo, estado, total, detalle, error)
            VALUES (:s, :o, 'cambios', 'error', :n, CAST(:d AS jsonb), :e)"""),
            {"s": sid, "o": origen, "n": pendientes, "d": json.dumps(detalle), "e": error[:500]})


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


async def _reconciliar_balanza(session_factory, s: ScaleConfig, productos: list[Product], precios: dict,
                               full: bool, dry: bool, origen: str) -> Resultado:
    # Sesion propia: un rollback por error de una balanza no debe expirar los productos compartidos.
    async with session_factory() as db:
        return await _reconciliar_balanza_db(db, s, productos, precios, full, dry, origen)


async def _reconciliar_balanza_db(db: AsyncSession, s: ScaleConfig, productos: list[Product], precios: dict,
                                  full: bool, dry: bool, origen: str) -> Resultado:
    sid = str(s.id)
    deseados, conflictos = _deseados(productos, s.categorias_ids or [])
    for plu, nombres in conflictos:
        log.warning("[%s] PLU %s ambiguo (se omite): %s", s.nombre, plu, nombres)

    estado = {row[0]: (row[1], row[2]) for row in (await db.execute(
        text("SELECT plu, precio, nombre FROM scale_plu_state WHERE scale_id = :s"), {"s": sid})).all()}
    pend = (await db.execute(
        text("SELECT pendiente_completo FROM scale_sync_status WHERE scale_id = :s"), {"s": sid})).scalar()
    completo = full or bool(pend) or not estado

    a_enviar = [
        p for plu, p in deseados.items()
        if completo or estado.get(plu) != (precios[p.id].quantize(CENT), p.nombre)
    ]
    if not a_enviar:
        if not dry:
            await db.execute(text("""
                INSERT INTO scale_sync_status (scale_id, last_check_at) VALUES (:s, NOW())
                ON CONFLICT (scale_id) DO UPDATE SET last_check_at = NOW()"""), {"s": sid})
            await db.commit()
        return Resultado(sid, s.nombre, "al_dia", 0, f"al dia ({len(deseados)} PLU)")
    if dry:
        return Resultado(sid, s.nombre, "dry_run", len(a_enviar),
                         f"[dry-run] {len(a_enviar)} por enviar{' (completo)' if completo else ''}")

    detalle_ok = _detalle_cambios(a_enviar, estado, precios)
    driver = DRIVER_REGISTRY[s.protocolo](_build_driver_config(s))
    enviados = 0
    try:
        for i in range(0, len(a_enviar), CHUNK):
            lote = a_enviar[i:i + CHUNK]
            res = await driver.sync_plu([_product_to_plu_dict(p, precios[p.id]) for p in lote])
            if res.exitosos != len(lote):
                raise RuntimeError(f"la balanza acepto {res.exitosos}/{len(lote)}: {res.errores[:2]}")
            for p in lote:
                await db.execute(text("""
                    INSERT INTO scale_plu_state (scale_id, plu, product_id, precio, nombre, pushed_at)
                    VALUES (:s, :plu, :pid, :precio, :nombre, NOW())
                    ON CONFLICT (scale_id, plu) DO UPDATE SET product_id = :pid, precio = :precio,
                        nombre = :nombre, pushed_at = NOW()"""),
                    {"s": sid, "plu": int(p.plu_balanza), "pid": str(p.id),
                     "precio": precios[p.id].quantize(CENT), "nombre": p.nombre})
            await db.commit()
            enviados += len(lote)
    except Exception as e:  # noqa: BLE001 -- offline/ocupada: se reintenta (vigilante con backoff / cron)
        await db.rollback()
        await db.execute(text("""
            INSERT INTO scale_sync_status (scale_id, last_error, last_error_at, last_check_at, pendiente_completo)
            VALUES (:s, :e, NOW(), NOW(), TRUE)
            ON CONFLICT (scale_id) DO UPDATE SET last_error = :e, last_error_at = NOW(), last_check_at = NOW(),
                pendiente_completo = TRUE"""),
            {"s": sid, "e": str(e)[:500]})
        await _registrar_error(db, sid, origen, len(a_enviar), _detalle_cambios(a_enviar, estado, precios), str(e))
        await db.commit()
        return Resultado(sid, s.nombre, "error", enviados,
                         f"SIN CONEXION/ERROR tras {enviados}/{len(a_enviar)} ({e}) -> reintenta luego")

    await db.execute(text("""
        INSERT INTO scale_sync_status (scale_id, last_ok_at, last_check_at, last_error, pendiente_completo)
        VALUES (:s, NOW(), NOW(), NULL, FALSE)
        ON CONFLICT (scale_id) DO UPDATE SET last_ok_at = NOW(), last_check_at = NOW(), last_error = NULL,
            pendiente_completo = FALSE"""),
        {"s": sid})
    await _registrar_ok(db, sid, origen, completo, enviados, detalle_ok)
    await db.commit()
    return Resultado(sid, s.nombre, "ok", enviados,
                     f"OK, {enviados} PLU transmitidos{' (carga completa)' if completo else ''}")


async def reconciliar_todas(session_factory, *, full: bool = False, dry: bool = False,
                            solo: Optional[str] = None, omitir: Optional[set] = None,
                            origen: str = "respaldo") -> list[Resultado]:
    """Una pasada sobre todas las balanzas activas con sync automatico.
    `omitir`: ids de balanza a saltear (backoff del vigilante). `solo`: texto del nombre."""
    resultados: list[Resultado] = []
    async with session_factory() as db:
        scales = (await db.execute(select(ScaleConfig).where(
            ScaleConfig.activa == True, ScaleConfig.sync_automatico == True,  # noqa: E712
            ScaleConfig.host.isnot(None), ScaleConfig.protocolo.in_(["balmak_etiquetadora", "balmak_sdl"])
        ).order_by(ScaleConfig.nombre))).scalars().all()
        scales = [s for s in scales if not solo or solo.lower() in s.nombre.lower()]

        por_empresa: dict = defaultdict(list)
        for s in scales:
            por_empresa[s.company_id].append(s)

        for company_id, grupo in por_empresa.items():
            productos = list((await db.execute(select(Product).where(
                Product.company_id == company_id, Product.plu_balanza.isnot(None),
                Product.activo == True))).scalars().all())  # noqa: E712
            precios = await calcular_precios_balanza(db, company_id, productos)
            for s in grupo:
                if omitir and str(s.id) in omitir:
                    resultados.append(Resultado(str(s.id), s.nombre, "omitida", 0, "omitida (en espera tras error)"))
                    continue
                resultados.append(await _reconciliar_balanza(session_factory, s, productos, precios, full, dry, origen))
    return resultados
