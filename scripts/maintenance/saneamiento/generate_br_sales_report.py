#!/usr/bin/env python3
"""Script autónomo para generar y exportar el informe de ventas de productos
de proveedores brasileños (BR) para los meses de Agosto y Setiembre 2026.
"""

import os
import sys
import asyncio
from datetime import date
from decimal import Decimal
from sqlalchemy import text

# Asegurar path de importación
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from api.src.db import async_session_factory
from api.src.reports import service, export_service


async def main():
    print("================================================================================")
    print(" REPORTE: VENTAS PROVEEDORES BR Y LOCALES SIN RUC — CONSUMIDOR FINAL (AGOSTO Y SETIEMBRE 2026)")
    print("================================================================================")

    f_desde = date(2026, 8, 1)
    f_hasta = date(2026, 9, 30)

    async with async_session_factory() as session:
        # 1. Obtener la empresa principal (Grupo Santa Teresa EAS)
        comp_res = await session.execute(
            text("SELECT id, razon_social, ruc FROM companies WHERE razon_social ILIKE '%SANTA TERESA%' LIMIT 1")
        )
        comp_row = comp_res.fetchone()
        if not comp_row:
            comp_res = await session.execute(text("SELECT id, razon_social, ruc FROM companies LIMIT 1"))
            comp_row = comp_res.fetchone()

        if not comp_row:
            print("❌ No se encontró empresa configurada en la base de datos.")
            return

        company_id = str(comp_row[0])
        company_name = comp_row[1]
        print(f"🏢 Empresa: {company_name} (ID: {company_id})")
        print(f"📅 Rango de auditoría: {f_desde} al {f_hasta} (América/Asunción)")
        print("🎯 Filtro de Cliente: EXCLUSIVAMENTE CONSUMIDOR FINAL (excluye facturas con RUC / nominadas)")

        # 2. Consultar ventas de proveedores BR
        print("\n🔍 Consultando base de datos...")
        data = await service.get_sales_by_br_suppliers(
            db=session,
            company_id=company_id,
            fecha_desde=f_desde,
            fecha_hasta=f_hasta,
            solo_consumidor_final=True,
        )

        print(f"✓ Registros recuperados: {len(data):,} líneas de venta (Consumidor Final)")

        if not data:
            print("⚠️ No se encontraron ventas de productos asignados a proveedores BR en este período.")
            # Verificar si existen proveedores BR en catálogo para dar visibilidad
            sup_res = await session.execute(
                text("""
                    SELECT id, razon_social, ruc, pais, tipo_proveedor, moneda_default
                    FROM suppliers
                    WHERE LOWER(COALESCE(tipo_proveedor, '')) IN ('brasilero', 'br')
                       OR LOWER(COALESCE(pais, '')) LIKE '%brasil%'
                       OR UPPER(COALESCE(moneda_default, '')) = 'BRL'
                    ORDER BY razon_social
                """)
            )
            sups = sup_res.fetchall()
            print(f"\n📋 Proveedores clasificados como BR en catálogo ({len(sups)}):")
            for s in sups:
                print(f"  - {s[1]} | RUC/CNPJ: {s[2]} | País: {s[3]} | Tipo: {s[4]} | Moneda: {s[5]}")

        # 3. Generar archivo Excel
        print("\n📊 Generando libro Excel con 3 pestañas (Detalle, Resumen Proveedor, Resumen Medios de Pago)...")
        xlsx_bytes = export_service.export_sales_by_br_suppliers(data, f_desde, f_hasta)

        out_path = os.path.abspath(os.path.join(
            os.path.dirname(__file__), "..", "Datos", "REPORTE_VENTAS_PROVEEDORES_BR_AGOSTO_SETIEMBRE_2026.xlsx"
        ))
        os.makedirs(os.path.dirname(out_path), exist_ok=True)

        with open(out_path, "wb") as f:
            f.write(xlsx_bytes)

        print(f"✓ Archivo Excel generado con éxito en:\n  👉 {out_path} ({len(xlsx_bytes):,} bytes)")

        # 4. Resumen ejecutivo en consola si hay datos
        if data:
            tot_unidades = sum(float(r.get("cantidad") or 0) for r in data)
            tot_ventas = sum(float(r.get("total_item") or 0) for r in data)
            distinct_prods = len(set(r.get("product_id") for r in data))
            distinct_sups = len(set(r.get("supplier_id") for r in data))
            distinct_tickets = len(set(r.get("sale_id") for r in data))

            print("\n--------------------------------------------------------------------------------")
            print(" RESUMEN EJECUTIVO:")
            print(f"  • Total Ventas Gs.:        Gs. {tot_ventas:,.0f}")
            print(f"  • Total Unidades Vendidas: {tot_unidades:,.2f}")
            print(f"  • Tickets Involucrados:    {distinct_tickets:,}")
            print(f"  • SKUs Distintos Vendidos: {distinct_prods:,}")
            print(f"  • Proveedores BR Activos:  {distinct_sups:,}")
            print("--------------------------------------------------------------------------------")

            # Resumen top 5 proveedores
            sup_totals = {}
            for r in data:
                nom = r.get("proveedor_nombre") or "Sin Nombre"
                sup_totals[nom] = sup_totals.get(nom, 0.0) + float(r.get("total_item") or 0)

            print("\n🏆 TOP PROVEEDORES BR POR VENTAS:")
            for nom, tot in sorted(sup_totals.items(), key=lambda x: x[1], reverse=True)[:5]:
                pct = (tot / max(tot_ventas, 1.0)) * 100
                print(f"  - {nom:<35} Gs. {tot:14,.0f} ({pct:5.1f}%)")

            # Resumen medios de pago
            pay_totals = {}
            for r in data:
                mp = r.get("medios_pago") or "EFECTIVO"
                pay_totals[mp] = pay_totals.get(mp, 0.0) + float(r.get("total_item") or 0)

            print("\n💳 VENTAS BR POR MEDIO DE PAGO:")
            for mp, tot in sorted(pay_totals.items(), key=lambda x: x[1], reverse=True):
                pct = (tot / max(tot_ventas, 1.0)) * 100
                print(f"  - {mp:<35} Gs. {tot:14,.0f} ({pct:5.1f}%)")
            print("--------------------------------------------------------------------------------")


if __name__ == "__main__":
    asyncio.run(main())
