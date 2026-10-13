#!/usr/bin/env python3
"""
Script de Backfill y Saneamiento Contable Idempotente:
Reclasificación Estructural de Egresos de Septiembre 2026
para Extra Supermercado Mayorista (Grupo Santa Teresa E.A.S., RUC 80150377-9).

Objetivo:
- Segregar Materia Prima de Panadería (Harinas, Levaduras) a CMV_MATERIA_PRIMA.
- Reclasificar Póliza Río Seguros a GASTO_DIFERIDO_CUOTAS (1 de 10).
- Reclasificar Sueldos e IPS devengados en Agosto a PASIVO_PERIODO_ANTERIOR (2026-08).
- Reclasificar Anticipos al Personal a ANTICIPO_PERSONAL.
- Reclasificar Pago de Mercaderías a CMV_REVENTA.
- Mantener OPEX_GASTO_OPERATIVO limpio y puro.
"""
import asyncio
import os
import sys
from decimal import Decimal
from sqlalchemy import text
from api.src.db import async_session_factory

COMPANY_ID = "00000000-0000-0000-0000-000000000010"


async def run_backfill(dry_run: bool = False):
    print("=" * 70)
    print("BACKFILL CONTABLE ESTRUCTURAL - EGRESOS SEPTIEMBRE 2026")
    print(f"Company ID: {COMPANY_ID}")
    print(f"Modo: {'DRY RUN (Simulación)' if dry_run else 'APLICACIÓN REAL EN BASE DE DATOS'}")
    print("=" * 70)

    async with async_session_factory() as session:
        # Obtener todos los gastos de septiembre 2026
        q = await session.execute(
            text("""
                SELECT id, fecha_gasto, numero_factura, proveedor, ruc, descripcion,
                       monto, es_pago_proveedor, es_anticipo_sueldo, employee_nombre,
                       naturaleza_economica, production_area, periodo_devengado,
                       cuota_actual, total_cuotas
                FROM expenses
                WHERE company_id = :company_id
                  AND fecha_gasto >= '2026-09-01'
                  AND fecha_gasto <= '2026-09-30 23:59:59'
                ORDER BY fecha_gasto ASC
            """),
            {"company_id": COMPANY_ID}
        )
        expenses = q.mappings().fetchall()
        print(f"\nTotal comprobantes encontrados en Septiembre 2026: {len(expenses)}\n")

        stats = {
            "CMV_MATERIA_PRIMA": {"count": 0, "total": Decimal("0")},
            "GASTO_DIFERIDO_CUOTAS": {"count": 0, "total": Decimal("0")},
            "PASIVO_PERIODO_ANTERIOR": {"count": 0, "total": Decimal("0")},
            "ANTICIPO_PERSONAL": {"count": 0, "total": Decimal("0")},
            "CMV_REVENTA": {"count": 0, "total": Decimal("0")},
            "OPEX_GASTO_OPERATIVO": {"count": 0, "total": Decimal("0")},
        }

        updates = []

        for e in expenses:
            desc = (e["descripcion"] or "").upper()
            prov = (e["proveedor"] or "").upper()
            monto = Decimal(str(e["monto"] or 0))

            nueva_nat = "OPEX_GASTO_OPERATIVO"
            prod_area = None
            periodo_dev = None
            cuota_act = None
            total_cuot = None

            # 1. Detección de Materia Prima Panadería
            if (
                "HARINA" in desc or "LEVADURA" in desc or "MOLINO" in prov or
                "HILAGRO" in prov or "CAACUPE" in prov or "MATERIA PRIMA" in desc
            ):
                nueva_nat = "CMV_MATERIA_PRIMA"
                prod_area = "panaderia"

            # 2. Detección de Seguros en Cuotas
            elif "RIO DE LA PLATA" in prov or "RIO SEGUROS" in prov or "POLIZA" in desc:
                nueva_nat = "GASTO_DIFERIDO_CUOTAS"
                cuota_act = 1
                total_cuot = 10

            # 3. Detección de Pasivos Devengados en Agosto
            elif (
                "AGOSTO" in desc and ("SUELDO" in desc or "SALARIO" in desc or "IPS" in desc or "DEVENGADO" in desc)
            ):
                nueva_nat = "PASIVO_PERIODO_ANTERIOR"
                periodo_dev = "2026-08"

            # 4. Detección de Anticipos al Personal
            elif e["es_anticipo_sueldo"] or "ANTICIPO" in desc:
                nueva_nat = "ANTICIPO_PERSONAL"

            # 5. Detección de Compras de Mercaderías Reventa
            elif e["es_pago_proveedor"] or "MERCADERIA" in desc:
                nueva_nat = "CMV_REVENTA"

            # 6. Resto: OPEX Gasto Operativo
            else:
                nueva_nat = "OPEX_GASTO_OPERATIVO"

            stats[nueva_nat]["count"] += 1
            stats[nueva_nat]["total"] += monto

            updates.append({
                "id": e["id"],
                "naturaleza_economica": nueva_nat,
                "production_area": prod_area,
                "periodo_devengado": periodo_dev,
                "cuota_actual": cuota_act,
                "total_cuotas": total_cuot,
            })

        print("DISTRIBUCIÓN RESULTANTE:")
        for nat, data in stats.items():
            print(f"  • {nat:<25}: {data['count']:>3} comprobantes | ₲ {data['total']:>15,}")

        if not dry_run:
            print("\nAplicando actualizaciones en base de datos...")
            for u in updates:
                await session.execute(
                    text("""
                        UPDATE expenses
                        SET naturaleza_economica = :naturaleza_economica,
                            production_area = :production_area,
                            periodo_devengado = :periodo_devengado,
                            cuota_actual = :cuota_actual,
                            total_cuotas = :total_cuotas
                        WHERE id = :id
                    """),
                    u
                )
            await session.commit()
            print("✓ ¡Actualización completada y confirmada exitosamente!")
        else:
            print("\nModo Dry Run: No se aplicaron cambios permanentes.")


if __name__ == "__main__":
    is_dry = "--dry-run" in sys.argv
    asyncio.run(run_backfill(dry_run=is_dry))
