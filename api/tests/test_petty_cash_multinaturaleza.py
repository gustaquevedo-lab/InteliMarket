import pytest
from pydantic import ValidationError
from api.src.petty_cash.schemas import ExpenseCreate, NaturalezaEconomica, ProductionArea


def test_expense_create_validations():
    # 1. Requiere production_area si es CMV_MATERIA_PRIMA
    with pytest.raises(ValidationError):
        ExpenseCreate(
            monto=50000,
            descripcion="Harina para panadería",
            naturaleza_economica=NaturalezaEconomica.CMV_MATERIA_PRIMA,
            production_area=None
        )

    # 2. Válido con production_area
    valid_exp = ExpenseCreate(
        monto=50000,
        descripcion="Harina para panadería",
        naturaleza_economica=NaturalezaEconomica.CMV_MATERIA_PRIMA,
        production_area=ProductionArea.PANADERIA
    )
    assert valid_exp.production_area == ProductionArea.PANADERIA
    assert valid_exp.naturaleza_economica == NaturalezaEconomica.CMV_MATERIA_PRIMA

    # 3. Requiere cuotas si es GASTO_DIFERIDO_CUOTAS
    with pytest.raises(ValidationError):
        ExpenseCreate(
            monto=20000000,
            descripcion="Póliza de Seguro Río Seguros",
            naturaleza_economica=NaturalezaEconomica.GASTO_DIFERIDO_CUOTAS,
            cuota_actual=None,
            total_cuotas=None
        )

    # 4. Válido con cuotas
    valid_diferido = ExpenseCreate(
        monto=20000000,
        descripcion="Póliza de Seguro Río Seguros",
        naturaleza_economica=NaturalezaEconomica.GASTO_DIFERIDO_CUOTAS,
        cuota_actual=1,
        total_cuotas=10
    )
    assert valid_diferido.cuota_actual == 1
    assert valid_diferido.total_cuotas == 10

    # 5. Requiere periodo_devengado si es PASIVO_PERIODO_ANTERIOR
    with pytest.raises(ValidationError):
        ExpenseCreate(
            monto=132678966,
            descripcion="Pago Sueldos Agosto",
            naturaleza_economica=NaturalezaEconomica.PASIVO_PERIODO_ANTERIOR,
            periodo_devengado=None
        )

    # 6. Requiere employee_id si es ANTICIPO_PERSONAL
    with pytest.raises(ValidationError):
        ExpenseCreate(
            monto=1000000,
            descripcion="Adelanto quincenal",
            naturaleza_economica=NaturalezaEconomica.ANTICIPO_PERSONAL,
            employee_id=None
        )
