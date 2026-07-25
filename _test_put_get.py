import urllib.request, json, time

# Login
req = urllib.request.Request('http://localhost:8000/api/v1/auth/login',
    data=json.dumps({'email':'admin@supermer.com','password':'admin123'}).encode(),
    headers={'Content-Type':'application/json'})
resp = urllib.request.urlopen(req, timeout=10)
token = json.loads(resp.read().decode())['access_token']
headers = {'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'}

# Switch to retail
req3 = urllib.request.Request('http://localhost:8000/api/v1/admin/tenants/00000000-0000-0000-0000-000000000001/config',
    data=json.dumps({'vertical_slug': 'retail', 'custom_features': False}).encode(),
    headers=headers)
req3.method = 'PUT'
resp3 = urllib.request.urlopen(req3, timeout=10)
result = json.loads(resp3.read().decode())
print(f'PUT response: vertical={result.get("vertical_slug")}, features={len(result.get("enabled_features", []))}')

# Wait a bit for commit
time.sleep(1)

# Read back via API (same session)
req4 = urllib.request.Request('http://localhost:8000/api/v1/admin/tenants/00000000-0000-0000-0000-000000000001/config',
    headers=headers)
resp4 = urllib.request.urlopen(req4, timeout=10)
config = json.loads(resp4.read().decode())
print(f'GET after PUT: vertical={config.get("vertical_slug")}, features={len(config.get("enabled_features", []))}')
