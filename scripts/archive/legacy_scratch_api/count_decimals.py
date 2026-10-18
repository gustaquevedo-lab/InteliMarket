"""Remove extra Decimal from sales tuples"""
import re

content = open('/app/api/seed_supermer.py').read()
lines = content.split('\n')
count = 0

for i, line in enumerate(lines):
    if 'SALE_' not in line or 'Decimal' not in line or not line.strip().startswith('('):
        continue
    vals = re.findall(r'Decimal\("[0-9]+"\)', line)
    if len(vals) == 11:
        print(f'Line {i+1}: 11 Dec values: {vals}')
    if len(vals) == 10:
        print(f'Line {i+1}: 10 Dec values (CORRECT): {vals}')

print(f'\nTotal lines with sales: {count}')
