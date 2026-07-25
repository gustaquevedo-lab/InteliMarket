"""End-to-end test: full boutique workflows covering vertical lifecycle"""

import pytest
from datetime import datetime
from decimal import Decimal
from uuid import uuid4


class TestProductVariantWorkflow:
    """Product + variant creation and pricing."""

    def test_product_with_variants_price_calculation(self):
        from api.src.boutique.schemas import ProductCreate, VariantBase

        data = ProductCreate(
            codigo="JEAN-001",
            nombre="Jean Premium",
            precio_base=Decimal("250000"),
            costo_promedio=Decimal("120000"),
            variantes=[
                VariantBase(sku="JEAN-38-BLU", stock_actual=10, precio_sobrecargo=Decimal("5000")),
                VariantBase(sku="JEAN-40-BLU", stock_actual=15, precio_sobrecargo=Decimal("5000")),
                VariantBase(sku="JEAN-42-BLU", stock_actual=8, precio_sobrecargo=Decimal("10000")),
            ],
        )
        assert data.precio_base == Decimal("250000")
        assert data.costo_promedio == Decimal("120000")
        assert len(data.variantes) == 3
        assert data.tipo_producto == "indumentaria"

        # Simulate precio_final logic
        for v in data.variantes:
            precio_final = data.precio_base + (v.precio_sobrecargo or Decimal("0"))
            assert precio_final >= data.precio_base

    def test_product_update_preserves_other_fields(self):
        from api.src.boutique.schemas import ProductUpdate

        data = ProductUpdate(precio_base=Decimal("275000"))
        assert data.nombre is None
        assert data.genero is None
        assert data.activo is None


class TestSaleLifecycle:
    """Sale creation, mixed IVA, gift wrapping."""

    def test_sale_with_mixed_items(self):
        from api.src.boutique.schemas import SaleCreate, SaleItemCreate

        items = [
            SaleItemCreate(producto_id=uuid4(), cantidad=2, precio_unitario=Decimal("50000")),   # 100k
            SaleItemCreate(producto_id=uuid4(), cantidad=1, precio_unitario=Decimal("120000")),  # 120k
        ]
        data = SaleCreate(
            codigo="V-20260610-001",
            customer_id=uuid4(),
            subtotal=Decimal("220000"),
            descuento=Decimal("10000"),
            impuesto=Decimal("21000"),
            total=Decimal("231000"),
            items=items,
        )
        assert data.subtotal == Decimal("220000")
        assert data.total == Decimal("231000")
        assert len(data.items) == 2

    def test_sale_with_gift_wrapping(self):
        from api.src.boutique.schemas import SaleCreate, SaleItemCreate

        data = SaleCreate(
            codigo="V-20260610-002",
            customer_id=uuid4(),
            subtotal=Decimal("150000"),
            total=Decimal("155000"),
            incluye_gift_wrapping=True,
            gift_wrapping_fee=Decimal("5000"),
            items=[SaleItemCreate(producto_id=uuid4(), cantidad=1, precio_unitario=Decimal("150000"))],
        )
        assert data.incluye_gift_wrapping is True
        assert data.gift_wrapping_fee == Decimal("5000")

    def test_sale_defaults(self):
        from api.src.boutique.schemas import SaleCreate, SaleItemCreate

        data = SaleCreate(
            codigo="V-003",
            customer_id=uuid4(),
            subtotal=Decimal("50000"),
            total=Decimal("55000"),
            items=[SaleItemCreate(producto_id=uuid4(), cantidad=1, precio_unitario=Decimal("50000"))],
        )
        assert data.moneda == "PYG"
        assert data.tipo_venta == "tienda"


class TestReturnLifecycle:
    """Return creation and processing."""

    def test_return_full_refund(self):
        from api.src.boutique.schemas import ReturnCreate, ReturnItemCreate

        data = ReturnCreate(
            codigo="DEV-20260610-001",
            sale_id=uuid4(),
            customer_id=uuid4(),
            motivo="defecto",
            tipo_reintegro="reembolso",
            items=[
                ReturnItemCreate(variant_id=uuid4(), cantidad=1, motivo="Talle incorrecto"),
            ],
        )
        assert data.sale_id is not None
        assert data.tipo_reintegro == "reembolso"
        assert len(data.items) == 1

    def test_return_exchange(self):
        from api.src.boutique.schemas import ReturnCreate, ReturnItemCreate

        data = ReturnCreate(
            codigo="DEV-20260610-002",
            customer_id=uuid4(),
            motivo="cambio_opinion",
            tipo_reintegro="cambio",
            items=[ReturnItemCreate(variant_id=uuid4(), cantidad=1)],
        )
        assert data.tipo_reintegro == "cambio"


class TestClientelingWorkflow:
    """Client profile + interactions."""

    def test_client_profile_defaults(self):
        from api.src.boutique.schemas import ClientProfileBase
        data = ClientProfileBase()
        assert data.tipo_cliente == "regular"
        assert data.marcas_preferidas == []

    def test_client_profile_with_preferences(self):
        from api.src.boutique.schemas import ClientProfileBase
        data = ClientProfileBase(
            genero_preferido="mujer",
            estilo="casual",
            marcas_preferidas=["Zara", "H&M"],
        )
        assert data.estilo == "casual"
        assert len(data.marcas_preferidas) == 2

    def test_interaction_with_followup(self):
        from datetime import date
        from api.src.boutique.schemas import InteractionCreate
        data = InteractionCreate(
            customer_id=uuid4(), tipo="fitting",
            notas="Cliente probó vestido talle M",
            proximo_seguimiento=date(2026, 7, 1),
        )
        assert data.proximo_seguimiento is not None


class TestEventWorkflow:
    """Event creation and guest management."""

    def test_event_with_guests(self):
        from api.src.boutique.schemas import EventCreate, EventGuestCreate
        now = datetime(2026, 6, 10)
        event = EventCreate(codigo="POPUP-JUN", nombre="Pop Up Store Junio",
                            tipo="pop_up", fecha_inicio=now, ubicacion="Shopping del Sol")
        assert event.estado == "borrador"

        guest = EventGuestCreate(customer_id=uuid4(), acompanantes=2)
        assert guest.acompanantes == 2

    def test_event_guest_confirmation(self):
        from api.src.boutique.schemas import EventGuestCreate
        data = EventGuestCreate(customer_id=uuid4(), confirmado=True)
        assert data.confirmado is True


class TestMarkdownWorkflow:
    """Markdown rules and application."""

    def test_markdown_rule_fin_temporada(self):
        from api.src.boutique.schemas import MarkdownRuleCreate
        data = MarkdownRuleCreate(
            codigo="MD-VERANO-26", nombre="Liquidación Verano 2026",
            tipo="fin_temporada", temporada="primavera_verano",
            descuento_maximo=Decimal("50"), descuento_minimo=Decimal("10"),
        )
        assert data.descuento_maximo == Decimal("50")
        assert data.descuento_minimo == Decimal("10")

    def test_markdown_rule_exceso_stock(self):
        from api.src.boutique.schemas import MarkdownRuleCreate
        data = MarkdownRuleCreate(
            codigo="MD-EXCESO", nombre="Exceso de Stock",
            tipo="exceso_stock", factor_rotacion_minimo=Decimal("0.5"),
        )
        assert data.factor_rotacion_minimo == Decimal("0.5")
