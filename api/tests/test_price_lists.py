"""Tests for price_lists module — schemas"""

import pytest
import uuid
from datetime import datetime


class TestPriceListSchemas:
    def test_create_price_list(self):
        from api.src.price_lists.schemas import PriceListCreate

        data = PriceListCreate(
            company_id=uuid.uuid4(),
            nombre="Lista Mayorista",
            tipo="mayorista",
        )
        assert data.nombre == "Lista Mayorista"
        assert data.tipo == "mayorista"
        assert data.customer_id is None
        assert data.grupo is None

    def test_create_price_list_with_customer(self):
        from api.src.price_lists.schemas import PriceListCreate

        data = PriceListCreate(
            company_id=uuid.uuid4(),
            nombre="Precio Cliente VIP",
            customer_id=uuid.uuid4(),
            grupo="VIP",
        )
        assert data.customer_id is not None
        assert data.grupo == "VIP"

    def test_create_price_list_default_tipo(self):
        from api.src.price_lists.schemas import PriceListCreate

        data = PriceListCreate(
            company_id=uuid.uuid4(),
            nombre="Lista General",
        )
        assert data.tipo == "general"

    def test_update_price_list(self):
        from api.src.price_lists.schemas import PriceListUpdate

        data = PriceListUpdate(nombre="Lista Actualizada", activo=False)
        assert data.nombre == "Lista Actualizada"
        assert data.activo is False

    def test_update_price_list_empty(self):
        from api.src.price_lists.schemas import PriceListUpdate

        data = PriceListUpdate()
        assert data.model_dump(exclude_unset=True) == {}


class TestPriceListItemSchemas:
    def test_create_item(self):
        from api.src.price_lists.schemas import PriceListItemCreate

        data = PriceListItemCreate(
            price_list_id=uuid.uuid4(),
            product_id=uuid.uuid4(),
            precio=25000.50,
            notas="Precio promocional",
        )
        assert data.precio == 25000.50
        assert data.moneda == "PYG"
        assert data.variant_id is None

    def test_create_item_with_variant(self):
        from api.src.price_lists.schemas import PriceListItemCreate

        data = PriceListItemCreate(
            price_list_id=uuid.uuid4(),
            product_id=uuid.uuid4(),
            variant_id=uuid.uuid4(),
            precio=30000,
        )
        assert data.variant_id is not None

    def test_update_item(self):
        from api.src.price_lists.schemas import PriceListItemUpdate

        data = PriceListItemUpdate(precio=27500.0, notas="Precio revisado")
        assert data.precio == 27500.0
        assert data.notas == "Precio revisado"
        assert data.activo is None


class TestPriceListResponse:
    def test_price_list_response(self):
        from api.src.price_lists.schemas import PriceListResponse

        now = datetime(2026, 6, 10)
        data = PriceListResponse(
            id="pl-1",
            company_id="comp-1",
            nombre="Lista Test",
            tipo="general",
            customer_id="cust-1",
            grupo=None,
            activo=True,
            created_at=now,
            updated_at=now,
        )
        assert data.id == "pl-1"
        assert data.customer_id == "cust-1"
        assert data.grupo is None

    def test_item_response(self):
        from api.src.price_lists.schemas import PriceListItemResponse

        now = datetime(2026, 6, 10)
        data = PriceListItemResponse(
            id="pli-1",
            price_list_id="pl-1",
            product_id="prod-1",
            variant_id=None,
            precio=25000.0,
            moneda="PYG",
            notas="Nota test",
            activo=True,
            created_at=now,
            updated_at=now,
        )
        assert data.precio == 25000.0
        assert data.variant_id is None
        assert data.notas == "Nota test"
