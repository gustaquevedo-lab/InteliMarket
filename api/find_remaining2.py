import re

content = open('/app/api/seed_supermer.py').read()

# Simple approach: Find all patterns like `,$N)` in VALUES context 
# where $N could be replaced with NOW()
fixes = []
for m in re.finditer(r',\s*\$(\d+)\)', content):
    line_num = content[:m.start()].count('\n') + 1
    before = content[max(0, m.start()-200):m.start()]
    after = content[m.end():m.end()+200]
    param_line = content[content.rfind('"""', 0, m.start()) + 3:]
    param_line = param_line[param_line.find('"""') + 3:].strip().split('\n')[0]
    if param_line.startswith('"""') or param_line.startswith("'''"):
        continue
    
    # Count actual params
    p = param_line.strip()
    depth = 0
    commas = 0
    for ch in p:
        if ch == '(':
            depth += 1
        elif ch == ')':
            depth -= 1
        elif ch == ',' and depth == 0:
            commas += 1
    param_count = commas + 1
    
    # Check if in a VALUES context and this is the last $N
    if 'VALUES' in content[m.start()-200:m.start()].upper():
        print(f'Line {line_num}: ${m.group(1)} with {param_count} params: {param_line.strip()[:60]}')
