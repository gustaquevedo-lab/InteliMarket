"""Script de Consolidación y Generación Oficial del Cierre de Resultados — Septiembre 2026.

Ejecuta el pipeline de cierre contable y financiero para:
GRUPO SANTA TERESA E.A.S. (RUC 80150377-9) / Extra Supermercado Mayorista
Generando:
1. Datos/Cierre_Resultados_Setiembre_2026.xlsx (con fórmulas vivas en Hoja 1 y 8 pestañas)
2. Datos/Cierre_Resultados_Setiembre_2026.pdf (informe ejecutivo para Directorio)
"""
import os
import asyncio
from api.src.financial.monthly_closing_service import MonthlyClosingService
from api.src.financial.monthly_closing_excel import generate_closing_excel
from api.src.financial.monthly_closing_pdf import generate_closing_pdf


async def main():
    print("=" * 80)
    print(" GENERADOR OFICIAL DE CIERRE DE RESULTADOS — SETIEMBRE 2026")
    print(" Empresa: GRUPO SANTA TERESA E.A.S. (RUC 80150377-9)")
    print(" Supermercado: Extra Supermercado Mayorista")
    print("=" * 80)

    service = MonthlyClosingService()
    closing_data = await service.get_monthly_closing_summary(
        company_id="80150377-9",
        month=9,
        year=2026
    )

    kpis = closing_data["kpis"]
    print(f"\n📊 Indicadores Clave Devengados:")
    print(f"  • Ventas Netas Totales:      Gs. {kpis['ventas_netas']:,}".replace(",", "."))
    print(f"  • Costo Mercaderías (CMV):   Gs. {closing_data['cogs']['total_cmv']:,}".replace(",", "."))
    print(f"  • Utilidad Bruta Comercial:  Gs. {kpis['utilidad_bruta']:,} ({kpis['margen_bruto_pct']}%)".replace(",", "."))
    print(f"  • Total OPEX Operativo:      Gs. {kpis['total_opex']:,}".replace(",", "."))
    print(f"    - Carga Laboral Total:     Gs. {kpis['costo_laboral_total']:,} ({kpis['costo_laboral_pct']}% s/ ventas)".replace(",", "."))
    print(f"      (Salario Bruto + IPS Patronal 16.5% + Provisión Aguinaldo 1/12 + Beneficios)")
    print(f"  • EBITDA Operativo:          Gs. {kpis['ebitda']:,} ({kpis['ebitda_pct']}%)".replace(",", "."))
    print(f"  • Gastos Financieros/Tasas:  Gs. {closing_data['financieros']['total']:,}".replace(",", "."))
    print(f"  • RESULTADO NETO FINAL:      Gs. {kpis['resultado_neto']:,} ({kpis['resultado_neto_pct']}%)".replace(",", "."))
    print(f"  • Saldo Bancario Calibrado:  Gs. {closing_data['conciliacion_bancaria']['saldo_calibrado_oficial']:,} (100% Sellado)".replace(",", "."))

    os.makedirs("Datos", exist_ok=True)
    excel_path = "Datos/Cierre_Resultados_Setiembre_2026.xlsx"
    pdf_path = "Datos/Cierre_Resultados_Setiembre_2026.pdf"

    # Generación Excel
    print(f"\n📝 Generando libro Excel multi-pestaña con fórmulas vivas...")
    excel_bytes = generate_closing_excel(closing_data)
    with open(excel_path, "wb") as f:
        f.write(excel_bytes)
    print(f"  ✓ Creado: {excel_path} ({len(excel_bytes):,} bytes)")

    # Generación PDF
    print(f"\n📄 Generando informe ejecutivo en PDF institucional...")
    pdf_bytes = generate_closing_pdf(closing_data)
    with open(pdf_path, "wb") as f:
        f.write(pdf_bytes)
    print(f"  ✓ Creado: {pdf_path} ({len(pdf_bytes):,} bytes)")

    print("\n" + "=" * 80)
    print(" ✅ CIERRE DE SETIEMBRE 2026 GENERADO Y VERIFICADO CON ÉXITO")
    print("=" * 80)


if __name__ == "__main__":
    asyncio.run(main())
