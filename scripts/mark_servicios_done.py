"""Mark servicios backend as done in ROADMAP_VERTICALS.html and verify state."""
import re
import sys

ROADMAP = r'C:\Users\Gustavo\OneDrive\Dev\Intelimarket\ROADMAP_VERTICALS.html'

with open(ROADMAP, 'r', encoding='utf-8') as f:
    s = f.read()

# Already updated by my edits. Just verify.
print('ROADMAP_VERTICALS.html state check:')
print(f'  STATE_VERSION: {re.search(r"const STATE_VERSION = (\d+)", s).group(1)}')
print(f'  API paths: {re.search(r"API paths</span><span class=\"stat-value\">(\d+)", s).group(1)}')
print(f'  Tablas DB: {re.search(r"Tablas DB</span><span class=\"stat-value\">([^<]+)", s).group(1)}')
print(f'  Alembic head: {re.search(r"Alembic head</span><span class=\"stat-value\"[^>]*>([^<]+)", s).group(1)}')

# Count servicios modules
m = re.search(r'id: "servicios",.*?phases:\s*\[(.*?)\]\s*\]', s, re.DOTALL)
if m:
    section = m.group(1)
    n_done = section.count('status: "done"')
    n_inprog = section.count('status: "in_progress"')
    n_pending = section.count('status: "pending"')
    print(f'\nServicios vertical:')
    print(f'  done: {n_done}, in_progress: {n_inprog}, pending: {n_pending}')

# Check total
all_modules = re.findall(r'status: "(done|pending|in_progress)"', s)
print(f'\nAll modules: done={all_modules.count("done")}, in_progress={all_modules.count("in_progress")}, pending={all_modules.count("pending")}')
print(f'Total: {len(all_modules)}')
