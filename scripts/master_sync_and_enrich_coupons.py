"""
Master Sync & Enrichment Script:
1. Extracción de perfiles reales de clientes desde IntelliZapp.
2. Cruce y enriquecimiento con Padrón Nacional TSJE (Intelecciones: 5.056.228 ciudadanos).
3. Cruce con Customers y Ventas de Intelimarket (sales y sale_items).
4. Actualización atómica en PostgreSQL (Producción 'public' y 'sandbox').
5. Recalculo de RFM y sincronización con Cliente 360.
"""

import sys
import os
import time
import json
import uuid
import sqlite3
import logging
import asyncio
import urllib.request
import urllib.parse
from datetime import datetime, timedelta
from concurrent.futures import ThreadPoolExecutor
from sqlalchemy import text
from api.src.db import engine

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger("master.sync_enrich")

INTELLIZAPP_API_URL = "https://intellizapp-production.up.railway.app"
SUPABASE_AUTH_URL = "https://sbbgvvymlbgthsgtiote.supabase.co/auth/v1/token?grant_type=password"
SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNiYmd2dnltbGJndGhzZ3Rpb3RlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDAxODYzMywiZXhwIjoyMDk1NTk0NjMzfQ.N0rd3N8rUeIMLGcdwrWhZQFkX5ODcXu7dB7nni3Wgfw"
PADRON_DB_PATH = "/home/intellihouse/intelimarket/padron.db"
COMPANY_ID = "00000000-0000-0000-0000-000000000010"
DEFAULT_CAMPANA_ID = "00000000-0000-0000-0000-000000000001"

def get_auth_token() -> str:
    logger.info("🔑 Obteniendo token JWT de autenticación para IntelliZapp...")
    auth_payload = json.dumps({
        "email": "intellihousepy@gmail.com",
        "password": "PasswordIntelli2026!"
    }).encode("utf-8")
    
    req = urllib.request.Request(
        SUPABASE_AUTH_URL,
        data=auth_payload,
        headers={
            "apikey": SUPABASE_ANON_KEY,
            "Content-Type": "application/json"
        }
    )
    with urllib.request.urlopen(req, timeout=15) as resp:
        data = json.loads(resp.read().decode("utf-8"))
        return data["access_token"]

def fetch_real_clients_from_intellizapp(token: str):
    logger.info("🚀 Extrayendo perfiles reales de clientes desde IntelliZapp...")
    cur = datetime(2026, 7, 1, 0, 0, 0)
    end_limit = datetime(2026, 8, 30, 0, 0, 0)
    intervals = []
    while cur < end_limit:
        nxt = cur + timedelta(hours=4)
        intervals.append((cur.isoformat(), nxt.isoformat()))
        cur = nxt

    def fetch_interval(args):
        start_iso, end_iso = args
        params = urllib.parse.urlencode({'fechaInicio': start_iso, 'fechaFin': end_iso})
        req = urllib.request.Request(
            f'{INTELLIZAPP_API_URL}/api/captura/cupones/recientes?{params}',
            headers={'Authorization': f'Bearer {token}'}
        )
        try:
            with urllib.request.urlopen(req, timeout=10) as resp:
                return json.loads(resp.read().decode('utf-8')).get('data', [])
        except:
            return []

    real_clients = {}
    with ThreadPoolExecutor(max_workers=35) as executor:
        results = executor.map(fetch_interval, intervals)
        for res in results:
            for t in res:
                c = t.get('cliente')
                if c and c.get('id'):
                    real_clients[c['id']] = c

    logger.info(f"✅ {len(real_clients)} perfiles reales de clientes extraídos de IntelliZapp.")
    return real_clients

async def run_master_sync():
    logger.info("🌟 INICIANDO PROCESO MAESTRO DE SINCRONIZACIÓN Y ENRIQUECIMIENTO...")
    start_time = time.time()

    token = get_auth_token()
    real_clients_map = fetch_real_clients_from_intellizapp(token)

    padron_conn = None
    if os.path.exists(PADRON_DB_PATH):
        padron_conn = sqlite3.connect(PADRON_DB_PATH)
        logger.info(f"✅ Padrón Nacional TSJE conectado ({PADRON_DB_PATH}).")
    else:
        logger.warning(f"⚠️ No se encontró padron.db en {PADRON_DB_PATH}")

    schemas = ["public", "sandbox"]

    async with engine.begin() as conn:
        for schema in schemas:
            logger.info(f"\n==================================================")
            logger.info(f"👉 ACTUALIZANDO ESQUEMA: '{schema}'")
            logger.info(f"==================================================")

            # 1. Actualizar perfiles reales de IntelliZapp en cupones_clientes
            logger.info("👤 1/5. Actualizando perfiles de clientes desde IntelliZapp...")
            actualizados_iz = 0
            for cid, c in real_clients_map.items():
                client_uuid = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"intellizapp_cliente_{cid}"))
                doc = str(c.get("documento") or "").strip().replace(".", "").replace("-", "")
                nombre = (c.get("nombre") or "").strip()
                telefono = (c.get("telefono") or "").strip()
                direccion = c.get("direccion")
                barrio = c.get("barrio") or "Centro"
                ciudad = c.get("ciudad") or "Pedro Juan Caballero"
                ticket_promedio = float(c.get("ticketPromedio") or 0)
                total_gastado = float(c.get("totalGastado") or 0)
                cantidad_compras = int(c.get("cantidadCompras") or 0)
                segmentos = c.get("segmentos")
                ia_analisis = json.dumps(c.get("iaAnalisis")) if c.get("iaAnalisis") else None

                if doc and nombre:
                    await conn.execute(text(f"""
                        UPDATE {schema}.cupones_clientes
                        SET 
                            documento = :doc,
                            nombre = :nombre,
                            telefono = CASE WHEN :telefono <> '' THEN :telefono ELSE telefono END,
                            direccion = COALESCE(:direccion, direccion),
                            barrio = COALESCE(:barrio, barrio),
                            ciudad = COALESCE(:ciudad, ciudad),
                            ticket_promedio = CASE WHEN :ticket_promedio > 0 THEN :ticket_promedio ELSE ticket_promedio END,
                            total_gastado = CASE WHEN :total_gastado > 0 THEN :total_gastado ELSE total_gastado END,
                            cantidad_compras = GREATEST(cantidad_compras, :cantidad_compras),
                            segmentos = COALESCE(:segmentos, segmentos),
                            ia_analisis = COALESCE(CAST(:ia_analisis AS jsonb), ia_analisis),
                            updated_at = NOW()
                        WHERE id = :id;
                    """), {
                        "id": client_uuid,
                        "doc": doc,
                        "nombre": nombre,
                        "telefono": telefono,
                        "direccion": direccion,
                        "barrio": barrio,
                        "ciudad": ciudad,
                        "ticket_promedio": ticket_promedio,
                        "total_gastado": total_gastado,
                        "cantidad_compras": cantidad_compras,
                        "segmentos": segmentos,
                        "ia_analisis": ia_analisis,
                    })
                    actualizados_iz += 1

            logger.info(f"   -> {actualizados_iz} perfiles actualizados con datos reales de IntelliZapp.")

            # 2. Enriquecer con Padrón Nacional TSJE (Intelecciones)
            if padron_conn:
                logger.info("🗳️ 2/5. Cruzando con Padrón Nacional TSJE por Cédula...")
                res_unnamed = await conn.execute(text(f"""
                    SELECT id, documento, nombre 
                    FROM {schema}.cupones_clientes 
                    WHERE company_id = '{COMPANY_ID}'
                      AND (nombre LIKE 'Cliente %' OR nombre = '' OR nombre LIKE 'IZ%')
                      AND documento ~ '^[0-9]+$';
                """))
                unnamed = res_unnamed.fetchall()
                logger.info(f"   -> Evaluando {len(unnamed)} clientes sin nombre con C.I. numérica...")

                cur = padron_conn.cursor()
                padron_matches = 0
                for cid, doc, curr_name in unnamed:
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
                        padron_matches += 1

                logger.info(f"   -> {padron_matches} clientes identificados con nombre oficial del Padrón.")

            # 3. Cruzar con tabla customers de Intelimarket
            logger.info("🏢 3/5. Cruzando con base de customers de Intelimarket...")
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
            logger.info(f"   -> {res_cust.rowcount} clientes enriquecidos desde tabla customers.")

            # 4. Vincular ventas reales a tickets y productos
            logger.info("🛒 4/5. Vinculando tickets con compras y productos...")
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

            # 5. Recalcular RFM
            logger.info("📊 5/5. Recalculando métricas acumuladas y segmentación RFM...")
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
            logger.info(f"   -> RFM actualizado exitosamente en '{schema}'.")

    if padron_conn:
        padron_conn.close()

    logger.info(f"\n🎉 PROCESO MAESTRO FINALIZADO CON ÉXITO EN {time.time() - start_time:.1f} SEGUNDOS!")

if __name__ == "__main__":
    asyncio.run(run_master_sync())
