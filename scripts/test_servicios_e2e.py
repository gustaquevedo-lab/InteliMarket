"""
Full E2E test of Servicios module.
"""
import json
import urllib.request

BASE = 'http://127.0.0.1:8000'
CID = '00000000-0000-0000-0000-000000000010'

def login():
    req = urllib.request.Request(f'{BASE}/api/v1/auth/login',
        data=json.dumps({'email':'admin@supermer.com','password':'admin123'}).encode(),
        headers={'Content-Type':'application/json'}, method='POST')
    return json.loads(urllib.request.urlopen(req).read())['access_token']

def call(path, token, method='GET', data=None):
    headers = {'Authorization': f'Bearer {token}'}
    body = None
    if data is not None:
        body = json.dumps(data).encode()
        headers['Content-Type'] = 'application/json'
    req = urllib.request.Request(f'{BASE}{path}', data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.status, json.loads(r.read())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read()) if e.headers.get('content-type','').startswith('application/json') else {}

token = login()
print('Token OK\n')

# 1. Dashboard
print('=== DASHBOARD ===')
s, b = call(f'/api/v1/servicios/dashboard?company_id={CID}', token)
print(f'GET /dashboard -> {s}')
if s == 200:
    k = b.get('kpis_principales', {})
    print(f'  KPIs: {json.dumps(k, indent=2)[:300]}')
    print(f'  agenda_hoy: {len(b.get("agenda_hoy", []))} items')
    print(f'  wo_en_progreso: {len(b.get("wo_en_progreso", []))} items')
    print(f'  top_tecnicos: {len(b.get("top_tecnicos", []))} items')
    print(f'  contratos_por_vencer: {len(b.get("contratos_por_vencer", []))} items')
    print(f'  queue_quote_requests: {len(b.get("queue_quote_requests", []))} items')
    rev = b.get('revenue_mes', {})
    print(f'  revenue_mes: {rev}')
    aging = b.get('aging_facturas', {})
    print(f'  aging_facturas: {aging}')

# 2. Catalogs
print('\n=== CATALOGS ===')
for ep in ['verticals', 'skills', 'zones', 'properties', 'equipment', 'teams', 'reviews', 'quote-requests']:
    s, b = call(f'/api/v1/servicios/{ep}?company_id={CID}&limit=5', token)
    if isinstance(b, list):
        print(f'  /{ep} -> {s} ({len(b)} items)')
    else:
        print(f'  /{ep} -> {s} (dict)')

# 3. Entities
print('\n=== ENTITIES ===')
for ep in ['technicians', 'quotes', 'work-orders', 'contracts', 'invoices', 'certifications', 'truck-inventory']:
    s, b = call(f'/api/v1/servicios/{ep}?company_id={CID}&limit=5', token)
    if isinstance(b, list):
        print(f'  /{ep} -> {s} ({len(b)} items)')

# 4. Dispatch
print('\n=== DISPATCH (AI) ===')
s, b = call(f'/api/v1/servicios/dispatch?company_id={CID}&lat=-25.2637&lng=-57.5759&vertical=hvac&fecha=2026-06-06', token)
print(f'  /dispatch -> {s}, {len(b) if isinstance(b, list) else "?"} technicians ranked')
if isinstance(b, list) and b:
    for t in b[:3]:
        print(f'    - {t.get("nombre")}: score={t.get("score")}, dist={t.get("distancia_km")}km, rating={t.get("rating")}')

# 5. Try a new quote
print('\n=== CREATE QUOTE ===')
s, b = call(f'/api/v1/servicios/quotes?company_id={CID}', token, method='POST', data={
    'customer_id': '00000000-0000-0000-0000-00000000030a',  # first customer
    'titulo': 'Test Quote - Instalacion aire',
    'descripcion': 'Test quote created via E2E',
    'vertical_codigo': 'hvac',
    'subtmano_obra': 250000,
    'subtotal_materiales': 100000,
    'total': 385000,
    'duracion_estimada_horas': 4,
    'items': [{
        'tipo': 'mano_obra',
        'descripcion': 'Instalacion unidad split',
        'cantidad': 4,
        'unidad': 'HR',
        'precio_unitario': 62500,
        'subtotal': 250000
    }]
})
print(f'  POST /quotes -> {s}')
if s in (200, 201):
    print(f'  Quote ID: {b.get("id")} Numero: {b.get("numero")}')
