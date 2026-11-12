"""Tests for risk_agent module -- classification, schemas, and discount handling."""
import pytest
from api.src.risk_agent.schemas import (
    RiskEventItem, RiskDashboard, AccionDisponible, RiskByCajero, RiskTrendPoint
)
from api.src.risk_agent.service import (
    _classify_event, _extract_actor, ACCION_LABELS
)


class TestRiskAgentClassification:
    def test_classify_descuento_percentage(self):
        datos = {
            "caja": "Caja 5",
            "cajero_nombre": "MARISTELA IBARRA",
            "autorizado_por_nombre": "MARISTELA IBARRA",
            "tipo_descuento": "percentage",
            "valor_descuento": 12,
            "monto_descuento_pyg": 2808,
            "total_con_descuento_pyg": 20592,
            "motivo": "Error de escaneo / digitación",
        }
        nivel, cat, desc, monto, label, det = _classify_event("descuento_directo_autorizado", datos)
        assert nivel == "ALTO"
        assert cat == "financiero"
        assert "12%" in desc
        assert "2.808" in desc
        assert "20.592" in desc
        assert "Error de escaneo / digitación" in desc
        assert monto == 2808.0
        assert label == "Descuento Directo en Caja"
        assert det["monto_descuento_pyg"] == 2808.0
        assert det["total_con_descuento_pyg"] == 20592.0

    def test_classify_descuento_fixed(self):
        datos = {
            "caja": "Caja 4",
            "cajero_nombre": "EVELIN HERRERO",
            "autorizado_por_nombre": "EVELIN HERRERO",
            "tipo_descuento": "fixed",
            "valor_descuento": 1675,
            "monto_descuento_pyg": 1675,
            "total_con_descuento_pyg": 154403,
            "motivo": "Error de escaneo / digitación",
        }
        nivel, cat, desc, monto, label, det = _classify_event("descuento_directo_autorizado", datos)
        assert nivel == "ALTO"
        assert cat == "financiero"
        assert "fijo" in desc
        assert "1.675" in desc
        assert monto == 1675.0
        assert det["tipo_descuento"] == "fixed"

    def test_classify_supervisor_action(self):
        datos = {"descripcion": "Anulación de ítem autorizada", "caja": "Caja 2"}
        nivel, cat, desc, monto, label, det = _classify_event("supervisor_remove_item", datos)
        assert nivel == "MEDIO"
        assert cat == "operativo"
        assert desc == "Anulación de ítem autorizada"
        assert label == "Anulación de Ítem / Producto"

    def test_classify_cobro_cancelado(self):
        datos = {"total_venta_pyg": 50000, "caja": "Caja 3"}
        nivel, cat, desc, monto, label, det = _classify_event("cobro_aprobado_cancelado", datos)
        assert nivel == "ALTO"
        assert cat == "financiero"
        assert "50.000" in desc
        assert monto == 50000.0

    def test_extract_actor(self):
        datos = {
            "cajero_nombre": "LIZ CENTURION",
            "caja": "Caja 5",
            "autorizado_por_nombre": "ZUNILDA RODRIGUEZ",
        }
        cajero, caja, aut, u_prin = _extract_actor("descuento_directo_autorizado", datos, "User System")
        assert cajero == "LIZ CENTURION"
        assert caja == "Caja 5"
        assert aut == "ZUNILDA RODRIGUEZ"
        assert u_prin == "LIZ CENTURION"

    def test_schemas_risk_dashboard(self):
        dash = RiskDashboard(
            periodo_dias=30,
            total_eventos=10,
            total_alto=2,
            total_medio=3,
            total_bajo=5,
            total_descuentos=2,
            monto_total_descuentos_pyg=4483.0,
            por_categoria={"financiero": 2, "operativo": 8},
            por_accion={"descuento_directo_autorizado": 2, "supervisor_remove_item": 8},
            acciones_disponibles=[
                AccionDisponible(accion="descuento_directo_autorizado", label="Descuento Directo en Caja", total=2)
            ],
            usuarios_disponibles=["LIZ CENTURION", "MARISTELA IBARRA"],
            top_cajeros_riesgo=[
                RiskByCajero(cajero="LIZ CENTURION", total_eventos=5, eventos_alto=2, eventos_medio=1, eventos_bajo=2, score_riesgo=9.5)
            ],
            tendencia=[
                RiskTrendPoint(fecha="2026-11-11", total=5, alto=1, medio=2, bajo=2)
            ],
            eventos_recientes_alto=[],
            eventos_recientes_descuento=[],
            resumen_ejecutivo="Test resumen",
        )
        assert dash.total_descuentos == 2
        assert dash.monto_total_descuentos_pyg == 4483.0
        assert len(dash.acciones_disponibles) == 1
        assert len(dash.usuarios_disponibles) == 2
