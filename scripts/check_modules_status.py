import urllib.request, json

r = urllib.request.urlopen('http://localhost:8000/api/openapi.json', timeout=30)
spec = json.loads(r.read())
paths = spec.get('paths', {})

# Group by module
modules = {}
for p in sorted(paths):
    parts = p.split('/')
    if len(parts) > 3:
        module = parts[3]
        if module not in modules:
            modules[module] = []
        modules[module].append(p)

# Check for the previously broken modules
target_modules = [
    'supermer', 'marketing', 'credit-scoring', 'cold-chain', 'asistente-virtual',
    'comerciales', 'clientes', 'scanandgo', 'customer360', 'schedule',
    'productividad', 'capacitacion', 'pygdiario', 'shrinkage', 'forecast-avanzado',
    'benchmarking', 'ecommerce-sm', 'advanced-inventory', 'data-migration',
    'financial', 'distribuidora', 'intelientregas-fase2', 'client-app',
]

for m in target_modules:
    if m in modules:
        print(f'OK  {m}: {len(modules[m])} paths')
    else:
        print(f'NO  {m}: NOT REGISTERED')
