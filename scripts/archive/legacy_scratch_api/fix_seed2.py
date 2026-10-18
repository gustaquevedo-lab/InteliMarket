import re

content = open('/app/api/seed_supermer.py').read()

# Strategy: Replace $N, $N) at end of VALUES line with NOW(), NOW())
lines = content.split('\n')
fixed_lines = []
changes = 0

for line in lines:
    stripped = line.rstrip()
    if 'VALUES (' in stripped and stripped.strip().startswith('VALUES ('):
        new_line = re.sub(r'\$(\d+),\s*\$(\d+)\)$', 'NOW(), NOW())', stripped)
        if new_line != stripped:
            changes += 1
            fixed_lines.append(new_line)
            continue
    fixed_lines.append(line.rstrip('\n'))

if changes:
    content = '\n'.join(fixed_lines)
    # Preserve final newline
    if not content.endswith('\n'):
        content += '\n'
    open('/app/api/seed_supermer.py', 'w').write(content)
    print('Total changes: {}'.format(changes))
else:
    print('No changes needed')

print('Done')
