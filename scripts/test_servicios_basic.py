import json
import urllib.request
from urllib.parse import urlencode

def get_token():
    req = urllib.request.Request(
        'http://127.0.0.1:8000/api/v1/auth/login',
        data=json.dumps({'email': 'admin@supermer.com', 'password': 'admin123'}).encode(),
        headers={'Content-Type': 'application/json'},
        method='POST',
    )
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read())['access_token']

def call(path, token, method='GET', data=None):
    headers = {'Authorization': f'Bearer {token}'}
    body = None
    if data is not None:
        body = json.dumps(data).encode()
        headers['Content-Type'] = 'application/json'
    req = urllib.request.Request(
        f'http://127.0.0.1:8000{path}',
        data=body,
        headers=headers,
        method=method,
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            return r.status, json.loads(r.read())
    except urllib.error.HTTPError as e:
        return e.code, e.read()[:500].decode()

token = get_token()
CID = '00000000-0000-0000-0000-000000000010'

# 1. dashboard
status, body = call(f'/api/v1/servicios/dashboard?company_id={CID}', token)
print(f'GET /dashboard -> {status}')
if status == 200:
    print(f'  keys: {list(body.keys())[:8]}')

# 2. verticals
status, body = call(f'/api/v1/servicios/verticals', token)
print(f'GET /verticals -> {status}, items: {len(body) if isinstance(body, list) else "?"}')

# 3. technicians
status, body = call(f'/api/v1/servicios/technicians?company_id={CID}', token)
print(f'GET /technicians -> {status}, items: {len(body) if isinstance(body, list) else "?"}')

# 4. quotes
status, body = call(f'/api/v1/servicios/quotes?company_id={CID}', token)
print(f'GET /quotes -> {status}, items: {len(body) if isinstance(body, list) else "?"}')

# 5. work-orders
status, body = call(f'/api/v1/servicios/work-orders?company_id={CID}', token)
print(f'GET /work-orders -> {status}, items: {len(body) if isinstance(body, list) else "?"}')

# 6. invoices
status, body = call(f'/api/v1/servicios/invoices?company_id={CID}', token)
print(f'GET /invoices -> {status}, items: {len(body) if isinstance(body, list) else "?"}')

# 7. dispatch (AI)
status, body = call(f'/api/v1/servicios/dispatch?company_id={CID}&lat=-25.2637&lng=-57.5759&vertical=hvac', token)
print(f'GET /dispatch -> {status}, items: {len(body) if isinstance(body, list) else "?"}')
