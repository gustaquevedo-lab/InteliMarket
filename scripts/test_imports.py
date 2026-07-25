import sys
sys.path.insert(0, '/app')
errors = []
for mod in ['api.src.marketing.service', 'api.src.data_migration.router',
            'api.src.intelientregas.fase2_router', 'api.src.client_app.router',
            'api.src.distribuidora.router', 'api.src.distribuidora.tracking_router']:
    try:
        __import__(mod)
        print(f'OK  {mod}')
    except Exception as e:
        print(f'ERR {mod}: {type(e).__name__}: {e}')
        import traceback
        traceback.print_exc()
        print('---')
