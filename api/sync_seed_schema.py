"""Sync DB schema to match seed INSERT column lists."""
import re, sys
try:
    import psycopg2
except ImportError:
    print("psycopg2 not available, trying asyncpg...")
    import asyncpg
    import asyncio

DSN = "postgresql://intelimarket:intelimarket_dev@db:5432/intelimarket"

if 'psycopg2' in sys.modules:
    conn = psycopg2.connect(DSN)
    cur = conn.cursor()
    
    # Get all tables
    cur.execute("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename")
    tables = {r[0] for r in cur.fetchall()}
    
    # Get columns for each table
    tables_info = {}
    for t in tables:
        cur.execute("SELECT column_name FROM information_schema.columns WHERE table_name=%s AND table_schema='public' ORDER BY ordinal_position", (t,))
        tables_info[t] = {r[0] for r in cur.fetchall()}
    
    # Parse seed INSERT statements
    with open('/app/api/seed_supermer.py') as f:
        content = f.read()
    
    inserts = re.finditer(r"INSERT INTO (\w+)\s+\(([^)]+)\)\s*VALUES", content)
    
    fixes = 0
    for m in inserts:
        table = m.group(1)
        cols_str = m.group(2)
        col_names = [c.strip() for c in cols_str.split(',')]
        
        if table not in tables_info:
            print(f"SKIP {table}: not found")
            continue
        
        existing = tables_info[table]
        missing = [c for c in col_names if c not in existing]
        
        for col in missing:
            try:
                cur.execute(f'ALTER TABLE "{table}" ADD COLUMN IF NOT EXISTS "{col}" TEXT')
                fixes += 1
                print(f"  ADDED {table}.{col}")
            except Exception as e:
                print(f"  FAIL {table}.{col}: {e}")
    
    conn.commit()
    cur.close()
    conn.close()
    print(f"\nFixed {fixes} missing columns")
else:
    # asyncpg version
    async def main():
        conn = await asyncpg.connect(DSN)
        
        # Get all tables
        rows = await conn.fetch("SELECT tablename FROM pg_tables WHERE schemaname='public'")
        tables = {r['tablename'] for r in rows}
        
        # Get columns for each table
        tables_info = {}
        for t in tables:
            rows = await conn.fetch("SELECT column_name FROM information_schema.columns WHERE table_name=$1 AND table_schema='public' ORDER BY ordinal_position", t)
            tables_info[t] = {r['column_name'] for r in rows}
        
        with open('/app/api/seed_supermer.py') as f:
            content = f.read()
        
        inserts = re.finditer(r"INSERT INTO (\w+)\s+\(([^)]+)\)\s*VALUES", content)
        
        fixes = 0
        for m in inserts:
            table = m.group(1)
            cols_str = m.group(2)
            col_names = [c.strip() for c in cols_str.split(',')]
            
            if table not in tables_info:
                print(f"SKIP {table}: not found")
                continue
            
            existing = tables_info[table]
            missing = [c for c in col_names if c not in existing]
            
            for col in missing:
                try:
                    await conn.execute(f'ALTER TABLE "{table}" ADD COLUMN IF NOT EXISTS "{col}" TEXT')
                    fixes += 1
                    print(f"  ADDED {table}.{col}")
                except Exception as e:
                    print(f"  FAIL {table}.{col}: {e}")
        
        await conn.close()
        print(f"\nFixed {fixes} missing columns")
    
    asyncio.run(main())
