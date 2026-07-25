"""Fix seed_supermer.py - only fix $N that exceed param count"""
import re

content = open('/app/api/seed_supermer.py').read()
lines = content.split('\n')

import ast  # noqa: E402

fixed = 0
i = 0
while i < len(lines):
    s = lines[i]
    if 'await conn.execute("""' in s or 'conn.execute("""' in s:
        q_start = i
        # Find the end of the query
        q_end = q_start
        # Check if query starts on this line
        start_tq = s.find('"""')
        rest = s[start_tq + 3:]
        if '"""' in rest:
            # Query starts and ends on same line
            q_lines = [s]
            q_end = i
        else:
            # Query spans multiple lines
            q_end = q_start + 1
            while q_end < len(lines):
                if '"""' in lines[q_end]:
                    break
                q_end += 1
            q_lines = lines[q_start:q_end + 1]
        
        # Extract the VALUES line
        vals_line_idx = -1
        for qi, ql in enumerate(q_lines):
            if 'VALUES' in ql.upper():
                vals_line_idx = q_start + qi
                break
        
        if vals_line_idx >= 0:
            vals_line = lines[vals_line_idx]
            placeholders = re.findall(r'\$(\d+)', vals_line)
            if placeholders:
                max_n = max(int(p) for p in placeholders)
                
                # Find the params after the closing """
                # Look at the line with closing """
                close_line = q_lines[-1]
                close_tq = close_line.rfind('"""')
                after_tq = close_line[close_tq + 3:].strip()
                
                # Build the full param string by continuing to next lines if needed
                if after_tq.startswith(')'):
                    param_count = 0
                elif after_tq.startswith(','):
                    param_str = after_tq
                    # count open parens to find matching close
                    depth = 0
                    pi = q_end
                    while pi < len(lines):
                        for ch in lines[pi]:
                            if ch == '(':
                                depth += 1
                            elif ch == ')':
                                depth -= 1
                        if depth <= 0:
                            break
                        pi += 1
                    
                    # Count params at depth 1
                    depth = 0
                    commas = 0
                    started = False
                    for pi2 in range(q_end, min(pi + 2, len(lines))):
                        for ch in lines[pi2]:
                            if ch == '(':
                                if not started and lines[pi2].strip().startswith('('):
                                    pass
                                depth += 1
                            elif ch == ')':
                                depth -= 1
                                if depth == 0:
                                    break
                            elif ch == ',' and depth == 1:
                                if started:
                                    commas += 1
                            if depth == 1 and not started:
                                started = True
                    param_count = commas + 1 if started else 0
                    
                    if max_n > param_count and param_count > 0:
                        excess = max_n - param_count
                        # Replace the highest N value(s) with NOW()
                        vals = sorted([int(p) for p in placeholders], reverse=True)
                        to_replace = set(vals[:excess])
                        for v in sorted(to_replace):
                            old = '$' + str(v)
                            idx = vals_line.rfind(old)
                            if idx >= 0:
                                vals_line = vals_line[:idx] + 'NOW()' + vals_line[idx + len(old):]
                                fixed += 1
                        lines[vals_line_idx] = vals_line
                        print(f'Line {q_start+1} (VALUES at {vals_line_idx+1}): fixed {excess} excess $N -> NOW()')
        
        i = q_end + 1
    else:
        i += 1

content = '\n'.join(lines)
try:
    compile(content, 'seed_supermer.py', 'exec')
    open('/app/api/seed_supermer.py', 'w').write(content)
    print(f'\nDone. {fixed} fixes applied. Syntax OK.')
except SyntaxError as e:
    print(f'\nSyntax error: {e}')
