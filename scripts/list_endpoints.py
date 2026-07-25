import urllib.request, json
try:
    r = urllib.request.urlopen('http://localhost:8000/api/openapi.json', timeout=30)
    spec = json.loads(r.read())
    paths = spec.get('paths', {})
    print(f'Total paths: {len(paths)}')
    print()
    print('=== DELIVERY/SUSCRIPCIONES ===')
    for p in sorted(paths):
        if 'delivery' in p.lower() or 'suscrip' in p.lower():
            print(' ', p)
    print()
    print('=== SMART PRICING ===')
    for p in sorted(paths):
        if 'pricing' in p.lower() or 'sp-' in p.lower():
            print(' ', p)
    print()
    print('=== ALL PREFIXES ===')
    prefixes = set()
    for p in paths:
        parts = p.split('/')
        if len(parts) > 3:
            prefixes.add(parts[3])
    for p in sorted(prefixes):
        print(' ', p)
except Exception as e:
    print('Error:', e)
