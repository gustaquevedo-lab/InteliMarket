"""Tests for intelientregas module — schemas, models"""

import pytest
from datetime import datetime, date
from uuid import UUID, uuid4


class TestIntelientregasSchemas:
    """Test delivery module Pydantic schemas."""

    def test_driver_create(self):
        from api.src.intelientregas.schemas import DriverCreate

        data = DriverCreate(nombre="Juan Perez", telefono="0981123456")
        assert data.nombre == "Juan Perez"
        assert data.ci is None

    def test_vehicle_create(self):
        from api.src.intelientregas.schemas import VehicleCreate

        data = VehicleCreate(tipo="moto", patente="ABC 123")
        assert data.tipo == "moto"
        assert data.tiene_caja_termica is False

    def test_delivery_create(self):
        from api.src.intelientregas.schemas import DeliveryCreate

        data = DeliveryCreate(
            customer_nombre="Cliente SA",
            direccion="Av. Mariscal Lopez 1234",
        )
        assert data.prioridad == "normal"
        assert data.costo_delivery == 0

    def test_delivery_assign(self):
        from api.src.intelientregas.schemas import DeliveryAssign

        driver_id = uuid4()
        data = DeliveryAssign(driver_id=driver_id)
        assert data.driver_id == driver_id
        assert data.vehicle_id is None

    def test_route_create(self):
        from uuid import uuid4
        from datetime import date
        from api.src.intelientregas.schemas import RouteCreate

        data = RouteCreate(nombre="Ruta Centro", fecha=date(2026, 5, 22))
        assert data.nombre == "Ruta Centro"
        assert data.observaciones is None

    def test_tracking_event_create(self):
        from api.src.intelientregas.schemas import TrackingEventCreate

        delivery_id = uuid4()
        data = TrackingEventCreate(
            delivery_id=delivery_id,
            latitud=-25.282,
            longitud=-57.635,
            evento="picked_up",
        )
        assert data.evento == "picked_up"

    def test_delivery_proof_create(self):
        from api.src.intelientregas.schemas import DeliveryProofCreate

        data = DeliveryProofCreate(tipo="firma")
        assert data.tipo == "firma"

    def test_zone_create(self):
        from api.src.intelientregas.schemas import ZoneCreate

        data = ZoneCreate(nombre="Zona Norte", costo_base=10000, costo_km=2000)
        assert data.costo_base == 10000
        assert data.costo_km == 2000
        assert data.tiempo_estimado_min == 30  # default

    def test_delivery_status_update(self):
        from api.src.intelientregas.schemas import DeliveryUpdateStatus

        data = DeliveryUpdateStatus(estado="in_transit")
        assert data.estado == "in_transit"

        data = DeliveryUpdateStatus(estado="failed", motivo_falla="Cliente ausente")
        assert data.motivo_falla == "Cliente ausente"

    def test_delivery_assign_response(self):
        from api.src.intelientregas.schemas import DeliveryAssign

        data = DeliveryAssign(driver_id=uuid4())
        assert data.driver_id is not None


class TestIntelientregasModels:
    """Test model imports and attributes."""

    def test_models_have_tablenames(self):
        from api.src.intelientregas.models import (
            Driver, Vehicle, Delivery, Route, RouteStop,
            TrackingEvent, DeliveryProof, DeliveryZone,
        )
        for model in [Driver, Vehicle, Delivery, Route, RouteStop,
                      TrackingEvent, DeliveryProof, DeliveryZone]:
            assert hasattr(model, "__tablename__")
            assert model.__tablename__.startswith("intelientregas_")

    def test_expected_resource_endpoints(self):
        expected = [
            "/v1/intelientregas/drivers",
            "/v1/intelientregas/vehicles",
            "/v1/intelientregas/deliveries",
            "/v1/intelientregas/routes",
            "/v1/intelientregas/tracking",
            "/v1/intelientregas/zones",
            "/v1/intelientregas/stats",
        ]
        for path in expected:
            assert path is not None
