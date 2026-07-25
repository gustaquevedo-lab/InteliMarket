"""Tests for kits module — schemas"""

import pytest
import uuid
from datetime import datetime
from decimal import Decimal


class TestKitSchemas:
    def test_create_kit_valid(self):
        from api.src.kits.schemas import KitCreate, KitItemCreate

        data = KitCreate(
            company_id=uuid.uuid4(),
            product_id=uuid.uuid4(),
            nombre="Kit Premium",
            descripcion="Incluye producto base + accesorio",
            precio_venta=150000,
            items=[
                KitItemCreate(product_id=uuid.uuid4(), cantidad=1),
                KitItemCreate(product_id=uuid.uuid4(), variant_id=uuid.uuid4(), cantidad=2),
            ],
        )
        assert data.nombre == "Kit Premium"
        assert data.precio_venta == 150000
        assert len(data.items) == 2
        assert data.items[1].variant_id is not None

    def test_create_kit_minimal(self):
        from api.src.kits.schemas import KitCreate, KitItemCreate

        data = KitCreate(
            company_id=uuid.uuid4(),
            product_id=uuid.uuid4(),
            nombre="Kit Básico",
            items=[KitItemCreate(product_id=uuid.uuid4())],
        )
        assert data.nombre == "Kit Básico"
        assert data.descripcion is None
        assert data.precio_venta is None
        assert data.items[0].cantidad == 1

    def test_create_kit_item_defaults(self):
        from api.src.kits.schemas import KitItemCreate

        data = KitItemCreate(product_id=uuid.uuid4())
        assert data.cantidad == 1
        assert data.variant_id is None

    def test_update_kit(self):
        from api.src.kits.schemas import KitUpdate, KitItemCreate

        data = KitUpdate(nombre="Kit Modificado", activo=False)
        assert data.nombre == "Kit Modificado"
        assert data.activo is False
        assert data.descripcion is None

        data2 = KitUpdate(items=[KitItemCreate(product_id=uuid.uuid4(), cantidad=3)])
        assert len(data2.items) == 1

    def test_kit_item_response(self):
        from api.src.kits.schemas import KitItemResponse

        data = KitItemResponse(
            id="item-1",
            kit_id="kit-1",
            product_id="prod-1",
            variant_id="var-1",
            cantidad=2,
        )
        assert data.cantidad == 2
        assert data.variant_id == "var-1"

    def test_kit_response(self):
        from api.src.kits.schemas import KitResponse, KitItemResponse

        now = datetime(2026, 6, 10)
        data = KitResponse(
            id="kit-1",
            company_id="comp-1",
            product_id="prod-1",
            nombre="Kit Test",
            descripcion="Desc",
            precio_venta=50000,
            activo=True,
            created_at=now,
            updated_at=now,
            items=[
                KitItemResponse(id="i1", kit_id="kit-1", product_id="p1", variant_id=None, cantidad=1),
            ],
        )
        assert data.nombre == "Kit Test"
        assert data.precio_calculado is None
        assert len(data.items) == 1

    def test_kit_price_response(self):
        from api.src.kits.schemas import KitPriceResponse, KitItemResponse

        data = KitPriceResponse(
            kit_id="kit-1",
            nombre="Kit Test",
            precio_venta=50000,
            precio_calculado=45000,
            diferencia=5000,
            items=[
                KitItemResponse(id="i1", kit_id="kit-1", product_id="p1", variant_id=None, cantidad=2),
            ],
        )
        assert data.precio_calculado == 45000
        assert data.diferencia == 5000
        assert data.precio_venta == 50000
