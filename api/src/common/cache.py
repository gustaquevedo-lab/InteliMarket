"""Redis-based caching layer."""

import json
from functools import lru_cache
from typing import Any, Optional

import redis.asyncio as aioredis

from api.src.config import settings


@lru_cache()
def _get_redis() -> aioredis.Redis:
    return aioredis.from_url(
        settings.redis_url,
        decode_responses=True,
        socket_connect_timeout=2,
        socket_timeout=2,
        retry_on_timeout=True,
    )


async def cache_get(key: str) -> Optional[Any]:
    """Get a JSON value from cache."""
    try:
        r = _get_redis()
        val = await r.get(key)
        return json.loads(val) if val else None
    except Exception:
        return None


async def cache_set(key: str, value: Any, ttl: int = 300) -> bool:
    """Set a JSON value in cache with TTL (seconds)."""
    try:
        r = _get_redis()
        await r.setex(key, ttl, json.dumps(value, default=str))
        return True
    except Exception:
        return False


async def cache_delete(key: str) -> bool:
    """Delete a key from cache."""
    try:
        r = _get_redis()
        await r.delete(key)
        return True
    except Exception:
        return False


async def cache_delete_pattern(pattern: str) -> bool:
    """Delete all keys matching a pattern."""
    try:
        r = _get_redis()
        keys = await r.keys(pattern)
        if keys:
            await r.delete(*keys)
        return True
    except Exception:
        return False


def tenant_features_key(tenant_id: str) -> str:
    return f"tenant:features:{tenant_id}"
