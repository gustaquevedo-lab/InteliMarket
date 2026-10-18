import re

content = open('/app/api/seed_supermer.py').read()
lines = content.split('\n')
issues = []
i = 0
while i < len(lines):
    line = lines[i]
    stripped = line.strip()
    if 'await conn.execute("""' in stripped or 'conn.execute("""' in stripped:
        # Find the query end
        query_lines = [line]
        j = i + 1
        while j < len(lines) and '"""' not in lines[j]:
            query_lines.append(lines[j])
            j += 1
        if j < len(lines):
            query_lines.append(lines[j])
        
        query_text = '\n'.join(query_lines)
        
        # Count $N placeholders
        placeholders = re.findall(r'\$(\d+)', query_text)
        max_n = max((int(p) for p in placeholders), default=0)
        
        # Find params on the next non-empty line after """ 
        params_part = ''
        for k in range(j+1, min(j+3, len(lines))):
            p = lines[k].strip()
            if p.startswith('"""') or p.startswith('#'):
                continue
            params_part += p
            if ')' in p:
                break
        
        # Count comma-separated items that aren't strings/keywords
        if params_part:
            # Simple heuristic: count commas at depth 0
            depth = 0
            commas = 0
            in_paren = False
            for ch in params_part:
                if ch == '(':
                    depth += 1
                elif ch == ')':
                    depth -= 1
                elif ch == ',' and depth == 0:
                    commas += 1
            param_count = commas + 1  # rough estimate
            
            if max_n != param_count and max_n > 0 and param_count > 0:
                issues.append((i+1, f'Placeholders: ${max_n}, Params: ~{param_count}'))
        
        i = j
    i += 1

for line_no, msg in issues[:30]:
    print(f'Line {line_no}: {msg}')
print(f'\nTotal: {len(issues)} issues')
