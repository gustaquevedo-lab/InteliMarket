#!/usr/bin/env python3
"""
Script de Importación Masiva de Fotos de Productos — InteliMarket
Vincula fotos de productos desde un directorio o archivo ZIP con la base de datos PostgreSQL.
Empareja por:
  1. Código de Barras (EAN-13 / EAN-8) -> ej: 7840009011507.jpg
  2. SKU / Código Interno Legacy      -> ej: SKU_5818.jpg o 5818.jpg
"""

import os
import sys
import shutil
import zipfile
import asyncio
from pathlib import Path
from sqlalchemy import text
from src.db import async_session_factory

UPLOADS_DIR = Path("/home/intellihouse/intelimarket/api/uploads/products")
STATIC_UPLOADS_URL = "/uploads/products"

async def import_photos_from_directory(source_dir: str):
    source_path = Path(source_dir)
    if not source_path.exists():
        print(f"❌ El directorio de origen {source_dir} no existe.")
        return

    UPLOADS_DIR.mkdir(parents=True, exist_ok=True)

    # If it's a zip file, extract to temp folder first
    if source_path.is_file() and source_path.suffix.lower() == ".zip":
        temp_dir = Path("/tmp/extracted_photos")
        temp_dir.mkdir(parents=True, exist_ok=True)
        print(f"📦 Descomprimiendo archivo ZIP: {source_path}...")
        with zipfile.ZipFile(source_path, 'r') as zip_ref:
            zip_ref.extractall(temp_dir)
        source_path = temp_dir

    # Find all image files
    image_extensions = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
    image_files = [f for f in source_path.glob("**/*") if f.suffix.lower() in image_extensions]
    
    print(f"🖼️ Se encontraron {len(image_files)} imágenes para procesar.")

    matched_count = 0
    not_found_count = 0

    async with async_session_factory() as db:
        # Load all products map (EAN -> ID, SKU -> ID)
        rows = (await db.execute(text("SELECT id, sku, codigo_barra, nombre FROM products"))).mappings().all()
        ean_map = {r["codigo_barra"].strip(): r for r in rows if r["codigo_barra"]}
        sku_map = {r["sku"].strip(): r for r in rows if r["sku"]}

        for img in image_files:
            stem = img.stem.strip() # Filename without extension (e.g. 7840009011507 or SKU_5818)
            cleaned_sku = stem.replace("SKU_", "").replace("sku_", "").strip()

            target_product = None
            if stem in ean_map:
                target_product = ean_map[stem]
            elif cleaned_sku in sku_map:
                target_product = sku_map[cleaned_sku]
            elif stem in sku_map:
                target_product = sku_map[stem]

            if target_product:
                # Copy to uploads dir
                ext = img.suffix.lower()
                dest_filename = f"{target_product['id']}{ext}"
                dest_path = UPLOADS_DIR / dest_filename
                shutil.copy2(img, dest_path)

                public_url = f"{STATIC_UPLOADS_URL}/{dest_filename}"

                # Update products table
                await db.execute(text("""
                    UPDATE products 
                    SET imagen_url = :url, updated_at = NOW()
                    WHERE id = :pid
                """), {"url": public_url, "pid": target_product["id"]})

                # Update sm_ecommerce_products if exists
                await db.execute(text("""
                    UPDATE sm_ecommerce_products
                    SET images = jsonb_build_array(:url), updated_at = NOW()
                    WHERE product_id = :pid
                """), {"url": public_url, "pid": target_product["id"]})

                matched_count += 1
                if matched_count % 100 == 0:
                    print(f"  ✅ {matched_count} fotos vinculadas...")
            else:
                not_found_count += 1

        await db.commit()

    print("\n" + "=" * 60)
    print(f"🎉 Importación Finalizada:")
    print(f"   - Fotos Vinculadas Exitosamente: {matched_count}")
    print(f"   - Archivos sin coincidencia en catálogo: {not_found_count}")
    print("=" * 60)

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Uso: python import_product_photos.py <directorio_de_fotos_o_archivo.zip>")
        sys.exit(1)
    asyncio.run(import_photos_from_directory(sys.argv[1]))
