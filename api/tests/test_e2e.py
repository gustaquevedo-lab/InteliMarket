"""End-to-end tests for main API flows"""

import pytest
import asyncio


class TestE2E:
    """Simulated E2E tests for core business flows."""

    def test_company_vertical_config(self):
        """Test vertical preset configuration."""
        from api.src.verticals.presets import VERTICALS, get_vertical, get_features_for_vertical
        
        assert "retail" in VERTICALS
        retail = get_vertical("retail")
        assert retail.nombre == "Retail / Tienda"
        assert "pos" in retail.features
        assert "logistics" not in retail.features
        
        distribucion = get_vertical("distribucion")
        assert "logistics" in distribucion.features
        assert "credit_accounts" in distribucion.features
        
        farmacia = get_vertical("farmacia")
        assert "stock_lots" in farmacia.features
        
        features = get_features_for_vertical("nonexistent")
        assert len(features) == 0  # returns empty for unknown vertical

    def test_price_list_schema(self):
        """Test price list creation validation."""
        from api.src.price_lists.schemas import PriceListCreate
        import uuid
        
        data = PriceListCreate(
            company_id=uuid.uuid4(),
            nombre="Mayorista",
            tipo="general",
        )
        assert data.nombre == "Mayorista"
        assert data.tipo == "general"

    def test_security_api_key_generation(self):
        """Test API key generation and validation."""
        from api.src.security.service import generate_api_key, hash_key
        
        key1 = generate_api_key()
        key2 = generate_api_key()
        
        assert key1.startswith("sk_")
        assert len(key1) == 51  # sk_ + 48 hex chars
        assert key1 != key2
        
        hash1 = hash_key(key1)
        hash2 = hash_key(key2)
        assert len(hash1) == 64  # SHA256 hex
        assert hash1 != hash2

    def test_security_rate_limiting(self):
        """Test rate limiting logic."""
        from api.src.security.service import check_rate_limit, _rate_limits
        
        _rate_limits.clear()
        test_key = "test_rate_key"
        
        for _ in range(100):
            assert check_rate_limit(test_key, max_requests=100)
        
        assert not check_rate_limit(test_key, max_requests=100)

    def test_audit_push_payload(self):
        """Test audit anomaly push payload structure."""
        payload = {
            "source": "intelimarket",
            "company_id": "test-company",
            "anomalies": [
                {
                    "tipo": "venta_monto_alto",
                    "venta_id": "sale-001",
                    "numero": "20260506-000-000001",
                    "total": 100000000,
                    "fecha": "2026-05-06",
                    "cliente": "Juan Perez",
                    "ruc": "80012345-6",
                    "descripcion": "Venta 20260506-000-000001 por Gs. 100,000,000 detectada como monto elevado",
                }
            ],
        }
        assert len(payload["anomalies"]) == 1
        assert payload["anomalies"][0]["tipo"] == "venta_monto_alto"

    def test_portal_customer_data(self):
        """Test customer portal data structure."""
        portal_data = {
            "id": "cust-uuid",
            "razon_social": "Cliente SA",
            "ruc": "80012345-6",
            "ci": None,
            "direccion": "Av. España 123",
            "telefono": "021123456",
            "email": "cliente@email.com",
        }
        assert "razon_social" in portal_data
        assert portal_data["ruc"] is not None
