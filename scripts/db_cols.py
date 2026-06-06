import subprocess
import sys

# Get all sv_* tables
r = subprocess.run(['docker', 'exec', '-e', 'PGPASSWORD=intelimarket_dev', 'intelimarket-db',
                    'psql', '-U', 'intelimarket', '-d', 'intelimarket', '-t', '-A', '-F', '|',
                    '-c', "SELECT table_name FROM information_schema.tables WHERE table_name LIKE 'sv_%' ORDER BY table_name"],
                   capture_output=True, text=True)
tables = [t.strip() for t in r.stdout.split('\n') if t.strip()]

# Get columns for each
for table in tables:
    r2 = subprocess.run(['docker', 'exec', '-e', 'PGPASSWORD=intelimarket_dev', 'intelimarket-db',
                        'psql', '-U', 'intelimarket', '-d', 'intelimarket', '-t', '-A', '-F', '|',
                        '-c', f"SELECT column_name FROM information_schema.columns WHERE table_name='{table}' ORDER BY ordinal_position"],
                       capture_output=True, text=True)
    cols = [c.strip() for c in r2.stdout.split('\n') if c.strip()]
    print(f"-- {table}")
    for c in cols:
        print(f"  {c}")
