"""Auditoria de cambios del superadmin (quien cambio que, cuando, desde donde).

Los secretos nunca se guardan: solo se registra que cambiaron.
"""
from api.src.plataforma.models import PlatformAudit

SECRET_KEYS = {
    "password", "private_key", "callback_password", "cached_token", "cached_refresh_token",
    "cached_token_expires_at", "api_key", "hmac_secret", "client_secret", "secret",
}
MASK = "••••"


def diff_config(before: dict | None, after: dict | None) -> tuple[dict, dict]:
    """Devuelve (antes, despues) solo con los campos que cambiaron; secretos enmascarados."""
    before, after = before or {}, after or {}
    b, a = {}, {}
    for k in sorted(set(before) | set(after)):
        if k in ("cached_token", "cached_refresh_token", "cached_token_expires_at"):
            continue
        bv, av = before.get(k), after.get(k)
        if bv == av:
            continue
        if k in SECRET_KEYS:
            b[k] = MASK if bv else None
            a[k] = MASK + " (cambiado)" if av else None
        else:
            b[k], a[k] = bv, av
    return b, a


def client_ip(request) -> str | None:
    if request is None:
        return None
    xff = request.headers.get("x-forwarded-for")
    if xff:
        return xff.split(",")[0].strip()[:45]
    return request.client.host[:45] if request.client else None


async def write_audit(db, actor: dict, action: str, *, target_type: str, target_id: str = "", target_label: str = "",
                      before=None, after=None, company_id=None, request=None) -> None:
    db.add(PlatformAudit(
        actor_id=str(actor.get("id") or actor.get("sub") or "")[:40],
        actor_name=(actor.get("user_nombre") or actor.get("user_email") or "")[:120],
        action=action[:60], target_type=target_type[:40], target_id=str(target_id)[:80], target_label=str(target_label)[:160],
        company_id=company_id, before=before, after=after, client_ip=client_ip(request),
    ))
    await db.flush()
