"""Tests for farmacia module — schemas"""

import pytest
from datetime import datetime, date
from decimal import Decimal
from uuid import uuid4


class TestActiveIngredientSchemas:
    def test_create_active_ingredient(self):
        from api.src.farmacia.schemas import ActiveIngredientCreate
        data = ActiveIngredientCreate(
            nombre="Ibuprofeno",
            descripcion="Antiinflamatorio no esteroideo",
        )
        assert data.nombre == "Ibuprofeno"
        assert data.requiere_receta is False
        assert data.es_controlado is False

    def test_create_controlled_ingredient(self):
        from api.src.farmacia.schemas import ActiveIngredientCreate
        data = ActiveIngredientCreate(
            nombre="Midazolam",
            requiere_receta=True,
            es_controlado=True,
            categoria_controlado="III",
        )
        assert data.es_controlado is True
        assert data.categoria_controlado == "III"

    def test_response_with_from_attributes(self):
        from api.src.farmacia.schemas import ActiveIngredientResponse
        now = datetime(2026, 6, 10)
        data = ActiveIngredientResponse(
            id=uuid4(), company_id=uuid4(), nombre="Paracetamol",
            activo=True, created_at=now,
        )
        assert data.activo is True
        assert data.updated_at is None


class TestMedicationSchemas:
    def test_create_medication(self):
        from api.src.farmacia.schemas import MedicationCreate
        data = MedicationCreate(
            product_id=uuid4(),
            principio_activo_id=uuid4(),
            concentracion="500mg",
            forma_farmaceutica="comprimido",
        )
        assert data.via_administracion == "oral"
        assert data.es_generico is False
        assert data.requiere_cadena_frio is False

    def test_create_refrigerated_medication(self):
        from api.src.farmacia.schemas import MedicationCreate
        data = MedicationCreate(
            product_id=uuid4(),
            principio_activo_id=uuid4(),
            concentracion="10mg/ml",
            forma_farmaceutica="inyectable",
            requiere_cadena_frio=True,
            temp_min=Decimal("2"),
            temp_max=Decimal("8"),
        )
        assert data.requiere_cadena_frio is True
        assert data.temp_min == Decimal("2")

    def test_medication_search_result(self):
        from api.src.farmacia.schemas import MedicationSearchResult, MedicationResponse
        now = datetime(2026, 6, 10)
        med = MedicationResponse(
            id=uuid4(), company_id=uuid4(), product_id=uuid4(),
            principio_activo_id=uuid4(), concentracion="400mg",
            forma_farmaceutica="comprimido", activo=True, created_at=now,
        )
        result = MedicationSearchResult(
            medication=med,
            precio_venta_pyg=Decimal("25000"),
            disponible=True,
            stock_actual=100,
        )
        assert result.disponible is True
        assert result.stock_actual == 100

    def test_medication_update(self):
        from api.src.farmacia.schemas import MedicationUpdate
        data = MedicationUpdate(laboratorio="Roemmers", marca_comercial="Ibuflam")
        assert data.concentracion is None
        assert data.activo is None


class TestPrescriptionSchemas:
    def test_create_receta_simple(self):
        from api.src.farmacia.schemas import RecetaCreate, RecetaItem
        data = RecetaCreate(
            medico_nombre="Dr. Pérez",
            medico_matricula="12345",
            fecha_emision=date(2026, 6, 10),
            items=[RecetaItem(medication_id=uuid4(), cantidad=Decimal("30"))],
        )
        assert data.tipo_receta == "receta_simple"
        assert data.es_controlada is False
        assert len(data.items) == 1

    def test_create_receta_controlada(self):
        from api.src.farmacia.schemas import RecetaCreate, RecetaItem
        data = RecetaCreate(
            medico_nombre="Dr. López",
            medico_matricula="67890",
            fecha_emision=date(2026, 6, 10),
            es_controlada=True,
            categoria_controlado="III",
            tipo_receta="receta_controlada",
            items=[RecetaItem(medication_id=uuid4(), cantidad=Decimal("10"))],
        )
        assert data.es_controlada is True
        assert data.categoria_controlado == "III"


class TestInsuranceSchemas:
    def test_obra_social_create(self):
        from api.src.farmacia.schemas import ObraSocialCreate
        data = ObraSocialCreate(nombre="IPS", cobertura_default_pct=Decimal("80"))
        assert data.tipo == "obra_social"
        assert data.requiere_coseguro is True

    def test_cobertura_create(self):
        from api.src.farmacia.schemas import CoberturaCreate
        data = CoberturaCreate(
            obra_social_id=uuid4(),
            medication_id=uuid4(),
            cobertura_pct=Decimal("80"),
        )
        assert data.cobertura_pct == Decimal("80")

    def test_price_calc(self):
        from api.src.farmacia.schemas import PriceCalcRequest
        data = PriceCalcRequest(
            obra_social_id=uuid4(),
            medication_id=uuid4(),
            precio_unitario_pyg=Decimal("50000"),
        )
        assert data.cantidad == Decimal("1")


class TestColdChainSchemas:
    def test_cold_chain_log_create(self):
        from api.src.farmacia.schemas import ColdChainLogCreate
        data = ColdChainLogCreate(
            product_id=uuid4(),
            temperatura=Decimal("5.0"),
            temp_min_esperada=Decimal("2"),
            temp_max_esperada=Decimal("8"),
        )
        assert data.temperatura == Decimal("5.0")
        assert data.sensor_id is None


class TestDispensacionSchemas:
    def test_dispensacion_item(self):
        from api.src.farmacia.schemas import DispensacionItemCreate
        data = DispensacionItemCreate(
            medication_id=uuid4(),
            product_id=uuid4(),
            cantidad=Decimal("30"),
            precio_unitario_pyg=Decimal("25000"),
        )
        assert data.dosis is None

    def test_pos_dispensar_request(self):
        from api.src.farmacia.schemas import POSDispensarRequest, DispensacionItemCreate
        data = POSDispensarRequest(
            items=[DispensacionItemCreate(
                medication_id=uuid4(), product_id=uuid4(),
                cantidad=Decimal("30"), precio_unitario_pyg=Decimal("25000"),
            )],
            forzar_dispensacion=False,
        )
        assert len(data.items) == 1
        assert data.forzar_dispensacion is False


class TestSafetySchemas:
    def test_safety_alert(self):
        from api.src.farmacia.schemas import SafetyAlert
        data = SafetyAlert(
            tipo="interaccion",
            nivel="alta",
            codigo="INT-001",
            mensaje="Interacción con AINEs",
            recomendacion="Evitar uso conjunto",
        )
        assert data.nivel == "alta"

    def test_safety_check_response(self):
        from api.src.farmacia.schemas import SafetyCheckResponse
        from api.src.farmacia.schemas import SafetyAlert
        data = SafetyCheckResponse(
            puede_dispensar=True,
            alertas=[SafetyAlert(tipo="alergia", nivel="media", codigo="AL-001", mensaje="Alergia conocida")],
            alertas_blocking=[],
            mensaje="OK",
            nivel_maximo="media",
        )
        assert data.puede_dispensar is True
        assert len(data.alertas) == 1


class TestDashboardSchemas:
    def test_dashboard_data(self):
        from api.src.farmacia.schemas import FarmaciaDashboardData
        from datetime import datetime
        data = FarmaciaDashboardData(generated_at=datetime(2026, 6, 10))
        assert data.kpis_principales == {}
        assert data.alertas_safety_hoy == 0
