"""Security service — API keys, rate limiting"""

import hashlib
import os
import time
from typing import Optional
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

_rate_limits: dict[str, list[float]] = {}


def generate_api_key() -> str:
    return f"sk_{os.urandom(24).hex()}"


def hash_key(key: str) -> str:
    return hashlib.sha256(key.encode()).hexdigest()


async def store_api_key(db: AsyncSession, company_id: str, key: str, label: str = "") -> str:
    key_hash = hash_key(key)
    await db.execute(
        text("""
            INSERT INTO api_keys (company_id, key_hash, label, prefix, activo, created_at)
            VALUES (:company_id, :key_hash, :label, :prefix, true, NOW())
        """),
        {
            "company_id": company_id,
            "key_hash": key_hash,
            "label": label or "API Key",
            "prefix": key[:10],
        },
    )
    await db.flush()
    return key


async def validate_api_key(db: AsyncSession, key: str) -> Optional[str]:
    key_hash = hash_key(key)
    result = await db.execute(
        text("SELECT company_id FROM api_keys WHERE key_hash = :key_hash AND activo = true"),
        {"key_hash": key_hash},
    )
    row = result.mappings().first()
    return str(row["company_id"]) if row else None


async def list_api_keys(db: AsyncSession, company_id: str) -> list[dict]:
    result = await db.execute(
        text("SELECT id, prefix, label, activo, created_at, last_used_at FROM api_keys WHERE company_id = :cid ORDER BY created_at DESC"),
        {"cid": company_id},
    )
    return [dict(r) for r in result.mappings().all()]


async def revoke_api_key(db: AsyncSession, key_id: str) -> bool:
    result = await db.execute(
        text("UPDATE api_keys SET activo = false WHERE id = :id"),
        {"id": key_id},
    )
    await db.flush()
    return result.rowcount > 0


def check_rate_limit(key: str, max_requests: int = 100, window_seconds: int = 60) -> bool:
    now = time.time()
    window_start = now - window_seconds
    
    if key not in _rate_limits:
        _rate_limits[key] = []
    
    _rate_limits[key] = [t for t in _rate_limits[key] if t > window_start]
    
    if len(_rate_limits[key]) >= max_requests:
        return False
    
    _rate_limits[key].append(now)
    return True
