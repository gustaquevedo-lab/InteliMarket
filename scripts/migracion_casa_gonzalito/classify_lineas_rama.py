"""Clasifica cada product_line en 'paresa' | 'mix' | 'ambas' segun quien la
vende de verdad, mirando el historial real de ventas (ultimos 180 dias) por
la rama del vendedor (sales_reps.rama). >70% de concentracion en una rama =
esa rama; si no, 'ambas'. Lineas sin ventas recientes quedan NULL (visibles
para todos, no se ocultan productos por falta de dato).

Reejecutable: refleja el historial mas reciente cada vez que corre, no es
una clasificacion fija de una sola vez.
"""
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from sqlalchemy import text
from api.src.db import async_session_factory

COMPANY_ID = "00000000-0000-0000-0000-000000000010"


async def main():
    async with async_session_factory() as db:
        result = await db.execute(
            text("""
                WITH ventas_por_rama AS (
                    SELECT
                        pl.id AS linea_id,
                        pl.nombre,
                        sr.rama,
                        COUNT(*) AS ventas
                    FROM sale_items si
                    JOIN sales s ON s.id = si.sale_id
                    JOIN sales_reps sr ON sr.funcionario_codigo = s.vendedor_codigo AND sr.company_id = s.company_id
                    JOIN products p ON p.id = si.product_id
                    JOIN product_lines pl ON pl.id = p.linea_id
                    WHERE s.company_id = :company_id
                      AND s.fecha > now() - interval '180 days'
                      AND sr.rama IS NOT NULL
                    GROUP BY pl.id, pl.nombre, sr.rama
                )
                SELECT
                    linea_id, nombre,
                    COALESCE(SUM(ventas) FILTER (WHERE rama = 'paresa'), 0) AS paresa_ventas,
                    COALESCE(SUM(ventas) FILTER (WHERE rama = 'mix'), 0) AS mix_ventas
                FROM ventas_por_rama
                GROUP BY linea_id, nombre
            """),
            {"company_id": COMPANY_ID},
        )
        rows = result.fetchall()

        paresa_count = mix_count = ambas_count = 0
        for row in rows:
            total = row.paresa_ventas + row.mix_ventas
            if total == 0:
                continue
            pct_paresa = row.paresa_ventas / total
            if pct_paresa >= 0.70:
                rama = "paresa"
                paresa_count += 1
            elif pct_paresa <= 0.30:
                rama = "mix"
                mix_count += 1
            else:
                rama = "ambas"
                ambas_count += 1

            await db.execute(
                text("UPDATE product_lines SET rama = :rama WHERE id = :id"),
                {"rama": rama, "id": row.linea_id},
            )

        await db.commit()
        print(f"Clasificadas: {paresa_count} paresa, {mix_count} mix, {ambas_count} ambas "
              f"(de {len(rows)} lineas con ventas en los ultimos 180 dias)")


if __name__ == "__main__":
    asyncio.run(main())
