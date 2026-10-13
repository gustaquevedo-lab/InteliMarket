#!/usr/bin/env python3
"""
Seed Butchery / Desposte Templates from Excel data files using asyncpg
Extra Supermercado (Central)
Company ID: 00000000-0000-0000-0000-000000000010
"""
import asyncio
import asyncpg
from decimal import Decimal

DB_URL = "postgresql://intelimarket:password@localhost:5432/intelimarket"
COMPANY_ID = "00000000-0000-0000-0000-000000000010"

TEMPLATES = [
    {
        "nombre": "Vaca 6 Cortes c/ Cupim (200-249kg)",
        "especie": "Bovino",
        "peso_promedio_kg": Decimal("297.20"),
        "descripcion": "Desposte maestro vacuno de 6 cortes con Cupim según planilla técnica Extra Supermercado",
        "cuts": [
            {"sku": "120094", "nombre_planilla": "BISTECA", "peso": Decimal("32.41"), "rend_pct": Decimal("10.91"), "precio_venta": Decimal("37777"), "subprod": False},
            {"sku": "123513", "nombre_planilla": "BOLA DE LOMO", "peso": Decimal("9.11"), "rend_pct": Decimal("3.07"), "precio_venta": Decimal("59777"), "subprod": False},
            {"sku": "123514", "nombre_planilla": "CARA DE PALETA", "peso": Decimal("16.98"), "rend_pct": Decimal("5.71"), "precio_venta": Decimal("45777"), "subprod": False},
            {"sku": "120092", "nombre_planilla": "CARNAZA BLANCA/PECETO", "peso": Decimal("17.09"), "rend_pct": Decimal("5.75"), "precio_venta": Decimal("55777"), "subprod": False},
            {"sku": "123521", "nombre_planilla": "CARNAZA NEGRA", "peso": Decimal("17.35"), "rend_pct": Decimal("5.84"), "precio_venta": Decimal("59777"), "subprod": False},
            {"sku": "120099", "nombre_planilla": "CARNE MOLIDA DE PRIMERA", "peso": Decimal("25.68"), "rend_pct": Decimal("8.64"), "precio_venta": Decimal("39777"), "subprod": False},
            {"sku": "120091", "nombre_planilla": "COLITA CUADRIL/MAMINHA", "peso": Decimal("2.38"), "rend_pct": Decimal("0.80"), "precio_venta": Decimal("64777"), "subprod": False},
            {"sku": "120093", "nombre_planilla": "COSTILLA/MATAMBRE", "peso": Decimal("35.83"), "rend_pct": Decimal("12.06"), "precio_venta": Decimal("36777"), "subprod": False},
            {"sku": "120117", "nombre_planilla": "CUPIM", "peso": Decimal("6.01"), "rend_pct": Decimal("2.02"), "precio_venta": Decimal("40777"), "subprod": False},
            {"sku": "120141", "nombre_planilla": "GARRON", "peso": Decimal("7.77"), "rend_pct": Decimal("2.61"), "precio_venta": Decimal("5777"), "subprod": False},
            {"sku": "120084", "nombre_planilla": "LOMITO/FILE MIGNON", "peso": Decimal("3.21"), "rend_pct": Decimal("1.08"), "precio_venta": Decimal("73777"), "subprod": False},
            {"sku": "120491", "nombre_planilla": "LOMO/CONTRA FILE", "peso": Decimal("0.00"), "rend_pct": Decimal("0.00"), "precio_venta": Decimal("62777"), "subprod": False},
            {"sku": "120096", "nombre_planilla": "OSSOBUCO", "peso": Decimal("10.15"), "rend_pct": Decimal("3.41"), "precio_venta": Decimal("29777"), "subprod": False},
            {"sku": "123519", "nombre_planilla": "PEIXINHO", "peso": Decimal("2.49"), "rend_pct": Decimal("0.84"), "precio_venta": Decimal("45777"), "subprod": False},
            {"sku": "120095", "nombre_planilla": "PUCHERO DE PRIMERA", "peso": Decimal("5.33"), "rend_pct": Decimal("1.79"), "precio_venta": Decimal("24777"), "subprod": False},
            {"sku": "120098", "nombre_planilla": "PUCHERO DE SEGUNDA", "peso": Decimal("21.64"), "rend_pct": Decimal("7.28"), "precio_venta": Decimal("14777"), "subprod": False},
            {"sku": "120104", "nombre_planilla": "PUNTA DE PALETA", "peso": Decimal("6.73"), "rend_pct": Decimal("2.26"), "precio_venta": Decimal("45777"), "subprod": False},
            {"sku": "120107", "nombre_planilla": "PUNTA DE PECHO", "peso": Decimal("9.94"), "rend_pct": Decimal("3.34"), "precio_venta": Decimal("47777"), "subprod": False},
            {"sku": "120090", "nombre_planilla": "RABADILLA", "peso": Decimal("6.89"), "rend_pct": Decimal("2.32"), "precio_venta": Decimal("62777"), "subprod": False},
            {"sku": "119857", "nombre_planilla": "TAPA CUADRIL/PICANHA", "peso": Decimal("3.83"), "rend_pct": Decimal("1.29"), "precio_venta": Decimal("77777"), "subprod": False},
            {"sku": "120108", "nombre_planilla": "VACIO", "peso": Decimal("8.18"), "rend_pct": Decimal("2.75"), "precio_venta": Decimal("48777"), "subprod": False},
            {"sku": "120635", "nombre_planilla": "GORDURA DE VACA ENTRADA", "peso": Decimal("25.16"), "rend_pct": Decimal("8.47"), "precio_venta": Decimal("9777"), "subprod": True},
            {"sku": "123542", "nombre_planilla": "GORDURA DE VACA SALIDA", "peso": Decimal("0.00"), "rend_pct": Decimal("0.00"), "precio_venta": Decimal("9777"), "subprod": True},
            {"sku": "122050", "nombre_planilla": "HUESO DE VACA ENTRADA", "peso": Decimal("12.48"), "rend_pct": Decimal("4.20"), "precio_venta": Decimal("1777"), "subprod": True},
            {"sku": "123518", "nombre_planilla": "HUESO DE VACA SALIDA", "peso": Decimal("0.00"), "rend_pct": Decimal("0.00"), "precio_venta": Decimal("1777"), "subprod": True},
            {"sku": "123520", "nombre_planilla": "MERMA VACA", "peso": Decimal("10.56"), "rend_pct": Decimal("3.55"), "precio_venta": Decimal("1"), "subprod": True},
        ]
    },
    {
        "nombre": "Costilla con Vacío",
        "especie": "Bovino",
        "peso_promedio_kg": Decimal("400.00"),
        "descripcion": "Despiece estándar de planchas de Costilla con Vacío (10 planchas)",
        "cuts": [
            {"sku": "120093", "nombre_planilla": "COSTILLA/MATAMBRE", "peso": Decimal("295.93"), "rend_pct": Decimal("73.98"), "precio_venta": Decimal("33777"), "subprod": False},
            {"sku": "120108", "nombre_planilla": "VACIO", "peso": Decimal("64.81"), "rend_pct": Decimal("16.20"), "precio_venta": Decimal("44777"), "subprod": False},
            {"sku": "120635", "nombre_planilla": "GORDURA DE VACA ENTRADA", "peso": Decimal("31.30"), "rend_pct": Decimal("7.82"), "precio_venta": Decimal("1"), "subprod": True},
            {"sku": "123520", "nombre_planilla": "MERMA VACA", "peso": Decimal("7.96"), "rend_pct": Decimal("1.99"), "precio_venta": Decimal("1"), "subprod": True},
        ]
    },
    {
        "nombre": "Cerdo Entero s/ Cabeza (BR)",
        "especie": "Porcino",
        "peso_promedio_kg": Decimal("81.10"),
        "descripcion": "Despiece de cerdo entero importado sin cabeza según rendimiento Extra",
        "cuts": [
            {"sku": "120119", "nombre_planilla": "CERDO PERNIL", "peso": Decimal("22.02"), "rend_pct": Decimal("27.15"), "precio_venta": Decimal("27977"), "subprod": False},
            {"sku": "120122", "nombre_planilla": "CERDO PALETA", "peso": Decimal("20.94"), "rend_pct": Decimal("25.82"), "precio_venta": Decimal("26977"), "subprod": False},
            {"sku": "120125", "nombre_planilla": "CERDO COSTILLA", "peso": Decimal("16.70"), "rend_pct": Decimal("20.59"), "precio_venta": Decimal("27977"), "subprod": False},
            {"sku": "120126", "nombre_planilla": "CERDO BISTECA", "peso": Decimal("11.47"), "rend_pct": Decimal("14.14"), "precio_venta": Decimal("25977"), "subprod": False},
            {"sku": "123684", "nombre_planilla": "CERDO LOMITO / FILE MIGNON", "peso": Decimal("1.25"), "rend_pct": Decimal("1.54"), "precio_venta": Decimal("35977"), "subprod": False},
            {"sku": "123685", "nombre_planilla": "CERDO PUCHERO", "peso": Decimal("5.32"), "rend_pct": Decimal("6.56"), "precio_venta": Decimal("13977"), "subprod": False},
            {"sku": "123686", "nombre_planilla": "CERDO MERMA", "peso": Decimal("3.41"), "rend_pct": Decimal("4.20"), "precio_venta": Decimal("1"), "subprod": True},
        ]
    }
]

async def find_product(conn, sku, nombre_fallback):
    row = await conn.fetchrow(
        "SELECT id, nombre, sku, codigo_barra, plu_balanza, precio_venta FROM products WHERE company_id = $1 AND sku = $2 LIMIT 1;",
        COMPANY_ID, sku
    )
    if row:
        return row
    row = await conn.fetchrow(
        "SELECT id, nombre, sku, codigo_barra, plu_balanza, precio_venta FROM products WHERE company_id = $1 AND nombre ILIKE $2 LIMIT 1;",
        COMPANY_ID, f"%{nombre_fallback}%"
    )
    return row

async def main():
    conn = await asyncpg.connect(DB_URL)
    print(f"Connected to DB. Seeding butchery templates for company {COMPANY_ID}...")

    for tmpl_data in TEMPLATES:
        nombre = tmpl_data["nombre"]
        especie = tmpl_data["especie"]
        peso_base = tmpl_data["peso_promedio_kg"]
        desc = tmpl_data["descripcion"]

        existing = await conn.fetchrow(
            "SELECT id FROM supermer_butchery_templates WHERE company_id = $1 AND nombre = $2;",
            COMPANY_ID, nombre
        )
        if existing:
            tmpl_id = existing["id"]
            await conn.execute(
                """UPDATE supermer_butchery_templates 
                   SET especie = $1, peso_promedio_kg = $2, descripcion = $3, activa = true, updated_at = now() 
                   WHERE id = $4;""",
                especie, peso_base, desc, tmpl_id
            )
            print(f"🔄 Updated template: {nombre} (id: {tmpl_id})")
        else:
            row = await conn.fetchrow(
                """INSERT INTO supermer_butchery_templates (company_id, nombre, especie, peso_promedio_kg, descripcion, activa) 
                   VALUES ($1, $2, $3, $4, $5, true) RETURNING id;""",
                COMPANY_ID, nombre, especie, peso_base, desc
            )
            tmpl_id = row["id"]
            print(f"✨ Created template: {nombre} (id: {tmpl_id})")

        # Delete old cuts
        await conn.execute("DELETE FROM supermer_butchery_template_cuts WHERE template_id = $1;", tmpl_id)

        # Insert cuts
        cuts_inserted = 0
        total_rend = Decimal("0")
        for idx, cut in enumerate(tmpl_data["cuts"], start=1):
            prod = await find_product(conn, cut["sku"], cut["nombre_planilla"])
            if not prod:
                print(f"⚠️ Warning: Product with SKU {cut['sku']} ({cut['nombre_planilla']}) not found!")
                continue

            rend_pct = cut["rend_pct"]
            total_rend += rend_pct
            await conn.execute(
                """INSERT INTO supermer_butchery_template_cuts 
                   (template_id, producto_id, rendimiento_porcentual, precio_ponderado, orden, es_subproducto) 
                   VALUES ($1, $2, $3, $4, $5, $6);""",
                tmpl_id,
                prod["id"],
                rend_pct,
                Decimal("50.00"),
                idx,
                cut["subprod"]
            )
            cuts_inserted += 1

        print(f"   -> Inserted {cuts_inserted} cuts (Total rend: {total_rend}%) for '{nombre}'")

    await conn.close()
    print("✅ All butchery templates seeded successfully!")

if __name__ == "__main__":
    asyncio.run(main())
