"""Find all VALUES lines with $N count vs param count"""
import re

content = open('/app/api/seed_supermer.py').read()
lines = content.split('\n')

issues = []
i = 0
while i < len(lines):
    s = lines[i]
    if 'await conn.execute("""' in s or 'conn.execute("""' in s:
        # Find end of query
        q_lines = [lines[i]]
        j = i + 1
        while j < len(lines):
            l = lines[j]
            q_lines.append(l)
            if '"""' in l:
                # Check if this is closing
                if j > i:
                    break  # closes on a different line
                elif l.count('"""') >= 2:
                    break
            j += 1
        
        # Find the VALUES line
        vals_line = None
        for ql in q_lines:
            if 'VALUES' in ql.upper():
                vals_line = ql
                break
        
        if vals_line is not None:
            placeholders = re.findall(r'\$(\d+)', vals_line)
            if placeholders:
                max_n = max(int(p) for p in placeholders)
                # Find params (after closing """)
                close_idx = None
                for qi, ql in enumerate(q_lines):
                    if '"""' in ql and qi > 0:
                        close_idx = i + qi
                        break
                
                if close_idx is not None:
                    p_idx = close_idx + 1
                    while p_idx < len(lines) and lines[p_idx].strip() == '':
                        p_idx += 1
                    
                    if p_idx < len(lines):
                        p_line = lines[p_idx].strip()
                        # Count top-level commas
                        depth = 0
                        commas = 0
                        started = False
                        for ch in p_line:
                            if ch == '(':
                                if not started:
                                    started = True
                                depth += 1
                            elif ch == ')':
                                depth -= 1
                                if depth == 0:
                                    break
                            elif ch == ',' and depth == 1:
                                commas += 1
                        if started:
                            param_count = commas + 1
                        else:
                            param_count = 0
                        
                        if max_n != param_count:
                            print(f'Line {i+1}: VALUES at {lines.index(vals_line, i)+1}: $N max={max_n}, params={param_count}')
        
        i = j + 1
    else:
        i += 1
