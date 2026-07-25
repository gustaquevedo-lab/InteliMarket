"""Tests for client_app module — schemas and validation"""

import pytest
import uuid
from datetime import datetime
from decimal import Decimal


class TestClientAuthSchemas:
    def test_register_request(self):
        from api.src.client_app.schemas import RegisterRequest

        data = RegisterRequest(
            customer_id="cust-1",
            company_id="comp-1",
            email="cliente@test.com",
            password="123456",
            nombre="Juan Pérez",
            telefono="0981123456",
        )
        assert data.email == "cliente@test.com"
        assert data.telefono == "0981123456"
        assert len(data.password) >= 6

    def test_register_minimal(self):
        from api.src.client_app.schemas import RegisterRequest

        data = RegisterRequest(
            customer_id="cust-1",
            company_id="comp-1",
            email="cliente@test.com",
            password="123456",
            nombre="Juan Pérez",
        )
        assert data.telefono is None

    def test_register_password_too_short(self):
        from api.src.client_app.schemas import RegisterRequest
        from pydantic import ValidationError

        with pytest.raises(ValidationError):
            RegisterRequest(
                customer_id="cust-1",
                company_id="comp-1",
                email="cliente@test.com",
                password="12345",
                nombre="Juan",
            )

    def test_login_request(self):
        from api.src.client_app.schemas import LoginRequest

        data = LoginRequest(email="cliente@test.com", password="123456")
        assert data.email == "cliente@test.com"

    def test_token_response(self):
        from api.src.client_app.schemas import TokenResponse

        data = TokenResponse(access_token="tok-123")
        assert data.access_token == "tok-123"
        assert data.token_type == "bearer_client"


class TestClientCartSchemas:
    def test_cart_item_input_defaults(self):
        from api.src.client_app.schemas import CartItemInput

        data = CartItemInput(product_id="prod-1", cantidad=Decimal("1"), precio_unitario=Decimal("50000"))
        assert data.cantidad == Decimal("1")
        assert data.precio_unitario == Decimal("50000")
        assert data.iva_tasa == Decimal("10")
        assert data.variant_id is None

    def test_cart_item_input_zero_cantidad_invalid(self):
        from api.src.client_app.schemas import CartItemInput
        from pydantic import ValidationError
        from decimal import Decimal

        with pytest.raises(ValidationError):
            CartItemInput(product_id="prod-1", cantidad=Decimal("0"), precio_unitario=Decimal("50000"))

    def test_cart_item_update(self):
        from api.src.client_app.schemas import CartItemUpdate
        from decimal import Decimal

        data = CartItemUpdate(cantidad=Decimal("3"))
        assert data.cantidad == Decimal("3")

    def test_cart_item_response(self):
        from api.src.client_app.schemas import CartItemResponse

        data = CartItemResponse(
            id=uuid.uuid4(),
            product_id=uuid.uuid4(),
            variant_id=None,
            descripcion="Producto test",
            cantidad=2.0,
            precio_unitario=50000.0,
            iva_tasa=10.0,
            subtotal=100000.0,
        )
        assert data.cantidad == 2.0
        assert data.subtotal == 100000.0
        assert data.variant_id is None

    def test_cart_response(self):
        from api.src.client_app.schemas import CartResponse, CartItemResponse

        item = CartItemResponse(
            id=uuid.uuid4(),
            product_id=uuid.uuid4(),
            variant_id=None,
            descripcion="Item",
            cantidad=1.0,
            precio_unitario=50000.0,
            iva_tasa=10.0,
            subtotal=50000.0,
        )
        data = CartResponse(id=uuid.uuid4(), items=[item], total=50000.0, item_count=1)
        assert data.total == 50000.0
        assert data.item_count == 1
        assert len(data.items) == 1


class TestClientAddressSchemas:
    def test_address_create(self):
        from api.src.client_app.schemas import AddressCreate

        data = AddressCreate(
            nombre="Casa",
            direccion="Av. Principal 123",
            ciudad="Asunción",
            latitud=-25.2637,
            longitud=-57.5759,
            es_default=True,
        )
        assert data.direccion == "Av. Principal 123"
        assert data.es_default is True

    def test_address_create_minimal(self):
        from api.src.client_app.schemas import AddressCreate

        data = AddressCreate(direccion="Calle 456")
        assert data.es_default is False
        assert data.nombre is None
        assert data.ciudad is None

    def test_address_update(self):
        from api.src.client_app.schemas import AddressUpdate

        data = AddressUpdate(direccion="Nueva dirección", es_default=True)
        assert data.direccion == "Nueva dirección"
        assert data.es_default is True
        assert data.nombre is None


class TestClientCheckoutSchemas:
    def test_checkout_input_defaults(self):
        from api.src.client_app.schemas import CheckoutInput

        data = CheckoutInput()
        assert data.condicion == "contado"
        assert data.direccion_entrega is None
        assert data.observaciones is None

    def test_checkout_input_custom(self):
        from api.src.client_app.schemas import CheckoutInput

        data = CheckoutInput(
            direccion_entrega="Av. Test 789",
            condicion="credito",
            observaciones="Entregar después de las 18hs",
        )
        assert data.condicion == "credito"
        assert data.observaciones == "Entregar después de las 18hs"


class TestClientResponseSchemas:
    def test_client_user_response(self):
        from api.src.client_app.schemas import ClientUserResponse

        now = datetime(2026, 6, 10)
        data = ClientUserResponse(
            id=uuid.uuid4(),
            customer_id=uuid.uuid4(),
            email="cliente@test.com",
            nombre="Juan",
            telefono="0981123456",
            activo=True,
            created_at=now,
        )
        assert data.activo is True
        assert data.email == "cliente@test.com"

    def test_order_response(self):
        from api.src.client_app.schemas import OrderResponse, OrderItemResponse

        now = datetime(2026, 6, 10)
        item = OrderItemResponse(
            id=uuid.uuid4(),
            product_id=uuid.uuid4(),
            descripcion="Prod 1",
            cantidad=2.0,
            precio_unitario=25000.0,
            descuento_pct=0.0,
            descuento_monto=0.0,
            iva_tasa=10.0,
            iva_monto=5000.0,
            total=50000.0,
        )
        data = OrderResponse(
            id=uuid.uuid4(),
            numero="PED-20260610-A1B2C3",
            estado="pendiente",
            subtotal=50000.0,
            descuento_total=0.0,
            total=50000.0,
            saldo=50000.0,
            direccion_entrega="Av. Test 789",
            observaciones=None,
            delivery_id=None,
            items=[item],
            created_at=now,
        )
        assert data.estado == "pendiente"
        assert data.total == 50000.0
        assert data.numero.startswith("PED-")

    def test_account_response(self):
        from api.src.client_app.schemas import AccountResponse

        data = AccountResponse(
            id=uuid.uuid4(),
            nombre="Juan Pérez",
            email="juan@test.com",
            telefono="0981123456",
            credito_limite=5000000.0,
            credito_disponible=3000000.0,
            saldo_actual=2000000.0,
            loyalty_points=1500,
        )
        assert data.credito_limite == 5000000.0
        assert data.loyalty_points == 1500

    def test_promotion_response(self):
        from api.src.client_app.schemas import PromotionResponse

        data = PromotionResponse(
            id=uuid.uuid4(),
            nombre="10% OFF",
            descripcion="Descuento en toda la tienda",
            tipo="porcentaje",
            valor=10.0,
            codigo_cupon="BIENVENIDO10",
            requiere_cupon=True,
            valido_hasta=datetime(2026, 7, 10),
        )
        assert data.tipo == "porcentaje"
        assert data.requiere_cupon is True
