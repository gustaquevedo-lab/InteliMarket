from __future__ import annotations


def test_models_importable():
    from api.src.ruta_caja.models import (
        RouteSession, RouteLiquidation, RouteLiquidationItem, BankDeposit
    )
    assert RouteSession.__tablename__ == "route_sessions"
    assert RouteLiquidation.__tablename__ == "route_liquidations"
    assert RouteLiquidationItem.__tablename__ == "route_liquidation_items"
    assert BankDeposit.__tablename__ == "bank_deposits"


def test_route_session_ya_no_es_unica_por_cobrador_dia():
    """Una sesion por caja/salida: puede haber varias del mismo cobrador el mismo dia."""
    from api.src.ruta_caja.models import RouteSession
    nombres = [getattr(c, "name", None) for c in RouteSession.__table_args__]
    assert "uq_route_session_cobrador_fecha" not in nombres
    assert hasattr(RouteSession, "legacy_caja_id") and hasattr(RouteSession, "trip_id")
