import asyncio
from datetime import date

from api.src.general_agent import service

C = "00000000-0000-0000-0000-000000000010"


def test_contexto_consulta_la_empresa_del_usuario_con_fecha_de_asuncion(monkeypatch):
    llamadas = {}

    def espia(nombre):
        async def f(db, *args, **kwargs):
            llamadas[nombre] = (args, kwargs)
            return {}
        return f

    for n in ("get_sales_summary", "get_financial_summary", "get_inventory_summary", "get_sales_by_product"):
        monkeypatch.setattr(service.reports_service, n, espia(n))
    monkeypatch.setattr(service.petty_cash_service, "get_expense_dashboard", espia("gastos"))
    monkeypatch.setattr(service, "_hoy", lambda: date(2026, 11, 2))

    ctx = asyncio.run(service._gather_context(None, C))

    assert ctx["fecha_actual"] == "2026-11-02"
    for n, (args, kwargs) in llamadas.items():
        assert (args[:1] or (kwargs.get("company_id"),))[0] == C, n
    assert llamadas["get_sales_summary"][1] == {"company_id": C, "fecha_desde": date(2026, 10, 3), "fecha_hasta": date(2026, 11, 2)}
    assert llamadas["get_sales_by_product"][1]["limit"] == 10
