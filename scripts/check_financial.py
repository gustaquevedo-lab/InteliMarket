import sys
sys.path.insert(0, '/app')
from api.src.financial.router import router
print(f"financial routes: {len(router.routes)}")
for r in router.routes[:10]:
    print(f"  {r.path}")
