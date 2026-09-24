#!/usr/bin/env python3
"""Backfill de products.precio_venta desde Ñemuha (VL_PRECO_VENDA_VAREJO).

Causa raiz: _resolve_producto() en api/src/nemuha_connector/service.py nunca
selecciono ni escribio precio_venta al crear un producto -- todo producto
descubierto por primera vez via una venta/compra (en vez de por el import
inicial de catalogo) quedo con precio_venta=0 para siempre. Ya se corrigio
esa funcion para productos nuevos; este script backfillea los que ya
quedaron en 0 (1295 en sandbox, 1319 en public al momento de escribir esto,
verificado 2026-08-25).

Uso:
    .venv/bin/python3 scripts/backfill_precio_venta.py --schema sandbox
    .venv/bin/python3 scripts/backfill_precio_venta.py --schema public
"""
import argparse
import asyncio
import os

import asyncpg
import pymysql

NEMUHA_HOST = os.environ.get("NEMUHA_MYSQL_HOST", "100.76.95.42")
NEMUHA_PORT = int(os.environ.get("NEMUHA_MYSQL_PORT", "3306"))
NEMUHA_USER = os.environ.get("NEMUHA_MYSQL_USER", "intelimarket_ro")
NEMUHA_PASSWORD = os.environ.get("NEMUHA_MYSQL_PASSWORD", "")
NEMUHA_DATABASE = os.environ.get("NEMUHA_MYSQL_DATABASE", "comercial_extra_py")

PG_DSN = "postgresql://intelimarket:password@localhost:5432/intelimarket"


def fetch_precios_nemuha(ids_produto: list[int]) -> dict[int, float]:
    """Trae VL_PRECO_VENDA_VAREJO para un lote de ID_PRODUTO. Sync (pymysql),
    se corre en un thread aparte para no bloquear el loop async."""
    if not ids_produto:
        return {}
    conn = pymysql.connect(
        host=NEMUHA_HOST, port=NEMUHA_PORT, user=NEMUHA_USER,
        password=NEMUHA_PASSWORD, database=NEMUHA_DATABASE,
    )
    try:
        placeholders = ",".join(["%s"] * len(ids_produto))
        with conn.cursor() as cur:
            cur.execute(
                f"SELECT ID_PRODUTO, VL_PRECO_VENDA_VAREJO FROM est_produto "
                f"WHERE ID_PRODUTO IN ({placeholders})",
                ids_produto,
            )
            return {int(row[0]): float(row[1] or 0) for row in cur.fetchall()}
    finally:
        conn.close()


async def backfill(schema: str, batch_size: int = 500) -> None:
    conn = await asyncpg.connect(PG_DSN)
    try:
        rows = await conn.fetch(
            f"SELECT id, sku FROM {schema}.products WHERE activo = true AND precio_venta = 0"
        )
        print(f"[{schema}] {len(rows)} productos activos con precio_venta = 0")

        actualizados = 0
        siguen_en_cero_en_nemuha = 0
        no_encontrados = 0

        for i in range(0, len(rows), batch_size):
            batch = rows[i:i + batch_size]
            sku_to_id = {}
            ids_produto = []
            for r in batch:
                try:
                    id_produto = int(r["sku"])
                except (TypeError, ValueError):
                    continue
                ids_produto.append(id_produto)
                sku_to_id[id_produto] = r["id"]

            precios = await asyncio.to_thread(fetch_precios_nemuha, ids_produto)

            for id_produto, product_id in sku_to_id.items():
                precio = precios.get(id_produto)
                if precio is None:
                    no_encontrados += 1
                    continue
                if precio <= 0:
                    siguen_en_cero_en_nemuha += 1
                    continue
                await conn.execute(
                    f"UPDATE {schema}.products SET precio_venta = $1, updated_at = now() WHERE id = $2",
                    precio, product_id,
                )
                actualizados += 1

            print(f"[{schema}] lote {i // batch_size + 1}: {actualizados} actualizados hasta ahora...")

        print(f"\n[{schema}] RESULTADO FINAL")
        print(f"  Actualizados con precio real de Ñemuha: {actualizados}")
        print(f"  Siguen en 0 (Ñemuha tambien tiene 0 -- dato legacy real, no bug):  {siguen_en_cero_en_nemuha}")
        print(f"  No encontrados en Ñemuha (sku no es un ID_PRODUTO valido):        {no_encontrados}")
    finally:
        await conn.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--schema", required=True, choices=["sandbox", "public"])
    args = parser.parse_args()
    asyncio.run(backfill(args.schema))
