import urllib.request, json

# Login as admin
req = urllib.request.Request('http://localhost:8000/api/v1/auth/login',
    data=json.dumps({'email':'admin@supermer.com','password':'admin123'}).encode(),
    headers={'Content-Type':'application/json'})
resp = urllib.request.urlopen(req, timeout=10)
token = json.loads(resp.read().decode())['access_token']
print('Logged in')

# Test verticals endpoint
req2 = urllib.request.Request('http://localhost:8000/api/v1/admin/verticals',
    headers={'Authorization': f'Bearer {token}'})
resp2 = urllib.request.urlopen(req2, timeout=10)
verticals = json.loads(resp2.read().decode())
print(f'Verticals: {len(verticals)}')
for v in verticals:
    print(f'  {v["slug"]:15s} {v["nombre"]:35s} icon={v["icon"]:15s} features={len(v["features"])}')

# Test features endpoint
req3 = urllib.request.Request('http://localhost:8000/api/v1/admin/features',
    headers={'Authorization': f'Bearer {token}'})
resp3 = urllib.request.urlopen(req3, timeout=10)
features = json.loads(resp3.read().decode())
print(f'All features: {len(features)}')
