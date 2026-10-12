"""Unit tests for MonthlyClosingService"""
import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from api.src.financial.monthly_closing_service import MonthlyClosingService

@pytest.mark.asyncio
async def test_monthly_closing_service_structure_and_kpis():
    session = AsyncMock()
    service = MonthlyClosingService(session)
    
    # We call the service for September 2026
    data = await service.get_monthly_closing_summary(
        company_id="80150377-9",
        month=9,
        year=2026
    )
    
    assert data["periodo"]["mes"] == 9
    assert data["periodo"]["anio"] == 2026
    assert data["periodo"]["mes_nombre"] == "Septiembre"
    assert data["empresa"]["ruc"] == "80150377-9"
    
    # Verify magnitudes exist
    assert "ingresos" in data
    assert "cogs" in data
    assert "nomina" in data
    assert "opex" in data
    assert "financieros" in data
    assert "ebitda" in data
    assert "resultado_neto" in data
    assert "conciliacion_bancaria" in data
    
    # Verify payroll labor cost calculations
    # IPS patronal must be 16.5% of gross salary
    assert data["nomina"]["ips_patronal_pct"] == 16.5
    assert data["nomina"]["aguinaldo_provisional_pct"] == 8.33
    
    # Verify calibrated bank balances
    assert data["conciliacion_bancaria"]["saldo_calibrado_oficial"] == 73874004
