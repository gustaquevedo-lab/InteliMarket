#!/usr/bin/env python3
"""
Sincronizador de Fotos de Productos — Conector Ñemuha (Concepto Comercial) -> InteliMarket
Lee la tabla `est_produto_foto` de MySQL `comercial_extra_py` (6.954 productos con 7.181 fotos registradas).
Vincula las fotos del directorio `C:\\ConceptoSistemas\\Fotos` con PostgreSQL `products` y `sm_ecommerce_products`.
"""

import os
import sys
import shutil
import asyncio
from pathlib import Path
import pymysql
from sqlalchemy import text
from src.db import async_session_factory
from src.config import settings

MYSQL_HOST = os.getenv("NEMUHA_MYSQL_HOST", "100.76.95.42")
MYSQL_PORT = int(os.getenv("NEMUHA_MYSQL_PORT", "3306"))
MYSQL_USER = os.getenv("NEMUHA_MYSQL_USER", "intelimarket_ro")
MYSQL_PASS = os.getenv("NEMUHA_MYSQL_PASSWORD", "Luzma7834")
MYSQL_DB = os.getenv("NEMUHA_MYSQL_DATABASE", "comercial_extra_py")

UPLOADS_DIR = Path("/home/intellihouse/intelimarket/api/uploads/products")
STATIC_UPLOADS_URL = "/uploads/products"

async def sync_photos_from_nemuha(photos_source_dir: str):
    source_path = Path(photos_source_dir)
    if not source_path.exists():
        print(f"❌ La carpeta de fotos {photos_source_dir} no existe.")
        return

    UPLOADS_DIR.mkdir(parents=True, exist_ok=True)

    print("🔌 Conectando a Ñemuha MySQL (Concepto Comercial)...")
    conn = pymysql.connect(
        host=MYSQL_HOST,
        port=MYSQL_PORT,
        user=MYSQL_USER,
        password=MYSQL_PASS,
        database=MYSQL_DB,
        charset="utf8mb4"
    )

    with conn.cursor() as cur:
        cur.execute("""
            SELECT f.ID_PRODUTO, p.DS_PRODUTO, f.URL, f.NR_ORDEN 
            FROM est_produto_foto f
            JOIN est_produto p ON p.ID_PRODUTO = f.ID_PRODUTO
            ORDER BY f.ID_PRODUTO, COALESCE(f.NR_ORDEN, 1)
        """)
        nemuha_photos = cur.fetchall()

    print(f"📸 Total registros de fotos en Ñemuha: {len(nemuha_photos)}")

    matched = 0
    copied = 0
    missing_files = 0

    async with async_session_factory() as db:
        # Load products from PostgreSQL keyed by SKU (ID_PRODUTO in legacy)
        rows = (await db.execute(text("SELECT id, sku, codigo_barra, nombre FROM products"))).mappings().all()
        products_by_sku = {r["sku"].strip(): r for r in rows if r["sku"]}

        for row in nemuha_photos:
            id_produto = str(row[0]).strip()
            ds_produto = row[1]
            file_name = row[2].strip()

            target_prod = products_by_sku.get(id_produto)
            if not target_prod:
                continue

            matched += 1
            src_file = source_path / file_name
            if src_file.exists():
                dest_file = UPLOADS_DIR / file_name
                shutil.copy2(src_file, dest_file)
                copied += 1

                public_url = f"{STATIC_UPLOADS_URL}/{file_name}"

                # Update PostgreSQL products & ecommerce
                await db.execute(text("""
                    UPDATE products 
                    SET imagen_url = :url, updated_at = NOW()
                    WHERE id = :pid
                """), {"url": public_url, "pid": target_prod["id"]})

                await db.execute(text("""
                    UPDATE sm_ecommerce_products
                    SET images = jsonb_build_array(:url), updated_at = NOW()
                    WHERE product_id = :pid
                """), {"url": public_url, "pid": target_prod["id"]})
            else:
                missing_files += 1

        await db.commit()

    print("\n" + "=" * 60)
    print(f"🎉 Sincronización de Fotos Ñemuha Completada:")
    print(f"   - Productos Ñemuha emparejados con PostgreSQL: {matched}")
    print(f"   - Archivos físicos de imagen copiados y publicados: {copied}")
    print(f"   - Archivos registrados en DB pero no encontrados en carpeta: {missing_files}")
    print("=" * 60)

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Uso: python sync_nemuha_photos.py <ruta_a_carpeta_Fotos_de_ConceptoSistemas>")
        sys.exit(1)
    asyncio.run(sync_photos_from_nemuha(sys.argv[1]))
