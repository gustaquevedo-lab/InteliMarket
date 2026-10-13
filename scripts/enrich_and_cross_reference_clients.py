"""
Pipeline Integral de Enriquecimiento, Cruce y Resolución de Clientes:
1. Padrón Nacional TSJE (Intelecciones: 5.056.228 ciudadanos) -> Nombres y apellidos oficiales por C.I.
2. Base de Clientes Intelimarket (4.628 customers) -> RUC, Razon Social, Teléfonos y Direcciones.
3. Base de Contactos Supabase / IntelliZapp (4.846 contacts) -> Teléfonos y perfiles de WhatsApp.
4. Base de Ventas y Compras Intelimarket (130.202 sales + sale_items) -> Vínculo de tickets, montos y productos comprados.
5. Recalculo de Métricas RFM (VIP, Frecuente, Habitual, Ocasional).
"""

import sys
import os
import time
import json
import sqlite3
import logging
import asyncio
import urllib.request
from uuid import UUID
from datetime import datetime
from sqlalchemy import text
from api.src.db import engine

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger("enrichment.pipeline")

PADRON_DB_PATH = "/home/intellihouse/intelimarket/padron.db"
COMPANY_ID = "00000000-0000-0000-0000-000000000010"
SUPABASE_URL = "https://sbbgvvymlbgthsgtiote.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNiYmd2dnltbGJndGhzZ3Rpb3RlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDAxODYzMywiZXhwIjoyMDk1NTk0NjMzfQ.N0rd3N8rUeIMLGcdwrWhZQFkX5ODcXu7dB7nni3Wgfw"

def fetch_supabase_contacts():
    logger.info("📱 Descargando contactos de Supabase / IntelliZapp...")
    contacts = []
    page_size = 1000
    for offset in range(0, 6000, page_size):
        req = urllib.request.Request(
            f"{SUPABASE_URL}/rest/v1/contacts?select=name,phone,metadata",
            headers={
                "apikey": SUPABASE_KEY,
                "Authorization": f"Bearer {SUPABASE_KEY}",
                "Range": f"{offset}-{offset + page_size - 1}"
            }
        )
        try:
            with urllib.request.urlopen(req, timeout=10) as resp:
                batch = json.loads(resp.read().decode("utf-8"))
                if not batch:
                    break
                contacts.extend(batch)
        except Exception as e:
            logger.warning(f"Error al descargar lote de contactos ({offset}): {e}")
            break
    logger.info(f"✅ {len(contacts)} contactos de WhatsApp recuperados de Supabase.")
    return contacts

async def run_pipeline():
    logger.info("🚀 INICIANDO PIPELINE DE ENRIQUECIMIENTO Y CRUCE TOTAL...")
    start_time = time.time()

    # 1. Cargar Padrón Nacional TSJE
    padron_conn = None
    if os.path.exists(PADRON_DB_PATH):
        padron_conn = sqlite3.connect(PADRON_DB_PATH)
        logger.info(f"✅ Padrón Nacional TSJE conectado ({PADRON_DB_PATH}) - 5.056.228 registros.")
    else:
        logger.warning(f"⚠️ No se encontró padron.db en {PADRON_DB_PATH}")

    # 2. Cargar contactos de Supabase
    supabase_contacts = fetch_supabase_contacts()
    phone_map = {}
    for sc in supabase_contacts:
        name = (sc.get("name") or "").strip().upper()
        phone = (sc.get("phone") or "").strip()
        if name and phone and len(phone) >= 8:
            phone_map[name] = phone

    schemas = ["public", "sandbox"]

    async with engine.begin() as conn:
        for schema in schemas:
            logger.info(f"\n==================================================")
            logger.info(f"👉 PROCESANDO ESQUEMA: '{schema}'")
            logger.info(f"==================================================")

            # Paso A: Cruzar cupon_tickets con sales de Intelimarket
            logger.info("🔗 1/6. Vinculando tickets de cupones con ventas reales en sales...")
            update_sales_sql = f"""
                UPDATE {schema}.cupon_tickets ct
                SET 
                    sale_id = s.id,
                    monto_compra = s.total,
                    fecha_compra = s.fecha,
                    sincronizado = true,
                    updated_at = NOW()
                FROM {schema}.sales s
                WHERE ct.company_id = '{COMPANY_ID}'
                  AND (
                      s.numero = ct.nro_ticket 
                      OR s.numero_interno = ct.nro_ticket
                      OR s.numero LIKE '%' || ct.nro_ticket
                      OR s.numero_interno LIKE '%' || ct.nro_ticket
                  )
                  AND (ct.sale_id IS NULL OR ct.monto_compra = 0 OR ct.sincronizado = false);
            """
            res_sales = await conn.execute(text(update_sales_sql))
            logger.info(f"   -> {res_sales.rowcount} tickets vinculados a ventas reales.")

            # Paso B: Cruzar con la tabla customers por C.I. o RUC (sin tocar documento para evitar colisiones)
            logger.info("🏢 2/6. Enriqueciendo nombres y datos con la base de customers (Intelimarket)...")
            cross_customers_sql = f"""
                UPDATE {schema}.cupones_clientes cc
                SET 
                    nombre = CASE 
                        WHEN cc.nombre LIKE 'Cliente %' OR cc.nombre = '' OR cc.nombre LIKE 'IZ%' THEN c.razon_social 
                        ELSE cc.nombre 
                    END,
                    telefono = CASE 
                        WHEN cc.telefono = '' OR cc.telefono IS NULL THEN COALESCE(c.telefono, '') 
                        ELSE cc.telefono 
                    END,
                    direccion = COALESCE(NULLIF(cc.direccion, ''), c.direccion),
                    ciudad = COALESCE(NULLIF(cc.ciudad, ''), c.ciudad, 'Pedro Juan Caballero'),
                    updated_at = NOW()
                FROM {schema}.customers c
                WHERE cc.company_id = '{COMPANY_ID}'
                  AND (
                      c.ci = cc.documento 
                      OR REPLACE(REPLACE(c.ruc, '-', ''), '.', '') = cc.documento
                      OR c.ruc = cc.documento
                  );
            """
            res_cust = await conn.execute(text(cross_customers_sql))
            logger.info(f"   -> {res_cust.rowcount} clientes enriquecidos con datos fiscales de customers.")

            # Paso C: Fallback con Padrón Nacional TSJE (Intelecciones)
            if padron_conn:
                logger.info("🗳️ 3/6. Identificando nombres oficiales en el Padrón Nacional TSJE...")
                res_unnamed = await conn.execute(text(f"""
                    SELECT id, documento, nombre 
                    FROM {schema}.cupones_clientes 
                    WHERE company_id = '{COMPANY_ID}'
                      AND (nombre LIKE 'Cliente %' OR nombre = '' OR nombre LIKE 'IZ%')
                      AND documento ~ '^[0-9]+$';
                """))
                unnamed_clients = res_unnamed.fetchall()
                logger.info(f"   -> Consultando {len(unnamed_clients)} clientes con C.I. numérica en el Padrón...")

                cur = padron_conn.cursor()
                padron_encontrados = 0
                for cid, doc, curr_name in unnamed_clients:
                    cur.execute("SELECT nombre, apellido, depart, distrito FROM electors WHERE ci = ?", (doc,))
                    row = cur.fetchone()
                    if row:
                        nombre_padron = f"{row[0]} {row[1]}".strip()
                        distrito_padron = row[3] if row[3] else "Pedro Juan Caballero"
                        
                        await conn.execute(text(f"""
                            UPDATE {schema}.cupones_clientes
                            SET 
                                nombre = :nombre,
                                ciudad = COALESCE(NULLIF(ciudad, ''), :ciudad),
                                updated_at = NOW()
                            WHERE id = :id;
                        """), {
                            "id": cid,
                            "nombre": nombre_padron,
                            "ciudad": distrito_padron
                        })
                        padron_encontrados += 1

                logger.info(f"   -> {padron_encontrados} nombres y apellidos legales extraídos del Padrón TSJE.")

            # Paso D: Enriquecer teléfonos desde contactos de WhatsApp (Supabase)
            if phone_map:
                logger.info("📞 4/6. Vinculando teléfonos desde contactos de WhatsApp (Supabase)...")
                res_no_phone = await conn.execute(text(f"""
                    SELECT id, nombre 
                    FROM {schema}.cupones_clientes 
                    WHERE company_id = '{COMPANY_ID}'
                      AND (telefono = '' OR telefono IS NULL)
                      AND NOT nombre LIKE 'Cliente %'
                      AND NOT nombre LIKE 'IZ%';
                """))
                no_phone_clients = res_no_phone.fetchall()
                logger.info(f"   -> Evaluando {len(no_phone_clients)} clientes sin teléfono...")
                phones_added = 0
                for cid, cname in no_phone_clients:
                    clean_name = cname.strip().upper()
                    matched_phone = phone_map.get(clean_name)
                    if not matched_phone:
                        for s_name, s_phone in phone_map.items():
                            if len(clean_name) > 6 and (clean_name in s_name or s_name in clean_name):
                                matched_phone = s_phone
                                break
                    
                    if matched_phone:
                        await conn.execute(text(f"""
                            UPDATE {schema}.cupones_clientes
                            SET telefono = :telefono, updated_at = NOW()
                            WHERE id = :id;
                        """), {"id": cid, "telefono": matched_phone})
                        phones_added += 1

                logger.info(f"   -> {phones_added} números de teléfono asignados con éxito.")

            # Paso E: Inyectar items de venta a cupon_ticket_items
            logger.info("🛒 5/6. Vinculando productos e items de compra a cupon_ticket_items...")
            insert_items_sql = f"""
                INSERT INTO {schema}.cupon_ticket_items (
                    id, ticket_id, producto_id, descripcion, cantidad, precio_unitario, total, created_at
                )
                SELECT 
                    gen_random_uuid(),
                    ct.id,
                    si.product_id,
                    COALESCE(si.descripcion, p.nombre, 'Producto Extra'),
                    si.cantidad,
                    si.precio_unitario,
                    si.total,
                    NOW()
                FROM {schema}.cupon_tickets ct
                JOIN {schema}.sale_items si ON si.sale_id = ct.sale_id
                LEFT JOIN {schema}.products p ON p.id = si.product_id
                WHERE ct.company_id = '{COMPANY_ID}'
                  AND ct.sale_id IS NOT NULL
                  AND NOT EXISTS (
                      SELECT 1 FROM {schema}.cupon_ticket_items cti WHERE cti.ticket_id = ct.id
                  );
            """
            res_items = await conn.execute(text(insert_items_sql))
            logger.info(f"   -> {res_items.rowcount} items de productos comprados vinculados.")

            # Paso F: Recalcular métricas de consumo y RFM
            logger.info("📊 6/6. Recalculando métricas acumuladas y RFM de clientes...")
            recalc_rfm_sql = f"""
                UPDATE {schema}.cupones_clientes cc
                SET 
                    cantidad_compras = stats.total_tickets,
                    total_gastado = stats.total_monto,
                    ticket_promedio = CASE 
                        WHEN stats.total_tickets > 0 THEN stats.total_monto / stats.total_tickets 
                        ELSE 0 
                    END,
                    ultimo_consumo = stats.max_fecha,
                    segmentos = CASE 
                        WHEN stats.total_monto >= 2000000 THEN 'VIP / Alto Gasto, Comprador Frecuente'
                        WHEN stats.total_monto >= 500000 THEN 'Comprador Habitual, Perfil Familiar'
                        WHEN stats.total_tickets >= 3 THEN 'Cliente Recurrente'
                        ELSE 'Nuevo / Ocasional'
                    END,
                    updated_at = NOW()
                FROM (
                    SELECT 
                        cliente_id,
                        COUNT(id) as total_tickets,
                        COALESCE(SUM(monto_compra), 0) as total_monto,
                        MAX(fecha_captura) as max_fecha
                    FROM {schema}.cupon_tickets
                    WHERE company_id = '{COMPANY_ID}'
                    GROUP BY cliente_id
                ) stats
                WHERE cc.id = stats.cliente_id
                  AND cc.company_id = '{COMPANY_ID}';
            """
            await conn.execute(text(recalc_rfm_sql))
            logger.info(f"   -> RFM y métricas actualizadas exitosamente en '{schema}'.")

    if padron_conn:
        padron_conn.close()

    logger.info(f"\n🎉 PIPELINE COMPLETO FINALIZADO CON ÉXITO EN {time.time() - start_time:.1f} SEGUNDOS!")

if __name__ == "__main__":
    asyncio.run(run_pipeline())
