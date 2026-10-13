"""Rate limiting basico basado en Redis (fixed window), pensado para endpoints
publicos de login. Falla abierto (permite la request) si Redis no responde,
para no bloquear el acceso de cajeras/staff por una caida de Redis."""

from fastapi import HTTPException, Request

from api.src.common.cache import _get_redis


def _client_ip(request: Request) -> str:
    fwd = request.headers.get("x-forwarded-for")
    if fwd:
        return fwd.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def rate_limiter(key_prefix: str, max_attempts: int, window_seconds: int):
    async def _dep(request: Request) -> None:
        ip = _client_ip(request)
        key = f"ratelimit:{key_prefix}:{ip}"
        try:
            r = _get_redis()
            count = await r.incr(key)
            if count == 1:
                await r.expire(key, window_seconds)
            if count > max_attempts:
                ttl = await r.ttl(key)
                raise HTTPException(
                    status_code=429,
                    detail="Demasiados intentos. Espera un momento antes de volver a intentar.",
                    headers={"Retry-After": str(max(ttl, 1))},
                )
        except HTTPException:
            raise
        except Exception:
            return
    return _dep


login_rate_limit = rate_limiter("login", max_attempts=8, window_seconds=60)
