import urllib.request, json

r = urllib.request.urlopen('http://localhost:8000/api/openapi.json', timeout=30)
spec = json.loads(r.read())
paths = spec.get('paths', {})

# Find intelientregas paths
int = [p for p in paths if 'intelientregas' in p.lower()]
print(f'=== intelientregas ({len(int)} paths) ===')
for p in int[:10]:
    print(f'  {p}')

# Find data_migration paths
mig = [p for p in paths if 'migration' in p.lower()]
print(f'=== migration ({len(mig)} paths) ===')
for p in mig[:10]:
    print(f'  {p}')

# Total
print(f'\nTOTAL: {len(paths)} paths')
