"""Tests for email module — schemas and service"""

import pytest
import uuid
from datetime import datetime


class TestEmailSchemas:
    def test_email_send(self):
        from api.src.email.schemas import EmailSend

        data = EmailSend(
            to_email="cliente@test.com",
            subject="Comprobante de venta",
            body_html="<p>Gracias</p>",
            tipo="receipt",
            referencia_id="VENTA-001",
        )
        assert data.to_email == "cliente@test.com"
        assert data.subject == "Comprobante de venta"
        assert data.tipo == "receipt"

    def test_email_send_defaults(self):
        from api.src.email.schemas import EmailSend

        data = EmailSend(
            to_email="test@test.com",
            subject="Test",
            body_html="<p>Test</p>",
        )
        assert data.tipo == "general"
        assert data.referencia_id is None

    def test_log_response(self):
        from api.src.email.schemas import EmailLogResponse

        now = datetime(2026, 6, 11)
        data = EmailLogResponse(
            id=uuid.uuid4(),
            company_id=uuid.uuid4(),
            to_email="cliente@test.com",
            subject="Comprobante",
            tipo="receipt",
            success=True,
            created_at=now,
        )
        assert data.success is True
        assert data.error_message is None


    def test_config_response(self):
        from api.src.email.schemas import EmailConfigResponse

        data = EmailConfigResponse(
            configured=True,
            from_address="noreply@intelimarket.py",
            host="smtp.gmail.com",
        )
        assert data.configured is True
        assert data.host == "smtp.gmail.com"

    def test_test_response(self):
        from api.src.email.schemas import EmailTestResponse

        data = EmailTestResponse(message="Correo de prueba enviado")
        assert data.message == "Correo de prueba enviado"


class TestEmailService:
    def test_is_configured_no_host(self):
        from api.src.email.service import is_configured

        import os
        host = os.environ.get("SMTP_HOST", "")
        if not host:
            assert is_configured() is False
        else:
            assert is_configured() is True

    def test_send_raw_email_no_config(self):
        from api.src.email.service import send_raw_email, SMTP_HOST

        if not SMTP_HOST:
            result = send_raw_email("test@test.com", "Test", "<p>Test</p>")
            assert result is False
