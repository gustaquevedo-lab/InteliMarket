"""Tests for distributor purchase suggestions with pending Inteliforce orders and pack rounding"""

import math
from decimal import Decimal
import pytest
from api.src.purchases.service import calculate_distributor_purchase_quantity


class TestDistributorPurchaseSuggestions:
    def test_calculate_with_pending_orders(self):
        """
        Stock físico: 50
        Pedidos pendientes en preventa (Inteliforce): 40
        Stock disponible neto: 10
        Punto de reorden deseado: 80
        Déficit base: 70
        Múltiplo de fardo: 6
        Cantidad sugerida redondeada a fardo: 72
        """
        result = calculate_distributor_purchase_quantity(
            current_stock=Decimal("50"),
            pending_orders_qty=Decimal("40"),
            reorder_point=Decimal("80"),
            pack_multiple=6,
            min_order=0,
            max_order=999999,
            admite_bonificaciones=False
        )

        assert result["stock_disponible"] == Decimal("10")
        assert result["deficit_neto"] == Decimal("70")
        assert result["cantidad_sugerida"] == Decimal("72")
        assert result["bultos"] == 12
        assert result["bonificacion_sugerida"] == Decimal("0")

    def test_calculate_with_paresa_bonification(self):
        """
        Paresa: admite bonificaciones. Por cada 50 unidades, bonificación estimada de 5 unidades.
        """
        result = calculate_distributor_purchase_quantity(
            current_stock=Decimal("20"),
            pending_orders_qty=Decimal("80"),
            reorder_point=Decimal("100"),
            pack_multiple=12,
            min_order=0,
            max_order=999999,
            admite_bonificaciones=True,
            regla_bonificacion={"cada": 50, "bonifica": 5}
        )
        # deficit = 100 - (20 - 80) = 160
        # redondeo fardo x12: ceil(160 / 12) * 12 = 14 * 12 = 168
        assert result["stock_disponible"] == Decimal("-60")
        assert result["deficit_neto"] == Decimal("160")
        assert result["cantidad_sugerida"] == Decimal("168")
        assert result["bultos"] == 14
        # 168 // 50 = 3 bonificaciones * 5 = 15 bonificadas
        assert result["bonificacion_sugerida"] == Decimal("15")

    def test_no_purchase_needed_when_stock_exceeds(self):
        """No se sugiere compra si el stock neto disponible supera el punto de reorden"""
        result = calculate_distributor_purchase_quantity(
            current_stock=Decimal("150"),
            pending_orders_qty=Decimal("20"),
            reorder_point=Decimal("80"),
            pack_multiple=6,
        )
        assert result["stock_disponible"] == Decimal("130")
        assert result["deficit_neto"] == Decimal("0")
        assert result["cantidad_sugerida"] == Decimal("0")
        assert result["bultos"] == 0
