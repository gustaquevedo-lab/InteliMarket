import urllib.request, json

# Login
req = urllib.request.Request('http://localhost:8000/api/v1/auth/login',
    data=json.dumps({'email':'admin@supermer.com','password':'admin123'}).encode(),
    headers={'Content-Type':'application/json'})
resp = urllib.request.urlopen(req, timeout=10)
token = json.loads(resp.read().decode())['access_token']
headers = {'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'}

# Get current config
req2 = urllib.request.Request('http://localhost:8000/api/v1/admin/tenants/00000000-0000-0000-0000-000000000001/config',
    headers=headers)
resp2 = urllib.request.urlopen(req2, timeout=10)
config = json.loads(resp2.read().decode())
print(f'Current vertical: {config.get("vertical_slug")}')
print(f'Current features: {len(config.get("enabled_features", []))}')

# Switch to retail - use PUT method
req3 = urllib.request.Request('http://localhost:8000/api/v1/admin/tenants/00000000-0000-0000-0000-000000000001/config',
    data=json.dumps({'vertical_slug': 'retail', 'custom_features': False}).encode(),
    headers=headers)
req3.method = 'PUT'
resp3 = urllib.request.urlopen(req3, timeout=10)
print(f'Switch to retail: {resp3.status}')

# Verify
req4 = urllib.request.Request('http://localhost:8000/api/v1/admin/tenants/00000000-0000-0000-0000-000000000001/config',
    headers=headers)
resp4 = urllib.request.urlopen(req4, timeout=10)
config2 = json.loads(resp4.read().decode())
print(f'New vertical: {config2.get("vertical_slug")}')
print(f'New features: {len(config2.get("enabled_features", []))}')

# Restore to supermercado
req5 = urllib.request.Request('http://localhost:8000/api/v1/admin/tenants/00000000-0000-0000-0000-000000000001/config',
    data=json.dumps({'vertical_slug': 'supermercado', 'custom_features': False}).encode(),
    headers=headers)
req5.method = 'PUT'
urllib.request.urlopen(req5, timeout=10)
print('Restored to supermercado')
