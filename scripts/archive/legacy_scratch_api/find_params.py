import re

content = open('/app/api/seed_supermer.py').read()
lines = content.split('\n')

# Find all conn.execute calls with their query and params
results = []
i = 0
while i < len(lines):
    line = lines[i]
    s = line.strip()
    if 'await conn.execute("""' in s or 'conn.execute("""' in s:
        start_line = i + 1
        # Collect query lines
        query_parts = []
        j = i
        while j < len(lines):
            ql = lines[j]
            # Check if this line closes the triple-quote
            qs = ql.strip()
            if qs.startswith('"""') and qs != '"""':
                # query starts and ends on same line
                inner = qs[3:]
                end_idx = inner.rfind('"""')
                if end_idx >= 0:
                    query_parts.append(inner[:end_idx])
                    # find params after """
                    after = inner[end_idx + 3:]
                    results.append((start_line, '\n'.join(query_parts), after, j + 1))
                    break
                else:
                    query_parts.append(inner)
                    j += 1
                    continue
            elif qs == '"""':
                # start or end of query
                if query_parts:  # closing """
                    end_line = j
                    # find next non-empty line for params
                    k = j + 1
                    while k < len(lines) and lines[k].strip() == '':
                        k += 1
                    if k < len(lines):
                        param_line = lines[k]
                        results.append((start_line, '\n'.join(query_parts), param_line, k + 1))
                    break
                else:
                    query_parts.append('')
                    j += 1
                    continue
            else:
                query_parts.append(ql)
                j += 1
        i = j
    i += 1

# Analyze each
for start_line, query, param_line, param_lineno in results:
    placeholders = re.findall(r'\$(\d+)', query)
    if not placeholders:
        continue
    max_n = max(int(p) for p in placeholders)
    
    # Count actual params (comma-separated, top-level)
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
    
    if max_n != param_count:
        # Check if the LAST placeholder should be NOW()
        last_placeholder_idx = max(int(p) for p in placeholders)
        print(f'Line {start_line} (params at {param_lineno}): max $N={max_n}, params={param_count}')
        print(f'  Query snippet: ...${max_n})')
        print(f'  Params: {p.strip()[:80]}')

    # Check for string dates that should be datetime
    if '2026-' in query and ('fecha' in query.lower() or 'fecha_visita' in query.lower()):
        # Check if the query has string dates but no datetime conversion
        pass
