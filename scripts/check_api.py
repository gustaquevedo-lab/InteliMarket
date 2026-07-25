import urllib.request, json
paths_to_test = [
    'http://localhost:8000/api/health',
    'http://localhost:8000/api/docs',
    'http://localhost:8000/api/openapi.json',
    'http://localhost:8000/openapi.json',
]
for url in paths_to_test:
    try:
        r = urllib.request.urlopen(url, timeout=5)
        print(f'{url}: HTTP {r.status} (len={len(r.read())})')
    except urllib.error.HTTPError as e:
        print(f'{url}: HTTP {e.code} {e.reason}')
    except Exception as e:
        print(f'{url}: ERROR {e}')
