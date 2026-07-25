import re

with open(r'C:\Users\Gustavo\OneDrive\Dev\Intelimarket\api\src\main.py', encoding='utf-8') as f:
    content = f.read()

# Known problematic routers (commented out)
broken_routers = [
    'supermer_router',
    'data_migration_router',
    'financial_router',
    'distribuidora_router',
    'distribuidora_tracking_router',
    'intelientregas_fase2_router',
    'client_app_router',
    'marketing_router',
    'advanced_inventory_router',
    'credit_scoring_router',
    'comerciales_router',
    'cold_chain_router',
    'asistente_virtual_router',
    'clientes_router',
    'scanandgo_router',
    'customer360_router',
    'schedule_router',
    'productividad_router',
    'capacitacion_router',
    'pygdiario_router',
    'shrinkage_router',
    'forecast_avanzado_router',
    'benchmarking_router',
    'ecommerce_sm_router',
]

lines = content.split('\n')
new_lines = []
commented = 0
for line in lines:
    matched = False
    for r in broken_routers:
        # Match either "from api.src.X.router import router as R_router" or "app.include_router(R_router)"
        if (f'as {r}' in line) or (line.strip() == f'app.include_router({r})'):
            new_lines.append('# ' + line + '  # TODO: fix import errors')
            matched = True
            commented += 1
            break
    if not matched:
        new_lines.append(line)

with open(r'C:\Users\Gustavo\OneDrive\Dev\Intelimarket\api\src\main.py', 'w', encoding='utf-8') as f:
    f.write('\n'.join(new_lines))

print(f'Commented {commented} lines')
