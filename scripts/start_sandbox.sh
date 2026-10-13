#!/usr/bin/env bash
set -e

echo "🚀 Iniciando Entorno Sandbox Paralelo (Puertos 8001 / 5174)..."

# 1. Matar procesos anteriores de sandbox si existen
fuser -k 8001/tcp 2>/dev/null || true
fuser -k 5174/tcp 2>/dev/null || true
sleep 1

# 2. Iniciar Backend Sandbox en puerto 8001 con esquema sandbox
# (DB_SEARCH_PATH en vez de server_settings en la URL: asyncpg exige
# server_settings como dict, no como string de query param -- con la URL
# rota el motor no llegaba a conectar y todo endpoint tiraba 500).
export DATABASE_URL="postgresql+asyncpg://intelimarket:password@localhost:5432/intelimarket"
export DB_SEARCH_PATH="sandbox,public"
export PORT=8001
export PYTHONPATH=/home/intellihouse/intelimarket
cd /home/intellihouse/intelimarket/api

nohup /home/intellihouse/intelimarket/.venv/bin/uvicorn api.src.main:app --host 0.0.0.0 --port 8001 > /tmp/sandbox_api.log 2>&1 &
echo "✅ Backend Sandbox corriendo en puerto 8001 (PID: $!)"

# 3. Iniciar Frontend Sandbox en puerto 5174 conectado al API 8001
cd /home/intellihouse/intelimarket/ui-web
export VITE_API_URL="http://192.168.0.242:8001/api"
nohup npm run dev -- --host 0.0.0.0 --port 5174 > /tmp/sandbox_ui.log 2>&1 &
echo "✅ Frontend Sandbox corriendo en puerto 5174 (PID: $!)"

sleep 2
echo "🌐 Entorno Sandbox 100% Activo:"
echo "   👉 POS Sandbox: http://192.168.0.242:5174/pos"
echo "   👉 ERP Sandbox: http://192.168.0.242:5174/"
