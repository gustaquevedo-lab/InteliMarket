#!/usr/bin/env bash
set -e

HOST="minisforum-ia"
REMOTE_DIR="/home/intellihouse/intelimarket"

echo "🚀 [1/4] Sincronizando Backend (api/) hacia ${HOST}..."
rsync -avz --exclude '__pycache__' --exclude '.venv' api/ ${HOST}:${REMOTE_DIR}/api/

echo "📦 [2/4] Sincronizando Frontend (ui-web/) hacia ${HOST}..."
rsync -avz --exclude 'node_modules' --exclude 'dist' ui-web/ ${HOST}:${REMOTE_DIR}/ui-web/

echo "🔨 [3/4] Compilando Frontend con Vite en ${HOST}..."
ssh ${HOST} "cd ${REMOTE_DIR}/ui-web && npx vite build"

echo "🔄 [4/4] Reiniciando servicio backend systemd en ${HOST}..."
ssh ${HOST} "systemctl --user restart intelimarket-backend"

echo "🩺 Verificando estado del servicio..."
HEALTHY=false
for i in {1..10}; do
  STATUS=$(ssh ${HOST} "curl -s http://localhost:8000/api/v1/health | grep -o '\"status\":\"ok\"' || true")
  if [ "$STATUS" == '"status":"ok"' ]; then
    HEALTHY=true
    break
  fi
  echo "   ... esperando arranque (${i}/10)"
  sleep 1
done

if [ "$HEALTHY" = true ]; then
  echo "✅ Despliegue exitoso. InteliMarket Backend activo y respondiendo 200 OK."
else
  echo "❌ Error: El backend no respondió a la verificación de salud. Mostrando logs:"
  ssh ${HOST} "journalctl --user-unit intelimarket-backend -n 20 --no-pager"
  exit 1
fi
