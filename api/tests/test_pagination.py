"""Tests for the reusable pagination dependency."""

import pytest
from fastapi import Depends, FastAPI
from httpx import ASGITransport, AsyncClient

from api.src.common.pagination import PaginatedResult, PaginationParams, pagination_dep


class TestPaginationParams:
    def test_defaults(self):
        p = PaginationParams()
        assert p.page == 1
        assert p.page_size == 20
        assert p.offset == 0
        assert p.limit == 20

    def test_custom_page(self):
        p = PaginationParams(page=3, page_size=10)
        assert p.page == 3
        assert p.offset == 20
        assert p.limit == 10

    def test_min_page(self):
        p = PaginationParams(page=1)
        assert p.offset == 0

    def test_max_page_size(self):
        p = PaginationParams(page_size=200)
        assert p.limit == 200


class TestPaginatedResult:
    def test_total_pages_calculation(self):
        r = PaginatedResult(data=[], total=50, page=1, page_size=20, total_pages=3)
        assert r.total_pages == 3
        assert r.total == 50
        assert r.page == 1

    def test_single_page(self):
        r = PaginatedResult(data=[{"id": 1}], total=1, page=1, page_size=20, total_pages=1)
        assert r.total_pages == 1


@pytest.mark.asyncio
async def test_pagination_endpoint():
    app = FastAPI()

    @app.get("/test")
    async def test_endpoint(params: PaginationParams = Depends(pagination_dep)):
        return {"page": params.page, "page_size": params.page_size, "offset": params.offset}

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        resp = await ac.get("/test?page=2&page_size=10")
        assert resp.status_code == 200
        body = resp.json()
        assert body["page"] == 2
        assert body["page_size"] == 10
        assert body["offset"] == 10


@pytest.mark.asyncio
async def test_pagination_min_values():
    app = FastAPI()

    @app.get("/test")
    async def test_endpoint(params: PaginationParams = Depends(pagination_dep)):
        return {"page": params.page, "offset": params.offset}

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        resp = await ac.get("/test")
        assert resp.status_code == 200
        body = resp.json()
        assert body["page"] == 1
        assert body["offset"] == 0
