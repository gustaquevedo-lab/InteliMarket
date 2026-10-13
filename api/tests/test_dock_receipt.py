"""Tests for dock reception quality control, shelf-life validation (Chortitzer) and batch tracking"""

from datetime import date, timedelta
from decimal import Decimal
import pytest
from api.src.purchases.service import validate_dock_shelf_life


class TestDockQualityControl:
    def test_shelf_life_insufficient_triggers_alert(self):
        """Si un lácteo tiene vencimiento en 12 días y el proveedor exige 20 días mínimos, dispara alerta"""
        today = date(2026, 9, 28)
        expiry = today + timedelta(days=12)
        min_days = 20

        result = validate_dock_shelf_life(
            fecha_vencimiento=expiry,
            vida_util_minima_dias=min_days,
            current_date=today
        )

        assert result["valido"] is False
        assert result["dias_restantes"] == 12
        assert "Vida útil insuficiente" in result["alerta"]
        assert "12 días" in result["alerta"]

    def test_shelf_life_sufficient_passes(self):
        """Si el producto tiene 45 días de vida útil y el mínimo es 20, pasa validación"""
        today = date(2026, 9, 28)
        expiry = today + timedelta(days=45)
        min_days = 20

        result = validate_dock_shelf_life(
            fecha_vencimiento=expiry,
            vida_util_minima_dias=min_days,
            current_date=today
        )

        assert result["valido"] is True
        assert result["dias_restantes"] == 45
        assert result["alerta"] is None

    def test_shelf_life_no_minimum_rule(self):
        """Si el proveedor no tiene regla de vida útil mínima (min_days = 0), pasa siempre"""
        today = date(2026, 9, 28)
        expiry = today + timedelta(days=5)

        result = validate_dock_shelf_life(
            fecha_vencimiento=expiry,
            vida_util_minima_dias=0,
            current_date=today
        )

        assert result["valido"] is True
        assert result["dias_restantes"] == 5
        assert result["alerta"] is None

    def test_shelf_life_expired_item(self):
        """Si el producto ya está vencido a la llegada al muelle, rechazo crítico"""
        today = date(2026, 9, 28)
        expiry = today - timedelta(days=1)

        result = validate_dock_shelf_life(
            fecha_vencimiento=expiry,
            vida_util_minima_dias=10,
            current_date=today
        )

        assert result["valido"] is False
        assert result["dias_restantes"] == -1
        assert "vencido" in result["alerta"].lower()
