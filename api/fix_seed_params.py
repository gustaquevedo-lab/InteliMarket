import re

content = open('/app/api/seed_supermer.py').read()
lines = content.split('\n')
fixed_lines = []
changes = 0

# Track execute contexts: consecutive lines from "await conn.execute" through closing """) 
i = 0
while i < len(lines):
    line = lines[i]
    
    # Look for execute calls spanning multiple lines
    if 'await conn.execute(' in line and '"""' in line:
        # Find the start of the SQL (after """)
        sql_start = line.find('"""') + 3
        if sql_start < 3:  # shouldn't happen
            fixed_lines.append(line)
            i += 1
            continue
        
        # Build the full SQL string (may span multiple lines)
        sql_parts = [line[sql_start:]]
        j = i + 1
        while j < len(lines) and '"""' not in lines[j]:
            sql_parts.append(lines[j])
            j += 1
        if j < len(lines):
            # Include the closing line up to """
            close_idx = lines[j].find('"""')
            sql_parts.append(lines[j][:close_idx])
        else:
            sql_parts.append(lines[j]) if j < len(lines) else ''
        
        sql = ' '.join(sql_parts)
        
        # Count $N placeholders in the SQL
        # Just count max $N
        max_n = 0
        for match in re.finditer(r'\$(\d+)', sql):
            n = int(match.group(1))
            if n > max_n:
                max_n = n
        
        # Find the parameters line (the line with close paren after """)
        params_line = None
        for k in range(j, min(j + 3, len(lines))):
            if lines[k].strip().startswith('"""') or lines[k].strip().startswith('''"""'''):
                # This is the continuation line after the SQL
                # The params are in this line after , """) or in the next line
                idx = lines[k].find('"""') + 3
                rest = lines[k][idx:].strip()
                if rest.startswith(','):
                    params_line = lines[k]
                    break
                elif rest == '' or rest == ')':
                    # Check next line
                    pass
        
        # Actually, simpler: just find all execute calls and check if the highest 
        # $N matches the parameter count
        
        # Extract parameter list
        param_start = None
        for k in range(j, len(lines)):
            if '"""' in lines[k]:
                # Find params after """
                rest = lines[k].split('"""', 1)[1]
                if ',' in rest:
                    param_start = k
                    break
        
        if param_start is not None:
            param_line = lines[param_start]
            after_sql = param_line.split('"""', 1)[1]
            # Find the parameter list starting after the comma
            # The pattern is: ... """, param1, param2)
            if '"""' in param_line:
                after_sql = param_line.split('"""', 1)[1]
                # Strip whitespace and trailing )
                after_sql = after_sql.strip()
                if after_sql.startswith(','):
                    after_sql = after_sql[1:].strip()
                if after_sql.endswith(')'):
                    after_sql = after_sql[:-1].strip()
                # Split by commas, but be careful not to split within strings
                # Simple approach: count commas
                if after_sql:
                    # For now, just fix obvious patterns
                    pass
        
        fixed_lines.append(line)
        i += 1
        continue
    
    fixed_lines.append(line)
    i += 1

# --- Fix specific known issues by line ---

# 1. Line 365: warehouses - $8 should be NOW()
lines = content.split('\n')
line_365 = lines[363] if len(lines) > 363 else ''
if '$8)' in line_365:
    lines[363] = line_365.replace('true, $8)', 'true, NOW())')
    changes += 1
    print('Fixed line 365 (warehouses)')

# 2. Line 384: categories - $5 should be NOW()
line_384 = lines[382] if len(lines) > 382 else ''
if ', true, $5)' in line_384:
    lines[382] = line_384.replace(', true, $5)', ', true, NOW())')
    changes += 1
    print('Fixed line 384 (categories)')

# 3. Rejoin and write
if changes:
    content = '\n'.join(lines)
    if not content.endswith('\n'):
        content += '\n'
    open('/app/api/seed_supermer.py', 'w').write(content)
    print('Total changes: {}'.format(changes))
else:
    print('No changes needed')
print('Done')
