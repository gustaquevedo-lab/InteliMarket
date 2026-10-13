import asyncio
import json
import re
import httpx
import sys
import os

sys.path.insert(0, '/home/intellihouse/intelimarket')
from api.src.main import app
from api.src.auth.jwt import create_access_token

COMPANY_ID = '00000000-0000-0000-0000-000000000010'

# Read all endpoint strings from ui-web/src/api/index.ts
with open('/home/intellihouse/intelimarket/ui-web/src/api/index.ts', 'r') as f:
    content = f.read()

# Extract client.get, client.post, client.put, client.patch, client.delete
matches = re.findall(r'client\.(get|post|put|patch|delete)(?:<[^>]+>)?\([`\'\"]([^`\'\"\)\,\?]+)', content)

# Normalize endpoints for Casa Gonzalito
unique_endpoints = {}
for method, raw_url in matches:
    url = raw_url.replace('${COMPANY_ID}', COMPANY_ID).replace('${company_id}', COMPANY_ID).replace('${companyId}', COMPANY_ID).replace('${companyId || COMPANY_ID}', COMPANY_ID)
    if '${' in url:
        url = re.sub(r'\$\{[^\}]+\}', 'sample-id', url)
    if not url.startswith('/'):
        url = '/' + url
    if not url.startswith('/api'):
        url = '/api' + url
    key = (method.upper(), url)
    unique_endpoints[key] = raw_url

async def run_audit():
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url='http://testserver') as client:
        token = create_access_token({
            'sub': 'cf0390d1-a0ab-4d3a-aa43-5f1324060915',
            'user_email': 'admin@casagonzalito.py',
            'user_nombre': 'Admin Casa Gonzalito',
            'rol': 'super_admin',
            'is_superadmin': True,
            'tenant_id': '00000000-0000-0000-0000-000000000001'
        })
        headers = {'Authorization': f'Bearer {token}'}

        passed = []
        failed_404 = []
        failed_500 = []
        failed_other = []

        for (method, url), raw in sorted(unique_endpoints.items()):
            test_method = method if method == 'GET' else 'GET'
            try:
                res = await client.request(test_method, url, headers=headers)
                status = res.status_code
                if status in (200, 201):
                    passed.append((method, url, status, len(res.text)))
                elif status == 404:
                    failed_404.append((method, url, status, raw))
                elif status in (405, 422):
                    passed.append((method, url, status, 'Route exists'))
                elif status == 500:
                    failed_500.append((method, url, status, raw, res.text[:200]))
                else:
                    failed_other.append((method, url, status, raw, res.text[:200]))
            except Exception as e:
                failed_other.append((method, url, 'EXC', raw, str(e)))

        print('\n' + '='*80)
        print('FULL SYSTEM AUDIT RESULTS (IN-MEMORY ASGI):')
        print(f'  TOTAL TESTED: {len(unique_endpoints)}')
        print(f'  PASSED / REACHABLE: {len(passed)}')
        print(f'  404 NOT FOUND (DISCONNECTED): {len(failed_404)}')
        print(f'  500 SERVER ERRORS: {len(failed_500)}')
        print(f'  OTHER STATUS: {len(failed_other)}')
        print('='*80)

        print('\n--- DISCONNECTED ENDPOINTS (404 NOT FOUND) ---')
        for m, u, s, raw in sorted(failed_404, key=lambda x: x[1]):
            print(f'[{m}] {u:<65} | (source: {raw})')

        if failed_500:
            print('\n--- SERVER ERRORS (500) ---')
            for m, u, s, raw, err in sorted(failed_500, key=lambda x: x[1]):
                print(f'[{m}] {u:<65} | err: {err}')

        # Save to JSON
        with open('/tmp/audit_report.json', 'w') as f:
            json.dump({
                'total_tested': len(unique_endpoints),
                'passed_count': len(passed),
                'failed_404_count': len(failed_404),
                'failed_500_count': len(failed_500),
                'failed_404': failed_404,
                'failed_500': failed_500,
            }, f, indent=2)

if __name__ == '__main__':
    asyncio.run(run_audit())
