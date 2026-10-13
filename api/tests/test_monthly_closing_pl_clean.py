import pytest
from api.src.financial.monthly_closing_service import MonthlyClosingService


@pytest.mark.asyncio
async def test_monthly_closing_clean_pl_structure():
    service = MonthlyClosingService()
    closing = await service.get_monthly_closing_summary(
        company_id="80150377-9",
        month=9,
        year=2026,
    )

    cogs = closing["cogs"]
    opex = closing["opex"]
    kpis = closing["kpis"]

    # 1. COGS desglosa Reventa y Materia Prima Panadería
    assert "cmv_mercaderias" in cogs
    assert "cmv_materia_prima_panaderia" in cogs
    assert cogs["cmv_materia_prima_panaderia"] == 14873000
    assert cogs["total_cmv"] == 1020507216 + 14873000

    # 2. OPEX de Logística solo contiene consumibles e insumos de salón (sin harinas)
    detalles_log = opex["logistica_operacion"]["detalles"]
    rubros_log = [d["rubro"] for d in detalles_log]
    assert not any("Harinas" in r for r in rubros_log)
    assert not any("Bio X" in r for r in rubros_log)
    assert opex["logistica_operacion"]["total"] == 14351328

    # 3. OPEX no laboral limpio
    assert opex["total_opex_no_laboral"] == 94790810

    # 4. Nómina excluye aguinaldo proporcional (tratado como provisión diferida a diciembre)
    nomina = closing["nomina"]
    assert nomina["aguinaldo_diferido_acumulado"] == 12351178
    assert nomina["total_costo_laboral"] == 156723023

    # 5. Utilidad Bruta y EBITDA reflejan el nuevo criterio limpio
    assert kpis["utilidad_bruta"] == 1234596102 - (1020507216 + 14873000)
    assert kpis["total_opex"] == nomina["total_costo_laboral"] + opex["total_opex_no_laboral"]
    assert kpis["total_opex"] == 251513833
