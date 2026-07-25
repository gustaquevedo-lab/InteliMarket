"""Fix ALL param count mismatches in seed_supermer.py"""
import re

content = open('/app/api/seed_supermer.py').read()
lines = content.split('\n')
modified = False

i = 0
while i < len(lines):
    s = lines[i].strip()
    
    # Detect conn.execute with triple-quote query
    if 'await conn.execute("""' in s or 'conn.execute("""' in s:
        # Find end of query (closing """)
        q_start = i
        q_end = i
        while q_end < len(lines):
            l = lines[q_end]
            # Check if this line closes triple-quote
            if l.count('"""') >= 2 or (q_end > q_start and '"""' in l):
                # Found end of query
                # Find params on next non-empty line
                param_line_idx = q_end + 1
                while param_line_idx < len(lines) and lines[param_line_idx].strip() == '':
                    param_line_idx += 1
                
                if param_line_idx < len(lines):
                    param_line = lines[param_line_idx].strip()
                    
                    # Count $N in query
                    q_text = '\n'.join(lines[q_start:q_end+1])
                    placeholders = re.findall(r'\$(\d+)', q_text)
                    if not placeholders:
                        i = q_end + 1
                        break
                    
                    max_n = max(int(p) for p in placeholders)
                    
                    # Count actual params
                    p = param_line
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
                    
                    if max_n > param_count:
                        # Found mismatch - the last (max_n - param_count) $N should be NOW()
                        print(f'Line {q_start+1} (params at {param_line_idx+1}): $N max={max_n}, params={param_count}')
                        
                        # Replace each excess $N with NOW()
                        excess = max_n - param_count
                        # Find the VALUES line
                        for qi in range(q_start, q_end + 1):
                            if 'VALUES' in lines[qi].upper() or 'values' in lines[qi].lower():
                                vals_line = lines[qi]
                                # Find all $N in this line
                                vals = re.findall(r'\$(\d+)', vals_line)
                                if vals:
                                    last_vals = sorted([int(v) for v in vals], reverse=True)[:excess]
                                    for v in last_vals:
                                        # Replace $N with NOW() - careful to not replace other occurrences
                                        old = f'${v}'
                                        if old in vals_line:
                                            vals_line = vals_line.replace(old, 'NOW()', 1)
                                            print(f'  -> Line {qi+1}: ${v} → NOW()')
                                    lines[qi] = vals_line
                                    modified = True
                                break
                i = q_end + 1
                break
            q_end += 1
    i += 1

if modified:
    content = '\n'.join(lines)
    open('/app/api/seed_supermer.py', 'w').write(content)
    print('\nDone! Fixes applied.')
else:
    print('\nNo mismatches found.')
