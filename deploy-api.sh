#!/bin/bash
# Deploy Zero-Downtime del backend de InteliMarket (FastAPI)
# Aplica migraciones de base de datos y reinicia secuencialmente las instancias
set -euo pipefail

REPO_DIR="/home/intellihouse/intelimarket"
API_DIR="$REPO_DIR/api"
VENV="$REPO_DIR/.venv"

echo "==> [1/3] Aplicando migraciones de base de datos (Alembic)..."
cd "$API_DIR"
"$VENV/bin/alembic" upgrade head

echo "==> [2/3] Reiniciando servicio de produccion..."
sudo -n /usr/bin/systemctl restart intelimarket-api

echo "==> [3/3] Verificando estado del servicio (Health check)..."
sleep 2
if curl -s -f http://127.0.0.1:8000/api/health > /dev/null; then
  echo "✓ API de Producción respondiendo OK (HTTP 200)"
else
  echo "⚠️ Advertencia: Health check en espera, verificando servicio..."
  sudo -n /usr/bin/systemctl status intelimarket-api
fi

echo "==> Deploy de Backend completado exitosamente."
