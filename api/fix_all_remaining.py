"""Fix all remaining $N that should be NOW() in seed_supermer.py"""
import re

content = open('/app/api/seed_supermer.py').read()

# Strategy: Find all conn.execute(...) calls, extract query and params,
# count $N vs param count. If the last $N exceeds param count, replace it.

# Simpler: just find patterns like ,$N) OR ,$N,NOW()) etc where 
# $N is the last placeholder and likely should be NOW()

# List of replacements (line-specific fixes based on manual analysis)
# Format: (pattern_to_find, replacement)
fixes = [
    # Bank transactions
    (",$5)\n    \"\"\", bt_1, COMPANY, BA_001, TODAY)",
     ",NOW())\n    \"\"\", bt_1, COMPANY, BA_001, TODAY)"),
    (",$5)\n    \"\"\", bt_2, COMPANY, BA_001, TODAY)",
     ",NOW())\n    \"\"\", bt_2, COMPANY, BA_001, TODAY)"),
    
    # Cash flow
    (",$4)\n    \"\"\", cfid, COMPANY, datetime.fromisoformat(d))",
     ",NOW())\n    \"\"\", cfid, COMPANY, datetime.fromisoformat(d))"),
    
    # Commission rules already fixed
    
    # Supplier evaluations
    (",$4)\n    \"\"\", seval, COMPANY, SUPP_01)",
     ",NOW())\n    \"\"\", seval, COMPANY, SUPP_01)"),
    (",$5)\n    \"\"\", sph, COMPANY, SUPP_01, P_001)",
     ",NOW())\n    \"\"\", sph, COMPANY, SUPP_01, P_001)"),
    
    # Stock counts
    (",$6)\n    \"\"\", sc_1, COMPANY, SUPP_01, P_001, TODAY)",
     ",NOW())\n    \"\"\", sc_1, COMPANY, SUPP_01, P_001, TODAY)"),
    
    # Purchase forecasts
    (",$5)\n    \"\"\", pf_1, COMPANY, P_001, TODAY)",
     ",NOW())\n    \"\"\", pf_1, COMPANY, P_001, TODAY)"),
    
    # PO status changes
    (",$4)\n    \"\"\", poid, old_st, new_st)",
     ",NOW())\n    \"\"\", poid, old_st, new_st)"),
    
    # Scale config items
    (",$4)\n    \"\"\", sci_1, scont, P_001)",
     ",NOW())\n    \"\"\", sci_1, scont, P_001)"),
    (",$4)\n    \"\"\", sci_2, scont, P_002)",
     ",NOW())\n    \"\"\", sci_2, scont, P_002)"),
    
    # WhatsApp conversations  
    (",$4)\n    \"\"\", wa_conv, TENANT)",
     ",NOW())\n    \"\"\", wa_conv, TENANT)"),
    (",$4)\n    \"\"\", wa_msg_1, TENANT, wa_conv)",
     ",NOW())\n    \"\"\", wa_msg_1, TENANT, wa_conv)"),
    (",$4)\n    \"\"\", wa_msg_2, TENANT, wa_conv)",
     ",NOW())\n    \"\"\", wa_msg_2, TENANT, wa_conv)"),
    
    # Promo usage
    (",$7)\n    \"\"\", pu_1, prom_1, COMPANY, SALE_005, CUST_06, BR_CENTRAL)",
     ",NOW())\n    \"\"\", pu_1, prom_1, COMPANY, SALE_005, CUST_06, BR_CENTRAL)"),
    
    # Markdown
    (",$6)\n    \"\"\", md_1, COMPANY, P_018, datetime.fromisoformat(now_ts), USER_OP1)",
     ",NOW())\n    \"\"\", md_1, COMPANY, P_018, datetime.fromisoformat(now_ts), USER_OP1)"),
    
    # Receipt adjustment
    (",$4)\n    \"\"\", ar_1, ca3, SUPP_01)",
     ",NOW())\n    \"\"\", ar_1, ca3, SUPP_01)"),
    
    # Timbrado usage
    (",$5)\n    \"\"\", tu_1, TIMBRADO, COMPANY, SALE_001)",
     ",NOW())\n    \"\"\", tu_1, TIMBRADO, COMPANY, SALE_001)"),
    (",$5)\n    \"\"\", tu_2, TIMBRADO, COMPANY, SALE_002)",
     ",NOW())\n    \"\"\", tu_2, TIMBRADO, COMPANY, SALE_002)"),
    
    # Purchase request items
    (",$4)\n    \"\"\", preq_i1, preq_1, P_018)",
     ",NOW())\n    \"\"\", preq_i1, preq_1, P_018)"),
    
    # Supplier evaluations (cont)
    (",$4)\n    \"\"\", se_2, COMPANY, SUPP_02)",
     ",NOW())\n    \"\"\", se_2, COMPANY, SUPP_02)"),
    (",$4)\n    \"\"\", se_3, COMPANY, SUPP_05)",
     ",NOW())\n    \"\"\", se_3, COMPANY, SUPP_05)"),
    
    # Financing
    (",$5)\n    \"\"\", fin_1, COMPANY, CUST_01, SALE_004)",
     ",NOW())\n    \"\"\", fin_1, COMPANY, CUST_01, SALE_004)"),
    (",$5)\n    \"\"\", fiid, fin_1, datetime.fromisoformat(cuota), datetime.fromisoformat(fv))",
     ",NOW())\n    \"\"\", fiid, fin_1, datetime.fromisoformat(cuota), datetime.fromisoformat(fv))"),
    
    # Customer wallet
    (",$4)\n    \"\"\", cw_1, COMPANY, CUST_06)",
     ",NOW())\n    \"\"\", cw_1, COMPANY, CUST_06)"),
]

count = 0
for old, new in fixes:
    if old in content:
        content = content.replace(old, new)
        count += 1
        print(f'Fixed: {old[:60]}...')
    else:
        print(f'NOT FOUND: {old[:60]}...')

open('/app/api/seed_supermer.py', 'w').write(content)
print(f'\nTotal: {count} fixes applied')
