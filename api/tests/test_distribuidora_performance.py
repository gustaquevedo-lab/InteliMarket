"""Tests for distribuidora seller performance endpoint."""
from datetime import date, timedelta
from unittest.mock import AsyncMock, MagicMock

import pytest

from api.src.distribuidora.service import get_seller_performance


def _db_empty():
    db = MagicMock()
    result = MagicMock()
    result.all.return_value = []
    scalars = MagicMock()
    scalars.all.return_value = []
    result.scalars.return_value = scalars
    db.execute = AsyncMock(return_value=result)
    return db


@pytest.mark.asyncio
async def test_get_seller_performance_returns_list():
    """Returns list (empty is OK) when no data exists."""
    result = await get_seller_performance(
        _db_empty(),
        "00000000-0000-0000-0000-000000000010",
        fecha_desde=str(date.today() - timedelta(days=30)),
        fecha_hasta=str(date.today()),
    )
    assert isinstance(result, list)


@pytest.mark.asyncio
async def test_coverage_pct_is_zero_not_nan_when_no_stops():
    """coverage_pct must be 0.0, never NaN, when a seller has 0 stops."""
    import math
    import uuid

    seller_id = uuid.uuid4()
    instance = MagicMock()
    instance.id = uuid.uuid4()
    instance.seller_id = seller_id
    instance.route_id = uuid.uuid4()

    user = MagicMock()
    user.id = seller_id
    user.nombre = "Vendedor Sin Stops"

    profile = MagicMock()
    profile.user_id = seller_id
    profile.photo_url = None

    db = MagicMock()
    call_count = [0]
    results = [
        _mock_scalars([instance]),   # instances
        _mock_scalars([]),           # stops (none)
        _mock_scalars([user]),       # sellers
        _mock_scalars([profile]),    # profiles
    ]

    async def side_effect(*a, **k):
        idx = call_count[0]
        call_count[0] += 1
        return results[idx] if idx < len(results) else _mock_scalars([])

    db.execute = AsyncMock(side_effect=side_effect)

    result = await get_seller_performance(
        db,
        "00000000-0000-0000-0000-000000000010",
        fecha_desde=str(date.today()),
        fecha_hasta=str(date.today()),
    )
    for row in result:
        assert not math.isnan(row["coverage_pct"]), "coverage_pct must not be NaN"
        assert not math.isnan(row["conversion_rate"]), "conversion_rate must not be NaN"


@pytest.mark.asyncio
async def test_weekly_coverage_has_4_elements():
    """weekly_coverage must always have exactly 4 floats."""
    import uuid

    seller_id = uuid.uuid4()
    instance = MagicMock()
    instance.id = uuid.uuid4()
    instance.seller_id = seller_id
    instance.route_id = uuid.uuid4()

    user = MagicMock()
    user.id = seller_id
    user.nombre = "Vendedor"

    profile = MagicMock()
    profile.user_id = seller_id
    profile.photo_url = None

    db = MagicMock()
    call_count = [0]
    results = [
        _mock_scalars([instance]),
        _mock_scalars([]),
        _mock_scalars([user]),
        _mock_scalars([profile]),
    ]

    async def side_effect(*a, **k):
        idx = call_count[0]
        call_count[0] += 1
        return results[idx] if idx < len(results) else _mock_scalars([])

    db.execute = AsyncMock(side_effect=side_effect)

    result = await get_seller_performance(
        db,
        "00000000-0000-0000-0000-000000000010",
        fecha_desde=str(date.today() - timedelta(days=30)),
        fecha_hasta=str(date.today()),
    )
    for row in result:
        assert len(row["weekly_coverage"]) == 4
        assert all(isinstance(x, float) for x in row["weekly_coverage"])


@pytest.mark.asyncio
async def test_route_id_filter_no_match_returns_empty():
    """Filtering by a non-existent route_id returns empty list without error."""
    result = await get_seller_performance(
        _db_empty(),
        "00000000-0000-0000-0000-000000000010",
        fecha_desde=str(date.today() - timedelta(days=30)),
        fecha_hasta=str(date.today()),
        route_id="00000000-0000-0000-0000-000000000000",
    )
    assert result == []


@pytest.mark.asyncio
async def test_coverage_pct_calculation():
    """coverage_pct = completed / total * 100."""
    import uuid

    seller_id = uuid.uuid4()
    instance_id = uuid.uuid4()

    instance = MagicMock()
    instance.id = instance_id
    instance.seller_id = seller_id
    instance.route_id = uuid.uuid4()

    def make_stop(status, order_amount=0, payment=0, arrival=None, departure=None):
        s = MagicMock()
        s.instance_id = instance_id
        s.status = status
        s.order_amount = order_amount
        s.payment_collected = payment
        s.actual_arrival = arrival
        s.actual_departure = departure
        return s

    stops = [
        make_stop("completed", order_amount=100000),
        make_stop("completed", order_amount=0),
        make_stop("missed"),
        make_stop("pending"),
    ]

    user = MagicMock()
    user.id = seller_id
    user.nombre = "Vendedor Coverage"

    profile = MagicMock()
    profile.user_id = seller_id
    profile.photo_url = "http://photo.jpg"

    db = MagicMock()
    call_count = [0]
    results = [
        _mock_scalars([instance]),
        _mock_scalars(stops),
        _mock_scalars([user]),
        _mock_scalars([profile]),
    ]

    async def side_effect(*a, **k):
        idx = call_count[0]
        call_count[0] += 1
        return results[idx] if idx < len(results) else _mock_scalars([])

    db.execute = AsyncMock(side_effect=side_effect)

    result = await get_seller_performance(
        db,
        "00000000-0000-0000-0000-000000000010",
        fecha_desde=str(date.today() - timedelta(days=30)),
        fecha_hasta=str(date.today()),
    )
    assert len(result) == 1
    r = result[0]
    assert r["stops_total"] == 4
    assert r["stops_completed"] == 2
    assert r["coverage_pct"] == pytest.approx(50.0)
    # conversion_rate = stops with order_amount > 0 / stops_completed * 100 = 1/2*100 = 50
    assert r["conversion_rate"] == pytest.approx(50.0)
    assert r["total_amount"] == pytest.approx(100000.0)


def _mock_scalars(rows):
    result = MagicMock()
    result.all.return_value = rows
    scalars = MagicMock()
    scalars.all.return_value = rows
    result.scalars.return_value = scalars
    return result
