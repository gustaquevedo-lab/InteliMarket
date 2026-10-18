"""Find all multiline $N that should be NOW()"""
import re

content = open('/app/api/seed_supermer.py').read()
lines = content.split('\n')

for i, line in enumerate(lines):
    if 'VALUES' not in line.upper() or not line.strip():
        continue
    
    # Collect all lines of this VALUES block (until closing paren)
    j = i
    block_lines = []
    while j < len(lines) and ');' not in lines[j] and lines[j].strip() != '"""':
        j += 1
    if j >= len(lines):
        continue
    # Include the line with );
    if j < len(lines):
        j += 1
    
    # Check each line for trailing $N
    for k in range(i, min(j, len(lines))):
        l = lines[k]
        vals = re.findall(r'\$(\d+)', l)
        if not vals:
            continue
        
        last_n = int(vals[-1])
        last_str = '$' + str(last_n)
        idx = l.rfind(last_str)
        if idx < 0:
            continue
        
        after = l[idx + len(last_str):].strip()
        # Check if this is the LAST placeholder in the VALUES block
        # by looking at all remaining lines
        remaining = '\n'.join(lines[k:j])
        remaining_after = remaining[remaining.index(last_str) + len(last_str):]
        # If after removing all $N from remaining lines, there are no more $N
        remaining_vals = re.findall(r'\$(\d+)', remaining_after)
        
        if not remaining_vals:
            # This is the last placeholder in the entire VALUES block
            # It should be NOW() if after is ')' or ', $N)'
            if not after.startswith(')'):
                continue  # Not at end
            
            # Count total args vs total placeholders
            all_vals_in_block = re.findall(r'\$(\d+)', '\n'.join(lines[i:j]))
            unique_vals = set(all_vals_in_block)
            
            # Get the arg line (the one with """,)
            arg_line_idx = j
            while arg_line_idx < len(lines) and '""",' not in lines[arg_line_idx]:
                arg_line_idx += 1
            if arg_line_idx >= len(lines):
                continue
            
            arg_line = lines[arg_line_idx]
            # Count args after """,
            args_str = arg_line.split('""",', 1)[1].strip().rstrip(')')
            if not args_str:
                continue
            
            # Simple comma count (doesn't handle nested parens but good enough)
            args_count = args_str.count(',') + 1 if args_str else 0
            
            if len(unique_vals) > args_count:
                print(f'Line {k+1}: $N mismatch — {len(unique_vals)} placeholders vs {args_count} args')
                print(f'  Vals: {sorted(unique_vals, key=int)}')
                print(f'  Line: {l.strip()[:80]}')
                print()

print('Done')
