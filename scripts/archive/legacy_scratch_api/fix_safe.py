"""Fix ONLY lines with 2+ $N where the last one should be NOW()"""
import re

content = open('/app/api/seed_supermer.py').read()
lines = content.split('\n')
fixed = []

for i, line in enumerate(lines):
    if 'VALUES' not in line.upper():
        continue
    
    vals = re.findall(r'\$(\d+)', line)
    if len(vals) < 2:
        continue  # Only fix lines with at least 2 placeholders
    
    last_n = int(vals[-1])
    last_str = '$' + str(last_n)
    
    idx = line.rfind(last_str)
    if idx < 0:
        continue
    
    after = line[idx + len(last_str):].strip()
    if not after.startswith(')'):
        continue  # Only fix if the placeholder is at the end of VALUES
    
    # Replace just this one placeholder
    new_line = line[:idx] + 'NOW()' + line[idx + len(last_str):]
    lines[i] = new_line
    fixed.append(i + 1)
    print(f'Line {i+1}: {line.strip()[:70]}')

content = '\n'.join(lines)
try:
    compile(content, 'seed_supermer.py', 'exec')
    open('/app/api/seed_supermer.py', 'w').write(content)
    print(f'\n✅ Syntax OK. Fixed {len(fixed)} lines.')
except SyntaxError as e:
    print(f'\n❌ Syntax error: {e}')
