"""Remove 8th Decimal from each sales tuple"""
import re

content = open('/app/api/seed_supermer.py').read()
lines = content.split('\n')
count = 0

for i, line in enumerate(lines):
    if 'SALE_' not in line or 'Decimal' not in line or not line.strip().startswith('('):
        continue
    vals = re.findall(r'Decimal\("[0-9]+"\)', line)
    if len(vals) != 10:
        continue
    # Remove 8th Decimal (index 7) which is the extra between iva5 and total
    target = vals[7]
    # Must be ", Decimal("0"), " pattern
    pattern = ', ' + target + ', '
    new_line = line.replace(pattern, ', ', 1)
    if new_line != line:
        lines[i] = new_line
        count += 1
        print(f'Line {i+1}: removed {target}')

content = '\n'.join(lines)
open('/app/api/seed_supermer.py', 'w').write(content)
print(f'\nFixed {count} lines')
# Verify
try:
    compile(content, 'seed_supermer.py', 'exec')
    print('Syntax OK!')
except SyntaxError as e:
    print(f'Syntax error: {e}')
