import sys, traceback
sys.path = ['/app'] + sys.path

try:
    print("Importing api...", flush=True)
    import api
    print("  api OK", flush=True)
except Exception:
    traceback.print_exc()

try:
    print("Importing auth.middleware...", flush=True)
    from api.src.auth.middleware import require_auth
    print("  middleware OK", flush=True)
except Exception:
    traceback.print_exc()

try:
    print("Importing tenants.admin_router...", flush=True)
    from api.src.tenants.admin_router import router
    print("  admin_router OK", flush=True)
except Exception:
    traceback.print_exc()
