"""Fix all trailing $N → NOW() in VALUES clauses"""
import re

content = open('/app/api/seed_supermer.py').read()
lines = content.split('\n')
fixed = 0

for i, line in enumerate(lines):
    if 'VALUES' in line.upper():
        vals = re.findall(r'\$(\d+)', line)
        if not vals:
            continue
        last_n = int(vals[-1])
        last_str = '$' + str(last_n)
        idx = line.rfind(last_str)
        if idx >= 0:
            after = line[idx + len(last_str):].strip()
            if after.startswith(')'):
                before = line[:idx].rstrip()
                if not before.endswith('NOW()'):
                    replacement = line[:idx] + 'NOW()' + line[idx + len(last_str):]
                    lines[i] = replacement
                    fixed += 1

content = '\n'.join(lines)
open('/app/api/seed_supermer.py', 'w').write(content)
print('Fixed %d trailing $N -> NOW()' % fixed)
