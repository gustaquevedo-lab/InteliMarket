"""Tests for variants module — schemas and validation"""

import pytest
import uuid
from datetime import datetime


class TestVariantSchemas:
    def test_create_valid(self):
        from api.src.variants.schemas import VariantCreate

        data = VariantCreate(
            product_id=uuid.uuid4(),
            company_id=uuid.uuid4(),
            tipo="talle",
            valor="XL",
            sku_variante="PROD-XL-001",
            codigo_barra="1234567890123",
            precio_extra=5000,
            stock=10,
            orden=1,
        )
        assert data.tipo == "talle"
        assert data.valor == "XL"
        assert data.precio_extra == 5000
        assert data.stock == 10
        assert data.codigo_barra == "1234567890123"

    def test_create_minimal(self):
        from api.src.variants.schemas import VariantCreate

        data = VariantCreate(
            product_id=uuid.uuid4(),
            company_id=uuid.uuid4(),
            valor="M",
            sku_variante="PROD-M-001",
        )
        assert data.tipo == "talle"
        assert data.precio_extra == 0
        assert data.stock == 0
        assert data.codigo_barra is None

    def test_create_color_type(self):
        from api.src.variants.schemas import VariantCreate

        data = VariantCreate(
            product_id=uuid.uuid4(),
            company_id=uuid.uuid4(),
            tipo="color",
            valor="Rojo",
            sku_variante="PROD-RJO-001",
        )
        assert data.tipo == "color"
        assert data.orden == 0

    def test_update_partial(self):
        from api.src.variants.schemas import VariantUpdate

        data = VariantUpdate(precio_extra=10000, activo=True)
        assert data.precio_extra == 10000
        assert data.activo is True
        assert data.stock is None
        assert data.valor is None

    def test_update_empty(self):
        from api.src.variants.schemas import VariantUpdate

        data = VariantUpdate()
        assert data.model_dump(exclude_unset=True) == {}

    def test_response_from_attributes(self):
        from api.src.variants.schemas import VariantResponse

        now = datetime(2026, 6, 10)
        data = VariantResponse(
            id="var-1",
            product_id="prod-1",
            company_id="comp-1",
            tipo="talle",
            valor="L",
            sku_variante="PROD-L-001",
            codigo_barra="9876543210987",
            precio_extra=3000,
            stock=25,
            orden=2,
            activo=True,
            created_at=now,
            updated_at=now,
        )
        assert data.id == "var-1"
        assert data.precio_extra == 3000
        assert data.stock == 25
        assert data.sku_variante == "PROD-L-001"

    def test_response_optional_fields(self):
        from api.src.variants.schemas import VariantResponse

        now = datetime(2026, 6, 10)
        data = VariantResponse(
            id="var-2",
            product_id="prod-2",
            company_id="comp-2",
            tipo="color",
            valor="Azul",
            sku_variante="PROD-AZ-001",
            codigo_barra=None,
            precio_extra=0,
            stock=0,
            orden=0,
            activo=True,
            created_at=now,
            updated_at=None,
        )
        assert data.codigo_barra is None
        assert data.updated_at is None
