"""Tests for Pagopar signature verification and request signing"""

import hashlib
import hmac
from urllib.parse import urlencode


def sign_request(private_key: str, params: dict) -> str:
    sorted_params = dict(sorted(params.items()))
    query_string = urlencode(sorted_params)
    signature = hmac.new(
        private_key.encode("utf-8"),
        query_string.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
    return signature


def verify_webhook_signature(private_key: str, body: bytes, signature: str) -> bool:
    expected = hmac.new(
        private_key.encode("utf-8"),
        body,
        hashlib.sha256,
    ).hexdigest()
    return hmac.compare_digest(expected, signature)


class TestSignRequest:
    def test_signature_is_hex(self):
        sig = sign_request("test_key", {"amount": "1000", "order_id": "ORD001"})
        assert all(c in "0123456789abcdef" for c in sig)
        assert len(sig) == 64

    def test_same_input_same_signature(self):
        params = {"amount": "1000", "order_id": "ORD001"}
        sig1 = sign_request("test_key", params)
        sig2 = sign_request("test_key", params)
        assert sig1 == sig2

    def test_different_key_different_signature(self):
        params = {"amount": "1000", "order_id": "ORD001"}
        sig1 = sign_request("key1", params)
        sig2 = sign_request("key2", params)
        assert sig1 != sig2

    def test_different_params_different_signature(self):
        sig1 = sign_request("test_key", {"amount": "1000"})
        sig2 = sign_request("test_key", {"amount": "2000"})
        assert sig1 != sig2

    def test_params_sorted(self):
        params = {"z_param": "1", "a_param": "2", "m_param": "3"}
        sig = sign_request("test_key", params)
        expected_params = {"a_param": "2", "m_param": "3", "z_param": "1"}
        expected_sig = sign_request("test_key", expected_params)
        assert sig == expected_sig


class TestVerifyWebhookSignature:
    def test_valid_signature(self):
        private_key = "test_secret"
        body = b'{"event": "payment.approved", "data": {"order_id": "ORD001"}}'
        signature = hmac.new(
            private_key.encode("utf-8"),
            body,
            hashlib.sha256,
        ).hexdigest()
        assert verify_webhook_signature(private_key, body, signature) is True

    def test_invalid_signature(self):
        private_key = "test_secret"
        body = b'{"event": "payment.approved", "data": {"order_id": "ORD001"}}'
        assert verify_webhook_signature(private_key, body, "invalid_signature") is False

    def test_tampered_body(self):
        private_key = "test_secret"
        body = b'{"event": "payment.approved", "data": {"order_id": "ORD001"}}'
        signature = hmac.new(
            private_key.encode("utf-8"),
            body,
            hashlib.sha256,
        ).hexdigest()
        tampered_body = b'{"event": "payment.rejected", "data": {"order_id": "ORD001"}}'
        assert verify_webhook_signature(private_key, tampered_body, signature) is False
