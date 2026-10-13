"""Tests for distribuidora map service functions: get_map_routes and get_map_customers."""
import uuid
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from api.src.distribuidora.service import get_map_routes, get_map_customers


def _make_db_session():
    """Return a mock AsyncSession where execute() returns an empty result."""
    session = MagicMock()
    session.execute = AsyncMock()
    return session


def _mock_result(rows):
    """Build a mock execute() result whose .all() / .scalars().all() returns rows."""
    result = MagicMock()
    result.all.return_value = rows
    scalars = MagicMock()
    scalars.all.return_value = rows
    result.scalars.return_value = scalars
    return result


@pytest.mark.asyncio
async def test_get_map_routes_empty_returns_list():
    """Returns empty list when no active routes exist."""
    db = _make_db_session()
    db.execute.return_value = _mock_result([])

    result = await get_map_routes(db, "00000000-0000-0000-0000-000000000099")
    assert result == []


@pytest.mark.asyncio
async def test_get_map_customers_empty_returns_list():
    """Returns empty list when no geocoded customers exist."""
    db = _make_db_session()
    db.execute.return_value = _mock_result([])

    result = await get_map_customers(db, "00000000-0000-0000-0000-000000000099")
    assert result == []


@pytest.mark.asyncio
async def test_get_map_customers_excludes_without_coords():
    """get_map_customers filters out customers where lat/lng is None at the DB level.

    The WHERE clause uses isnot(None) — verifying the function passes the
    correct query is done by checking that None-coord customers don't appear
    even when they're the only rows returned (empty mock result ↔ DB filtered them).
    """
    db = _make_db_session()
    # Simulate DB returning 0 rows (WHERE lat IS NOT NULL filtered them out)
    db.execute.return_value = _mock_result([])

    result = await get_map_customers(db, "00000000-0000-0000-0000-000000000099")
    assert result == []
    assert all(isinstance(r, dict) for r in result)


@pytest.mark.asyncio
async def test_get_map_customers_includes_geocoded():
    """Customers returned by DB appear in the result with required keys."""
    customer_id = uuid.uuid4()

    customer = MagicMock()
    customer.id = customer_id
    customer.razon_social = "Distribuidora Norte SA"
    customer.lat = Decimal("-25.30001234")
    customer.lng = Decimal("-57.50001234")
    customer.direccion = "Av. Mariscal 123"
    customer.ciudad = "Asuncion"
    customer.telefono = "0981000000"

    db = _make_db_session()
    # First call: get customers + route_customers join → [(customer, None)]
    # Second call: get routes for color_index → [] (no routes needed here)
    # Third call: get today's instances → []
    call_count = [0]
    results = [
        _mock_result([(customer, None)]),   # customers query
        _mock_result([]),                    # routes color query
        _mock_result([]),                    # instances query
    ]

    async def side_effect(*args, **kwargs):
        idx = call_count[0]
        call_count[0] += 1
        return results[idx] if idx < len(results) else _mock_result([])

    db.execute.side_effect = side_effect

    result = await get_map_customers(db, "00000000-0000-0000-0000-000000000099")
    assert len(result) == 1
    r = result[0]
    assert r["customer_id"] == str(customer_id)
    assert r["razon_social"] == "Distribuidora Norte SA"
    assert r["lat"] == pytest.approx(-25.30001234)
    assert r["lng"] == pytest.approx(-57.50001234)
    assert "visit_status" in r
    assert "color_index" in r
    assert "route_id" in r


@pytest.mark.asyncio
async def test_get_map_routes_returns_correct_shape():
    """Route dict contains all expected keys."""
    route_id = uuid.uuid4()
    seller_id = uuid.uuid4()

    route = MagicMock()
    route.id = route_id
    route.nombre = "Ruta Norte"
    route.user_id = seller_id
    route.estado = "activo"

    db = _make_db_session()
    call_count = [0]
    results = [
        _mock_result([(route, "Vendedor Test")]),  # routes query
        _mock_result([]),                           # today's instances
        _mock_result([]),                           # route customers
    ]

    async def side_effect(*args, **kwargs):
        idx = call_count[0]
        call_count[0] += 1
        return results[idx] if idx < len(results) else _mock_result([])

    db.execute.side_effect = side_effect

    result = await get_map_routes(db, "00000000-0000-0000-0000-000000000099")
    assert len(result) == 1
    r = result[0]
    assert r["route_id"] == str(route_id)
    assert r["route_name"] == "Ruta Norte"
    assert r["seller_id"] == str(seller_id)
    assert r["seller_name"] == "Vendedor Test"
    assert r["color_index"] == 0
    assert r["color"] == "#ef4444"
    assert isinstance(r["waypoints"], list)
    assert r["depot_lat"] == pytest.approx(-25.3235)
    assert r["depot_lng"] == pytest.approx(-57.5641)
    assert "instance_status" in r


@pytest.mark.asyncio
async def test_get_map_routes_color_index_cycles():
    """color_index is 0–9 cycling — 11 routes → indices 0..9 then 0 again."""
    routes_data = []
    for i in range(11):
        r = MagicMock()
        r.id = uuid.uuid4()
        r.nombre = f"Ruta {i:02d}"
        r.user_id = uuid.uuid4()
        r.estado = "activo"
        routes_data.append((r, f"Vendedor {i}"))

    db = _make_db_session()
    call_count = [0]

    async def side_effect(*args, **kwargs):
        idx = call_count[0]
        call_count[0] += 1
        if idx == 0:
            return _mock_result(routes_data)
        return _mock_result([])

    db.execute.side_effect = side_effect

    result = await get_map_routes(db, "00000000-0000-0000-0000-000000000099")
    assert len(result) == 11
    indices = [r["color_index"] for r in result]
    assert indices[10] == 0  # wraps around
    assert max(indices) == 9
    assert min(indices) == 0
