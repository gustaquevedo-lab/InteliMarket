"""Quick test that ROADMAP_VERTICALS.html parses correctly with all modules rendered."""
import re

with open('ROADMAP_VERTICALS.html', 'r', encoding='utf-8') as f:
    html = f.read()

# Count verticals, phases, modules
verticals = re.findall(r'id: "(\w+)",\s*name:', html)
phases = re.findall(r'id: "([\w-]+)",\s*title:', html)
modules = re.findall(r'id: "([\w-]+)",\s*title:.*?status: "(done|pending|in-progress)"', html, re.DOTALL)
tasks = re.findall(r'"(✅ [^"]+)"', html)

print(f"Verticals: {len(verticals)}")
for v in verticals: print(f"  - {v}")
print(f"\nPhases: {len(phases)}")
print(f"Modules: {len(modules)}")
done = sum(1 for m in modules if m[1] == 'done')
pending = sum(1 for m in modules if m[1] == 'pending')
in_prog = sum(1 for m in modules if m[1] == 'in-progress')
print(f"  done: {done}, in-progress: {in_prog}, pending: {pending}")
print(f"\nTasks marked done (with ✅): {len(tasks)}")

# Check for required constants
required = ['STATE_VERSION = 8', 'STORAGE_KEY = "intelimarket_roadmap_verticals"', 'VERTICAL_META']
for r in required:
    print(f"  {r}: {'✓' if r in html else '✗ MISSING'}")
