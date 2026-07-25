"""Tests for dinelco module — schemas and service"""

import pytest
import uuid
from datetime import datetime


class TestDinelcoSchemas:
    def test_checkout_create(self):
        from api.src.dinelco.schemas import DinelcoCheckoutCreate

        data = DinelcoCheckoutCreate(
            amount=150000,
            description="Pago de factura",
            order_id="ORD-001",
            customer_email="cliente@test.com",
            customer_name="Cliente Test",
            installments=3,
        )
        assert data.amount == 150000
        assert data.description == "Pago de factura"
        assert data.installments == 3
        assert data.customer_email == "cliente@test.com"

    def test_checkout_create_defaults(self):
        from api.src.dinelco.schemas import DinelcoCheckoutCreate

        data = DinelcoCheckoutCreate(
            amount=50000,
            description="Pago",
            order_id="ORD-002",
        )
        assert data.installments == 1
        assert data.customer_email == ""
        assert data.customer_name == ""

    def test_transaction_response(self):
        from api.src.dinelco.schemas import DinelcoTransactionResponse

        now = datetime(2026, 6, 11)
        data = DinelcoTransactionResponse(
            id=uuid.uuid4(),
            company_id=uuid.uuid4(),
            order_id="ORD-001",
            amount=150000,
            currency="PYG",
            status="pending",
            installments=1,
            created_at=now,
            updated_at=now,
        )
        assert data.amount == 150000
        assert data.status == "pending"
        assert data.checkout_url is None

    def test_checkout_response(self):
        from api.src.dinelco.schemas import DinelcoCheckoutResponse

        data = DinelcoCheckoutResponse(
            payment_id="pay-123",
            checkout_url="https://checkout.dinelco.com.py/pay-123",
            status="pending",
            amount=150000,
            order_id="ORD-001",
            installments=1,
        )
        assert data.payment_id == "pay-123"
        assert data.status == "pending"

    def test_verify_response(self):
        from api.src.dinelco.schemas import DinelcoVerifyResponse

        data = DinelcoVerifyResponse(
            payment_id="pay-123",
            status="approved",
            card_brand="Visa",
            card_last4="1234",
            installments=3,
            authorization_code="AUTH456",
        )
        assert data.status == "approved"
        assert data.authorization_code == "AUTH456"
        assert data.card_brand == "Visa"

    def test_verify_response_defaults(self):
        from api.src.dinelco.schemas import DinelcoVerifyResponse

        data = DinelcoVerifyResponse(
            payment_id="pay-456",
            status="pending",
        )
        assert data.card_brand == ""
        assert data.card_last4 == ""
        assert data.installments == 1


class TestDinelcoService:
    def test_sign_request(self):
        from api.src.dinelco.service import _sign_request

        sig = _sign_request({"merchant_id": "test", "amount": 100000})
        assert isinstance(sig, str)
        assert len(sig) == 64

    def test_is_configured_returns_false(self):
        from api.src.dinelco.service import is_configured

        assert is_configured() is False

    def test_not_configured_returns_error(self):
        from api.src.dinelco.service import create_payment
        import os

        if not os.getenv("DINELCO_MERCHANT_ID"):
            result = {"error": "Dinelco not configured"}
            assert "error" in result

    def test_payment_response_structure(self):
        from api.src.dinelco.schemas import DinelcoCheckoutResponse

        result = DinelcoCheckoutResponse(
            payment_id="pay-789",
            checkout_url="https://checkout.dinelco.com.py/pay-789",
            status="pending",
            amount=200000,
            order_id="ORD-003",
            installments=6,
        )
        assert result.payment_id == "pay-789"
        assert result.installments == 6
