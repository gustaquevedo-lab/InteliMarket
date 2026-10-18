"""Fix ALL $N param mismatches in seed_supermer.py correctly"""
import re

content = open('/app/api/seed_supermer.py').read()
lines = content.split('\n')

fixed_count = 0
i = 0
while i < len(lines):
    s = lines[i]
    if 'await conn.execute("""' in s or 'conn.execute("""' in s:
        q_start = i
        # Find the closing triple quote
        q_end = i
        in_query = True
        while q_end < len(lines):
            l = lines[q_end]
            open_count = l.count('"""')
            if open_count == 1 or (open_count == 2 and q_end == q_start):
                # Query starts here. If 2, could be start+end on same line
                if q_end > q_start and '"""' in l:
                    # Already past start, this is end
                    # Count how many triple-quotes before end
                    if open_count >= 1 and q_end > q_start:
                        break
            elif q_end > q_start and '"""' in l:
                break
            q_end += 1
        
        # q_end now points to the line with closing """ or just past
        while q_end < len(lines) and '"""' not in lines[q_end]:
            q_end += 1
        
        if q_end >= len(lines):
            i += 1
            continue
        
        # Collect query text
        q_text = '\n'.join(lines[q_start:q_end+1])
        
        # Count $N in VALUES line specifically (the last line containing VALUES)
        vals_line_idx = -1
        for qi in range(q_start, q_end + 1):
            if 'VALUES' in lines[qi].upper():
                vals_line_idx = qi
        
        if vals_line_idx < 0:
            i = q_end + 1
            continue
        
        vals_line = lines[vals_line_idx]
        placeholders_in_vals = re.findall(r'\$(\d+)', vals_line)
        
        if not placeholders_in_vals:
            i = q_end + 1
            continue
        
        max_n_in_vals = max(int(p) for p in placeholders_in_vals)
        
        # Find param line (after closing """)
        param_idx = q_end + 1
        while param_idx < len(lines) and lines[param_idx].strip() == '':
            param_idx += 1
        
        if param_idx >= len(lines):
            i = q_end + 1
            continue
        
        param_line = lines[param_idx].strip()
        
        # Count params: it's the parenthesized Python expression after """..."""
        # Find the opening ( after the params part
        # The line looks like: """, param1, param2, ...)
        # OR: ") (nested)
        
        # Find the closing paren of the execute call
        # Start from the closing """
        close_tq = lines[q_end].rfind('"""')
        after_tq = lines[q_end][close_tq + 3:].strip()
        
        if after_tq.startswith(')'):
            # No params
            param_count = 0
        elif after_tq.startswith(','):
            # Params start on same line as closing """
            param_str = after_tq.lstrip(',')
            # Find the matching closing paren
            depth = 0
            for ch in param_str:
                if ch == '(':
                    depth += 1
                elif ch == ')':
                    depth -= 1
            if depth > 0:
                # Closing paren on next line(s)
                param_str_full = param_str
                pi = q_end + 1
                while pi < len(lines):
                    for ch in lines[pi]:
                        if ch == '(':
                            depth += 1
                        elif ch == ')':
                            depth -= 1
                    if depth <= 0:
                        param_str_full += '\n' + lines[pi]
                        break
                    param_str_full += '\n' + lines[pi]
                    pi += 1
                param_str = param_str_full
            
            # Now count commas at depth 0 within the outermost parens
            depth = 0
            commas = 0
            started = False
            for ch in param_str:
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
            param_count = commas + 1 if started else 0
        else:
            param_count = 0
        
        if max_n_in_vals > param_count and param_count >= 1:
            # Replace excess placeholders with NOW()
            excess = max_n_in_vals - param_count
            # Find which $N values to replace (the highest N values)
            vals = sorted([int(p) for p in placeholders_in_vals], reverse=True)
            to_replace = set(vals[:excess])
            
            # Build new vals_line by replacing $N with NOW() from lowest to highest
            # (to avoid position shifts)
            for v in sorted(to_replace):
                old_str = f'${v}'
                # Replace only the LAST occurrence (in case of $N appearing multiple times)
                if old_str in vals_line:
                    idx = vals_line.rfind(old_str)
                    vals_line = vals_line[:idx] + 'NOW()' + vals_line[idx + len(old_str):]
            
            lines[vals_line_idx] = vals_line
            fixed_count += 1
            print(f'Line {q_start+1} (VALUES at {vals_line_idx+1}): fixed ${max_n_in_vals} with {param_count} params')
        
        i = q_end + 1
    else:
        i += 1

content = '\n'.join(lines)
# Verify syntax is still valid
try:
    compile(content, 'seed_supermer.py', 'exec')
    print(f'\n✅ Syntax OK. {fixed_count} fixes applied.')
    open('/app/api/seed_supermer.py', 'w').write(content)
except SyntaxError as e:
    print(f'\n❌ Syntax error: {e}')
    # Don't save if syntax is broken
