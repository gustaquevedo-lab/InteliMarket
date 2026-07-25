import urllib.request, json

endpoints_by_module = {
    'supermer': [
        '/api/v1/supermer/rotiseria/recipes',
        '/api/v1/supermer/haccp/plans',
        '/api/v1/supermer/audits/templates',
    ],
    'marketing': [
        '/api/v1/marketing/campaigns',
        '/api/v1/marketing/segments',
    ],
    'credit_scoring': [
        '/api/v1/credit-scoring/scores',
    ],
    'cold_chain': [
        '/api/v1/cold-chain/sensors',
    ],
    'asistente_virtual': [
        '/api/v1/asistente-virtual/conversations',
    ],
    'comerciales': [
        '/api/v1/comerciales/opportunities',
    ],
    'clientes': [
        '/api/v1/clientes/segments',
    ],
    'scanandgo': [
        '/api/v1/scanandgo/sessions',
    ],
    'customer360': [
        '/api/v1/customer360/profiles',
    ],
    'schedule': [
        '/api/v1/schedule/tasks',
    ],
    'productividad': [
        '/api/v1/productividad/metrics',
    ],
    'capacitacion': [
        '/api/v1/capacitacion/courses',
    ],
    'pygdiario': [
        '/api/v1/pygdiario/entries',
    ],
    'shrinkage': [
        '/api/v1/shrinkage/events',
    ],
    'forecast_avanzado': [
        '/api/v1/forecast-avanzado/models',
    ],
    'benchmarking': [
        '/api/v1/benchmarking/comparisons',
    ],
    'ecommerce_sm': [
        '/api/v1/ecommerce-sm/products',
    ],
    'advanced_inventory': [
        '/api/v1/advanced-inventory/locations',
    ],
    'data_migration': [
        '/api/v1/data-migration/jobs',
    ],
    'financial': [
        '/api/v1/financial/dashboard',
    ],
    'distribuidora': [
        '/api/v1/distribuidora/dashboard',
    ],
    'intelientregas_fase2': [
        '/api/v1/intelientregas-fase2/routes',
    ],
    'client_app': [
        '/api/v1/client-app/products',
    ],
}

results = {}
for module, endpoints in endpoints_by_module.items():
    results[module] = []
    for path in endpoints:
        try:
            r = urllib.request.urlopen(f'http://localhost:8000{path}', timeout=10)
            results[module].append((path, r.status))
        except urllib.error.HTTPError as e:
            results[module].append((path, e.code))
        except Exception as e:
            results[module].append((path, f'ERR:{type(e).__name__}'))

# Print summary
total = 0
ok = 0
for module, results_list in results.items():
    print(f'{module}:')
    for path, status in results_list:
        print(f'  {status} {path}')
        total += 1
        if status in (200, 401, 403, 422, 405):
            ok += 1
print()
print(f'Total: {ok}/{total} endpoints responding (any HTTP code = router loaded)')
