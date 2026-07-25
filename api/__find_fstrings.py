import re
lines = open('/app/api/seed_supermer.py').readlines()
for i,line in enumerate(lines):
    if re.search(r'f"\{\{\{', line) or re.search(r"f'\{\{\{", line):
        print(f"Line {i+1}: {line.rstrip()[:90]}")
