"""Quick API check script."""
import urllib.request
import json

BASE = "http://localhost:8000"

# Login
data = json.dumps({"email": "admin@supermer.com", "password": "admin123"}).encode()
req = urllib.request.Request(f"{BASE}/api/v1/auth/login", data=data, headers={"Content-Type": "application/json"})
r = urllib.request.urlopen(req)
token = json.loads(r.read())["access_token"]
print(f"Token: {token[:30]}...")

# Get openapi and count farmacia paths
req = urllib.request.Request(f"{BASE}/api/openapi.json", headers={"Authorization": f"Bearer {token}"})
r = urllib.request.urlopen(req)
openapi = json.loads(r.read())
farmacia_paths = [p for p in openapi.get("paths", {}).keys() if "/farmacia" in p]
print(f"\n=== FARMACIA ENDPOINTS ({len(farmacia_paths)}) ===")
for p in sorted(farmacia_paths)[:60]:
    methods = list(openapi["paths"][p].keys())
    print(f"  {','.join(methods).upper():10s} {p}")
if len(farmacia_paths) > 60:
    print(f"  ... +{len(farmacia_paths)-60} mas")

total = len(openapi.get("paths", {}))
print(f"\nTotal API paths: {total}")
