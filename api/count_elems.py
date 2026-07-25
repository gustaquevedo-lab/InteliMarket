import re

content = open('/app/api/seed_supermer.py').read()

# Find the sales region to understand element count
start = content.find('# SALES (16)')
for_sid = content.find('for sid,', start)
region = content[start:for_sid]

# Parse each line and count top-level comma-separated items
lines = region.strip().split('\n')
for line in lines:
    stripped = line.strip()
    if stripped.startswith('#') or stripped.startswith(']'):
        continue
    if not stripped or stripped == 'sales = [':
        continue
    
    depth = 0
    commas = 0
    for ch in stripped:
        if ch == '(':
            depth += 1
        elif ch == ')':
            depth -= 1
        elif ch == ',' and depth == 1:
            commas += 1
    if depth >= 0 or commas > 0:
        elements = commas + 1
        # Show first 60 chars and element count
        snippet = stripped[:60]
        print(f'{elements} elements: {snippet}...')
