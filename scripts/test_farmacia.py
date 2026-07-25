"""Test farmacia endpoints."""
import asyncio
import json
import urllib.request
import urllib.parse

API = "http://localhost:8000"

def login():
    data = json.dumps({"email": "admin@supermer.com", "password": "admin123"}).encode()
    req = urllib.request.Request(f"{API}/api/v1/auth/login", data=data,
        headers={"Content-Type": "application/json"})
    resp = urllib.request.urlopen(req, timeout=30)
    return json.loads(resp.read())["access_token"]

def get(path, token):
    req = urllib.request.Request(f"{API}{path}", headers={"Authorization": f"Bearer {token}"})
    resp = urllib.request.urlopen(req, timeout=30)
    return json.loads(resp.read())

def post(path, token, data):
    body = json.dumps(data).encode()
    req = urllib.request.Request(f"{API}{path}", data=body, method="POST",
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {token}"})
    resp = urllib.request.urlopen(req, timeout=30)
    return json.loads(resp.read())

# Login
token = login()
print(f"Token OK ({len(token)} chars)")

# Get dashboard
try:
    r = get("/api/v1/farmacia/dashboard?company_id=00000000-0000-0000-0000-000000000010", token)
    print(f"Dashboard: {json.dumps(r, indent=2, default=str)[:500]}")
except Exception as e:
    print(f"Dashboard error: {e}")

# Get medications
try:
    r = get("/api/v1/farmacia/medications?company_id=00000000-0000-0000-0000-000000000010", token)
    meds = r if isinstance(r, list) else r.get("items", r.get("data", []))
    print(f"\nMedications: {len(meds)} total")
    if meds:
        print(f"  Sample: {meds[0].get('nombre', meds[0])}")
except Exception as e:
    print(f"Medications error: {e}")

# Get active ingredients
try:
    r = get("/api/v1/farmacia/active-ingredients?company_id=00000000-0000-0000-0000-000000000010", token)
    pa = r if isinstance(r, list) else r.get("items", r.get("data", []))
    print(f"\nActive ingredients: {len(pa)} total")
except Exception as e:
    print(f"PA error: {e}")
