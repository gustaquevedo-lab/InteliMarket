import urllib.request, json

r = urllib.request.urlopen('http://localhost:8000/api/openapi.json', timeout=30)
spec = json.loads(r.read())
paths = spec.get('paths', {})

# Group by module
modules = {}
for p in sorted(paths):
    parts = p.split('/')
    if len(parts) > 3:
        module = parts[3]
        if module not in modules:
            modules[module] = []
        modules[module].append(p)

# Print all modules
for m in sorted(modules):
    print(f'{m}: {len(modules[m])} paths')
    for p in modules[m][:3]:
        print(f'  {p}')
    if len(modules[m]) > 3:
        print(f'  ... and {len(modules[m]) - 3} more')
