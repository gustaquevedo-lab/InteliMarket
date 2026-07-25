import re, ast

content = open('/app/api/seed_supermer.py').read()
# Find all conn.execute("""...""", ...) calls and check param counts
pattern = r"await conn\.execute\(\s*\"\"\"(.*?)\"\"\".*?\)"
# Simpler approach: find lines with VALUES and count $N vs params
lines = content.split('\n')
total_issues = []
inside_query = False
query_lines = []
param_lines = []

for i, line in enumerate(lines, 1):
    if 'await conn.execute("""' in line or 'conn.execute("""' in line:
        inside_query = True
        query_lines = [(i, line)]
        param_lines = []
    elif inside_query:
        query_lines.append((i, line))
        if '"""' in line:
            # End of query - check for params
            query_end_idx = line.index('"""')
            after = line[query_end_idx + 3:]
            param_lines.append(after)
            
            # Extract all params from this and subsequent lines until )
            full_params = after.strip()
            idx = 1
            while not full_params.endswith(')') and idx < 20:
                if i + idx < len(lines):
                    full_params += ' ' + lines[i + idx - 1].strip()
                    idx += 1
                else:
                    break
            
            # Count placeholders
            query_text = '\n'.join(l[1] for l in query_lines)
            placeholders = re.findall(r'\$(\d+)', query_text)
            if placeholders:
                max_n = max(int(p) for p in placeholders)
                # Determine actual params
                all_lines_after = ' '.join(l[1] for l in query_lines[len(query_lines)-1:query_lines[-1][0]+10] if l[0] < len(lines))
                
            inside_query = False

print("Manual review needed: check each VALUES section carefully")
