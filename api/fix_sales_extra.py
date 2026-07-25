"""Remove extra Decimal("0") from sales tuples (between iva5 and total)"""
import re

content = open('/app/api/seed_supermer.py').read()
lines = content.split('\n')
count = 0

for i, line in enumerate(lines):
    if 'SALE_' not in line or 'Decimal' not in line or not line.strip().startswith('('):
        continue
    # Find the pattern: Decimal("..."), Decimal("...") - two consecutive values
    # where the second is the extra one between iva5 and total
    # Pattern:  iva5_value, Decimal("0"), total_value, tpagado_value, USER_OP
    m = re.search(r'Decimal\("[0-9]+"\), Decimal\("0"\), Decimal\("[0-9]+"\), USER_OP', line)
    if m:
        # Replace 2 Dec + USER_OP with 1 Dec + USER_OP (remove the middle one)
        # But first we need to identify which Decimal is iva5 vs extra
        # All tuples have format: ... , Decimal("X"), Decimal("0"), Decimal("Y"), Decimal("Z"), USER_OP
        # where X=iva5, 0=extra, Y=total, Z=tpagado
        vals = re.findall(r'Decimal\("[^"]+"\)', line)
        if len(vals) >= 9:
            # Check if vals[-4] is the extra one (0 between iva5 and total)
            if vals[-4] == 'Decimal("0")':
                # Remove it
                old = ', ' + vals[-4]
                line = line.replace(old + ', ', ', ', 1)
                lines[i] = line
                count += 1
                print(f'Line {i+1}: removed extra Decimal("0")')

content = '\n'.join(lines)
open('/app/api/seed_supermer.py', 'w').write(content)
print(f'\nFixed {count} lines')
