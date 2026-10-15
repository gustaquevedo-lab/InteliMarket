from __future__ import annotations


def test_models_importable():
    from api.src.ruta_caja.models import (
        RouteSession, RouteLiquidation, RouteLiquidationItem, BankDeposit
    )
    assert RouteSession.__tablename__ == "route_sessions"
    assert RouteLiquidation.__tablename__ == "route_liquidations"
    assert RouteLiquidationItem.__tablename__ == "route_liquidation_items"
    assert BankDeposit.__tablename__ == "bank_deposits"


def test_route_session_has_unique_constraint():
    from api.src.ruta_caja.models import RouteSession
    constraint_names = [c.name for c in RouteSession.__table_args__ if hasattr(c, 'name')]
    assert any("unique" in (n or "").lower() or "uq" in (n or "").lower() for n in constraint_names)
