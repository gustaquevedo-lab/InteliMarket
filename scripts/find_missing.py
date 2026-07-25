import urllib.request, json

r = urllib.request.urlopen('http://localhost:8000/api/openapi.json', timeout=30)
spec = json.loads(r.read())
paths = spec.get('paths', {})

# Search for any path containing these module names
search_terms = ['marketing', 'pyg', 'data-migration', 'datamigration', 'data_migration',
                'distribuidora', 'fase2', 'client-app', 'client_app', 'clientapp']
for term in search_terms:
    matches = [p for p in paths if term.lower() in p.lower()]
    if matches:
        print(f'=== {term} ({len(matches)} paths) ===')
        for p in matches[:5]:
            print(f'  {p}')
        if len(matches) > 5:
            print(f'  ... and {len(matches) - 5} more')
    else:
        print(f'=== {term} === NO MATCHES')
