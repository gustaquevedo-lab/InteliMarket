"""Unit tests for router_closing and PDF generator"""
import pytest
from httpx import AsyncClient, ASGITransport
from api.src.financial.router_closing import router
from api.src.financial.monthly_closing_pdf import generate_closing_pdf
from fastapi import FastAPI

app = FastAPI()
app.include_router(router)

def test_generate_closing_pdf():
    mock_data = {
        "periodo": {"mes": 9, "anio": 2026, "mes_nombre": "Septiembre"},
        "empresa": {"razon_social": "GRUPO SANTA TERESA E.A.S.", "nombre_fantasia": "Extra Supermercado", "ruc": "80150377-9"},
        "kpis": {
            "ventas_netas": 12567994999,
            "utilidad_bruta": 2186844099,
            "margen_bruto_pct": 17.4,
            "total_opex": 961660833,
            "absorcion_opex_pct": 7.65,
            "costo_laboral_total": 600810833,
            "costo_laboral_pct": 4.78,
            "ebitda": 1225183266,
            "ebitda_pct": 9.75,
            "resultado_neto": 1080454266,
            "resultado_neto_pct": 8.60,
        },
        "ingresos": {"ventas_netas": 12567994999, "ventas_efectivo": 8682553757, "ventas_tarjetas_pos": 3885441242},
        "cogs": {"total_cmv": 10381150900},
        "nomina": {"total_costo_laboral": 600810833},
        "opex": {
            "ocupacion_servicios": {"total": 145800000},
            "mantenimiento_infraestructura": {"total": 54200000},
            "logistica_operacion": {"total": 98750000},
            "administracion_tecnologia": {"total": 62100000}
        },
        "financieros": {"total": 144729000},
        "ebitda": 1225183266,
        "resultado_neto": 1080454266
    }
    pdf_bytes = generate_closing_pdf(mock_data)
    assert isinstance(pdf_bytes, bytes)
    assert len(pdf_bytes) > 1000
    assert pdf_bytes.startswith(b"%PDF")


@pytest.mark.asyncio
async def test_get_closing_summary_endpoint():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/closing/summary?month=9&year=2026")
        assert response.status_code == 200
        data = response.json()
        assert data["periodo"]["mes"] == 9
        assert "ebitda" in data
        assert data["conciliacion_bancaria"]["saldo_calibrado_oficial"] == 73874004


@pytest.mark.asyncio
async def test_export_excel_endpoint():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/closing/export/excel?month=9&year=2026")
        assert response.status_code == 200
        assert "spreadsheetml" in response.headers["content-type"]
        assert len(response.content) > 1000


@pytest.mark.asyncio
async def test_export_pdf_endpoint():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/closing/export/pdf?month=9&year=2026")
        assert response.status_code == 200
        assert response.headers["content-type"] == "application/pdf"
        assert response.content.startswith(b"%PDF")
