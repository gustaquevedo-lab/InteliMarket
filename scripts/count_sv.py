import urllib.request, json
data = json.loads(urllib.request.urlopen('http://127.0.0.1:8000/api/v1/openapi.json', timeout=10).read())
paths = data.get('paths', {})
sv = [p for p in paths if '/servicios/' in p]
print(f'Total paths: {len(paths)}')
print(f'Servicios paths: {len(sv)}')
for p in sorted(sv):
    methods = [m for m in paths[p] if m in ('get','post','put','delete','patch')]
    print(f'  {p}: {methods}')
