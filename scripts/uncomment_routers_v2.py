import re

with open(r'C:\Users\Gustavo\OneDrive\Dev\Intelimarket\api\src\main.py', encoding='utf-8') as f:
    content = f.read()

# Uncomment lines starting with "# from api.src.X.router" and "# app.include_router(X)"
# Pattern: remove leading "# " from lines that start with "# from api.src" or "# app.include_router"
lines = content.split('\n')
new_lines = []
uncommented = 0
for line in lines:
    stripped = line.lstrip()
    if stripped.startswith('# from api.src.') and 'router import router as' in stripped:
        # Remove the leading "# "
        new_line = line.replace('# from api.src.', 'from api.src.', 1)
        new_lines.append(new_line)
        uncommented += 1
    elif stripped.startswith('# app.include_router('):
        # Remove the leading "# "
        new_line = line.replace('# app.include_router(', 'app.include_router(', 1)
        new_lines.append(new_line)
        uncommented += 1
    else:
        new_lines.append(line)

with open(r'C:\Users\Gustavo\OneDrive\Dev\Intelimarket\api\src\main.py', 'w', encoding='utf-8') as f:
    f.write('\n'.join(new_lines))

print(f'Uncommented {uncommented} lines')
