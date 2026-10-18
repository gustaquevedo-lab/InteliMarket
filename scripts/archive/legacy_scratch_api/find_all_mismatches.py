"""Find all remaining $N mismatches in seed"""
import re

content = open('/app/api/seed_supermer.py').read()
lines = content.split('\n')

for i, line in enumerate(lines):
    m = re.match(r'.*await conn\.execute\(.*"""', line)
    if not m:
        continue
    
    # Found an execute block, collect the SQL and args
    sql = ''
    j = i + 1
    while j < len(lines):
        if lines[j].strip() == '"""' or '"""' in lines[j]:
            sql += '\n'.join(lines[i+1:j+1])
            break
        j += 1
    
    if j >= len(lines):
        continue
    
    # Get the arg line
    k = j + 1
    while k < len(lines) and not lines[k].strip().startswith('"""'):
        k += 1
    if k < len(lines):
        arg_line = lines[j+1] if j+1 < len(lines) else ''
        if '""",' in (lines[j+1] if j+1 < len(lines) else ''):
            pass  # arg line is next
        else:
            continue
        arg_line = lines[j+1]
    else:
        continue
    
    if '""",' not in arg_line:
        continue
    
    # Count placeholders
    placeholders = re.findall(r'\$(\d+)', sql)
    unique_placeholders = set(placeholders)
    
    # Count args after """,
    args_str = arg_line.split('""",', 1)[1].strip().rstrip(')')
    if not args_str:
        continue
    
    # Simple arg count (might be off for nested parens but catches most)
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
            args.append(current.strip())
            current = ''
        else:
            current += ch
    if current.strip():
        args.append(current.strip())
    
    # Filter out empty and trailing )
    args = [a for a in args if a and a != ')']
    
    if len(unique_placeholders) > len(args):
        print(f'Line {i+1}: {len(unique_placeholders)} placeholders vs {len(args)} args')
        print(f'  SQL: {sql.strip()[:100]}')
        print(f'  Args: {args_str[:80]}')
        print()
