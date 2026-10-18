import re
content = open('/app/api/seed_supermer.py').read()
# Find all remaining true,$N at end of VALUES
for m in re.finditer(r',true,\$(\d+)\)', content):
    line_num = content[:m.start()].count('\n') + 1
    print('Line {}: ,true,${})'.format(line_num, m.group(1)))
