"""
Migración e Inyección Masiva: IntelliZapp -> Intelimarket Postgres (Producción & Sandbox)
Mapea fielmente los modelos SQLAlchemy de CuponCliente, CuponTicket y SorteoCampana.
"""

import sys
import os
import time
import json
import uuid
import logging
import asyncio
import urllib.request
import urllib.parse
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor, as_completed
from sqlalchemy import text
from api.src.db import engine

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger("migration.intellizapp_to_pg")

INTELLIZAPP_API_URL = "https://intellizapp-production.up.railway.app"
SUPABASE_AUTH_URL = "https://sbbgvvymlbgthsgtiote.supabase.co/auth/v1/token?grant_type=password"
SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNiYmd2dnltbGJndGhzZ3Rpb3RlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDAxODYzMywiZXhwIjoyMDk1NTk0NjMzfQ.N0rd3N8rUeIMLGcdwrWhZQFkX5ODcXu7dB7nni3Wgfw"
COMPANY_ID = "00000000-0000-0000-0000-000000000010"
DEFAULT_CAMPANA_ID = "00000000-0000-0000-0000-000000000001"
DEFAULT_CAMPANA_NOMBRE = "Gran Sorteo Aniversario Extra Supermercado"

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
        token = data.get("access_token")
        if not token:
            raise RuntimeError("No se pudo obtener access_token de Supabase Auth")
        logger.info("✅ Token JWT obtenido correctamente.")
        return token

def fetch_client_tickets(cid: int, token: str):
    url = f"{INTELLIZAPP_API_URL}/api/captura/clientes/{cid}/tickets"
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {token}"})
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            tickets = data.get("data", [])
            return cid, tickets
    except Exception:
        return cid, None

def fetch_client_profile(cid: int, token: str):
    url = f"{INTELLIZAPP_API_URL}/api/captura/clientes/{cid}/analyze-ai"
    req = urllib.request.Request(
        url,
        data=b"{}",
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            return cid, data.get("data", {})
    except Exception:
        return cid, None

async def run_migration(max_client_id: int = 21500, max_workers: int = 40):
    token = get_auth_token()
    logger.info(f"🚀 Iniciando extracción masiva de cupones para clientes (1 a {max_client_id})...")
    
    start_time = time.time()
    clients_tickets_map = {}
    total_tickets = 0

    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = {executor.submit(fetch_client_tickets, cid, token): cid for cid in range(1, max_client_id + 1)}
        done = 0
        for f in as_completed(futures):
            done += 1
            cid, tickets = f.result()
            if tickets and len(tickets) > 0:
                clients_tickets_map[cid] = tickets
                total_tickets += len(tickets)
            if done % 3000 == 0 or done == max_client_id:
                logger.info(f"⏳ Tickets progreso: {done}/{max_client_id} ({done/max_client_id*100:.1f}%) | Clientes activos: {len(clients_tickets_map)} | Cupones: {total_tickets}")

    logger.info(f"✅ Extracción de tickets finalizada: {len(clients_tickets_map)} clientes, {total_tickets} cupones.")
    
    # 2. Extraer perfiles de clientes
    logger.info(f"🚀 Extrayendo perfiles y datos demográficos de los {len(clients_tickets_map)} clientes...")
    active_client_ids = list(clients_tickets_map.keys())
    clients_profiles_map = {}

    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = {executor.submit(fetch_client_profile, cid, token): cid for cid in active_client_ids}
        done = 0
        for f in as_completed(futures):
            done += 1
            cid, profile = f.result()
            if profile:
                clients_profiles_map[cid] = profile
            if done % 1000 == 0 or done == len(active_client_ids):
                logger.info(f"⏳ Perfiles progreso: {done}/{len(active_client_ids)} ({done/len(active_client_ids)*100:.1f}%)")

    logger.info(f"✅ Perfiles obtenidos: {len(clients_profiles_map)} de {len(active_client_ids)} clientes.")

    # 3. Inyección en Base de Datos PostgreSQL (public y sandbox)
    schemas = ["public", "sandbox"]
    async with engine.begin() as conn:
        for schema in schemas:
            logger.info(f"📥 Inyectando datos en esquema '{schema}'...")

            # Asegurar campaña activa
            await conn.execute(text(f"""
                INSERT INTO {schema}.sorteo_campanas (
                    id, company_id, nombre, codigo, descripcion, patrocinador, premio_destacado,
                    tipo_trigger, criterio_evaluacion, valor_umbral, activo,
                    ticket_encabezado, ticket_subtitulo, ticket_pie_urna,
                    created_at, updated_at
                ) VALUES (
                    '{DEFAULT_CAMPANA_ID}', '{COMPANY_ID}', '{DEFAULT_CAMPANA_NOMBRE}',
                    'ANIVERSARIO-2026', 'Gran Sorteo Aniversario Extra Supermercado',
                    'Extra Supermercado', 'Auto 0km + 10 Carritos Llenos',
                    'MONTO_GLOBAL', 'MONTO_ACUMULADO', 50000, true,
                    'EXTRA SUPERMERCADO', 'GRAN SORTEO ANIVERSARIO', '¡Deposita este cupon en la urna de la sucursal!',
                    NOW(), NOW()
                )
                ON CONFLICT (id) DO UPDATE SET
                    nombre = EXCLUDED.nombre,
                    activo = true,
                    valor_umbral = EXCLUDED.valor_umbral;
            """))

            # Mapear cliente integer ID a UUID determinista
            client_uuid_map = {}
            clientes_insertados = 0

            for cid in active_client_ids:
                client_uuid = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"intellizapp_cliente_{cid}"))
                client_uuid_map[cid] = client_uuid

                p = clients_profiles_map.get(cid, {})
                documento = p.get("documento") or f"IZ-{cid}"
                documento = str(documento).strip().replace(".", "").replace("-", "")
                nombre = p.get("nombre") or f"Cliente {documento}"
                telefono = p.get("telefono") or ""
                direccion = p.get("direccion")
                barrio = p.get("barrio") or "Centro"
                ciudad = p.get("ciudad") or "Pedro Juan Caballero"
                ticket_promedio = float(p.get("ticketPromedio") or 0)
                total_gastado = float(p.get("totalGastado") or 0)
                cantidad_compras = int(p.get("cantidadCompras") or len(clients_tickets_map[cid]))
                ultimo_consumo = p.get("ultimoConsumo")
                segmentos = p.get("segmentos")
                ia_analisis = json.dumps(p.get("iaAnalisis")) if p.get("iaAnalisis") else None

                await conn.execute(text(f"""
                    INSERT INTO {schema}.cupones_clientes (
                        id, company_id, documento, nombre, telefono, direccion, barrio, ciudad,
                        ticket_promedio, total_gastado, cantidad_compras, ultimo_consumo,
                        segmentos, ia_analisis, activo, created_at, updated_at
                    ) VALUES (
                        :id, :company_id, :documento, :nombre, :telefono, :direccion, :barrio, :ciudad,
                        :ticket_promedio, :total_gastado, :cantidad_compras, :ultimo_consumo,
                        :segmentos, :ia_analisis, true, NOW(), NOW()
                    )
                    ON CONFLICT (id) DO UPDATE SET
                        documento = EXCLUDED.documento,
                        nombre = EXCLUDED.nombre,
                        telefono = CASE WHEN EXCLUDED.telefono <> '' THEN EXCLUDED.telefono ELSE {schema}.cupones_clientes.telefono END,
                        direccion = COALESCE(EXCLUDED.direccion, {schema}.cupones_clientes.direccion),
                        barrio = COALESCE(EXCLUDED.barrio, {schema}.cupones_clientes.barrio),
                        ciudad = COALESCE(EXCLUDED.ciudad, {schema}.cupones_clientes.ciudad),
                        cantidad_compras = GREATEST({schema}.cupones_clientes.cantidad_compras, EXCLUDED.cantidad_compras),
                        updated_at = NOW();
                """), {
                    "id": client_uuid,
                    "company_id": COMPANY_ID,
                    "documento": documento,
                    "nombre": nombre,
                    "telefono": telefono,
                    "direccion": direccion,
                    "barrio": barrio,
                    "ciudad": ciudad,
                    "ticket_promedio": ticket_promedio,
                    "total_gastado": total_gastado,
                    "cantidad_compras": cantidad_compras,
                    "ultimo_consumo": ultimo_consumo,
                    "segmentos": segmentos,
                    "ia_analisis": ia_analisis,
                })
                clientes_insertados += 1

            logger.info(f"✅ Esquema '{schema}': {clientes_insertados} clientes insertados/actualizados.")

            # Inyectar tickets
            tickets_insertados = 0
            for cid, tickets in clients_tickets_map.items():
                client_uuid = client_uuid_map.get(cid)
                if not client_uuid:
                    continue

                for t in tickets:
                    raw_tid = t.get("id")
                    ticket_uuid = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"intellizapp_ticket_{raw_tid}"))
                    nro_ticket = str(t.get("nroTicket") or "").strip()
                    cantidad = int(t.get("cantidad") or 1)
                    fecha_captura_str = t.get("fechaCaptura")
                    fecha_captura = datetime.fromisoformat(fecha_captura_str.replace("Z", "+00:00")) if fecha_captura_str else datetime.utcnow()
                    usuario_nombre = t.get("usuarioNombre") or "Cajero Extra"
                    monto_compra = float(t.get("montoCompra") or 0)
                    fecha_compra_str = t.get("fechaCompra")
                    fecha_compra = datetime.fromisoformat(fecha_compra_str.replace("Z", "+00:00")) if fecha_compra_str else None
                    sincronizado = bool(t.get("sincronizado", False))

                    await conn.execute(text(f"""
                        INSERT INTO {schema}.cupon_tickets (
                            id, company_id, cliente_id, campana_id, campana_nombre,
                            nro_ticket, cantidad, monto_compra, fecha_compra, fecha_captura,
                            usuario_nombre, sincronizado, whatsapp_enviado, whatsapp_status,
                            created_at, updated_at
                        ) VALUES (
                            :id, :company_id, :cliente_id, :campana_id, :campana_nombre,
                            :nro_ticket, :cantidad, :monto_compra, :fecha_compra, :fecha_captura,
                            :usuario_nombre, :sincronizado, false, 'pendiente',
                            NOW(), NOW()
                        )
                        ON CONFLICT (id) DO UPDATE SET
                            cantidad = EXCLUDED.cantidad,
                            sincronizado = EXCLUDED.sincronizado,
                            monto_compra = COALESCE(EXCLUDED.monto_compra, {schema}.cupon_tickets.monto_compra),
                            updated_at = NOW();
                    """), {
                        "id": ticket_uuid,
                        "company_id": COMPANY_ID,
                        "cliente_id": client_uuid,
                        "campana_id": DEFAULT_CAMPANA_ID,
                        "campana_nombre": DEFAULT_CAMPANA_NOMBRE,
                        "nro_ticket": nro_ticket,
                        "cantidad": cantidad,
                        "monto_compra": monto_compra,
                        "fecha_compra": fecha_compra,
                        "fecha_captura": fecha_captura,
                        "usuario_nombre": usuario_nombre,
                        "sincronizado": sincronizado,
                    })
                    tickets_insertados += 1

            logger.info(f"✅ Esquema '{schema}': {tickets_insertados} tickets de sorteo inyectados con éxito.")

    logger.info(f"🎉 MIGRACIÓN COMPLETA FINALIZADA EN {time.time() - start_time:.1f} SEGUNDOS!")

if __name__ == "__main__":
    asyncio.run(run_migration())
