"""Re-apply specific fixes on top of the $N->NOW() fixes"""
import re

content = open('/app/api/seed_supermer.py').read()

# 1. Add missing sales SALE_004, SALE_005, SALE_008
old_sales = '''        (SALE_003, BR_SUC1, CUST_05, "S-002-000001", "2026-05-20 11:00:00", "factura", "contado", "confirmado", Decimal("24000"), Decimal("0"), Decimal("24000"), Decimal("0"), Decimal("0"), Decimal("2400"), Decimal("0"), Decimal("26400"), Decimal("26400"), USER_OP1),
        (SALE_006, BR_SUC2, CUST_10, "S-003-000001", "2026-05-21 10:30:00", "factura", "contado", "confirmado", Decimal("18500"), Decimal("0"), Decimal("18500"), Decimal("0"), Decimal("0"), Decimal("1850"), Decimal("0"), Decimal("20350"), Decimal("20350"), USER_OP1),'''

new_sales = '''        (SALE_003, BR_SUC1, CUST_05, "S-002-000001", "2026-05-20 11:00:00", "factura", "contado", "confirmado", Decimal("24000"), Decimal("0"), Decimal("24000"), Decimal("0"), Decimal("0"), Decimal("2400"), Decimal("0"), Decimal("26400"), Decimal("26400"), USER_OP1),
        (SALE_004, BR_SUC1, CUST_09, "S-002-000004", "2026-05-20 14:00:00", "factura", "contado", "confirmado", Decimal("157000"), Decimal("0"), Decimal("157000"), Decimal("0"), Decimal("0"), Decimal("15700"), Decimal("0"), Decimal("172700"), Decimal("172700"), USER_OP1),
        (SALE_005, BR_CENTRAL, CUST_11, "S-001-000003", "2026-05-21 08:00:00", "factura", "credito", "confirmado", Decimal("659000"), Decimal("0"), Decimal("659000"), Decimal("0"), Decimal("0"), Decimal("65900"), Decimal("0"), Decimal("724900"), Decimal("400000"), USER_OP1),
        (SALE_006, BR_SUC2, CUST_10, "S-003-000001", "2026-05-21 10:30:00", "factura", "contado", "confirmado", Decimal("18500"), Decimal("0"), Decimal("18500"), Decimal("0"), Decimal("0"), Decimal("1850"), Decimal("0"), Decimal("20350"), Decimal("20350"), USER_OP1),
        (SALE_007, BR_SUC3, CUST_15, "S-004-000001", "2026-05-22 11:00:00", "factura", "contado", "confirmado", Decimal("32000"), Decimal("0"), Decimal("22000"), Decimal("10000"), Decimal("0"), Decimal("2200"), Decimal("500"), Decimal("34700"), Decimal("34700"), USER_OP1),
        (SALE_008, BR_SUC2, CUST_01, "S-003-000004", "2026-05-22 14:00:00", "factura", "contado", "confirmado", Decimal("197000"), Decimal("0"), Decimal("125000"), Decimal("72000"), Decimal("0"), Decimal("12500"), Decimal("3600"), Decimal("213100"), Decimal("213100"), USER_OP1),'''

content = content.replace(old_sales, new_sales)
if old_sales not in content:
    print('Sales SALE_004/005/008 added')
else:
    print('WARNING: sales section unchanged - pattern not found')

# 2. Fix sale_items: add $9 placeholder for total
content = content.replace(
    'VALUES ($1,$2,$3,$4,$5,$6,0,0,$7,$8,NOW(), NOW())',
    'VALUES ($1,$2,$3,$4,$5,$6,0,0,$7,$8,$9,NOW())'
)
if 'VALUES ($1,$2,$3,$4,$5,$6,0,0,$7,$8,$9,NOW())' in content:
    print('Sale items $9 fix applied')

# 3. Add datetime conversion for sales
old_sl = '''    for sid, bid, cid, num, fecha, tcomp, cond, estado, subt, desc, bg10, bg5, be, iva10, iva5, total, tpagado, uid in sales:
        await conn.execute("""'''
new_sl = '''    for sid, bid, cid, num, fecha, tcomp, cond, estado, subt, desc, bg10, bg5, be, iva10, iva5, total, tpagado, uid in sales:
        fecha_dt = datetime.fromisoformat(fecha)
        await conn.execute("""'''
content = content.replace(old_sl, new_sl)
if new_sl in content:
    print('Sales datetime fix applied')

# 4. Replace fecha with fecha_dt in sales params call
content = content.replace(', sid, COMPANY, bid, cid, num, fecha, tcomp, cond, estado, subt, desc, bg10, bg5, be, iva10, iva5, total, tpagado, uid)',
    ', sid, COMPANY, bid, cid, num, fecha_dt, tcomp, cond, estado, subt, desc, bg10, bg5, be, iva10, iva5, total, tpagado, uid)')
if 'fecha_dt' in content:
    print('Sales fecha_dt param fix applied')

# 5. Add datetime conversion for purchase_orders
old_po = '''    for poid, supp, num, fecha, estado, subt, desc, bg10, bg5, total, fecha_est, uid in pos:
        await conn.execute("""'''
new_po = '''    for poid, supp, num, fecha, estado, subt, desc, bg10, bg5, total, fecha_est, uid in pos:
        fecha_dt = datetime.fromisoformat(fecha)
        fecha_est_dt = datetime.fromisoformat(fecha_est) if fecha_est else None
        await conn.execute("""'''
content = content.replace(old_po, new_po)
if new_po in content:
    print('PO datetime fix applied')

# 6. Replace fecha/fecha_est in PO params
content = content.replace(
    ', poid, COMPANY, supp, num, fecha, estado, subt, desc, bg10, bg5, total, fecha_est, uid)',
    ', poid, COMPANY, supp, num, fecha_dt, estado, subt, desc, bg10, bg5, total, fecha_est_dt, uid)'
)
if 'fecha_est_dt' in content:
    print('PO fecha_dt param fix applied')

# 7. Fix stock line (costo_unitario shouldn't be NOW())
old_stock = '            VALUES ($1,$2,$3,0,NOW(), NOW())'
new_stock = '            VALUES ($1,$2,$3,0,$4,NOW())'
content = content.replace(old_stock, new_stock)
if new_stock in content:
    print('Stock costo_unitario fix applied')

open('/app/api/seed_supermer.py', 'w').write(content)
try:
    compile(content, 'seed_supermer.py', 'exec')
    print('\n✅ Syntax OK')
except SyntaxError as e:
    print('\n❌ Syntax error:', e)
