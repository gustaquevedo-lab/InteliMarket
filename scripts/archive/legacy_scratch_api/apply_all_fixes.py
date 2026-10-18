"""Apply ALL fixes to seed_supermer.py at once."""
import re

content = open('/app/api/seed_supermer.py').read()
changes = 0

# ============================================================
# FIX 1: Replace all duplicate $N, $N) at end of VALUES lines
# with NOW(), NOW())
# ============================================================
content, n = re.subn(r'\$(\d+),\s*\$(\d+)\)\s*$', 'NOW(), NOW())', content, flags=re.MULTILINE)
changes += n
print('Fix 1 (duplicate $N at end): {}'.format(n))

# ============================================================
# FIX 2: Replace specific parameter count mismatches
# Pattern: VALUES has $N but fewer params passed
# ============================================================

# 2a. payments: $4, $4 with 3 params → NOW(), NOW()
content, n = re.subn(
    r'VALUES \(\$1,\$2,\$3,500000,\$4,\'abierta\',\$4\)',
    'VALUES ($1,$2,$3,500000,NOW(),\'abierta\',NOW())',
    content
)
changes += n
print('Fix 2a (cash_sessions): {}'.format(n))

# 2b. exchange_rates: NOW(), NOW() with extra TODAY param
content, n = re.subn(
    r'VALUES \(\$1,\$2,\'USD\',7400,7480,\'bcp\',NOW\(\), NOW\(\)\)\n    """, ER_001, COMPANY, TODAY',
    'VALUES ($1,$2,\'USD\',7400,7480,\'bcp\',$3,NOW())\n    """, ER_001, COMPANY, TODAY',
    content
)
changes += n
print('Fix 2b (exchange USD): {}'.format(n))

content, n = re.subn(
    r'VALUES \(\$1,\$2,\'BRL\',1350,1420,\'bcp\',NOW\(\), NOW\(\)\)\n    """, ER_002, COMPANY, TODAY',
    'VALUES ($1,$2,\'BRL\',1350,1420,\'bcp\',$3,NOW())\n    """, ER_002, COMPANY, TODAY',
    content
)
changes += n
print('Fix 2c (exchange BRL): {}'.format(n))

# 2d. sifen: $4 should be NOW()
content, n = re.subn(
    r'VALUES \(\$1,\$2,\'12345678\',\$3,\'2027-05-25\',1,9999,\'factura\',true,\$4\)',
    'VALUES ($1,$2,\'12345678\',$3,\'2027-05-25\',1,9999,\'factura\',true,NOW())',
    content
)
changes += n
print('Fix 2d (sifen): {}'.format(n))

# 2e. fiscal_config: $3 should be NOW()
content, n = re.subn(
    r'VALUES \(\$1,\'sifen\',\$2,\'001\',\$3,NOW\(\)\)',
    'VALUES ($1,\'sifen\',$2,\'001\',NOW(),NOW())',
    content
)
changes += n
print('Fix 2e (fiscal_config): {}'.format(n))

# 2f. route_customers: $4 should be NOW()
content, n = re.subn(
    r'VALUES \(\$1,\$2,\$3,1,1,\$4\)\n    """, RC_001, ROUTE_001, CUST_01',
    'VALUES ($1,$2,$3,1,1,NOW())\n    """, RC_001, ROUTE_001, CUST_01',
    content
)
changes += n
print('Fix 2f (route_cust 1): {}'.format(n))

content, n = re.subn(
    r'VALUES \(\$1,\$2,\$3,2,1,\$4\)\n    """, RC_002, ROUTE_001, CUST_03',
    'VALUES ($1,$2,$3,2,1,NOW())\n    """, RC_002, ROUTE_001, CUST_03',
    content
)
changes += n
print('Fix 2g (route_cust 2): {}'.format(n))

content, n = re.subn(
    r'VALUES \(\$1,\$2,\$3,1,2,\$4\)\n    """, RC_003, ROUTE_002, CUST_05',
    'VALUES ($1,$2,$3,1,2,NOW())\n    """, RC_003, ROUTE_002, CUST_05',
    content
)
changes += n
print('Fix 2h (route_cust 3): {}'.format(n))

# ============================================================
# FIX 3: Fix specific column issues
# ============================================================

# 3a. cash_sessions: register_id → cash_register_id
content, n = re.subn(
    r'INSERT INTO cash_sessions \(id, register_id, user_id,',
    'INSERT INTO cash_sessions (id, cash_register_id, user_id,',
    content
)
changes += n
print('Fix 3a (cash_sessions col): {}'.format(n))

# 3b. sales: need to fix tuple unpacking - remove duplicate Decimal

# ============================================================
# FIX 4: Fix sales tuples - remove duplicate tpagado values
# Pattern: two identical decimal values before USER_OP1
# Need to keep only the first one
# ============================================================

# For each line with USER_OP1 in a sale tuple, find the last 3 values
# before USER_OP1. Keep the first of the last two Decimal values.
lines = content.split('\n')
fixed_lines = []
fix4_count = 0

for line in lines:
    if 'USER_OP1' in line and line.strip().startswith('(SALE'):
        # Find the user_op1 position
        idx = line.rfind('USER_OP1')
        before = line[:idx].rstrip(', ')
        # Extract the last 2 decimal values before USER_OP1
        parts = before.split(', ')
        if len(parts) >= 2:
            last_two = parts[-2:]
            # Check if they're both Decimal with the same value
            m1 = re.match(r'Decimal\("(\d+)"\)', last_two[0])
            m2 = re.match(r'Decimal\("(\d+)"\)', last_two[1])
            if m1 and m2 and m1.group(1) == m2.group(1):
                # Duplicate! Remove the last one
                fixed = ', '.join(parts[:-1]) + ', USER_OP1)'
                fixed_lines.append(fixed)
                fix4_count += 1
                print('  Fixed sale tuple duplicate')
            else:
                fixed_lines.append(line)
        else:
            fixed_lines.append(line)
    else:
        fixed_lines.append(line)

if fix4_count:
    changes += fix4_count
    content = '\n'.join(fixed_lines)
    print('Fix 4 (sales duplicates): {}'.format(fix4_count))

# Save
open('/app/api/seed_supermer.py', 'w').write(content)
print('\nTotal fixes applied: {}'.format(changes))
