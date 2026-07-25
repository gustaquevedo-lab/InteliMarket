"""Tests for loyalty module — schemas and service"""

import pytest
import uuid
from datetime import datetime


class TestLoyaltySchemas:
    def test_config_create(self):
        from api.src.loyalty.schemas import LoyaltyConfigCreate

        data = LoyaltyConfigCreate(
            company_id=uuid.uuid4(),
            puntos_por_guarani=1,
            guarani_por_punto=100,
            vencimiento_dias=365,
            canje_minimo_puntos=100,
        )
        assert data.puntos_por_guarani == 1
        assert data.canje_minimo_puntos == 100
        assert data.bienvenida_puntos == 50
        assert data.activo is True

    def test_config_update(self):
        from api.src.loyalty.schemas import LoyaltyConfigUpdate

        data = LoyaltyConfigUpdate(puntos_por_guarani=2, activo=False)
        assert data.puntos_por_guarani == 2
        assert data.activo is False
        assert data.guarani_por_punto is None

    def test_config_response(self):
        from api.src.loyalty.schemas import LoyaltyConfigResponse

        now = datetime(2026, 6, 11)
        data = LoyaltyConfigResponse(
            id=uuid.uuid4(),
            company_id=uuid.uuid4(),
            puntos_por_guarani=1,
            guarani_por_punto=100,
            vencimiento_dias=365,
            canje_minimo_puntos=100,
            bienvenida_puntos=50,
            cumpleanos_puntos=200,
            crear_en_venta=True,
            activo=True,
            created_at=now,
            updated_at=now,
        )
        assert data.puntos_por_guarani == 1
        # from_attributes configured via Config

    def test_points_create(self):
        from api.src.loyalty.schemas import PointsCreate

        data = PointsCreate(
            company_id=uuid.uuid4(),
            customer_id=uuid.uuid4(),
            tipo="ganado",
            puntos=500,
            referencia_tipo="venta",
            referencia_id="VENTA-001",
        )
        assert data.tipo == "ganado"
        assert data.puntos == 500
        assert data.descripcion is None

    def test_points_response(self):
        from api.src.loyalty.schemas import PointsResponse

        now = datetime(2026, 6, 11)
        data = PointsResponse(
            id=uuid.uuid4(),
            company_id=uuid.uuid4(),
            customer_id=uuid.uuid4(),
            tipo="ganado",
            puntos=500,
            created_at=now,
        )
        assert data.puntos == 500
        assert data.referencia_tipo is None
        # from_attributes configured via Config

    def test_balance(self):
        from api.src.loyalty.schemas import PointsBalance

        data = PointsBalance(
            customer_id=uuid.uuid4(),
            total_puntos=1500,
            puntos_por_vencer=200,
        )
        assert data.total_puntos == 1500
        assert data.customer_id is not None

    def test_reward_create(self):
        from api.src.loyalty.schemas import LoyaltyRewardCreate

        data = LoyaltyRewardCreate(
            company_id=uuid.uuid4(),
            nombre="Descuento 10%",
            puntos_requeridos=1000,
            tipo_recompensa="descuento",
            valor_recompensa=50000,
        )
        assert data.nombre == "Descuento 10%"
        assert data.puntos_requeridos == 1000
        assert data.stock is None

    def test_reward_response(self):
        from api.src.loyalty.schemas import LoyaltyRewardResponse

        now = datetime(2026, 6, 11)
        data = LoyaltyRewardResponse(
            id=uuid.uuid4(),
            company_id=uuid.uuid4(),
            nombre="Producto Gratis",
            puntos_requeridos=2000,
            tipo_recompensa="producto",
            activo=True,
            created_at=now,
            updated_at=now,
        )
        assert data.nombre == "Producto Gratis"
        assert data.stock is None
        # from_attributes configured via Config


class TestLoyaltyService:
    def test_model_creation(self):
        from api.src.loyalty.models import LoyaltyConfig

        config = LoyaltyConfig(
            company_id=uuid.uuid4(),
            puntos_por_guarani=1,
            guarani_por_punto=100,
            vencimiento_dias=365,
            canje_minimo_puntos=100,
            bienvenida_puntos=50,
            cumpleanos_puntos=200,
        )
        assert config.puntos_por_guarani == 1
        assert config.guarani_por_punto == 100
        assert config.vencimiento_dias == 365
