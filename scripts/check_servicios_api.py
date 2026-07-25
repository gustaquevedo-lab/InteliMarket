import json
import urllib.request

def get_token():
    req = urllib.request.Request(
        'http://127.0.0.1:8000/api/v1/auth/login',
        data=json.dumps({'email': 'admin@supermer.com', 'password': 'admin123'}).encode(),
        headers={'Content-Type': 'application/json'},
        method='POST',
    )
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read())['access_token']

token = get_token()
req = urllib.request.Request(
    'http://127.0.0.1:8000/api/openapi.json',
    headers={'Authorization': f'Bearer {token}'},
)
spec = json.loads(urllib.request.urlopen(req, timeout=60).read())
sv = sorted([p for p in spec.get('paths', {}).keys() if '/servicios/' in p])
print(f'SERVICIOS ENDPOINTS: {len(sv)}')
for p in sv:
    print(f'  {p}')
print(f'TOTAL: {len(spec.get("paths", {}))}')
