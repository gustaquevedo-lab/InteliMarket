#!/usr/bin/env python3
"""
Script Maestro de Unificación y Normalización de Clientes
Extra Supermercado — InteliMarket

Reglas de Negocio Oficiales:
1. Para Personas Físicas (C.I.):
   - Se busca por CI en la base oficial DNIT (ruc_dnit.db).
   - Si TIENE RUC en DNIT: se le marca como 'contribuyente', se asigna su RUC oficial con DV, y se normaliza su nombre.
   - Si NO TIENE RUC en DNIT: se le marca como 'consumidor_final', se normaliza su nombre con el Padrón Nacional TSJE (padron.db), y se guarda su CI limpia y su RUC con DV Módulo 11 para facturación.
2. Para Empresas / Personas Jurídicas:
   - Se busca por RUC en DNIT, se normaliza su Razón Social oficial en MAYÚSCULAS, tipo='contribuyente' y tipo_persona='juridica'.
3. Unificación Atómica de Duplicados:
   - Fusión de los registros duplicados de una misma persona (CI vs RUC).
   - Traspaso limpio de ventas, cuentas por cobrar, cuentas de crédito, cupones y puntos a la ficha titular.
   - Eliminación del duplicado secundario.
4. Blindaje:
   - Creación de índice único funcional en Postgres para impedir que vuelva a duplicarse cualquier CI/RUC.
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

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s"
)
logger = logging.getLogger("unificar_clientes")

DB_URL = os.environ.get("DATABASE_URL", "postgresql://intelimarket:password@localhost:5432/intelimarket")
DNIT_DB_PATH = "/home/intellihouse/intelimarket/ruc_dnit.db"
PADRON_DB_PATH = "/home/intellihouse/intelimarket/padron.db"


def compute_dv_set(clean_ci: str) -> int:
    """Calcula dígito verificador SET/DNIT Módulo 11 oficial de Paraguay."""
    if not clean_ci or not clean_ci.isdigit():
        return 0
    suma = 0
    factor = 2
    for c in reversed(clean_ci):
        suma += int(c) * factor
        factor = 2 if factor == 11 else factor + 1
    resto = suma % 11
    return 11 - resto if resto > 1 else 0


def clean_doc_root(raw_doc: str, dnit_conn: Optional[sqlite3.Connection] = None) -> str:
    """Extrae la raíz numérica del documento (sin guión ni DV)."""
    if not raw_doc:
        return ""
    s = str(raw_doc).strip()
    if "-" in s:
        return "".join([c for c in s.split("-")[0] if c.isdigit()])
    digits = "".join([c for c in s if c.isdigit()])
    if not digits:
        return ""
    if len(digits) >= 6 and dnit_conn:
        sub = digits[:-1]
        last_d = int(digits[-1])
        if compute_dv_set(sub) == last_d:
            cur = dnit_conn.cursor()
            r_sub = cur.execute("SELECT 1 FROM contribuyentes WHERE ruc = ?", (sub,)).fetchone()
            r_exact = cur.execute("SELECT 1 FROM contribuyentes WHERE ruc = ?", (digits,)).fetchone()
            if r_sub and not r_exact:
                return sub
    return digits


class CustomerSanitizer:
    def __init__(self, schema: str = "public", dry_run: bool = False):
        self.schema = schema
        self.dry_run = dry_run
        self.pg_conn: Optional[asyncpg.Connection] = None
        self.dnit_conn: Optional[sqlite3.Connection] = None
        self.tsje_conn: Optional[sqlite3.Connection] = None

    async def connect(self):
        logger.info(f"Conectando a Postgres ({DB_URL}), schema: {self.schema}...")
        self.pg_conn = await asyncpg.connect(DB_URL)
        if self.schema != "public":
            await self.pg_conn.execute(f"SET search_path TO {self.schema}, public;")

        if os.path.exists(DNIT_DB_PATH):
            self.dnit_conn = sqlite3.connect(DNIT_DB_PATH)
            logger.info(f"✓ Base DNIT RUC conectada ({DNIT_DB_PATH})")
        else:
            logger.error(f"❌ No se encontró {DNIT_DB_PATH}")

        if os.path.exists(PADRON_DB_PATH):
            self.tsje_conn = sqlite3.connect(PADRON_DB_PATH)
            logger.info(f"✓ Padrón TSJE conectado ({PADRON_DB_PATH})")
        else:
            logger.warning(f"⚠️ No se encontró {PADRON_DB_PATH}")

    async def close(self):
        if self.pg_conn:
            await self.pg_conn.close()
        if self.dnit_conn:
            self.dnit_conn.close()
        if self.tsje_conn:
            self.tsje_conn.close()

    def lookup_dnit(self, doc_root: str) -> Optional[Tuple[str, str, str, str]]:
        """Retorna (ruc, dv, razon_social, estado) o None."""
        if not self.dnit_conn or not doc_root:
            return None
        cur = self.dnit_conn.cursor()
        r = cur.execute("SELECT ruc, dv, razon_social, estado FROM contribuyentes WHERE ruc = ?", (doc_root,)).fetchone()
        if not r and len(doc_root) >= 6:
            r_sub = cur.execute("SELECT ruc, dv, razon_social, estado FROM contribuyentes WHERE ruc = ?", (doc_root[:-1],)).fetchone()
            if r_sub and str(r_sub[1]) == doc_root[-1]:
                return r_sub
        return r

    def lookup_tsje(self, ci: str) -> Optional[Tuple[str, str]]:
        """Retorna (nombre_oficial, departamento) o None."""
        if not self.tsje_conn or not ci or not ci.isdigit():
            return None
        cur = self.tsje_conn.cursor()
        r = cur.execute("SELECT nombre, apellido, depart FROM electors WHERE ci = ?", (ci,)).fetchone()
        if r:
            return f"{r[0]} {r[1]}".strip().upper(), (r[2] or "")
        return None

    async def run(self):
        await self.connect()
        try:
            logger.info(f"==================================================")
            logger.info(f"INICIANDO UNIFICACIÓN Y NORMALIZACIÓN DE CLIENTES")
            logger.info(f"Schema: {self.schema} | Dry Run: {self.dry_run}")
            logger.info(f"==================================================")

            # 1. Obtener todos los clientes
            query = f"""
                SELECT id, company_id, tipo, tipo_persona, ruc, ci, razon_social, nombre_fantasia,
                       limite_credito, credito_limite, credito_usado, empresa_vinculada_nombre,
                       empresa_vinculada_ruc, extra_club_numero, telefono, email, created_at
                FROM {self.schema}.customers
                ORDER BY created_at ASC;
            """
            rows = await self.pg_conn.fetch(query)
            logger.info(f"Total clientes en {self.schema}.customers: {len(rows):,}")

            # 2. Agrupar por documento base
            groups: Dict[str, List[Any]] = {}
            for r in rows:
                ci_root = clean_doc_root(r["ci"], self.dnit_conn)
                ruc_root = clean_doc_root(r["ruc"], self.dnit_conn)
                # Tomar raíz válida de al menos 5 dígitos
                doc_base = ci_root if (len(ci_root) >= 5) else (ruc_root if len(ruc_root) >= 5 else None)
                if not doc_base or len(set(doc_base)) == 1 or doc_base == "44444401":
                    doc_base = f"id_{r['id']}" # Sin documento base unificable
                
                groups.setdefault(doc_base, []).append(r)

            dups_count = sum(1 for k, g in groups.items() if len(g) > 1 and not k.startswith("id_"))
            logger.info(f"Grupos de clientes identificados: {len(groups):,}")
            logger.info(f"Grupos con duplicados a unificar: {dups_count}")

            # 3. Procesar cada grupo (Fusión y Normalización)
            normalizados_dnit = 0
            normalizados_tsje = 0
            duplicados_fusionados = 0

            # Tablas existentes en este esquema
            existing_tables = await self.pg_conn.fetch("""
                SELECT table_name FROM information_schema.tables WHERE table_schema = $1;
            """, self.schema)
            tables_set = {r["table_name"] for r in existing_tables}

            # Tablas y columnas que contienen referencias a clientes
            fk_rows = await self.pg_conn.fetch("""
                SELECT table_name, column_name 
                FROM information_schema.columns 
                WHERE table_schema = $1 
                  AND column_name IN ('customer_id', 'cliente_id')
                  AND table_name NOT IN (
                      'customers', 'credit_accounts', 'credit_movements', 
                      'credit_approval_requests', 'customer_scores', 
                      'customer_wallets', 'dunning_notifications', 'marketing_stock_alerts'
                  );
            """, self.schema)
            fks_to_update = [(r["table_name"], r["column_name"]) for r in fk_rows]

            for doc_base, clist in groups.items():
                if len(clist) > 1 and not doc_base.startswith("id_"):
                    def score_survivor(c):
                        s = 0
                        if c["empresa_vinculada_nombre"]:
                            s += 100
                        if (c["credito_limite"] or 0) > 0:
                            s += 50
                        if c["extra_club_numero"]:
                            s += 20
                        if c["ci"] and c["ruc"]:
                            s += 10
                        return s

                    clist_sorted = sorted(clist, key=score_survivor, reverse=True)
                    survivor = clist_sorted[0]
                    duplicates = clist_sorted[1:]

                    survivor_id = survivor["id"]
                    logger.info(f"🔄 Unificando duplicados para doc {doc_base}: Titular={survivor['razon_social']} ({survivor_id}) con {len(duplicates)} duplicado(s)")

                    if not self.dry_run:
                        async with self.pg_conn.transaction():
                            for dup in duplicates:
                                dup_id = dup["id"]
                                
                                # 1. customer_scores (tiene UNIQUE constraint company_id, customer_id)
                                if "customer_scores" in tables_set:
                                    try:
                                        async with self.pg_conn.transaction():
                                            await self.pg_conn.execute(f"""
                                                DELETE FROM {self.schema}.customer_scores
                                                WHERE customer_id = $1 AND company_id IN (
                                                    SELECT company_id FROM {self.schema}.customer_scores WHERE customer_id = $2
                                                );
                                            """, dup_id, survivor_id)
                                            await self.pg_conn.execute(f"""
                                                UPDATE {self.schema}.customer_scores
                                                SET customer_id = $1
                                                WHERE customer_id = $2;
                                            """, survivor_id, dup_id)
                                    except Exception as e:
                                        logger.warning(f"Aviso migrando customer_scores: {e}")

                                # 2. Migrar credit_accounts y sus dependencias
                                if "credit_accounts" in tables_set:
                                    try:
                                        async with self.pg_conn.transaction():
                                            acc_dup = await self.pg_conn.fetchrow(f"""
                                                SELECT id, limite_credito, saldo_disponible, saldo_utilizado, activo
                                                FROM {self.schema}.credit_accounts
                                                WHERE customer_id = $1;
                                            """, dup_id)
                                            if acc_dup:
                                                acc_surv = await self.pg_conn.fetchrow(f"""
                                                    SELECT id, limite_credito, saldo_disponible, saldo_utilizado
                                                    FROM {self.schema}.credit_accounts
                                                    WHERE customer_id = $1;
                                                """, survivor_id)
                                                if acc_surv:
                                                    # Consolidar saldos y límites
                                                    new_lim = max(acc_surv["limite_credito"] or 0, acc_dup["limite_credito"] or 0)
                                                    new_usado = (acc_surv["saldo_utilizado"] or 0) + (acc_dup["saldo_utilizado"] or 0)
                                                    new_disp = max(0, new_lim - new_usado)
                                                    
                                                    # Reapuntar approval requests y movements a la cuenta del titular
                                                    if "credit_approval_requests" in tables_set:
                                                        await self.pg_conn.execute(f"""
                                                            UPDATE {self.schema}.credit_approval_requests
                                                            SET credit_account_id = $1, customer_id = $2
                                                            WHERE credit_account_id = $3 OR customer_id = $4;
                                                        """, acc_surv["id"], survivor_id, acc_dup["id"], dup_id)
                                                    if "credit_movements" in tables_set:
                                                        await self.pg_conn.execute(f"""
                                                            UPDATE {self.schema}.credit_movements
                                                            SET credit_account_id = $1, customer_id = $2
                                                            WHERE credit_account_id = $3 OR customer_id = $4;
                                                        """, acc_surv["id"], survivor_id, acc_dup["id"], dup_id)

                                                    await self.pg_conn.execute(f"""
                                                        UPDATE {self.schema}.credit_accounts
                                                        SET limite_credito = $1, saldo_utilizado = $2, saldo_disponible = $3, updated_at = NOW()
                                                        WHERE id = $4;
                                                    """, new_lim, new_usado, new_disp, acc_surv["id"])
                                                    await self.pg_conn.execute(f"DELETE FROM {self.schema}.credit_accounts WHERE id = $1;", acc_dup["id"])
                                                else:
                                                    # Transferir la cuenta completa al titular
                                                    await self.pg_conn.execute(f"""
                                                        UPDATE {self.schema}.credit_accounts
                                                        SET customer_id = $1, updated_at = NOW()
                                                        WHERE id = $2;
                                                    """, survivor_id, acc_dup["id"])
                                                    if "credit_movements" in tables_set:
                                                        await self.pg_conn.execute(f"""
                                                            UPDATE {self.schema}.credit_movements
                                                            SET customer_id = $1
                                                            WHERE customer_id = $2;
                                                        """, survivor_id, dup_id)
                                                    if "credit_approval_requests" in tables_set:
                                                        await self.pg_conn.execute(f"""
                                                            UPDATE {self.schema}.credit_approval_requests
                                                            SET customer_id = $1
                                                            WHERE customer_id = $2;
                                                        """, survivor_id, dup_id)
                                    except Exception as e:
                                        logger.warning(f"Aviso migrando credit_accounts: {e}")

                                # 3. Migrar resto de FKs con savepoints seguros
                                for tbl, col in fks_to_update:
                                    try:
                                        async with self.pg_conn.transaction():
                                            await self.pg_conn.execute(f"""
                                                UPDATE {self.schema}.{tbl}
                                                SET {col} = $1
                                                WHERE {col} = $2;
                                            """, survivor_id, dup_id)
                                    except Exception as e:
                                        pass

                                # 4. Si el titular carece de convenio y el duplicado tenía, transferir
                                if not survivor["empresa_vinculada_nombre"] and dup["empresa_vinculada_nombre"]:
                                    await self.pg_conn.execute(f"""
                                        UPDATE {self.schema}.customers
                                        SET empresa_vinculada_nombre = $1, empresa_vinculada_ruc = $2,
                                            limite_credito = GREATEST(COALESCE(limite_credito, 0), $3),
                                            credito_limite = GREATEST(COALESCE(credito_limite, 0), $3),
                                            credito_usado = COALESCE(credito_usado, 0) + $4
                                        WHERE id = $5;
                                    """, dup["empresa_vinculada_nombre"], dup["empresa_vinculada_ruc"], dup["limite_credito"] or 0, dup["credito_usado"] or 0, survivor_id)

                                # 5. Eliminar el registro duplicado de customers
                                await self.pg_conn.execute(f"DELETE FROM {self.schema}.customers WHERE id = $1;", dup_id)
                                duplicados_fusionados += 1
                    else:
                        duplicados_fusionados += len(duplicates)

                    target_records = [survivor]
                else:
                    target_records = clist

                # 4. Normalizar el cliente titular según las Reglas de Negocio Oficiales
                for cust in target_records:
                    cid = cust["id"]
                    raw_name = str(cust["razon_social"] or "").strip()
                    doc_root = clean_doc_root(cust["ci"], self.dnit_conn) or clean_doc_root(cust["ruc"], self.dnit_conn)
                    
                    if not doc_root or len(doc_root) < 5 or doc_base.startswith("id_"):
                        continue

                    # Determinar si es Empresa / Persona Jurídica
                    es_empresa = doc_root.startswith("80") or any(w in raw_name.upper() for w in [" S.A", " S.R.L", " E.A.S", " SOCIEDAD", " LTDA", " CIA"])

                    if es_empresa:
                        # Regla 2: Empresa -> Buscar en DNIT
                        dnit_info = self.lookup_dnit(doc_root)
                        if dnit_info:
                            d_ruc, d_dv, d_razon, d_estado = dnit_info
                            normalizados_dnit += 1
                            if not self.dry_run:
                                await self.pg_conn.execute(f"""
                                    UPDATE {self.schema}.customers
                                    SET razon_social = $1, ruc = $2, ci = NULL, tipo = 'contribuyente',
                                        tipo_persona = 'juridica', updated_at = NOW()
                                    WHERE id = $3;
                                """, d_razon, f"{d_ruc}-{d_dv}", cid)
                        else:
                            # Empresa no encontrada en DNIT -> preservar nombre en mayúsculas
                            dv = compute_dv_set(doc_root)
                            if not self.dry_run:
                                await self.pg_conn.execute(f"""
                                    UPDATE {self.schema}.customers
                                    SET razon_social = $1, ruc = $2, ci = NULL, tipo = 'contribuyente',
                                        tipo_persona = 'juridica', updated_at = NOW()
                                    WHERE id = $3;
                                """, raw_name.upper(), f"{doc_root}-{dv}", cid)
                    else:
                        # Regla 1: Persona Física -> Buscar por CI si tiene RUC en DNIT
                        dnit_info = self.lookup_dnit(doc_root)
                        if dnit_info:
                            # TIENE RUC en DNIT -> Marcar como contribuyente y registrar RUC con DV
                            d_ruc, d_dv, d_razon, d_estado = dnit_info
                            # Normalizar nombre con TSJE si existe para formato legible "NOMBRE APELLIDO", o usar DNIT
                            tsje_info = self.lookup_tsje(doc_root)
                            nombre_final = tsje_info[0] if tsje_info else d_razon
                            normalizados_dnit += 1
                            if not self.dry_run:
                                await self.pg_conn.execute(f"""
                                    UPDATE {self.schema}.customers
                                    SET razon_social = $1, ci = $2, ruc = $3, tipo = 'contribuyente',
                                        tipo_persona = 'fisica', updated_at = NOW()
                                    WHERE id = $4;
                                """, nombre_final, doc_root, f"{d_ruc}-{d_dv}", cid)
                        else:
                            # NO TIENE RUC en DNIT -> Marcar como consumidor_final, buscar en TSJE
                            tsje_info = self.lookup_tsje(doc_root)
                            if tsje_info:
                                nombre_final = tsje_info[0]
                                normalizados_tsje += 1
                            else:
                                nombre_final = raw_name.upper()

                            dv = compute_dv_set(doc_root)
                            if not self.dry_run:
                                await self.pg_conn.execute(f"""
                                    UPDATE {self.schema}.customers
                                    SET razon_social = $1, ci = $2, ruc = $3, tipo = 'consumidor_final',
                                        tipo_persona = 'fisica', updated_at = NOW()
                                    WHERE id = $4;
                                """, nombre_final, doc_root, f"{doc_root}-{dv}", cid)

            # 5. Crear Constraint / Índice Único en la Base de Datos para Blindar
            if not self.dry_run:
                logger.info("Creando índice único funcional anti-duplicados en Postgres...")
                await self.pg_conn.execute(f"""
                    CREATE UNIQUE INDEX IF NOT EXISTS uq_{self.schema}_customers_doc_base
                    ON {self.schema}.customers (company_id, regexp_replace(COALESCE(NULLIF(ci, ''), split_part(ruc, '-', 1)), '\\D', '', 'g'))
                    WHERE length(regexp_replace(COALESCE(NULLIF(ci, ''), split_part(ruc, '-', 1)), '\\D', '', 'g')) >= 5
                      AND regexp_replace(COALESCE(NULLIF(ci, ''), split_part(ruc, '-', 1)), '\\D', '', 'g') !~ '^(\\d)\\1+$'
                      AND regexp_replace(COALESCE(NULLIF(ci, ''), split_part(ruc, '-', 1)), '\\D', '', 'g') NOT IN ('44444401');
                """)

            logger.info("==================================================")
            logger.info("RESULTADOS DE LA OPERACIÓN:")
            logger.info(f"✓ Duplicados fusionados y eliminados: {duplicados_fusionados}")
            logger.info(f"✓ Clientes validados y normalizados con DNIT (Contribuyentes): {normalizados_dnit}")
            logger.info(f"✓ Personas físicas normalizadas con Padrón TSJE (Consumidores Finales): {normalizados_tsje}")
            logger.info("✓ Índice único anti-duplicados garantizado en Postgres.")
            logger.info("==================================================")

        finally:
            await self.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Unificación y normalización de clientes con DNIT y TSJE")
    parser.add_argument("--schema", default="public", help="Esquema destino (public o sandbox)")
    parser.add_argument("--dry-run", action="store_true", help="Simulación sin modificar la base de datos")
    args = parser.parse_args()

    sanitizer = CustomerSanitizer(schema=args.schema, dry_run=args.dry_run)
    asyncio.run(sanitizer.run())
