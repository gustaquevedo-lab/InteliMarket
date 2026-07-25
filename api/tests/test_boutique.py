"""Tests for boutique module — schemas"""

import pytest
import uuid
from datetime import datetime, date
from decimal import Decimal


class TestSizeSchemas:
    def test_size_create(self):
        from api.src.boutique.schemas import SizeCreate
        data = SizeCreate(codigo="XL", nombre="Extra Large")
        assert data.codigo == "XL"
        assert data.activo is True
        assert data.orden == 0

    def test_size_out(self):
        from api.src.boutique.schemas import SizeOut
        now = datetime(2026, 6, 10)
        data = SizeOut(id=uuid.uuid4(), company_id=uuid.uuid4(), codigo="M", nombre="Medium", created_at=now)
        assert data.codigo == "M"


class TestColorSchemas:
    def test_color_create(self):
        from api.src.boutique.schemas import ColorCreate
        data = ColorCreate(codigo="ROJO", nombre="Rojo", hex="#FF0000", familia="rojos")
        assert data.hex == "#FF0000"
        assert data.es_basico is False


class TestCategorySchemas:
    def test_category_create(self):
        from api.src.boutique.schemas import CategoryCreate
        data = CategoryCreate(codigo="VEST", nombre="Vestidos")
        assert data.nivel == 0

    def test_category_self_referential(self):
        from api.src.boutique.schemas import CategoryCreate
        parent = uuid.uuid4()
        data = CategoryCreate(codigo="VEST-NOC", nombre="Vestidos de Noche", parent_id=parent)
        assert data.parent_id == parent


class TestCollectionSchemas:
    def test_collection_create(self):
        from api.src.boutique.schemas import CollectionCreate, CollectionItemBase
        data = CollectionCreate(
            codigo="COLL-SS26", nombre="Summer 2026", temporada="primavera_verano", anio=2026,
            items=[CollectionItemBase(producto_id=uuid.uuid4(), destacado=True)],
        )
        assert len(data.items) == 1
        assert data.estado == "borrador"

    def test_collection_out(self):
        from api.src.boutique.schemas import CollectionOut
        now = datetime(2026, 6, 10)
        data = CollectionOut(id=uuid.uuid4(), company_id=uuid.uuid4(), codigo="C1", nombre="Col1",
                             temporada="otonio_invierno", anio=2026, created_at=now)
        assert data.updated_at is None


class TestProductSchemas:
    def test_product_create_minimal(self):
        from api.src.boutique.schemas import ProductCreate
        data = ProductCreate(codigo="PROD-001", nombre="Remera Básica", precio_base=Decimal("50000"))
        assert data.moneda == "PYG"
        assert data.tipo_producto == "indumentaria"
        assert len(data.variantes) == 0

    def test_product_create_with_variants(self):
        from api.src.boutique.schemas import ProductCreate, VariantBase
        data = ProductCreate(
            codigo="PROD-002", nombre="Jean Premium", precio_base=Decimal("250000"),
            genero="mujer", marca="Levis",
            variantes=[
                VariantBase(size_id=uuid.uuid4(), color_id=uuid.uuid4(), sku="JEAN-SM-BLU", stock_actual=10),
                VariantBase(size_id=uuid.uuid4(), color_id=uuid.uuid4(), sku="JEAN-MD-BLU", stock_actual=15),
            ],
        )
        assert len(data.variantes) == 2
        assert data.genero == "mujer"

    def test_product_update(self):
        from api.src.boutique.schemas import ProductUpdate
        data = ProductUpdate(nombre="Remera Premium", precio_base=Decimal("65000"))
        assert data.nombre == "Remera Premium"
        assert data.activo is None

    def test_variant_out(self):
        from api.src.boutique.schemas import VariantOut
        now = datetime(2026, 6, 10)
        data = VariantOut(id=uuid.uuid4(), sku="SKU-001", created_at=now)
        assert data.stock_disponible == 0


class TestSaleSchemas:
    def test_sale_create(self):
        from api.src.boutique.schemas import SaleCreate, SaleItemCreate
        data = SaleCreate(
            codigo="VENTA-001", customer_id=uuid.uuid4(),
            subtotal=Decimal("100000"), total=Decimal("110000"),
            items=[SaleItemCreate(producto_id=uuid.uuid4(), cantidad=2, precio_unitario=Decimal("50000"))],
        )
        assert data.moneda == "PYG"
        assert data.tipo_venta == "tienda"
        assert len(data.items) == 1

    def test_sale_create_with_gift_wrapping(self):
        from api.src.boutique.schemas import SaleCreate, SaleItemCreate
        data = SaleCreate(
            codigo="VENTA-002", customer_id=uuid.uuid4(),
            subtotal=Decimal("200000"), total=Decimal("210000"),
            incluye_gift_wrapping=True, gift_wrapping_fee=Decimal("10000"),
            items=[SaleItemCreate(producto_id=uuid.uuid4(), cantidad=1, precio_unitario=Decimal("200000"))],
        )
        assert data.incluye_gift_wrapping is True

    def test_sale_out(self):
        from api.src.boutique.schemas import SaleOut
        now = datetime(2026, 6, 10)
        data = SaleOut(id=uuid.uuid4(), company_id=uuid.uuid4(), codigo="V-1", customer_id=uuid.uuid4(),
                       fecha=now, subtotal=Decimal("100000"), descuento=Decimal("0"),
                       impuesto=Decimal("10000"), total=Decimal("110000"), moneda="PYG",
                       tipo_venta="tienda", created_at=now)
        assert data.total == Decimal("110000")


class TestReturnSchemas:
    def test_return_create(self):
        from api.src.boutique.schemas import ReturnCreate, ReturnItemCreate
        data = ReturnCreate(
            codigo="DEV-001", customer_id=uuid.uuid4(), motivo="talle_incorrecto",
            items=[ReturnItemCreate(variant_id=uuid.uuid4(), cantidad=1)],
        )
        assert len(data.items) == 1

    def test_return_out(self):
        from api.src.boutique.schemas import ReturnOut
        now = datetime(2026, 6, 10)
        data = ReturnOut(id=uuid.uuid4(), codigo="DEV-1", customer_id=uuid.uuid4(),
                         fecha=now, motivo="defecto", estado="pendiente", created_at=now)
        assert data.total_reintegro is None


class TestClientelingSchemas:
    def test_client_profile_base_defaults(self):
        from api.src.boutique.schemas import ClientProfileBase
        data = ClientProfileBase()
        assert data.tipo_cliente == "regular"
        assert data.marcas_preferidas == []

    def test_interaction_create(self):
        from api.src.boutique.schemas import InteractionCreate
        data = InteractionCreate(customer_id=uuid.uuid4(), tipo="visita", canal="tienda")
        assert data.notas is None


class TestLoyaltySchemas:
    def test_loyalty_account_out(self):
        from api.src.boutique.schemas import LoyaltyAccountOut
        data = LoyaltyAccountOut(id=uuid.uuid4(), customer_id=uuid.uuid4(),
                                 puntos_acumulados=500, puntos_canjeados=100,
                                 puntos_disponibles=400, gasto_total=Decimal("500000"))
        assert data.puntos_disponibles == 400


class TestMarkdownSchemas:
    def test_markdown_rule_create(self):
        from api.src.boutique.schemas import MarkdownRuleCreate
        data = MarkdownRuleCreate(codigo="MD-FIN-TEMP", nombre="Fin Temporada Verano", tipo="fin_temporada")
        assert data.descuento_maximo == Decimal("70")
        assert data.prioridad == 0


class TestEventSchemas:
    def test_event_create(self):
        from api.src.boutique.schemas import EventCreate
        now = datetime(2026, 6, 10)
        data = EventCreate(codigo="EV-FW26", nombre="Fashion Week 2026",
                           fecha_inicio=now, fecha_fin=now)
        assert data.estado == "borrador"

    def test_event_guest_create(self):
        from api.src.boutique.schemas import EventGuestCreate
        data = EventGuestCreate(customer_id=uuid.uuid4())
        assert data.acompanantes == 1

    def test_event_guest_out(self):
        from api.src.boutique.schemas import EventGuestOut
        now = datetime(2026, 6, 10)
        data = EventGuestOut(id=uuid.uuid4(), event_id=uuid.uuid4(), customer_id=uuid.uuid4(), created_at=now)
        assert data.confirmado is False


class TestDashboardSchemas:
    def test_dashboard_out(self):
        from api.src.boutique.schemas import DashboardOut
        from decimal import Decimal
        data = DashboardOut(
            total_productos=100, total_variantes=300, total_ventas_mes=50,
            total_ingresos_mes=Decimal("50000000"), total_clientes=80,
            devoluciones_mes=3, productos_bajo_stock=5, variantes_con_markdown=10,
            loyalty_puntos_emitidos=5000,
        )
        assert data.total_productos == 100
        assert data.total_ingresos_mes == Decimal("50000000")


class TestPaginatedResponse:
    def test_paginated_response(self):
        from api.src.boutique.schemas import PaginatedResponse
        data = PaginatedResponse(total=50, page=1, page_size=10, items=[{"id": 1}, {"id": 2}])
        assert len(data.items) == 2
        assert data.total == 50
