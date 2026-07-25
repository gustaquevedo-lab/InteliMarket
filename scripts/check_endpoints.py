import urllib.request, json

endpoints = [
    ('/api/v1/delivery-integrations/dashboard', 'delivery dashboard'),
    ('/api/v1/suscripciones/dashboard', 'suscripciones dashboard'),
    ('/api/v1/suscripciones/available-products', 'available products'),
    ('/api/v1/smart-pricing/promotions', 'smart pricing promotions'),
    ('/api/v1/demand-forecast/configs', 'demand forecast configs'),
    ('/api/v1/intelligent-routing/route-optimizations', 'routing optimizations'),
    ('/api/v1/integrated-finance/dashboard', 'integrated finance'),
    ('/api/v1/sifen-avanzado/documents', 'sifen avanzado'),
]

for path, label in endpoints:
    try:
        r = urllib.request.urlopen(f'http://localhost:8000{path}', timeout=10)
        body = r.read()
        try:
            data = json.loads(body)
            if isinstance(data, dict):
                print(f'OK {label}: {len(data)} keys: {list(data.keys())[:5]}')
            elif isinstance(data, list):
                print(f'OK {label}: list with {len(data)} items')
            else:
                print(f'OK {label}: {data}')
        except json.JSONDecodeError:
            print(f'OK {label}: {len(body)} bytes')
    except urllib.error.HTTPError as e:
        body = e.read().decode()[:200]
        print(f'FAIL {label}: HTTP {e.code}: {body[:150]}')
    except Exception as e:
        print(f'FAIL {label}: {type(e).__name__}: {e}')
