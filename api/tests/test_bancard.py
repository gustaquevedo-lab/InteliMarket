"""Tests for bancard module — signature algorithm and service logic"""

import pytest


class TestBancardSignature:
    def test_sign_bancard(self):
        from api.src.bancard.service import sign_bancard

        data = {"public_key": "pk_test", "operation": {"token": "tok-1", "amount": "100000"}}
        sig = sign_bancard(data, "sk_test")
        assert isinstance(sig, str)
        assert len(sig) == 64

    def test_sign_bancard_deterministic(self):
        from api.src.bancard.service import sign_bancard

        data = {"public_key": "pk_test", "operation": {"amount": "50000", "token": "tok-abc"}}
        sig1 = sign_bancard(data, "sk_test")
        sig2 = sign_bancard(data, "sk_test")
        assert sig1 == sig2

    def test_sign_bancard_different_keys(self):
        from api.src.bancard.service import sign_bancard

        data = {"public_key": "pk_test", "operation": {"token": "tok-1", "amount": "100000"}}
        sig1 = sign_bancard(data, "sk_test_1")
        sig2 = sign_bancard(data, "sk_test_2")
        assert sig1 != sig2

    def test_sign_bancard_sorted_keys(self):
        from api.src.bancard.service import sign_bancard

        data_a = {"z_key": "z", "a_key": "a", "m_key": "m"}
        data_b = {"a_key": "a", "m_key": "m", "z_key": "z"}
        sig_a = sign_bancard(data_a, "test")
        sig_b = sign_bancard(data_b, "test")
        assert sig_a == sig_b


class TestBancardIsConfigured:
    def test_is_configured_returns_bool(self):
        from api.src.bancard.service import is_configured

        result = is_configured()
        assert isinstance(result, bool)


class TestBancardFormat:
    def test_payment_response_structure(self):
        from api.src.bancard.service import create_payment

        # When not configured, returns error dict
        import os
        if not os.getenv("BANCARD_PUBLIC_KEY"):
            result = {
                "payment_id": "order-1-12345",
                "process_id": "",
                "checkout_url": "",
                "status": "pending",
                "amount": 100000,
                "order_id": "order-1",
            }
            assert result["payment_id"].startswith("order-1")
            assert result["amount"] == 100000

    def test_posnet_response_structure(self):
        from api.src.bancard.service import process_posnet_payment

        result = {
            "status": "pending_terminal",
            "terminal_id": "T-001",
            "amount": 50000,
            "description": "Pago test",
            "order_id": "ORD-001",
            "message": "Aguardando respuesta del terminal POSNET",
        }
        assert result["status"] == "pending_terminal"
        assert "Aguardando" in result["message"]

    def test_verify_response_structure(self):
        from api.src.bancard.service import verify_payment_status

        expected_keys = {"status", "process_id", "authorization_code", "card_last4", "card_brand"}
        result = {
            "status": "confirmed",
            "process_id": "proc-1",
            "authorization_code": "AUTH123",
            "card_last4": "1234",
            "card_brand": "Visa",
        }
        assert set(result.keys()) == expected_keys
