"""Find all lines with trailing $N in VALUES"""
import re
content = open('/app/api/seed_supermer.py').read()
for i, line in enumerate(content.split('\n'), 1):
    if 'VALUES' in line.upper() and '$' in line:
        vals = re.findall(r'\$(\d+)', line)
        if vals:
            last_n = int(vals[-1])
            idx = line.rfind('$' + str(last_n))
            if idx >= 0:
                after = line[idx + len('$' + str(last_n)):].strip()
                if after.startswith(')'):
                    before_part = line[:idx].rstrip()[-30:]
                    print(f'{i}: ...{before_part} ${last_n})')
