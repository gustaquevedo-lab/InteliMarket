"""Find all param count mismatches in seed"""
import re

content = open('/app/api/seed_supermer.py').read()
lines = content.split('\n')
errors = []

for i, line in enumerate(lines):
    if 'await conn.execute("""' not in line and 'await conn.execute(\"\"\"' not in line and \
       'conn.execute("""' not in line:
        continue
    vals_line = i
    params_line_idx = None
    values_text = ''
    
    for j in range(i+1, min(i+20, len(lines))):
        values_text += lines[j] + '\n'
        if lines[j].strip() == '"""':
            params_line_idx = j + 1
            break
    
    if params_line_idx is None or params_line_idx >= len(lines):
        continue
    
    # Count $N in values_text
    vals = re.findall(r'\$(\d+)', values_text)
    
    # Parse params on the param line after """
    param_line = lines[params_line_idx]
    if '""",' not in param_line:
        continue
    
    params_str = param_line.split('""",', 1)[1].strip()
    if not params_str:
        continue
    
    args_count = 0
    depth = 0
    arg_parts = []
    current = []
    in_paren = False
    
    for ch in params_str:
        if ch == '(':
            depth += 1
            current.append(ch)
        elif ch == ')':
            depth -= 1
            current.append(ch)
            if depth == 0:
                arg_parts.append(''.join(current))
                current = []
        elif ch == ',' and depth == 0:
            arg_parts.append(''.join(current).strip())
            current = []
        else:
            current.append(ch)
    
    if current:
        arg_parts.append(''.join(current).strip())
    
    # Filter out empty strings and the trailing )
    arg_parts = [p for p in arg_parts if p and p != ')']
    args_count = len(arg_parts)
    
    if len(vals) != args_count:
        errors.append((vals_line + 1, len(vals), args_count, values_text.strip()[:90], param_line.strip()[:60]))

for line_no, n_vals, n_args, val_str, arg_str in errors:
    print(f'Line {line_no}: {n_vals} placeholders, {n_args} args — {val_str}')
    print(f'  Args: {arg_str}')
    print()

print(f'\nTotal: {len(errors)} mismatches')
