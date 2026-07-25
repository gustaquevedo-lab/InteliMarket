try:
    import sys
    print("Importing main app...")
    sys.stdout.flush()
    from api.src.main import app
    print("IMPORTED OK")
    sys.stdout.flush()
    print("Routes:", len(app.routes))
except Exception as e:
    import traceback
    traceback.print_exc()
