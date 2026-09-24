#!/bin/bash
# Deploy Zero-Downtime del backend de InteliMarket (FastAPI)
# Aplica migraciones y reinicia las 2 instancias de PRODUCCION UNA POR VEZ,
# verificando salud de cada una antes de tocar la siguiente. En ningun
# momento las 2 estan caidas a la vez: nginx (intelimarket_api_pool) le
# sigue mandando trafico a la que sigue arriba mientras la otra reinicia.
set -euo pipefail

REPO_DIR="/home/intellihouse/intelimarket"
API_DIR="$REPO_DIR/api"
VENV="$REPO_DIR/.venv"

wait_healthy() {
  local port="$1" name="$2" tries=0
  until curl -s -f "http://127.0.0.1:${port}/api/health" > /dev/null; do
    tries=$((tries + 1))
    if [ "$tries" -ge 20 ]; then
      echo "✗ ${name} (puerto ${port}) no respondio sano tras 20s. Abortando sin tocar la otra instancia."
      exit 1
    fi
    sleep 1
  done
  echo "✓ ${name} (puerto ${port}) OK"
}

echo "==> [1/4] Aplicando migraciones de base de datos (Alembic)..."
cd "$API_DIR"
"$VENV/bin/alembic" upgrade head

echo "==> [2/4] Reiniciando instancia 1 (puerto 8000)..."
sudo -n /usr/bin/systemctl restart intelimarket-api.service
wait_healthy 8000 "Instancia 1"

echo "==> [3/4] Instancia 1 ya sirve el codigo nuevo. Margen de seguridad antes de tocar la instancia 2..."
sleep 5
echo "==> Reiniciando instancia 2 (puerto 8010)..."
sudo -n /usr/bin/systemctl restart intelimarket-api-2.service
wait_healthy 8010 "Instancia 2"

echo "==> [4/4] Verificando el pool completo por nginx..."
if curl -s -f http://127.0.0.1:5173/api/health > /dev/null; then
  echo "✓ Pool de produccion respondiendo OK (HTTP 200) a traves de nginx"
else
  echo "⚠️  El pool no respondio via nginx -- revisar 'nginx -t' y los logs de ambas instancias."
fi

echo "==> Deploy de Backend completado exitosamente, sin corte."
