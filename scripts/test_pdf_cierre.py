import asyncio
from sqlalchemy import text
from api.src.db import async_session_factory
from api.src.caja import service, pdf_reports

async def test_pdf_generation():
    async with async_session_factory() as db:
        sessions = [
            ("TOMASA", "81225f58-1c20-43b6-9e28-4c5bc0ce6be1"),
            ("EVELIN", "914e7eaf-23c2-49e6-9ed0-6fa838b9d891"),
            ("ZUNILDA", "c64d4688-9c20-45a6-8d45-97a4b6fcca7e"),
        ]

        for name, sid in sessions:
            print(f"\n--- Probando generacion de PDF para {name} ({sid}) ---")
            try:
                company_info = {"razon_social": "GRUPO SANTA TERESA E.A.S.", "ruc": "80150377-9"}
                data = await service.get_cierre_individual_report_data(db, sid, "00000000-0000-0000-0000-000000000010")
                print("Datos obtenidos de service:", data is not None)
                if data:
                    pdf_bytes = pdf_reports.generate_cierre_sesion_individual_pdf(
                        company_info,
                        data["session_data"],
                        data["payments_breakdown"],
                        data["cash_drops"],
                        "Sistema",
                    )
                    print(f"PDF generado exitosamente! Tamano: {len(pdf_bytes)} bytes")

            except Exception as e:
                import traceback
                print(f"ERROR al generar PDF para {name}: {e}")
                traceback.print_exc()

asyncio.run(test_pdf_generation())
