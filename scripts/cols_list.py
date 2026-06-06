import re
with open('/app/api/src/servicios/models.py') as f:
    m = f.read()
pattern = re.compile(r'class (\w+)\(Base\):\s*\n\s*__tablename__\s*=\s*"([^"]+)"\s*\n(.*?)(?=\nclass |\Z)', re.DOTALL)
matches = pattern.findall(m)
for cls, table, body in matches:
    cols = re.findall(r'(\w+)\s*=\s*Column\(', body)
    if cols:
        print(f"-- {table}")
        for c in cols:
            print(f"  {c}")
