"""Find all queries where the last $N should be replaced with NOW()"""
import re

content = open('/app/api/seed_supermer.py').read()
lines = content.split('\n')

# Find lines matching: VALUES ...  $N) and params count < N
fixes = []
i = 0
while i < len(lines):
    line = lines[i]
    s = line.strip()
    if ('await conn.execute("""' in s or 'conn.execute("""' in s):
        # Find the closing """
        q_lines = [s]
        j = i + 1
        while j < len(lines):
            l = lines[j]
            q_lines.append(l)
            if '"""' in l:
                # Check if it closes the query
                # Find params after """
                param_start = j + 1
                while param_start < len(lines) and lines[param_start].strip() == '':
                    param_start += 1
                if param_start < len(lines):
                    param_line = lines[param_start]
                    # Check the query
                    q = '\n'.join(q_lines)
                    placeholders = re.findall(r'\$(\d+)', q)
                    if placeholders:
                        max_n = max(int(p) for p in placeholders)
                        # Count params in param_line (top-level commas)
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
                        
                        # Check if inline VALUES line has $N at end
                        for ql in q_lines:
                            qs = ql.strip()
                            if 'VALUES' in qs or 'values' in qs.lower():
                                # Find the last $N in the VALUES line
                                vals = re.findall(r'\$(\d+)', qs)
                                if vals:
                                    last_v = int(vals[-1])
                                    if last_v > param_count:
                                        fix_type = 'param_mismatch'
                                    elif last_v == param_count and 'NOW()' not in qs.split(')')[0]:
                                        # Check if last value is a $N or literal
                                        last_part = qs.rstrip(',').rstrip(')').split(',')[-1].strip()
                                        if last_part.startswith('$'):
                                            fix_type = 'last_param_should_be_now'
                                    else:
                                        fix_type = 'ok'
                                break
                        print(f'Line {i+1} (params at {param_start+1}): $N max={max_n}, params={param_count}')
                j = len(lines)  # break outer loop
                break
            j += 1
        i = j
    i += 1
