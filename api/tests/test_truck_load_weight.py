"""Tests for truck load weight estimation, capacity semaphore and overload detection"""

from decimal import Decimal
import pytest
from api.src.distribuidora.service import calculate_truck_load_weight


class TestTruckLoadWeight:
    def test_truck_overload_triggers_red_semaphore(self):
        """Camión con capacidad de 5.000 kg cargado con 5.500 kg da semáforo rojo (sobrecarga)"""
        items = [
            {"product_id": "prod-1", "cantidad": 100, "peso_kg": Decimal("50.0")},  # 5000 kg (ej. bolsas Trociuk)
            {"product_id": "prod-2", "cantidad": 25, "peso_kg": Decimal("20.0")},   # 500 kg
        ]
        max_capacity = Decimal("5000")

        result = calculate_truck_load_weight(items=items, max_weight_kg=max_capacity)

        assert result["total_peso_kg"] == Decimal("5500")
        assert result["capacidad_maxima_kg"] == Decimal("5000")
        assert result["utilizacion_pct"] == 110.0
        assert result["semaforo"] == "rojo"
        assert result["sobrecarga_kg"] == Decimal("500")
        assert result["aprobado_despacho"] is False

    def test_truck_optimal_load_triggers_green_semaphore(self):
        """Carga de 3.500 kg en camión de 5.000 kg (70% utilización) -> verde"""
        items = [
            {"product_id": "prod-1", "cantidad": 70, "peso_kg": Decimal("50.0")},  # 3500 kg
        ]
        max_capacity = Decimal("5000")

        result = calculate_truck_load_weight(items=items, max_weight_kg=max_capacity)

        assert result["total_peso_kg"] == Decimal("3500")
        assert result["utilizacion_pct"] == 70.0
        assert result["semaforo"] == "verde"
        assert result["sobrecarga_kg"] == Decimal("0")
        assert result["aprobado_despacho"] is True

    def test_truck_near_capacity_triggers_amber_semaphore(self):
        """Carga de 4.600 kg en camión de 5.000 kg (92% utilización) -> ámbar"""
        items = [
            {"product_id": "prod-1", "cantidad": 92, "peso_kg": Decimal("50.0")},  # 4600 kg
        ]
        max_capacity = Decimal("5000")

        result = calculate_truck_load_weight(items=items, max_weight_kg=max_capacity)

        assert result["total_peso_kg"] == Decimal("4600")
        assert result["utilizacion_pct"] == 92.0
        assert result["semaforo"] == "ambar"
        assert result["sobrecarga_kg"] == Decimal("0")
        assert result["aprobado_despacho"] is True
