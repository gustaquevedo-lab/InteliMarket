#!/usr/bin/env python3
"""
Importador Automático Masivo de Fotos desde la API de Ñemuha / ConceptoComercial
Extrae todas las fotos reales en Base64 desde el backend Tomcat (puerto 8090)
y las publica directamente en PostgreSQL (`products` y `sm_ecommerce_products`).
"""

import os
import sys
import json
import base64
import asyncio
import requests
from pathlib import Path
from sqlalchemy import text
from api.src.db import async_session_factory

TOMCAT_API_URL = "http://100.76.95.42:8090/ConceptoComercialJ/produtoWS/findProdutosFotosVendaByConditionPaginate"
UPLOADS_DIR = Path("/home/intellihouse/intelimarket/api/uploads/products")
STATIC_UPLOADS_URL = "/uploads/products"

async def import_all_photos():
    UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
    print("🚀 Iniciando importación directa de fotos desde el backend de Ñemuha (Tomcat 8090)...")

    # 1. Fetch first page to get total pages
    page_size = 100
    try:
        r = requests.get(TOMCAT_API_URL, params={"condition": "7840009011507", "pageNumber": 1, "pageSize": page_size}, timeout=30)
        data = json.loads(r.content.decode("utf-8", errors="ignore"))
        total_items = data.get("object", {}).get("total", 0)
        total_pages = data.get("object", {}).get("pages", 0)
        print(f"📦 Total productos en catálogo Ñemuha: {total_items} (en {total_pages} páginas de {page_size})")
    except Exception as e:
        print(f"❌ Error conectando a la API de Tomcat: {e}")
        return

    total_extracted = 0
    total_db_updated = 0

    async with async_session_factory() as db:
        # Load products from PostgreSQL keyed by SKU (ID_PRODUTO in legacy)
        rows = (await db.execute(text("SELECT id, sku, codigo_barra, nombre FROM products"))).mappings().all()
        products_by_sku = {r["sku"].strip(): r for r in rows if r["sku"]}

        for page in range(1, total_pages + 1):
            try:
                resp = requests.get(TOMCAT_API_URL, params={"condition": "7840009011507", "pageNumber": page, "pageSize": page_size}, timeout=30)
                page_data = json.loads(resp.content.decode("utf-8", errors="ignore"))
                items = page_data.get("object", {}).get("list", [])
            except Exception as pe:
                print(f"⚠️ Error en página {page}: {pe}")
                continue

            for it in items:
                b64 = it.get("base64")
                if not b64:
                    continue

                pid = str(it.get("id")).strip()
                desc = it.get("descricao", "").strip()

                try:
                    img_bytes = base64.b64decode(b64)
                    filename = f"{pid}.jpg"
                    file_path = UPLOADS_DIR / filename
                    with open(file_path, "wb") as f:
                        f.write(img_bytes)
                    total_extracted += 1

                    public_url = f"{STATIC_UPLOADS_URL}/{filename}"

                    target_prod = products_by_sku.get(pid)
                    if target_prod:
                        await db.execute(text("""
                            UPDATE products 
                            SET imagen_url = :url, updated_at = NOW()
                            WHERE id = :id
                        """), {"url": public_url, "id": target_prod["id"]})

                        await db.execute(text("""
                            UPDATE sm_ecommerce_products
                            SET images = jsonb_build_array(:url), updated_at = NOW()
                            WHERE product_id = :id
                        """), {"url": public_url, "id": target_prod["id"]})

                        total_db_updated += 1
                except Exception as ex:
                    pass

            await db.commit()
            if page % 10 == 0 or page == total_pages:
                print(f"  ⚡ Progreso: Página {page}/{total_pages} | Fotos extraídas: {total_extracted} | Actualizadas en BD: {total_db_updated}")

    print("\n" + "=" * 60)
    print("🎉 IMPORTACIÓN MASIVA FINALIZADA CON ÉXITO:")
    print(f"   - Total fotos extraídas y guardadas en disco: {total_extracted}")
    print(f"   - Total productos vinculados en PostgreSQL y E-Commerce: {total_db_updated}")
    print("=" * 60)

if __name__ == "__main__":
    asyncio.run(import_all_photos())
