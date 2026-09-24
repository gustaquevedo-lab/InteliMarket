"""Consola de plataforma -> Integraciones: estado, configuracion validada con
auditoria y pruebas de conexion. Una sola puerta para tocar credenciales."""
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.common.superadmin import require_superadmin
from api.src.db import get_db
from api.src.payment_integrations import service as pi
from api.src.payment_integrations.schemas import PaymentIntegrationConfigUpsert
from api.src.plataforma import capture
from api.src.plataforma.audit import diff_config, write_audit
from api.src.plataforma.models import IntegrationCheck
from api.src.plataforma.providers import PROVIDERS, run_check, spec_public, validate_config

router = APIRouter(prefix="/api/v1/platform/integrations", tags=["platform"])

DEFAULT_COMPANY = "00000000-0000-0000-0000-000000000010"


def _cid(user: dict, company_id: str | None) -> str:
    return company_id or user.get("company_id") or DEFAULT_COMPANY


def _provider(pid: str):
    p = PROVIDERS.get(pid)
    if not p:
        raise HTTPException(404, "Proveedor desconocido")
    return p


async def _stats(db: AsyncSession, pid: str, cid: str) -> dict:
    if pid == "bancard_qr":
        sql = ("SELECT date_trunc('day', created_at) d, count(*) FILTER (WHERE status='confirmed') ok, count(*) FILTER (WHERE status='failed') fail, "
               "count(*) FILTER (WHERE status='pending' AND created_at < now() - interval '10 minutes') stuck "
               "FROM bancard_qr_transactions WHERE company_id = :c AND created_at > now() - interval '7 days' GROUP BY 1 ORDER BY 1")
        last = "SELECT max(confirmed_at) FROM bancard_qr_transactions WHERE company_id = :c AND status='confirmed'"
    elif pid == "plugpay":
        sql = ("SELECT date_trunc('day', created_at) d, count(*) FILTER (WHERE exitosa) ok, count(*) FILTER (WHERE NOT exitosa) fail, 0 stuck "
               "FROM plugpay_transactions WHERE company_id = :c AND created_at > now() - interval '7 days' GROUP BY 1 ORDER BY 1")
        last = "SELECT max(created_at) FROM plugpay_transactions WHERE company_id = :c AND exitosa"
    else:
        cond = "tipo_operacion ILIKE 'dinelco\\_%'" if pid == "dinelco" else "tipo_operacion NOT ILIKE 'dinelco\\_%'"
        base = f"FROM pos_terminal_transactions WHERE company_id = :c AND {cond} AND coalesce(error_message,'') NOT ILIKE '%CANCEL%'"
        sql = f"SELECT date_trunc('day', created_at) d, count(*) FILTER (WHERE exitosa) ok, count(*) FILTER (WHERE NOT exitosa) fail, 0 stuck {base} AND created_at > now() - interval '7 days' GROUP BY 1 ORDER BY 1"
        last = f"SELECT max(created_at) {base} AND exitosa"
    rows = (await db.execute(text(sql), {"c": cid})).all()
    last_ok = (await db.execute(text(last), {"c": cid})).scalar()
    series = [{"d": r[0].isoformat(), "ok": int(r[1]), "fail": int(r[2]), "stuck": int(r[3])} for r in rows]
    ok7, fail7 = sum(s["ok"] for s in series), sum(s["fail"] for s in series)
    today = series[-1] if series and series[-1]["d"][:10] == date.today().isoformat() else {"ok": 0, "fail": 0, "stuck": 0}
    return {"series_7d": series, "ok_7d": ok7, "fail_7d": fail7, "ok_today": today["ok"], "fail_today": today["fail"],
            "stuck": sum(s["stuck"] for s in series), "last_success": last_ok}


@router.get("")
async def list_integrations(company_id: str | None = None, user=Depends(require_superadmin), db: AsyncSession = Depends(get_db)):
    cid = _cid(user, company_id)
    companies = [{"id": str(r[0]), "nombre": r[1]} for r in (await db.execute(text("SELECT id, razon_social FROM companies ORDER BY razon_social"))).all()]
    out = []
    for pid, spec in PROVIDERS.items():
        row = await pi.get_config(db, cid, pid)
        cfg = dict(row.config or {}) if row else {}
        chk = (await db.execute(text(
            "SELECT ts, ok, latency_ms, detail, actor FROM integration_checks WHERE provider = :p AND company_id = :c ORDER BY ts DESC LIMIT 1"), {"p": pid, "c": cid})).first()
        chk_ok = (await db.execute(text(
            "SELECT max(ts) FROM integration_checks WHERE provider = :p AND company_id = :c AND ok"), {"p": pid, "c": cid})).scalar()
        opened = (await db.execute(text(
            "SELECT count(*) FROM mon_issues WHERE provider = :p AND status = 'unresolved' AND environment = 'production'"), {"p": pid})).scalar() or 0
        missing = [f.key for f in spec.fields if f.required and not cfg.get(f.key)]
        state = "sin_configurar" if (not row or (missing and not spec.terminals_port)) else "desactivada" if not row.enabled else \
            ("error" if chk and not chk[1] else "ok" if chk else "sin_probar")
        out.append({
            **spec_public(spec),
            "exists": bool(row), "enabled": bool(row and row.enabled), "environment": row.environment if row else None,
            "updated_at": row.updated_at if row else None,
            "values": {f.key: cfg.get(f.key) for f in spec.fields if f.kind != "secret"},
            "secrets_set": {f.key: bool(cfg.get(f.key)) for f in spec.fields if f.kind == "secret"},
            "missing": missing, "state": state, "incidents_open": opened,
            "last_check": {"ts": chk[0], "ok": chk[1], "latency_ms": chk[2], "detail": chk[3], "actor": chk[4]} if chk else None,
            "last_check_ok": chk_ok, "stats": await _stats(db, pid, cid),
        })
    return {"company_id": cid, "companies": companies, "items": out}


class SaveBody(BaseModel):
    environment: str
    enabled: bool = True
    values: dict[str, str | None] = {}
    company_id: str | None = None


@router.put("/{pid}")
async def save_integration(pid: str, body: SaveBody, request: Request, user=Depends(require_superadmin), db: AsyncSession = Depends(get_db)):
    spec = _provider(pid)
    if spec.terminals_port:
        raise HTTPException(400, "Las IPs de los terminales se administran en la pestaña 'Cajas y terminales'.")
    cid = _cid(user, body.company_id)
    row = await pi.get_config(db, cid, pid)
    before = dict(row.config or {}) if row else {}
    before_env, before_en = (row.environment, row.enabled) if row else (None, None)
    errs = validate_config(spec, body.environment, body.values, body.enabled, before)
    if errs:
        raise HTTPException(422, " · ".join(errs))
    incoming = {k: v for k, v in body.values.items() if v not in (None, "")}  # secreto vacio = conservar el guardado
    saved = await pi.upsert_config(db, cid, pid, PaymentIntegrationConfigUpsert(environment=body.environment, enabled=body.enabled, config=incoming))
    b, a = diff_config(before, dict(saved.config or {}))
    if before_env != saved.environment:
        b["environment"], a["environment"] = before_env, saved.environment
    if before_en != saved.enabled:
        b["enabled"], a["enabled"] = before_en, saved.enabled
    await write_audit(db, user, "integracion_actualizada", target_type="integracion", target_id=pid, target_label=spec.label,
                      before=b or None, after=a or None, company_id=cid, request=request)
    return {"ok": True, "changed": sorted(a.keys())}


class DefaultsBody(BaseModel):
    environment: str
    company_id: str | None = None


@router.post("/{pid}/apply-defaults")
async def apply_defaults(pid: str, body: DefaultsBody, request: Request, user=Depends(require_superadmin), db: AsyncSession = Depends(get_db)):
    """Precarga los valores estandar del ambiente (URL de la API, etc). Punto de partida para un tenant nuevo."""
    spec = _provider(pid)
    vals = spec.defaults.get(body.environment)
    if not vals:
        raise HTTPException(400, "Este proveedor no tiene valores por defecto para ese ambiente.")
    cid = _cid(user, body.company_id)
    row = await pi.get_config(db, cid, pid)
    saved = await pi.upsert_config(db, cid, pid, PaymentIntegrationConfigUpsert(
        environment=body.environment, enabled=row.enabled if row else False, config=vals))
    await write_audit(db, user, "integracion_plantilla", target_type="integracion", target_id=pid, target_label=spec.label,
                      after={**vals, "environment": body.environment}, company_id=cid, request=request)
    return {"ok": True, "applied": list(vals.keys())}


class CheckBody(BaseModel):
    company_id: str | None = None


@router.post("/{pid}/check")
async def check_integration(pid: str, body: CheckBody, user=Depends(require_superadmin), db: AsyncSession = Depends(get_db)):
    spec = _provider(pid)
    cid = _cid(user, body.company_id)
    row = await pi.get_config(db, cid, pid)
    res = await run_check(spec, db, cid)
    db.add(IntegrationCheck(
        company_id=cid, provider=pid, environment=row.environment if row else None, ok=bool(res.get("ok")),
        latency_ms=res.get("latency_ms"), detail=(res.get("detail") or "")[:1000],
        actor=(user.get("user_nombre") or user.get("user_email") or "")[:120], meta=res.get("meta"),
    ))
    if not res.get("ok"):
        capture.capture_message(f"Prueba de conexión fallida: {res.get('detail')}", source="integration", level="warning", provider=pid, op="check",
                                code=(res.get("detail") or "")[:60])
    return res


@router.get("/{pid}/history")
async def check_history(pid: str, company_id: str | None = None, user=Depends(require_superadmin), db: AsyncSession = Depends(get_db)):
    _provider(pid)
    cid = _cid(user, company_id)
    rows = (await db.execute(text(
        "SELECT ts, ok, latency_ms, detail, actor FROM integration_checks WHERE provider = :p AND company_id = :c ORDER BY ts DESC LIMIT 30"), {"p": pid, "c": cid})).all()
    return [{"ts": r[0], "ok": r[1], "latency_ms": r[2], "detail": r[3], "actor": r[4]} for r in rows]
