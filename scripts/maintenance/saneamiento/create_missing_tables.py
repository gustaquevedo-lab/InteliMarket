"""Create all missing tables based on seed INSERT statements"""
import re
import asyncpg
import asyncio

def infer_type(name, val):
    """Infer PostgreSQL type from a Python literal string"""
    if val.startswith('Decimal('):
        return 'NUMERIC(15,2)'
    if val in ('true', 'false'):
        return 'BOOLEAN DEFAULT false'
    if val.startswith("'") and val.endswith("'"):
        v = val[1:-1]
        if len(v) > 200: return 'TEXT'
        if len(v) > 50: return 'VARCHAR(500)'
        return 'VARCHAR(100)'
    if val.replace('.','',1).replace('-','',1).isdigit():
        if '.' in val: return 'NUMERIC(15,2)'
        return 'INTEGER'
    return 'VARCHAR(100)'

async def main():
    conn = await asyncpg.connect('postgresql://intelimarket:intelimarket_dev@db:5432/intelimarket')
    existing = set()
    for r in await conn.fetch("SELECT tablename FROM pg_tables WHERE schemaname='public'"):
        existing.add(r['tablename'])
    
    content = open('/app/api/seed_supermer.py').read()
    
    # Parse each INSERT INTO block
    # Find all INSERT INTO lines and extract table name + columns + VALUES
    lines = content.split('\n')
    i = 0
    tables_created = 0
    
    while i < len(lines):
        line = lines[i]
        m = re.match(r'.*INSERT INTO (\w+) \((.*?)\)', line)
        if not m:
            i += 1
            continue
        
        table = m.group(1)
        if table in existing:
            i += 1
            continue
        
        columns = [c.strip() for c in m.group(2).split(',')]
        # Also check for multiline column list
        j = i + 1
        while ')' not in lines[j] and 'VALUES' not in lines[j]:
            j += 1
        
        if 'VALUES' not in lines[j]:
            i += 1
            continue
        
        # Get values from the VALUES line
        vals_line = lines[j]
        while ')' not in vals_line and j + 1 < len(lines):
            j += 1
            vals_line += ' ' + lines[j]
        
        # Extract value tokens
        values = []
        paren_depth = 0
        current = ''
        for ch in vals_line[vals_line.index('(')+1:]:
            if ch == '(': paren_depth += 1
            elif ch == ')': 
                if paren_depth == 0:
                    if current.strip(): values.append(current.strip())
                    break
                paren_depth -= 1
            elif ch == ',' and paren_depth == 0:
                if current.strip(): values.append(current.strip())
                current = ''
                continue
            current += ch
        
        if not values:
            i += 1
            continue
        
        # Build CREATE TABLE
        pk = 'id UUID PRIMARY KEY DEFAULT gen_random_uuid()' if 'id' in [c.lower() for c in columns] else ''
        col_defs = []
        for ci, col in enumerate(columns):
            if col.lower() == 'id':
                continue  # handled by pk
            v = values[ci] if ci < len(values) else 'NULL'
            if v.startswith('$'):
                col_defs.append(f'{col} UUID')
            elif v == 'NOW()' or col.endswith('_at'):
                col_defs.append(f'{col} TIMESTAMPTZ DEFAULT NOW()')
            else:
                col_defs.append(f'{col} {infer_type(col, v)}')
        
        sql = f'CREATE TABLE IF NOT EXISTS {table} ('
        if pk: sql += f'\n  {pk},'
        for cd in col_defs:
            sql += f'\n  {cd},'
        # Remove trailing comma and close
        sql = sql.rstrip(',') + '\n);'
        
        try:
            await conn.execute(sql)
            print(f'Created: {table}')
            existing.add(table)
            tables_created += 1
        except Exception as e:
            print(f'FAILED {table}: {e}')
        
        i += 1
    
    print(f'\nCreated {tables_created} tables')
    await conn.close()

asyncio.run(main())
