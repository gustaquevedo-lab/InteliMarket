"""Tests for global exception handlers and standardized error responses."""

import pytest
from fastapi import FastAPI, HTTPException
from httpx import ASGITransport, AsyncClient
from pydantic import BaseModel

from api.src.common.exceptions import AppError, NotFoundError, ConflictError, ForbiddenError, FeatureDisabledError
from api.src.common.handlers import register_exception_handlers


@pytest.fixture
def test_app():
    app = FastAPI()
    register_exception_handlers(app)

    @app.get("/test/not-found")
    async def not_found():
        raise NotFoundError("Producto", "abc-123")

    @app.get("/test/conflict")
    async def conflict():
        raise ConflictError("El recurso ya existe")

    @app.get("/test/forbidden")
    async def forbidden():
        raise ForbiddenError()

    @app.get("/test/feature-disabled")
    async def feature_disabled():
        raise FeatureDisabledError("pharma")

    @app.get("/test/http-error")
    async def http_error():
        raise HTTPException(status_code=400, detail="Bad request")

    @app.get("/test/unhandled")
    async def unhandled():
        raise ValueError("algo explotó")

    @app.get("/test/validation-error")
    async def validation():

        class _Model(BaseModel):
            name: str

        _Model()  # missing required field
        return {"ok": True}

    return app


@pytest.mark.asyncio
async def test_not_found_response(test_app):
    transport = ASGITransport(app=test_app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        resp = await ac.get("/test/not-found")
        assert resp.status_code == 404
        body = resp.json()
        assert body["success"] is False
        assert body["error"]["code"] == "NOT_FOUND"
        assert "Producto" in body["error"]["message"]


@pytest.mark.asyncio
async def test_conflict_response(test_app):
    transport = ASGITransport(app=test_app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        resp = await ac.get("/test/conflict")
        assert resp.status_code == 409
        body = resp.json()
        assert body["error"]["code"] == "CONFLICT"


@pytest.mark.asyncio
async def test_forbidden_response(test_app):
    transport = ASGITransport(app=test_app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        resp = await ac.get("/test/forbidden")
        assert resp.status_code == 403
        body = resp.json()
        assert body["error"]["code"] == "FORBIDDEN"


@pytest.mark.asyncio
async def test_feature_disabled_response(test_app):
    transport = ASGITransport(app=test_app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        resp = await ac.get("/test/feature-disabled")
        assert resp.status_code == 403
        body = resp.json()
        assert body["error"]["code"] == "FEATURE_DISABLED"
        assert "pharma" in body["error"]["message"]


@pytest.mark.asyncio
async def test_http_exception_response(test_app):
    transport = ASGITransport(app=test_app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        resp = await ac.get("/test/http-error")
        assert resp.status_code == 400
        body = resp.json()
        assert body["detail"] == "Bad request"


@pytest.mark.asyncio
async def test_unhandled_exception_response(test_app):
    transport = ASGITransport(app=test_app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        resp = await ac.get("/test/unhandled")
        assert resp.status_code == 500
        body = resp.json()
        assert body["success"] is False
        assert body["error"]["code"] == "INTERNAL_ERROR"
