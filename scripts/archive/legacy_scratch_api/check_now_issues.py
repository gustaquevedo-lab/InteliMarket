"""Find lines where NOW(), NOW() is at end but args mismatch"""
import re

content = open('/app/api/seed_supermer.py').read()
lines = content.split('\n')
issues = []

for i, line in enumerate(lines):
    if 'await conn.execute' not in line:
        continue
    if '"""' not in line:
        continue
    
    # Collect all lines until )""", 
    sql = ''
    j = i
    vals_started = False
    while j < len(lines):
        l = lines[j]
        sql += l + '\n'
        if '"""' in l:
            if not vals_started:
                vals_started = True
            else:
                break
        j += 1
    
    if not sql.strip():
        continue
    
    # Find the arg line
    k = j + 1
    while k < len(lines) and '""",' not in lines[k]:
        k += 1
    if k >= len(lines):
        continue
    
    arg_line = lines[k]
    args_str = arg_line.split('""",', 1)[1].strip().rstrip(')')
    if not args_str:
        continue
    
    # Count args
    paren_depth = 0
    args = []
    current = ''
    for ch in args_str:
        if ch == '(':
            paren_depth += 1
            current += ch
        elif ch == ')':
            paren_depth -= 1
            current += ch
        elif ch == ',' and paren_depth == 0:
            if current.strip(): args.append(current.strip())
            current = ''
        else:
            current += ch
    if current.strip() and current.strip() != ')':
        args.append(current.strip().rstrip(')'))
    
    # Count unique placeholders in VALUES line
    vals_section = ''
    for l in lines[i:j+1]:
        vals_section += l + '\n'
    
    placeholders = re.findall(r'\$(\d+)', vals_section)
    unique_ph = set(placeholders)
    
    # Check if the VALUES ends with NOW(), NOW())
    if 'NOW(), NOW())' in sql and len(unique_ph) < len(args):
        issues.append((i+1, len(unique_ph), len(args), unique_ph, args_str[:60]))

for line_no, n_ph, n_args, ph, args_s in issues:
    print(f'Line {line_no}: {n_ph} placeholders vs {n_args} args — {sorted(ph, key=int)} — {args_s}')
