#!/usr/bin/env python3
"""
Auditoría Exhaustiva de Conexiones de Base de Datos y Modelos ORM
para todos los módulos de InteliMarket Distribuidora.
"""

import sys
import os
import asyncio
import importlib
from pathlib import Path
from decimal import Decimal
import uuid

# Configurar zona horaria y path
os.environ['TZ'] = 'America/Asuncion'
sys.path.insert(0, '/home/intellihouse/intelimarket')

from sqlalchemy import text, inspect
from api.src.db import engine, async_session_factory
from api.src.config import settings

COMPANY_ID = uuid.UUID("00000000-0000-0000-0000-000000000010")


async def run_audit():
    print("=" * 80)
    print("INICIANDO AUDITORÍA INTEGRAL DE CONEXIÓN A BASE DE DATOS")
    print(f"DATABASE_URL: {settings.database_url.split('@')[-1] if '@' in settings.database_url else 'local'}")
    print(f"TIMEZONE: {os.environ.get('TZ')}")
    print("=" * 80)

    # 1. Probar conectividad base
    async with async_session_factory() as session:
        try:
            r = await session.execute(text("SELECT current_database(), current_user, inet_server_addr(), inet_server_port(), version()"))
            db_info = r.fetchone()
            print(f"Conexión exitosa a DB: {db_info[0]} | Usuario: {db_info[1]} | Servidor: {db_info[2]}:{db_info[3]}")
        except Exception as e:
            print(f"FATAL: Error al conectar a PostgreSQL: {e}")
            return

        # 2. Obtener todas las tablas y columnas reales en PostgreSQL
        r_tables = await session.execute(text("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
        """))
        real_tables = set(row[0] for row in r_tables.fetchall())
        print(f"Total de tablas físicas en esquema 'public': {len(real_tables)}")

        r_cols = await session.execute(text("""
            SELECT table_name, column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_schema = 'public'
        """))
        real_columns = {}
        for row in r_cols.fetchall():
            t, c, dt, n = row[0], row[1], row[2], row[3]
            if t not in real_columns:
                real_columns[t] = {}
            real_columns[t][c] = {"type": dt, "nullable": n}

    # 3. Importar dinámicamente todos los módulos models.py
    api_src = Path("/home/intellihouse/intelimarket/api/src")
    discovered_models = []
    import_errors = []

    for mod_dir in sorted(api_src.iterdir()):
        if not mod_dir.is_dir() or mod_dir.name.startswith(('.', '__')):
            continue
        models_file = mod_dir / "models.py"
        if models_file.exists():
            mod_name = f"api.src.{mod_dir.name}.models"
            try:
                mod = importlib.import_module(mod_name)
                discovered_models.append((mod_dir.name, mod))
            except Exception as e:
                import_errors.append((mod_dir.name, str(e)))

    print(f"\nMódulos con models.py escaneados: {len(discovered_models)}")
    if import_errors:
        print(f"⚠️ Módulos con error de importación ({len(import_errors)}):")
        for m, err in import_errors:
            print(f"  - {m}: {err}")

    # 4. Verificar cada clase ORM contra la BD real
    print("\n" + "=" * 80)
    print("VERIFICACIÓN DE TABLAS Y COLUMNAS ORM vs POSTGRESQL REAL")
    print("=" * 80)

    missing_tables = []
    missing_columns = []
    ok_tables = []

    for mod_name, mod in discovered_models:
        for attr_name in dir(mod):
            attr = getattr(mod, attr_name)
            if hasattr(attr, "__tablename__") and isinstance(getattr(attr, "__tablename__"), str):
                t_name = attr.__tablename__
                if t_name not in real_tables:
                    missing_tables.append((mod_name, attr_name, t_name))
                else:
                    # Chequear columnas
                    t_cols = real_columns.get(t_name, {})
                    mapper = inspect(attr)
                    mod_missing_cols = []
                    for col in mapper.columns:
                        col_name = col.key or col.name
                        if col_name not in t_cols:
                            mod_missing_cols.append(col_name)
                    if mod_missing_cols:
                        missing_columns.append((mod_name, attr_name, t_name, mod_missing_cols))
                    else:
                        ok_tables.append((mod_name, attr_name, t_name))

    print(f"Tablas ORM perfectamente sincronizadas: {len(ok_tables)}")
    
    if missing_tables:
        print(f"\n🚨 TABLAS INEXISTENTES EN POSTGRESQL ({len(missing_tables)}):")
        for mod_name, cls_name, t_name in missing_tables:
            print(f"  ❌ [{mod_name}] {cls_name} -> tabla '{t_name}' NO EXISTE en la BD")

    if missing_columns:
        print(f"\n🚨 COLUMNAS DISCORDANTES / FALTANTES ({len(missing_columns)}):")
        for mod_name, cls_name, t_name, cols in missing_columns:
            print(f"  ⚠️ [{mod_name}] {cls_name} (tabla '{t_name}') -> columnas faltantes: {cols}")

    # 5. Probar consultas SELECT reales en cada tabla encontrada
    print("\n" + "=" * 80)
    print("PROBANDO CONSULTAS SELECT EN VIVO EN CADA TABLA")
    print("=" * 80)

    query_errors = []
    table_counts = {}

    async with async_session_factory() as session:
        for mod_name, cls_name, t_name in ok_tables:
            try:
                r = await session.execute(text(f"SELECT count(*) FROM {t_name}"))
                cnt = r.scalar()
                table_counts[t_name] = cnt
            except Exception as e:
                query_errors.append((t_name, str(e)))

    print(f"Tablas con SELECT exitoso: {len(table_counts)}")
    if query_errors:
        print(f"🚨 ERRORES EN SELECT ({len(query_errors)}):")
        for t, err in query_errors:
            print(f"  ❌ {t}: {err}")

    # Tablas clave con conteo de filas
    print("\n📊 REGISTROS EN TABLAS OPERATIVAS PRINCIPALES:")
    key_tables = [
        "sales", "sale_items", "products", "customers", "suppliers", 
        "inventory", "accounts_receivable", "supplier_invoices",
        "supplier_kpi_periods", "supplier_kpi_indicators", "sales_targets",
        "commercial_agreements", "product_kits", "delivery_notes",
        "cash_registers", "cajas", "users"
    ]
    for kt in key_tables:
        count = table_counts.get(kt, "NO_EXISTE")
        print(f"  • {kt:<25}: {count}")

    # 6. Auditar estado de sincronización legacy
    print("\n" + "=" * 80)
    print("AUDITORÍA DE CONECTORES Y CRONS LEGACY (CASA GONZALITO)")
    print("=" * 80)
    
    # Revisar cron
    os.system("crontab -l | grep -E 'sync|gonzalito|intelimarket' || echo 'No hay crons de usuario'")


if __name__ == "__main__":
    asyncio.run(run_audit())
