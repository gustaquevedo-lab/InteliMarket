"""Motor de incidencias: recibe errores de cualquier origen (backend, navegador,
Electron, integraciones), los agrupa por huella, cuenta ocurrencias, detecta
regresiones y picos y avisa al superadmin.

Regla de oro: capturar un error NUNCA puede romper ni frenar la operacion.
Todo va en tareas aparte, con su propia sesion de base, y cualquier falla aca
se traga (con un freno de emergencia si la base misma esta caida).
"""
import asyncio
import collections
import hashlib
import logging
import re
import time
import traceback
from datetime import datetime, timedelta, timezone

from sqlalchemy import select, text
from sqlalchemy.exc import IntegrityError

from api.src.config import settings
from api.src.db import async_session_factory
from api.src.plataforma.models import MonEvent, MonIssue

log = logging.getLogger("intelimarket.monitor")

ENVIRONMENT = "sandbox" if "sandbox" in (settings.db_search_path or "") else "production"
LEVELS = ("fatal", "error", "warning", "info")
SOURCES = ("backend", "frontend", "electron", "integration")
KEEP_EVENTS_PER_ISSUE = 60
SPIKE_WINDOW_MIN = 5
SPIKE_REALERT_MIN = 30
IGNORE_PATHS = ("/api/v1/monitor", "/api/health", "/api/v1/sistema/salud")

_UUID = re.compile(r"[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}")
_LONGHEX = re.compile(r"\b[0-9a-fA-F]{16,}\b")
_BIGNUM = re.compile(r"\b\d{13,19}\b")
_NUM = re.compile(r"\d+")
_SECRET_KV = re.compile(r"(?i)(password|passwd|pwd|secret|token|authorization|api[_-]?key|private[_-]?key)(['\"]?\s*[:=]\s*['\"]?)([^\s,'\"&;)]+)")
_BEARER = re.compile(r"(?i)bearer\s+[A-Za-z0-9._\-]+")
_ASSET_HASH = re.compile(r"-[A-Za-z0-9_-]{6,10}\.(js|css|mjs)")

_tasks: set = set()
_fail_times: collections.deque = collections.deque(maxlen=10)


def _cap(v, n: int):
    if v is None:
        return None
    v = str(v)
    return v if len(v) <= n else v[: n - 1] + "…"


def scrub(text_: str | None, limit: int = 4000) -> str | None:
    """Saca claves, tokens y numeros de tarjeta antes de guardar cualquier texto."""
    if not text_:
        return text_
    t = str(text_)
    t = _BEARER.sub("Bearer ****", t)
    t = _SECRET_KV.sub(lambda m: f"{m.group(1)}{m.group(2)}****", t)
    t = _BIGNUM.sub("<num>", t)
    return _cap(t, limit)


def normalize_message(msg: str | None) -> str:
    m = (msg or "").strip().splitlines()[0] if (msg or "").strip() else ""
    m = _UUID.sub("<uuid>", m)
    m = _LONGHEX.sub("<hex>", m)
    m = _NUM.sub("<n>", m)
    return m[:160]


def js_top_frame(stack: str | None) -> str | None:
    if not stack:
        return None
    for line in stack.splitlines()[1:8]:
        m = re.search(r"(?:https?://[^/\s)]+)?/([^\s):]+\.(?:js|mjs|tsx?|jsx?))", line)
        if m:
            f = _ASSET_HASH.sub(r".\1", m.group(1).split("/")[-1])
            fn = re.search(r"at\s+([^\s(]+)", line)
            return f"{f}:{fn.group(1) if fn else '?'}"
    return None


def py_top_frame(exc: BaseException) -> str | None:
    tb = traceback.extract_tb(exc.__traceback__) if exc.__traceback__ else []
    mine = [f for f in tb if "/api/src/" in f.filename]
    f = (mine or tb or [None])[-1]
    if not f:
        return None
    path = f.filename.split("/api/src/", 1)[-1] if "/api/src/" in f.filename else f.filename.split("/")[-1]
    return f"{path}:{f.name}"


def compute_fingerprint(ev: dict) -> str:
    if ev["source"] == "integration":
        basis = "|".join(["integration", ev.get("provider") or "", ev.get("op") or "", normalize_message(ev.get("code") or ev.get("message"))])
    elif ev.get("http_status") and not ev.get("stack"):
        basis = "|".join([ev["source"], "http", str(ev["http_status"]), ev.get("route") or "", ev.get("http_method") or ""])
    else:
        basis = "|".join([ev["source"], ev.get("kind") or "", ev.get("frame") or "", normalize_message(ev.get("message"))])
    return hashlib.sha1(basis.encode()).hexdigest()


def make_title(ev: dict) -> str:
    if ev["source"] == "integration":
        head = f"{(ev.get('provider') or '?').upper()} · {ev.get('op') or 'operación'}"
        tail = ev.get("code") or normalize_message(ev.get("message"))
        return _cap(f"{head} · {tail}" if tail else head, 300)
    if ev.get("http_status") and not ev.get("stack"):
        return _cap(f"HTTP {ev['http_status']} · {ev.get('http_method') or ''} {ev.get('route') or ''}".strip(), 300)
    kind = ev.get("kind") or "Error"
    msg = normalize_message(ev.get("message"))
    return _cap(f"{kind}: {msg}" if msg else kind, 300)


def _bump(dims: dict, key: str, name: str | None, cap: int = 40) -> None:
    if not name:
        return
    m = dict(dims.get(key) or {})
    m[name] = int(m.get(name, 0)) + 1
    if len(m) > cap:
        for k, _ in sorted(m.items(), key=lambda kv: kv[1])[: len(m) - cap]:
            m.pop(k, None)
    dims[key] = m


# ── captura desde el servidor ────────────────────────────────────────────────

def _client_ip(request) -> str | None:
    if request is None:
        return None
    xff = request.headers.get("x-forwarded-for")
    if xff:
        return xff.split(",")[0].strip()[:45]
    return request.client.host[:45] if request.client else None


def _user_from_request(request) -> dict:
    if request is None:
        return {}
    try:
        from api.src.auth.jwt import decode_token
        auth = request.headers.get("authorization", "")
        if auth.lower().startswith("bearer "):
            p = decode_token(auth[7:])
            return {"user_id": str(p.get("sub") or "")[:40], "user_name": _cap(p.get("user_nombre") or p.get("user_email"), 120), "rol": _cap(p.get("rol"), 40)}
    except Exception:
        pass
    return {}


def _route_of(request) -> str:
    route = request.scope.get("route")
    return getattr(route, "path", None) or request.url.path


def _skip(request) -> bool:
    return request is not None and any(request.url.path.startswith(p) for p in IGNORE_PATHS)


def event_from_exception(exc: BaseException, request=None, *, source: str = "backend", extra: dict | None = None, level: str = "error") -> dict:
    tb = "".join(traceback.format_exception(type(exc), exc, exc.__traceback__, limit=-25))
    ev = {
        "source": source, "level": level, "kind": type(exc).__name__,
        "message": scrub(str(exc), 1500), "stack": scrub(tb, 8000), "frame": py_top_frame(exc),
        "release": None, "extra": extra,
    }
    if request is not None:
        ev.update({
            "route": _route_of(request), "http_method": request.method,
            "request_id": getattr(request.state, "request_id", None),
            "client_ip": _client_ip(request), "user_agent": _cap(request.headers.get("user-agent"), 300),
            "url": _cap(str(request.url.path), 500),
            **_user_from_request(request),
        })
    return ev


def submit(ev: dict) -> None:
    """Agenda el registro sin bloquear a nadie. Si no hay loop (arranque), se descarta."""
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        return
    t = loop.create_task(_safe_record(ev))
    _tasks.add(t)
    t.add_done_callback(_tasks.discard)


def capture_exception_bg(exc: BaseException, request=None, extra: dict | None = None) -> None:
    if _skip(request):
        return
    submit(event_from_exception(exc, request, extra=extra))


def capture_http_error_bg(request, status: int, detail: str | None) -> None:
    if _skip(request) or status < 500:
        return
    ev = {
        "source": "backend", "level": "error", "kind": "HTTPError", "message": scrub(detail, 800), "stack": None,
        "http_status": status, "route": _route_of(request), "http_method": request.method,
        "request_id": getattr(request.state, "request_id", None),
        "client_ip": _client_ip(request), "user_agent": _cap(request.headers.get("user-agent"), 300),
        **_user_from_request(request),
    }
    submit(ev)


def capture_message(message: str, *, source: str = "backend", level: str = "error", provider: str | None = None,
                    op: str | None = None, code: str | None = None, extra: dict | None = None, request=None) -> None:
    ev = {"source": source, "level": level, "kind": "Message", "message": scrub(message, 1500), "provider": provider,
          "op": op, "code": code, "extra": extra, "frame": None}
    if request is not None:
        ev.update({"request_id": getattr(request.state, "request_id", None), "client_ip": _client_ip(request), **_user_from_request(request)})
    submit(ev)


# ── registro ─────────────────────────────────────────────────────────────────

async def _safe_record(ev: dict) -> None:
    now = time.monotonic()
    while _fail_times and now - _fail_times[0] > 60:
        _fail_times.popleft()
    if len(_fail_times) >= 5:
        return  # la base esta mal: no la castigamos con mas escrituras
    try:
        await record(ev)
    except Exception as e:  # noqa: BLE001
        _fail_times.append(time.monotonic())
        log.warning("monitor: no se pudo registrar un evento: %s", str(e)[:200])


async def record(ev: dict) -> dict:
    ev = dict(ev)
    ev["source"] = ev.get("source") if ev.get("source") in SOURCES else "frontend"
    ev["level"] = ev.get("level") if ev.get("level") in LEVELS else "error"
    fp = compute_fingerprint(ev)
    title = make_title(ev)
    now = datetime.now(timezone.utc)
    alert_kind = None

    async with async_session_factory() as db:
        issue = (await db.execute(
            select(MonIssue).where(MonIssue.environment == ENVIRONMENT, MonIssue.fingerprint == fp).with_for_update()
        )).scalar_one_or_none()
        is_new = issue is None
        if is_new:
            issue = MonIssue(
                environment=ENVIRONMENT, fingerprint=fp, source=ev["source"], level=ev["level"], title=title,
                culprit=_cap(ev.get("frame") or ev.get("route") or ev.get("url"), 300), provider=_cap(ev.get("provider"), 40),
                first_seen=now, last_seen=now, occurrences=1, first_release=_cap(ev.get("release"), 60),
                last_release=_cap(ev.get("release"), 60), dims={},
            )
            db.add(issue)
            try:
                await db.flush()
            except IntegrityError:  # carrera: otro evento creo la misma huella justo antes
                await db.rollback()
                issue = (await db.execute(
                    select(MonIssue).where(MonIssue.environment == ENVIRONMENT, MonIssue.fingerprint == fp).with_for_update()
                )).scalar_one()
                is_new = False

        if not is_new:
            issue.occurrences = (issue.occurrences or 0) + 1
            issue.last_seen = now
            # el titulo se recalcula en cada ocurrencia: si el formato de kind/message
            # mejora del lado del cliente, una incidencia agrupada vieja no se queda
            # pegada con el texto formateado con el bug viejo (ej. "TypeError: TypeError: ...")
            if title:
                issue.title = title
            if ev.get("release"):
                issue.last_release = _cap(ev["release"], 60)
            if ev["level"] == "fatal" and issue.level != "fatal":
                issue.level = "fatal"
            if issue.status == "resolved":
                issue.status = "unresolved"
                issue.regressions = (issue.regressions or 0) + 1
                issue.resolved_at = None
                alert_kind = "regression"
            elif issue.status == "ignored" and issue.ignored_until and issue.ignored_until < now:
                issue.status = "unresolved"
                issue.ignored_until = None
        elif ev["level"] in ("error", "fatal"):
            alert_kind = "new"

        dims = dict(issue.dims or {})
        _bump(dims, "cajas", ev.get("hostname") or ev.get("punto_emision"))
        _bump(dims, "users", ev.get("user_name"))
        _bump(dims, "releases", ev.get("release"))
        _bump(dims, "routes", ev.get("route") or ev.get("url"))
        issue.dims = dims

        db.add(MonEvent(
            issue_id=issue.id, ts=now, level=ev["level"], message=scrub(ev.get("message"), 2000), stack=scrub(ev.get("stack"), 8000),
            request_id=_cap(ev.get("request_id"), 16), route=_cap(ev.get("route"), 300), http_method=_cap(ev.get("http_method"), 8),
            http_status=ev.get("http_status"), duration_ms=ev.get("duration_ms"), user_id=_cap(ev.get("user_id"), 40),
            user_name=_cap(ev.get("user_name"), 120), rol=_cap(ev.get("rol"), 40), hostname=_cap(ev.get("hostname"), 80),
            punto_emision=_cap(ev.get("punto_emision"), 10), release=_cap(ev.get("release"), 60), app_version=_cap(ev.get("app_version"), 40),
            url=_cap(ev.get("url"), 500), client_ip=_cap(ev.get("client_ip"), 45), user_agent=_cap(ev.get("user_agent"), 300),
            breadcrumbs=ev.get("breadcrumbs"), extra=_clean_extra(ev.get("extra")),
        ))
        await db.execute(text(
            "INSERT INTO mon_issue_hourly (issue_id, bucket, count) VALUES (:i, date_trunc('hour', now()), 1) "
            "ON CONFLICT (issue_id, bucket) DO UPDATE SET count = mon_issue_hourly.count + 1"), {"i": issue.id})

        # pico: muchas ocurrencias en pocos minutos
        if alert_kind is None and issue.status == "unresolved" and ev["level"] in ("error", "fatal") and (issue.occurrences or 0) >= 8:
            n = (await db.execute(text("SELECT count(*) FROM mon_events WHERE issue_id=:i AND ts > now() - make_interval(mins => :m)"),
                                  {"i": issue.id, "m": SPIKE_WINDOW_MIN})).scalar() or 0
            if n >= 8 and (issue.spike_alert_at is None or issue.spike_alert_at < now - timedelta(minutes=SPIKE_REALERT_MIN)):
                alert_kind = "spike"
                issue.spike_alert_at = now

        if issue.status == "ignored":
            alert_kind = None
        if alert_kind:
            issue.last_alert_at = now

        if (issue.occurrences or 0) % 20 == 0:
            await db.execute(text(
                "DELETE FROM mon_events WHERE issue_id=:i AND id NOT IN "
                "(SELECT id FROM mon_events WHERE issue_id=:i ORDER BY ts DESC LIMIT :k)"), {"i": issue.id, "k": KEEP_EVENTS_PER_ISSUE})

        snapshot = {"id": str(issue.id), "title": issue.title, "source": issue.source, "provider": issue.provider,
                    "occurrences": issue.occurrences, "level": issue.level, "hostname": ev.get("hostname"),
                    "punto_emision": ev.get("punto_emision"), "user_name": ev.get("user_name")}
        await db.commit()

    if alert_kind and ENVIRONMENT == "production":
        from api.src.plataforma.alerts import notify_issue
        await notify_issue(alert_kind, snapshot)
    return {"issue_id": snapshot["id"], "new": is_new}


def _clean_extra(extra):
    if not isinstance(extra, dict):
        return None
    out = {}
    for k, v in list(extra.items())[:30]:
        out[str(k)[:60]] = scrub(v, 500) if isinstance(v, str) else (v if isinstance(v, (int, float, bool, type(None))) else scrub(str(v), 500))
    return out


# ── log handler: cualquier logger.error/exception del backend se vuelve incidencia ──

class _MonitorLogHandler(logging.Handler):
    def emit(self, record: logging.LogRecord) -> None:
        try:
            if record.name.startswith("intelimarket.monitor") or record.levelno < logging.ERROR:
                return
            msg = record.getMessage()
            if msg.startswith(("Unhandled exception", "Database error")):
                return  # ya las captura el manejador global, con datos del request
            if record.exc_info and record.exc_info[1] is not None:
                ev = event_from_exception(record.exc_info[1], None, extra={"logger": record.name, "log_message": msg[:300]})
                if msg and msg not in ev["message"]:
                    ev["message"] = scrub(f"{msg} — {ev['message']}", 1500)
            else:
                ev = {"source": "backend", "level": "error", "kind": "LogError", "message": scrub(msg, 1500), "stack": None,
                      "frame": f"{record.pathname.split('/api/src/')[-1]}:{record.funcName}", "extra": {"logger": record.name}}
            submit(ev)
        except Exception:  # noqa: BLE001
            pass


def install_log_handler() -> None:
    root = logging.getLogger("intelimarket")
    if not any(isinstance(h, _MonitorLogHandler) for h in root.handlers):
        root.addHandler(_MonitorLogHandler(level=logging.ERROR))


# ── mantenimiento ────────────────────────────────────────────────────────────

async def prune_once() -> None:
    async with async_session_factory() as db:
        await db.execute(text("DELETE FROM mon_events WHERE ts < now() - interval '30 days'"))
        await db.execute(text("DELETE FROM mon_issue_hourly WHERE bucket < now() - interval '60 days'"))
        await db.execute(text("DELETE FROM mon_issues WHERE status <> 'unresolved' AND last_seen < now() - interval '90 days'"))
        await db.execute(text("DELETE FROM mon_heartbeats WHERE last_seen < now() - interval '90 days'"))
        await db.commit()


async def _prune_loop() -> None:
    await asyncio.sleep(120)
    while True:
        try:
            await prune_once()
        except Exception as e:  # noqa: BLE001
            log.warning("monitor: limpieza fallo: %s", str(e)[:200])
        await asyncio.sleep(6 * 3600)


def start_background() -> None:
    t = asyncio.get_running_loop().create_task(_prune_loop())
    _tasks.add(t)
    t.add_done_callback(_tasks.discard)
