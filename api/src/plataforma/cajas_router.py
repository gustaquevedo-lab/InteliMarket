"""Consola de plataforma -> Cajas y terminales.

Las IPs de los terminales de cobro viven en DOS lugares: la tabla
pos_terminal_assignments y el mapa ips_por_punto_emision de las integraciones
'bancard' y 'dinelco' (que es el que realmente usa el POS al cobrar). Antes se
cargaban por separado y se desfasaban (Caja 2 y Caja 4 con la misma IP de
Dinelco). Esta consola es el unico lugar que las escribe, siempre en los dos.
"""
import ipaddress
import os
import re
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.common.superadmin import require_superadmin
from api.src.db import get_db
from api.src.payment_integrations import service as pi
from api.src.payment_integrations.schemas import PaymentIntegrationConfigUpsert
from api.src.plataforma.audit import write_audit
from api.src.plataforma.models import MonHeartbeat
from api.src.plataforma.monitor_router import expected_capabilities
from api.src.plataforma.providers import PROVIDERS, tcp_probe
from api.src.pos_terminals.models import PosTerminalAssignment

router = APIRouter(prefix="/api/v1/platform/cajas", tags=["platform"])

DEFAULT_COMPANY = "00000000-0000-0000-0000-000000000010"
UI_CURRENT = "/var/www/intelimarket-ui/current"
ONLINE_SEG = 180


def _cid(user, company_id):
    return company_id or user.get("company_id") or DEFAULT_COMPANY


def current_release() -> str | None:
    try:
        return os.path.basename(os.path.realpath(UI_CURRENT)) if os.path.exists(UI_CURRENT) else None
    except OSError:
        return None


def _valid_ip(v: str | None) -> str | None:
    v = (v or "").strip()
    if not v:
        return None
    try:
        ip = ipaddress.ip_address(v)
    except ValueError:
        raise HTTPException(422, f"'{v}' no es una IP válida")
    if ip.version != 4 or not ip.is_private:
        raise HTTPException(422, f"'{v}' tiene que ser una IP privada de la red local (192.168.x.x)")
    return str(ip)


async def _ip_maps(db, cid) -> dict[str, dict]:
    out = {}
    for prov in ("bancard", "dinelco"):
        row = await pi.get_config(db, cid, prov)
        out[prov] = dict((row.config or {}).get("ips_por_punto_emision") or {}) if row else {}
    return out


def _effective(maps: dict, prov: str, punto: str, fallback: str | None) -> str | None:
    m = maps[prov]
    return m.get(f"001-{punto}") or m.get(punto) or fallback


@router.get("")
async def list_cajas(company_id: str | None = None, user=Depends(require_superadmin), db: AsyncSession = Depends(get_db)):
    cid = _cid(user, company_id)
    rows = (await db.execute(select(PosTerminalAssignment).where(PosTerminalAssignment.company_id == cid).order_by(PosTerminalAssignment.punto_emision))).scalars().all()
    hbs = {h.key: h for h in (await db.execute(select(MonHeartbeat).where(MonHeartbeat.kind == "caja"))).scalars().all()}
    maps = await _ip_maps(db, cid)
    expected = expected_capabilities()
    cur = current_release()
    now = datetime.now(timezone.utc)

    last_tx = {}
    for r in (await db.execute(text(
            "SELECT DISTINCT ON (punto_emision) punto_emision, tipo_operacion, exitosa, error_message, created_at "
            "FROM pos_terminal_transactions WHERE company_id = :c ORDER BY punto_emision, created_at DESC"), {"c": cid})).all():
        last_tx[r[0].split("-")[-1]] = {"tipo": r[1], "ok": r[2], "error": r[3], "ts": r[4]}
    day = {}
    for r in (await db.execute(text(
            "SELECT punto_emision, count(*) FILTER (WHERE exitosa), count(*) FILTER (WHERE NOT exitosa) FROM pos_terminal_transactions "
            "WHERE company_id = :c AND created_at > now() - interval '24 hours' AND coalesce(error_message,'') NOT ILIKE '%CANCEL%' GROUP BY 1"), {"c": cid})).all():
        p = r[0].split("-")[-1]
        a = day.setdefault(p, [0, 0])
        a[0] += r[1]; a[1] += r[2]

    eff = {}
    for a in rows:
        eff[a.id] = {
            "bancard": _effective(maps, "bancard", a.punto_emision, a.ip_pos_bancard),
            "dinelco": _effective(maps, "dinelco", a.punto_emision, a.ip_pos_dinelco),
            "pc": a.ip_address,
        }
    dup = {}
    for a in rows:
        if not a.activo:
            continue
        for k in ("bancard", "dinelco", "pc"):
            ip = eff[a.id][k]
            if ip:
                dup.setdefault((k, ip), []).append(a.caja_nombre)

    items = []
    for a in rows:
        hb = hbs.get((a.hostname or "").upper())
        online = bool(hb and hb.last_seen and (now - hb.last_seen).total_seconds() < ONLINE_SEG)
        missing = [c for c in expected if hb and hb.capabilities is not None and c not in (hb.capabilities or [])] if hb else []
        warns = []
        for k, label in (("dinelco", "terminal Dinelco"), ("bancard", "terminal Bancard"), ("pc", "PC de la caja")):
            ip = eff[a.id][k]
            if ip and len(dup[(k, ip)]) > 1 and a.activo:
                otras = [n for n in dup[(k, ip)] if n != a.caja_nombre]
                warns.append({"level": "error", "text": f"La IP {ip} del {label} también la usa {', '.join(otras)}. Los cobros pueden ir al terminal equivocado."})
        for k, col in (("dinelco", a.ip_pos_dinelco), ("bancard", a.ip_pos_bancard)):
            if eff[a.id][k] and col and eff[a.id][k] != col:
                warns.append({"level": "warning", "text": f"{k.capitalize()}: la asignación dice {col} pero el POS cobra con {eff[a.id][k]}. Guardá de nuevo para sincronizar."})
        if hb and missing:
            warns.append({"level": "error", "text": f"La app de caja instalada es vieja: le faltan {', '.join(missing)}. Hay que actualizarla."})
        if hb and cur and hb.release and hb.release != cur and online:
            warns.append({"level": "warning", "text": f"Tiene abierta una versión anterior de la pantalla ({hb.release}). Toma la nueva al cerrar sesión."})
        if a.activo and not hb and hbs:
            warns.append({"level": "warning", "text": "Nunca reportó actividad desde que existe la consola."})
        items.append({
            "id": str(a.id), "hostname": a.hostname, "caja_nombre": a.caja_nombre, "punto_emision": a.punto_emision, "activo": a.activo,
            "ip_pc": a.ip_address, "ip_bancard": eff[a.id]["bancard"], "ip_dinelco": eff[a.id]["dinelco"],
            "asignado": {"bancard": a.ip_pos_bancard, "dinelco": a.ip_pos_dinelco},
            "heartbeat": ({"last_seen": hb.last_seen, "online": online, "release": hb.release, "app_version": hb.app_version,
                           "electron_version": hb.electron_version, "user_name": hb.user_name, "url": hb.url,
                           "capabilities": hb.capabilities, "client_ip": hb.client_ip} if hb else None),
            "missing_capabilities": missing, "last_tx": last_tx.get(a.punto_emision), "tx_24h": {"ok": day.get(a.punto_emision, [0, 0])[0], "fail": day.get(a.punto_emision, [0, 0])[1]},
            "warnings": warns,
        })
    return {"expected_capabilities": expected, "current_release": cur, "items": items}


class CajaBody(BaseModel):
    caja_nombre: str | None = Field(default=None, max_length=60)
    ip_address: str | None = None
    ip_pos_bancard: str | None = None
    ip_pos_dinelco: str | None = None
    activo: bool | None = None
    company_id: str | None = None


async def _sync_maps(db, cid, punto: str, ips: dict):
    """Escribe la IP en el mapa que usa el POS (claves '001-013' y '013')."""
    for prov, ip in ips.items():
        row = await pi.get_config(db, cid, prov)
        cfg = dict(row.config or {}) if row else {}
        m = dict(cfg.get("ips_por_punto_emision") or {})
        for k in (f"001-{punto}", punto):
            if ip:
                m[k] = ip
            else:
                m.pop(k, None)
        await pi.upsert_config(db, cid, prov, PaymentIntegrationConfigUpsert(
            environment=row.environment if row else "production", enabled=row.enabled if row else True, config={"ips_por_punto_emision": m}))


@router.put("/{caja_id}")
async def update_caja(caja_id: str, body: CajaBody, request: Request, user=Depends(require_superadmin), db: AsyncSession = Depends(get_db)):
    a = await db.get(PosTerminalAssignment, caja_id)
    if not a:
        raise HTTPException(404, "Caja no encontrada")
    cid = str(a.company_id)
    fields = body.model_fields_set
    new = {
        "ip_address": _valid_ip(body.ip_address) if "ip_address" in fields else a.ip_address,
        "ip_pos_bancard": _valid_ip(body.ip_pos_bancard) if "ip_pos_bancard" in fields else a.ip_pos_bancard,
        "ip_pos_dinelco": _valid_ip(body.ip_pos_dinelco) if "ip_pos_dinelco" in fields else a.ip_pos_dinelco,
    }
    # no se permite repetir IP con otra caja activa
    maps = await _ip_maps(db, cid)
    others = (await db.execute(select(PosTerminalAssignment).where(PosTerminalAssignment.company_id == a.company_id, PosTerminalAssignment.id != a.id, PosTerminalAssignment.activo))).scalars().all()
    for key, prov in (("ip_pos_bancard", "bancard"), ("ip_pos_dinelco", "dinelco"), ("ip_address", "pc")):
        ip = new[key]
        if not ip:
            continue
        for o in others:
            oip = o.ip_address if prov == "pc" else _effective(maps, prov, o.punto_emision, getattr(o, key))
            if oip == ip:
                raise HTTPException(409, f"La IP {ip} ya la usa {o.caja_nombre}. Cada terminal tiene que tener su propia IP.")
    before = {"caja_nombre": a.caja_nombre, "activo": a.activo, **{k: getattr(a, k) for k in new},
              "ip_bancard_pos_usa": _effective(maps, "bancard", a.punto_emision, None), "ip_dinelco_pos_usa": _effective(maps, "dinelco", a.punto_emision, None)}
    if body.caja_nombre is not None:
        a.caja_nombre = body.caja_nombre.strip() or a.caja_nombre
    if body.activo is not None:
        a.activo = body.activo
    for k, v in new.items():
        setattr(a, k, v)
    await db.flush()
    await _sync_maps(db, cid, a.punto_emision, {"bancard": new["ip_pos_bancard"], "dinelco": new["ip_pos_dinelco"]})
    after = {"caja_nombre": a.caja_nombre, "activo": a.activo, **new}
    ch_b = {k: v for k, v in before.items() if k in after and after[k] != v}
    ch_a = {k: after[k] for k in ch_b}
    await write_audit(db, user, "caja_actualizada", target_type="caja", target_id=str(a.id), target_label=f"{a.caja_nombre} ({a.hostname})",
                      before=ch_b or None, after=ch_a or None, company_id=a.company_id, request=request)
    return {"ok": True}


class NewCaja(BaseModel):
    hostname: str = Field(min_length=2, max_length=120)
    punto_emision: str = Field(pattern=r"^\d{3}$")
    caja_nombre: str = Field(min_length=1, max_length=60)
    ip_address: str | None = None
    ip_pos_bancard: str | None = None
    ip_pos_dinelco: str | None = None
    company_id: str | None = None


@router.post("", status_code=201)
async def create_caja(body: NewCaja, request: Request, user=Depends(require_superadmin), db: AsyncSession = Depends(get_db)):
    cid = _cid(user, body.company_id)
    host = re.sub(r"\s+", "", body.hostname).upper()
    if (await db.execute(select(PosTerminalAssignment).where(PosTerminalAssignment.hostname == host))).first():
        raise HTTPException(409, f"Ya existe una asignación para {host}")
    if (await db.execute(select(PosTerminalAssignment).where(PosTerminalAssignment.company_id == cid, PosTerminalAssignment.punto_emision == body.punto_emision, PosTerminalAssignment.activo))).first():
        raise HTTPException(409, f"El punto de emisión {body.punto_emision} ya está asignado a otra máquina")
    ips = {"ip_address": _valid_ip(body.ip_address), "ip_pos_bancard": _valid_ip(body.ip_pos_bancard), "ip_pos_dinelco": _valid_ip(body.ip_pos_dinelco)}
    a = PosTerminalAssignment(company_id=cid, hostname=host, punto_emision=body.punto_emision, caja_nombre=body.caja_nombre.strip(), **ips)
    db.add(a)
    await db.flush()
    await _sync_maps(db, cid, a.punto_emision, {"bancard": ips["ip_pos_bancard"], "dinelco": ips["ip_pos_dinelco"]})
    await write_audit(db, user, "caja_creada", target_type="caja", target_id=str(a.id), target_label=f"{a.caja_nombre} ({host})",
                      after={"punto_emision": a.punto_emision, **ips}, company_id=cid, request=request)
    return {"id": str(a.id)}


@router.delete("/{caja_id}", status_code=204)
async def delete_caja(caja_id: str, request: Request, user=Depends(require_superadmin), db: AsyncSession = Depends(get_db)):
    a = await db.get(PosTerminalAssignment, caja_id)
    if not a:
        raise HTTPException(404, "Caja no encontrada")
    await write_audit(db, user, "caja_eliminada", target_type="caja", target_id=str(a.id), target_label=f"{a.caja_nombre} ({a.hostname})",
                      before={"punto_emision": a.punto_emision, "ip_pos_dinelco": a.ip_pos_dinelco, "ip_pos_bancard": a.ip_pos_bancard}, company_id=a.company_id, request=request)
    await _sync_maps(db, str(a.company_id), a.punto_emision, {"bancard": None, "dinelco": None})
    await db.delete(a)


class PingBody(BaseModel):
    target: str = Field(pattern="^(dinelco|bancard|pc)$")


@router.post("/{caja_id}/ping")
async def ping_caja(caja_id: str, body: PingBody, user=Depends(require_superadmin), db: AsyncSession = Depends(get_db)):
    a = await db.get(PosTerminalAssignment, caja_id)
    if not a:
        raise HTTPException(404, "Caja no encontrada")
    maps = await _ip_maps(db, str(a.company_id))
    if body.target == "pc":
        ip, port = a.ip_address, 445
    else:
        ip = _effective(maps, body.target, a.punto_emision, getattr(a, f"ip_pos_{body.target}"))
        port = PROVIDERS[body.target].terminals_port
    if not ip:
        raise HTTPException(400, "No hay IP configurada para ese equipo")
    r = await tcp_probe(ip, port, greet=body.target == "dinelco")
    return {"ip": ip, "port": port, **r}
