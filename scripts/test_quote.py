import json
import urllib.request

BASE = 'http://127.0.0.1:8000'
CID = '00000000-0000-0000-0000-000000000010'

def login():
    req = urllib.request.Request(f'{BASE}/api/v1/auth/login',
        data=json.dumps({'email':'admin@supermer.com','password':'admin123'}).encode(),
        headers={'Content-Type':'application/json'}, method='POST')
    return json.loads(urllib.request.urlopen(req).read())['access_token']

token = login()
# Use the exact QuoteCreate schema fields
data = {
    'customer_id': '00000000-0000-0000-0000-00000000030a',
    'titulo': 'Test Quote',
    'descripcion': 'Test',
    'vertical_codigo': 'hvac',
    'duracion_estimada_horas': 4,
    'descuento_pct': 0,
    'iva_pct': 10,
    'items': [{
        'tipo': 'mano_obra',
        'descripcion': 'Test',
        'cantidad': 1,
        'precio_unitario': 100000,
    }]
}
print('Sending data:', json.dumps(data, indent=2))
req = urllib.request.Request(f'{BASE}/api/v1/servicios/quotes?company_id={CID}',
    data=json.dumps(data).encode(),
    headers={'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'},
    method='POST')
try:
    r = urllib.request.urlopen(req, timeout=30)
    print('OK', r.status, json.loads(r.read()))
except urllib.error.HTTPError as e:
    print(e.code, e.read().decode()[:500])
