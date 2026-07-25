"""Routing service for delivery route optimization.

Supports multiple backends:
  - OpenRouteService (ORS) — free tier, no API key for basic
  - OSRM demo server — free, no API key
  - Haversine fallback — built-in, no external deps
"""

import math
import asyncio
import logging
from typing import Any
from urllib.parse import quote

import httpx

logger = logging.getLogger(__name__)

# ── Haversine utilities ──────────────────────────────────────────

def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    R = 6371
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = math.sin(dlat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlng / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def estimate_duration_min(km: float) -> int:
    return max(1, round(km / 40 * 60))  # avg 40 km/h in city


# ── Routing backends ────────────────────────────────────────────

class ORSRouter:
    """OpenRouteService routing API."""

    BASE = "https://api.openrouteservice.org/v2"

    def __init__(self, api_key: str | None = None):
        self.api_key = api_key

    async def route(self, coords: list[tuple[float, float]], profile: str = "driving-car") -> dict | None:
        if len(coords) < 2:
            return None
        locs = [{"type": "Point", "coordinates": [lng, lat]} for lat, lng in coords]
        # If not enough coords, or API fails, return None
        url = f"{self.BASE}/directions/{profile}/json"
        headers = {"Content-Type": "application/json; charset=utf-8"}
        if self.api_key:
            headers["Authorization"] = self.api_key
        body = {
            "coordinates": [[lng, lat] for lat, lng in coords],
            "format": "json",
            "instructions": False,
        }
        try:
            async with httpx.AsyncClient(timeout=15) as client:
                resp = await client.post(url, json=body, headers=headers)
                if resp.status_code == 200:
                    data = resp.json()
                    routes = data.get("routes", [])
                    if routes:
                        s = routes[0].get("summary", {})
                        return {
                            "distance_km": round(s.get("distance", 0) / 1000, 2),
                            "duration_min": round(s.get("duration", 0) / 60),
                        }
        except Exception as e:
            logger.warning(f"ORS routing failed: {e}")
        return None


class OSRMRouter:
    """OSRM demo server (no API key needed, rate-limited)."""

    BASE = "https://router.project-osrm.org"

    async def route(self, coords: list[tuple[float, float]]) -> dict | None:
        if len(coords) < 2:
            return None
        loc_str = ";".join(f"{lng},{lat}" for lat, lng in coords)
        url = f"{self.BASE}/route/v1/driving/{loc_str}?overview=false&steps=false"
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.get(url, headers={"Accept": "application/json"})
                if resp.status_code == 200:
                    data = resp.json()
                    routes = data.get("routes", [])
                    if routes:
                        s = routes[0]
                        return {
                            "distance_km": round(s.get("distance", 0) / 1000, 2),
                            "duration_min": round(s.get("duration", 0) / 60),
                        }
        except Exception as e:
            logger.warning(f"OSRM routing failed: {e}")
        return None


# ── Route optimizer (TSP using nearest-neighbor) ────────────────

def optimize_stop_order(stops: list[dict]) -> list[dict]:
    """Re-order stops using nearest-neighbor heuristic for TSP.

    Each stop dict must have 'lat' and 'lng' keys.
    First stop is the origin (warehouse/depot), returned as first element.
    """
    if len(stops) <= 2:
        return stops

    ordered = [stops[0]]
    remaining = list(stops[1:])

    while remaining:
        last = ordered[-1]
        nearest_idx = min(
            range(len(remaining)),
            key=lambda i: haversine_km(last["lat"], last["lng"], remaining[i]["lat"], remaining[i]["lng"]),
        )
        ordered.append(remaining.pop(nearest_idx))

    return ordered


# ── Main routing facade ─────────────────────────────────────────

class RoutingService:
    """Routing service with automatic fallback chain."""

    def __init__(self, ors_api_key: str | None = None):
        self.backends = []
        if ors_api_key:
            self.backends.append(ORSRouter(ors_api_key))
        self.backends.append(OSRMRouter())

    async def get_route(self, coords: list[tuple[float, float]]) -> dict:
        """Get route distance and duration between coordinates.

        Returns:
            { distance_km: float, duration_min: int, source: str }
        """
        for backend in self.backends:
            result = await backend.route(coords)
            if result:
                return {**result, "source": backend.__class__.__name__}
        # Fallback to Haversine
        total_km = sum(
            haversine_km(coords[i][0], coords[i][1], coords[i + 1][0], coords[i + 1][1])
            for i in range(len(coords) - 1)
        )
        return {
            "distance_km": round(total_km, 2),
            "duration_min": estimate_duration_min(total_km),
            "source": "haversine",
        }

    async def get_distance_matrix(self, points: list[tuple[float, float]]) -> list[list[float]]:
        """Compute distance matrix (km) between all point pairs."""
        n = len(points)
        matrix = [[0.0] * n for _ in range(n)]
        for i in range(n):
            for j in range(i + 1, n):
                d = haversine_km(points[i][0], points[i][1], points[j][0], points[j][1])
                matrix[i][j] = d
                matrix[j][i] = d
        return matrix


# Singleton
routing_service = RoutingService()
