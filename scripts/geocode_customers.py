#!/usr/bin/env python3
"""Geocodifica clientes de una empresa usando Google Geocoding API.

Uso:
  python scripts/geocode_customers.py --company-id 00000000-0000-0000-0000-000000000010
  python scripts/geocode_customers.py --company-id 00000000-0000-0000-0000-000000000010 --dry-run

Requiere:
  DATABASE_URL y GOOGLE_MAPS_API_KEY en el entorno (o .env).
"""
import argparse
import asyncio
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import httpx
from dotenv import load_dotenv
from sqlalchemy import select, update, text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

# Cargar .env desde la raíz del proyecto api/
load_dotenv(Path(__file__).parent.parent / "api" / ".env")

GEOCODE_URL = "https://maps.googleapis.com/maps/api/geocode/json"
RATE_LIMIT_SLEEP = 0.02  # 50 req/s


async def geocode_address(client: httpx.AsyncClient, address: str, api_key: str) -> tuple[float, float] | None:
    """Devuelve (lat, lng) o None si no hay resultado."""
    for attempt in range(3):
        try:
            resp = await client.get(
                GEOCODE_URL,
                params={"address": address, "key": api_key},
                timeout=10.0,
            )
            data = resp.json()
            if data.get("status") == "OK":
                loc = data["results"][0]["geometry"]["location"]
                return float(loc["lat"]), float(loc["lng"])
            if data.get("status") == "ZERO_RESULTS":
                return None
            # Otros errores (REQUEST_DENIED, OVER_QUERY_LIMIT, etc.)
            print(f"  API status={data.get('status')} — reintentando ({attempt+1}/3)")
        except Exception as e:
            print(f"  Error de red: {e} — reintentando ({attempt+1}/3)")
        await asyncio.sleep(2 ** attempt)
    return None


async def run(company_id: str, dry_run: bool) -> None:
    db_url = os.environ.get("DATABASE_URL", "")
    api_key = os.environ.get("GOOGLE_MAPS_API_KEY", "")

    if not db_url:
        sys.exit("ERROR: DATABASE_URL no encontrado en entorno.")
    if not api_key and not dry_run:
        sys.exit("ERROR: GOOGLE_MAPS_API_KEY no encontrado en entorno.")

    engine = create_async_engine(db_url, echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        result = await session.execute(
            text("""
                SELECT id, razon_social, direccion, ciudad
                FROM customers
                WHERE company_id = :company_id
                  AND (lat IS NULL OR geocoded_at IS NULL)
                ORDER BY razon_social
            """),
            {"company_id": company_id},
        )
        rows = result.fetchall()

    print(f"Clientes sin geocodificar: {len(rows)}")
    if dry_run:
        for row in rows[:20]:
            addr = f"{row.direccion or ''}, {row.ciudad or ''}, Paraguay".strip(", ")
            print(f"  [{row.id}] {row.razon_social} → '{addr}'")
        if len(rows) > 20:
            print(f"  ... y {len(rows) - 20} más")
        print("(dry-run: no se escribió nada)")
        return

    ok = 0
    zero = 0
    errors = 0

    async with httpx.AsyncClient() as http_client:
        async with async_session() as session:
            for row in rows:
                addr = f"{row.direccion or ''}, {row.ciudad or ''}, Paraguay".strip(", ")
                coords = await geocode_address(http_client, addr, api_key)

                if coords:
                    lat, lng = coords
                    await session.execute(
                        text("""
                            UPDATE customers
                            SET lat = :lat, lng = :lng, geocoded_at = :now
                            WHERE id = :id
                        """),
                        {"lat": lat, "lng": lng, "now": datetime.now(timezone.utc), "id": str(row.id)},
                    )
                    ok += 1
                    print(f"  OK  {row.razon_social[:40]:40s} → ({lat:.5f}, {lng:.5f})")
                else:
                    # Marcar geocoded_at para no reintentar indefinidamente
                    await session.execute(
                        text("UPDATE customers SET geocoded_at = :now WHERE id = :id"),
                        {"now": datetime.now(timezone.utc), "id": str(row.id)},
                    )
                    zero += 1
                    print(f"  0   {row.razon_social[:40]:40s} → ZERO_RESULTS")

                await session.commit()
                time.sleep(RATE_LIMIT_SLEEP)

    print(f"\nGecodificados: {ok}  |  Sin resultado: {zero}  |  Errores: {errors}")
    await engine.dispose()


def main() -> None:
    parser = argparse.ArgumentParser(description="Geocodifica clientes via Google Geocoding API")
    parser.add_argument("--company-id", required=True, help="UUID de la empresa")
    parser.add_argument("--dry-run", action="store_true", help="Solo muestra qué procesaría, no escribe")
    args = parser.parse_args()
    asyncio.run(run(args.company_id, args.dry_run))


if __name__ == "__main__":
    main()
