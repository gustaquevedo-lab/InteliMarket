import pytest
from uuid import uuid4
from decimal import Decimal
from pydantic import ValidationError
from api.src.supermer.schemas import (
    RequisitionCreate,
    RequisitionItemCreate,
    RequisitionStatus,
    RequisitionResponse,
)


def test_requisition_schemas():
    # 1. Validación de creación con items
    req = RequisitionCreate(
        solicitado_por="Panadero Juan",
        area_destino="panaderia",
        items=[
            RequisitionItemCreate(
                barcode="7840001001",
                product_name="Leche Trébol 1L",
                cantidad=Decimal("5.0"),
                unidad_medida="UN",
                costo_unitario_estimado=Decimal("4500"),
                precio_venta_salon=Decimal("6000"),
            )
        ],
        observaciones="Insumos para pastelería matutina",
    )
    assert req.area_destino == "panaderia"
    assert len(req.items) == 1
    assert req.items[0].cantidad == Decimal("5.0")
    assert req.items[0].precio_venta_salon == Decimal("6000")

    # 2. Requiere al menos un item
    with pytest.raises(ValidationError):
        RequisitionCreate(
            solicitado_por="Cocinero Pedro",
            area_destino="rotiseria",
            items=[],
        )


def test_generate_thermal_ticket_text():
    from datetime import datetime
    from api.src.supermer.models import InternalRequisition, InternalRequisitionItem
    from api.src.supermer.requisitions_service import generate_thermal_ticket_text

    req = InternalRequisition(
        numero_requisicion="REQ-2026-00042",
        solicitado_por="Carlos Chef",
        area_destino="rotiseria",
        aprobado_por="Luis Encargado",
        aprobado_at=datetime(2026, 9, 15, 10, 30),
    )
    req.items = [
        InternalRequisitionItem(
            barcode="7840001001",
            product_name="Leche Trébol 1L",
            cantidad=Decimal("5.0"),
            unidad_medida="UN",
            precio_venta_salon=Decimal("6000"),
        ),
        InternalRequisitionItem(
            barcode="7840002002",
            product_name="Queso Muzarella kg",
            cantidad=Decimal("2.5"),
            unidad_medida="KG",
            precio_venta_salon=Decimal("38000"),
        ),
    ]

    ticket = generate_thermal_ticket_text(req)
    assert "VALE DE REQUISICION DE CONSUMO INTERNO" in ticket
    assert "REQ-2026-00042" in ticket
    assert "ROTISERIA" in ticket
    assert "Carlos Chef" in ticket
    assert "Luis Encargado" in ticket
    assert "Leche Trébol 1L" in ticket
    assert "7840001001" in ticket
    assert "80150377-9" in ticket
    assert "Firma Encargado Salón" in ticket
