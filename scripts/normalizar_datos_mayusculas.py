#!/usr/bin/env python3
"""
Normalización Canónica de Datos a MAYÚSCULAS en Base de Datos
Actualiza de forma segura e idempotente las columnas de texto de tablas de negocio.
Excluye: passwords, hashes, tokens, emails, URLs, enums y campos de integración.
"""

import asyncio
import sys
import argparse
from sqlalchemy import text
from api.src.db import async_session_factory

# Mapeo explícito de tablas y columnas de negocio
COLUMNS_TO_NORMALIZE: list[tuple[str, str]] = [
    # Catálogo de Productos
    ("products", "nombre"),
    ("products", "descripcion"),
    ("products", "unidad_medida"),
    ("product_categories", "nombre"),
    ("product_categories", "descripcion"),
    ("product_brands", "nombre"),

    # Clientes
    ("customers", "razon_social"),
    ("customers", "nombre_fantasia"),
    ("customers", "direccion"),
    ("customers", "contacto"),
    ("customers", "ciudad"),
    ("customers", "departamento"),

    # Proveedores
    ("suppliers", "razon_social"),
    ("suppliers", "nombre_fantasia"),
    ("suppliers", "contacto"),
    ("suppliers", "direccion"),
    ("suppliers", "ciudad"),
    ("suppliers", "rubro"),
    ("suppliers", "contacto_nombre"),
    ("suppliers", "titular_cuenta_bancaria"),
    ("suppliers", "banco"),
    ("suppliers", "notas"),

    # Compras y Recepciones
    ("purchase_orders", "observaciones"),
    ("purchase_orders", "rechazado_motivo"),
    ("purchase_orders", "created_by_name"),
    ("purchase_order_items", "descripcion"),
    ("purchase_receipt_items", "motivo_rechazo"),
    ("purchase_receipt_items", "autorizacion_motivo"),

    # Gastos y Egresos
    ("expenses", "descripcion"),
    ("expenses", "proveedor"),
    ("expenses", "notas"),
    ("expenses", "employee_nombre"),

    # Sucursales, Cuentas y Fondos
    ("branches", "nombre"),
    ("branches", "direccion"),
    ("branches", "ciudad"),
    ("branches", "departamento"),
    ("petty_cash_funds", "nombre"),
    ("bank_accounts", "banco"),
    ("bank_accounts", "titular"),
    ("bank_accounts", "alias"),

    # Usuarios (Solo nombre del funcionario, jamás email ni passwords/hashes)
    ("users", "nombre"),
]


async def run_normalization(dry_run: bool = False):
    print(f"=== NORMALIZACIÓN CANÓNICA A MAYÚSCULAS ({'DRY RUN' if dry_run else 'EJECUCIÓN REAL'}) ===")
    total_updated = 0
    results: list[dict] = []

    async with async_session_factory() as session:
        for table, col in COLUMNS_TO_NORMALIZE:
            try:
                # Contar filas que necesitan normalización
                count_query = text(f"""
                    SELECT count(*) 
                    FROM {table} 
                    WHERE {col} IS NOT NULL 
                      AND {col} != UPPER({col});
                """)
                res = await session.execute(count_query)
                count = res.scalar() or 0

                if count > 0 and not dry_run:
                    update_query = text(f"""
                        UPDATE {table} 
                        SET {col} = UPPER({col}) 
                        WHERE {col} IS NOT NULL 
                          AND {col} != UPPER({col});
                    """)
                    await session.execute(update_query)

                results.append({
                    "table": table,
                    "column": col,
                    "count": count
                })
                total_updated += count

            except Exception as e:
                print(f"⚠️ Error al procesar {table}.{col}: {e}", file=sys.stderr)

        if not dry_run:
            await session.commit()
            print("✓ Transacción confirmada en base de datos.")
        else:
            await session.rollback()
            print("ℹ Dry-run finalizado sin mutar datos.")

    # Imprimir reporte
    print("\n" + "=" * 60)
    print(f"{'TABLA':<25} {'COLUMNA':<20} {'FILAS MODIFICADAS':>12}")
    print("-" * 60)
    for r in results:
        if r["count"] > 0 or dry_run:
            print(f"{r['table']:<25} {r['column']:<20} {r['count']:>12}")
    print("-" * 60)
    print(f"{'TOTAL GENERAL':<46} {total_updated:>12}")
    print("=" * 60 + "\n")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Normalizar textos de negocio a MAYÚSCULAS en PostgreSQL.")
    parser.add_argument("--dry-run", action="store_true", help="Simular sin aplicar cambios en la base de datos.")
    args = parser.parse_args()

    asyncio.run(run_normalization(dry_run=args.dry_run))
