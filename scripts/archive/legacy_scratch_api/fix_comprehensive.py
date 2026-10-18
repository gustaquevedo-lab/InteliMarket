"""Apply ALL remaining fixes to seed_supermer.py"""
import re

content = open('/app/api/seed_supermer.py').read()

# Strategy: find every VALUES line that ends with $N) where $N should be NOW()
# and the VALUES line does NOT end with 'NOW())' already
# We'll use line-specific anchors to be safe.

# The fix: replace the LAST occurrence of ,$N) with ,NOW())
# but only within VALUES lines
lines = content.split('\n')

# Track which exact lines we fix
fixed_lines = set()

for i, line in enumerate(lines):
    if 'VALUES' not in line.upper():
        continue
    if line.strip().endswith('NOW())'):
        continue
    
    # Find the LAST $N that ends with )
    # Pattern: ,$N) or ,true,$N) etc
    # Use regex to find all $N followed by )
    for m in re.finditer(r',\s*\$(\d+)\s*\)', line):
        pass  # Just to get the last match
    
    # More direct: find all $N, check if line ends with the last one
    vals = re.findall(r'\$(\d+)', line)
    if not vals:
        continue
    
    last_n = int(vals[-1])
    last_str = '$' + str(last_n)
    
    # Find where the VALUES portion ends (before closing paren)
    # Look for ,$N) or ,$N,) where N is the last placeholder
    idx = line.rfind(last_str)
    if idx < 0:
        continue
    
    after = line[idx + len(last_str):].strip()
    if after.startswith(')') or after.startswith(',') or after.startswith(',\n'):
        # Check that this is not an already-fixed line
        before = line[:idx].rstrip()
        if before.endswith(',NOW()') or before.endswith('NOW()'):
            continue
        
        # Record what we're about to change
        old_suffix = line[idx:].strip()
        new_line = line[:idx] + 'NOW()' + line[idx + len(last_str):]
        
        # Verify the new line has fewer $N
        new_vals = re.findall(r'\$(\d+)', new_line)
        if len(new_vals) < len(vals):
            lines[i] = new_line
            fixed_lines.add(i + 1)
            print(f'Line {i+1}: ${last_n} -> NOW() (was: {old_suffix[:30]})')

content = '\n'.join(lines)

# Also fix the sales section
# Add missing SALE_004, SALE_005, SALE_008
# Convert string dates to datetime objects

# Sales section: add 3 missing sales
old_sales_end = '''        (SALE_003, BR_SUC1, CUST_05, "S-002-000001", "2026-05-20 11:00:00", "factura", "contado", "confirmado", Decimal("24000"), Decimal("0"), Decimal("24000"), Decimal("0"), Decimal("0"), Decimal("2400"), Decimal("0"), Decimal("26400"), Decimal("26400"), USER_OP1),
        (SALE_006, BR_SUC2, CUST_10, "S-003-000001", "2026-05-21 10:30:00", "factura", "contado", "confirmado", Decimal("18500"), Decimal("0"), Decimal("18500"), Decimal("0"), Decimal("0"), Decimal("1850"), Decimal("0"), Decimal("20350"), Decimal("20350"), USER_OP1),'''

new_sales = '''        (SALE_003, BR_SUC1, CUST_05, "S-002-000001", "2026-05-20 11:00:00", "factura", "contado", "confirmado", Decimal("24000"), Decimal("0"), Decimal("24000"), Decimal("0"), Decimal("0"), Decimal("2400"), Decimal("0"), Decimal("26400"), Decimal("26400"), USER_OP1),
        (SALE_004, BR_SUC1, CUST_09, "S-002-000004", "2026-05-20 14:00:00", "factura", "contado", "confirmado", Decimal("157000"), Decimal("0"), Decimal("157000"), Decimal("0"), Decimal("0"), Decimal("15700"), Decimal("0"), Decimal("172700"), Decimal("172700"), USER_OP1),
        (SALE_005, BR_CENTRAL, CUST_11, "S-001-000003", "2026-05-21 08:00:00", "factura", "credito", "confirmado", Decimal("659000"), Decimal("0"), Decimal("659000"), Decimal("0"), Decimal("0"), Decimal("65900"), Decimal("0"), Decimal("724900"), Decimal("400000"), USER_OP1),
        (SALE_006, BR_SUC2, CUST_10, "S-003-000001", "2026-05-21 10:30:00", "factura", "contado", "confirmado", Decimal("18500"), Decimal("0"), Decimal("18500"), Decimal("0"), Decimal("0"), Decimal("1850"), Decimal("0"), Decimal("20350"), Decimal("20350"), USER_OP1),
        (SALE_007, BR_SUC3, CUST_15, "S-004-000001", "2026-05-22 11:00:00", "factura", "contado", "confirmado", Decimal("32000"), Decimal("0"), Decimal("22000"), Decimal("10000"), Decimal("0"), Decimal("2200"), Decimal("500"), Decimal("34700"), Decimal("34700"), USER_OP1),
        (SALE_008, BR_SUC2, CUST_01, "S-003-000004", "2026-05-22 14:00:00", "factura", "contado", "confirmado", Decimal("197000"), Decimal("0"), Decimal("125000"), Decimal("72000"), Decimal("0"), Decimal("12500"), Decimal("3600"), Decimal("213100"), Decimal("213100"), USER_OP1),'''

content = content.replace(old_sales_end, new_sales)
if old_sales_end in content:
    print('Sales SALE_004/005/008 added')
else:
    print('WARNING: sales section not found for adding SALE_004/005/008')

# Fix sale_items $9 placeholder
content = content.replace(
    'VALUES ($1,$2,$3,$4,$5,$6,0,0,$7,$8,NOW(), NOW())',
    'VALUES ($1,$2,$3,$4,$5,$6,0,0,$7,$8,$9,NOW())'
)
if 'VALUES ($1,$2,$3,$4,$5,$6,0,0,$7,$8,$9,NOW())' in content:
    print('Sale items $9 fix applied')

# Fix purchase_orders date conversion
old_po = '''    for poid, supp, num, fecha, estado, subt, desc, bg10, bg5, total, fecha_est, uid in pos:
        await conn.execute("""
            INSERT INTO purchase_orders (id, company_id, supplier_id, numero, fecha, estado,
                subtotal, descuento_total, iva_10, iva_5, total,
                fecha_entrega_estimada, user_id, moneda, tipo_cambio, created_at, updated_at)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'PYG',1,NOW(), NOW())
        """, poid, COMPANY, supp, num, fecha, estado, subt, desc, bg10, bg5, total, fecha_est, uid)'''

new_po = '''    for poid, supp, num, fecha, estado, subt, desc, bg10, bg5, total, fecha_est, uid in pos:
        fecha_dt = datetime.fromisoformat(fecha)
        fecha_est_dt = datetime.fromisoformat(fecha_est) if fecha_est else None
        await conn.execute("""
            INSERT INTO purchase_orders (id, company_id, supplier_id, numero, fecha, estado,
                subtotal, descuento_total, iva_10, iva_5, total,
                fecha_entrega_estimada, user_id, moneda, tipo_cambio, created_at, updated_at)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'PYG',1,NOW(), NOW())
        """, poid, COMPANY, supp, num, fecha_dt, estado, subt, desc, bg10, bg5, total, fecha_est_dt, uid)'''

content = content.replace(old_po, new_po)
if new_po in content:
    print('Purchase orders datetime fix applied')

# Fix sales datetime conversion
old_sales_loop = '''    for sid, bid, cid, num, fecha, tcomp, cond, estado, subt, desc, bg10, bg5, be, iva10, iva5, total, tpagado, uid in sales:
        await conn.execute("""
            INSERT INTO sales (id, company_id, branch_id, customer_id, numero, fecha, tipo_comprobante,
                condicion, moneda, tipo_cambio, estado, subtotal, descuento_total,
                base_gravada_10, base_gravada_5, base_exenta, iva_10, iva_5, total, total_pagado, user_id, created_at, updated_at)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'PYG',1,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,NOW(), NOW())
        """, sid, COMPANY, bid, cid, num, fecha, tcomp, cond, estado, subt, desc, bg10, bg5, be, iva10, iva5, total, tpagado, uid)'''

new_sales_loop = '''    for sid, bid, cid, num, fecha, tcomp, cond, estado, subt, desc, bg10, bg5, be, iva10, iva5, total, tpagado, uid in sales:
        fecha_dt = datetime.fromisoformat(fecha)
        await conn.execute("""
            INSERT INTO sales (id, company_id, branch_id, customer_id, numero, fecha, tipo_comprobante,
                condicion, moneda, tipo_cambio, estado, subtotal, descuento_total,
                base_gravada_10, base_gravada_5, base_exenta, iva_10, iva_5, total, total_pagado, user_id, created_at, updated_at)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'PYG',1,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,NOW(), NOW())
        """, sid, COMPANY, bid, cid, num, fecha_dt, tcomp, cond, estado, subt, desc, bg10, bg5, be, iva10, iva5, total, tpagado, uid)'''

content = content.replace(old_sales_loop, new_sales_loop)
if new_sales_loop in content:
    print('Sales datetime fix applied')

# Write result
open('/app/api/seed_supermer.py', 'w').write(content)

try:
    compile(content, 'seed_supermer.py', 'exec')
    print('\n✅ Syntax OK')
except SyntaxError as e:
    print('\n❌ Syntax error:', e)
