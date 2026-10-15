#!/usr/bin/env bash
set -euo pipefail

REPO="/home/intellihouse/intelimarket"
BRANCH="${1:-vertical/distribuidora}"
VENV="$REPO/.venv/bin/python"
MIGRATE_SCRIPT="$REPO/scripts/migrate.py"
SYSTEMCTL="/usr/bin/systemctl"

echo "=== [1/4] Git: fetch + reset to origin/$BRANCH ==="
cd "$REPO"
git fetch origin "$BRANCH"
git checkout "$BRANCH"
git reset --hard "origin/$BRANCH"

echo "=== [2/4] Migrations ==="
if [ -f "$MIGRATE_SCRIPT" ]; then
    "$VENV" "$MIGRATE_SCRIPT"
else
    echo "No migration script found, skipping."
fi

echo "=== [3/4] UI Build ==="
cd "$REPO/ui-web"
npm install --silent || echo "npm install warning (some packages may have failed due to network)"
npx vite build 2>&1 | grep -E 'built in|✓|PWA|error|Error'

echo "=== [4/4] Restart APIs (zero-downtime) ==="
# Kill any suelto uvicorn that might be occupying ports
for port in 8000 8010; do
    pid=$(ss -tlnp "sport = :$port" 2>/dev/null | awk '/LISTEN/{match($0,/pid=([0-9]+)/,m); if(m[1]) print m[1]}' | head -1)
    if [ -n "$pid" ]; then
        echo "Killing suelto on port $port (PID $pid)"
        kill "$pid" 2>/dev/null || true
        sleep 1
    fi
done
sudo "$SYSTEMCTL" restart intelimarket-api-2
sleep 6
sudo "$SYSTEMCTL" restart intelimarket-api
"$SYSTEMCTL" is-active intelimarket-api-2 && echo "api-2: OK" || echo "api-2: FAIL"
"$SYSTEMCTL" is-active intelimarket-api  && echo "api:   OK" || echo "api:   FAIL"

echo "=== Deploy completo ==="
