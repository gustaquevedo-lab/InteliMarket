#!/bin/bash
# Arranque del entorno sandbox de InteliMarket (schema "sandbox", puertos 8001/5174).
# IMPORTANTE: VITE_API_URL debe ser relativo (/api) para que el navegador
# llame por el mismo origen (192.168.0.242:5174) y el proxy interno de Vite
# reenvíe a la API -- una URL absoluta a :8001 requiere que ese puerto sea
# alcanzable directo desde la red del cliente, lo cual rompía el login con
# "Failed to fetch" en cualquier dispositivo fuera del propio servidor.
set -e
cd /home/intellihouse/intelimarket

pkill -f "uvicorn api.src.main:app --host 0.0.0.0 --port 8001" 2>/dev/null || true
pkill -f "vite --port 5174" 2>/dev/null || true
sleep 2

cd api
DATABASE_URL='postgresql+asyncpg://intelimarket:password@localhost:5432/intelimarket' \
DB_SEARCH_PATH='sandbox,public' \
PYTHONPATH=/home/intellihouse/intelimarket \
TZ=America/Asuncion \
nohup /home/intellihouse/intelimarket/.venv/bin/uvicorn api.src.main:app --host 0.0.0.0 --port 8001 \
  > /home/intellihouse/intelimarket/sandbox-api.log 2>&1 &
disown

cd ../ui-web
VITE_API_URL=/api \
VITE_API_PROXY_TARGET=http://localhost:8001 \
nohup npm run dev -- --port 5174 --host 0.0.0.0 \
  > /home/intellihouse/intelimarket/sandbox-vite.log 2>&1 &
disown

echo "Sandbox arrancado: API en :8001, UI en :5174"
