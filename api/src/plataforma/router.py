"""API de la consola de plataforma (solo superadmin): incidencias, resumen,
alertas y auditoria. Integraciones, cajas y tenants viven en sus propios
archivos y se cuelgan del mismo prefijo.
"""
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, Field
from sqlalchemy import func, or_, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.common.superadmin import require_superadmin
from api.src.db import get_db
from api.src.plataforma import alerts, capture
from api.src.plataforma.audit import write_audit
from api.src.plataforma.models import MonEvent, MonIssue, PlatformAudit

router = APIRouter(prefix="/api/v1/platform", tags=["platform"])


def _env_filter(env: str):
    return [] if env == "all" else [MonIssue.environment == env]


def _hour_buckets(hours: int) -> list[datetime]:
    now = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
    return [now - timedelta(hours=i) for i in range(hours - 1, -1, -1)]


def _issue_dict(i: MonIssue, spark: list[int] | None = None) -> dict:
    dims = i.dims or {}
    top = lambda k: sorted((dims.get(k) or {}).items(), key=lambda kv: -kv[1])
    return {
        "id": str(i.id), "environment": i.environment, "source": i.source, "level": i.level, "title": i.title,
        "culprit": i.culprit, "provider": i.provider, "status": i.status, "occurrences": i.occurrences,
        "regressions": i.regressions, "first_seen": i.first_seen, "last_seen": i.last_seen,
        "first_release": i.first_release, "last_release": i.last_release, "resolved_at": i.resolved_at,
        "resolved_by": i.resolved_by, "resolved_release": i.resolved_release, "ignored_until": i.ignored_until,
        "note": i.note, "cajas": top("cajas")[:8], "users": top("users")[:8], "releases": top("releases")[:5],
        "routes": top("routes")[:5], "users_count": len(dims.get("users") or {}), "cajas_count": len(dims.get("cajas") or {}),
        "spark": spark or [],
    }


async def _sparks(db: AsyncSession, ids: list, hours: int = 24) -> dict:
    if not ids:
        return {}
    rows = (await db.execute(text(
        "SELECT issue_id, bucket, count FROM mon_issue_hourly WHERE issue_id = ANY(:ids) AND bucket >= now() - make_interval(hours => :h)"),
        {"ids": ids, "h": hours})).all()
    buckets = _hour_buckets(hours)
    idx = {b: n for n, b in enumerate(buckets)}
    out = {i: [0] * hours for i in ids}
    for iid, b, c in rows:
        n = idx.get(b.astimezone(timezone.utc).replace(minute=0, second=0, microsecond=0))
        if n is not None:
            out[iid][n] += c
    return out


@router.get("/overview")
async def overview(env: str = "production", _=Depends(require_superadmin), db: AsyncSession = Depends(get_db)):
    ef = _env_filter(env)
    base = select(func.count()).select_from(MonIssue).where(*ef)
    unresolved = (await db.execute(base.where(MonIssue.status == "unresolved"))).scalar() or 0
    fatal = (await db.execute(base.where(MonIssue.status == "unresolved", MonIssue.level == "fatal"))).scalar() or 0
    new24 = (await db.execute(base.where(MonIssue.first_seen > text("now() - interval '24 hours'")))).scalar() or 0
    resolved7 = (await db.execute(base.where(MonIssue.status == "resolved", MonIssue.resolved_at > text("now() - interval '7 days'")))).scalar() or 0
    by_source = dict((await db.execute(
        select(MonIssue.source, func.count()).where(*ef, MonIssue.status == "unresolved").group_by(MonIssue.source))).all())
    by_provider = dict((await db.execute(
        select(MonIssue.provider, func.count()).where(*ef, MonIssue.status == "unresolved", MonIssue.provider.is_not(None)).group_by(MonIssue.provider))).all())

    envsql = "" if env == "all" else "AND i.environment = :env"
    rows = (await db.execute(text(
        f"SELECT h.bucket, sum(h.count) FROM mon_issue_hourly h JOIN mon_issues i ON i.id = h.issue_id "
        f"WHERE h.bucket >= now() - interval '24 hours' {envsql} GROUP BY h.bucket"), {"env": env})).all()
    buckets = _hour_buckets(24)
    by_b = {b.astimezone(timezone.utc).replace(minute=0, second=0, microsecond=0): int(c) for b, c in rows}
    series = [{"t": b.isoformat(), "count": by_b.get(b, 0)} for b in buckets]

    top_rows = (await db.execute(text(
        f"SELECT i.id FROM mon_issues i JOIN mon_issue_hourly h ON h.issue_id = i.id "
        f"WHERE i.status='unresolved' AND h.bucket >= now() - interval '24 hours' {envsql} "
        f"GROUP BY i.id ORDER BY sum(h.count) DESC LIMIT 6"), {"env": env})).all()
    top_ids = [r[0] for r in top_rows]
    top = []
    if top_ids:
        issues = (await db.execute(select(MonIssue).where(MonIssue.id.in_(top_ids)))).scalars().all()
        sp = await _sparks(db, top_ids)
        order = {i: n for n, i in enumerate(top_ids)}
        top = [_issue_dict(i, sp.get(i.id)) for i in sorted(issues, key=lambda x: order[x.id])]

    return {
        "environment_api": capture.ENVIRONMENT, "env": env,
        "issues": {"unresolved": unresolved, "fatal": fatal, "new_24h": new24, "resolved_7d": resolved7},
        "events_24h": series, "events_24h_total": sum(s["count"] for s in series),
        "by_source": by_source, "by_provider": by_provider, "top_issues": top,
    }


@router.get("/issues")
async def list_issues(
    status: str = "unresolved", source: str | None = None, provider: str | None = None, level: str | None = None,
    env: str = "production", q: str | None = None, sort: str = "last_seen", limit: int = Query(50, le=200), offset: int = 0,
    _=Depends(require_superadmin), db: AsyncSession = Depends(get_db),
):
    conds = _env_filter(env)
    if status != "all":
        conds.append(MonIssue.status == status)
    if source:
        conds.append(MonIssue.source == source)
    if provider:
        conds.append(MonIssue.provider == provider)
    if level:
        conds.append(MonIssue.level == level)
    if q:
        like = f"%{q}%"
        conds.append(or_(MonIssue.title.ilike(like), MonIssue.culprit.ilike(like)))
    total = (await db.execute(select(func.count()).select_from(MonIssue).where(*conds))).scalar() or 0
    order = {"occurrences": MonIssue.occurrences.desc(), "first_seen": MonIssue.first_seen.desc()}.get(sort, MonIssue.last_seen.desc())
    rows = (await db.execute(select(MonIssue).where(*conds).order_by(order).limit(limit).offset(offset))).scalars().all()
    sp = await _sparks(db, [r.id for r in rows])
    return {"total": total, "items": [_issue_dict(r, sp.get(r.id)) for r in rows]}


@router.get("/issues/{issue_id}")
async def issue_detail(issue_id: uuid.UUID, _=Depends(require_superadmin), db: AsyncSession = Depends(get_db)):
    issue = await db.get(MonIssue, issue_id)
    if not issue:
        raise HTTPException(404, "Incidencia no encontrada")
    events = (await db.execute(select(MonEvent).where(MonEvent.issue_id == issue_id).order_by(MonEvent.ts.desc()).limit(30))).scalars().all()
    d7 = await _sparks(db, [issue_id], hours=24 * 7)
    d24 = await _sparks(db, [issue_id], hours=24)
    return {
        "issue": _issue_dict(issue, d24.get(issue_id)),
        "series_7d": d7.get(issue_id, []),
        "events": [{
            "id": str(e.id), "ts": e.ts, "level": e.level, "message": e.message, "stack": e.stack, "request_id": e.request_id,
            "route": e.route, "http_method": e.http_method, "http_status": e.http_status, "duration_ms": e.duration_ms,
            "user_name": e.user_name, "rol": e.rol, "hostname": e.hostname, "punto_emision": e.punto_emision, "release": e.release,
            "app_version": e.app_version, "url": e.url, "client_ip": e.client_ip, "user_agent": e.user_agent,
            "breadcrumbs": e.breadcrumbs, "extra": e.extra,
        } for e in events],
    }


class StatusBody(BaseModel):
    status: str = Field(pattern="^(unresolved|resolved|ignored)$")
    note: str | None = Field(default=None, max_length=500)
    ignore_hours: int | None = Field(default=None, ge=1, le=24 * 90)


class BulkBody(StatusBody):
    ids: list[uuid.UUID] = Field(min_length=1, max_length=200)


def _apply_status(issue: MonIssue, body: StatusBody, actor: dict) -> None:
    now = datetime.now(timezone.utc)
    issue.status = body.status
    if body.note is not None:
        issue.note = body.note
    if body.status == "resolved":
        issue.resolved_at, issue.resolved_release = now, issue.last_release
        issue.resolved_by = (actor.get("user_nombre") or actor.get("user_email") or "")[:120]
        issue.ignored_until = None
    elif body.status == "ignored":
        issue.ignored_until = now + timedelta(hours=body.ignore_hours) if body.ignore_hours else None
    else:
        issue.resolved_at = issue.ignored_until = None


@router.post("/issues/{issue_id}/status")
async def set_status(issue_id: uuid.UUID, body: StatusBody, request: Request, user=Depends(require_superadmin), db: AsyncSession = Depends(get_db)):
    issue = await db.get(MonIssue, issue_id, with_for_update=True)
    if not issue:
        raise HTTPException(404, "Incidencia no encontrada")
    before = issue.status
    _apply_status(issue, body, user)
    await write_audit(db, user, f"incidencia_{body.status}", target_type="incidencia", target_id=str(issue.id),
                      target_label=issue.title, before={"status": before}, after={"status": body.status, "note": body.note}, request=request)
    return _issue_dict(issue)


@router.post("/issues/bulk-status")
async def bulk_status(body: BulkBody, request: Request, user=Depends(require_superadmin), db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(select(MonIssue).where(MonIssue.id.in_(body.ids)).with_for_update())).scalars().all()
    for i in rows:
        _apply_status(i, body, user)
    await write_audit(db, user, f"incidencias_{body.status}", target_type="incidencia", target_label=f"{len(rows)} incidencias",
                      after={"status": body.status, "ids": [str(i.id) for i in rows][:50]}, request=request)
    return {"updated": len(rows)}


@router.delete("/issues/{issue_id}", status_code=204)
async def delete_issue(issue_id: uuid.UUID, request: Request, user=Depends(require_superadmin), db: AsyncSession = Depends(get_db)):
    issue = await db.get(MonIssue, issue_id)
    if not issue:
        raise HTTPException(404, "Incidencia no encontrada")
    await write_audit(db, user, "incidencia_eliminada", target_type="incidencia", target_id=str(issue.id), target_label=issue.title, request=request)
    await db.delete(issue)


@router.post("/issues/test")
async def create_test_issue(user=Depends(require_superadmin)):
    """Genera una incidencia de prueba (nivel warning: no dispara WhatsApp) para ver el circuito completo."""
    r = await capture.record({
        "source": "backend", "level": "warning", "kind": "PruebaDePlataforma", "message": "Incidencia de prueba generada desde la consola",
        "frame": "plataforma/router.py:create_test_issue", "hostname": "CONSOLA", "user_name": (user.get("user_nombre") or "superadmin"),
        "extra": {"origen": "boton de prueba"},
    })
    return r


class SettingsBody(BaseModel):
    whatsapp_enabled: bool | None = None
    bell_enabled: bool | None = None
    alert_phone: str | None = Field(default=None, pattern=r"^\d{10,15}$")


@router.get("/settings")
async def get_settings(_=Depends(require_superadmin), db: AsyncSession = Depends(get_db)):
    return await alerts.load_settings(db)


@router.put("/settings")
async def put_settings(body: SettingsBody, request: Request, user=Depends(require_superadmin), db: AsyncSession = Depends(get_db)):
    before = await alerts.load_settings(db)
    new = await alerts.save_settings(db, {k: v for k, v in body.model_dump().items() if v is not None})
    await write_audit(db, user, "alertas_configuradas", target_type="alertas", before=before, after=new, request=request)
    return new


@router.post("/alerts/test")
async def alerts_test(_=Depends(require_superadmin)):
    return await alerts.notify("test", "Prueba de alertas de la consola", ["Si te llegó, las alertas funcionan."], "/plataforma?tab=incidencias")


@router.get("/audit")
async def list_audit(limit: int = Query(100, le=500), offset: int = 0, action: str | None = None, q: str | None = None,
                     _=Depends(require_superadmin), db: AsyncSession = Depends(get_db)):
    conds = []
    if action:
        conds.append(PlatformAudit.action.ilike(f"{action}%"))
    if q:
        conds.append(or_(PlatformAudit.target_label.ilike(f"%{q}%"), PlatformAudit.actor_name.ilike(f"%{q}%")))
    total = (await db.execute(select(func.count()).select_from(PlatformAudit).where(*conds))).scalar() or 0
    rows = (await db.execute(select(PlatformAudit).where(*conds).order_by(PlatformAudit.ts.desc()).limit(limit).offset(offset))).scalars().all()
    return {"total": total, "items": [{
        "id": str(a.id), "ts": a.ts, "actor_name": a.actor_name, "action": a.action, "target_type": a.target_type,
        "target_id": a.target_id, "target_label": a.target_label, "before": a.before, "after": a.after, "client_ip": a.client_ip,
    } for a in rows]}
