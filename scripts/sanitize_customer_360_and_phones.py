#!/usr/bin/env python3
"""
Script Maestro de Saneamiento Customer 360 & Normalización WhatsApp
InteliMarket — Extra Supermercado

Objetivos:
1. Cruzar cédulas con el Padrón Nacional TSJE (padron.db - 5.056.228 electores).
   - Si se encuentra: normalizar al nombre legal oficial del TSJE en MAYÚSCULAS.
   - Si no se encuentra: preservar nombre existente y convertir a MAYÚSCULAS.
2. Normalizar números de teléfono al formato internacional WhatsApp (E.164):
   - Paraguay (+595): +5959XXXXXXXX (12 dígitos). Corrige falsos prefijos 55 en líneas paraguayas.
   - Brasil (+55): +55 + DDD (2 dígitos) + 9 dígitos (13 dígitos). Inserta 9 inicial si es legacy.
   - Asignar idioma: 'pt' si el número es +55, 'es' para Paraguay y demás.
3. Sincronizar clientes de cupones_clientes (IntelliZapp) a la tabla maestra `customers`.
4. Normalizar todos los clientes existentes en `customers` a MAYÚSCULAS.
5. Verificación de existencia en WhatsApp vía Evolution API:
   - Si la instancia está conectada, valida lotes de 50.
   - Si el número no existe en WhatsApp, se remueve para proteger contra baneos masivos.
"""

import os
import sys
import re
import sqlite3
import argparse
import asyncio
import logging
from typing import Dict, Any, Optional, Tuple, List
import asyncpg
import httpx

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s"
)
logger = logging.getLogger("sanitize_c360")

DB_URL = os.environ.get("DATABASE_URL", "postgresql://intelimarket:password@localhost:5432/intelimarket")
PADRON_PATHS = [
    "/home/intellihouse/intelimarket/padron.db",
    os.path.expanduser("~/Library/CloudStorage/OneDrive-Personal/Dev/Bingo30k/padron.db"),
    "padron.db"
]

EVOLUTION_API_URL = os.environ.get("EVOLUTION_API_URL", "http://100.72.38.119:8085")
EVOLUTION_API_KEY = os.environ.get("EVOLUTION_API_KEY", "c616d81834c74317ad473380a10d35d84d6eacd08a7c467a6e7d79f29c0340d4")
EVOLUTION_INSTANCE = os.environ.get("EVOLUTION_INSTANCE_NAME", "extra_supermercado")


def compute_dv_set(clean_ci: str) -> int:
    """Calcula dígito verificador SET Módulo 11 oficial de Paraguay."""
    if not clean_ci or not clean_ci.isdigit():
        return 0
    suma = 0
    factor = 2
    for c in reversed(clean_ci):
        suma += int(c) * factor
        factor = 2 if factor == 11 else factor + 1
    resto = suma % 11
    return 11 - resto if resto > 1 else 0


def normalize_phone(raw_phone: str, in_padron_py: bool = False) -> Tuple[Optional[str], str]:
    """
    Normaliza un número de teléfono a formato internacional WhatsApp (+595 / +55).
    Retorna (telefono_normalizado, idioma).
    """
    if not raw_phone:
        return None, "es"
    
    digits = re.sub(r"[^\d]", "", str(raw_phone).strip())
    if not digits:
        return None, "es"

    # Caso 1: Error común de importación -> "5509..." (ej. 550982528386)
    if digits.startswith("5509") and len(digits) == 12:
        digits = "595" + digits[3:]  # quitar 550 y poner 595

    # Caso 2: Error común de importación -> Prefijo 55 en número paraguayo (ej. 55975247832)
    # Si empieza con 55, tiene 11 dígitos y empieza con 5597, 5598, 5599, 5596 (códigos de Personal, Tigo, Claro, Vox)
    # y además está en el padrón electoral paraguayo o no tiene un DDD brasileño válido (no es 67, 11, etc.)
    if digits.startswith("55") and len(digits) == 11 and digits[2:4] in ("96", "97", "98", "99"):
        if in_padron_py or digits[2:4] in ("97", "98"):
            digits = "595" + digits[2:]

    # Caso 3: Paraguay (+595)
    # Local: 09XXXXXXXX (10 dígitos)
    if digits.startswith("09") and len(digits) == 10:
        return f"+595{digits[1:]}", "es"
    # Sin cero: 9XXXXXXXX (9 dígitos)
    if digits.startswith("9") and len(digits) == 9:
        return f"+595{digits}", "es"
    # Con 595: 5959XXXXXXXX (12 dígitos)
    if digits.startswith("5959") and len(digits) == 12:
        return f"+{digits}", "es"
    if digits.startswith("59509") and len(digits) == 13:
        return f"+595{digits[4:]}", "es"

    # Caso 4: Brasil (+55)
    # E.164 Brasil completo: 55 + DDD (2 dig) + 9 dígitos celular = 13 dígitos
    if digits.startswith("55") and len(digits) == 13:
        return f"+{digits}", "pt"
    # Legacy Brasil con 8 dígitos de celular: 55 + DDD (2 dig) + 8 dígitos = 12 dígitos
    if digits.startswith("55") and len(digits) == 12:
        ddd = digits[2:4]
        subscriber = digits[4:]
        return f"+55{ddd}9{subscriber}", "pt"
    # Local Brasil celular sin código país: DDD (2 dig) + 9 dígitos = 11 dígitos
    if len(digits) == 11 and digits[0:2] in ("67", "45", "46", "41", "11", "12", "13", "14", "15", "16", "17", "18", "19", "51", "54", "47", "48", "49", "62", "65", "66"):
        return f"+55{digits}", "pt"
    # Local Brasil celular legacy sin código país: DDD (2 dig) + 8 dígitos = 10 dígitos
    if len(digits) == 10 and digits[0:2] in ("67", "45", "46", "41", "11", "51", "47", "48"):
        return f"+55{digits[0:2]}9{digits[2:]}", "pt"

    # Si ya venía con código de país u otro formato estándar
    if digits.startswith("595") and len(digits) >= 11:
        return f"+{digits}", "es"
    if digits.startswith("55") and len(digits) >= 12:
        return f"+{digits}", "pt"

    # Si es un número dudoso o corto (< 8 dígitos), retornar None para descartar ruido
    if len(digits) < 8:
        return None, "es"

    return f"+{digits}", "es"


class SanitizeProcessor:
    def __init__(self, dry_run: bool = False, verify_wa: bool = False):
        self.dry_run = dry_run
        self.verify_wa = verify_wa
        self.pg_conn: Optional[asyncpg.Connection] = None
        self.sqlite_conn: Optional[sqlite3.Connection] = None

    async def init_connections(self):
        logger.info(f"Conectando a PostgreSQL: {DB_URL}...")
        self.pg_conn = await asyncpg.connect(DB_URL)
        
        # Conectar Padrón Nacional SQLite
        for path in PADRON_PATHS:
            if os.path.exists(path):
                try:
                    self.sqlite_conn = sqlite3.connect(path)
                    logger.info(f"✅ Padrón Nacional TSJE conectado ({path})")
                    break
                except Exception as e:
                    logger.warning(f"Error abriendo {path}: {e}")
        
        if not self.sqlite_conn:
            logger.warning("⚠️ No se encontró padron.db. Se preservarán nombres existentes en MAYÚSCULAS.")

    async def close_connections(self):
        if self.pg_conn:
            await self.pg_conn.close()
        if self.sqlite_conn:
            self.sqlite_conn.close()

    def lookup_padron(self, ci: str) -> Optional[Tuple[str, str]]:
        """Busca una cédula en el padrón electoral. Retorna (nombre_oficial, distrito) o None."""
        if not self.sqlite_conn or not ci or not ci.isdigit():
            return None
        cur = self.sqlite_conn.cursor()
        cur.execute("SELECT nombre, apellido, depart, distrito FROM electors WHERE ci = ?", (ci,))
        row = cur.fetchone()
        if row:
            full_name = f"{row[0]} {row[1]}".strip().upper()
            distrito = row[3] if row[3] else "Pedro Juan Caballero"
            return full_name, distrito
        return None

    async def process_cupones_clientes(self):
        """Sanea cupones_clientes: nombre oficial TSJE en MAYÚSCULAS y teléfono E.164."""
        logger.info("==> Fase 1: Saneando tabla cupones_clientes...")
        rows = await self.pg_conn.fetch("""
            SELECT id, company_id, documento, nombre, telefono, ciudad 
            FROM cupones_clientes
        """)
        logger.info(f"Registros en cupones_clientes: {len(rows)}")

        updated_count = 0
        padron_matches = 0
        py_phones = 0
        br_phones = 0
        invalid_phones = 0

        for r in rows:
            doc_raw = str(r["documento"] or "").strip()
            clean_ci = "".join([c for c in doc_raw if c.isdigit()])
            nombre_actual = str(r["nombre"] or "").strip()
            
            # Cruce Padrón TSJE
            padron_info = self.lookup_padron(clean_ci)
            if padron_info:
                nombre_final = padron_info[0]
                padron_matches += 1
            else:
                nombre_final = nombre_actual.upper()

            in_padron = bool(padron_info)
            tel_norm, idioma = normalize_phone(r["telefono"], in_padron_py=in_padron)
            
            if tel_norm:
                if tel_norm.startswith("+55"):
                    br_phones += 1
                else:
                    py_phones += 1
            else:
                invalid_phones += 1

            if not self.dry_run:
                await self.pg_conn.execute("""
                    UPDATE cupones_clientes
                    SET nombre = $1,
                        telefono = $2,
                        idioma = $3,
                        updated_at = NOW()
                    WHERE id = $4
                """, nombre_final, tel_norm, idioma, r["id"])

            updated_count += 1

        logger.info(f"   [cupones_clientes] Total procesados: {updated_count}")
        logger.info(f"   [cupones_clientes] Cruzados con Padrón TSJE: {padron_matches}")
        logger.info(f"   [cupones_clientes] Teléfonos Paraguay (+595): {py_phones}")
        logger.info(f"   [cupones_clientes] Teléfonos Brasil (+55): {br_phones}")
        logger.info(f"   [cupones_clientes] Teléfonos descartados por inválidos: {invalid_phones}")

    async def sync_cupones_to_customers(self):
        """Sincroniza los clientes de cupones a la tabla maestra `customers`."""
        logger.info("==> Fase 2: Sincronizando clientes de cupones hacia tabla customers...")
        
        # Obtener default company_id
        company_row = await self.pg_conn.fetchrow("SELECT id FROM companies LIMIT 1")
        default_company_id = company_row["id"] if company_row else None

        rows = await self.pg_conn.fetch("""
            SELECT cc.company_id, cc.documento, cc.nombre, cc.telefono, cc.ciudad, cc.idioma
            FROM cupones_clientes cc
        """)

        inserted = 0
        updated = 0

        for r in rows:
            doc_raw = str(r["documento"] or "").strip()
            clean_ci = "".join([c for c in doc_raw if c.isdigit()])
            if not clean_ci:
                continue

            comp_id = r["company_id"] or default_company_id
            nombre_upper = (r["nombre"] or "").strip().upper()
            tel = r["telefono"]
            idioma = r["idioma"] or ("pt" if tel and tel.startswith("+55") else "es")
            ciudad = r["ciudad"] or "Pedro Juan Caballero"
            dv = compute_dv_set(clean_ci)
            ruc_completo = f"{clean_ci}-{dv}"

            # Verificar si ya existe en customers por CI o RUC
            existing = await self.pg_conn.fetchrow("""
                SELECT id, razon_social, telefono, extra_club_numero
                FROM customers
                WHERE ci = $1 OR ruc = $1 OR ruc = $2 OR ruc LIKE $3
                LIMIT 1
            """, clean_ci, ruc_completo, f"{clean_ci}-%")

            if existing:
                if not self.dry_run:
                    await self.pg_conn.execute("""
                        UPDATE customers
                        SET razon_social = $1,
                            telefono = COALESCE(telefono, $2),
                            idioma = COALESCE(idioma, $3),
                            updated_at = NOW()
                        WHERE id = $4
                    """, nombre_upper, tel, idioma, existing["id"])
                updated += 1
            else:
                if not self.dry_run:
                    await self.pg_conn.execute("""
                        INSERT INTO customers (
                            company_id, tipo_persona, tipo, ruc, ci, razon_social, 
                            nombre_fantasia, telefono, ciudad, idioma, activo, 
                            credito_limite, limite_credito, credito_usado
                        ) VALUES (
                            $1, 'fisica', 'cliente', $2, $3, $4, 
                            $4, $5, $6, $7, true, 
                            0, 0, 0
                        )
                    """, comp_id, ruc_completo, clean_ci, nombre_upper, tel, ciudad, idioma)
                inserted += 1

        logger.info(f"   [sync customers] Nuevos insertados: {inserted}")
        logger.info(f"   [sync customers] Existentes actualizados: {updated}")

    async def sanitize_all_existing_customers(self):
        """Asegura que todos los clientes en `customers` tengan nombres en MAYÚSCULAS y teléfonos E.164."""
        logger.info("==> Fase 3: Estandarizando todos los registros de customers a MAYÚSCULAS y E.164...")
        rows = await self.pg_conn.fetch("""
            SELECT id, ci, ruc, razon_social, nombre_fantasia, telefono
            FROM customers
        """)

        padron_fixed = 0
        uppercase_fixed = 0

        for r in rows:
            clean_ci = "".join([c for c in (r["ci"] or r["ruc"] or "") if c.isdigit()])
            nombre_actual = (r["razon_social"] or "").strip()
            
            padron_info = self.lookup_padron(clean_ci)
            if padron_info:
                nombre_final = padron_info[0]
                padron_fixed += 1
            else:
                nombre_final = nombre_actual.upper()

            tel_norm, idioma = normalize_phone(r["telefono"], in_padron_py=bool(padron_info))
            
            if not self.dry_run:
                await self.pg_conn.execute("""
                    UPDATE customers
                    SET razon_social = $1,
                        nombre_fantasia = UPPER(COALESCE(nombre_fantasia, $1)),
                        telefono = $2,
                        idioma = $3,
                        updated_at = NOW()
                    WHERE id = $4
                """, nombre_final, tel_norm, idioma, r["id"])

            uppercase_fixed += 1

        logger.info(f"   [customers general] Total registros estandarizados: {uppercase_fixed}")
        logger.info(f"   [customers general] Enriquecidos con Padrón TSJE: {padron_fixed}")

    async def verify_whatsapp_numbers(self):
        """Verifica en vivo vía Evolution API si los números están registrados en WhatsApp."""
        logger.info("==> Fase 4: Verificación de números en WhatsApp (Evolution API)...")
        
        # 1. Comprobar estado de la conexión
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                state_res = await client.get(
                    f"{EVOLUTION_API_URL}/instance/connectionState/{EVOLUTION_INSTANCE}",
                    headers={"apikey": EVOLUTION_API_KEY}
                )
                state_data = state_res.json()
                state = state_data.get("instance", {}).get("state")
                logger.info(f"   Estado de instancia WhatsApp '{EVOLUTION_INSTANCE}': {state}")
                
                if state != "open":
                    logger.warning(f"⚠️ La instancia '{EVOLUTION_INSTANCE}' está en estado '{state}' (desconectada).")
                    logger.warning("   Para verificar números reales en WhatsApp, escanee el código QR en Evolution API.")
                    logger.warning("   La normalización de formatos E.164 ya quedó perfectamente aplicada.")
                    return
        except Exception as e:
            logger.error(f"Error al conectar con Evolution API: {e}")
            return

        # 2. Consultar números a verificar
        rows = await self.pg_conn.fetch("""
            SELECT id, telefono FROM customers WHERE telefono IS NOT NULL AND telefono != ''
        """)
        logger.info(f"   Total de números a verificar: {len(rows)}")

        batch_size = 50
        deleted_count = 0
        valid_count = 0

        async with httpx.AsyncClient(timeout=30.0) as client:
            for i in range(0, len(rows), batch_size):
                batch = rows[i:i + batch_size]
                numbers = [r["telefono"].replace("+", "") for r in batch]
                
                try:
                    res = await client.post(
                        f"{EVOLUTION_API_URL}/chat/whatsappNumbers/{EVOLUTION_INSTANCE}",
                        headers={"apikey": EVOLUTION_API_KEY, "Content-Type": "application/json"},
                        json={"numbers": numbers}
                    )
                    if res.status_code == 200:
                        results = res.json()
                        exists_map = {item.get("number"): item.get("exists") for item in results if isinstance(item, dict)}
                        
                        for r in batch:
                            clean_num = r["telefono"].replace("+", "")
                            exists = exists_map.get(clean_num, False)
                            if exists:
                                valid_count += 1
                                if not self.dry_run:
                                    await self.pg_conn.execute("UPDATE customers SET whatsapp_valido = true WHERE id = $1", r["id"])
                            else:
                                deleted_count += 1
                                logger.info(f"   ❌ Número inexistente en WhatsApp: {r['telefono']}. Removiendo para evitar ban...")
                                if not self.dry_run:
                                    await self.pg_conn.execute("UPDATE customers SET telefono = NULL, whatsapp_valido = false WHERE id = $1", r["id"])
                except Exception as e:
                    logger.warning(f"Error verificando lote {i}-{i+batch_size}: {e}")

        logger.info(f"   [WhatsApp live check] Números válidos confirmados: {valid_count}")
        logger.info(f"   [WhatsApp live check] Números inexistentes removidos: {deleted_count}")


async def main():
    parser = argparse.ArgumentParser(description="Sanitizar clientes y normalizar teléfonos WhatsApp")
    parser.add_argument("--dry-run", action="store_true", help="Ejecutar en modo simulación sin escribir en BD")
    parser.add_argument("--verify-wa", action="store_true", help="Ejecutar verificación de números en vivo con Evolution API")
    args = parser.parse_args()

    processor = SanitizeProcessor(dry_run=args.dry_run, verify_wa=args.verify_wa)
    try:
        await processor.init_connections()
        await processor.process_cupones_clientes()
        await processor.sync_cupones_to_customers()
        await processor.sanitize_all_existing_customers()
        if args.verify_wa:
            await processor.verify_whatsapp_numbers()
        logger.info("🎉 ¡Saneamiento completado con éxito!")
    finally:
        await processor.close_connections()


if __name__ == "__main__":
    asyncio.run(main())
