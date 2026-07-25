content = open('/app/api/seed_supermer.py').read()

# Re-apply all fixes from scratch
fixes = {
    '            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true, $10, $10)\n        """, bid, COMPANY, cod, nombre, dir, ciudad, depto, tel, pe)': 
    '            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true, NOW(), NOW())\n        """, bid, COMPANY, cod, nombre, dir, ciudad, depto, tel, pe)',
    
    '            VALUES ($1, $2, $3, $4, $5, $6, $7, true, $8)\n        """, wid, COMPANY, bid, cod, nom, dir, tipo)':
    '            VALUES ($1, $2, $3, $4, $5, $6, $7, true, NOW())\n        """, wid, COMPANY, bid, cod, nom, dir, tipo)',
    
    '            VALUES ($1, $2, $3, $4, true, $5)\n        """, cid, COMPANY, nom, cod)':
    '            VALUES ($1, $2, $3, $4, true, NOW())\n        """, cid, COMPANY, nom, cod)',
}

count = 0
for old, new in fixes.items():
    if old in content:
        content = content.replace(old, new)
        count += 1
        print('Fixed: {}'.format(old[:60]))
    else:
        print('NOT FOUND: {}'.format(old[:60]))

open('/app/api/seed_supermer.py', 'w').write(content)
print('Total fixes: {}'.format(count))
