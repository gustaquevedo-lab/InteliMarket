"""
Script ETL de Migración Integral de Cupones y Clientes:
Desde IntelliZapp Production API (Railway) hacia Intelimarket (PostgreSQL: Producción 'public' y 'sandbox').
"""

import sys
import os
import time
import json
import logging
import urllib.request
import urllib.parse
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor, as_completed

# Configuración de Logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger("migration.intellizapp")

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
    except Exception as e:
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
    except Exception as e:
        return cid, None

def extract_all_intellizapp_data(max_client_id: int = 21500, max_workers: int = 40):
    token = get_auth_token()
    logger.info(f"🚀 Iniciando extracción masiva concurrente de clientes (1 a {max_client_id}) con {max_workers} workers...")
    
    start_time = time.time()
    clients_with_tickets = {}
    total_tickets_count = 0

    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = {executor.submit(fetch_client_tickets, cid, token): cid for cid in range(1, max_client_id + 1)}
        
        done_count = 0
        for future in as_completed(futures):
            done_count += 1
            cid, tickets = future.result()
            if tickets and len(tickets) > 0:
                clients_with_tickets[cid] = tickets
                total_tickets_count += len(tickets)
            
            if done_count % 2000 == 0 or done_count == max_client_id:
                elapsed = time.time() - start_time
                logger.info(f"⏳ Progreso: {done_count}/{max_client_id} IDs procesados ({done_count/max_client_id*100:.1f}%) | Clientes encontrados: {len(clients_with_tickets)} | Cupones: {total_tickets_count} | Tiempo: {elapsed:.1f}s")

    logger.info(f"🎉 Extracción de tickets completada en {time.time() - start_time:.1f}s.")
    logger.info(f"📊 Resumen: {len(clients_with_tickets)} clientes con un total de {total_tickets_count} tickets.")

    # Guardar snapshot temporal en disco
    os.makedirs("/tmp/intellizapp_migration", exist_ok=True)
    snapshot_file = "/tmp/intellizapp_migration/tickets_snapshot.json"
    with open(snapshot_file, "w", encoding="utf-8") as f:
        json.dump(clients_with_tickets, f, ensure_ascii=False)
    logger.info(f"💾 Snapshot de tickets guardado en {snapshot_file}")

    return clients_with_tickets

if __name__ == "__main__":
    max_id = int(sys.argv[1]) if len(sys.argv) > 1 else 21500
    extract_all_intellizapp_data(max_id)
